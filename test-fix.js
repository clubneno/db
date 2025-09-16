const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://baqdzabfkhtgnxzhoyax.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNjk4OSwiZXhwIjoyMDczNDkyOTg5fQ.SZmjBrkLRJ0jjNEiRUgXl2mLuTOqzU78t9abfojWixU'
);

async function testUpdate() {
    console.log('🧪 Testing updated approach without setting updated_at...');
    
    // Test update without setting updated_at manually
    const testUpdate = {
        title: 'Fixed Creatine - ' + new Date().toISOString().substring(0, 16),
        eu_allowed: 'yes'
    };
    
    console.log('Attempting to update with:', testUpdate);
    
    const { data: updateData, error: updateError } = await supabase
        .from('products')
        .update(testUpdate)
        .eq('handle', 'creatine-monohydrate')
        .select();
    
    if (updateError) {
        console.error('❌ Update failed:', updateError);
    } else {
        console.log('✅ Update successful!');
        console.log('Response data:', JSON.stringify(updateData, null, 2));
        
        // Verify the change persisted
        const { data: verifyData } = await supabase
            .from('products')
            .select('title, eu_allowed, updated_at')
            .eq('handle', 'creatine-monohydrate');
            
        console.log('🔍 Verification - current data:', JSON.stringify(verifyData, null, 2));
    }
}

testUpdate().catch(console.error);