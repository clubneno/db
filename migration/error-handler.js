const fs = require('fs');
const path = require('path');

/**
 * Comprehensive error handling and retry logic for migrations
 */

/**
 * Custom error types for better error categorization
 */
class MigrationError extends Error {
  constructor(message, type = 'MIGRATION_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

class ValidationError extends MigrationError {
  constructor(message, validationDetails = {}) {
    super(message, 'VALIDATION_ERROR', validationDetails);
  }
}

class DatabaseError extends MigrationError {
  constructor(message, dbDetails = {}) {
    super(message, 'DATABASE_ERROR', dbDetails);
  }
}

class NetworkError extends MigrationError {
  constructor(message, networkDetails = {}) {
    super(message, 'NETWORK_ERROR', networkDetails);
  }
}

/**
 * Error categorization helper
 */
function categorizeError(error) {
  // Supabase/PostgREST specific errors
  if (error.code) {
    switch (error.code) {
      case 'PGRST116':
        return { category: 'SCHEMA_ERROR', retryable: false };
      case 'PGRST204':
        return { category: 'NOT_FOUND', retryable: false };
      case '23505':
        return { category: 'UNIQUE_VIOLATION', retryable: false };
      case '23502':
        return { category: 'NULL_VIOLATION', retryable: false };
      case '23503':
        return { category: 'FOREIGN_KEY_VIOLATION', retryable: false };
      case '42P01':
        return { category: 'UNDEFINED_TABLE', retryable: false };
      case '42703':
        return { category: 'UNDEFINED_COLUMN', retryable: false };
      case '53300':
        return { category: 'TOO_MANY_CONNECTIONS', retryable: true };
      case '57014':
        return { category: 'QUERY_CANCELLED', retryable: true };
      default:
        return { category: 'DATABASE_ERROR', retryable: true };
    }
  }

  // Network related errors
  if (error.message.includes('fetch') || error.message.includes('network') || error.code === 'ENOTFOUND') {
    return { category: 'NETWORK_ERROR', retryable: true };
  }

  // Timeout errors
  if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
    return { category: 'TIMEOUT_ERROR', retryable: true };
  }

  // Rate limiting
  if (error.status === 429 || error.message.includes('rate limit')) {
    return { category: 'RATE_LIMIT', retryable: true };
  }

  // Default categorization
  return { category: 'UNKNOWN_ERROR', retryable: true };
}

/**
 * Retry mechanism with exponential backoff
 */
class RetryHandler {
  constructor(config) {
    this.maxRetries = config.maxRetries || 3;
    this.baseDelay = config.retryDelay || 1000;
    this.maxDelay = config.maxRetryDelay || 30000;
    this.backoffMultiplier = config.backoffMultiplier || 2;
  }

  async execute(operation, context = {}) {
    let lastError = null;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      try {
        const result = await operation(attempt);
        
        if (attempt > 0) {
          console.log(`✅ Operation succeeded on attempt ${attempt + 1}`);
        }
        
        return result;
        
      } catch (error) {
        attempt++;
        lastError = error;
        
        const errorInfo = categorizeError(error);
        
        console.error(`❌ Attempt ${attempt}/${this.maxRetries + 1} failed (${errorInfo.category}):`, error.message);
        
        // Don't retry if error is not retryable
        if (!errorInfo.retryable) {
          console.log(`🚫 Error is not retryable, stopping attempts`);
          break;
        }
        
        // Don't retry if we've exhausted attempts
        if (attempt > this.maxRetries) {
          console.log(`🚫 Max retries (${this.maxRetries}) exceeded`);
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1),
          this.maxDelay
        );
        
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.1 * delay;
        const totalDelay = delay + jitter;
        
        console.log(`⏱️  Waiting ${Math.round(totalDelay)}ms before retry...`);
        await this.sleep(totalDelay);
      }
    }

    // Wrap the final error with more context
    throw new MigrationError(
      `Operation failed after ${attempt} attempts: ${lastError.message}`,
      'RETRY_EXHAUSTED',
      {
        originalError: lastError,
        attempts: attempt,
        context
      }
    );
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Error logging and reporting
 */
class ErrorLogger {
  constructor(config) {
    this.logDirectory = path.join(config.backupDirectory || './backups', 'logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  logError(error, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        type: error.type || 'UNKNOWN',
        stack: error.stack,
        details: error.details || {}
      },
      context,
      categorization: categorizeError(error)
    };

    // Log to console
    console.error(`❌ ${error.type || 'ERROR'}:`, error.message);
    if (context.operation) {
      console.error(`   Operation: ${context.operation}`);
    }
    if (context.batchNumber) {
      console.error(`   Batch: ${context.batchNumber}`);
    }

    // Write to file
    const logFile = path.join(this.logDirectory, `migration-errors-${this.getDateString()}.json`);
    
    try {
      let existingLogs = [];
      if (fs.existsSync(logFile)) {
        existingLogs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      }
      
      existingLogs.push(logEntry);
      fs.writeFileSync(logFile, JSON.stringify(existingLogs, null, 2));
      
    } catch (writeError) {
      console.error('Failed to write error log:', writeError.message);
    }

    return logEntry;
  }

  logProgress(operation, progress) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      progress
    };

    const logFile = path.join(this.logDirectory, `migration-progress-${this.getDateString()}.json`);
    
    try {
      let existingLogs = [];
      if (fs.existsSync(logFile)) {
        existingLogs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      }
      
      existingLogs.push(logEntry);
      fs.writeFileSync(logFile, JSON.stringify(existingLogs, null, 2));
      
    } catch (writeError) {
      console.error('Failed to write progress log:', writeError.message);
    }
  }

  generateErrorReport() {
    const reportFile = path.join(this.logDirectory, `error-report-${this.getDateString()}.md`);
    const errorFile = path.join(this.logDirectory, `migration-errors-${this.getDateString()}.json`);
    
    if (!fs.existsSync(errorFile)) {
      console.log('No errors to report');
      return null;
    }

    try {
      const errors = JSON.parse(fs.readFileSync(errorFile, 'utf8'));
      
      let report = '# Migration Error Report\\n\\n';
      report += `**Generated:** ${new Date().toISOString()}\\n`;
      report += `**Total Errors:** ${errors.length}\\n\\n`;

      // Group errors by type
      const errorGroups = {};
      errors.forEach(error => {
        const type = error.error.type || 'UNKNOWN';
        if (!errorGroups[type]) {
          errorGroups[type] = [];
        }
        errorGroups[type].push(error);
      });

      Object.keys(errorGroups).forEach(type => {
        report += `## ${type} (${errorGroups[type].length} errors)\\n\\n`;
        
        errorGroups[type].slice(0, 5).forEach(error => {
          report += `**${error.timestamp}**\\n`;
          report += `- Message: ${error.error.message}\\n`;
          report += `- Context: ${JSON.stringify(error.context)}\\n\\n`;
        });

        if (errorGroups[type].length > 5) {
          report += `... and ${errorGroups[type].length - 5} more errors of this type\\n\\n`;
        }
      });

      fs.writeFileSync(reportFile, report);
      console.log(`📊 Error report generated: ${reportFile}`);
      
      return reportFile;
      
    } catch (error) {
      console.error('Failed to generate error report:', error.message);
      return null;
    }
  }

  getDateString() {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Global error handler for uncaught exceptions
 */
function setupGlobalErrorHandling(errorLogger) {
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    errorLogger.logError(error, { type: 'UNCAUGHT_EXCEPTION' });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    errorLogger.logError(new Error(reason), { type: 'UNHANDLED_REJECTION', promise });
  });
}

module.exports = {
  MigrationError,
  ValidationError,
  DatabaseError,
  NetworkError,
  RetryHandler,
  ErrorLogger,
  categorizeError,
  setupGlobalErrorHandling
};