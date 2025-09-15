const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Function to parse price string like "$39.95" into numeric value
function parsePrice(priceString) {
    if (!priceString || typeof priceString !== 'string') return null;
    
    // Remove currency symbols and extract numeric value
    const numericValue = priceString.replace(/[^\d.]/g, '');
    const parsed = parseFloat(numericValue);
    
    return isNaN(parsed) ? null : parsed;
}

async function migrateProducts() {
    try {
        console.log('🚀 Starting final products migration to Supabase...');

        // Load products data
        const productsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'latest.json'), 'utf8'));
        console.log(`📊 Found ${productsData.length} products to migrate`);

        console.log('\n📦 Migrating products with proper price handling...');
        let successCount = 0;
        
        for (const product of productsData) {
            // Build product data with separated price fields
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

            // Handle price fields - separate numeric value from display string
            if (product.price && product.price.trim() !== '') {
                productData.price_display = product.price;
                productData.price_amount = parsePrice(product.price);
                productData.price_currency = 'USD'; // Assuming USD for now
            }
            
            if (product.subscriptionPrice && product.subscriptionPrice.trim() !== '') {
                productData.subscription_price_display = product.subscriptionPrice;
                productData.subscription_price_amount = parsePrice(product.subscriptionPrice);
                productData.subscription_currency = 'USD'; // Assuming USD for now
            }

            const { data, error } = await supabase
                .from('products')
                .upsert(productData, { onConflict: 'handle' })
                .select();

            if (error) {
                console.error(`❌ Error migrating product ${product.handle}:`, error);
            } else {
                console.log(`✅ Migrated product: ${product.title} (Price: ${productData.price_display || 'N/A'})`);
                successCount++;
            }
        }

        console.log(`\n🎉 Migration completed!`);
        console.log(`📊 ${successCount}/${productsData.length} products migrated successfully`);

        // Show sample of migrated data
        console.log('\n📋 Sample of migrated products:');
        const { data: sampleProducts, error: sampleError } = await supabase
            .from('products')
            .select('handle, title, price_amount, price_display, subscription_price_amount')
            .limit(3);
            
        if (!sampleError && sampleProducts) {
            sampleProducts.forEach(p => {
                console.log(`   ${p.title}: $${p.price_amount} (Display: ${p.price_display})`);
            });
        }

    } catch (error) {
        console.error('💥 Migration failed:', error);
    }
}

migrateProducts();