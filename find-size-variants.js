const puppeteer = require('puppeteer');

class SizeVariantFinder {
  async init() {
    this.browser = await puppeteer.launch({ 
      headless: "new",
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      defaultViewport: { width: 1920, height: 1080 }
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  }

  async findProductsWithSizes() {
    try {
      // Get list of products from collection page
      console.log('🔍 Getting product list...');
      await this.page.goto('https://www.livemomentous.com/collections/shop-all', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      const productUrls = await this.page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/products/"]');
        const urls = new Set();
        links.forEach(link => {
          if (link.href.includes('/products/')) {
            urls.add(link.href);
          }
        });
        return Array.from(urls).slice(0, 15); // Test first 15 products
      });

      console.log(`Found ${productUrls.length} product URLs to test`);

      const productsWithMultipleOptions = [];

      for (const url of productUrls) {
        console.log(`\nTesting: ${url}`);
        
        const productHandle = url.match(/\/products\/([^\/\?]+)/);
        if (!productHandle) continue;

        try {
          const shopifyUrl = `https://www.livemomentous.com/products/${productHandle[1]}.js`;
          
          const response = await this.page.evaluate(async (apiUrl) => {
            try {
              const res = await fetch(apiUrl);
              if (!res.ok) return null;
              return await res.json();
            } catch (e) {
              return null;
            }
          }, shopifyUrl);

          if (response && response.options) {
            const optionCount = response.options.length;
            const variantCount = response.variants ? response.variants.length : 0;
            const optionNames = response.options.map(opt => opt.name).join(', ');

            console.log(`  📊 ${response.title}`);
            console.log(`     Options: ${optionCount} (${optionNames})`);
            console.log(`     Variants: ${variantCount}`);

            if (optionCount > 1) {
              console.log(`  ✅ MULTIPLE OPTIONS FOUND!`);
              productsWithMultipleOptions.push({
                title: response.title,
                url: url,
                optionCount,
                optionNames,
                variantCount,
                options: response.options,
                sampleVariants: response.variants ? response.variants.slice(0, 3) : []
              });
            } else if (variantCount > 6) {
              console.log(`  🔍 High variant count - might have hidden options`);
              productsWithMultipleOptions.push({
                title: response.title,
                url: url,
                optionCount,
                optionNames,
                variantCount,
                options: response.options,
                sampleVariants: response.variants ? response.variants.slice(0, 3) : []
              });
            }
          }
        } catch (error) {
          console.log(`  ❌ Error: ${error.message}`);
        }

        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log('🎯 PRODUCTS WITH MULTIPLE OPTIONS OR HIGH VARIANTS:');
      console.log(`${'='.repeat(60)}`);

      if (productsWithMultipleOptions.length === 0) {
        console.log('❌ NO products found with multiple option dimensions (like Flavor + Size)');
        console.log('   This suggests Momentous products only have single-dimension variants (flavors only)');
      } else {
        productsWithMultipleOptions.forEach((product, i) => {
          console.log(`\n${i + 1}. ${product.title}`);
          console.log(`   Options: ${product.optionNames} (${product.optionCount} dimensions)`);
          console.log(`   Variants: ${product.variantCount}`);
          
          if (product.sampleVariants.length > 0) {
            console.log(`   Sample variants:`);
            product.sampleVariants.forEach((variant, j) => {
              console.log(`     ${j + 1}. "${variant.title}" | ${variant.option1} | ${variant.option2 || 'N/A'} | ${variant.option3 || 'N/A'}`);
            });
          }
        });
      }

    } catch (error) {
      console.error('Error:', error);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Run the finder
(async () => {
  const finder = new SizeVariantFinder();
  
  try {
    await finder.init();
    await finder.findProductsWithSizes();
  } catch (error) {
    console.error('Search failed:', error);
  } finally {
    await finder.close();
  }
})();