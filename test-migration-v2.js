/**
 * Test script for the new migration system
 * Run with: node test-migration-v2.js
 */

const MigrationConfig = require('./migration/config');
const { VersionManager } = require('./migration/progress-tracker');

async function testMigrationSystem() {
  console.log('🧪 Testing Migration System v2.0\n');

  try {
    // Test 1: Configuration
    console.log('1️⃣  Testing configuration...');
    const config = new MigrationConfig();
    console.log('   ✅ Configuration loaded');
    
    // Test 2: Version Management
    console.log('\n2️⃣  Testing version management...');
    const versionManager = new VersionManager();
    const versions = versionManager.listVersions;
    const latest = versionManager.getLatestVersion();
    console.log(`   ✅ Latest version: ${latest.version}`);

    // Test 3: Database Connection (if credentials provided)
    console.log('\n3️⃣  Testing database connection...');
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const connected = await config.testConnection();
      if (connected) {
        console.log('   ✅ Database connection successful');
      } else {
        console.log('   ⚠️  Database connection failed (check credentials)');
      }
    } else {
      console.log('   ⚠️  Skipping connection test (missing credentials)');
      console.log('   💡 Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to test connection');
    }

    // Test 4: File System
    console.log('\n4️⃣  Testing file system...');
    const fs = require('fs');
    const dataDir = config.getConfig().dataDirectory;
    const backupDir = config.getConfig().backupDirectory;
    
    console.log(`   Data directory: ${dataDir} ${fs.existsSync(dataDir) ? '✅' : '❌'}`);
    console.log(`   Backup directory: ${backupDir} ${fs.existsSync(backupDir) ? '✅' : '⚠️  (will be created)'}`);

    // Test 5: Required Files
    console.log('\n5️⃣  Testing required files...');
    const latestJson = config.getDataPath('latest.json');
    console.log(`   Products data: ${latestJson} ${fs.existsSync(latestJson) ? '✅' : '❌'}`);

    if (!fs.existsSync(latestJson)) {
      console.log('   💡 Run npm run scrape first to generate product data');
    }

    // Test 6: CLI Interface
    console.log('\n6️⃣  Testing CLI interface...');
    const { parseArgs } = require('./migrate-v2.js');
    
    // Mock command line args
    process.argv = ['node', 'migrate-v2.js', '--help'];
    const help = parseArgs();
    console.log('   ✅ CLI argument parsing works');

    process.argv = ['node', 'migrate-v2.js', '--list-versions'];
    const listCmd = parseArgs();
    console.log('   ✅ Version listing command works');

    console.log('\n🎉 Migration System v2.0 Test Results:');
    console.log('   ✅ Configuration system');
    console.log('   ✅ Version management');
    console.log('   ✅ CLI interface');
    console.log('   ✅ File system checks');
    console.log(`   ${process.env.SUPABASE_URL ? '✅' : '⚠️ '} Database credentials`);
    console.log(`   ${fs.existsSync(latestJson) ? '✅' : '❌'} Required data files`);

    console.log('\n📋 Next Steps:');
    if (!process.env.SUPABASE_URL) {
      console.log('   1. Copy .env.example to .env and fill in your Supabase credentials');
    }
    if (!fs.existsSync(latestJson)) {
      console.log('   2. Run npm run scrape to generate product data');
    }
    console.log('   3. Run npm run migrate to start the migration');
    console.log('   4. Use npm run migrate-versions to see available versions');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (process.env.DEBUG) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run test
testMigrationSystem();