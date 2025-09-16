const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://baqdzabfkhtgnxzhoyax.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNjk4OSwiZXhwIjoyMDczNDkyOTg5fQ.SZmjBrkLRJ0jjNEiRUgXl2mLuTOqzU78t9abfojWixU'
);

async function debugDatabase() {
    console.log('🔍 Debugging Supabase database...');
    
    // 1. Get one product to see the schema
    console.log('\n1. Fetching one product to see current schema:');
    const { data: oneProduct, error: oneError } = await supabase
        .from('products')
        .select('*')
        .limit(1);
    
    if (oneError) {
        console.error('Error fetching product:', oneError);
    } else {
        console.log('Available columns:', Object.keys(oneProduct[0] || {}));
        console.log('Sample product data:', JSON.stringify(oneProduct[0], null, 2));
    }
    
    // 2. Try to find the creatine product specifically
    console.log('\n2. Finding creatine product:');
    const { data: creatineData, error: creatineError } = await supabase
        .from('products')
        .select('*')
        .eq('handle', 'creatine-monohydrate');
    
    if (creatineError) {
        console.error('Error fetching creatine:', creatineError);
    } else {
        console.log('Creatine product found:', !!creatineData[0]);
        if (creatineData[0]) {
            console.log('Current title:', creatineData[0].title);
            console.log('Current updated_at:', creatineData[0].updated_at);
        }
    }
    
    // 3. Try a simple update to see what happens
    console.log('\n3. Testing simple update:');
    const testUpdate = {
        title: 'TEST UPDATED CREATINE - ' + new Date().toISOString(),
        updated_at: new Date().toISOString()
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
        console.log('✅ Update response:', JSON.stringify(updateData, null, 2));
        
        // Verify the change
        const { data: verifyData } = await supabase
            .from('products')
            .select('title, updated_at')
            .eq('handle', 'creatine-monohydrate');
            
        console.log('🔍 Verification query result:', JSON.stringify(verifyData, null, 2));
    }
}

debugDatabase().catch(console.error);