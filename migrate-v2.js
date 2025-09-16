#!/usr/bin/env node

/**
 * Production-Ready Supabase Migration CLI
 * 
 * This is the main entry point for the new migration system.
 * Run with: node migrate-v2.js [options]
 */

const MigrationRunner = require('./migration/migration-runner');
const { VersionManager } = require('./migration/progress-tracker');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    version: null,
    forceRestart: false,
    autoResume: false,
    rollbackOnFailure: true,
    migrationId: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--version':
      case '-v':
        options.version = args[++i];
        break;
      case '--force-restart':
        options.forceRestart = true;
        break;
      case '--auto-resume':
        options.autoResume = true;
        break;
      case '--no-rollback':
        options.rollbackOnFailure = false;
        break;
      case '--migration-id':
        options.migrationId = args[++i];
        break;
      case '--list-versions':
        return { command: 'list-versions' };
      case '--help':
      case '-h':
        return { command: 'help' };
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return { command: 'migrate', options };
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
🚀 Supabase Migration Runner v2.0

USAGE:
  node migrate-v2.js [OPTIONS]

OPTIONS:
  -v, --version <version>     Specify migration version (default: latest)
  --force-restart            Force restart even if resumable migration exists
  --auto-resume             Automatically resume interrupted migrations
  --no-rollback             Don't rollback on failure
  --migration-id <id>       Custom migration ID
  --list-versions           List available migration versions
  -h, --help                Show this help message

EXAMPLES:
  node migrate-v2.js                           # Run latest version
  node migrate-v2.js --version 1.0.0          # Run specific version
  node migrate-v2.js --auto-resume            # Auto-resume if interrupted
  node migrate-v2.js --force-restart          # Force fresh start
  node migrate-v2.js --list-versions          # Show available versions

ENVIRONMENT VARIABLES:
  SUPABASE_URL                 Your Supabase project URL (required)
  SUPABASE_SERVICE_ROLE_KEY    Your Supabase service role key (required)

SETUP:
  1. Copy .env.example to .env
  2. Fill in your Supabase credentials
  3. Run: source .env (or load environment variables)
  4. Execute: node migrate-v2.js

FEATURES:
  ✅ Batch processing with retry logic
  ✅ Progress tracking and resumable migrations  
  ✅ Automatic backup and rollback
  ✅ Performance optimization
  ✅ Comprehensive error handling
  ✅ Data validation and transformation
  ✅ Version management
  `);
}

/**
 * List available migration versions
 */
function listVersions() {
  console.log('📋 Available Migration Versions:\n');
  const versionManager = new VersionManager();
  versionManager.listVersions();
}

/**
 * Main execution function
 */
async function main() {
  const { command, options } = parseArgs();

  console.log('🚀 Supabase Migration Runner v2.0');
  console.log('   Production-ready migration system with comprehensive features\n');

  try {
    switch (command) {
      case 'help':
        showHelp();
        break;

      case 'list-versions':
        listVersions();
        break;

      case 'migrate':
        const runner = new MigrationRunner(options);
        const report = await runner.run(options);
        
        console.log('\n📊 Migration Summary:');
        console.log(`   Status: ${report.status}`);
        console.log(`   Total Steps: ${report.summary.totalSteps}`);
        console.log(`   Completed: ${report.summary.completedSteps}`);
        console.log(`   Records Processed: ${report.summary.processedRecords}`);
        console.log(`   Errors: ${report.summary.errors}`);
        
        if (report.status === 'completed') {
          console.log('\n🎉 Migration completed successfully!');
          process.exit(0);
        } else {
          console.log('\n❌ Migration failed. Check logs for details.');
          process.exit(1);
        }
        break;

      default:
        console.error('Unknown command. Use --help for usage information.');
        process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    
    if (process.env.DEBUG) {
      console.error('\nStack trace:', error.stack);
    }
    
    console.log('\n🔍 Troubleshooting:');
    console.log('   1. Check your environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    console.log('   2. Verify your data files exist in the data/ directory');
    console.log('   3. Check your network connection to Supabase');
    console.log('   4. Review the error logs in backups/logs/');
    console.log('   5. Try resuming with --auto-resume if the migration was interrupted');
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Migration interrupted. You can resume later with --auto-resume');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Migration terminated. You can resume later with --auto-resume');
  process.exit(143);
});

// Run the CLI
if (require.main === module) {
  main();
}

module.exports = { main, parseArgs };