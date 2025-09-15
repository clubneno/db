const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class MomentusScraper {
  constructor() {
    this.baseUrl = 'https://www.livemomentous.com';
    this.products = [];
  }

  async init() {
    this.browser = await puppeteer.launch({ 
      headless: "new", // Use new headless mode
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      defaultViewport: { width: 1920, height: 1080 },
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    this.page = await this.browser.newPage();
    
    // Set user agent to avoid detection
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  }

  async scrapeProducts() {
    try {
      console.log('🚀 Starting Momentous product scraping...');
      
      // Navigate to shop all page
      await this.page.goto(`${this.baseUrl}/collections/shop-all`, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for products to load
      await this.page.waitForSelector('.product-card, .product-item, [data-product-id]', { timeout: 10000 });

      // Load all products by scrolling and checking for load more buttons
      console.log('📄 Loading all products with enhanced loading...');
      
      let previousProductCount = 0;
      let currentProductCount = 0;
      let maxAttempts = 10;
      let attempts = 0;

      do {
        previousProductCount = currentProductCount;
        
        // Scroll to bottom
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        // Wait for new content
        await this.page.waitForTimeout(2000);
        
        // Check for load more buttons
        const loadMoreButton = await this.page.$('.load-more, [data-load-more], .btn--load-more, .pagination__next, .btn-load-more');
        if (loadMoreButton) {
          console.log('📄 Found load more button, clicking...');
          await loadMoreButton.click();
          await this.page.waitForTimeout(3000);
        }
        
        // Count current products
        currentProductCount = await this.page.evaluate(() => {
          return document.querySelectorAll('.product-card, .product-item, [data-product-id]').length;
        });
        
        console.log(`📊 Products found: ${currentProductCount} (was ${previousProductCount})`);
        attempts++;
        
      } while (currentProductCount > previousProductCount && attempts < maxAttempts);
      
      console.log(`📄 Finished loading. Final count: ${currentProductCount} products after ${attempts} attempts`);

      // Extract product information
      const products = await this.page.evaluate(() => {
        const productElements = document.querySelectorAll('.product-card, .product-item, [data-product-id]');
        const products = [];

        productElements.forEach((element, index) => {
          try {
            // Try multiple selectors for different product card structures
            const titleEl = element.querySelector('h3, .product-title, .card__heading, .product-card__title, [data-product-title], h2, .h3, .product-name');
            const priceEl = element.querySelector('.price, .product-price, .card__price, [data-price], .money, .product-card__price');
            const imageEl = element.querySelector('img');
            const linkEl = element.querySelector('a') || element.closest('a');
            const descEl = element.querySelector('.product-description, .card__text, .product-summary');

            const title = titleEl ? titleEl.textContent.trim() : null;
            const price = priceEl ? priceEl.textContent.trim() : 'Price not available';
            const image = imageEl ? (imageEl.src || imageEl.dataset.src || imageEl.getAttribute('data-src')) : null;
            const link = linkEl ? linkEl.href : null;
            const description = descEl ? descEl.textContent.trim() : '';

            console.log(`Processing element ${index}: title="${title}", link="${link ? 'found' : 'missing'}"`);

            if (title && link) {
              products.push({
                title,
                price,
                image,
                link,
                description,
                scraped_at: new Date().toISOString()
              });
            }
          } catch (error) {
            console.log(`Error processing product ${index}:`, error.message);
          }
        });

        return products;
      });

      console.log(`✅ Found ${products.length} products`);
      this.products = products;

      // Get detailed information for each product
      await this.scrapeProductDetails();

      // Save to JSON file
      this.saveProducts();

    } catch (error) {
      console.error('❌ Error scraping products:', error);
      throw error;
    }
  }

  async loadAllProducts() {
    let previousHeight = 0;
    let currentHeight = await this.page.evaluate('document.body.scrollHeight');

    // Try to load more products by scrolling
    while (previousHeight !== currentHeight) {
      previousHeight = currentHeight;
      
      // Scroll to bottom
      await this.page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      
      // Wait for new content to load
      await this.page.waitForTimeout(2000);
      
      // Check for "Load More" button
      const loadMoreButton = await this.page.$('.load-more, [data-load-more], .btn--load-more');
      if (loadMoreButton) {
        await loadMoreButton.click();
        await this.page.waitForTimeout(3000);
      }
      
      currentHeight = await this.page.evaluate('document.body.scrollHeight');
    }

    console.log('📄 All products loaded');
  }

  async scrapeProductDetails() {
    console.log('🔍 Scraping detailed product information...');
    
    for (let i = 0; i < Math.min(this.products.length, 5); i++) { // Focus on first 5 for testing enhanced variants
      const product = this.products[i];
      
      if (product.link) {
        try {
          console.log(`Scraping details for: ${product.title}`);
          
          // First try to get complete variant data via Shopify JSON API
          const productHandle = product.link.match(/\/products\/([^\/\?]+)/);
          let shopifyVariants = null;
          
          if (productHandle) {
            try {
              const shopifyUrl = `${this.baseUrl}/products/${productHandle[1]}.js`;
              console.log(`Fetching Shopify product JSON: ${shopifyUrl}`);
              
              const response = await this.page.evaluate(async (url) => {
                try {
                  const res = await fetch(url);
                  return await res.json();
                } catch (e) {
                  return null;
                }
              }, shopifyUrl);
              
              if (response && response.variants) {
                console.log(`Found ${response.variants.length} variants via Shopify API`);
                shopifyVariants = response.variants.map(variant => ({
                  id: variant.id,
                  title: variant.title,
                  price: variant.price ? `$${(variant.price / 100).toFixed(2)}` : null,
                  compareAtPrice: variant.compare_at_price ? `$${(variant.compare_at_price / 100).toFixed(2)}` : null,
                  available: variant.available,
                  option1: variant.option1,
                  option2: variant.option2,
                  option3: variant.option3,
                  sku: variant.sku,
                  inventory_quantity: variant.inventory_quantity
                }));
              }
            } catch (e) {
              console.log(`Failed to fetch Shopify JSON: ${e.message}`);
            }
          }
          
          await this.page.goto(product.link, { waitUntil: 'networkidle2', timeout: 15000 });
          
          const details = await this.page.evaluate(() => {
            const getTextContent = (selector) => {
              const el = document.querySelector(selector);
              return el ? el.textContent.trim() : '';
            };

            // Extract variants (flavors, sizes, etc.)
            const extractVariants = () => {
              const variants = [];
              
              // Method 1: Look for Shopify product JSON in various script patterns
              const scriptSelectors = [
                'script[type="application/json"]',
                'script[type="application/ld+json"]',
                'script:not([src]):not([type])',
                'script[data-product-json]',
                'script#product-json',
                'script.product-json'
              ];
              
              for (const selector of scriptSelectors) {
                const scripts = document.querySelectorAll(selector);
                for (const script of scripts) {
                  try {
                    const content = script.textContent || script.innerHTML;
                    if (!content.trim()) continue;
                    
                    // Try parsing as JSON
                    const data = JSON.parse(content);
                    
                    // Check different JSON structures
                    let productData = null;
                    if (data.product && data.product.variants) {
                      productData = data.product;
                    } else if (data.variants) {
                      productData = data;
                    } else if (data['@type'] === 'Product' && data.offers) {
                      // JSON-LD format
                      continue; // Skip for now, focus on Shopify format
                    }
                    
                    if (productData && productData.variants) {
                      console.log(`Found ${productData.variants.length} variants in JSON data`);
                      productData.variants.forEach(variant => {
                        variants.push({
                          id: variant.id,
                          title: variant.title,
                          price: variant.price ? `$${(variant.price / 100).toFixed(2)}` : null,
                          compareAtPrice: variant.compare_at_price ? `$${(variant.compare_at_price / 100).toFixed(2)}` : null,
                          available: variant.available,
                          option1: variant.option1,
                          option2: variant.option2,
                          option3: variant.option3,
                          sku: variant.sku
                        });
                      });
                      if (variants.length > 0) {
                        console.log(`Successfully extracted ${variants.length} variants from JSON`);
                        return variants;
                      }
                    }
                  } catch (e) {
                    // Continue to next script
                  }
                }
              }
              
              // Method 2: Try to access global Shopify variables
              const globalVariableNames = [
                'meta.product',
                'ShopifyAnalytics.meta.product', 
                'theme.product',
                'product',
                '__PRODUCT_DATA__'
              ];
              
              for (const varName of globalVariableNames) {
                try {
                  const productData = eval(varName);
                  if (productData && productData.variants) {
                    console.log(`Found ${productData.variants.length} variants in global variable: ${varName}`);
                    productData.variants.forEach(variant => {
                      variants.push({
                        id: variant.id,
                        title: variant.title,
                        price: variant.price ? `$${(variant.price / 100).toFixed(2)}` : null,
                        compareAtPrice: variant.compare_at_price ? `$${(variant.compare_at_price / 100).toFixed(2)}` : null,
                        available: variant.available,
                        option1: variant.option1,
                        option2: variant.option2,
                        option3: variant.option3,
                        sku: variant.sku
                      });
                    });
                    if (variants.length > 0) {
                      console.log(`Successfully extracted ${variants.length} variants from ${varName}`);
                      return variants;
                    }
                  }
                } catch (e) {
                  // Continue to next variable
                }
              }

              // Method 3: Try Shopify product API endpoint
              const productHandle = window.location.pathname.match(/\/products\/([^\/]+)/);
              if (productHandle) {
                try {
                  const productJsonUrl = `/products/${productHandle[1]}.js`;
                  console.log(`Trying Shopify API endpoint: ${productJsonUrl}`);
                  
                  // Note: This would normally require fetch, but in page evaluation context
                  // we'll try to access it via existing page data first
                  
                  // Look for existing product JSON data that might be loaded
                  if (window.productData || window.product || window.meta?.product) {
                    const shopifyProduct = window.productData || window.product || window.meta?.product;
                    if (shopifyProduct && shopifyProduct.variants) {
                      console.log(`Found ${shopifyProduct.variants.length} variants in Shopify product data`);
                      shopifyProduct.variants.forEach(variant => {
                        variants.push({
                          id: variant.id,
                          title: variant.title,
                          price: variant.price ? `$${(variant.price / 100).toFixed(2)}` : null,
                          compareAtPrice: variant.compare_at_price ? `$${(variant.compare_at_price / 100).toFixed(2)}` : null,
                          available: variant.available,
                          option1: variant.option1,
                          option2: variant.option2,
                          option3: variant.option3,
                          sku: variant.sku
                        });
                      });
                      if (variants.length > 0) {
                        console.log(`Successfully extracted ${variants.length} variants from Shopify product data`);
                        return variants;
                      }
                    }
                  }
                } catch (e) {
                  console.log(`Error accessing Shopify product data: ${e.message}`);
                }
              }

              // Try to extract from __PRODUCT_DATA__ or similar global variables
              if (window.__PRODUCT_DATA__ || window.product) {
                const productData = window.__PRODUCT_DATA__ || window.product;
                if (productData && productData.variants) {
                  productData.variants.forEach(variant => {
                    variants.push({
                      id: variant.id,
                      title: variant.title,
                      price: variant.price ? `$${(variant.price / 100).toFixed(2)}` : null,
                      compareAtPrice: variant.compare_at_price ? `$${(variant.compare_at_price / 100).toFixed(2)}` : null,
                      available: variant.available,
                      option1: variant.option1,
                      option2: variant.option2,
                      option3: variant.option3
                    });
                  });
                  if (variants.length > 0) return variants;
                }
              }

              // Fallback: Look for Shopify variant selectors (DOM-based)
              const variantSelectors = [
                '.product-form__buttons .variant-wrapper',
                '.product-form__variants .variant-selector',
                '.product__variants .variant-input',
                '.variant-selectors .variant-selector',
                '.product-variants .variant-option',
                '.product-form .swatch',
                '.product-form select[name*="variant"]',
                '.product-form select[name*="id"]'
              ];

              for (const selector of variantSelectors) {
                const variantElements = document.querySelectorAll(selector);
                if (variantElements.length > 0) {
                  variantElements.forEach((element, index) => {
                    const title = element.textContent.trim() || 
                                 element.getAttribute('data-variant-title') ||
                                 element.getAttribute('title') ||
                                 element.getAttribute('value') ||
                                 `Variant ${index + 1}`;
                    
                    const price = element.getAttribute('data-variant-price') ||
                                 element.getAttribute('data-price') ||
                                 null;
                                 
                    const comparePrice = element.getAttribute('data-variant-compare-price') ||
                                       element.getAttribute('data-compare-price') ||
                                       null;
                    
                    const available = element.getAttribute('data-variant-available') !== 'false' &&
                                     !element.classList.contains('disabled') &&
                                     !element.hasAttribute('disabled');

                    if (title && title.trim() !== '') {
                      variants.push({
                        id: element.getAttribute('data-variant-id') || 
                            element.getAttribute('value') || 
                            `variant-${index}`,
                        title: title,
                        price: price,
                        compareAtPrice: comparePrice,
                        available: available
                      });
                    }
                  });
                  break;
                }
              }

              // Final fallback: try select options
              if (variants.length === 0) {
                const selectElements = document.querySelectorAll('.product-form select option:not([value=""]):not([disabled])');
                selectElements.forEach((option, index) => {
                  const title = option.textContent.trim();
                  if (title && title !== 'Default Title' && title !== '') {
                    variants.push({
                      id: option.value || `option-${index}`,
                      title: title,
                      price: option.getAttribute('data-price') || null,
                      compareAtPrice: option.getAttribute('data-compare-price') || null,
                      available: !option.disabled
                    });
                  }
                });
              }

              return variants;
            };

            // Extract subscription pricing
            const getSubscriptionPrice = () => {
              const subPriceSelectors = [
                '.subscription-price',
                '.recurring-price',
                '[data-subscription-price]',
                '.product-form__price .subscription',
                '.price--subscription',
                '.price .subscription-saving'
              ];

              for (const selector of subPriceSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                  return element.textContent.trim();
                }
              }
              return null;
            };

            // Get original price if on sale
            const getOriginalPrice = () => {
              const originalPriceSelectors = [
                '.price--compare',
                '.was-price',
                '.compare-price',
                '.original-price',
                '.price--original',
                '.price .compare-at-price'
              ];

              for (const selector of originalPriceSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                  return element.textContent.trim();
                }
              }
              return null;
            };

            // Extract all product images
            const extractImages = () => {
              const images = [];
              const imageSelectors = [
                '.product__media img',
                '.product-media img',
                '.product__photos img',
                '.product-images img',
                '.product-gallery img'
              ];

              for (const selector of imageSelectors) {
                const imgElements = document.querySelectorAll(selector);
                imgElements.forEach(img => {
                  const src = img.src || img.dataset.src || img.dataset.srcset;
                  if (src && !images.includes(src)) {
                    images.push(src);
                  }
                });
                if (images.length > 0) break;
              }
              
              return images;
            };

            // Get product handle/slug from URL
            const getProductHandle = () => {
              const url = window.location.pathname;
              const match = url.match(/\/products\/([^\/]+)/);
              return match ? match[1] : null;
            };

            // Extract vendor/brand info
            const getVendor = () => {
              const vendorSelectors = [
                '.product__vendor',
                '.product-vendor',
                '[data-vendor]',
                '.brand-name'
              ];

              for (const selector of vendorSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                  return element.textContent.trim();
                }
              }
              return 'Momentous'; // Default vendor
            };

            // Extract product type
            const getProductType = () => {
              const typeSelectors = [
                '.product__type',
                '.product-type',
                '[data-product-type]',
                '.collection-title'
              ];

              for (const selector of typeSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                  return element.textContent.trim();
                }
              }
              return 'Product';
            };

            // Extract tags
            const getTags = () => {
              const tags = [];
              const tagSelectors = [
                '.product__tags .tag',
                '.product-tags .tag',
                '[data-product-tags]',
                '.tags .tag'
              ];

              for (const selector of tagSelectors) {
                const tagElements = document.querySelectorAll(selector);
                if (tagElements.length > 0) {
                  tagElements.forEach(tag => {
                    const tagText = tag.textContent.trim();
                    if (tagText && !tags.includes(tagText)) {
                      tags.push(tagText);
                    }
                  });
                  break;
                }
              }

              return tags;
            };

            return {
              handle: getProductHandle(),
              fullDescription: getTextContent('.product__description, .product-description, .rte'),
              ingredients: getTextContent('.ingredients, .product__ingredients, [data-ingredients]'),
              benefits: getTextContent('.benefits, .product__benefits, [data-benefits]'),
              usage: getTextContent('.usage, .directions, .product__usage'),
              category: getTextContent('.product__type, .breadcrumb, .collection-title'),
              rating: getTextContent('.reviews-rating, .product-rating, [data-rating]'),
              reviews_count: getTextContent('.reviews-count, .review-count, [data-reviews]'),
              availability: getTextContent('.product-availability, .stock-status, [data-availability]'),
              variants: extractVariants(),
              subscriptionPrice: getSubscriptionPrice(),
              originalPrice: getOriginalPrice(),
              images: extractImages(),
              vendor: getVendor(),
              productType: getProductType(),
              tags: getTags(),
              tagsString: getTags().join(', ')
            };
          });

          // Use Shopify API variants if available, otherwise use scraped variants
          if (shopifyVariants) {
            details.variants = shopifyVariants;
            console.log(`Using ${shopifyVariants.length} variants from Shopify API`);
          }
          
          Object.assign(this.products[i], details);
          
          // Small delay to be respectful
          await this.page.waitForTimeout(1000);
          
        } catch (error) {
          console.log(`⚠️  Could not scrape details for ${product.title}: ${error.message}`);
        }
      }
    }
  }

  saveProducts() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }

    // Check if latest.json exists and preserve custom data
    const latestFile = path.join(dataDir, 'latest.json');
    let existingProducts = [];
    
    if (fs.existsSync(latestFile)) {
      try {
        existingProducts = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
        console.log(`🔄 Found existing data for ${existingProducts.length} products, preserving custom assignments...`);
      } catch (error) {
        console.log('⚠️ Could not read existing data, creating fresh file');
      }
    }

    // Merge scraped data with existing custom data
    const mergedProducts = this.products.map(scrapedProduct => {
      const existing = existingProducts.find(p => 
        p.handle === scrapedProduct.handle || 
        p.title === scrapedProduct.title
      );

      if (existing) {
        // Preserve all custom data while updating scraped fields
        return {
          ...scrapedProduct, // New scraped data (price, availability, etc.)
          // Preserve custom assignments
          categories: existing.categories || scrapedProduct.categories,
          goals: existing.goals || scrapedProduct.goals,
          flavors: existing.flavors || scrapedProduct.flavors,
          skus: existing.skus || scrapedProduct.skus,
          euNotificationStatus: existing.euNotificationStatus,
          hsCode: existing.hsCode,
          hsCodeDescription: existing.hsCodeDescription,
          dutyRate: existing.dutyRate,
          // Preserve legacy fields for compatibility
          category: existing.category || scrapedProduct.category,
          primaryGoal: existing.primaryGoal || scrapedProduct.primaryGoal
        };
      }
      
      return scrapedProduct; // New product, use scraped data as-is
    });

    const filename = path.join(dataDir, `momentous_products_${Date.now()}.json`);
    fs.writeFileSync(filename, JSON.stringify(this.products, null, 2));
    
    // Save merged data as latest.json for the web interface
    fs.writeFileSync(latestFile, JSON.stringify(mergedProducts, null, 2));
    
    console.log(`💾 Saved ${this.products.length} products to ${filename}`);
    console.log(`🔒 Preserved custom data for ${mergedProducts.filter(p => p.categories || p.goals || p.hsCode).length} products`);
    console.log(`📊 Product analysis available at: http://localhost:3000`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Run scraper if called directly
if (require.main === module) {
  (async () => {
    const scraper = new MomentusScraper();
    
    try {
      await scraper.init();
      await scraper.scrapeProducts();
    } catch (error) {
      console.error('❌ Scraping failed:', error);
    } finally {
      await scraper.close();
    }
  })();
}

module.exports = MomentusScraper;