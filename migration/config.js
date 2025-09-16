const fs = require('fs');
const path = require('path');

/**
 * Secure configuration management for Supabase migrations using MCP
 */
class MigrationConfig {
  constructor(mcpFunctions) {
    this.mcp = mcpFunctions;
    this.validateEnvironment();
    this.config = this.loadConfig();
  }

  validateEnvironment() {
    // With MCP, we don't need explicit environment variables
    // The MCP connection is handled externally
    console.log('✅ Using Supabase MCP connection');
  }

  loadConfig() {
    const defaultConfig = {
      // Batch processing settings
      batchSize: 500,
      maxRetries: 3,
      retryDelay: 1000,
      
      // Performance settings
      statementTimeout: 600000, // 10 minutes
      maxConnections: 10,
      
      // Migration settings
      enableBackup: true,
      enableProgressTracking: true,
      enableTransactions: true,
      
      // Data paths
      dataDirectory: path.join(__dirname, '..', 'data'),
      backupDirectory: path.join(__dirname, '..', 'backups'),
      
      // Schema settings
      disableTriggersOnImport: true,
      rebuildIndexesAfterImport: true,
    };

    // Load custom config if exists
    const configPath = path.join(__dirname, 'migration.config.json');
    if (fs.existsSync(configPath)) {
      try {
        const customConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return { ...defaultConfig, ...customConfig };
      } catch (error) {
        console.warn('⚠️  Failed to load custom config, using defaults:', error.message);
      }
    }

    return defaultConfig;
  }

  async testConnection() {
    try {
      await this.mcp.list_tables({ schemas: ['public'] });
      console.log('✅ Database connection successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  async setStatementTimeout() {
    try {
      await this.mcp.execute_sql({
        query: `SET statement_timeout = '${this.config.statementTimeout}ms';`
      });
      console.log(`✅ Statement timeout set to ${this.config.statementTimeout}ms`);
    } catch (error) {
      console.warn('⚠️  Could not set statement timeout:', error.message);
    }
  }

  getMcp() {
    return this.mcp;
  }

  getConfig() {
    return this.config;
  }

  getDataPath(filename) {
    return path.join(this.config.dataDirectory, filename);
  }

  getBackupPath(filename) {
    if (!fs.existsSync(this.config.backupDirectory)) {
      fs.mkdirSync(this.config.backupDirectory, { recursive: true });
    }
    return path.join(this.config.backupDirectory, filename);
  }
}

module.exports = MigrationConfig;