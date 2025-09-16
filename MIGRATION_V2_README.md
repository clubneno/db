# Production-Ready Supabase Migration System v2.0

This is a complete rewrite of the migration system following Supabase best practices and production standards.

## 🚀 Features

### ✅ **Security**
- Environment variable-based configuration (no hardcoded credentials)
- Secure secret management
- Input validation and sanitization

### ⚡ **Performance** 
- Batch processing (configurable batch sizes)
- Connection pooling optimization
- Statement timeout management
- Database optimization during migrations
- Trigger disabling/enabling for faster imports

### 🛡️ **Reliability**
- Comprehensive error handling with categorization
- Exponential backoff retry logic
- Transaction management
- Automatic rollback on failures
- Progress tracking and resumable migrations

### 📊 **Observability**
- Detailed progress tracking
- Performance monitoring
- Comprehensive error logging
- Migration reports and summaries
- Real-time statistics

### 💾 **Data Safety**
- Automatic pre-migration backups
- Rollback capabilities
- Data validation and transformation
- Migration versioning
- Checkpoint system

## 📋 Quick Start

### 1. Setup Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit with your Supabase credentials
nano .env
```

### 2. Required Environment Variables
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 3. Run Migration
```bash
# Run latest migration version
node migrate-v2.js

# Run specific version
node migrate-v2.js --version 1.0.0

# Auto-resume interrupted migration
node migrate-v2.js --auto-resume

# Force restart (ignore existing progress)
node migrate-v2.js --force-restart
```

## 📖 Usage Examples

### Basic Migration
```bash
node migrate-v2.js
```

### Advanced Options
```bash
# Custom migration with specific settings
node migrate-v2.js --version 1.1.0 --migration-id my-migration-2024

# Resume interrupted migration automatically
node migrate-v2.js --auto-resume

# Migration without rollback on failure (not recommended)
node migrate-v2.js --no-rollback
```

### List Available Versions
```bash
node migrate-v2.js --list-versions
```

## 🏗️ Architecture

### Core Components

1. **MigrationRunner** - Main orchestrator
2. **BatchProcessor** - Handles bulk operations
3. **ErrorHandler** - Comprehensive error management
4. **ProgressTracker** - Migration state and progress
5. **BackupManager** - Data safety and rollback
6. **PerformanceOptimizer** - Database optimization
7. **Validators** - Data validation and transformation

### Migration Process Flow

```
1. Pre-flight Checks
   ├── Database connection test
   ├── Required files validation  
   ├── Disk space check
   └── Performance baseline

2. Backup Creation
   ├── Full table backup
   ├── Metadata storage
   └── Verification

3. Database Optimization
   ├── Performance settings
   ├── Trigger disabling
   ├── Index optimization
   └── Monitoring setup

4. Data Processing
   ├── Validation
   ├── Transformation
   ├── Batch processing
   └── Progress tracking

5. Cleanup & Restore
   ├── Trigger restoration
   ├── Index rebuilding
   ├── Statistics update
   └── Performance restoration
```

## 📊 Migration Versions

### Version 1.0.0 - Basic Migration
- Products, categories, goals, flavors
- Basic validation and transformation
- Simple batch processing

### Version 1.1.0 - Enhanced Migration (Latest)
- Advanced validation and error handling
- Performance optimization
- Backup and rollback capabilities
- Progress tracking and resumption

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MIGRATION_BATCH_SIZE` | Records per batch | 500 |
| `MIGRATION_MAX_RETRIES` | Max retry attempts | 3 |
| `MIGRATION_RETRY_DELAY` | Initial retry delay (ms) | 1000 |
| `MIGRATION_STATEMENT_TIMEOUT` | SQL timeout (ms) | 600000 |
| `MIGRATION_ENABLE_BACKUP` | Create backups | true |
| `MIGRATION_DISABLE_TRIGGERS_ON_IMPORT` | Disable triggers | true |

### Custom Configuration File

Create `migration/migration.config.json`:
```json
{
  "batchSize": 1000,
  "maxRetries": 5,
  "enableProgressTracking": true,
  "dataDirectory": "./custom-data"
}
```

## 📁 File Structure

```
migration/
├── config.js              # Configuration management
├── validators.js           # Data validation schemas
├── batch-processor.js      # Batch processing logic
├── error-handler.js        # Error handling & retry logic
├── progress-tracker.js     # Progress & version management
├── backup-manager.js       # Backup & rollback system
├── performance-optimizer.js # Database optimization
└── migration-runner.js     # Main orchestrator

migrate-v2.js              # CLI interface
backups/                   # Backup storage
├── logs/                  # Error and progress logs
└── migration-*/           # Migration backups
```

## 🚨 Troubleshooting

### Common Issues

**Connection Errors**
```bash
# Check environment variables
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Test connection
node -e "console.log(process.env.SUPABASE_URL)"
```

**Permission Errors**
- Ensure you're using the SERVICE_ROLE_KEY (not anon key)
- Check RLS policies on your tables
- Verify your Supabase project settings

**Memory Issues**
- Reduce `MIGRATION_BATCH_SIZE`
- Increase `work_mem` in your database
- Monitor system resources during migration

**Migration Failures**
```bash
# Resume interrupted migration
node migrate-v2.js --auto-resume

# Check logs for detailed errors
ls -la backups/logs/

# Force restart if needed
node migrate-v2.js --force-restart
```

### Debug Mode
```bash
DEBUG=1 node migrate-v2.js
```

## 📈 Performance Tips

1. **Optimize Batch Size**: Start with 500, adjust based on your data size
2. **Monitor Resources**: Watch CPU, memory, and network usage
3. **Use Service Role Key**: Bypasses RLS for better performance
4. **Run During Off-Peak**: Minimize impact on production systems
5. **Sufficient Disk Space**: Ensure 2x data size for backups

## 🔄 Rollback & Recovery

### Automatic Rollback
- Triggered on migration failures
- Restores from pre-migration backup
- Maintains data consistency

### Manual Rollback
```bash
# List available backups
node -e "
const BackupManager = require('./migration/backup-manager');
const MigrationConfig = require('./migration/config');
const config = new MigrationConfig();
const backup = new BackupManager(config.getSupabase(), config.getConfig());
console.log(backup.listBackups());
"

# Restore from specific backup
node -e "
const BackupManager = require('./migration/backup-manager');
const MigrationConfig = require('./migration/config');
const config = new MigrationConfig();
const backup = new BackupManager(config.getSupabase(), config.getConfig());
backup.restoreFromBackup('backup-id-here').then(() => console.log('Restored'));
"
```

## 🆚 Comparison with Old System

| Feature | Old System | New System v2.0 |
|---------|------------|-----------------|
| Security | ❌ Hardcoded keys | ✅ Environment variables |
| Performance | ❌ Sequential processing | ✅ Batch processing |
| Error Handling | ❌ Basic logging | ✅ Categorized errors + retry |
| Rollback | ❌ Manual only | ✅ Automatic + manual |
| Progress Tracking | ❌ None | ✅ Resumable migrations |
| Data Validation | ❌ Minimal | ✅ Comprehensive schemas |
| Monitoring | ❌ None | ✅ Real-time statistics |
| Backup | ❌ Manual | ✅ Automatic |

## 📞 Support

For issues or questions:
1. Check this documentation first
2. Review error logs in `backups/logs/`
3. Try resuming with `--auto-resume`
4. Use `--help` for CLI options
5. Enable debug mode with `DEBUG=1`

---

**⚠️ Important Notes:**
- Always test migrations on a staging environment first
- Keep backups of your original data files
- Monitor system resources during large migrations
- Use `--auto-resume` to continue interrupted migrations
- The service role key has full database access - keep it secure