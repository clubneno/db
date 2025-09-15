const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Check for required environment variables
if (!process.env.SUPABASE_URL) {
    console.error('❌ SUPABASE_URL environment variable is required');
    console.log('   Set it with: export SUPABASE_URL=your_supabase_url');
    process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    console.log('   Get it from: Supabase Dashboard → Settings → API → service_role key');
    console.log('   Set it with: export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
    process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for admin operations
);

async function migrateData() {
    try {
        console.log('🚀 Starting data migration to Supabase...');

        // Load existing data
        const productsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'latest.json'), 'utf8'));
        const categoriesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'categories.json'), 'utf8'));
        const goalsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'goals.json'), 'utf8'));
        const flavorsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'flavors.json'), 'utf8'));

        console.log(`📊 Found ${productsData.length} products to migrate`);
        console.log(`📂 Found ${categoriesData.length} categories to migrate`);
        console.log(`🎯 Found ${goalsData.length} goals to migrate`);
        console.log(`🍃 Found ${flavorsData.length} flavors to migrate`);

        // Migrate categories
        console.log('\\n📂 Migrating categories...');
        for (const category of categoriesData) {
            const { data, error } = await supabase
                .from('categories')
                .upsert({
                    name: category.name,
                    parent_id: category.parentId || null,
                    is_sub_category: category.isSubCategory || false
                }, { onConflict: 'name' });

            if (error) {
                console.error(`❌ Error migrating category ${category.name}:`, error);
            } else {
                console.log(`✅ Migrated category: ${category.name}`);
            }
        }

        // Migrate goals
        console.log('\\n🎯 Migrating goals...');
        for (const goal of goalsData) {
            const { data, error } = await supabase
                .from('goals')
                .upsert({
                    name: goal.name,
                    parent_id: goal.parentId || null,
                    is_sub_goal: goal.isSubGoal || false
                }, { onConflict: 'name' });

            if (error) {
                console.error(`❌ Error migrating goal ${goal.name}:`, error);
            } else {
                console.log(`✅ Migrated goal: ${goal.name}`);
            }
        }

        // Migrate flavors
        console.log('\\n🍃 Migrating flavors...');
        for (const flavor of flavorsData) {
            const { data, error } = await supabase
                .from('flavors')
                .upsert({
                    name: flavor.name
                }, { onConflict: 'name' });

            if (error) {
                console.error(`❌ Error migrating flavor ${flavor.name}:`, error);
            } else {
                console.log(`✅ Migrated flavor: ${flavor.name}`);
            }
        }

        // Migrate products
        console.log('\\n📦 Migrating products...');
        for (const product of productsData) {
            const productData = {
                handle: product.handle,
                title: product.title,
                description: product.description,
                full_description: product.fullDescription,
                price: product.price,
                subscription_price: product.subscriptionPrice,
                original_price: product.originalPrice,
                image: product.image,
                images: product.images || [],
                link: product.link,
                category: product.category,
                primary_goal: product.primaryGoal,
                product_type: product.productType,
                vendor: product.vendor,
                availability: product.availability,
                tags_string: product.tagsString || '',
                created_at: product.createdAt,
                updated_at: product.updatedAt,
                variants: product.variants || [],
                
                // Custom fields
                categories: product.categories || [],
                goals: product.goals || [],
                flavors: product.flavors || [],
                eu_notification_status: product.euNotificationStatus,
                skus: product.skus || [],
                hs_code: product.hsCode,
                hs_code_description: product.hsCodeDescription,
                duty_rate: product.dutyRate,
                product_name: product.productName,
                eu_allowed: product.euAllowed || false,
                size: product.size,
                servings: product.servings,
                intake_frequency: product.intakeFrequency,
                reorder_period: product.reorderPeriod,
                nutraceuticals_regular_price: product.nutraceuticalsRegularPrice,
                nutraceuticals_subscription_price: product.nutraceuticalsSubscriptionPrice,
                clubneno_regular_price: product.clubnenoRegularPrice,
                clubneno_subscription_price: product.clubnenoSubscriptionPrice,
                flavor_skus: product.flavorSkus || [],
                flavor_hs_codes: product.flavorHsCodes || [],
                flavor_duty_rates: product.flavorDutyRates || [],
                flavor_eu_notifications: product.flavorEuNotifications || [],
                flavor_notes: product.flavorNotes || [],
                flavor_links: product.flavorLinks || [],
                flavor_ingredients: product.flavorIngredients || []
            };

            const { data, error } = await supabase
                .from('products')
                .upsert(productData, { onConflict: 'handle' });

            if (error) {
                console.error(`❌ Error migrating product ${product.handle}:`, error);
            } else {
                console.log(`✅ Migrated product: ${product.title}`);
            }
        }

        console.log('\\n🎉 Data migration completed successfully!');
        console.log(`📊 Summary:`);
        console.log(`   - ${categoriesData.length} categories migrated`);
        console.log(`   - ${goalsData.length} goals migrated`);
        console.log(`   - ${flavorsData.length} flavors migrated`);
        console.log(`   - ${productsData.length} products migrated`);

    } catch (error) {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migrateData();