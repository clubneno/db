const fs = require('fs');
const path = require('path');

const MigrationConfig = require('./config');
const { validateProduct, validateCategory, validateGoal, validateFlavor, validateBatch } = require('./validators');
const BatchProcessor = require('./batch-processor');
const { RetryHandler, ErrorLogger, setupGlobalErrorHandling } = require('./error-handler');
const { ProgressTracker, VersionManager } = require('./progress-tracker');
const BackupManager = require('./backup-manager');
const PerformanceOptimizer = require('./performance-optimizer');

/**
 * Comprehensive migration runner that orchestrates the entire process
 */
class MigrationRunner {
  constructor(options = {}) {
    this.config = new MigrationConfig();
    this.supabase = this.config.getSupabase();
    this.batchProcessor = new BatchProcessor(this.supabase, this.config.getConfig());
    this.retryHandler = new RetryHandler(this.config.getConfig());
    this.errorLogger = new ErrorLogger(this.config.getConfig());
    this.progressTracker = new ProgressTracker(this.config.getConfig());
    this.versionManager = new VersionManager();
    this.backupManager = new BackupManager(this.supabase, this.config.getConfig());
    this.performanceOptimizer = new PerformanceOptimizer(this.supabase, this.config.getConfig());
    
    this.migrationId = options.migrationId || `migration-${Date.now()}`;
    this.version = options.version || this.versionManager.getLatestVersion().version;
    
    // Setup global error handling
    setupGlobalErrorHandling(this.errorLogger);
  }

  /**
   * Main migration entry point
   */
  async run(options = {}) {
    console.log('🚀 Starting Supabase Migration Runner');
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
    
    // Test database connection
    const connectionOk = await this.config.testConnection();
    if (!connectionOk) {
      throw new Error('Database connection failed');
    }

    // Check available disk space
    await this.checkDiskSpace();
    
    // Verify required files exist
    await this.verifyDataFiles();
    
    // Monitor current performance
    await this.performanceOptimizer.monitorConnections();
    
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
   * Migrate categories step
   */
  async migrateCategoriesStep() {
    const categoriesPath = this.config.getDataPath('categories.json');
    if (!fs.existsSync(categoriesPath)) {
      console.log('⏭️  Skipping categories (file not found)');
      return;
    }

    const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
    const validation = validateBatch(categories, validateCategory, 'category');
    
    this.progressTracker.startStep('migrate_categories', validation.valid.length);
    
    const results = await this.batchProcessor.processBatches(
      validation.valid,
      'categories',
      {
        onConflict: 'name',
        onProgress: (progress) => {
          this.progressTracker.updateStepProgress('migrate_categories', progress.successful, progress.failed);
        }
      }
    );

    console.log(`✅ Categories migrated: ${results.successful} successful, ${results.failed} failed`);
  }

  /**
   * Migrate goals step
   */
  async migrateGoalsStep() {
    const goalsPath = this.config.getDataPath('goals.json');
    if (!fs.existsSync(goalsPath)) {
      console.log('⏭️  Skipping goals (file not found)');
      return;
    }

    const goals = JSON.parse(fs.readFileSync(goalsPath, 'utf8'));
    const validation = validateBatch(goals, validateGoal, 'goal');
    
    this.progressTracker.startStep('migrate_goals', validation.valid.length);
    
    const results = await this.batchProcessor.processBatches(
      validation.valid,
      'goals',
      {
        onConflict: 'name',
        onProgress: (progress) => {
          this.progressTracker.updateStepProgress('migrate_goals', progress.successful, progress.failed);
        }
      }
    );

    console.log(`✅ Goals migrated: ${results.successful} successful, ${results.failed} failed`);
  }

  /**
   * Migrate flavors step
   */
  async migrateFlavorsStep() {
    const flavorsPath = this.config.getDataPath('flavors.json');
    if (!fs.existsSync(flavorsPath)) {
      console.log('⏭️  Skipping flavors (file not found)');
      return;
    }

    const flavors = JSON.parse(fs.readFileSync(flavorsPath, 'utf8'));
    const validation = validateBatch(flavors, validateFlavor, 'flavor');
    
    this.progressTracker.startStep('migrate_flavors', validation.valid.length);
    
    const results = await this.batchProcessor.processBatches(
      validation.valid,
      'flavors',
      {
        onConflict: 'name',
        onProgress: (progress) => {
          this.progressTracker.updateStepProgress('migrate_flavors', progress.successful, progress.failed);
        }
      }
    );

    console.log(`✅ Flavors migrated: ${results.successful} successful, ${results.failed} failed`);
  }

  /**
   * Migrate products step
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
  }

  /**
   * Restore database step
   */
  async restoreDatabaseStep() {
    this.progressTracker.startStep('restore_db', 0);
    
    const tables = ['products', 'categories', 'goals', 'flavors'];
    
    // Re-enable triggers
    await this.performanceOptimizer.enableTriggers(tables);
    
    // Run maintenance
    await this.performanceOptimizer.maintainTables(tables);
    
    // Restore original settings
    await this.performanceOptimizer.restoreOriginalSettings();
    
    // Stop performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor();
    }

    console.log('🔧 Database restored to normal operation');
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
   * Check available disk space
   */
  async checkDiskSpace() {
    // This is a simplified check - in production you might want to use a library like 'statvfs'
    console.log('💽 Checking disk space... (simplified check)');
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

module.exports = MigrationRunner;