const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://baqdzabfkhtgnxzhoyax.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNjk4OSwiZXhwIjoyMDczNDkyOTg5fQ.SZmjBrkLRJ0jjNEiRUgXl2mLuTOqzU78t9abfojWixU'
);

async function addMissingColumn() {
    console.log('🔧 Attempting to add missing db_updated_at column...');
    
    try {
        // Try to add the missing column
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS db_updated_at TIMESTAMPTZ DEFAULT NOW();'
        });
        
        if (error) {
            console.error('❌ Failed to add column via RPC:', error);
            
            // Alternative approach: try to use the REST API to modify schema
            console.log('🔄 Trying alternative approach...');
            
            // First, let's check if there's a way to view the table schema
            const { data: schemaData, error: schemaError } = await supabase
                .from('information_schema.columns')
                .select('column_name, data_type')
                .eq('table_name', 'products');
                
            if (schemaError) {
                console.error('Cannot access schema information:', schemaError);
            } else {
                console.log('Available columns in products table:', schemaData);
            }
            
        } else {
            console.log('✅ Column addition result:', data);
            
            // Test if the update works now
            console.log('🧪 Testing update after adding column...');
            const testResult = await supabase
                .from('products')
                .update({ title: 'Test after column add - ' + Date.now() })
                .eq('handle', 'creatine-monohydrate')
                .select();
                
            if (testResult.error) {
                console.error('❌ Update still fails:', testResult.error);
            } else {
                console.log('✅ Update now works!', testResult.data);
            }
        }
        
    } catch (err) {
        console.error('❌ Exception:', err);
    }
}

addMissingColumn().catch(console.error);