const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://baqdzabfkhtgnxzhoyax.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNjk4OSwiZXhwIjoyMDczNDkyOTg5fQ.SZmjBrkLRJ0jjNEiRUgXl2mLuTOqzU78t9abfojWixU'
);

async function importProductsToSupabase() {
  try {
    console.log('🔄 Loading local product data...');
    const dataPath = path.join(__dirname, 'data', 'latest.json');
    const products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`📊 Found ${products.length} products to import`);
    
    // Transform local data to match Supabase schema
    const supabaseProducts = products.map(product => {
      const priceAmount = product.price ? parseFloat(product.price.replace(/[$,]/g, '')) : null;
      const subscriptionAmount = product.subscriptionPrice ? parseFloat(product.subscriptionPrice.replace(/[$,]/g, '')) : null;
      
      return {
        title: product.title,
        handle: product.handle,
        price_amount: priceAmount,
        price_currency: 'USD',
        price_display: product.price,
        subscription_price_amount: subscriptionAmount,
        subscription_currency: 'USD',
        subscription_price_display: product.subscriptionPrice,
        image: product.image,
        main_image: product.image,
        description: product.description,
        full_description: product.fullDescription,
        category: product.category,
        primary_goal: product.primaryGoal,
        vendor: product.vendor || 'Momentous',
        availability: product.availability,
        product_type: product.productType,
        link: product.link,
        created_at: product.createdAt,
        updated_at: product.updatedAt,
        scraped_at: new Date().toISOString()
      };
    });
    
    console.log('🚀 Importing products to Supabase...');
    
    // Use upsert to update existing products or insert new ones
    const { data, error } = await supabase
      .from('products')
      .upsert(supabaseProducts, { 
        onConflict: 'handle',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error('❌ Error importing to Supabase:', error);
      return;
    }
    
    console.log(`✅ Successfully imported ${supabaseProducts.length} products to Supabase!`);
    console.log('🎉 Products now have complete data: prices, images, descriptions');
    
  } catch (error) {
    console.error('💥 Import failed:', error);
  }
}

importProductsToSupabase();
