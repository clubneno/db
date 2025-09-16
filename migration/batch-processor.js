/**
 * Batch processing with transaction management for Supabase migration
 */

/**
 * Split array into chunks of specified size
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sleep function for delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Batch processor with transaction management using Supabase MCP
 */
class BatchProcessor {
  constructor(mcp, config) {
    this.mcp = mcp;
    this.config = config;
  }

  /**
   * Process data in batches with retries and transaction support
   */
  async processBatches(data, tableName, options = {}) {
    const {
      batchSize = this.config.batchSize,
      onConflict = 'id',
      ignoreDuplicates = false,
      enableTransaction = this.config.enableTransactions,
      onProgress = null
    } = options;

    console.log(`🚀 Processing ${data.length} records in batches of ${batchSize}`);
    
    const chunks = chunkArray(data, batchSize);
    const results = {
      successful: 0,
      failed: 0,
      errors: [],
      totalProcessed: 0
    };

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const batchNumber = i + 1;
      
      console.log(`📦 Processing batch ${batchNumber}/${chunks.length} (${chunk.length} items)`);

      try {
        if (enableTransaction) {
          await this.processBatchWithTransaction(chunk, tableName, onConflict, ignoreDuplicates);
        } else {
          await this.processBatchSimple(chunk, tableName, onConflict, ignoreDuplicates);
        }
        
        results.successful += chunk.length;
        console.log(`✅ Batch ${batchNumber} completed successfully`);
        
      } catch (error) {
        console.error(`❌ Batch ${batchNumber} failed:`, error.message);
        results.failed += chunk.length;
        results.errors.push({
          batchNumber,
          chunkSize: chunk.length,
          error: error.message,
          timestamp: new Date().toISOString()
        });

        // Optionally try to process items individually to salvage what we can
        if (this.config.enableIndividualRetry) {
          console.log(`🔄 Attempting individual processing for failed batch ${batchNumber}`);
          const individualResults = await this.processIndividually(chunk, tableName, onConflict, ignoreDuplicates);
          results.successful += individualResults.successful;
          results.failed -= individualResults.successful; // Adjust failed count
        }
      }

      results.totalProcessed += chunk.length;

      // Progress callback
      if (onProgress) {
        onProgress({
          batchNumber,
          totalBatches: chunks.length,
          processed: results.totalProcessed,
          total: data.length,
          successful: results.successful,
          failed: results.failed
        });
      }

      // Add delay between batches to avoid overwhelming the database
      if (i < chunks.length - 1) {
        await sleep(100);
      }
    }

    return results;
  }

  /**
   * Process batch with transaction support using MCP
   */
  async processBatchWithTransaction(chunk, tableName, onConflict, ignoreDuplicates) {
    const maxRetries = this.config.maxRetries;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Build upsert query for MCP
        const result = await this.upsertBatch(chunk, tableName, onConflict, ignoreDuplicates);
        return result;
        
      } catch (error) {
        lastError = error;
        console.warn(`⚠️  Batch attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = this.config.retryDelay * attempt; // Exponential backoff
          console.log(`🔄 Retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }

    throw new Error(`Batch failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Process batch without transaction (simple upsert)
   */
  async processBatchSimple(chunk, tableName, onConflict, ignoreDuplicates) {
    return await this.upsertBatch(chunk, tableName, onConflict, ignoreDuplicates);
  }

  /**
   * Perform batch upsert using MCP execute_sql
   */
  async upsertBatch(chunk, tableName, onConflict, ignoreDuplicates) {
    if (chunk.length === 0) return { count: 0 };

    // Build the SQL for batch upsert
    const columns = Object.keys(chunk[0]);
    const values = chunk.map(row => {
      const rowValues = columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
        return `'${value.toString().replace(/'/g, "''")}'`;
      });
      return `(${rowValues.join(', ')})`;
    }).join(', ');

    const conflictAction = ignoreDuplicates ? 'DO NOTHING' : 
      onConflict ? `DO UPDATE SET ${columns.filter(col => col !== onConflict).map(col => `${col} = EXCLUDED.${col}`).join(', ')}` : 
      'DO NOTHING';

    const sql = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES ${values}
      ON CONFLICT (${onConflict}) ${conflictAction}
    `;

    try {
      const result = await this.mcp.execute_sql({ query: sql });
      return { count: chunk.length, data: result };
    } catch (error) {
      console.error('SQL Error:', error);
      throw new Error(`Batch upsert failed: ${error.message}`);
    }
  }

  /**
   * Process items individually when batch fails
   */
  async processIndividually(chunk, tableName, onConflict, ignoreDuplicates) {
    console.log(`🔧 Processing ${chunk.length} items individually...`);
    
    let successful = 0;
    const errors = [];

    for (let i = 0; i < chunk.length; i++) {
      try {
        await this.upsertBatch([chunk[i]], tableName, onConflict, ignoreDuplicates);
        successful++;
        
      } catch (error) {
        errors.push({
          index: i,
          item: chunk[i],
          error: error.message
        });
      }
    }

    console.log(`✅ Individual processing: ${successful}/${chunk.length} successful`);
    
    if (errors.length > 0) {
      console.log(`❌ Failed items: ${errors.length}`);
      // Log first few errors for debugging
      errors.slice(0, 3).forEach(err => {
        console.log(`   Item ${err.index}: ${err.error}`);
      });
    }

    return { successful, errors };
  }

  /**
   * Bulk delete with batch processing
   */
  async deleteBatches(conditions, tableName, batchSize = 1000) {
    console.log(`🗑️  Bulk delete from ${tableName}`);
    
    // Apply conditions (this is a simplified example)
    if (conditions.column && conditions.values) {
      const chunks = chunkArray(conditions.values, batchSize);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`🗑️  Deleting batch ${i + 1}/${chunks.length}`);
        
        const valuesList = chunk.map(v => `'${v.toString().replace(/'/g, "''")}'`).join(',');
        const sql = `DELETE FROM ${tableName} WHERE ${conditions.column} IN (${valuesList})`;
        
        try {
          await this.mcp.execute_sql({ query: sql });
        } catch (error) {
          console.error(`❌ Delete batch ${i + 1} failed:`, error.message);
          throw error;
        }
      }
    }

    console.log(`✅ Bulk delete completed`);
  }

  /**
   * Optimize database before bulk operations
   */
  async optimizeForBulkOperations(tableName) {
    console.log(`⚡ Optimizing database for bulk operations on ${tableName}...`);
    
    if (this.config.disableTriggersOnImport) {
      try {
        // Disable triggers (requires elevated permissions)
        await this.mcp.execute_sql({
          query: `ALTER TABLE ${tableName} DISABLE TRIGGER ALL;`
        });
        console.log(`✅ Triggers disabled on ${tableName}`);
      } catch (error) {
        console.warn(`⚠️  Could not disable triggers: ${error.message}`);
      }
    }

    // Set work_mem for better performance
    try {
      await this.mcp.execute_sql({
        query: `SET work_mem = '256MB';`
      });
      console.log(`✅ Work memory increased`);
    } catch (error) {
      console.warn(`⚠️  Could not set work_mem: ${error.message}`);
    }
  }

  /**
   * Restore database after bulk operations
   */
  async restoreAfterBulkOperations(tableName) {
    console.log(`🔧 Restoring database after bulk operations on ${tableName}...`);
    
    if (this.config.disableTriggersOnImport) {
      try {
        // Re-enable triggers
        await this.mcp.execute_sql({
          query: `ALTER TABLE ${tableName} ENABLE TRIGGER ALL;`
        });
        console.log(`✅ Triggers re-enabled on ${tableName}`);
      } catch (error) {
        console.warn(`⚠️  Could not re-enable triggers: ${error.message}`);
      }
    }

    if (this.config.rebuildIndexesAfterImport) {
      try {
        // Rebuild indexes for better performance
        await this.mcp.execute_sql({
          query: `REINDEX TABLE ${tableName};`
        });
        console.log(`✅ Indexes rebuilt on ${tableName}`);
      } catch (error) {
        console.warn(`⚠️  Could not rebuild indexes: ${error.message}`);
      }
    }
  }
}

module.exports = BatchProcessor;