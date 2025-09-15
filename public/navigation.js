class MomentousApp {
    constructor() {
        this.currentPage = 'products';
        this.analytics = {};
        this.products = [];
        this.categories = [];
        this.goals = [];
        
        this.initializeApp();
    }

    // Helper method to make authenticated API calls
    async authFetch(url, options = {}) {
        const authHeaders = window.authManager ? window.authManager.getAuthHeaders() : {};
        
        const fetchOptions = {
            ...options,
            headers: {
                ...authHeaders,
                ...options.headers
            }
        };
        
        return fetch(url, fetchOptions);
    }

    async initializeApp() {
        try {
            console.log('Starting app initialization...');
            await this.loadData();
            await this.showPage('products');
            this.initializeEventListeners();
            console.log('App initialization complete');
        } catch (error) {
            console.error('App initialization failed:', error);
        }
    }

    initializeEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadData());
    }

    async loadData() {
        try {
            console.log('Loading data from APIs...');
            // Load products and analytics
            const [productsResponse, analyticsResponse] = await Promise.all([
                this.authFetch('/api/products'),
                this.authFetch('/api/analytics')
            ]);

            if (!productsResponse.ok || !analyticsResponse.ok) {
                throw new Error(`API request failed: products ${productsResponse.status}, analytics ${analyticsResponse.status}`);
            }

            const productsData = await productsResponse.json();
            this.analytics = await analyticsResponse.json();
            this.products = productsData.products;
            
            console.log(`Loaded ${this.products.length} products from API`);
            
            this.updateDashboard();
            await this.loadCategories();
            await this.loadGoals();
            this.updateLastUpdated(productsData.scraped_at);
            
            // If on products page, initialize the products interface
            if (this.currentPage === 'products') {
                console.log('Current page is products, initializing products page...');
                this.initializeProductsPage();
            }
            
        } catch (error) {
            console.error('Error loading data:', error);
            // Show error state in products if that's the current page
            if (this.currentPage === 'products') {
                this.showProductsError(error.message);
            }
        }
    }

    showProductsError(errorMessage) {
        const loadingState = document.getElementById('loadingState');
        const noDataState = document.getElementById('noDataState');
        const productsGrid = document.getElementById('productsGrid');
        
        if (loadingState) loadingState.classList.add('hidden');
        if (productsGrid) productsGrid.innerHTML = '';
        
        if (noDataState) {
            const button = noDataState.querySelector('button');
            const message = noDataState.querySelector('p');
            if (message) {
                message.textContent = `Error loading products: ${errorMessage}`;
            }
            if (button) {
                button.onclick = () => this.loadData();
                button.innerHTML = '<i class="fas fa-sync mr-2"></i>Retry';
            }
            noDataState.classList.remove('hidden');
        }
    }

    async showPage(pageId, clickedElement = null) {
        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            item.classList.remove('border-blue-500');
        });
        
        if (clickedElement) {
            const navItem = clickedElement.closest('.nav-item');
            if (navItem) {
                navItem.classList.add('active');
                navItem.classList.add('border-blue-500');
            }
        }

        // Hide all pages
        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.add('hidden');
        });

        // Show selected page
        const targetPage = document.getElementById(`${pageId}-page`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
            this.currentPage = pageId;

            // Initialize page-specific functionality
            if (pageId === 'products') {
                console.log('Switching to products page, initializing...');
                setTimeout(() => this.initializeProductsPage(), 100);
            } else if (pageId === 'dashboard') {
                this.initializeDashboard();
            } else if (pageId === 'settings') {
                console.log('Loading Settings page...');
                await this.initializeSettings();
            } else if (pageId === 'price-analysis') {
                this.initializePriceAnalysis();
            }
        }
    }

    updateDashboard() {
        document.getElementById('totalProducts').textContent = this.analytics.total_products || 0;
        document.getElementById('avgPrice').textContent = (this.analytics.price_stats && this.analytics.price_stats.average !== null && !isNaN(this.analytics.price_stats.average)) ? 
            `$${this.analytics.price_stats.average.toFixed(2)}` : '$0';
        document.getElementById('totalCategories').textContent = 
            Object.keys(this.analytics.categories || {}).length;
        document.getElementById('totalGoals').textContent = 
            Object.keys(this.analytics.goals || {}).length;
    }

    initializeDashboard() {
        this.createCharts();
    }

    createCharts() {
        this.createPriceChart();
        this.createCategoryChart();
    }

    createPriceChart() {
        const ctx = document.getElementById('priceChart');
        if (!ctx) return;
        
        const priceRanges = this.analytics.price_ranges || {};
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(priceRanges),
                datasets: [{
                    label: 'Number of Products',
                    data: Object.values(priceRanges),
                    backgroundColor: ['rgba(59, 130, 246, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(245, 101, 101, 0.8)', 'rgba(139, 92, 246, 0.8)']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }

    createCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;
        
        const categories = this.analytics.categories || {};
        const sortedCategories = Object.entries(categories).sort(([,a], [,b]) => b - a).slice(0, 8);

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sortedCategories.map(([name]) => name || 'Other'),
                datasets: [{
                    data: sortedCategories.map(([, count]) => count),
                    backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    async initializeProductsPage() {
        console.log('Initializing products page...');
        console.log('Products already loaded:', this.products.length);
        
        // Wait for elements to be available
        const waitForElement = (id, timeout = 5000) => {
            return new Promise((resolve, reject) => {
                const checkElement = () => {
                    const element = document.getElementById(id);
                    if (element) {
                        resolve(element);
                    } else if (timeout <= 0) {
                        reject(new Error(`Element ${id} not found after timeout`));
                    } else {
                        timeout -= 100;
                        setTimeout(checkElement, 100);
                    }
                };
                checkElement();
            });
        };
        
        try {
            // Wait for key elements to be available
            const productsGrid = await waitForElement('productsGrid');
            const searchInput = await waitForElement('searchInput');
            console.log('Required elements found:', { productsGrid: !!productsGrid, searchInput: !!searchInput });
            
            // If we already have products loaded, use them; otherwise load fresh
            if (this.products && this.products.length > 0 && this.analytics) {
                console.log('Using already loaded products and analytics');
                this.renderProducts(this.products);
                this.updateProductAnalytics(this.analytics);
                this.setupFilters(this.analytics, this.products);
                
                // Hide loading, show products
                const loadingState = document.getElementById('loadingState');
                if (loadingState) loadingState.classList.add('hidden');
            } else {
                console.log('No products loaded yet, loading fresh...');
                await this.loadProductsDirectly();
            }
        } catch (error) {
            console.error('Failed to initialize products page:', error);
            this.showProductsError(error.message);
        }
    }

    async loadProductsDirectly() {
        try {
            console.log('Loading products directly...');
            
            // Show loading state
            const loadingState = document.getElementById('loadingState');
            const noDataState = document.getElementById('noDataState');
            const productsGrid = document.getElementById('productsGrid');
            
            if (loadingState) loadingState.classList.remove('hidden');
            if (noDataState) noDataState.classList.add('hidden');
            if (productsGrid) productsGrid.innerHTML = '';
            
            // Fetch data
            const [productsResponse, analyticsResponse] = await Promise.all([
                this.authFetch('/api/products'),
                this.authFetch('/api/analytics')
            ]);
            
            if (!productsResponse.ok || !analyticsResponse.ok) {
                throw new Error('Failed to load data');
            }
            
            const productsData = await productsResponse.json();
            const analyticsData = await analyticsResponse.json();
            
            console.log('Products loaded:', productsData.products.length);
            
            // Store products data for editing functionality
            this.products = productsData.products;
            this.analytics = analyticsData;
            
            // Hide loading, show products
            if (loadingState) loadingState.classList.add('hidden');
            
            // Update analytics display
            this.updateProductAnalytics(analyticsData);
            
            // Render products
            this.renderProducts(productsData.products);
            
            // Setup filters
            this.setupFilters(analyticsData, productsData.products);
            
        } catch (error) {
            console.error('Error loading products directly:', error);
            
            // Hide loading, show error
            const loadingState = document.getElementById('loadingState');
            const noDataState = document.getElementById('noDataState');
            
            if (loadingState) loadingState.classList.add('hidden');
            if (noDataState) {
                // Update the no data message to show the actual error
                const button = noDataState.querySelector('button');
                const message = noDataState.querySelector('p');
                if (message) {
                    message.textContent = `Error loading products: ${error.message}. Try clicking refresh data.`;
                }
                if (button) {
                    button.onclick = () => this.loadProductsDirectly();
                    button.innerHTML = '<i class="fas fa-sync mr-2"></i>Retry';
                }
                noDataState.classList.remove('hidden');
            }
        }
    }

    updateProductAnalytics(analytics) {
        const totalProducts = document.getElementById('totalProducts');
        const avgPrice = document.getElementById('avgPrice');
        const totalCategories = document.getElementById('totalCategories');
        const totalGoals = document.getElementById('totalGoals');
        const productCount = document.getElementById('productCount');
        
        if (totalProducts) totalProducts.textContent = analytics.total_products || 0;
        if (avgPrice) avgPrice.textContent = (analytics.price_stats && analytics.price_stats.average !== null && !isNaN(analytics.price_stats.average)) ? 
            `$${analytics.price_stats.average.toFixed(2)}` : '$0';
        if (totalCategories) totalCategories.textContent = Object.keys(analytics.categories || {}).length;
        if (totalGoals) totalGoals.textContent = Object.keys(analytics.goals || {}).length;
        if (productCount) productCount.textContent = analytics.total_products || 0;
    }

    // HS Code analysis system
    analyzeHsCode(product) {
        const title = (product.title || '').toLowerCase();
        const description = (product.description || '').toLowerCase();
        const fullDescription = (product.fullDescription || '').toLowerCase();
        const categories = (product.categories || []).map(c => c.toLowerCase());
        
        const content = `${title} ${description} ${fullDescription} ${categories.join(' ')}`;
        
        // Common supplement HS codes based on product analysis
        const hsCodeMap = [
            // Protein supplements
            { keywords: ['protein', 'whey', 'casein', 'isolate', 'plant protein', 'vegan protein'], code: '2106.90.99', description: 'Protein supplements' },
            
            // Vitamins & minerals
            { keywords: ['vitamin', 'mineral', 'multivitamin', 'b12', 'b-12', 'vitamin d', 'magnesium', 'zinc', 'iron', 'calcium'], code: '2936.90.00', description: 'Vitamin and mineral supplements' },
            
            // Omega-3 and fish oil
            { keywords: ['omega-3', 'omega 3', 'fish oil', 'algae oil', 'dha', 'epa', 'fatty acid'], code: '1504.20.00', description: 'Fish or marine mammal fats and oils' },
            
            // Creatine
            { keywords: ['creatine', 'creapure'], code: '2925.29.00', description: 'Creatine and derivatives' },
            
            // Amino acids
            { keywords: ['amino acid', 'glutamine', 'leucine', 'isoleucine', 'valine', 'bcaa', 'arginine', 'lysine'], code: '2922.49.00', description: 'Amino acids and derivatives' },
            
            // Pre-workout and energy
            { keywords: ['pre-workout', 'pre workout', 'energy', 'caffeine', 'stimulant', 'nitric oxide', 'citrulline'], code: '2106.90.99', description: 'Energy and pre-workout supplements' },
            
            // Probiotics
            { keywords: ['probiotic', 'lactobacillus', 'bifidobacterium', 'digestive', 'gut health'], code: '3002.90.50', description: 'Probiotic supplements' },
            
            // Collagen
            { keywords: ['collagen', 'peptides', 'hydrolyzed collagen'], code: '3503.00.00', description: 'Collagen supplements' },
            
            // Sleep and recovery
            { keywords: ['melatonin', 'sleep', 'recovery', 'magnesium glycinate', 'l-theanine'], code: '2932.99.00', description: 'Sleep and recovery supplements' },
            
            // Nootropics and cognitive
            { keywords: ['nootropic', 'cognitive', 'brain', 'focus', 'memory', 'lion\'s mane', 'bacopa'], code: '1211.90.00', description: 'Cognitive enhancement supplements' },
            
            // General dietary supplements (fallback)
            { keywords: ['supplement', 'capsule', 'tablet', 'powder', 'dietary'], code: '2106.90.99', description: 'Other food preparations (dietary supplements)' }
        ];
        
        // Find matching HS code
        for (const mapping of hsCodeMap) {
            if (mapping.keywords.some(keyword => content.includes(keyword))) {
                return {
                    code: mapping.code,
                    description: mapping.description,
                    confidence: 'suggested'
                };
            }
        }
        
        // Default fallback for dietary supplements
        return {
            code: '2106.90.99',
            description: 'Other food preparations (dietary supplements)',
            confidence: 'default'
        };
    }

    renderProducts(products) {
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) return;
        
        productsGrid.innerHTML = products.map((product, index) => {
            const hasActiveFlavorWithSku = this.hasAnyFlavorWithSku(product);
            const isNotAllowedInEU = product.euAllowed === 'no' || product.euAllowed === false;
            
            let cardClasses = 'bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200 flex flex-col h-full';
            
            if (isNotAllowedInEU) {
                cardClasses += ' opacity-50 border-2 border-red-300 bg-red-50';
            } else if (!hasActiveFlavorWithSku) {
                cardClasses += ' opacity-60 border-2 border-dashed border-gray-300';
            }
            
            return `
            <div class="${cardClasses}">
                <div class="aspect-square bg-gray-100 rounded-t-lg overflow-hidden">
                    <img src="${product.image}" alt="${product.title}" 
                         class="w-full h-full object-cover" loading="lazy" 
                         onerror="this.style.display='none'">
                </div>
                <div class="p-4 flex flex-col flex-1">
                    <h4 class="font-semibold text-gray-900 mb-2 line-clamp-2">${product.title}</h4>
                    ${isNotAllowedInEU ? `
                    <div class="mb-2">
                        <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                            <i class="fas fa-ban mr-1"></i>Not Available in EU
                        </span>
                    </div>
                    ` : ''}
                    ${product.clubnenoRegularPrice || product.clubnenoSubscriptionPrice ? `
                    <div class="mb-3">
                        <p class="text-xs text-gray-600 mb-1">
                            <i class="fas fa-euro-sign mr-1"></i><strong>Clubneno price:</strong>
                        </p>
                        <div class="flex items-center space-x-2">
                            ${product.clubnenoRegularPrice ? `
                                <span class="text-lg font-bold text-orange-600 flex items-center">
                                    <i class="fas fa-euro-sign mr-1"></i>${product.clubnenoRegularPrice}
                                </span>
                            ` : ''}
                            ${product.clubnenoSubscriptionPrice ? `
                                <span class="text-sm bg-orange-100 text-orange-800 px-2 py-1 rounded-full flex items-center">
                                    Subscribe: <i class="fas fa-euro-sign mx-1 text-xs"></i>${product.clubnenoSubscriptionPrice}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="mb-3">
                        <p class="text-xs text-gray-600 mb-1">
                            <i class="fas fa-dollar-sign mr-1"></i><strong>Momentous price in US:</strong>
                        </p>
                        <div class="flex flex-wrap gap-2">
                            <span class="text-sm font-bold text-green-600">${product.price}</span>
                            ${product.subscriptionPrice ? `
                                <span class="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                    Subscribe: ${product.subscriptionPrice}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${product.nutraceuticalsRegularPrice || product.nutraceuticalsSubscriptionPrice ? `
                    <div class="mb-3">
                        <p class="text-xs text-gray-600 mb-1">
                            <i class="fas fa-euro-sign mr-1"></i><strong>Nutraceuticals price:</strong>
                        </p>
                        <div class="flex flex-wrap gap-2">
                            ${product.nutraceuticalsRegularPrice ? `
                                <span class="text-sm font-bold text-purple-600 flex items-center">
                                    <i class="fas fa-euro-sign mr-1 text-xs"></i>${product.nutraceuticalsRegularPrice}
                                </span>
                            ` : ''}
                            ${product.nutraceuticalsSubscriptionPrice ? `
                                <span class="text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded-full flex items-center">
                                    Subscribe: <i class="fas fa-euro-sign mx-1 text-xs"></i>${product.nutraceuticalsSubscriptionPrice}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Divider after Pricing -->
                    <div class="border-t border-gray-200 my-3"></div>
                    
                    <div class="flex-1">
                    
                    <!-- Product Details -->
                    ${product.size || product.servings || product.intakeFrequency || product.reorderPeriod ? `
                    <div class="mb-3">
                        <div class="grid grid-cols-2 gap-2">
                            <!-- Column 1: Size & Servings -->
                            <div class="space-y-1">
                                ${product.size ? `
                                    <div class="flex items-center space-x-2">
                                        <i class="fas fa-ruler-combined text-blue-600 text-xs"></i>
                                        <span class="text-xs text-gray-600 font-medium">Size:</span>
                                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">${product.size}</span>
                                    </div>
                                ` : ''}
                                ${product.servings ? `
                                    <div class="flex items-center space-x-2">
                                        <i class="fas fa-calculator text-green-600 text-xs"></i>
                                        <span class="text-xs text-gray-600 font-medium">Servings:</span>
                                        <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">${product.servings}</span>
                                    </div>
                                ` : ''}
                            </div>
                            
                            <!-- Column 2: Intake & Reorder -->
                            <div class="space-y-1">
                                ${product.intakeFrequency ? `
                                    <div class="flex items-center space-x-2">
                                        <i class="fas fa-pills text-orange-600 text-xs"></i>
                                        <span class="text-xs text-gray-600 font-medium">Intake:</span>
                                        <span class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">${product.intakeFrequency}</span>
                                    </div>
                                ` : ''}
                                ${product.reorderPeriod ? `
                                    <div class="flex items-center space-x-2">
                                        <i class="fas fa-clock text-purple-600 text-xs"></i>
                                        <span class="text-xs text-gray-600 font-medium">Reorder:</span>
                                        <span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">${product.reorderPeriod} days</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Divider after Additional Info -->
                    <div class="border-t border-gray-200 my-3"></div>
                    
                    <!-- Hierarchical Goals & Sub-Goals -->
                    ${this.renderProductGoalsHierarchy(product)}
                    
                    <!-- Divider after Goals -->
                    <div class="border-t border-gray-200 my-3"></div>
                    
                    <!-- Flavors -->
                    ${(product.flavors && product.flavors.length > 0) ? `
                        <div class="mb-3">
                            <p class="text-xs text-orange-600 mb-2">
                                <i class="fas fa-palette mr-1"></i><strong>Flavors:</strong>
                            </p>
                            <div class="flex flex-wrap gap-1">
                                ${product.flavors.map(flavor => 
                                    `<span class="px-2 py-1 text-xs bg-orange-50 text-orange-700 rounded-full">${flavor}</span>`
                                ).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Divider after Flavors -->
                    <div class="border-t border-gray-200 my-3"></div>
                    
                    <!-- Per-Flavor Details -->
                    ${this.renderPerFlavorDetails(product)}
                    
                    
                    </div>
                    
                    <!-- Buttons section - always at bottom -->
                    <div class="p-4 pt-0 mt-auto">
                        <div class="grid grid-cols-2 gap-2">
                            <a href="${product.link}" target="_blank" 
                               class="text-center bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
                                <i class="fas fa-external-link-alt mr-1"></i>View
                            </a>
                            <button onclick="app.editProduct('${(product.handle || product.title).replace(/'/g, "\\'")}', true)" 
                                    class="bg-green-600 text-white py-2 px-3 rounded-md hover:bg-green-700 transition-colors text-sm font-medium">
                                <i class="fas fa-edit mr-1"></i>Edit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    renderVariantSections(variants) {
        const { flavors, sizes } = this.categorizeVariants(variants);
        let html = '';

        // Render flavors section
        if (flavors.length > 0) {
            html += `
                <div class="text-xs text-gray-600 mt-2 mb-2">
                    <p class="mb-1">
                        <i class="fas fa-palette mr-1"></i><strong>Flavors:</strong>
                    </p>
                    <div class="flex flex-wrap gap-1">
                        ${flavors.slice(0, 4).map(flavor => 
                            `<span class="px-2 py-1 text-xs bg-green-50 text-green-700 rounded-full">${flavor}</span>`
                        ).join('')}
                        ${flavors.length > 4 ? 
                            `<span class="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">+${flavors.length - 4} more</span>` 
                            : ''
                        }
                    </div>
                </div>
            `;
        }

        // Render sizes section
        if (sizes.length > 0) {
            html += `
                <div class="text-xs text-gray-600 mt-2">
                    <p class="mb-1">
                        <i class="fas fa-weight mr-1"></i><strong>Sizes:</strong>
                    </p>
                    <div class="flex flex-wrap gap-1">
                        ${sizes.slice(0, 4).map(size => 
                            `<span class="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full">${size}</span>`
                        ).join('')}
                        ${sizes.length > 4 ? 
                            `<span class="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">+${sizes.length - 4} more</span>` 
                            : ''
                        }
                    </div>
                </div>
            `;
        }

        return html;
    }

    categorizeVariants(variants) {
        const flavors = new Set();
        const sizes = new Set();
        
        // If variants have option1, option2, option3 data (from improved scraping)
        const hasOptions = variants.some(v => v.option1 || v.option2 || v.option3);
        
        if (hasOptions) {
            // Use structured options data
            variants.forEach(variant => {
                const options = [variant.option1, variant.option2, variant.option3].filter(Boolean);
                
                options.forEach(option => {
                    if (this.isSize(option)) {
                        sizes.add(option);
                    } else {
                        flavors.add(option);
                    }
                });
            });
        } else {
            // Fallback: analyze variant titles
            variants.forEach(variant => {
                const title = variant.title;
                
                if (this.isSize(title)) {
                    console.log(`Detected size variant: "${title}"`);
                    sizes.add(title);
                } else {
                    console.log(`Detected flavor variant: "${title}"`);
                    flavors.add(title);
                }
            });
        }
        
        console.log(`Categorized variants - Flavors: [${Array.from(flavors).join(', ')}], Sizes: [${Array.from(sizes).join(', ')}]`);
        
        return {
            flavors: Array.from(flavors),
            sizes: Array.from(sizes)
        };
    }

    isSize(text) {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        
        // Size indicators - more comprehensive list
        const sizeKeywords = [
            'serving', 'pack', 'jar', 'bottle', 'container', 'pouch', 'bag',
            'oz', 'lb', 'lbs', 'g', 'grams', 'kg', 'ml', 'l', 'liter', 'liters',
            'capsule', 'capsules', 'tablet', 'tablets', 'pill', 'pills',
            'single', 'travel', 'sample', 'trial', 'mini', 'large', 'xl', 'small',
            'count', 'ct', 'dose', 'doses', 'day', 'days', 'month', 'months', 'week', 'weeks',
            'stick', 'sticks', 'sachet', 'sachets', 'tube', 'tubes'
        ];
        
        // Check for numbers followed by size words (more flexible matching)
        const hasNumber = /\d/.test(lowerText);
        const hasSizeKeyword = sizeKeywords.some(keyword => lowerText.includes(keyword));
        
        // Also check for size-only terms (like "Travel Size", "Large", etc.)
        const sizeOnlyTerms = ['travel', 'mini', 'large', 'small', 'xl', 'trial', 'sample'];
        const hasSizeOnlyTerm = sizeOnlyTerms.some(term => lowerText.includes(term));
        
        return (hasNumber && hasSizeKeyword) || hasSizeOnlyTerm;
    }

    setupFilters(analytics, products) {
        // Populate goal filter (formerly category filter)
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.innerHTML = '<option value="">All Goals</option>' +
                Object.keys(analytics.categories || {}).map(cat => 
                    `<option value="${cat}">${cat}</option>`
                ).join('');
        }
        
        // Populate sub-goal filter (formerly goal filter)
        const goalFilter = document.getElementById('goalFilter');
        if (goalFilter) {
            goalFilter.innerHTML = '<option value="">All Sub-Goals</option>' +
                Object.keys(analytics.goals || {}).map(goal => 
                    `<option value="${goal}">${goal}</option>`
                ).join('');
        }
        
        // Set up filter event listeners
        this.setupFilterEventListeners();
        
        console.log('Filters setup complete');
    }

    setupFilterEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const categoryFilter = document.getElementById('categoryFilter');
        const goalFilter = document.getElementById('goalFilter');
        const euStatusFilter = document.getElementById('euStatusFilter');
        const minPrice = document.getElementById('minPrice');
        const maxPrice = document.getElementById('maxPrice');
        const sortBy = document.getElementById('sortBy');

        if (searchInput) searchInput.addEventListener('input', () => this.applyFilters());
        if (categoryFilter) categoryFilter.addEventListener('change', () => this.applyFilters());
        if (goalFilter) goalFilter.addEventListener('change', () => this.applyFilters());
        if (euStatusFilter) euStatusFilter.addEventListener('change', () => this.applyFilters());
        if (minPrice) minPrice.addEventListener('input', () => this.applyFilters());
        if (maxPrice) maxPrice.addEventListener('input', () => this.applyFilters());
        if (sortBy) sortBy.addEventListener('change', () => this.applyFilters());
    }

    async applyFilters() {
        const search = document.getElementById('searchInput')?.value || '';
        const category = document.getElementById('categoryFilter')?.value || '';
        const goal = document.getElementById('goalFilter')?.value || '';
        const euNotificationStatus = document.getElementById('euStatusFilter')?.value || '';
        const minPrice = document.getElementById('minPrice')?.value || '';
        const maxPrice = document.getElementById('maxPrice')?.value || '';
        const sortBy = document.getElementById('sortBy')?.value || '';

        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (category) params.append('category', category);
        if (goal) params.append('goal', goal);
        if (euNotificationStatus) params.append('euNotificationStatus', euNotificationStatus);
        if (minPrice) params.append('minPrice', minPrice);
        if (maxPrice) params.append('maxPrice', maxPrice);
        if (sortBy) params.append('sortBy', sortBy);

        const url = `/api/products?${params.toString()}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            this.renderProducts(data.products);
            
            // Update product count
            const productCount = document.getElementById('productCount');
            if (productCount) productCount.textContent = data.products.length;
        } catch (error) {
            console.error('Error applying filters:', error);
        }
    }

    async loadCategories() {
        try {
            const response = await this.authFetch('/api/categories');
            if (response.ok) {
                const data = await response.json();
                this.categories = data.categories || [];
            } else {
                console.error('Failed to load categories');
                this.categories = Object.keys(this.analytics.categories || {});
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.categories = Object.keys(this.analytics.categories || {});
        }
    }

    async loadGoals() {
        try {
            const response = await this.authFetch('/api/goals');
            if (response.ok) {
                const data = await response.json();
                this.goals = data.goals || [];
            } else {
                console.error('Failed to load goals');
                this.goals = Object.keys(this.analytics.goals || {});
            }
        } catch (error) {
            console.error('Error loading goals:', error);
            this.goals = Object.keys(this.analytics.goals || {});
        }
    }

    async initializeSettings() {
        try {
            console.log('Initializing Settings...');
            await this.loadCategories();
            console.log('Categories loaded:', this.categories);
            await this.loadGoals();
            console.log('Goals loaded:', this.goals);
            
            // Check if we need to suggest importing data from products
            this.checkForDataImportSuggestion();
            
            this.renderCategoriesList();
            this.renderGoalsList();
            await this.renderFlavorsList();
            console.log('Settings initialization complete');
        } catch (error) {
            console.error('Error initializing settings:', error);
        }
    }

    checkForDataImportSuggestion() {
        if (!this.analytics) return;
        
        // Check if there are goals/sub-goals in product data that aren't in Settings
        const productCategories = Object.keys(this.analytics.categories || {});
        const productGoals = Object.keys(this.analytics.goals || {});
        
        const missingCategories = productCategories.filter(cat => !this.categories.includes(cat));
        const missingGoals = productGoals.filter(goal => !this.goals.includes(goal));
        
        if (missingCategories.length > 0 || missingGoals.length > 0) {
            this.showImportSuggestion(missingCategories, missingGoals);
        }
    }

    showImportSuggestion(missingCategories, missingGoals) {
        // Add import suggestion to the top of settings page
        const settingsContainer = document.querySelector('#settings .p-6');
        if (!settingsContainer) return;
        
        const suggestionDiv = document.createElement('div');
        suggestionDiv.className = 'mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg';
        suggestionDiv.innerHTML = `
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <i class="fas fa-info-circle text-blue-600 text-lg mt-0.5"></i>
                </div>
                <div class="ml-3 flex-1">
                    <h4 class="text-sm font-medium text-blue-900 mb-2">Import Existing Data</h4>
                    <p class="text-sm text-blue-700 mb-3">
                        Found ${missingGoals.length} sub-goals and ${missingCategories.length} goals assigned to products that aren't in your Settings lists.
                    </p>
                    <div class="flex space-x-3">
                        <button onclick="app.importExistingData()" 
                                class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                            <i class="fas fa-download mr-2"></i>Import All
                        </button>
                        <button onclick="this.closest('div').remove()" 
                                class="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors">
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        settingsContainer.insertBefore(suggestionDiv, settingsContainer.firstChild);
    }

    async importExistingData() {
        try {
            if (!this.analytics) return;
            
            const productCategories = Object.keys(this.analytics.categories || {});
            const productGoals = Object.keys(this.analytics.goals || {});
            
            // Import categories (now "Goals")
            for (const category of productCategories) {
                if (!this.categories.includes(category)) {
                    await this.addCategoryToStorage(category);
                }
            }
            
            // Import goals (now "Sub-Goals")  
            for (const goal of productGoals) {
                if (!this.goals.includes(goal)) {
                    await this.addGoalToStorage(goal);
                }
            }
            
            // Reload data and refresh UI
            await this.loadCategories();
            await this.loadGoals();
            this.renderCategoriesList();
            this.renderGoalsList();
            
            // Remove suggestion banner
            const suggestion = document.querySelector('.bg-blue-50');
            if (suggestion) suggestion.remove();
            
            alert('Successfully imported existing goals and sub-goals from products!');
            
        } catch (error) {
            console.error('Error importing data:', error);
            alert('Error importing data. Check console for details.');
        }
    }

    async addCategoryToStorage(categoryName) {
        const response = await this.authFetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: categoryName })
        });
        return response.ok;
    }

    async addGoalToStorage(goalName) {
        const response = await this.authFetch('/api/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: goalName })
        });
        return response.ok;
    }

    // Hierarchical UI Methods
    toggleCategoryExpand(categoryId) {
        const container = document.getElementById(`subcategories-${categoryId}`);
        const icon = document.getElementById(`category-icon-${categoryId}`);
        
        if (container && icon) {
            if (container.classList.contains('hidden')) {
                container.classList.remove('hidden');
                icon.classList.add('rotate-90');
            } else {
                container.classList.add('hidden');
                icon.classList.remove('rotate-90');
            }
        }
    }

    toggleGoalExpand(goalId) {
        const container = document.getElementById(`subgoals-${goalId}`);
        const icon = document.getElementById(`goal-icon-${goalId}`);
        
        if (container && icon) {
            if (container.classList.contains('hidden')) {
                container.classList.remove('hidden');
                icon.classList.add('rotate-90');
            } else {
                container.classList.add('hidden');
                icon.classList.remove('rotate-90');
            }
        }
    }

    async addSubCategory(parentId) {
        const subCategoryName = prompt('Enter sub-category name:');
        if (!subCategoryName?.trim()) return;

        try {
            const response = await this.authFetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: subCategoryName.trim(),
                    parentId: parentId,
                    isSubCategory: true
                })
            });

            if (response.ok) {
                await this.loadCategories();
                this.renderCategoriesList();
                alert('Sub-category added successfully!');
            } else {
                const error = await response.json();
                alert('Error: ' + error.error);
            }
        } catch (error) {
            console.error('Error adding sub-category:', error);
            alert('Failed to add sub-category');
        }
    }

    async addSubGoal(parentId) {
        const subGoalName = prompt('Enter sub-goal name:');
        if (!subGoalName?.trim()) return;

        try {
            const response = await this.authFetch('/api/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: subGoalName.trim(),
                    parentId: parentId,
                    isSubGoal: true
                })
            });

            if (response.ok) {
                await this.loadGoals();
                this.renderGoalsHierarchy();
                alert('Sub-goal added successfully!');
            } else {
                const error = await response.json();
                alert('Error: ' + error.error);
            }
        } catch (error) {
            console.error('Error adding sub-goal:', error);
            alert('Failed to add sub-goal');
        }
    }

    async addParentGoal() {
        const goalName = prompt('Enter goal name:');
        if (!goalName?.trim()) return;

        try {
            const response = await this.authFetch('/api/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: goalName.trim(),
                    isSubGoal: false
                })
            });

            if (response.ok) {
                await this.loadGoals();
                this.renderGoalsHierarchy();
                alert('Goal added successfully!');
            } else {
                const error = await response.json();
                alert('Error: ' + error.error);
            }
        } catch (error) {
            console.error('Error adding goal:', error);
            alert('Failed to add goal');
        }
    }

    // Unified Goals Hierarchy Rendering
    renderGoalsHierarchy() {
        const hierarchyContainer = document.getElementById('goalsHierarchy');
        if (!hierarchyContainer) return;

        if (!this.goals || this.goals.length === 0) {
            hierarchyContainer.innerHTML = '<p class="text-gray-500 text-sm italic">No goals added yet</p>';
            return;
        }

        hierarchyContainer.innerHTML = this.goals.map(goal => `
            <div class="border border-gray-200 rounded-lg bg-white shadow-sm">
                <!-- Parent Goal -->
                <div class="flex items-center justify-between p-4 bg-blue-50 rounded-t-lg">
                    <div class="flex items-center space-x-3">
                        <button onclick="app.toggleGoalExpand('${goal.id}')" class="text-blue-600 hover:text-blue-800 transition-colors">
                            <i id="goal-icon-${goal.id}" class="fas fa-chevron-right transition-transform"></i>
                        </button>
                        <div>
                            <span class="font-semibold text-lg text-blue-900">${goal.name}</span>
                            <div class="text-sm text-blue-600">${goal.subGoals?.length || 0} sub-goals</div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="app.addSubGoal('${goal.id}')" class="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors" title="Add Sub-Goal">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button onclick="app.deleteGoal('${goal.name}')" class="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors" title="Delete Goal">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Sub-Goals -->
                <div id="subgoals-${goal.id}" class="hidden">
                    ${(goal.subGoals || []).map(subGoal => `
                        <div class="flex items-center justify-between px-4 py-3 border-t border-gray-100 hover:bg-gray-50 transition-colors">
                            <div class="flex items-center space-x-3 pl-6">
                                <i class="fas fa-arrow-right text-gray-400 text-xs"></i>
                                <span class="text-gray-800">${subGoal}</span>
                                <span class="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">${(this.analytics.goals && this.analytics.goals[subGoal]) || 0} products</span>
                            </div>
                            <button onclick="app.deleteGoal('${subGoal}')" class="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors text-sm">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `).join('')}
                    ${(goal.subGoals || []).length === 0 ? 
                        '<div class="px-4 py-3 pl-12 text-gray-500 text-sm italic border-t border-gray-100">No sub-goals yet</div>' 
                        : ''}
                </div>
            </div>
        `).join('');
    }

    // Legacy methods for backward compatibility - now redirect to unified hierarchy
    renderCategoriesList() {
        this.renderGoalsHierarchy();
    }

    renderGoalsList() {
        this.renderGoalsHierarchy();
    }

    // Modal helper methods
    hasSubGoalSelected(product, goal) {
        const productGoals = product.goals || [];
        return goal.subGoals && goal.subGoals.some(subGoal => productGoals.includes(subGoal));
    }

    toggleGoalSelection(goalId) {
        const container = document.getElementById(`subgoals-container-${goalId}`);
        const checkbox = document.getElementById(`goal-${goalId}`);
        
        if (container && checkbox) {
            if (checkbox.checked) {
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
                // Uncheck all sub-goals when parent is unchecked
                const subGoalCheckboxes = container.querySelectorAll('input[type="checkbox"]');
                subGoalCheckboxes.forEach(cb => cb.checked = false);
            }
        }
    }

    updateParentGoalState(goalId) {
        const container = document.getElementById(`subgoals-container-${goalId}`);
        const parentCheckbox = document.getElementById(`goal-${goalId}`);
        
        if (container && parentCheckbox) {
            const subGoalCheckboxes = container.querySelectorAll('input[type="checkbox"]');
            const checkedSubGoals = container.querySelectorAll('input[type="checkbox"]:checked');
            
            // If any sub-goals are checked, check the parent and show the container
            if (checkedSubGoals.length > 0) {
                parentCheckbox.checked = true;
                container.classList.remove('hidden');
            } else {
                // If no sub-goals are checked, uncheck the parent
                parentCheckbox.checked = false;
            }
        }
    }

    addLinkToFlavor(flavor) {
        const container = document.querySelector(`[data-flavor="${flavor}"].flavor-links-container`);
        if (container) {
            const addButton = container.querySelector('button[onclick*="addLinkToFlavor"]');
            const newLinkHtml = `
                <div class="flavor-link-item mb-2">
                    <div class="flex gap-2">
                        <input type="url" 
                               class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                               placeholder="Enter URL..."
                               value="">
                        <button type="button" 
                                onclick="app.removeLinkFromFlavor('${flavor}', this)"
                                class="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-sm">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            addButton.insertAdjacentHTML('beforebegin', newLinkHtml);
        }
    }

    removeLinkFromFlavor(flavor, button) {
        const linkItem = button.closest('.flavor-link-item');
        if (linkItem) {
            linkItem.remove();
        }
    }

    async renderFlavorsList() {
        const flavorsList = document.getElementById('flavorsList');
        if (!flavorsList) return;

        try {
            // Get flavors from the server
            const response = await this.authFetch('/api/flavors');
            let flavors = [];
            
            if (response.ok) {
                const data = await response.json();
                flavors = data.flavors || [];
            }
            
            console.log('Rendering flavors list:', flavors);

            if (flavors.length === 0) {
                flavorsList.innerHTML = '<p class="text-gray-500 text-sm">No flavors found. Add some flavors above.</p>';
                return;
            }

            flavorsList.innerHTML = flavors.map(flavor => `
                <div class="flex items-center justify-between p-3 bg-purple-50 rounded-md flavor-item">
                    <span class="font-medium">${flavor}</span>
                    <div class="flex items-center space-x-2">
                        <button onclick="app.editFlavor('${flavor.replace(/'/g, "\\'")}', this)" class="text-blue-600 hover:text-blue-800">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="app.deleteFlavor('${flavor.replace(/'/g, "\\'")}', this)" class="text-red-600 hover:text-red-800">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error rendering flavors list:', error);
            flavorsList.innerHTML = '<div class="text-red-500 p-3">Failed to load flavors</div>';
        }
    }

    getEuStatusClass(status) {
        const statusClasses = {
            'Not started': 'bg-gray-100 text-gray-800',
            'In Preparation': 'bg-yellow-100 text-yellow-800',
            'Waiting for approval': 'bg-blue-100 text-blue-800',
            'Approved': 'bg-green-100 text-green-800',
            'Declined': 'bg-red-100 text-red-800',
            'Returned for clarification': 'bg-orange-100 text-orange-800'
        };
        return statusClasses[status] || statusClasses['Not started'];
    }

    updateLastUpdated(timestamp) {
        if (timestamp) {
            const date = new Date(timestamp);
            document.getElementById('lastUpdated').textContent = 
                `Last updated: ${date.toLocaleString()}`;
        }
    }

    // Category management methods
    async addCategory() {
        console.log('addCategory called');
        const input = document.getElementById('newCategory');
        if (!input) {
            console.error('newCategory input not found');
            return;
        }
        const categoryName = input.value.trim();
        console.log('Category name:', categoryName);
        if (!categoryName) return;

        try {
            const response = await this.authFetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: categoryName })
            });

            if (response.ok) {
                input.value = '';
                await this.loadData();
                this.renderCategoriesList();
                alert('Category added successfully!');
            } else {
                const error = await response.json();
                alert('Error: ' + error.error);
            }
        } catch (error) {
            console.error('Error adding category:', error);
            alert('Failed to add category');
        }
    }

    async editCategory(categoryName) {
        const newName = prompt('Edit category name:', categoryName);
        if (newName && newName !== categoryName) {
            // For now, just show that this would work
            alert(`Category editing would rename "${categoryName}" to "${newName}"`);
        }
    }

    async deleteCategory(categoryName) {
        if (confirm(`Delete category "${categoryName}"? This will remove it from all products.`)) {
            try {
                const response = await fetch(`/api/categories/${encodeURIComponent(categoryName)}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    await this.loadData();
                    this.renderCategoriesList();
                    alert('Category deleted successfully!');
                } else {
                    const error = await response.json();
                    alert('Error: ' + error.error);
                }
            } catch (error) {
                console.error('Error deleting category:', error);
                alert('Failed to delete category');
            }
        }
    }

    // Goal management methods
    async addGoal() {
        const input = document.getElementById('newGoal');
        const goalName = input.value.trim();
        if (!goalName) return;

        try {
            const response = await this.authFetch('/api/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: goalName })
            });

            if (response.ok) {
                input.value = '';
                await this.loadData();
                this.renderGoalsList();
                alert('Goal added successfully!');
            } else {
                const error = await response.json();
                alert('Error: ' + error.error);
            }
        } catch (error) {
            console.error('Error adding goal:', error);
            alert('Failed to add goal');
        }
    }

    async editGoal(goalName) {
        const newName = prompt('Edit goal name:', goalName);
        if (newName && newName !== goalName) {
            alert(`Goal editing would rename "${goalName}" to "${newName}"`);
        }
    }

    async deleteGoal(goalName) {
        if (confirm(`Delete goal "${goalName}"? This will remove it from all products.`)) {
            try {
                const response = await fetch(`/api/goals/${encodeURIComponent(goalName)}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    await this.loadData();
                    this.renderGoalsList();
                    alert('Goal deleted successfully!');
                } else {
                    const error = await response.json();
                    alert('Error: ' + error.error);
                }
            } catch (error) {
                console.error('Error deleting goal:', error);
                alert('Failed to delete goal');
            }
        }
    }

    // Flavor management methods
    async addFlavor() {
        const flavorName = document.getElementById('newFlavor').value.trim();
        if (!flavorName) return;

        try {
            const response = await this.authFetch('/api/flavors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: flavorName })
            });

            if (response.ok) {
                document.getElementById('newFlavor').value = '';
                await this.renderFlavorsList();
                this.showNotification(`Added flavor: ${flavorName}`, 'success');
            } else {
                const error = await response.json();
                alert('Error: ' + error.error);
            }
        } catch (error) {
            console.error('Error adding flavor:', error);
            alert('Failed to add flavor');
        }
    }

    async deleteFlavor(flavorName) {
        if (confirm(`Delete flavor "${flavorName}"? This will remove it from all products.`)) {
            try {
                const response = await fetch(`/api/flavors/${encodeURIComponent(flavorName)}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    await this.renderFlavorsList();
                    this.showNotification(`Deleted flavor: ${flavorName}`, 'success');
                } else {
                    const error = await response.json();
                    alert('Error: ' + error.error);
                }
            } catch (error) {
                console.error('Error deleting flavor:', error);
                alert('Failed to delete flavor');
            }
        }
    }

    async editFlavor(oldFlavorName) {
        const newFlavorName = prompt(`Edit flavor name:`, oldFlavorName);
        if (!newFlavorName || newFlavorName === oldFlavorName) return;

        // Implementation would involve updating all products with the old flavor
        // For now, we'll just show a notification
        this.showNotification('Flavor editing not yet implemented', 'info');
    }

    // Product editing methods
    async editProduct(productHandle, fromProductsPage = false) {
        const product = this.products.find(p => p.handle === productHandle || p.title === productHandle);
        if (!product) {
            alert('Product not found');
            return;
        }

        this.showProductEditModal(product, fromProductsPage);
    }

    showProductEditModal(product, fromProductsPage = false) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-60 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 modal-backdrop';
        
        modal.innerHTML = `
            <div class="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl border-0 modal-content">
                <!-- Header -->
                <div class="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl">
                    <div class="flex justify-between items-center">
                        <div>
                            <h3 class="text-xl font-semibold">${product.title}</h3>
                            <p class="text-blue-100 text-sm mt-1 opacity-90">Edit product information</p>
                        </div>
                        <button onclick="this.closest('.fixed').remove()" 
                                class="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white hover:bg-opacity-20 rounded-lg">
                            <i class="fas fa-times text-lg"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Content -->
                <div class="p-6">
                    
                    <!-- Product Name Section -->
                    <div class="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-200 mb-6">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-tag text-indigo-600 mr-2"></i>
                            <label class="text-sm font-semibold text-gray-800">Product Name</label>
                        </div>
                        <div>
                            <input type="text" id="productName" 
                                   class="w-full px-4 py-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                   placeholder="Enter product name..."
                                   value="${product.title || ''}">
                        </div>
                    </div>
                    
                    <!-- EU Availability Section -->
                    <div class="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-5 border border-emerald-200 mb-6">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-globe-europe text-emerald-600 mr-2"></i>
                            <label class="text-sm font-semibold text-gray-800">EU Availability</label>
                        </div>
                        <div class="flex items-center space-x-4">
                            <label class="block text-sm font-medium text-gray-700">Allowed in EU:</label>
                            <div class="flex items-center space-x-3">
                                <label class="flex items-center">
                                    <input type="radio" id="euAllowedYes" name="euAllowed" value="yes" 
                                           class="mr-2 text-emerald-600 focus:ring-emerald-500"
                                           ${product.euAllowed === 'yes' || product.euAllowed === true ? 'checked' : ''}>
                                    <span class="text-sm text-emerald-700 font-medium">Yes</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="radio" id="euAllowedNo" name="euAllowed" value="no" 
                                           class="mr-2 text-red-600 focus:ring-red-500"
                                           ${product.euAllowed === 'no' || product.euAllowed === false ? 'checked' : ''}>
                                    <span class="text-sm text-red-700 font-medium">No</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Product Details Section -->
                    <div class="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-5 border border-gray-200 mb-6">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-info-circle text-blue-600 mr-2"></i>
                            <label class="text-sm font-semibold text-gray-800">Product Details</label>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Size</label>
                                <input type="text" id="productSize" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       placeholder="e.g., 30 capsules, 500g"
                                       value="${product.size || ''}">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">No. of Servings</label>
                                <input type="text" id="productServings"
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       placeholder="e.g., 30, 60"
                                       value="${product.servings || ''}">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Intake Frequency</label>
                                <input type="text" id="productIntakeFrequency"
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       placeholder="e.g., 1x daily, 2x daily"
                                       value="${product.intakeFrequency || ''}">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Reorder Period (days)</label>
                                <input type="number" id="productReorderPeriod"
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       placeholder="e.g., 30, 60, 90"
                                       min="1"
                                       value="${product.reorderPeriod || ''}">
                            </div>
                        </div>
                    </div>

                    <!-- Pricing Details Section -->
                    <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200 mb-6">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-euro-sign text-green-600 mr-2"></i>
                            <label class="text-sm font-semibold text-gray-800">Pricing Details</label>
                        </div>
                        
                        <!-- Momentous Pricing (Read-only, from scraped data) -->
                        <div class="mb-4">
                            <h4 class="text-sm font-medium text-gray-700 mb-3">Momentous price in US:</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-medium text-gray-600 mb-1">Regular Price</label>
                                    <input type="text" value="${product.price || 'Not available'}" 
                                           class="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-100 text-gray-600" readonly>
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-600 mb-1">Subscription Price</label>
                                    <input type="text" value="${product.subscriptionPrice || 'Not available'}" 
                                           class="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-100 text-gray-600" readonly>
                                </div>
                            </div>
                        </div>

                        <!-- Nutraceuticals.com Pricing -->
                        <div class="mb-4">
                            <h4 class="text-sm font-medium text-gray-700 mb-3">Nutraceuticals.com price:</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">Regular Price (EUR)</label>
                                    <input type="text" id="nutraceuticalsRegularPrice"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                           placeholder="e.g., €45.00"
                                           value="${product.nutraceuticalsRegularPrice || ''}">
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">Subscription Price (EUR)</label>
                                    <input type="text" id="nutraceuticalsSubscriptionPrice"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                           placeholder="e.g., €38.25"
                                           value="${product.nutraceuticalsSubscriptionPrice || ''}">
                                </div>
                            </div>
                        </div>

                        <!-- Clubneno.com Pricing -->
                        <div class="mb-4">
                            <h4 class="text-sm font-medium text-gray-700 mb-3">Clubneno.com price:</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">Regular Price (EUR)</label>
                                    <input type="text" id="clubnenoRegularPrice"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                           placeholder="e.g., €42.00"
                                           value="${product.clubnenoRegularPrice || ''}">
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">Subscription Price (EUR)</label>
                                    <input type="text" id="clubnenoSubscriptionPrice"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                           placeholder="e.g., €35.70"
                                           value="${product.clubnenoSubscriptionPrice || ''}">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Hierarchical Goals & Sub-Goals Selection -->
                    <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-sitemap text-blue-600 mr-2"></i>
                            <label class="text-sm font-semibold text-gray-800">Goals & Sub-Goals</label>
                        </div>
                        <div class="space-y-4 max-h-64 overflow-y-auto custom-scrollbar">
                            ${this.goals.map(goal => `
                                <div class="bg-white rounded-lg border border-blue-200 p-3">
                                    <!-- Parent Goal -->
                                    <div class="flex items-center mb-2">
                                        <input type="checkbox" id="goal-${goal.id}" 
                                               ${this.hasSubGoalSelected(product, goal) ? 'checked' : ''}
                                               onchange="app.toggleGoalSelection('${goal.id}')"
                                               class="parent-goal-checkbox mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2">
                                        <label for="goal-${goal.id}" class="font-medium text-blue-900 cursor-pointer">${goal.name}</label>
                                    </div>
                                    
                                    <!-- Sub-Goals -->
                                    <div id="subgoals-container-${goal.id}" class="ml-6 space-y-2 ${this.hasSubGoalSelected(product, goal) ? '' : 'hidden'}">
                                        ${(goal.subGoals || []).map(subGoal => `
                                            <label class="flex items-center group cursor-pointer">
                                                <input type="checkbox" ${(product.goals || []).includes(subGoal) ? 'checked' : ''} 
                                                       value="${subGoal}" 
                                                       onchange="app.updateParentGoalState('${goal.id}')"
                                                       class="goal-checkbox mr-2 w-3 h-3 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2">
                                                <span class="text-sm text-gray-700 group-hover:text-green-700 transition-colors">${subGoal}</span>
                                            </label>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                        
                    <!-- Flavors Card -->
                    <div class="mt-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-100">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-palette text-orange-600 mr-2"></i>
                            <label class="text-sm font-semibold text-gray-800">Flavors</label>
                        </div>
                        <div class="space-y-4">
                            <div class="flex flex-wrap gap-2 min-h-[3rem] bg-white border border-gray-200 rounded-lg p-3 shadow-inner" id="modalAssignedFlavors">
                                ${(product.flavors || []).map(flavor => 
                                    `<span class="inline-flex items-center px-3 py-1 text-sm bg-orange-100 text-orange-800 rounded-full border border-orange-200 hover:bg-orange-200 transition-colors group">
                                        ${flavor}
                                        <button onclick="app.removeFlavorFromModal('${flavor.replace(/'/g, "\\'")}', this)" 
                                                class="ml-2 text-orange-600 hover:text-orange-800 opacity-70 group-hover:opacity-100 transition-opacity">
                                            <i class="fas fa-times text-xs"></i>
                                        </button>
                                    </span>`
                                ).join('')}
                            </div>
                            <div class="flex gap-3">
                                <select id="modalFlavorSelect" class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white shadow-sm transition-all">
                                    <option value="">Select flavor to add...</option>
                                </select>
                                <button onclick="app.addFlavorToModal()" 
                                        class="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all transform hover:scale-105 shadow-md hover:shadow-lg font-medium">
                                    <i class="fas fa-plus mr-2"></i>Add
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Per-Flavor Details Card -->
                    <div class="mt-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-100">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-list-alt text-indigo-600 mr-2"></i>
                            <label class="text-sm font-semibold text-gray-800">Per-Flavor Details</label>
                        </div>
                        
                        <div id="perFlavorInputContainer" class="space-y-4">
                            ${(product.flavors || ['Unflavored']).map(flavor => {
                                const flavorSku = product.flavorSkus && product.flavorSkus[flavor] ? product.flavorSkus[flavor] : 
                                                 (product.skus && product.skus[flavor] ? product.skus[flavor] : '');
                                const flavorHsCode = product.flavorHsCodes && product.flavorHsCodes[flavor] ? product.flavorHsCodes[flavor] : 
                                                   (product.hsCode || '');
                                const flavorDutyRate = product.flavorDutyRates && product.flavorDutyRates[flavor] ? product.flavorDutyRates[flavor] : 
                                                     (product.dutyRate || '');
                                const flavorEuNotification = product.flavorEuNotifications && product.flavorEuNotifications[flavor] ? product.flavorEuNotifications[flavor] : 
                                                           (product.euNotificationStatus || 'Not started');
                                const flavorNotes = product.flavorNotes && product.flavorNotes[flavor] ? product.flavorNotes[flavor] : '';
                                const flavorLinks = product.flavorLinks && product.flavorLinks[flavor] ? product.flavorLinks[flavor] : [];
                                const flavorIngredients = product.flavorIngredients && product.flavorIngredients[flavor] ? product.flavorIngredients[flavor] : '';
                                
                                return `
                                    <div class="border border-indigo-200 rounded-lg p-4 bg-white">
                                        <div class="flex items-center mb-3">
                                            <i class="fas fa-flask text-indigo-600 mr-2"></i>
                                            <h4 class="font-medium text-indigo-800">${flavor}</h4>
                                        </div>
                                        
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label class="block text-sm font-medium text-gray-700 mb-1">SKU:</label>
                                                <input type="text" 
                                                       class="flavor-sku-input w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                       data-flavor="${flavor}"
                                                       value="${flavorSku}"
                                                       placeholder="Enter SKU for ${flavor}">
                                            </div>
                                            
                                            <div>
                                                <label class="block text-sm font-medium text-gray-700 mb-1">HS Code:</label>
                                                <input type="text" 
                                                       class="flavor-hscode-input w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                       data-flavor="${flavor}"
                                                       value="${flavorHsCode}"
                                                       placeholder="e.g., 2106.90.99">
                                            </div>
                                            
                                            <div>
                                                <label class="block text-sm font-medium text-gray-700 mb-1">Duty Rate (%):</label>
                                                <input type="number" 
                                                       class="flavor-dutyrate-input w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                       data-flavor="${flavor}"
                                                       value="${flavorDutyRate}"
                                                       min="0" 
                                                       max="100" 
                                                       step="0.1"
                                                       placeholder="e.g., 6.5">
                                            </div>
                                            
                                            <div>
                                                <label class="block text-sm font-medium text-gray-700 mb-1">EU Notification:</label>
                                                <select class="flavor-eunotification-input w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        data-flavor="${flavor}">
                                                    <option value="Not started" ${flavorEuNotification === 'Not started' ? 'selected' : ''}>Not started</option>
                                                    <option value="In Preparation" ${flavorEuNotification === 'In Preparation' ? 'selected' : ''}>In Preparation</option>
                                                    <option value="Waiting for approval" ${flavorEuNotification === 'Waiting for approval' ? 'selected' : ''}>Waiting for approval</option>
                                                    <option value="Approved" ${flavorEuNotification === 'Approved' ? 'selected' : ''}>Approved</option>
                                                    <option value="Declined" ${flavorEuNotification === 'Declined' ? 'selected' : ''}>Declined</option>
                                                    <option value="Returned for clarification" ${flavorEuNotification === 'Returned for clarification' ? 'selected' : ''}>Returned for clarification</option>
                                                </select>
                                            </div>
                                        </div>
                                        
                                        <!-- Notes field spans full width -->
                                        <div class="mt-4">
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Notes:</label>
                                            <textarea class="flavor-notes-input w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                      data-flavor="${flavor}"
                                                      rows="4"
                                                      placeholder="Add any notes for ${flavor}...">${flavorNotes}</textarea>
                                        </div>
                                        
                                        <!-- Important Links field -->
                                        <div class="mt-4">
                                            <label class="block text-sm font-medium text-gray-700 mb-2">Important Links:</label>
                                            <div class="flavor-links-container block w-full" data-flavor="${flavor}">
                                                ${flavorLinks.map((link, index) => `
                                                    <div class="flavor-link-item mb-2">
                                                        <div class="flex gap-2">
                                                            <input type="url" 
                                                                   class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                   placeholder="Enter URL..."
                                                                   value="${link}">
                                                            <button type="button" 
                                                                    onclick="app.removeLinkFromFlavor('${flavor}', this)"
                                                                    class="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-sm">
                                                                <i class="fas fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                `).join('')}
                                                <button type="button" 
                                                        onclick="app.addLinkToFlavor('${flavor}')"
                                                        class="mt-2 px-3 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors text-sm">
                                                    <i class="fas fa-plus mr-1"></i>Add Link
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <!-- Ingredients field spans full width -->
                                        <div class="mt-4">
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Ingredients:</label>
                                            <textarea class="flavor-ingredients-input w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                      data-flavor="${flavor}"
                                                      rows="3"
                                                      placeholder="Enter ingredients for ${flavor}...">${flavorIngredients}</textarea>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        
                        <div class="mt-4 p-3 bg-indigo-50 rounded-md">
                            <p class="text-xs text-indigo-800">
                                <i class="fas fa-info-circle mr-1"></i>
                                Each flavor can have unique SKU, HS Code, Duty Rate, and EU Notification status for better inventory and customs management.
                            </p>
                        </div>
                    </div>
                    
                    <!-- HS Code AI Suggestion Card -->
                    <div class="mt-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-5 border border-yellow-100">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-lightbulb text-yellow-600 mr-2"></i>
                            <label class="text-sm font-semibold text-gray-800">HS Code AI Suggestion</label>
                        </div>
                        
                        <!-- AI Suggested HS Code Display -->
                        <div class="p-4 bg-white rounded-lg border">
                            <div class="flex items-start justify-between mb-3">
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">AI Suggested HS Code:</p>
                                    <div class="flex items-center gap-3">
                                        <span class="font-mono text-lg font-semibold text-gray-800" id="currentHsCode">
                                            ${product.hsCode || this.analyzeHsCode(product).code}
                                        </span>
                                        <span class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                                            <i class="fas fa-lightbulb mr-1"></i>AI Generated
                                        </span>
                                    </div>
                                </div>
                                <button type="button" onclick="app.refreshHsCodeSuggestion('${product.handle || product.title}')" 
                                        class="text-blue-600 hover:text-blue-800 text-sm font-medium hover:bg-blue-50 px-3 py-1 rounded-md transition-colors">
                                    <i class="fas fa-sync-alt mr-1"></i>Re-analyze
                                </button>
                            </div>
                            <p class="text-sm text-gray-600" id="hsCodeDescription">
                                ${product.hsCodeDescription || this.analyzeHsCode(product).description}
                            </p>
                        </div>
                        
                        <div class="mt-4 p-3 bg-yellow-50 rounded-md">
                            <p class="text-xs text-yellow-800">
                                <i class="fas fa-info-circle mr-1"></i>
                                This HS Code is suggested by AI based on product analysis. Use the Per-Flavor Details section below to set specific HS codes for each flavor.
                            </p>
                        </div>
                    </div>
                    </div>
                    
                    <!-- Footer with buttons -->
                    <div class="sticky bottom-0 bg-gray-50 p-6 rounded-b-xl border-t border-gray-200">
                        <div class="flex justify-end space-x-4">
                            <button onclick="this.closest('.fixed').remove()" 
                                    class="px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-medium shadow-sm">
                                <i class="fas fa-times mr-2"></i>Cancel
                            </button>
                            <button onclick="app.saveProductChanges('${product.handle || product.title}', this.closest('.fixed'), ${fromProductsPage})" 
                                    class="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl font-medium">
                                <i class="fas fa-save mr-2"></i>Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Populate flavor dropdown after modal is added to DOM
        setTimeout(() => {
            this.populateModalFlavorDropdown();
            // Auto-generate SKUs for products that don't have them yet
            this.initializeSkuFields(product);
        }, 100);
    }

    async saveProductChanges(productHandle, modal, fromProductsPage = false) {
        // Get product name
        const productName = modal.querySelector('#productName')?.value.trim() || '';
        
        // Get EU availability
        const euAllowedRadio = modal.querySelector('input[name="euAllowed"]:checked');
        const euAllowed = euAllowedRadio ? euAllowedRadio.value : 'yes'; // default to yes
        
        // Get basic product information
        const size = modal.querySelector('#productSize')?.value.trim() || '';
        const servings = modal.querySelector('#productServings')?.value.trim() || '';
        const intakeFrequency = modal.querySelector('#productIntakeFrequency')?.value.trim() || '';
        const reorderPeriod = modal.querySelector('#productReorderPeriod')?.value.trim() || '';
        
        // Get pricing information
        const nutraceuticalsRegularPrice = modal.querySelector('#nutraceuticalsRegularPrice')?.value.trim() || '';
        const nutraceuticalsSubscriptionPrice = modal.querySelector('#nutraceuticalsSubscriptionPrice')?.value.trim() || '';
        const clubnenoRegularPrice = modal.querySelector('#clubnenoRegularPrice')?.value.trim() || '';
        const clubnenoSubscriptionPrice = modal.querySelector('#clubnenoSubscriptionPrice')?.value.trim() || '';
        
        console.log('Product name collected:', productName);
        console.log('Basic product info collected:', { size, servings, intakeFrequency, reorderPeriod });
        console.log('Pricing info collected:', { nutraceuticalsRegularPrice, nutraceuticalsSubscriptionPrice, clubnenoRegularPrice, clubnenoSubscriptionPrice });
        
        // Get selected parent goals (for categories field)
        const parentGoalCheckboxes = modal.querySelectorAll('.parent-goal-checkbox:checked');
        const categories = Array.from(parentGoalCheckboxes).map(cb => {
            // Find the corresponding goal name from the goals data
            const goalId = cb.id.replace('goal-', '');
            const goal = this.goals.find(g => g.id === goalId);
            return goal ? goal.name : null;
        }).filter(Boolean);
        
        // Get selected sub-goals (for goals field)
        const subGoalCheckboxes = modal.querySelectorAll('.goal-checkbox:checked');
        const goals = Array.from(subGoalCheckboxes).map(cb => cb.value);
        
        // EU Notification is now handled per-flavor, set default for backward compatibility
        const euNotificationStatus = 'Not started';
        
        // Get flavors from modal
        const flavorElements = modal.querySelectorAll('#modalAssignedFlavors span');
        const flavors = Array.from(flavorElements).map(span => {
            // Get only the text content, excluding the button
            const clone = span.cloneNode(true);
            const button = clone.querySelector('button');
            if (button) button.remove();
            return clone.textContent.trim();
        });
        
        // Get SKUs from modal (both old and new style)
        const skus = {};
        const skuInputs = modal.querySelectorAll('#skuContainer input');
        skuInputs.forEach(input => {
            const flavor = input.dataset.flavor || 'base';
            const value = input.value.trim();
            if (value) {
                skus[flavor] = value;
            }
        });
        
        // Get per-flavor data if new per-flavor inputs exist
        const flavorSkus = {};
        const flavorHsCodes = {};
        const flavorDutyRates = {};
        const flavorEuNotifications = {};
        const flavorNotes = {};
        const flavorLinks = {};
        const flavorIngredients = {};
        
        const flavorSkuInputs = modal.querySelectorAll('.flavor-sku-input');
        const flavorHsCodeInputs = modal.querySelectorAll('.flavor-hscode-input');
        const flavorDutyRateInputs = modal.querySelectorAll('.flavor-dutyrate-input');
        const flavorEuNotificationInputs = modal.querySelectorAll('.flavor-eunotification-input');
        const flavorNotesInputs = modal.querySelectorAll('.flavor-notes-input');
        const flavorIngredientsInputs = modal.querySelectorAll('.flavor-ingredients-input');
        
        flavorSkuInputs.forEach(input => {
            const flavor = input.dataset.flavor;
            const value = input.value.trim();
            if (flavor && value) {
                flavorSkus[flavor] = value;
            }
        });
        
        flavorHsCodeInputs.forEach(input => {
            const flavor = input.dataset.flavor;
            const value = input.value.trim();
            if (flavor && value) {
                flavorHsCodes[flavor] = value;
            }
        });
        
        flavorDutyRateInputs.forEach(input => {
            const flavor = input.dataset.flavor;
            const value = parseFloat(input.value);
            if (flavor && !isNaN(value)) {
                flavorDutyRates[flavor] = value;
            }
        });
        
        flavorEuNotificationInputs.forEach(input => {
            const flavor = input.dataset.flavor;
            const value = input.value;
            if (flavor && value) {
                flavorEuNotifications[flavor] = value;
            }
        });
        
        flavorNotesInputs.forEach(input => {
            const flavor = input.dataset.flavor;
            const value = input.value.trim();
            if (flavor) {
                flavorNotes[flavor] = value;
            }
        });
        
        flavorIngredientsInputs.forEach(input => {
            const flavor = input.dataset.flavor;
            const value = input.value.trim();
            if (flavor) {
                flavorIngredients[flavor] = value;
            }
        });
        
        // Collect flavor links
        modal.querySelectorAll('.flavor-links-container').forEach(container => {
            const flavor = container.dataset.flavor;
            if (flavor) {
                const linkInputs = container.querySelectorAll('.flavor-link-item input[type="url"]');
                const links = Array.from(linkInputs).map(input => input.value.trim()).filter(link => link);
                console.log(`Flavor ${flavor}: found ${linkInputs.length} link inputs, ${links.length} with values:`, links);
                if (links.length > 0) {
                    flavorLinks[flavor] = links;
                }
            }
        });
        
        // HS Code is now handled per-flavor, set empty for backward compatibility
        const hsCode = '';
        const hsCodeDescription = '';
        
        // Duty Rate is now handled per-flavor, set null for backward compatibility
        const dutyRate = null;
        
        console.log('Saving product changes:', { 
            categories: categories, // "Goals" (UI) -> categories (data)
            goals: goals, // "Sub-Goals" (UI) -> goals (data)
            euNotificationStatus, flavors, skus, hsCode, hsCodeDescription, dutyRate,
            flavorNotes, flavorLinks, flavorIngredients
        });
        
        try {
            const token = localStorage.getItem('sessionToken');
            const response = await fetch(`/api/products/${encodeURIComponent(productHandle)}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    categories, 
                    goals, 
                    euNotificationStatus, 
                    flavors, 
                    skus, 
                    hsCode, 
                    hsCodeDescription, 
                    dutyRate,
                    // Product name
                    productName,
                    // EU availability
                    euAllowed,
                    // Basic product information
                    size,
                    servings,
                    intakeFrequency,
                    reorderPeriod,
                    // Pricing information
                    nutraceuticalsRegularPrice,
                    nutraceuticalsSubscriptionPrice,
                    clubnenoRegularPrice,
                    clubnenoSubscriptionPrice,
                    // Per-flavor data
                    flavorSkus,
                    flavorHsCodes,
                    flavorDutyRates,
                    flavorEuNotifications,
                    flavorNotes,
                    flavorLinks,
                    flavorIngredients
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Product update successful:', result);
                modal.remove();
                await this.loadData();
                
                // Refresh the appropriate page
                if (fromProductsPage) {
                    // Refresh products page
                    this.loadProductsDirectly();
                }
                
                this.showNotification('Product updated successfully!', 'success');
            } else {
                const error = await response.json();
                this.showNotification(`Error: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('Error updating product:', error);
            this.showNotification('Failed to update product', 'error');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-md text-white shadow-lg ${
            type === 'success' ? 'bg-green-600' : 
            type === 'error' ? 'bg-red-600' : 
            'bg-blue-600'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Show variants modal
    showVariants(productHandle, productIndex) {
        const product = this.products.find(p => 
            p.handle === productHandle || 
            p.title === productHandle ||
            this.products.indexOf(p) === productIndex
        );
        
        if (!product || !product.variants || product.variants.length <= 1) {
            this.showNotification('No variants available for this product', 'info');
            return;
        }

        // Create variants modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        
        modal.innerHTML = `
            <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
                <div class="mt-3">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium text-gray-900">Available Options: ${product.title}</h3>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    ${this.renderVariantsModal(product.variants)}
                    
                    <div class="flex justify-end space-x-3 mt-6">
                        <button onclick="this.closest('.fixed').remove()" 
                                class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">
                            Close
                        </button>
                        <a href="${product.link}" target="_blank"
                           class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                            <i class="fas fa-external-link-alt mr-2"></i>View Product
                        </a>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    renderVariantsModal(variants) {
        const { flavors, sizes } = this.categorizeVariants(variants);
        let html = '<div class="max-h-96 overflow-y-auto">';

        // Show flavors section
        if (flavors.length > 0) {
            html += `
                <div class="mb-6">
                    <h4 class="text-md font-semibold text-gray-800 mb-3">
                        <i class="fas fa-palette mr-2 text-green-600"></i>Available Flavors
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        ${variants.filter(v => !this.isSize(v.title)).map(variant => `
                            <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                                <div class="flex-1">
                                    <div class="font-medium text-gray-900">${variant.title}</div>
                                    ${variant.available === false ? `
                                        <div class="text-sm text-red-600">
                                            <i class="fas fa-times-circle mr-1"></i>Out of Stock
                                        </div>
                                    ` : `
                                        <div class="text-sm text-green-600">
                                            <i class="fas fa-check-circle mr-1"></i>Available
                                        </div>
                                    `}
                                </div>
                                <div class="text-right">
                                    ${variant.price ? `
                                        <div class="font-bold text-green-600">${variant.price}</div>
                                        ${variant.subscriptionPrice ? `
                                            <div class="text-sm text-blue-600">Subscribe: ${variant.subscriptionPrice}</div>
                                        ` : ''}
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Show sizes section
        if (sizes.length > 0) {
            html += `
                <div class="mb-6">
                    <h4 class="text-md font-semibold text-gray-800 mb-3">
                        <i class="fas fa-weight mr-2 text-blue-600"></i>Available Sizes
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        ${variants.filter(v => this.isSize(v.title)).map(variant => `
                            <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                                <div class="flex-1">
                                    <div class="font-medium text-gray-900">${variant.title}</div>
                                    ${variant.available === false ? `
                                        <div class="text-sm text-red-600">
                                            <i class="fas fa-times-circle mr-1"></i>Out of Stock
                                        </div>
                                    ` : `
                                        <div class="text-sm text-green-600">
                                            <i class="fas fa-check-circle mr-1"></i>Available
                                        </div>
                                    `}
                                </div>
                                <div class="text-right">
                                    ${variant.price ? `
                                        <div class="font-bold text-green-600">${variant.price}</div>
                                        ${variant.subscriptionPrice ? `
                                            <div class="text-sm text-blue-600">Subscribe: ${variant.subscriptionPrice}</div>
                                        ` : ''}
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // If no clear separation, show all variants
        if (flavors.length === 0 && sizes.length === 0) {
            html += `
                <div class="space-y-3">
                    ${variants.map(variant => `
                        <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                            <div class="flex-1">
                                <div class="font-medium text-gray-900">${variant.title}</div>
                                ${variant.available === false ? `
                                    <div class="text-sm text-red-600">
                                        <i class="fas fa-times-circle mr-1"></i>Out of Stock
                                    </div>
                                ` : `
                                    <div class="text-sm text-green-600">
                                        <i class="fas fa-check-circle mr-1"></i>Available
                                    </div>
                                `}
                            </div>
                            <div class="text-right">
                                ${variant.price ? `
                                    <div class="font-bold text-green-600">${variant.price}</div>
                                    ${variant.subscriptionPrice ? `
                                        <div class="text-sm text-blue-600">Subscribe: ${variant.subscriptionPrice}</div>
                                    ` : ''}
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    // Price Analysis functionality
    async initializePriceAnalysis() {
        console.log('Initializing Price Analysis...');
        await this.loadPriceAnalysis();
    }

    async loadPriceAnalysis() {
        try {
            const loadingState = document.getElementById('analysisLoadingState');
            const tableBody = document.getElementById('priceAnalysisBody');
            const analysisCount = document.getElementById('analysisCount');

            if (loadingState) loadingState.classList.remove('hidden');
            if (tableBody) tableBody.innerHTML = '';

            const response = await this.authFetch('/api/products');
            const data = await response.json();
            
            if (loadingState) loadingState.classList.add('hidden');
            if (analysisCount) analysisCount.textContent = data.products.length;

            this.renderPriceAnalysisTable(data.products);
        } catch (error) {
            console.error('Error loading price analysis:', error);
        }
    }

    renderPriceAnalysisTable(products) {
        const tableBody = document.getElementById('priceAnalysisBody');
        if (!tableBody) return;

        tableBody.innerHTML = products.map((product, index) => {
            const retailPriceUS = this.extractPrice(product.price);
            const calculations = this.calculatePricing(retailPriceUS, index, product);

            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-3 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-200">
                        <div class="max-w-xs truncate" title="${product.title}">
                            ${product.title}
                            ${product.variants && product.variants.length > 1 ? `
                                <div class="text-xs text-gray-500 mt-1">
                                    ${product.variants.length} variants available
                                </div>
                            ` : ''}
                        </div>
                    </td>
                    <td class="px-3 py-4 text-sm text-gray-900">
                        $${retailPriceUS.toFixed(2)}
                    </td>
                    <td class="px-3 py-4 text-sm">
                        <input type="number" value="${calculations.partnerDiscount}" min="0" max="100" step="0.1"
                               class="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                               onchange="updateRowCalculation(${index}, this.value, 'partnerDiscount')">
                    </td>
                    <td class="px-3 py-4 text-sm text-gray-900">
                        $<span id="purchasingPriceUS-${index}">${calculations.purchasingPriceUS.toFixed(2)}</span>
                    </td>
                    <td class="px-3 py-4 text-sm text-gray-900">
                        €<span id="purchasingPriceEUR-${index}">${calculations.purchasingPriceEUR.toFixed(2)}</span>
                    </td>
                    <td class="px-3 py-4 text-sm">
                        <input type="number" value="${calculations.transport}" min="0" step="0.01"
                               class="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                               onchange="updateRowCalculation(${index}, this.value, 'transport')">
                    </td>
                    <td class="px-3 py-4 text-sm">
                        <div class="relative">
                            <input type="number" value="${calculations.dutyRate}" min="0" max="100" step="0.1"
                                   class="w-20 px-2 py-1 border border-gray-300 rounded text-sm ${product.dutyRate !== undefined && product.dutyRate !== null && product.dutyRate !== '' ? 'bg-green-50 border-green-300' : 'bg-gray-50'}"
                                   onchange="updateRowCalculation(${index}, this.value, 'dutyRate')"
                                   title="${product.dutyRate !== undefined && product.dutyRate !== null && product.dutyRate !== '' ? 'Using product-specific duty rate' : 'Using global default duty rate'}">
                            ${product.dutyRate !== undefined && product.dutyRate !== null && product.dutyRate !== '' ? 
                                '<div class="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" title="Product-specific rate"></div>' : 
                                '<div class="absolute -top-1 -right-1 w-2 h-2 bg-gray-400 rounded-full" title="Global default rate"></div>'
                            }
                        </div>
                    </td>
                    <td class="px-3 py-4 text-sm text-gray-900">
                        €<span id="dutyAmount-${index}">${calculations.dutyAmount.toFixed(2)}</span>
                    </td>
                    <td class="px-3 py-4 text-sm text-gray-900">
                        €<span id="basePriceLT-${index}">${calculations.basePriceLT.toFixed(2)}</span>
                    </td>
                    <td class="px-3 py-4 text-sm">
                        <input type="number" value="${calculations.markup}" min="0" step="0.1"
                               class="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                               onchange="updateRowCalculation(${index}, this.value, 'markup')">
                    </td>
                    <td class="px-3 py-4 text-sm text-gray-900">
                        €<span id="retailPriceLT-${index}">${calculations.retailPriceLT.toFixed(2)}</span>
                    </td>
                    <td class="px-3 py-4 text-sm">
                        <input type="number" value="${calculations.vat}" min="0" max="100" step="0.1"
                               class="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                               onchange="updateRowCalculation(${index}, this.value, 'vat')">
                    </td>
                    <td class="px-3 py-4 text-sm text-gray-900">
                        €<span id="vatFromSale-${index}">${calculations.vatFromSale.toFixed(2)}</span>
                    </td>
                    <td class="px-3 py-4 text-sm">
                        <input type="number" value="${calculations.delivery}" min="0" step="0.01"
                               class="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                               onchange="updateRowCalculation(${index}, this.value, 'delivery')">
                    </td>
                    <td class="px-3 py-4 text-sm font-bold ${calculations.netRevenue >= 0 ? 'text-green-600' : 'text-red-600'} bg-green-50">
                        €<span id="netRevenue-${index}">${calculations.netRevenue.toFixed(2)}</span>
                    </td>
                    <td class="px-3 py-4 text-sm font-bold ${calculations.margin >= 0 ? 'text-green-600' : 'text-red-600'} bg-yellow-50">
                        <span id="margin-${index}">${(calculations.margin / 100).toFixed(2)}</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    calculatePricing(retailPriceUS, rowIndex = null, product = null) {
        // Ensure retailPriceUS is a valid number
        retailPriceUS = isNaN(retailPriceUS) || retailPriceUS === null ? 0 : Number(retailPriceUS);
        
        // Get values from global controls or use defaults
        const usdEurRate = parseFloat(document.getElementById('usdEurRateGlobal')?.value || 0.92) || 0.92;
        const partnerDiscount = parseFloat(document.getElementById('partnerDiscountGlobal')?.value || 15) || 15;
        // Use product-specific duty rate if available, otherwise fall back to global setting
        const dutyRate = (product && product.dutyRate !== undefined && product.dutyRate !== null && product.dutyRate !== '') 
            ? parseFloat(product.dutyRate) 
            : parseFloat(document.getElementById('dutyRateGlobal')?.value || 12) || 12;
        const markup = parseFloat(document.getElementById('markupGlobal')?.value || 50) || 50;
        const vat = parseFloat(document.getElementById('vatGlobal')?.value || 21) || 21;
        const delivery = parseFloat(document.getElementById('deliveryGlobal')?.value || 5) || 5;
        const transport = parseFloat(document.getElementById('transportGlobal')?.value || 2.50) || 2.50;

        // Step-by-step calculations as requested
        // 1. Purchasing Price US ($) = Retail Price US * (1 - Partner Discount%)
        const purchasingPriceUS = retailPriceUS * (1 - partnerDiscount / 100);
        
        // 2. Purchasing Price US (EUR) = Purchasing Price US ($) * USD-EUR rate
        const purchasingPriceEUR = purchasingPriceUS * usdEurRate;
        
        // 3. Duty (EUR) = Purchasing price US (EUR) * Duty %
        const dutyAmount = purchasingPriceEUR * (dutyRate / 100);
        
        // 4. Base Price LT (EUR) = Purchasing Price US (EUR) + Transport + Duty (EUR)
        const basePriceLT = purchasingPriceEUR + transport + dutyAmount;
        
        // 5. Retail Price LT (EUR) = Base Price LT * (1 + Markup%)
        const retailPriceLT = basePriceLT * (1 + markup / 100);
        
        // 6. VAT from Sale (EUR) = Retail Price LT / (1 + VAT%) * VAT%
        const vatFromSale = retailPriceLT / (1 + vat / 100) * (vat / 100);
        
        // 7. Net Revenue = Retail price LT - VAT from sale - Delivery to client - Transport - Duty - Purchasing price US (EUR)
        const netRevenue = retailPriceLT - vatFromSale - delivery - transport - dutyAmount - purchasingPriceEUR;
        // 8. Margin % = Net Revenue / Purchasing price US (EUR) * 100
        const margin = (netRevenue / purchasingPriceEUR) * 100;

        return {
            usdEurRate,
            partnerDiscount,
            purchasingPriceUS,
            purchasingPriceEUR,
            transport,
            dutyRate,
            dutyAmount,
            basePriceLT,
            markup,
            retailPriceLT,
            vat,
            vatFromSale,
            delivery,
            netRevenue,
            margin
        };
    }

    extractPrice(priceString) {
        if (!priceString || typeof priceString !== 'string') {
            return 0;
        }
        const matches = priceString.match(/[\d,]+\.?\d*/);
        const result = matches ? parseFloat(matches[0].replace(',', '')) : 0;
        return isNaN(result) ? 0 : result;
    }



    // Modal flavor management methods
    addFlavorToModal() {
        const flavorSelect = document.getElementById('modalFlavorSelect');
        const selectedFlavor = flavorSelect.value;
        
        console.log('Adding flavor to modal:', selectedFlavor);
        
        if (!selectedFlavor) {
            alert('Please select a flavor to add');
            return;
        }

        const assignedFlavorsDiv = document.getElementById('modalAssignedFlavors');
        
        // Check if flavor already exists
        const existingFlavors = Array.from(assignedFlavorsDiv.querySelectorAll('span')).map(span => {
            const clone = span.cloneNode(true);
            const button = clone.querySelector('button');
            if (button) button.remove();
            return clone.textContent.trim();
        });
        if (existingFlavors.includes(selectedFlavor)) {
            alert('This flavor is already assigned');
            return;
        }

        // Add flavor to display
        const flavorSpan = document.createElement('span');
        flavorSpan.className = 'px-2 py-1 text-xs bg-orange-50 text-orange-700 rounded-full relative group';
        flavorSpan.innerHTML = `
            ${selectedFlavor}
            <button onclick="app.removeFlavorFromModal('${selectedFlavor.replace(/'/g, "\\'")}', this)" 
                    class="ml-1 text-orange-500 hover:text-orange-700 opacity-0 group-hover:opacity-100 transition-opacity">
                <i class="fas fa-times text-xs"></i>
            </button>
        `;
        
        assignedFlavorsDiv.appendChild(flavorSpan);
        flavorSelect.value = '';
        
        // Update SKU fields when flavor is added
        this.updateSkuFields();
        
        // Update per-flavor input fields when flavor is added
        this.updatePerFlavorInputs();
    }

    removeFlavorFromModal(flavorName, button) {
        if (confirm(`Remove flavor "${flavorName}"?`)) {
            button.closest('span').remove();
            
            // Update SKU fields when flavor is removed
            this.updateSkuFields();
            
            // Update per-flavor input fields when flavor is removed
            this.updatePerFlavorInputs();
        }
    }

    // Update per-flavor input fields when flavors change
    updatePerFlavorInputs() {
        const modal = document.querySelector('.fixed');
        if (!modal) return;
        
        const perFlavorContainer = modal.querySelector('#perFlavorInputContainer');
        const assignedFlavorsDiv = modal.querySelector('#modalAssignedFlavors');
        
        if (!perFlavorContainer || !assignedFlavorsDiv) return;
        
        // Get current flavors from modal
        const flavorElements = assignedFlavorsDiv.querySelectorAll('span');
        const currentFlavors = Array.from(flavorElements).map(span => {
            const clone = span.cloneNode(true);
            const button = clone.querySelector('button');
            if (button) button.remove();
            return clone.textContent.trim();
        });
        
        // Get existing values before re-rendering
        const existingValues = {
            skus: {},
            hsCodes: {},
            dutyRates: {},
            euNotifications: {},
            notes: {},
            links: {},
            ingredients: {}
        };
        
        const skuInputs = perFlavorContainer.querySelectorAll('.flavor-sku-input');
        const hsCodeInputs = perFlavorContainer.querySelectorAll('.flavor-hscode-input');
        const dutyRateInputs = perFlavorContainer.querySelectorAll('.flavor-dutyrate-input');
        const euNotificationInputs = perFlavorContainer.querySelectorAll('.flavor-eunotification-input');
        const notesInputs = perFlavorContainer.querySelectorAll('.flavor-notes-input');
        const ingredientsInputs = perFlavorContainer.querySelectorAll('.flavor-ingredients-input');
        
        skuInputs.forEach(input => {
            const flavor = input.dataset.flavor;
            if (flavor) existingValues.skus[flavor] = input.value;
        });
        
        hsCodeInputs.forEach(input => {
            const flavor = input.dataset.flavor;
            if (flavor) existingValues.hsCodes[flavor] = input.value;
        });
        
        dutyRateInputs.forEach(input => {
            const flavor = input.dataset.flavor;
            if (flavor) existingValues.dutyRates[flavor] = input.value;
        });
        
        euNotificationInputs.forEach(input => {
            const flavor = input.dataset.flavor;
            if (flavor) existingValues.euNotifications[flavor] = input.value;
        });
        
        notesInputs.forEach(input => {
            const flavor = input.dataset.flavor;
            if (flavor) existingValues.notes[flavor] = input.value;
        });
        
        ingredientsInputs.forEach(input => {
            const flavor = input.dataset.flavor;
            if (flavor) existingValues.ingredients[flavor] = input.value;
        });
        
        // Collect existing links
        perFlavorContainer.querySelectorAll('.flavor-links-container').forEach(container => {
            const flavor = container.dataset.flavor;
            if (flavor) {
                const linkInputs = container.querySelectorAll('.flavor-link-item input[type="url"]');
                existingValues.links[flavor] = Array.from(linkInputs).map(input => input.value).filter(link => link.trim());
            }
        });
        
        // Get product title for reference
        const productTitle = modal.querySelector('h3').textContent.replace(/Edit Product: |Edit /g, '');
        
        // Get original product data from modal for fallback values
        const originalProduct = this.products.find(p => p.title === productTitle || p.handle === productTitle) || {};
        
        // Re-render per-flavor input fields
        perFlavorContainer.innerHTML = currentFlavors.map(flavor => {
            const flavorSku = existingValues.skus[flavor] || 
                            (originalProduct.flavorSkus && originalProduct.flavorSkus[flavor] ? originalProduct.flavorSkus[flavor] : 
                            (originalProduct.skus && originalProduct.skus[flavor] ? originalProduct.skus[flavor] : ''));
            const flavorHsCode = existingValues.hsCodes[flavor] || 
                               (originalProduct.flavorHsCodes && originalProduct.flavorHsCodes[flavor] ? originalProduct.flavorHsCodes[flavor] : 
                               (originalProduct.hsCode || ''));
            const flavorDutyRate = existingValues.dutyRates[flavor] || 
                                 (originalProduct.flavorDutyRates && originalProduct.flavorDutyRates[flavor] ? originalProduct.flavorDutyRates[flavor] : 
                                 (originalProduct.dutyRate || ''));
            const flavorEuNotification = existingValues.euNotifications[flavor] || 
                                       (originalProduct.flavorEuNotifications && originalProduct.flavorEuNotifications[flavor] ? originalProduct.flavorEuNotifications[flavor] : 
                                       (originalProduct.euNotificationStatus || 'Not started'));
            const flavorNotes = existingValues.notes[flavor] || 
                              (originalProduct.flavorNotes && originalProduct.flavorNotes[flavor] ? originalProduct.flavorNotes[flavor] : '');
            const flavorLinks = existingValues.links[flavor] || 
                              (originalProduct.flavorLinks && originalProduct.flavorLinks[flavor] ? originalProduct.flavorLinks[flavor] : []);
            const flavorIngredients = existingValues.ingredients[flavor] || 
                              (originalProduct.flavorIngredients && originalProduct.flavorIngredients[flavor] ? originalProduct.flavorIngredients[flavor] : '');
            
            return `
                <div class="border border-indigo-200 rounded-lg p-4 bg-white">
                    <div class="flex items-center mb-3">
                        <i class="fas fa-flask text-indigo-600 mr-2"></i>
                        <h4 class="font-medium text-indigo-800">${flavor}</h4>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">SKU:</label>
                            <input type="text" 
                                   class="flavor-sku-input w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                   data-flavor="${flavor}"
                                   value="${flavorSku}"
                                   placeholder="Enter SKU for ${flavor}">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">HS Code:</label>
                            <input type="text" 
                                   class="flavor-hscode-input w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                   data-flavor="${flavor}"
                                   value="${flavorHsCode}"
                                   placeholder="e.g., 2106.90.99">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Duty Rate (%):</label>
                            <input type="number" 
                                   class="flavor-dutyrate-input w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                   data-flavor="${flavor}"
                                   value="${flavorDutyRate}"
                                   min="0" 
                                   max="100" 
                                   step="0.1"
                                   placeholder="e.g., 6.5">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">EU Notification:</label>
                            <select class="flavor-eunotification-input w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    data-flavor="${flavor}">
                                <option value="Not started" ${flavorEuNotification === 'Not started' ? 'selected' : ''}>Not started</option>
                                <option value="In Preparation" ${flavorEuNotification === 'In Preparation' ? 'selected' : ''}>In Preparation</option>
                                <option value="Waiting for approval" ${flavorEuNotification === 'Waiting for approval' ? 'selected' : ''}>Waiting for approval</option>
                                <option value="Approved" ${flavorEuNotification === 'Approved' ? 'selected' : ''}>Approved</option>
                                <option value="Declined" ${flavorEuNotification === 'Declined' ? 'selected' : ''}>Declined</option>
                                <option value="Returned for clarification" ${flavorEuNotification === 'Returned for clarification' ? 'selected' : ''}>Returned for clarification</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Notes field spans full width -->
                    <div class="mt-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Notes:</label>
                        <textarea class="flavor-notes-input w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  data-flavor="${flavor}"
                                  rows="4"
                                  placeholder="Add any notes for ${flavor}...">${flavorNotes}</textarea>
                    </div>
                    
                    <!-- Important Links field -->
                    <div class="mt-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Important Links:</label>
                        <div class="flavor-links-container block w-full" data-flavor="${flavor}">
                            ${flavorLinks.map((link, index) => `
                                <div class="flavor-link-item mb-2">
                                    <div class="flex gap-2">
                                        <input type="url" 
                                               class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                               placeholder="Enter URL..."
                                               value="${link}">
                                        <button type="button" 
                                                onclick="app.removeLinkFromFlavor('${flavor}', this)"
                                                class="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-sm">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                            <button type="button" 
                                    onclick="app.addLinkToFlavor('${flavor}')"
                                    class="mt-2 px-3 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors text-sm">
                                <i class="fas fa-plus mr-1"></i>Add Link
                            </button>
                        </div>
                    </div>
                    
                    <!-- Ingredients field spans full width -->
                    <div class="mt-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Ingredients:</label>
                        <textarea class="flavor-ingredients-input w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  data-flavor="${flavor}"
                                  rows="3"
                                  placeholder="Enter ingredients for ${flavor}...">${flavorIngredients}</textarea>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Update the showProductEditModal to populate flavor dropdown
    async populateModalFlavorDropdown() {
        console.log('Populating modal flavor dropdown...');
        const allFlavors = new Set();
        
        try {
            // Get manually created flavors from Settings
            const response = await this.authFetch('/api/flavors');
            if (response.ok) {
                const data = await response.json();
                data.flavors.forEach(flavor => allFlavors.add(flavor));
                console.log('Flavors from Settings:', data.flavors);
            }
        } catch (error) {
            console.error('Error loading flavors from Settings:', error);
        }
        
        // Get flavors from products variants
        this.products.forEach(product => {
            if (product.variants && Array.isArray(product.variants)) {
                product.variants.forEach(variant => {
                    // Simply use variant title as flavor if it's not a default
                    if (variant.title && variant.title !== 'Default Title' && variant.title.trim()) {
                        allFlavors.add(variant.title.trim());
                    }
                });
            }
        });
        
        console.log('All available flavors:', Array.from(allFlavors));

        // Populate dropdown
        const modalFlavorSelect = document.getElementById('modalFlavorSelect');
        if (modalFlavorSelect) {
            const defaultOption = '<option value="">Select flavor to add...</option>';
            const flavorOptions = Array.from(allFlavors)
                .sort()
                .map(flavor => `<option value="${flavor}">${flavor}</option>`)
                .join('');
            
            modalFlavorSelect.innerHTML = defaultOption + flavorOptions;
            console.log('Modal flavor dropdown populated with', allFlavors.size, 'flavors:', Array.from(allFlavors));
        } else {
            console.log('Modal flavor select element not found');
        }
    }

    // SKU management methods
    renderSkuFields(product) {
        const flavors = product.flavors || [];
        const skus = product.skus || {};
        
        if (flavors.length === 0) {
            // Single SKU field for products without flavors
            return `
                <div class="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                    <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 min-w-[80px]">Base SKU:</label>
                        <input type="text" id="baseSku" value="${skus.base || ''}" 
                               placeholder="Enter SKU (e.g., PROD-001)" 
                               class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm transition-all font-mono">
                    </div>
                </div>
            `;
        } else {
            // Multiple SKU fields for each flavor
            return flavors.map(flavor => `
                <div class="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 min-w-[80px] capitalize">${flavor}:</label>
                        <input type="text" data-flavor="${flavor}" class="flavor-sku" 
                               value="${skus[flavor] || ''}" 
                               placeholder="Enter SKU for ${flavor}" 
                               class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm transition-all font-mono">
                    </div>
                </div>
            `).join('');
        }
    }

    // Auto-generate SKU based on product title and flavor
    generateSku(productTitle, flavor = null) {
        // Convert product title to SKU format
        let baseSku = productTitle
            .replace(/[^\w\s]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .toUpperCase()
            .substring(0, 20); // Limit length
        
        if (flavor) {
            const flavorSku = flavor
                .replace(/[^\w\s]/g, '')
                .replace(/\s+/g, '-')
                .toUpperCase()
                .substring(0, 10);
            return `${baseSku}-${flavorSku}`;
        }
        
        return baseSku;
    }

    // Update SKU fields when flavors change
    updateSkuFields() {
        const modal = document.querySelector('.fixed');
        if (!modal) return;
        
        const skuContainer = modal.querySelector('#skuContainer');
        const assignedFlavorsDiv = modal.querySelector('#modalAssignedFlavors');
        
        if (!skuContainer || !assignedFlavorsDiv) return;
        
        // Get current flavors from modal
        const flavorElements = assignedFlavorsDiv.querySelectorAll('span');
        const currentFlavors = Array.from(flavorElements).map(span => {
            const clone = span.cloneNode(true);
            const button = clone.querySelector('button');
            if (button) button.remove();
            return clone.textContent.trim();
        });
        
        // Get product title for SKU generation
        const productTitle = modal.querySelector('h3').textContent.replace('Edit Product: ', '');
        
        // Create temporary product object
        const tempProduct = {
            title: productTitle,
            flavors: currentFlavors,
            skus: {}
        };
        
        // Get existing SKU values before re-rendering
        const existingSkus = {};
        const skuInputs = skuContainer.querySelectorAll('input');
        skuInputs.forEach(input => {
            const flavor = input.dataset.flavor || 'base';
            existingSkus[flavor] = input.value;
        });
        tempProduct.skus = existingSkus;
        
        // Don't auto-generate SKUs - let admin add them manually
        // Just preserve existing SKUs for current flavors
        currentFlavors.forEach(flavor => {
            if (existingSkus[flavor]) {
                tempProduct.skus[flavor] = existingSkus[flavor];
            }
            // New flavors will show empty fields (which will display "Not added" in product cards)
        });
        
        // Re-render SKU fields
        skuContainer.innerHTML = this.renderSkuFields(tempProduct);
    }

    // Render SKUs for product cards
    renderProductSkus(product) {
        const skus = product.skus || {};
        
        // If product has flavors, show SKU for each flavor (or "Not added")
        if (product.flavors && product.flavors.length > 0) {
            const skuList = product.flavors
                .map(flavor => {
                    const skuValue = skus[flavor] || 'Not added';
                    const isNotAdded = skuValue === 'Not added';
                    return `${flavor}: <span class="${isNotAdded ? 'text-gray-400 italic' : 'font-mono'}">${skuValue}</span>`;
                })
                .join(', ');
            
            return `
                <div class="mb-2">
                    <p class="text-xs text-indigo-600 mb-1">
                        <i class="fas fa-barcode mr-1"></i><strong>SKUs:</strong>
                    </p>
                    <p class="text-xs text-gray-700">${skuList}</p>
                </div>
            `;
        } else {
            // Single SKU for products without flavors (or "Not added")
            const skuValue = skus.base || 'Not added';
            const isNotAdded = skuValue === 'Not added';
            
            return `
                <div class="mb-2">
                    <p class="text-xs text-indigo-600 mb-1">
                        <i class="fas fa-barcode mr-1"></i><strong>SKU:</strong>
                    </p>
                    <p class="text-xs text-gray-700 ${isNotAdded ? 'text-gray-400 italic' : 'font-mono'}">${skuValue}</p>
                </div>
            `;
        }
    }

    // Render HS Code for product cards
    renderProductHsCode(product) {
        // Use manually set HS code if available, otherwise analyze and suggest
        let hsCodeInfo;
        if (product.hsCode) {
            hsCodeInfo = {
                code: product.hsCode,
                description: product.hsCodeDescription || 'Manually set',
                confidence: 'manual'
            };
        } else {
            hsCodeInfo = this.analyzeHsCode(product);
        }
        
        const confidenceClass = {
            manual: 'text-green-700 bg-green-50',
            suggested: 'text-blue-700 bg-blue-50',
            default: 'text-gray-700 bg-gray-50'
        }[hsCodeInfo.confidence] || 'text-gray-700 bg-gray-50';
        
        const confidenceIcon = {
            manual: 'fas fa-check-circle',
            suggested: 'fas fa-lightbulb',
            default: 'fas fa-question-circle'
        }[hsCodeInfo.confidence] || 'fas fa-question-circle';
        
        return `
            <div class="mb-2">
                <p class="text-xs text-yellow-600 mb-1">
                    <i class="fas fa-shipping-fast mr-1"></i><strong>HS Code:</strong>
                </p>
                <div class="flex items-center gap-2">
                    <span class="px-2 py-1 text-xs rounded-full font-mono ${confidenceClass}">
                        ${hsCodeInfo.code}
                    </span>
                    <span class="text-xs text-gray-600">
                        <i class="${confidenceIcon} mr-1"></i>
                        ${hsCodeInfo.confidence === 'manual' ? 'Set' : hsCodeInfo.confidence === 'suggested' ? 'AI suggested' : 'Default'}
                    </span>
                </div>
                <p class="text-xs text-gray-500 mt-1">${hsCodeInfo.description}</p>
            </div>
        `;
    }

    // Render Duty (%) for product cards
    renderProductDuty(product) {
        const dutyRate = product.dutyRate;
        
        if (dutyRate !== undefined && dutyRate !== null && dutyRate !== '') {
            return `
                <div class="mb-2">
                    <p class="text-xs text-red-600 mb-1">
                        <i class="fas fa-percent mr-1"></i><strong>Duty Rate:</strong>
                    </p>
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-1 text-xs rounded-full font-semibold bg-red-50 text-red-700">
                            ${dutyRate}%
                        </span>
                        <span class="text-xs text-gray-600">
                            <i class="fas fa-check-circle mr-1"></i>Set
                        </span>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="mb-2">
                    <p class="text-xs text-red-600 mb-1">
                        <i class="fas fa-percent mr-1"></i><strong>Duty Rate:</strong>
                    </p>
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-1 text-xs rounded-full bg-gray-50 text-gray-500 italic">
                            Not set
                        </span>
                        <span class="text-xs text-gray-400">
                            <i class="fas fa-exclamation-circle mr-1"></i>Needs input
                        </span>
                    </div>
                </div>
            `;
        }
    }

    // Render Goals hierarchy for product cards
    renderProductGoalsHierarchy(product) {
        const productGoals = product.goals || [];
        if (productGoals.length === 0) return '';

        // Group goals by parent-child relationship
        const goalHierarchy = {};
        productGoals.forEach(goalName => {
            let parentFound = false;
            // Check if this goal is a sub-goal of any parent
            this.goals.forEach(parentGoal => {
                if (parentGoal.subGoals && parentGoal.subGoals.includes(goalName)) {
                    if (!goalHierarchy[parentGoal.name]) {
                        goalHierarchy[parentGoal.name] = {
                            parent: parentGoal,
                            children: []
                        };
                    }
                    goalHierarchy[parentGoal.name].children.push(goalName);
                    parentFound = true;
                }
            });
            // If it's not a sub-goal, it might be a parent goal
            if (!parentFound) {
                const parentGoal = this.goals.find(g => g.name === goalName);
                if (parentGoal) {
                    if (!goalHierarchy[parentGoal.name]) {
                        goalHierarchy[parentGoal.name] = {
                            parent: parentGoal,
                            children: []
                        };
                    }
                }
            }
        });

        return `
            <div class="mb-3">
                <p class="text-xs text-blue-600 mb-1">
                    <i class="fas fa-bullseye mr-1"></i><strong>Goals & Sub-Goals:</strong>
                </p>
                <div class="space-y-1">
                    ${Object.values(goalHierarchy).map(({ parent, children }) => `
                        <div class="border border-blue-200 rounded p-2 bg-blue-50">
                            <div class="flex items-center mb-1">
                                <i class="fas fa-target text-blue-600 mr-1 text-xs"></i>
                                <span class="font-medium text-blue-800 text-sm">${parent.name}</span>
                            </div>
                            ${children.length > 0 ? `
                                <div class="ml-4 space-y-0.5">
                                    ${children.map(subGoal => `
                                        <div class="flex items-center text-xs">
                                            <i class="fas fa-arrow-right text-blue-400 mr-1"></i>
                                            <span class="text-blue-700">${subGoal}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Render per-flavor details for product cards
    // Helper method to check if a product has any flavors with SKUs
    hasAnyFlavorWithSku(product) {
        if (!product.flavors || product.flavors.length === 0) return false;
        
        return product.flavors.some(flavor => {
            const flavorSku = product.flavorSkus && product.flavorSkus[flavor] ? product.flavorSkus[flavor] : 
                             (product.skus && product.skus[flavor] ? product.skus[flavor] : null);
            return flavorSku && flavorSku !== 'Not set';
        });
    }

    // Helper method to check if a specific flavor has SKU
    flavorHasSku(product, flavor) {
        const flavorSku = product.flavorSkus && product.flavorSkus[flavor] ? product.flavorSkus[flavor] : 
                         (product.skus && product.skus[flavor] ? product.skus[flavor] : null);
        return flavorSku && flavorSku !== 'Not set';
    }

    renderPerFlavorDetails(product) {
        if (!product.flavors || product.flavors.length === 0) return '';

        return `
            <div class="mb-3">
                <p class="text-xs text-purple-600 mb-1">
                    <i class="fas fa-list-alt mr-1"></i><strong>Per-Flavor Details:</strong>
                </p>
                <div class="space-y-2">
                    ${product.flavors.map(flavor => {
                        // Get flavor-specific data with fallback to product-level data
                        const flavorSku = product.flavorSkus && product.flavorSkus[flavor] ? product.flavorSkus[flavor] : 
                                         (product.skus && product.skus[flavor] ? product.skus[flavor] : 'Not set');
                        const flavorHsCode = product.flavorHsCodes && product.flavorHsCodes[flavor] ? product.flavorHsCodes[flavor] : 
                                           (product.hsCode ? product.hsCode : 'Not set');
                        const flavorDutyRate = product.flavorDutyRates && product.flavorDutyRates[flavor] ? product.flavorDutyRates[flavor] : 
                                             (product.dutyRate ? product.dutyRate : 'Not set');
                        const flavorEuNotification = product.flavorEuNotifications && product.flavorEuNotifications[flavor] ? product.flavorEuNotifications[flavor] : 
                                                   (product.euNotificationStatus ? product.euNotificationStatus : 'Not set');

                        const hasFlavorSku = this.flavorHasSku(product, flavor);
                        
                        return `
                            <div class="border rounded p-2 ${hasFlavorSku ? 'border-purple-200 bg-purple-50' : 'border-gray-300 bg-gray-50 opacity-70'}">
                                <div class="flex items-center mb-2">
                                    <i class="fas fa-flask mr-1 text-xs ${hasFlavorSku ? 'text-purple-600' : 'text-gray-500'}"></i>
                                    <span class="font-medium text-sm ${hasFlavorSku ? 'text-purple-800' : 'text-gray-600'}">${flavor}</span>
                                    ${!hasFlavorSku ? '<span class="ml-2 px-2 py-0.5 text-xs bg-orange-200 text-orange-800 rounded-full">Incomplete</span>' : ''}
                                </div>
                                <div class="grid grid-cols-2 gap-2 text-xs">
                                    <div class="flex items-center space-x-1">
                                        <span class="text-gray-600 min-w-fit">SKU:</span>
                                        <span class="px-1 py-0.5 rounded text-xs ${flavorSku !== 'Not set' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}">${flavorSku}</span>
                                    </div>
                                    <div class="flex items-center space-x-1">
                                        <span class="text-gray-600 min-w-fit">HS:</span>
                                        <span class="px-1 py-0.5 rounded text-xs ${flavorHsCode !== 'Not set' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}">${flavorHsCode}</span>
                                    </div>
                                    <div class="flex items-center space-x-1">
                                        <span class="text-gray-600 min-w-fit">Duty:</span>
                                        <span class="px-1 py-0.5 rounded text-xs ${flavorDutyRate !== 'Not set' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}">${flavorDutyRate}${flavorDutyRate !== 'Not set' ? '%' : ''}</span>
                                    </div>
                                    <div class="flex items-center space-x-1">
                                        <span class="text-gray-600 min-w-fit">EU:</span>
                                        <span class="px-1 py-0.5 rounded text-xs ${flavorEuNotification !== 'Not set' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}">${flavorEuNotification}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // Initialize SKU fields for a product (don't auto-generate, let admin add manually)
    initializeSkuFields(product) {
        const modal = document.querySelector('.fixed');
        if (!modal) return;
        
        const skuContainer = modal.querySelector('#skuContainer');
        if (!skuContainer) return;
        
        // Just render the SKU fields as they are, without auto-generating
        skuContainer.innerHTML = this.renderSkuFields(product);
    }

    // Refresh HS code suggestion for a product
    refreshHsCodeSuggestion(productHandle) {
        const modal = document.querySelector('.fixed');
        if (!modal) return;

        // Find the product
        const product = this.products.find(p => 
            p.handle === productHandle || p.title === productHandle
        );
        
        if (!product) return;

        // Get fresh analysis
        const hsCodeInfo = this.analyzeHsCode(product);
        
        // Update the display elements
        const currentHsCodeEl = modal.querySelector('#currentHsCode');
        const hsCodeDescriptionEl = modal.querySelector('#hsCodeDescription');
        
        if (currentHsCodeEl) {
            currentHsCodeEl.textContent = hsCodeInfo.code;
        }
        
        if (hsCodeDescriptionEl) {
            hsCodeDescriptionEl.textContent = hsCodeInfo.description;
        }
        
        // Show feedback
        const button = modal.querySelector('button[onclick*="refreshHsCodeSuggestion"]');
        if (button) {
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check mr-1"></i>Updated';
            button.classList.add('text-green-600');
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('text-green-600');
            }, 2000);
        }
    }
}

// Global functions for navigation
async function showPage(pageId, element) {
    if (window.app) {
        await window.app.showPage(pageId, element);
    }
}

function addCategory() {
    console.log('Global addCategory called, window.app:', window.app);
    if (window.app) {
        window.app.addCategory();
    } else {
        console.error('window.app not available');
    }
}

function addGoal() {
    if (window.app) {
        window.app.addGoal();
    }
}

function addFlavor() {
    if (window.app) {
        window.app.addFlavor();
    }
}

function deleteFlavor(flavorName, button) {
    if (window.app) {
        window.app.deleteFlavor(flavorName, button);
    }
}


function addFlavorToModal() {
    if (window.app) {
        window.app.addFlavorToModal();
    }
}

function removeFlavorFromModal(flavorName, button) {
    if (window.app) {
        window.app.removeFlavorFromModal(flavorName, button);
    }
}

// Price Analysis global functions
function updateAllCalculations() {
    if (window.app) {
        window.app.loadPriceAnalysis();
    }
}

function updateRowCalculation(rowIndex, value, field) {
    // This function would update individual row calculations
    // For now, we'll trigger a full recalculation
    updateAllCalculations();
}

function exportToCSV() {
    if (!window.app) return;
    
    const table = document.getElementById('priceAnalysisTable');
    if (!table) return;
    
    const rows = [];
    const headerCells = table.querySelectorAll('thead th');
    const headers = Array.from(headerCells).map(cell => cell.textContent.trim());
    rows.push(headers.join(','));
    
    const bodyRows = table.querySelectorAll('tbody tr');
    bodyRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowData = Array.from(cells).map(cell => {
            // Get text content, but handle input fields specially
            const input = cell.querySelector('input');
            if (input) {
                return input.value;
            }
            return cell.textContent.trim().replace(/[,€$]/g, '');
        });
        rows.push(rowData.join(','));
    });
    
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `price_analysis_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function resetToDefaults() {
    document.getElementById('usdEurRateGlobal').value = 0.92;
    document.getElementById('partnerDiscountGlobal').value = 15;
    document.getElementById('dutyRateGlobal').value = 12;
    document.getElementById('markupGlobal').value = 50;
    document.getElementById('vatGlobal').value = 21;
    document.getElementById('deliveryGlobal').value = 5.00;
    document.getElementById('transportGlobal').value = 2.50;
    updateAllCalculations();
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MomentousApp();
});