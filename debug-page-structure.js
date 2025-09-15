const puppeteer = require('puppeteer');

class PageStructureDebugger {
  async init() {
    this.browser = await puppeteer.launch({ 
      headless: false, // Use visible browser for debugging
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  }

  async debugCollectionPage() {
    try {
      console.log('🔍 Navigating to shop-all page...');
      await this.page.goto('https://www.livemomentous.com/collections/shop-all', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      console.log('📊 Analyzing page structure...');
      
      const pageInfo = await this.page.evaluate(() => {
        // Check various product selectors
        const selectors = [
          '.product-card',
          '.product-item', 
          '[data-product]',
          '.grid__item',
          '.product',
          '.product-grid .product',
          '.collection .product',
          '[data-product-id]',
          '.product-wrap',
          '.product-container'
        ];
        
        const results = {};
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          results[selector] = elements.length;
        });
        
        // Also check for common collection/grid containers
        const containers = [
          '.collection',
          '.product-grid',
          '.products',
          '.grid',
          '.collection-grid',
          '.product-list'
        ];
        
        const containerResults = {};
        containers.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          containerResults[selector] = elements.length;
        });
        
        return {
          title: document.title,
          url: window.location.href,
          productSelectors: results,
          containerSelectors: containerResults,
          totalElements: document.querySelectorAll('*').length
        };
      });

      console.log('=== PAGE ANALYSIS ===');
      console.log(`Title: ${pageInfo.title}`);
      console.log(`URL: ${pageInfo.url}`);
      console.log(`Total elements: ${pageInfo.totalElements}`);
      
      console.log('\n=== PRODUCT SELECTORS ===');
      Object.entries(pageInfo.productSelectors).forEach(([selector, count]) => {
        if (count > 0) {
          console.log(`✅ ${selector}: ${count} elements`);
        } else {
          console.log(`❌ ${selector}: 0 elements`);
        }
      });
      
      console.log('\n=== CONTAINER SELECTORS ===');
      Object.entries(pageInfo.containerSelectors).forEach(([selector, count]) => {
        if (count > 0) {
          console.log(`✅ ${selector}: ${count} elements`);
        }
      });

      // Wait a bit to let user see the page
      console.log('\n⏳ Waiting 10 seconds for manual inspection...');
      await this.page.waitForTimeout(10000);

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

// Run the debugger
(async () => {
  const pageDebugger = new PageStructureDebugger();
  
  try {
    await pageDebugger.init();
    await pageDebugger.debugCollectionPage();
  } catch (error) {
    console.error('Debug failed:', error);
  } finally {
    await pageDebugger.close();
  }
})();