const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Check for required environment variables
if (!process.env.SUPABASE_URL) {
    console.error('❌ SUPABASE_URL environment variable is required');
    process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applySchema() {
    try {
        console.log('🚀 Applying database schema to Supabase...');

        // Read the schema file
        const schemaSQL = fs.readFileSync(path.join(__dirname, 'supabase-schema.sql'), 'utf8');
        
        // Split SQL into individual statements (rough split by semicolon)
        const statements = schemaSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        console.log(`📋 Found ${statements.length} SQL statements to execute`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.length > 10) { // Skip very short statements
                console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
                
                const { data, error } = await supabase.rpc('execute_sql', {
                    sql: statement + ';'
                });

                if (error) {
                    console.error(`❌ Error executing statement ${i + 1}:`, error);
                    console.log('Statement was:', statement);
                } else {
                    console.log(`✅ Statement ${i + 1} executed successfully`);
                }
            }
        }

        console.log('🎉 Schema application completed!');

    } catch (error) {
        console.error('💥 Schema application failed:', error);
        process.exit(1);
    }
}

// Run schema application
applySchema();