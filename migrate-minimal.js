const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateProducts() {
    try {
        console.log('🚀 Starting minimal products migration to Supabase...');

        // Load products data
        const productsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'latest.json'), 'utf8'));
        console.log(`📊 Found ${productsData.length} products to migrate`);

        console.log('\n📦 Migrating products with minimal fields...');
        let successCount = 0;
        
        for (const product of productsData.slice(0, 3)) {
            // Only use the most basic fields
            const productData = {
                handle: product.handle,
                title: product.title,
                vendor: product.vendor || 'Momentous'
            };

            const { data, error } = await supabase
                .from('products')
                .upsert(productData, { onConflict: 'handle' })
                .select();

            if (error) {
                console.error(`❌ Error migrating product ${product.handle}:`, error);
            } else {
                console.log(`✅ Migrated product: ${product.title}`);
                successCount++;
            }
        }

        console.log(`\n🎉 Minimal migration completed!`);
        console.log(`📊 ${successCount}/3 products migrated successfully`);

    } catch (error) {
        console.error('💥 Migration failed:', error);
    }
}

migrateProducts();