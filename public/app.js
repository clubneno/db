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
        if (!this.supabase) return false;
        
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.error('Auth error:', error);
                return false;
            }
            
            if (session?.user) {
                this.currentUser = session.user;
                this.updateUserDisplay();
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Authentication check failed:', error);
            return false;
        }
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
        try {
            if (this.supabase) {
                await this.supabase.auth.signOut();
            }
            this.redirectToLogin();
        } catch (error) {
            console.error('Logout failed:', error);
            alert('Logout failed. Please try again.');
        }
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
        
        ['categoryFilter', 'subcategoryFilter', 'sortFilter'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                this.filterProducts();
            });
        });

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
            const { data, error } = await this.supabase
                .from('products')
                .select('*')
                .order('title', { ascending: true });

            if (error) throw error;

            this.products = data || [];
            this.renderProducts();
            this.updateProductFilters();
            
        } catch (error) {
            console.error('Failed to load products:', error);
            this.products = [];
            this.renderProducts();
        }
    }

    async loadCategories() {
        try {
            const { data, error } = await this.supabase
                .from('categories')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;

            this.categories = data || [];
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
        const image = product.main_image || product.image || 'https://via.placeholder.com/300x200?text=No+Image';
        const title = product.title || 'Untitled Product';
        const description = product.description ? 
            (product.description.length > 100 ? product.description.substring(0, 100) + '...' : product.description) : 
            'No description available';
        
        return `
            <div class="product-card bg-white rounded-lg shadow overflow-hidden fade-in">
                <img src="${image}" alt="${title}" class="w-full h-48 object-cover" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
                <div class="p-4">
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

    renderCategories() {
        const mainContainer = document.getElementById('mainCategoriesList');
        const subContainer = document.getElementById('subcategoriesList');
        
        // Filter main categories and subcategories
        const mainCategories = this.categories.filter(cat => !cat.is_sub_category);
        const subcategories = this.categories.filter(cat => cat.is_sub_category);
        
        // Render main categories
        if (!mainCategories || mainCategories.length === 0) {
            mainContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No main categories found</p>';
        } else {
            mainContainer.innerHTML = mainCategories.map(category => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center">
                        <i class="fas fa-folder text-primary mr-3"></i>
                        <span class="font-medium text-gray-900">${category.name}</span>
                    </div>
                    <button onclick="app.deleteCategory(${category.id})" 
                            class="text-red-600 hover:text-red-800 text-sm">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
        }
        
        // Render subcategories
        if (!subcategories || subcategories.length === 0) {
            subContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No subcategories found</p>';
        } else {
            subContainer.innerHTML = subcategories.map(subcategory => {
                const parentCategory = this.categories.find(cat => cat.id === subcategory.parent_id);
                const parentName = parentCategory ? parentCategory.name : 'Unknown';
                return `
                    <div class="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div class="flex items-center">
                            <i class="fas fa-folder-open text-secondary mr-3"></i>
                            <div>
                                <span class="font-medium text-gray-900">${subcategory.name}</span>
                                <div class="text-xs text-gray-500">under ${parentName}</div>
                            </div>
                        </div>
                        <button onclick="app.deleteCategory(${subcategory.id})" 
                                class="text-red-600 hover:text-red-800 text-sm">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            }).join('');
        }
    }

    renderSubcategories() {
        // This function is now handled within renderCategories()
        // Keep for compatibility but delegate to renderCategories
        this.renderCategories();
    }

    updateProductFilters() {
        // Update category filter
        const categoryFilter = document.getElementById('categoryFilter');
        const uniqueCategories = [...new Set(this.products.map(p => p.category).filter(Boolean))];
        
        categoryFilter.innerHTML = '<option value="">All Categories</option>' + 
            uniqueCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

        // Update subcategory filter  
        const subcategoryFilter = document.getElementById('subcategoryFilter');
        const uniqueSubcategories = [...new Set(this.products.map(p => p.subcategory).filter(Boolean))];
        
        subcategoryFilter.innerHTML = '<option value="">All Subcategories</option>' + 
            uniqueSubcategories.map(subcat => `<option value="${subcat}">${subcat}</option>`).join('');
    }

    filterProducts() {
        const search = document.getElementById('searchInput').value.toLowerCase();
        const categoryFilter = document.getElementById('categoryFilter').value;
        const subcategoryFilter = document.getElementById('subcategoryFilter').value;
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

        // Apply subcategory filter
        if (subcategoryFilter) {
            filtered = filtered.filter(product => product.subcategory === subcategoryFilter);
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
        
        modal.classList.remove('hidden');
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
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select name="category" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                        <option value="">Select category...</option>
                        ${this.categories.map(cat => 
                            `<option value="${cat.name}" ${data.category === cat.name ? 'selected' : ''}>${cat.name}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Subcategory</label>
                    <select name="subcategory" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                        <option value="">Select subcategory...</option>
                        ${this.categories.filter(cat => cat.is_sub_category).map(subcat => 
                            `<option value="${subcat.name}" ${data.subcategory === subcat.name ? 'selected' : ''}>${subcat.name}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Image URL</label>
                    <input type="url" name="main_image" value="${data.main_image || ''}"
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
            let result;
            
            if (this.currentProduct) {
                // Update existing product
                result = await this.supabase
                    .from('products')
                    .update(data)
                    .eq('id', this.currentProduct.id);
            } else {
                // Create new product
                result = await this.supabase
                    .from('products')
                    .insert([data]);
            }
            
            if (result.error) throw result.error;
            
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
            const { error } = await this.supabase
                .from('categories')
                .insert([{ name: name.trim() }]);
                
            if (error) throw error;
            
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
            const { error } = await this.supabase
                .from('categories')
                .insert([{ 
                    name: subcategoryName.trim(), 
                    parent_id: parseInt(parentCategoryId), 
                    is_sub_category: true 
                }]);
                
            if (error) throw error;
            
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
            const { error } = await this.supabase
                .from('categories')
                .delete()
                .eq('id', categoryId);
                
            if (error) throw error;
            
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