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
        console.log('🚀 Starting working products migration to Supabase...');

        // Load products data
        const productsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'latest.json'), 'utf8'));
        console.log(`📊 Found ${productsData.length} products to migrate`);

        console.log('\n📦 Migrating products...');
        let successCount = 0;
        
        for (const product of productsData) {
            // Build product data with only essential fields first
            const productData = {
                handle: product.handle,
                title: product.title,
                vendor: product.vendor || 'Momentous',
                eu_allowed: product.euAllowed || false
            };

            // Add optional fields if they exist and are not empty
            if (product.description && product.description.trim() !== '') {
                productData.description = product.description;
            }
            
            if (product.price && product.price.trim() !== '') {
                productData.price = product.price;
            }
            
            if (product.subscriptionPrice && product.subscriptionPrice.trim() !== '') {
                productData.subscription_price = product.subscriptionPrice;
            }
            
            if (product.image && product.image.trim() !== '') {
                productData.image = product.image;
            }
            
            if (product.link && product.link.trim() !== '') {
                productData.link = product.link;
            }
            
            if (product.category && product.category.trim() !== '') {
                productData.category = product.category;
            }
            
            if (product.primaryGoal && product.primaryGoal.trim() !== '') {
                productData.primary_goal = product.primaryGoal;
            }

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

        console.log(`\n🎉 Migration completed!`);
        console.log(`📊 ${successCount}/${productsData.length} products migrated successfully`);

    } catch (error) {
        console.error('💥 Migration failed:', error);
    }
}

migrateProducts();