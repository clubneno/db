const fs = require('fs');
const path = require('path');

/**
 * Backup and rollback mechanisms for safe migrations
 */

/**
 * Backup manager for data safety using Supabase MCP
 */
class BackupManager {
  constructor(mcp, config) {
    this.mcp = mcp;
    this.config = config;
    this.backupDirectory = config.backupDirectory || './backups';
    this.ensureBackupDirectory();
  }

  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDirectory)) {
      fs.mkdirSync(this.backupDirectory, { recursive: true });
    }
  }

  /**
   * Create a full backup of specified tables before migration
   */
  async createBackup(tables = ['products', 'categories', 'goals', 'flavors'], migrationId = null) {
    const backupId = migrationId || `backup-${Date.now()}`;
    const backupPath = path.join(this.backupDirectory, backupId);
    
    console.log(`💾 Creating backup: ${backupId}`);
    
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    const backupInfo = {
      backupId,
      timestamp: new Date().toISOString(),
      tables: [],
      status: 'in_progress'
    };

    try {
      for (const tableName of tables) {
        console.log(`📦 Backing up table: ${tableName}`);
        const tableBackup = await this.backupTable(tableName, backupPath);
        backupInfo.tables.push(tableBackup);
      }

      backupInfo.status = 'completed';
      backupInfo.endTime = new Date().toISOString();

      // Save backup metadata
      const metadataFile = path.join(backupPath, 'backup-info.json');
      fs.writeFileSync(metadataFile, JSON.stringify(backupInfo, null, 2));

      console.log(`✅ Backup completed: ${backupId}`);
      console.log(`   Location: ${backupPath}`);
      console.log(`   Tables: ${tables.join(', ')}`);

      return backupInfo;

    } catch (error) {
      backupInfo.status = 'failed';
      backupInfo.error = error.message;
      backupInfo.endTime = new Date().toISOString();

      console.error(`❌ Backup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Backup a single table using MCP
   */
  async backupTable(tableName, backupPath) {
    const startTime = new Date();
    
    try {
      // Get table count first using MCP execute_sql
      const countResult = await this.mcp.execute_sql({
        query: `SELECT COUNT(*) as count FROM ${tableName}`
      });
      
      const count = countResult[0]?.count || 0;
      console.log(`   ${tableName}: ${count} records`);

      if (count === 0) {
        return {
          tableName,
          recordCount: 0,
          fileName: null,
          duration: 0,
          status: 'empty'
        };
      }

      // Fetch all data in batches to avoid memory issues
      const batchSize = 1000;
      const allData = [];
      let offset = 0;

      while (offset < count) {
        const result = await this.mcp.execute_sql({
          query: `SELECT * FROM ${tableName} ORDER BY id LIMIT ${batchSize} OFFSET ${offset}`
        });

        if (result && result.length > 0) {
          allData.push(...result);
          offset += batchSize;
          
          // Log progress for large tables
          if (allData.length % 5000 === 0) {
            console.log(`     Progress: ${allData.length}/${count}`);
          }
        } else {
          break;
        }
      }

      // Save to file
      const fileName = `${tableName}-${Date.now()}.json`;
      const filePath = path.join(backupPath, fileName);
      fs.writeFileSync(filePath, JSON.stringify(allData, null, 2));

      const duration = new Date() - startTime;

      return {
        tableName,
        recordCount: allData.length,
        fileName,
        filePath,
        duration,
        status: 'completed'
      };
      
    } catch (error) {
      throw new Error(`Failed to backup ${tableName}: ${error.message}`);
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId, tables = null, options = {}) {
    const backupPath = path.join(this.backupDirectory, backupId);
    const metadataFile = path.join(backupPath, 'backup-info.json');

    console.log(`🔄 Restoring from backup: ${backupId}`);

    if (!fs.existsSync(backupPath) || !fs.existsSync(metadataFile)) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    const backupInfo = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    const tablesToRestore = tables || backupInfo.tables.map(t => t.tableName);

    console.log(`📋 Restoring tables: ${tablesToRestore.join(', ')}`);

    const restoreResults = [];

    for (const tableName of tablesToRestore) {
      try {
        console.log(`🔄 Restoring table: ${tableName}`);
        const result = await this.restoreTable(tableName, backupPath, options);
        restoreResults.push(result);
      } catch (error) {
        console.error(`❌ Failed to restore ${tableName}: ${error.message}`);
        restoreResults.push({
          tableName,
          status: 'failed',
          error: error.message
        });

        if (!options.continueOnError) {
          throw error;
        }
      }
    }

    console.log(`✅ Restore completed`);
    return {
      backupId,
      restoredTables: restoreResults,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Restore a single table using MCP
   */
  async restoreTable(tableName, backupPath, options = {}) {
    const tableBackups = fs.readdirSync(backupPath)
      .filter(file => file.startsWith(tableName) && file.endsWith('.json'))
      .sort()
      .reverse(); // Get most recent

    if (tableBackups.length === 0) {
      throw new Error(`No backup found for table: ${tableName}`);
    }

    const backupFile = path.join(backupPath, tableBackups[0]);
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

    console.log(`   Restoring ${backupData.length} records`);

    // Clear existing data if requested
    if (options.clearExisting !== false) {
      console.log(`   Clearing existing data from ${tableName}`);
      
      try {
        await this.mcp.execute_sql({
          query: `DELETE FROM ${tableName}`
        });
      } catch (error) {
        throw new Error(`Failed to clear ${tableName}: ${error.message}`);
      }
    }

    // Restore data in batches
    const batchSize = 500;
    const chunks = this.chunkArray(backupData, batchSize);
    let restored = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      if (chunk.length > 0) {
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

        const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${values}`;
        
        try {
          await this.mcp.execute_sql({ query: sql });
          restored += chunk.length;
          console.log(`   Progress: ${restored}/${backupData.length}`);
        } catch (error) {
          throw new Error(`Failed to restore batch ${i + 1}: ${error.message}`);
        }
      }
    }

    return {
      tableName,
      recordCount: restored,
      status: 'completed'
    };
  }

  /**
   * List available backups
   */
  listBackups() {
    const backups = [];
    
    if (!fs.existsSync(this.backupDirectory)) {
      return backups;
    }

    const entries = fs.readdirSync(this.backupDirectory);
    
    for (const entry of entries) {
      const entryPath = path.join(this.backupDirectory, entry);
      const metadataFile = path.join(entryPath, 'backup-info.json');
      
      if (fs.statSync(entryPath).isDirectory() && fs.existsSync(metadataFile)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
          backups.push(metadata);
        } catch (error) {
          console.warn(`⚠️  Could not read backup metadata for ${entry}`);
        }
      }
    }

    // Sort by timestamp, newest first
    backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return backups;
  }

  /**
   * Delete old backups to save space
   */
  async cleanupBackups(keepCount = 5) {
    const backups = this.listBackups();
    
    if (backups.length <= keepCount) {
      console.log(`📦 No cleanup needed (${backups.length}/${keepCount} backups)`);
      return;
    }

    const toDelete = backups.slice(keepCount);
    
    console.log(`🗑️  Cleaning up ${toDelete.length} old backups`);

    for (const backup of toDelete) {
      try {
        const backupPath = path.join(this.backupDirectory, backup.backupId);
        await this.deleteDirectory(backupPath);
        console.log(`   Deleted: ${backup.backupId} (${backup.timestamp})`);
      } catch (error) {
        console.warn(`⚠️  Could not delete backup ${backup.backupId}: ${error.message}`);
      }
    }
  }

  /**
   * Create a quick data snapshot for rollback
   */
  async createSnapshot(tables, snapshotName = null) {
    const snapshot = {
      name: snapshotName || `snapshot-${Date.now()}`,
      timestamp: new Date().toISOString(),
      tables: {}
    };

    console.log(`📸 Creating snapshot: ${snapshot.name}`);

    for (const tableName of tables) {
      const { count } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      snapshot.tables[tableName] = { count: count || 0 };
      console.log(`   ${tableName}: ${count || 0} records`);
    }

    const snapshotFile = path.join(this.backupDirectory, `${snapshot.name}.snapshot.json`);
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));

    console.log(`✅ Snapshot created: ${snapshot.name}`);
    return snapshot;
  }

  /**
   * Utility: Split array into chunks
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Utility: Recursively delete directory
   */
  async deleteDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        if (fs.statSync(filePath).isDirectory()) {
          await this.deleteDirectory(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      }
      
      fs.rmdirSync(dirPath);
    }
  }
}

module.exports = BackupManager;