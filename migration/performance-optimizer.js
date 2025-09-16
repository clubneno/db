/**
 * Performance optimization utilities for large-scale migrations
 */

/**
 * Database performance optimizer using Supabase MCP
 */
class PerformanceOptimizer {
  constructor(mcp, config) {
    this.mcp = mcp;
    this.config = config;
    this.originalSettings = {};
  }

  /**
   * Optimize database settings for bulk operations
   */
  async optimizeForBulkOperations() {
    console.log('⚡ Optimizing database for bulk operations...');
    
    const optimizations = [
      // Increase work memory for better sorting and hash operations
      { setting: 'work_mem', value: '256MB', description: 'Increase work memory for operations' },
      
      // Increase maintenance work memory for index operations
      { setting: 'maintenance_work_mem', value: '512MB', description: 'Increase maintenance work memory' },
      
      // Increase checkpoint segments for better write performance
      { setting: 'checkpoint_segments', value: '32', description: 'Increase checkpoint segments' },
      
      // Reduce random page cost for SSD optimization
      { setting: 'random_page_cost', value: '1.1', description: 'Optimize for SSD storage' },
      
      // Increase effective cache size
      { setting: 'effective_cache_size', value: '1GB', description: 'Increase effective cache size' }
    ];

    const appliedSettings = [];

    for (const optimization of optimizations) {
      try {
        // Store original setting if we can retrieve it
        const original = await this.getCurrentSetting(optimization.setting);
        if (original !== null) {
          this.originalSettings[optimization.setting] = original;
        }

        // Apply optimization
        await this.setSetting(optimization.setting, optimization.value);
        appliedSettings.push(optimization);
        console.log(`✅ ${optimization.description}: ${optimization.value}`);
        
      } catch (error) {
        console.warn(`⚠️  Could not apply ${optimization.setting}: ${error.message}`);
      }
    }

    return appliedSettings;
  }

  /**
   * Restore original database settings
   */
  async restoreOriginalSettings() {
    console.log('🔧 Restoring original database settings...');
    
    for (const [setting, originalValue] of Object.entries(this.originalSettings)) {
      try {
        await this.setSetting(setting, originalValue);
        console.log(`✅ Restored ${setting}: ${originalValue}`);
      } catch (error) {
        console.warn(`⚠️  Could not restore ${setting}: ${error.message}`);
      }
    }
  }

  /**
   * Disable triggers on specified tables for faster inserts
   */
  async disableTriggers(tables) {
    console.log('🚫 Disabling triggers for bulk operations...');
    
    const results = [];
    
    for (const tableName of tables) {
      try {
        await this.mcp.execute_sql({
          query: `ALTER TABLE ${tableName} DISABLE TRIGGER ALL;`
        });
        
        results.push({ table: tableName, status: 'disabled' });
        console.log(`✅ Triggers disabled on ${tableName}`);
        
      } catch (error) {
        results.push({ table: tableName, status: 'failed', error: error.message });
        console.warn(`⚠️  Could not disable triggers on ${tableName}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Re-enable triggers on specified tables
   */
  async enableTriggers(tables) {
    console.log('✅ Re-enabling triggers...');
    
    const results = [];
    
    for (const tableName of tables) {
      try {
        await this.mcp.execute_sql({
          query: `ALTER TABLE ${tableName} ENABLE TRIGGER ALL;`
        });
        
        results.push({ table: tableName, status: 'enabled' });
        console.log(`✅ Triggers enabled on ${tableName}`);
        
      } catch (error) {
        results.push({ table: tableName, status: 'failed', error: error.message });
        console.warn(`⚠️  Could not enable triggers on ${tableName}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Drop indexes temporarily for faster bulk inserts
   */
  async dropIndexes(tables, preservePrimary = true) {
    console.log('🗑️  Temporarily dropping indexes for bulk operations...');
    
    const droppedIndexes = [];
    
    for (const tableName of tables) {
      try {
        const indexes = await this.getTableIndexes(tableName);
        
        for (const index of indexes) {
          // Skip primary key and unique constraints if preservePrimary is true
          if (preservePrimary && (index.is_primary || index.is_unique)) {
            continue;
          }

          try {
            const { error } = await this.supabase.rpc('execute_sql', {
              sql: `DROP INDEX IF EXISTS ${index.name};`
            });

            if (error) throw error;
            
            droppedIndexes.push({
              table: tableName,
              index: index.name,
              definition: index.definition
            });
            
            console.log(`✅ Dropped index: ${index.name}`);
            
          } catch (error) {
            console.warn(`⚠️  Could not drop index ${index.name}: ${error.message}`);
          }
        }
        
      } catch (error) {
        console.warn(`⚠️  Could not get indexes for ${tableName}: ${error.message}`);
      }
    }

    return droppedIndexes;
  }

  /**
   * Recreate indexes after bulk operations
   */
  async recreateIndexes(droppedIndexes) {
    console.log('🔧 Recreating indexes...');
    
    const results = [];
    
    for (const indexInfo of droppedIndexes) {
      try {
        const { error } = await this.supabase.rpc('execute_sql', {
          sql: indexInfo.definition
        });

        if (error) throw error;
        
        results.push({ 
          table: indexInfo.table, 
          index: indexInfo.index, 
          status: 'recreated' 
        });
        
        console.log(`✅ Recreated index: ${indexInfo.index}`);
        
      } catch (error) {
        results.push({ 
          table: indexInfo.table, 
          index: indexInfo.index, 
          status: 'failed', 
          error: error.message 
        });
        
        console.warn(`⚠️  Could not recreate index ${indexInfo.index}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Run VACUUM and ANALYZE after bulk operations
   */
  async maintainTables(tables) {
    console.log('🧹 Running maintenance on tables...');
    
    for (const tableName of tables) {
      try {
        // Run VACUUM to reclaim space
        console.log(`🧹 Vacuuming ${tableName}...`);
        await this.supabase.rpc('execute_sql', {
          sql: `VACUUM ${tableName};`
        });

        // Run ANALYZE to update statistics
        console.log(`📊 Analyzing ${tableName}...`);
        await this.supabase.rpc('execute_sql', {
          sql: `ANALYZE ${tableName};`
        });

        console.log(`✅ Maintenance completed for ${tableName}`);
        
      } catch (error) {
        console.warn(`⚠️  Maintenance failed for ${tableName}: ${error.message}`);
      }
    }
  }

  /**
   * Monitor connection pool and suggest optimizations
   */
  async monitorConnections() {
    try {
      const { data, error } = await this.supabase.rpc('execute_sql', {
        sql: `
          SELECT 
            count(*) as total_connections,
            count(*) filter (where state = 'active') as active_connections,
            count(*) filter (where state = 'idle') as idle_connections,
            count(*) filter (where state = 'idle in transaction') as idle_in_transaction
          FROM pg_stat_activity 
          WHERE datname = current_database();
        `
      });

      if (error) throw error;

      const stats = data[0];
      console.log('🔌 Connection Statistics:');
      console.log(`   Total: ${stats.total_connections}`);
      console.log(`   Active: ${stats.active_connections}`);
      console.log(`   Idle: ${stats.idle_connections}`);
      console.log(`   Idle in Transaction: ${stats.idle_in_transaction}`);

      // Provide recommendations
      if (stats.idle_in_transaction > 5) {
        console.warn('⚠️  High number of idle-in-transaction connections detected');
        console.log('   Consider using connection pooling or shorter transaction times');
      }

      if (stats.total_connections > 80) {
        console.warn('⚠️  High connection count detected');
        console.log('   Consider implementing connection pooling');
      }

      return stats;
      
    } catch (error) {
      console.warn('⚠️  Could not monitor connections:', error.message);
      return null;
    }
  }

  /**
   * Get current database setting
   */
  async getCurrentSetting(settingName) {
    try {
      const result = await this.mcp.execute_sql({
        query: `SHOW ${settingName};`
      });

      return result[0]?.[settingName] || null;
      
    } catch (error) {
      console.warn(`Could not get setting ${settingName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Set database setting
   */
  async setSetting(settingName, value) {
    await this.mcp.execute_sql({
      query: `SET ${settingName} = '${value}';`
    });
  }

  /**
   * Get table indexes
   */
  async getTableIndexes(tableName) {
    try {
      const { data, error } = await this.supabase.rpc('execute_sql', {
        sql: `
          SELECT 
            indexname as name,
            indexdef as definition,
            indisprimary as is_primary,
            indisunique as is_unique
          FROM pg_indexes 
          JOIN pg_index ON pg_indexes.indexname = 
            (SELECT relname FROM pg_class WHERE oid = pg_index.indexrelid)
          JOIN pg_class ON pg_class.oid = pg_index.indrelid
          WHERE pg_class.relname = '${tableName}'
          AND schemaname = 'public';
        `
      });

      if (error) throw error;
      return data || [];
      
    } catch (error) {
      console.warn(`Could not get indexes for ${tableName}: ${error.message}`);
      return [];
    }
  }

  /**
   * Calculate optimal batch size based on data and memory
   */
  calculateOptimalBatchSize(recordSize, availableMemory = 256) {
    // Estimate memory per record in MB (rough approximation)
    const estimatedRecordSize = recordSize || 2; // KB per record
    const memoryPerRecord = estimatedRecordSize / 1024; // MB per record
    
    // Use 70% of available memory for batching
    const usableMemory = availableMemory * 0.7;
    const calculatedBatchSize = Math.floor(usableMemory / memoryPerRecord);
    
    // Ensure reasonable bounds
    const minBatchSize = 100;
    const maxBatchSize = 2000;
    
    const optimalSize = Math.max(minBatchSize, Math.min(maxBatchSize, calculatedBatchSize));
    
    console.log(`📊 Batch size calculation:`);
    console.log(`   Estimated record size: ${estimatedRecordSize}KB`);
    console.log(`   Available memory: ${availableMemory}MB`);
    console.log(`   Optimal batch size: ${optimalSize}`);
    
    return optimalSize;
  }

  /**
   * Performance monitoring during migration
   */
  async monitorPerformance(callback, interval = 30000) {
    console.log(`📈 Starting performance monitoring (${interval}ms intervals)`);
    
    const monitor = setInterval(async () => {
      try {
        const stats = await this.getPerformanceStats();
        if (callback) {
          callback(stats);
        }
      } catch (error) {
        console.warn('Performance monitoring error:', error.message);
      }
    }, interval);

    return () => {
      clearInterval(monitor);
      console.log('📈 Performance monitoring stopped');
    };
  }

  /**
   * Get performance statistics
   */
  async getPerformanceStats() {
    try {
      const { data, error } = await this.supabase.rpc('execute_sql', {
        sql: `
          SELECT 
            (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_queries,
            (SELECT extract(epoch from now() - min(query_start)) FROM pg_stat_activity WHERE state = 'active') as longest_query_seconds,
            (SELECT sum(temp_files) FROM pg_stat_database WHERE datname = current_database()) as temp_files,
            (SELECT sum(temp_bytes) FROM pg_stat_database WHERE datname = current_database()) as temp_bytes;
        `
      });

      if (error) throw error;

      const stats = data[0];
      
      // Log warnings for performance issues
      if (stats.active_queries > 10) {
        console.warn(`⚠️  High query load: ${stats.active_queries} active queries`);
      }
      
      if (stats.longest_query_seconds > 300) { // 5 minutes
        console.warn(`⚠️  Long-running query detected: ${Math.round(stats.longest_query_seconds)}s`);
      }

      return stats;
      
    } catch (error) {
      console.warn('Could not get performance stats:', error.message);
      return null;
    }
  }
}

module.exports = PerformanceOptimizer;