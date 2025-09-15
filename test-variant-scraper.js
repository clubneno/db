const puppeteer = require('puppeteer');

class TestVariantScraper {
  async init() {
    this.browser = await puppeteer.launch({ 
      headless: "new",
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      defaultViewport: { width: 1920, height: 1080 },
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  }

  async testProductVariants(productUrl) {
    try {
      console.log(`Testing variant extraction for: ${productUrl}`);
      
      // Extract product handle from URL
      const productHandle = productUrl.match(/\/products\/([^\/\?]+)/);
      if (!productHandle) {
        console.log('Could not extract product handle from URL');
        return null;
      }

      // Try Shopify API first
      const shopifyUrl = `https://www.livemomentous.com/products/${productHandle[1]}.js`;
      console.log(`Fetching Shopify JSON: ${shopifyUrl}`);
      
      const response = await this.page.evaluate(async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json();
        } catch (e) {
          return { error: e.message };
        }
      }, shopifyUrl);
      
      if (response.error) {
        console.log(`Shopify API error: ${response.error}`);
        return null;
      }

      if (response.variants) {
        console.log(`\n=== SHOPIFY API RESULTS ===`);
        console.log(`Product: ${response.title}`);
        console.log(`Total variants: ${response.variants.length}`);
        console.log(`Options: ${response.options?.map(opt => opt.name).join(', ') || 'None'}`);
        
        console.log(`\nFirst 5 variants:`);
        response.variants.slice(0, 5).forEach((variant, i) => {
          console.log(`${i + 1}. "${variant.title}" | Option1: "${variant.option1}" | Option2: "${variant.option2}" | Option3: "${variant.option3}" | Price: $${(variant.price / 100).toFixed(2)}`);
        });
        
        if (response.variants.length > 5) {
          console.log(`... and ${response.variants.length - 5} more variants`);
        }

        return {
          product: response.title,
          totalVariants: response.variants.length,
          options: response.options,
          variants: response.variants.map(variant => ({
            id: variant.id,
            title: variant.title,
            option1: variant.option1,
            option2: variant.option2,
            option3: variant.option3,
            price: `$${(variant.price / 100).toFixed(2)}`,
            available: variant.available
          }))
        };
      }

    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Test with Grass-Fed Whey Protein Isolate
(async () => {
  const scraper = new TestVariantScraper();
  
  try {
    await scraper.init();
    
    // Test multiple products to see which ones have size variants
    const testUrls = [
      'https://www.livemomentous.com/products/essential-whey-protein',
      'https://www.livemomentous.com/products/creatine',
      'https://www.livemomentous.com/products/fuel'
    ];
    
    for (const url of testUrls) {
      console.log(`\n${'='.repeat(60)}`);
      const result = await scraper.testProductVariants(url);
      if (result) {
        console.log('\n=== SUCCESS! ===');
        console.log(`Product: ${result.product}`);
        console.log(`Total variants: ${result.totalVariants}`);
        if (result.options) {
          console.log(`Option names: ${result.options.map(o => o.name).join(', ')}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await scraper.close();
  }
})();