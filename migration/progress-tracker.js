const fs = require('fs');
const path = require('path');

/**
 * Migration versioning and progress tracking
 */

/**
 * Migration state tracker
 */
class ProgressTracker {
  constructor(config) {
    this.config = config;
    this.progressFile = path.join(config.backupDirectory || './backups', 'migration-progress.json');
    this.ensureProgressDirectory();
    this.state = this.loadState();
  }

  ensureProgressDirectory() {
    const dir = path.dirname(this.progressFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadState() {
    if (fs.existsSync(this.progressFile)) {
      try {
        const state = JSON.parse(fs.readFileSync(this.progressFile, 'utf8'));
        console.log(`📋 Loaded existing migration state: ${state.migrationId}`);
        return state;
      } catch (error) {
        console.warn('⚠️  Could not load progress state, starting fresh:', error.message);
      }
    }

    return {
      migrationId: null,
      version: null,
      startTime: null,
      endTime: null,
      status: 'not_started',
      steps: [],
      currentStep: null,
      totalRecords: {},
      processedRecords: {},
      failedRecords: {},
      errors: [],
      checkpoints: []
    };
  }

  saveState() {
    try {
      fs.writeFileSync(this.progressFile, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('❌ Failed to save progress state:', error.message);
    }
  }

  startMigration(migrationId, version, steps) {
    this.state = {
      migrationId,
      version,
      startTime: new Date().toISOString(),
      endTime: null,
      status: 'in_progress',
      steps: steps.map(step => ({ ...step, status: 'pending', startTime: null, endTime: null })),
      currentStep: null,
      totalRecords: {},
      processedRecords: {},
      failedRecords: {},
      errors: [],
      checkpoints: []
    };

    console.log(`🚀 Starting migration ${migrationId} (v${version})`);
    console.log(`📋 Steps: ${steps.map(s => s.name).join(' → ')}`);
    
    this.saveState();
    return this.state;
  }

  startStep(stepName, totalRecords = 0) {
    const step = this.state.steps.find(s => s.name === stepName);
    if (!step) {
      throw new Error(`Step ${stepName} not found in migration plan`);
    }

    step.status = 'in_progress';
    step.startTime = new Date().toISOString();
    this.state.currentStep = stepName;
    this.state.totalRecords[stepName] = totalRecords;
    this.state.processedRecords[stepName] = 0;
    this.state.failedRecords[stepName] = 0;

    console.log(`📦 Starting step: ${stepName} (${totalRecords} records)`);
    this.saveState();
  }

  updateStepProgress(stepName, processed, failed = 0) {
    this.state.processedRecords[stepName] = processed;
    this.state.failedRecords[stepName] = failed;
    
    const total = this.state.totalRecords[stepName] || 0;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
    
    // Only log progress every 10% or every 100 records to avoid spam
    if (percentage % 10 === 0 || processed % 100 === 0 || processed === total) {
      console.log(`⏳ ${stepName}: ${processed}/${total} (${percentage}%) ${failed > 0 ? `[${failed} failed]` : ''}`);
    }
    
    this.saveState();
  }

  completeStep(stepName, summary = {}) {
    const step = this.state.steps.find(s => s.name === stepName);
    if (!step) {
      throw new Error(`Step ${stepName} not found in migration plan`);
    }

    step.status = 'completed';
    step.endTime = new Date().toISOString();
    step.summary = summary;
    this.state.currentStep = null;

    const processed = this.state.processedRecords[stepName] || 0;
    const failed = this.state.failedRecords[stepName] || 0;
    const duration = new Date(step.endTime) - new Date(step.startTime);

    console.log(`✅ Completed step: ${stepName}`);
    console.log(`   Processed: ${processed}, Failed: ${failed}, Duration: ${Math.round(duration / 1000)}s`);

    this.saveState();
  }

  failStep(stepName, error) {
    const step = this.state.steps.find(s => s.name === stepName);
    if (!step) {
      throw new Error(`Step ${stepName} not found in migration plan`);
    }

    step.status = 'failed';
    step.endTime = new Date().toISOString();
    step.error = {
      message: error.message,
      type: error.type || 'UNKNOWN',
      timestamp: new Date().toISOString()
    };

    this.state.errors.push({
      step: stepName,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    console.error(`❌ Step failed: ${stepName} - ${error.message}`);
    this.saveState();
  }

  createCheckpoint(name, data = {}) {
    const checkpoint = {
      name,
      timestamp: new Date().toISOString(),
      data,
      state: JSON.parse(JSON.stringify(this.state)) // Deep copy
    };

    this.state.checkpoints.push(checkpoint);
    console.log(`📍 Checkpoint created: ${name}`);
    this.saveState();
    
    return checkpoint;
  }

  completeMigration(status = 'completed') {
    this.state.status = status;
    this.state.endTime = new Date().toISOString();

    const duration = new Date(this.state.endTime) - new Date(this.state.startTime);
    const totalProcessed = Object.values(this.state.processedRecords).reduce((a, b) => a + b, 0);
    const totalFailed = Object.values(this.state.failedRecords).reduce((a, b) => a + b, 0);

    console.log(`🎉 Migration ${status}: ${this.state.migrationId}`);
    console.log(`   Duration: ${Math.round(duration / 1000)}s`);
    console.log(`   Processed: ${totalProcessed}, Failed: ${totalFailed}`);

    this.saveState();
    return this.generateReport();
  }

  generateReport() {
    const report = {
      migrationId: this.state.migrationId,
      version: this.state.version,
      status: this.state.status,
      duration: new Date(this.state.endTime) - new Date(this.state.startTime),
      summary: {
        totalSteps: this.state.steps.length,
        completedSteps: this.state.steps.filter(s => s.status === 'completed').length,
        failedSteps: this.state.steps.filter(s => s.status === 'failed').length,
        totalRecords: Object.values(this.state.totalRecords).reduce((a, b) => a + b, 0),
        processedRecords: Object.values(this.state.processedRecords).reduce((a, b) => a + b, 0),
        failedRecords: Object.values(this.state.failedRecords).reduce((a, b) => a + b, 0),
        errors: this.state.errors.length
      },
      steps: this.state.steps,
      errors: this.state.errors
    };

    const reportFile = path.join(
      path.dirname(this.progressFile),
      `migration-report-${this.state.migrationId}-${Date.now()}.json`
    );

    try {
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
      console.log(`📊 Migration report saved: ${reportFile}`);
    } catch (error) {
      console.error('❌ Failed to save migration report:', error.message);
    }

    return report;
  }

  isResumable() {
    return this.state.status === 'in_progress' && this.state.currentStep !== null;
  }

  getResumeInfo() {
    if (!this.isResumable()) {
      return null;
    }

    const currentStep = this.state.steps.find(s => s.name === this.state.currentStep);
    const processedCount = this.state.processedRecords[this.state.currentStep] || 0;

    return {
      migrationId: this.state.migrationId,
      currentStep: this.state.currentStep,
      processedCount,
      stepInfo: currentStep
    };
  }

  reset() {
    this.state = {
      migrationId: null,
      version: null,
      startTime: null,
      endTime: null,
      status: 'not_started',
      steps: [],
      currentStep: null,
      totalRecords: {},
      processedRecords: {},
      failedRecords: {},
      errors: [],
      checkpoints: []
    };

    this.saveState();
    console.log('🔄 Migration state reset');
  }
}

/**
 * Migration version manager
 */
class VersionManager {
  constructor() {
    this.versions = [
      {
        version: '1.0.0',
        description: 'Initial migration with basic product data',
        steps: ['validate_data', 'migrate_categories', 'migrate_goals', 'migrate_flavors', 'migrate_products'],
        requiredFiles: ['latest.json']
      },
      {
        version: '1.1.0',
        description: 'Enhanced migration with price separation and better validation',
        steps: ['validate_data', 'optimize_db', 'migrate_categories', 'migrate_goals', 'migrate_flavors', 'migrate_products', 'restore_db'],
        requiredFiles: ['latest.json', 'categories.json', 'goals.json', 'flavors.json']
      }
    ];
  }

  getLatestVersion() {
    return this.versions[this.versions.length - 1];
  }

  getVersion(versionString) {
    return this.versions.find(v => v.version === versionString);
  }

  validateVersion(version, dataDirectory) {
    if (!version) {
      throw new Error('Version is required');
    }

    const versionInfo = this.getVersion(version);
    if (!versionInfo) {
      throw new Error(`Version ${version} not found`);
    }

    // Check required files
    const missingFiles = versionInfo.requiredFiles.filter(file => {
      const filePath = path.join(dataDirectory, file);
      return !fs.existsSync(filePath);
    });

    if (missingFiles.length > 0) {
      throw new Error(`Missing required files for version ${version}: ${missingFiles.join(', ')}`);
    }

    console.log(`✅ Version ${version} validated`);
    return versionInfo;
  }

  listVersions() {
    console.log('📋 Available migration versions:');
    this.versions.forEach(v => {
      console.log(`   v${v.version}: ${v.description}`);
      console.log(`     Steps: ${v.steps.join(' → ')}`);
      console.log(`     Required files: ${v.requiredFiles.join(', ')}`);
      console.log('');
    });
  }
}

module.exports = {
  ProgressTracker,
  VersionManager
};