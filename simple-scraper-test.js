const puppeteer = require('puppeteer');

class SimpleScraperTest {
  async init() {
    this.browser = await puppeteer.launch({ 
      headless: "new",
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  }

  async scrapeProducts() {
    try {
      console.log('🚀 Starting simple product scraping test...');
      
      await this.page.goto('https://www.livemomentous.com/collections/shop-all', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      console.log('📄 Loading all products...');
      
      // Scroll to load more products
      await this.page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          let distance = 100;
          let timer = setInterval(() => {
            let scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if(totalHeight >= scrollHeight){
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      await this.page.waitForTimeout(3000);

      console.log('🔍 Extracting products...');
      
      const products = await this.page.evaluate(() => {
        const productElements = document.querySelectorAll('.product-card, .product-item, [data-product-id]');
        console.log(`Found ${productElements.length} product elements on page`);
        
        const products = [];

        productElements.forEach((element, index) => {
          try {
            const titleEl = element.querySelector('h3, .product-title, .card__heading, .product-card__title, h2, .h3, .product-name');
            const priceEl = element.querySelector('.price, .product-price, .card__price, .money, .product-card__price');
            const imageEl = element.querySelector('img');
            const linkEl = element.querySelector('a') || element.closest('a');

            const title = titleEl ? titleEl.textContent.trim() : null;
            const price = priceEl ? priceEl.textContent.trim() : 'Price not available';
            const image = imageEl ? (imageEl.src || imageEl.dataset.src) : null;
            const link = linkEl ? linkEl.href : null;

            if (title && link) {
              products.push({
                title,
                price,
                image,
                link,
                scraped_at: new Date().toISOString()
              });
              console.log(`✅ Extracted: ${title}`);
            } else {
              console.log(`❌ Skipped element ${index}: title="${title}", link="${link ? 'found' : 'missing'}"`);
            }
          } catch (error) {
            console.log(`❌ Error processing element ${index}:`, error.message);
          }
        });

        return products;
      });

      console.log(`✅ Successfully extracted ${products.length} products`);
      
      if (products.length > 0) {
        console.log('\nFirst 5 products:');
        products.slice(0, 5).forEach((product, i) => {
          console.log(`${i + 1}. ${product.title} - ${product.price}`);
        });
        
        // Save to file
        const fs = require('fs');
        const path = require('path');
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir);
        }
        const filename = path.join(dataDir, `simple_scrape_${Date.now()}.json`);
        fs.writeFileSync(filename, JSON.stringify(products, null, 2));
        console.log(`\n💾 Saved ${products.length} products to ${filename}`);
      }

    } catch (error) {
      console.error('❌ Scraping failed:', error);
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
  const scraper = new SimpleScraperTest();
  
  try {
    await scraper.init();
    await scraper.scrapeProducts();
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await scraper.close();
  }
})();