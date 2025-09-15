const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://baqdzabfkhtgnxzhoyax.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNjk4OSwiZXhwIjoyMDczNDkyOTg5fQ.SZmjBrkLRJ0jjNEiRUgXl2mLuTOqzU78t9abfojWixU'
);

async function simpleImport() {
  try {
    console.log('🔄 Loading local product data...');
    const dataPath = path.join(__dirname, 'data', 'latest.json');
    const products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`📊 Found ${products.length} products to update`);
    
    let updateCount = 0;
    
    for (const product of products.slice(0, 10)) { // Start with first 10
      const priceAmount = product.price ? parseFloat(product.price.replace(/[$,]/g, '')) : null;
      
      const { error } = await supabase
        .from('products')
        .update({
          price_amount: priceAmount,
          price_display: product.price,
          image: product.image,
          description: product.description,
          category: product.category,
          primary_goal: product.primaryGoal
        })
        .eq('handle', product.handle);
      
      if (error) {
        console.log(`❌ Error updating ${product.handle}:`, error.message);
      } else {
        updateCount++;
        console.log(`✅ Updated ${product.handle}`);
      }
    }
    
    console.log(`🎉 Successfully updated ${updateCount} products!`);
    
  } catch (error) {
    console.error('💥 Import failed:', error);
  }
}

simpleImport();
