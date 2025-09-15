const { createClient } = require('@supabase/supabase-js');

// Test Supabase connection
const supabase = createClient(
    'https://baqdzabfkhtgnxzhoyax.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNjk4OSwiZXhwIjoyMDczNDkyOTg5fQ.SZmjBrkLRJ0jjNEiRUgXl2mLuTOqzU78t9abfojWixU'
);

async function testAPI() {
    console.log('🧪 Testing API endpoints with Supabase...\n');
    
    // Test products endpoint
    console.log('📦 Testing products query...');
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('handle, title, price_amount, price_display, category, primary_goal')
        .limit(3);
    
    if (productsError) {
        console.error('❌ Products error:', productsError);
    } else {
        console.log('✅ Products loaded:', products.length);
        products.forEach(p => {
            console.log(`   ${p.title}: ${p.price_display || '$' + p.price_amount}`);
        });
    }
    
    console.log('\n📊 Testing analytics query...');
    const { data: analytics, error: analyticsError } = await supabase
        .from('products')
        .select('price_amount, category, primary_goal');
    
    if (analyticsError) {
        console.error('❌ Analytics error:', analyticsError);
    } else {
        const prices = analytics.map(p => p.price_amount).filter(p => p !== null);
        console.log('✅ Analytics data:');
        console.log(`   Total products: ${analytics.length}`);
        console.log(`   Price range: $${Math.min(...prices)} - $${Math.max(...prices)}`);
        console.log(`   Average price: $${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)}`);
    }
    
    console.log('\n📂 Testing categories query...');
    const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .limit(5);
    
    if (categoriesError) {
        console.error('❌ Categories error:', categoriesError);
    } else {
        console.log('✅ Categories loaded:', categories.length);
        categories.forEach(c => console.log(`   ${c.name}`));
    }
    
    console.log('\n🎯 Testing goals query...');
    const { data: goals, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .limit(5);
    
    if (goalsError) {
        console.error('❌ Goals error:', goalsError);
    } else {
        console.log('✅ Goals loaded:', goals.length);
        goals.forEach(g => console.log(`   ${g.name}`));
    }
    
    console.log('\n🎉 API test completed!');
}

testAPI().catch(console.error);