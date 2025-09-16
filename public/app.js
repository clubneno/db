// Momentous Product Manager Application
// Modern vanilla JS with Supabase integration

class ProductManager {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.products = [];
        this.categories = [];
        this.subcategories = [];
        this.currentProduct = null;
        
        this.init();
    }

    async init() {
        console.log('Initializing Product Manager...');
        
        try {
            // Initialize Supabase
            await this.initSupabase();
            
            // Check authentication
            const isAuthenticated = await this.checkAuth();
            
            if (!isAuthenticated) {
                this.redirectToLogin();
                return;
            }

            // Setup UI
            this.setupEventListeners();
            this.setupTabNavigation();
            
            // Load initial data
            await this.loadInitialData();
            
            // Show the app
            this.showApp();
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application');
        }
    }

    async initSupabase() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            
            if (!config.supabaseUrl || !config.supabaseKey) {
                throw new Error('Invalid Supabase configuration');
            }
            
            this.supabase = supabase.createClient(config.supabaseUrl, config.supabaseKey);
            console.log('Supabase client initialized');
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            throw error;
        }
    }

    async checkAuth() {
        // For now, skip authentication and use a default user
        // In production, implement proper authentication
        this.currentUser = { email: 'admin@momentous.com' };
        this.updateUserDisplay();
        return true;
    }

    updateUserDisplay() {
        const userElement = document.getElementById('currentUser');
        if (userElement && this.currentUser) {
            const displayName = this.currentUser.email?.split('@')[0] || 'User';
            userElement.textContent = displayName;
        }
    }

    redirectToLogin() {
        console.log('Redirecting to login...');
        // For now, show an alert - in production, redirect to login page
        alert('Please log in to access the Product Manager');
        // window.location.href = '/login.html';
    }

    async logout() {
        // For now, just redirect since we're not using real authentication
        this.redirectToLogin();
    }

    showApp() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('app').classList.remove('hidden');
    }

    showError(message) {
        alert(message); // In production, use a proper toast notification
    }

    setupEventListeners() {
        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        // Add product button
        document.getElementById('addProductBtn').addEventListener('click', () => {
            this.showAddProductModal();
        });

        // Search and filters
        document.getElementById('searchInput').addEventListener('input', 
            this.debounce(() => this.filterProducts(), 300)
        );
        
        ['categoryFilter', 'sortFilter'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                this.filterProducts();
            });
        });
        
        // Goal filter
        document.getElementById('goalFilter').addEventListener('input', 
            this.debounce(() => this.filterProducts(), 300)
        );

        // Modal controls
        document.getElementById('closeModalBtn').addEventListener('click', () => {
            this.hideModal();
        });
        
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('productForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        // Add category/subcategory buttons
        document.getElementById('addCategoryBtn').addEventListener('click', () => {
            this.addCategory();
        });
        
        document.getElementById('addSubcategoryBtn').addEventListener('click', () => {
            this.addSubcategory();
        });
    }

    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;
                
                // Update active tab button
                tabButtons.forEach(btn => {
                    btn.classList.remove('active', 'border-primary', 'text-primary');
                    btn.classList.add('border-transparent', 'text-gray-700');
                });
                
                button.classList.remove('border-transparent', 'text-gray-700');
                button.classList.add('active', 'border-primary', 'text-primary');
                
                // Show/hide tab content
                tabContents.forEach(content => {
                    content.classList.add('hidden');
                });
                
                document.getElementById(tabId).classList.remove('hidden');
                
                // Load tab-specific data if needed
                this.onTabChanged(tabId);
            });
        });
    }

    async onTabChanged(tabId) {
        switch (tabId) {
            case 'dashboard':
                await this.updateDashboard();
                break;
            case 'products':
                await this.loadProducts();
                break;
            case 'categories':
                await this.loadCategories();
                break;
        }
    }

    async loadInitialData() {
        document.getElementById('loadingText').textContent = 'Loading data...';
        
        try {
            await Promise.all([
                this.loadProducts(),
                this.loadCategories()
            ]);
            
            // Load subcategories as part of categories
            await this.renderCategories();
            
            await this.updateDashboard();
            
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showError('Failed to load data');
        }
    }

    async refreshData() {
        const refreshBtn = document.getElementById('refreshBtn');
        const originalText = refreshBtn.innerHTML;
        
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Refreshing...';
        refreshBtn.disabled = true;
        
        try {
            await this.loadInitialData();
        } catch (error) {
            console.error('Refresh failed:', error);
            this.showError('Failed to refresh data');
        } finally {
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }
    }

    async loadProducts() {
        try {
            // Use the enhanced endpoint that includes category relationships
            const response = await fetch('/api/products/with-categories');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            this.products = data.products || [];
            console.log('Products loaded with categories:', this.products.length);
            this.renderProducts();
            this.updateProductFilters();
            
        } catch (error) {
            console.error('Failed to load products with categories:', error);
            // Fallback to regular products endpoint
            try {
                const fallbackResponse = await fetch('/api/products');
                if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json();
                    this.products = fallbackData.products || [];
                    console.log('Products loaded (fallback):', this.products.length);
                } else {
                    this.products = [];
                }
                this.renderProducts();
                this.updateProductFilters();
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
                this.products = [];
                this.renderProducts();
            }
        }
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/categories');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            this.categories = data.categories || [];
            this.renderCategories();
            
        } catch (error) {
            console.error('Failed to load categories:', error);
            this.categories = [];
            this.renderCategories();
        }
    }

    async loadSubcategories() {
        try {
            const { data, error } = await this.supabase
                .from('categories')
                .select('*')
                .eq('is_sub_category', true)
                .order('name', { ascending: true });

            if (error) throw error;

            this.subcategories = data || [];
            this.renderSubcategories();
            
        } catch (error) {
            console.error('Failed to load subcategories:', error);
            this.subcategories = [];
            this.renderSubcategories();
        }
    }

    renderProducts() {
        const grid = document.getElementById('productsGrid');
        const loading = document.getElementById('loadingProducts');
        const noProducts = document.getElementById('noProducts');
        const productCount = document.getElementById('productCount');

        loading.classList.add('hidden');
        
        if (!this.products || this.products.length === 0) {
            grid.classList.add('hidden');
            noProducts.classList.remove('hidden');
            productCount.textContent = '0';
            return;
        }

        noProducts.classList.add('hidden');
        grid.classList.remove('hidden');
        productCount.textContent = this.products.length;

        grid.innerHTML = this.products.map(product => this.createProductCard(product)).join('');
    }

    createProductCard(product) {
        const price = product.price_amount ? `$${product.price_amount}` : 'N/A';
        const image = product.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMjUgNzVIMTc1VjEyNUgxMjVWNzVaIiBmaWxsPSIjOUI5Q0E0Ii8+CjxyZWN0IHg9IjEzNyIgeT0iMTAwIiB3aWR0aD0iMjUiIGhlaWdodD0iNSIgZmlsbD0iIzlCOUNBNCIvPgo8dGV4dCB4PSIxNTAiIHk9IjE1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOUI5Q0E0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD4KPC9zdmc+';
        const title = product.title || 'Untitled Product';
        const description = product.description ? 
            (product.description.length > 100 ? product.description.substring(0, 100) + '...' : product.description) : 
            'No description available';
        
        // Generate category display
        const categoryDisplay = this.generateCategoryDisplay(product);
        
        return `
            <div class="product-card bg-white rounded-lg shadow overflow-hidden fade-in">
                <img src="${image}" alt="${title}" class="w-full h-48 object-cover" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMjUgNzVIMTc1VjEyNUgxMjVWNzVaIiBmaWxsPSIjOUI5Q0E0Ii8+CjxyZWN0IHg9IjEzNyIgeT0iMTAwIiB3aWR0aD0iMjUiIGhlaWdodD0iNSIgZmlsbD0iIzlCOUNBNCIvPgo8dGV4dCB4PSIxNTAiIHk9IjE1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOUI5Q0E0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD4KPC9zdmc+'">
                <div class="p-4">
                    <div class="mb-2">
                        ${categoryDisplay}
                    </div>
                    <h4 class="font-heading font-semibold text-lg text-gray-900 mb-2">${title}</h4>
                    <p class="text-gray-600 text-sm mb-3">${description}</p>
                    <div class="flex justify-between items-center">
                        <span class="text-lg font-semibold text-primary">${price}</span>
                        <button onclick="app.editProduct(${product.id})" 
                                class="bg-secondary text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors">
                            <i class="fas fa-edit mr-1"></i>Edit
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    generateCategoryDisplay(product) {
        // Handle both new structure (with product_categories) and old structure (single category)
        let categories = [];
        
        if (product.product_categories && product.product_categories.length > 0) {
            // New structure: multiple categories via junction table
            categories = product.product_categories.map(pc => pc.categories).filter(Boolean);
        } else if (product.category) {
            // Old structure: single category field
            const category = this.categories.find(c => c.name === product.category);
            if (category) categories = [category];
        }
        
        if (categories.length === 0) {
            return '<div class="text-sm text-gray-500 italic">No categories assigned</div>';
        }
        
        // Create hierarchical grouping for display
        return this.generateHierarchicalCategoryDisplay(categories);
    }

    generateHierarchicalCategoryDisplay(categories) {
        // Group categories by parent-child relationships
        const hierarchyMap = new Map();
        
        categories.forEach(category => {
            if (category.is_sub_category) {
                // Find parent category
                const parent = this.categories.find(cat => cat.id === category.parent_id);
                if (parent) {
                    const key = `${parent.id}-${parent.name}`;
                    if (!hierarchyMap.has(key)) {
                        hierarchyMap.set(key, {
                            parent: parent,
                            subcategories: [],
                            parentSelected: categories.some(c => c.id === parent.id)
                        });
                    }
                    hierarchyMap.get(key).subcategories.push(category);
                }
            } else {
                // Parent category
                const key = `${category.id}-${category.name}`;
                if (!hierarchyMap.has(key)) {
                    hierarchyMap.set(key, {
                        parent: category,
                        subcategories: [],
                        parentSelected: true
                    });
                }
            }
        });

        // Color schemes for different category hierarchies
        const colorSchemes = [
            {
                gradient: 'from-blue-50 to-blue-100',
                border: 'border-blue-200',
                parentText: 'text-blue-800',
                arrow: 'text-blue-600',
                subText: 'text-blue-700',
                subBg: 'bg-blue-200',
                parentOnlyBg: 'bg-blue-100',
                parentOnlyText: 'text-blue-800'
            },
            {
                gradient: 'from-emerald-50 to-emerald-100',
                border: 'border-emerald-200',
                parentText: 'text-emerald-800',
                arrow: 'text-emerald-600',
                subText: 'text-emerald-700',
                subBg: 'bg-emerald-200',
                parentOnlyBg: 'bg-emerald-100',
                parentOnlyText: 'text-emerald-800'
            },
            {
                gradient: 'from-purple-50 to-purple-100',
                border: 'border-purple-200',
                parentText: 'text-purple-800',
                arrow: 'text-purple-600',
                subText: 'text-purple-700',
                subBg: 'bg-purple-200',
                parentOnlyBg: 'bg-purple-100',
                parentOnlyText: 'text-purple-800'
            },
            {
                gradient: 'from-amber-50 to-amber-100',
                border: 'border-amber-200',
                parentText: 'text-amber-800',
                arrow: 'text-amber-600',
                subText: 'text-amber-700',
                subBg: 'bg-amber-200',
                parentOnlyBg: 'bg-amber-100',
                parentOnlyText: 'text-amber-800'
            },
            {
                gradient: 'from-rose-50 to-rose-100',
                border: 'border-rose-200',
                parentText: 'text-rose-800',
                arrow: 'text-rose-600',
                subText: 'text-rose-700',
                subBg: 'bg-rose-200',
                parentOnlyBg: 'bg-rose-100',
                parentOnlyText: 'text-rose-800'
            },
            {
                gradient: 'from-indigo-50 to-indigo-100',
                border: 'border-indigo-200',
                parentText: 'text-indigo-800',
                arrow: 'text-indigo-600',
                subText: 'text-indigo-700',
                subBg: 'bg-indigo-200',
                parentOnlyBg: 'bg-indigo-100',
                parentOnlyText: 'text-indigo-800'
            },
            {
                gradient: 'from-teal-50 to-teal-100',
                border: 'border-teal-200',
                parentText: 'text-teal-800',
                arrow: 'text-teal-600',
                subText: 'text-teal-700',
                subBg: 'bg-teal-200',
                parentOnlyBg: 'bg-teal-100',
                parentOnlyText: 'text-teal-800'
            }
        ];

        // Generate HTML for each hierarchy path with different colors
        const hierarchyTags = [];
        let colorIndex = 0;
        
        hierarchyMap.forEach(({ parent, subcategories, parentSelected }) => {
            const colors = colorSchemes[colorIndex % colorSchemes.length];
            colorIndex++;
            
            if (subcategories.length > 0) {
                // Parent → Subcategory structure with unique colors
                hierarchyTags.push(`
                    <div class="inline-flex items-center bg-gradient-to-r ${colors.gradient} border ${colors.border} rounded-lg px-2 py-1 mb-1 mr-1">
                        <span class="${colors.parentText} font-medium text-xs">${parent.name}</span>
                        <i class="fas fa-arrow-right ${colors.arrow} mx-1 text-xs"></i>
                        <div class="flex flex-wrap">
                            ${subcategories.map(sub => `
                                <span class="${colors.subText} text-xs ${colors.subBg} rounded px-1 ml-1">${sub.name}</span>
                            `).join('')}
                        </div>
                    </div>
                `);
            } else if (parentSelected) {
                // Parent only with unique colors
                hierarchyTags.push(`
                    <div class="inline-flex items-center ${colors.parentOnlyBg} ${colors.parentOnlyText} px-2 py-1 rounded-lg text-xs font-medium mb-1 mr-1">
                        ${parent.name}
                    </div>
                `);
            }
        });

        return `<div class="category-hierarchy-display">${hierarchyTags.join('')}</div>`;
    }

    renderCategories() {
        const mainContainer = document.getElementById('mainCategoriesList');
        const subContainer = document.getElementById('subcategoriesList');
        
        // Filter main categories and subcategories
        const mainCategories = this.categories.filter(cat => !cat.is_sub_category);
        const subcategories = this.categories.filter(cat => cat.is_sub_category);
        
        // Render hierarchical category tree
        this.renderHierarchicalCategories(mainContainer, mainCategories, subcategories);
        
        // Hide the old subcategories container since we're showing everything hierarchically
        if (subContainer) {
            subContainer.style.display = 'none';
        }
    }

    renderHierarchicalCategories(container, mainCategories, subcategories) {
        if (!mainCategories || mainCategories.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">No categories found</p>';
            return;
        }

        const hierarchicalHTML = mainCategories.map(mainCategory => {
            const childSubcategories = subcategories.filter(sub => sub.parent_id === mainCategory.id);
            
            return `
                <div class="border border-gray-200 rounded-lg mb-4">
                    <!-- Parent Category -->
                    <div class="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                        <div class="flex items-center">
                            <i class="fas fa-folder text-blue-600 mr-3 text-lg"></i>
                            <div>
                                <span class="font-semibold text-blue-900">${mainCategory.name}</span>
                                <div class="text-sm text-blue-700">Parent Category</div>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded-full">
                                ${childSubcategories.length} subcategories
                            </span>
                            <button onclick="app.deleteCategory(${mainCategory.id})" 
                                    class="text-red-600 hover:text-red-800 text-sm p-2 rounded-full hover:bg-red-100">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Subcategories -->
                    ${childSubcategories.length > 0 ? `
                        <div class="p-2">
                            ${childSubcategories.map(subcategory => `
                                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2 ml-4">
                                    <div class="flex items-center">
                                        <i class="fas fa-arrow-right text-gray-400 mr-2"></i>
                                        <i class="fas fa-folder-open text-secondary mr-3"></i>
                                        <div>
                                            <span class="font-medium text-gray-900">${subcategory.name}</span>
                                            <div class="text-sm text-gray-500">└ ${mainCategory.name} → ${subcategory.name}</div>
                                        </div>
                                    </div>
                                    <button onclick="app.deleteCategory(${subcategory.id})" 
                                            class="text-red-600 hover:text-red-800 text-sm p-2 rounded-full hover:bg-red-100">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="p-4 text-center text-gray-500 text-sm">
                            <i class="fas fa-info-circle mr-2"></i>
                            No subcategories yet. Create subcategories to organize products under this category.
                        </div>
                    `}
                </div>
            `;
        }).join('');

        container.innerHTML = hierarchicalHTML;
    }

    renderSubcategories() {
        // This function is now handled within renderCategories()
        // Keep for compatibility but delegate to renderCategories
        this.renderCategories();
    }

    updateProductFilters() {
        // Update category filter with all categories (main and sub)
        const categoryFilter = document.getElementById('categoryFilter');
        const uniqueCategories = [...new Set(this.products.map(p => p.category).filter(Boolean))];
        
        categoryFilter.innerHTML = '<option value="">All Categories</option>' + 
            uniqueCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    filterProducts() {
        const search = document.getElementById('searchInput').value.toLowerCase();
        const categoryFilter = document.getElementById('categoryFilter').value;
        const goalFilter = document.getElementById('goalFilter').value.toLowerCase();
        const sortFilter = document.getElementById('sortFilter').value;

        let filtered = [...this.products];

        // Apply search filter
        if (search) {
            filtered = filtered.filter(product => 
                (product.title?.toLowerCase() || '').includes(search) ||
                (product.description?.toLowerCase() || '').includes(search)
            );
        }

        // Apply category filter
        if (categoryFilter) {
            filtered = filtered.filter(product => product.category === categoryFilter);
        }
        
        // Apply goal filter
        if (goalFilter) {
            filtered = filtered.filter(product => 
                (product.primary_goal?.toLowerCase() || '').includes(goalFilter)
            );
        }

        // Apply sorting
        if (sortFilter) {
            switch (sortFilter) {
                case 'title':
                    filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                    break;
                case 'title_desc':
                    filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
                    break;
                case 'price_asc':
                    filtered.sort((a, b) => (a.price_amount || 0) - (b.price_amount || 0));
                    break;
                case 'price_desc':
                    filtered.sort((a, b) => (b.price_amount || 0) - (a.price_amount || 0));
                    break;
            }
        }

        // Update the products display
        const originalProducts = this.products;
        this.products = filtered;
        this.renderProducts();
        this.products = originalProducts; // Restore original list
    }

    async updateDashboard() {
        try {
            const totalProducts = this.products.length;
            const avgPrice = this.products.length > 0 ? 
                this.products.reduce((sum, p) => sum + (p.price_amount || 0), 0) / this.products.length : 0;
            
            const mainCategories = this.categories.filter(cat => !cat.is_sub_category);
            const subcategories = this.categories.filter(cat => cat.is_sub_category);
            
            document.getElementById('totalProducts').textContent = totalProducts;
            document.getElementById('avgPrice').textContent = `$${avgPrice.toFixed(2)}`;
            document.getElementById('totalCategories').textContent = mainCategories.length;
            document.getElementById('totalSubcategories').textContent = subcategories.length;
            
        } catch (error) {
            console.error('Failed to update dashboard:', error);
        }
    }

    async editProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        this.currentProduct = product;
        this.showEditProductModal(product);
    }

    showAddProductModal() {
        this.currentProduct = null;
        this.showEditProductModal();
    }

    showEditProductModal(product = null) {
        const modal = document.getElementById('productModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('productForm');

        modalTitle.textContent = product ? 'Edit Product' : 'Add Product';
        
        // Generate form fields
        form.innerHTML = this.generateProductForm(product);
        
        // Initialize category selection
        this.initializeCategorySelection(product);
        
        modal.classList.remove('hidden');
    }

    async initializeCategorySelection(product) {
        // Initialize the hierarchical category selector
        this.categorySelector = new CategorySelector(
            this.categories,
            (selectedCategoryIds) => {
                this.onCategorySelectionChange(selectedCategoryIds);
            }
        );
        
        // Render the selector in the modal
        this.categorySelector.render('hierarchicalCategorySelector');
        
        // Load existing categories for the product if editing
        if (product && product.id) {
            await this.loadProductCategories(product.id);
        }
    }

    onCategorySelectionChange(selectedCategoryIds) {
        // This will be called whenever category selection changes
        if (this.currentProduct && this.currentProduct.id) {
            this.saveProductCategories(this.currentProduct.id, selectedCategoryIds);
        }
    }

    async saveProductCategories(productId, categoryIds) {
        try {
            const response = await fetch(`/api/products/${productId}/categories`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ category_ids: categoryIds })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            // Refresh the product list to show updated categories
            await this.loadProducts();
            this.renderProducts();
            
        } catch (error) {
            console.error('Failed to save product categories:', error);
            alert('Failed to save category assignments. Please try again.');
        }
    }

    async loadProductCategories(productId) {
        try {
            const response = await fetch(`/api/products/${productId}/categories`);
            if (response.ok) {
                const data = await response.json();
                const categoryIds = data.categories.map(cat => cat.id);
                
                // Set the selected categories in the hierarchical selector
                if (this.categorySelector) {
                    this.categorySelector.setSelectedCategories(categoryIds);
                }
            }
        } catch (error) {
            console.log('Could not load product categories (junction table may not exist yet)');
            // Fallback to old single category if available
            if (this.currentProduct && this.currentProduct.category) {
                const category = this.categories.find(c => c.name === this.currentProduct.category);
                if (category && this.categorySelector) {
                    this.categorySelector.setSelectedCategories([category.id]);
                }
            }
        }
    }

    addCategoryToSelection(categoryId, categoryName, shouldSave = true) {
        if (this.selectedCategories.has(categoryId)) return;
        
        this.selectedCategories.add(categoryId);
        this.renderSelectedCategories();
        
        if (shouldSave && this.currentProduct && this.currentProduct.id) {
            this.saveCategoryToProduct(this.currentProduct.id, categoryId);
        }
    }

    removeCategoryFromSelection(categoryId, shouldSave = true) {
        this.selectedCategories.delete(categoryId);
        this.renderSelectedCategories();
        
        if (shouldSave && this.currentProduct && this.currentProduct.id) {
            this.removeCategoryFromProduct(this.currentProduct.id, categoryId);
        }
    }

    renderSelectedCategories() {
        const container = document.getElementById('selectedCategories');
        if (!container) return;
        
        const categoryTags = Array.from(this.selectedCategories).map(categoryId => {
            const category = this.categories.find(c => c.id == categoryId);
            if (!category) return '';
            
            const prefix = category.is_sub_category ? '└ ' : '';
            return `
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    ${prefix}${category.name}
                    <button type="button" class="ml-1 text-blue-600 hover:text-blue-800" onclick="app.removeCategoryFromSelection('${categoryId}')">
                        <i class="fas fa-times"></i>
                    </button>
                </span>
            `;
        }).join('');
        
        container.innerHTML = categoryTags;
    }

    async saveCategoryToProduct(productId, categoryId) {
        try {
            await fetch(`/api/products/${productId}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category_id: categoryId })
            });
        } catch (error) {
            console.error('Failed to save category to product:', error);
        }
    }

    async removeCategoryFromProduct(productId, categoryId) {
        try {
            await fetch(`/api/products/${productId}/categories/${categoryId}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error('Failed to remove category from product:', error);
        }
    }

    generateProductForm(product) {
        const data = product || {};
        
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                    <input type="text" name="title" value="${data.title || ''}" required
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Handle/Slug</label>
                    <input type="text" name="handle" value="${data.handle || ''}"
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Price ($)</label>
                    <input type="number" name="price_amount" value="${data.price_amount || ''}" step="0.01"
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <select name="price_currency" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                        <option value="USD" ${data.price_currency === 'USD' ? 'selected' : ''}>USD</option>
                        <option value="EUR" ${data.price_currency === 'EUR' ? 'selected' : ''}>EUR</option>
                    </select>
                </div>
                
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Categories & Subcategories</label>
                    <div id="hierarchicalCategorySelector">
                        <!-- Hierarchical category selector will be rendered here -->
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Primary Goal</label>
                    <input type="text" name="primary_goal" value="${data.primary_goal || ''}"
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                </div>
                
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Image URL</label>
                    <input type="url" name="image" value="${data.image || ''}"
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                </div>
                
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Product Link</label>
                    <input type="url" name="link" value="${data.link || ''}"
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                </div>
                
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea name="description" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">${data.description || ''}</textarea>
                </div>
                
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Full Description</label>
                    <textarea name="full_description" rows="4" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">${data.full_description || ''}</textarea>
                </div>
            </div>
        `;
    }

    hideModal() {
        document.getElementById('productModal').classList.add('hidden');
    }

    async saveProduct() {
        const form = document.getElementById('productForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Convert numeric fields
        if (data.price_amount) data.price_amount = parseFloat(data.price_amount);
        
        try {
            let response;
            
            if (this.currentProduct) {
                // Update existing product
                response = await fetch(`/api/products/${this.currentProduct.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            } else {
                // Create new product
                response = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            this.hideModal();
            await this.loadProducts();
            await this.updateDashboard();
            
            alert(this.currentProduct ? 'Product updated successfully!' : 'Product created successfully!');
            
        } catch (error) {
            console.error('Failed to save product:', error);
            alert('Failed to save product. Please try again.');
        }
    }

    async addCategory() {
        const name = prompt('Enter category name:');
        if (!name) return;
        
        try {
            const response = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            await this.loadCategories();
            alert('Category added successfully!');
            
        } catch (error) {
            console.error('Failed to add category:', error);
            alert('Failed to add category. Please try again.');
        }
    }

    async addSubcategory() {
        // First, show available main categories
        const mainCategories = this.categories.filter(cat => !cat.is_sub_category);
        
        if (mainCategories.length === 0) {
            alert('Please create at least one main category first.');
            return;
        }
        
        const categoryOptions = mainCategories.map(cat => `${cat.id}: ${cat.name}`).join('\n');
        const parentId = prompt(`Enter subcategory name, then parent category ID:\n\nAvailable categories:\n${categoryOptions}\n\nFormat: SubcategoryName|ParentID`);
        
        if (!parentId) return;
        
        const [subcategoryName, parentCategoryId] = parentId.split('|');
        
        if (!subcategoryName || !parentCategoryId) {
            alert('Please use the format: SubcategoryName|ParentID');
            return;
        }
        
        try {
            const response = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: subcategoryName.trim(), 
                    parent_id: parseInt(parentCategoryId), 
                    is_sub_category: true 
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            await this.loadCategories();
            alert('Subcategory added successfully!');
            
        } catch (error) {
            console.error('Failed to add subcategory:', error);
            alert('Failed to add subcategory. Please try again.');
        }
    }

    async deleteCategory(categoryId) {
        if (!confirm('Are you sure you want to delete this category?')) return;
        
        try {
            const response = await fetch(`/api/categories/${categoryId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            await this.loadCategories();
            alert('Category deleted successfully!');
            
        } catch (error) {
            console.error('Failed to delete category:', error);
            alert('Failed to delete category. Please try again.');
        }
    }

    async deleteSubcategory(subcategoryId) {
        if (!confirm('Are you sure you want to delete this subcategory?')) return;
        
        try {
            const { error } = await this.supabase
                .from('categories')
                .delete()
                .eq('id', subcategoryId);
                
            if (error) throw error;
            
            await this.loadCategories();
            alert('Subcategory deleted successfully!');
            
        } catch (error) {
            console.error('Failed to delete subcategory:', error);
            alert('Failed to delete subcategory. Please try again.');
        }
    }

    // Utility function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ProductManager();
});