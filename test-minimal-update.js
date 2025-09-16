const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://baqdzabfkhtgnxzhoyax.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNjk4OSwiZXhwIjoyMDczNDkyOTg5fQ.SZmjBrkLRJ0jjNEiRUgXl2mLuTOqzU78t9abfojWixU'
);

async function testMinimalUpdates() {
    console.log('🧪 Testing which fields can be updated...');
    
    const handle = 'creatine-monohydrate';
    
    // Test different single field updates to see which ones work
    const fieldsToTest = [
        { field: 'eu_allowed', value: 'yes' },
        { field: 'eu_notification_status', value: 'In Preparation' },
        { field: 'hs_code', value: 'TEST123' },
        { field: 'hs_code_description', value: 'Test description' },
        { field: 'duty_rate', value: 5.5 },
        { field: 'vendor', value: 'Momentous Updated' },
        { field: 'description', value: 'Test description update' }
    ];
    
    for (const test of fieldsToTest) {
        console.log(`\n📝 Testing update of ${test.field}...`);
        
        const updateObj = {};
        updateObj[test.field] = test.value;
        
        try {
            const { data, error } = await supabase
                .from('products')
                .update(updateObj)
                .eq('handle', handle)
                .select();
            
            if (error) {
                console.error(`❌ ${test.field} update failed:`, error.message);
            } else {
                console.log(`✅ ${test.field} update succeeded!`);
                console.log(`   New value: ${data[0]?.[test.field]}`);
                
                // If successful, this means we can update! Break and report success
                if (data && data.length > 0) {
                    console.log('\n🎉 SUCCESS! Found a field that can be updated successfully!');
                    console.log('This means the API should work for this field type.');
                    return true;
                }
            }
        } catch (err) {
            console.error(`❌ ${test.field} update exception:`, err.message);
        }
    }
    
    return false;
}

testMinimalUpdates().catch(console.error);