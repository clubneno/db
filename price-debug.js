const axios = require('axios');

async function debugPricing() {
  try {
    console.log('🔍 Debugging Momentous pricing structure...');
    
    const response = await axios.get('https://www.livemomentous.com/collections/shop-all/products.json?limit=5', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (response.data && response.data.products) {
      console.log(`Found ${response.data.products.length} products for debugging`);
      
      response.data.products.slice(0, 3).forEach((product, index) => {
        console.log(`\n--- Product ${index + 1}: ${product.title} ---`);
        console.log('Raw price data:');
        if (product.variants && product.variants[0]) {
          const variant = product.variants[0];
          console.log('  variant.price:', variant.price, typeof variant.price);
          console.log('  variant.compare_at_price:', variant.compare_at_price, typeof variant.compare_at_price);
          console.log('  price / 100:', variant.price / 100);
          console.log('  price * 1:', variant.price * 1);
        }
        console.log('Product tags:', product.tags);
        console.log('Product type:', product.product_type);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugPricing();