const puppeteer = require('puppeteer');

class ProductExtractor {
  async init() {
    this.browser = await puppeteer.launch({ 
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      defaultViewport: { width: 1920, height: 1080 }
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  }

  async testProductExtraction() {
    try {
      console.log('🔍 Navigating to shop-all page...');
      await this.page.goto('https://www.livemomentous.com/collections/shop-all', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      console.log('📊 Extracting products...');
      
      const products = await this.page.evaluate(() => {
        const productElements = document.querySelectorAll('.product-card, .product-item, [data-product-id]');
        console.log(`Found ${productElements.length} product elements`);
        
        const products = [];

        productElements.forEach((element, index) => {
          try {
            console.log(`Processing element ${index}:`, element.className);
            
            // Try multiple selectors for different product card structures
            const titleEl = element.querySelector('h3, .product-title, .card__heading, .product-card__title, [data-product-title], h2, .h3, .product-name');
            const priceEl = element.querySelector('.price, .product-price, .card__price, [data-price], .money, .product-card__price');
            const imageEl = element.querySelector('img');
            const linkEl = element.querySelector('a') || element.closest('a');

            console.log(`Element ${index} selectors:`, {
              title: titleEl ? titleEl.textContent.trim() : 'NOT FOUND',
              price: priceEl ? priceEl.textContent.trim() : 'NOT FOUND',
              image: imageEl ? 'FOUND' : 'NOT FOUND',
              link: linkEl ? 'FOUND' : 'NOT FOUND'
            });

            const title = titleEl ? titleEl.textContent.trim() : `Product ${index + 1}`;
            const price = priceEl ? priceEl.textContent.trim() : 'Price not found';
            const image = imageEl ? imageEl.src || imageEl.dataset.src : null;
            const link = linkEl ? linkEl.href : null;

            if (title && title !== `Product ${index + 1}`) {
              products.push({
                title,
                price,
                image,
                link
              });
              console.log(`✅ Successfully extracted: ${title}`);
            } else {
              console.log(`❌ Skipped element ${index} - no valid title`);
            }
          } catch (error) {
            console.log(`❌ Error processing element ${index}:`, error.message);
          }
        });

        console.log(`Total products extracted: ${products.length}`);
        return products;
      });

      console.log('\n=== EXTRACTION RESULTS ===');
      console.log(`Found ${products.length} products:`);
      products.forEach((product, i) => {
        console.log(`${i + 1}. ${product.title} - ${product.price}`);
      });

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

// Run the test
(async () => {
  const extractor = new ProductExtractor();
  
  try {
    await extractor.init();
    await extractor.testProductExtraction();
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait to see results
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await extractor.close();
  }
})();