#!/usr/bin/env node

/**
 * MCP-powered Supabase Migration CLI
 * 
 * This version uses the Supabase MCP for direct database operations
 * and provides the most robust migration capabilities.
 */

const fs = require('fs');
const path = require('path');

// MCP components (these need to be passed in from the MCP environment)
const MigrationConfig = require('./migration/config');
const { validateProduct, validateCategory, validateGoal, validateFlavor, validateBatch } = require('./migration/validators');
const BatchProcessor = require('./migration/batch-processor');
const { RetryHandler, ErrorLogger, setupGlobalErrorHandling } = require('./migration/error-handler');
const { ProgressTracker, VersionManager } = require('./migration/progress-tracker');
const BackupManager = require('./migration/backup-manager');
const PerformanceOptimizer = require('./migration/performance-optimizer');

/**
 * MCP-powered Migration Runner
 */
class McpMigrationRunner {
  constructor(mcpFunctions, options = {}) {
    // Initialize with MCP functions
    this.mcp = {
      list_tables: mcpFunctions.list_tables,
      execute_sql: mcpFunctions.execute_sql,
      apply_migration: mcpFunctions.apply_migration,
      get_logs: mcpFunctions.get_logs,
      get_advisors: mcpFunctions.get_advisors
    };
    
    this.config = new MigrationConfig(this.mcp);
    this.batchProcessor = new BatchProcessor(this.mcp, this.config.getConfig());
    this.retryHandler = new RetryHandler(this.config.getConfig());
    this.errorLogger = new ErrorLogger(this.config.getConfig());
    this.progressTracker = new ProgressTracker(this.config.getConfig());
    this.versionManager = new VersionManager();
    this.backupManager = new BackupManager(this.mcp, this.config.getConfig());
    this.performanceOptimizer = new PerformanceOptimizer(this.mcp, this.config.getConfig());
    
    this.migrationId = options.migrationId || `mcp-migration-${Date.now()}`;
    this.version = options.version || this.versionManager.getLatestVersion().version;
    
    // Setup global error handling
    setupGlobalErrorHandling(this.errorLogger);
  }

  /**
   * Main migration entry point
   */
  async run(options = {}) {
    console.log('🚀 Starting MCP-powered Supabase Migration Runner');
    console.log(`   Migration ID: ${this.migrationId}`);
    console.log(`   Version: ${this.version}`);
    
    const startTime = Date.now();
    
    try {
      // Pre-flight checks
      await this.preFlightChecks();
      
      // Load and validate version
      const versionInfo = this.versionManager.validateVersion(this.version, this.config.getConfig().dataDirectory);
      
      // Check for resumable migration
      if (this.progressTracker.isResumable() && !options.forceRestart) {
        const resumeInfo = this.progressTracker.getResumeInfo();
        console.log(`🔄 Found resumable migration: ${resumeInfo.migrationId}`);
        console.log(`   Current step: ${resumeInfo.currentStep}`);
        console.log(`   Processed: ${resumeInfo.processedCount} records`);
        
        const shouldResume = options.autoResume || await this.promptResume();
        if (shouldResume) {
          return await this.resumeMigration(resumeInfo);
        }
      }

      // Start fresh migration
      this.progressTracker.startMigration(this.migrationId, this.version, 
        versionInfo.steps.map(step => ({ name: step }))
      );

      // Create backup if enabled
      if (this.config.getConfig().enableBackup) {
        await this.createBackup();
      }

      // Run migration steps
      await this.executeMigrationSteps(versionInfo.steps);

      // Complete migration
      const report = this.progressTracker.completeMigration('completed');
      const duration = Date.now() - startTime;
      
      console.log('🎉 Migration completed successfully!');
      console.log(`   Duration: ${Math.round(duration / 1000)}s`);
      console.log(`   Report: ${JSON.stringify(report.summary, null, 2)}`);
      
      // Get advisory notices
      await this.checkAdvisoryNotices();
      
      return report;
      
    } catch (error) {
      console.error('💥 Migration failed:', error.message);
      this.errorLogger.logError(error, { 
        operation: 'migration',
        migrationId: this.migrationId,
        version: this.version
      });
      
      this.progressTracker.completeMigration('failed');
      
      if (options.rollbackOnFailure !== false) {
        await this.handleFailure(error);
      }
      
      throw error;
    } finally {
      // Cleanup and restore settings
      await this.cleanup();
    }
  }

  /**
   * Pre-flight checks before migration
   */
  async preFlightChecks() {
    console.log('🔍 Running pre-flight checks...');
    
    // Test database connection using MCP
    const connectionOk = await this.config.testConnection();
    if (!connectionOk) {
      throw new Error('Database connection failed');
    }

    // List available tables
    const tables = await this.mcp.list_tables({ schemas: ['public'] });
    console.log(`   Found ${tables.length} tables in public schema`);
    
    // Check for required tables
    const requiredTables = ['products', 'categories', 'goals', 'flavors'];
    const existingTables = tables.map(t => t.name);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      console.warn(`⚠️  Missing tables: ${missingTables.join(', ')}`);
      console.log('   Will attempt to create tables during migration');
    }
    
    // Verify required files exist
    await this.verifyDataFiles();
    
    console.log('✅ Pre-flight checks completed');
  }

  /**
   * Execute migration steps in sequence
   */
  async executeMigrationSteps(steps) {
    for (const stepName of steps) {
      console.log(`\n📋 Executing step: ${stepName}`);
      
      try {
        await this.executeStep(stepName);
        this.progressTracker.completeStep(stepName);
        
      } catch (error) {
        this.progressTracker.failStep(stepName, error);
        throw error;
      }
    }
  }

  /**
   * Execute individual migration step
   */
  async executeStep(stepName) {
    switch (stepName) {
      case 'validate_data':
        return await this.validateDataStep();
      case 'optimize_db':
        return await this.optimizeDatabaseStep();
      case 'migrate_categories':
        return await this.migrateCategoriesStep();
      case 'migrate_goals':
        return await this.migrateGoalsStep();
      case 'migrate_flavors':
        return await this.migrateFlavorsStep();
      case 'migrate_products':
        return await this.migrateProductsStep();
      case 'restore_db':
        return await this.restoreDatabaseStep();
      default:
        throw new Error(`Unknown migration step: ${stepName}`);
    }
  }

  /**
   * Validate data step
   */
  async validateDataStep() {
    this.progressTracker.startStep('validate_data', 0);
    
    console.log('🔍 Validating source data...');
    
    const dataPath = this.config.getDataPath('latest.json');
    if (!fs.existsSync(dataPath)) {
      throw new Error(`Products data file not found: ${dataPath}`);
    }

    const products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const validation = validateBatch(products, validateProduct, 'product');
    
    if (validation.invalid.length > 0) {
      const errorRate = validation.invalid.length / products.length;
      if (errorRate > 0.1) { // More than 10% invalid
        throw new Error(`Too many invalid products: ${validation.invalid.length}/${products.length} (${Math.round(errorRate * 100)}%)`);
      }
    }

    this.validatedData = {
      products: validation.valid,
      invalidProducts: validation.invalid
    };

    console.log(`✅ Data validation completed: ${validation.valid.length} valid, ${validation.invalid.length} invalid`);
  }

  /**
   * Optimize database step
   */
  async optimizeDatabaseStep() {
    this.progressTracker.startStep('optimize_db', 0);
    
    const tables = ['products', 'categories', 'goals', 'flavors'];
    
    // Apply performance optimizations
    await this.performanceOptimizer.optimizeForBulkOperations();
    
    // Disable triggers
    await this.performanceOptimizer.disableTriggers(tables);
    
    // Start performance monitoring
    this.performanceMonitor = await this.performanceOptimizer.monitorPerformance(
      (stats) => this.errorLogger.logProgress('performance', stats),
      30000
    );

    console.log('⚡ Database optimized for bulk operations');
  }

  /**
   * Migrate products using MCP
   */
  async migrateProductsStep() {
    if (!this.validatedData || !this.validatedData.products) {
      throw new Error('No validated product data available');
    }

    this.progressTracker.startStep('migrate_products', this.validatedData.products.length);
    
    const results = await this.batchProcessor.processBatches(
      this.validatedData.products,
      'products',
      {
        onConflict: 'handle',
        onProgress: (progress) => {
          this.progressTracker.updateStepProgress('migrate_products', progress.successful, progress.failed);
        }
      }
    );

    console.log(`✅ Products migrated: ${results.successful} successful, ${results.failed} failed`);
    
    // Use MCP to apply any schema migrations if needed
    if (results.failed > 0) {
      console.log('🔧 Applying schema fixes for failed records...');
      await this.applySchemaFixes();
    }
  }

  /**
   * Apply schema fixes using MCP apply_migration
   */
  async applySchemaFixes() {
    try {
      await this.mcp.apply_migration({
        name: 'fix_product_schema',
        query: `
          -- Add any missing columns
          ALTER TABLE products 
          ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMP DEFAULT NOW();
          
          -- Update any NULL handles
          UPDATE products 
          SET handle = LOWER(REPLACE(title, ' ', '-'))
          WHERE handle IS NULL;
        `
      });
      
      console.log('✅ Schema fixes applied successfully');
    } catch (error) {
      console.warn('⚠️  Schema fixes failed:', error.message);
    }
  }

  /**
   * Check advisory notices after migration
   */
  async checkAdvisoryNotices() {
    console.log('🔍 Checking for advisory notices...');
    
    try {
      // Check for security advisors
      const securityAdvisors = await this.mcp.get_advisors({ type: 'security' });
      if (securityAdvisors && securityAdvisors.length > 0) {
        console.log(`⚠️  Found ${securityAdvisors.length} security advisors:`);
        securityAdvisors.slice(0, 3).forEach(advisor => {
          console.log(`   - ${advisor.title}`);
        });
      }
      
      // Check for performance advisors
      const performanceAdvisors = await this.mcp.get_advisors({ type: 'performance' });
      if (performanceAdvisors && performanceAdvisors.length > 0) {
        console.log(`📈 Found ${performanceAdvisors.length} performance advisors:`);
        performanceAdvisors.slice(0, 3).forEach(advisor => {
          console.log(`   - ${advisor.title}`);
        });
      }
      
    } catch (error) {
      console.warn('⚠️  Could not fetch advisory notices:', error.message);
    }
  }

  /**
   * Create backup before migration
   */
  async createBackup() {
    console.log('💾 Creating pre-migration backup...');
    
    const backup = await this.backupManager.createBackup(
      ['products', 'categories', 'goals', 'flavors'],
      this.migrationId
    );
    
    this.backupInfo = backup;
    console.log(`✅ Backup created: ${backup.backupId}`);
  }

  /**
   * Resume migration from checkpoint
   */
  async resumeMigration(resumeInfo) {
    console.log(`🔄 Resuming migration from step: ${resumeInfo.currentStep}`);
    
    // Load the migration version and steps
    const versionInfo = this.versionManager.validateVersion(this.version, this.config.getConfig().dataDirectory);
    const currentStepIndex = versionInfo.steps.indexOf(resumeInfo.currentStep);
    
    if (currentStepIndex === -1) {
      throw new Error(`Resume step not found in version: ${resumeInfo.currentStep}`);
    }

    // Continue from current step
    const remainingSteps = versionInfo.steps.slice(currentStepIndex);
    await this.executeMigrationSteps(remainingSteps);
    
    return this.progressTracker.completeMigration('completed');
  }

  /**
   * Handle migration failure
   */
  async handleFailure(error) {
    console.log('🚨 Handling migration failure...');
    
    if (this.backupInfo) {
      console.log('🔄 Rolling back to pre-migration backup...');
      try {
        await this.backupManager.restoreFromBackup(this.backupInfo.backupId);
        console.log('✅ Rollback completed');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError.message);
      }
    }

    // Generate error report
    this.errorLogger.generateErrorReport();
  }

  /**
   * Cleanup after migration
   */
  async cleanup() {
    console.log('🧹 Cleaning up...');
    
    // Stop performance monitoring if still running
    if (this.performanceMonitor) {
      this.performanceMonitor();
    }

    // Clean up old backups
    if (this.config.getConfig().enableBackup) {
      await this.backupManager.cleanupBackups(5);
    }
  }

  /**
   * Verify required data files exist
   */
  async verifyDataFiles() {
    const requiredFiles = ['latest.json'];
    const missingFiles = [];

    for (const file of requiredFiles) {
      const filePath = this.config.getDataPath(file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length > 0) {
      throw new Error(`Missing required data files: ${missingFiles.join(', ')}`);
    }
  }

  /**
   * Prompt user for resume decision (in production, this could be automated)
   */
  async promptResume() {
    // In a real CLI application, you would prompt the user here
    // For now, we'll default to resuming
    return true;
  }
}

/**
 * Main execution function that can be called from MCP context
 */
async function runMcpMigration(mcpFunctions, options = {}) {
  try {
    const runner = new McpMigrationRunner(mcpFunctions, options);
    const report = await runner.run(options);
    
    console.log('\n📊 Migration Summary:');
    console.log(`   Status: ${report.status}`);
    console.log(`   Total Steps: ${report.summary.totalSteps}`);
    console.log(`   Completed: ${report.summary.completedSteps}`);
    console.log(`   Records Processed: ${report.summary.processedRecords}`);
    console.log(`   Errors: ${report.summary.errors}`);
    
    return report;
    
  } catch (error) {
    console.error('\n💥 MCP Migration failed:', error.message);
    throw error;
  }
}

// Export for use in MCP context
module.exports = { 
  McpMigrationRunner, 
  runMcpMigration 
};

// CLI interface when run directly (for testing)
if (require.main === module) {
  console.log('🚨 This script requires MCP functions to be provided.');
  console.log('   Use the regular migrate-v2.js for standalone execution.');
  console.log('   This script is designed to be called from an MCP context.');
  process.exit(1);
}