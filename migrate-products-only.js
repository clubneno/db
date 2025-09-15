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

async function migrateProducts() {
    try {
        console.log('🚀 Starting products-only migration to Supabase...');

        // Load products data
        const productsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'latest.json'), 'utf8'));
        console.log(`📊 Found ${productsData.length} products to migrate`);

        // Try a simpler product structure first
        console.log('\\n📦 Migrating products with basic fields...');
        let successCount = 0;
        
        for (const product of productsData.slice(0, 3)) { // Test with first 3 products
            const basicProductData = {
                handle: product.handle,
                title: product.title,
                description: product.description || '',
                price: product.price,
                subscription_price: product.subscriptionPrice,
                image: product.image,
                link: product.link,
                category: product.category,
                primary_goal: product.primaryGoal,
                vendor: product.vendor || 'Momentous',
                eu_allowed: product.euAllowed || false
            };

            const { data, error } = await supabase
                .from('products')
                .upsert(basicProductData, { onConflict: 'handle' });

            if (error) {
                console.error(`❌ Error migrating product ${product.handle}:`, error);
            } else {
                console.log(`✅ Migrated product: ${product.title}`);
                successCount++;
            }
        }

        console.log(`\\n🎉 Test migration completed!`);
        console.log(`📊 ${successCount}/3 products migrated successfully`);

    } catch (error) {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migrateProducts();