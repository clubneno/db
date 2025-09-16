class MomentousAnalyzer {
    constructor() {
        console.log('MomentousAnalyzer constructor called');
        this.products = [];
        this.analytics = {};
        this.charts = {};
        
        console.log('Initializing event listeners...');
        this.initializeEventListeners();
        console.log('Loading data...');
        this.loadData();
    }

    initializeEventListeners() {
        // Search and filter inputs
        document.getElementById('searchInput').addEventListener('input', () => this.applyFilters());
        document.getElementById('categoryFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('goalFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('minPrice').addEventListener('input', () => this.applyFilters());
        document.getElementById('maxPrice').addEventListener('input', () => this.applyFilters());
        document.getElementById('sortBy').addEventListener('change', () => this.applyFilters());
        
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadData());
    }

    async loadData() {
        try {
            this.showLoading();
            
            // Add cache-busting parameter to ensure fresh data
            const cacheBuster = `?t=${Date.now()}`;
            
            // Load products and analytics
            const [productsResponse, analyticsResponse] = await Promise.all([
                fetch(`/api/products${cacheBuster}`),
                fetch(`/api/analytics${cacheBuster}`)
            ]);

            if (!productsResponse.ok || !analyticsResponse.ok) {
                throw new Error('Failed to load data');
            }

            const productsData = await productsResponse.json();
            this.analytics = await analyticsResponse.json();
            
            this.products = productsData.products;
            
            this.updateAnalytics();
            this.updateCharts();
            this.populateFilters();
            this.renderProducts(this.products);
            this.updateLastUpdated(productsData.scraped_at);
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNoData();
        }
    }

    showLoading() {
        document.getElementById('loadingState').classList.remove('hidden');
        document.getElementById('noDataState').classList.add('hidden');
        document.getElementById('productsGrid').innerHTML = '';
    }

    showNoData() {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('noDataState').classList.remove('hidden');
        document.getElementById('productsGrid').innerHTML = '';
    }

    updateAnalytics() {
        document.getElementById('totalProducts').textContent = this.analytics.total_products || 0;
        document.getElementById('avgPrice').textContent = this.analytics.price_stats ? 
            `$${this.analytics.price_stats.average.toFixed(2)}` : '$0';
        document.getElementById('priceRange').textContent = this.analytics.price_stats ? 
            `$${this.analytics.price_stats.min.toFixed(2)} - $${this.analytics.price_stats.max.toFixed(2)}` : '$0 - $0';
        document.getElementById('totalCategories').textContent = 
            Object.keys(this.analytics.categories || {}).length;
    }

    updateCharts() {
        this.createPriceChart();
        this.createCategoryChart();
    }

    createPriceChart() {
        const ctx = document.getElementById('priceChart').getContext('2d');
        
        if (this.charts.priceChart) {
            this.charts.priceChart.destroy();
        }

        const priceRanges = this.analytics.price_ranges || {};
        
        this.charts.priceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(priceRanges),
                datasets: [{
                    label: 'Number of Products',
                    data: Object.values(priceRanges),
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(245, 101, 101, 0.8)',
                        'rgba(139, 92, 246, 0.8)'
                    ],
                    borderColor: [
                        'rgb(59, 130, 246)',
                        'rgb(16, 185, 129)',
                        'rgb(245, 101, 101)',
                        'rgb(139, 92, 246)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    createCategoryChart() {
        const ctx = document.getElementById('categoryChart').getContext('2d');
        
        if (this.charts.categoryChart) {
            this.charts.categoryChart.destroy();
        }

        const categories = this.analytics.categories || {};
        const sortedCategories = Object.entries(categories)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 8); // Top 8 categories

        this.charts.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sortedCategories.map(([name]) => name || 'Other'),
                datasets: [{
                    data: sortedCategories.map(([, count]) => count),
                    backgroundColor: [
                        '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
                        '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 10,
                            usePointStyle: true,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }

    populateFilters() {
        console.log('Populating filters with analytics:', this.analytics);
        
        // Populate categories
        const categorySelect = document.getElementById('categoryFilter');
        categorySelect.innerHTML = '<option value="">All Categories</option>';
        
        const categories = Object.keys(this.analytics.categories || {}).sort();
        console.log('Available categories:', categories);
        categories.forEach(category => {
            if (category) {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = `${category} (${this.analytics.categories[category]})`;
                categorySelect.appendChild(option);
            }
        });
        
        // Populate goals
        const goalSelect = document.getElementById('goalFilter');
        goalSelect.innerHTML = '<option value="">All Goals</option>';
        
        const goals = Object.keys(this.analytics.goals || {}).sort();
        console.log('Available goals:', goals);
        goals.forEach(goal => {
            if (goal && goal !== 'General Health') {
                const option = document.createElement('option');
                option.value = goal;
                option.textContent = `${goal} (${this.analytics.goals[goal]})`;
                goalSelect.appendChild(option);
            }
        });
    }

    async applyFilters() {
        const search = document.getElementById('searchInput').value;
        const category = document.getElementById('categoryFilter').value;
        const goal = document.getElementById('goalFilter').value;
        const minPrice = document.getElementById('minPrice').value;
        const maxPrice = document.getElementById('maxPrice').value;
        const sortBy = document.getElementById('sortBy').value;

        console.log('Applying filters:', { search, category, goal, minPrice, maxPrice, sortBy });

        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (category) params.append('category', category);
        if (goal) params.append('goal', goal);
        if (minPrice) params.append('minPrice', minPrice);
        if (maxPrice) params.append('maxPrice', maxPrice);
        if (sortBy) params.append('sortBy', sortBy);

        // Add cache-busting to filtered requests too
        const separator = params.toString() ? '&' : '?';
        const cacheBuster = `${separator}t=${Date.now()}`;
        const url = `/api/products?${params.toString()}${cacheBuster}`;
        console.log('Fetching URL:', url);

        try {
            const response = await fetch(url);
            const data = await response.json();
            console.log('Filter results:', data.total, 'products');
            this.renderProducts(data.products);
        } catch (error) {
            console.error('Error applying filters:', error);
        }
    }

    renderProducts(products) {
        const grid = document.getElementById('productsGrid');
        const productCount = document.getElementById('productCount');
        
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('noDataState').classList.add('hidden');
        
        productCount.textContent = products.length;

        if (products.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-search text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500">No products found matching your criteria</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = products.map(product => {
            const price = this.extractPrice(product.price);
            const priceDisplay = price > 0 ? `$${price.toFixed(2)}` : product.price;
            
            return `
                <div class="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                    ${product.image ? `
                        <img src="${product.image}" alt="${product.title}" 
                             class="w-full h-48 object-cover" 
                             onerror="this.style.display='none'">
                    ` : `
                        <div class="w-full h-48 bg-gray-100 flex items-center justify-center">
                            <i class="fas fa-image text-gray-400 text-4xl"></i>
                        </div>
                    `}
                    
                    <div class="p-4">
                        <h4 class="font-semibold text-gray-900 mb-2 line-clamp-2">${product.title}</h4>
                        
                        <div class="mb-2">
                            <div class="flex justify-between items-center">
                                <div class="pricing">
                                    <span class="text-lg font-bold text-green-600">${priceDisplay}</span>
                                    ${product.subscriptionPrice && product.subscriptionPrice !== priceDisplay ? `
                                        <div class="text-sm text-blue-600 font-medium">
                                            Subscribe: ${product.subscriptionPrice}
                                        </div>
                                    ` : ''}
                                    ${product.originalPrice ? `
                                        <span class="text-sm text-gray-500 line-through ml-2">${product.originalPrice}</span>
                                    ` : ''}
                                </div>
                                ${product.availability ? `
                                    <span class="text-xs px-2 py-1 rounded-full ${
                                        product.availability.toLowerCase().includes('out') ? 
                                        'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                    }">
                                        ${product.availability}
                                    </span>
                                ` : ''}
                            </div>
                        </div>

                        ${product.categories && product.categories.length > 0 ? `
                            <div class="mb-1">
                                <p class="text-xs text-gray-600">
                                    <i class="fas fa-tags mr-1"></i><strong>Categories:</strong>
                                </p>
                                <div class="flex flex-wrap gap-1 mt-1">
                                    ${product.categories.slice(0, 3).map(cat => 
                                        `<span class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">${cat}</span>`
                                    ).join('')}
                                    ${product.categories.length > 3 ? 
                                        `<span class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">+${product.categories.length - 3} more</span>` 
                                        : ''}
                                </div>
                            </div>
                        ` : product.category ? `
                            <p class="text-xs text-gray-600 mb-1">
                                <i class="fas fa-tag mr-1"></i><strong>Category:</strong> ${product.category}
                            </p>
                        ` : ''}
                        
                        ${product.goals && product.goals.length > 0 ? `
                            <div class="mb-2">
                                <p class="text-xs text-blue-600">
                                    <i class="fas fa-bullseye mr-1"></i><strong>Goals:</strong>
                                </p>
                                <div class="flex flex-wrap gap-1 mt-1">
                                    ${product.goals.slice(0, 2).map(goal => 
                                        `<span class="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full">${goal}</span>`
                                    ).join('')}
                                    ${product.goals.length > 2 ? 
                                        `<span class="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full">+${product.goals.length - 2} more</span>` 
                                        : ''}
                                </div>
                            </div>
                        ` : product.primaryGoal ? `
                            <p class="text-xs text-blue-600 mb-2">
                                <i class="fas fa-bullseye mr-1"></i><strong>Goal:</strong> ${product.primaryGoal}
                            </p>
                        ` : ''}

                        ${product.description ? `
                            <p class="text-sm text-gray-600 mb-3 line-clamp-3">${product.description}</p>
                        ` : ''}

                        ${product.benefits ? `
                            <div class="mb-3">
                                <h5 class="text-xs font-medium text-gray-700 mb-1">Benefits:</h5>
                                <p class="text-xs text-gray-600 line-clamp-2">${product.benefits}</p>
                            </div>
                        ` : ''}

                        <div class="flex justify-between items-center">
                            <div class="flex space-x-2">
                                ${product.link ? `
                                    <a href="${product.link}" target="_blank" 
                                       class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                        View Product <i class="fas fa-external-link-alt ml-1"></i>
                                    </a>
                                ` : ''}
                                <button onclick="toggleEditMode('${product.title.replace(/'/g, "\\'")}', '${(product.categories || []).join(',').replace(/'/g, "\\'")}', '${(product.goals || []).join(',').replace(/'/g, "\\'")}')" 
                                        class="text-green-600 hover:text-green-800 text-sm font-medium">
                                    <i class="fas fa-edit mr-1"></i>Edit
                                </button>
                            </div>
                            
                            ${product.rating ? `
                                <div class="flex items-center text-yellow-500">
                                    <i class="fas fa-star mr-1"></i>
                                    <span class="text-sm">${product.rating}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    extractPrice(priceString) {
        const matches = priceString.match(/[\d,]+\.?\d*/);
        return matches ? parseFloat(matches[0].replace(',', '')) : 0;
    }

    updateLastUpdated(timestamp) {
        if (timestamp) {
            const date = new Date(timestamp);
            document.getElementById('lastUpdated').textContent = 
                `Last updated: ${date.toLocaleString()}`;
        }
    }
}

// Auto-initialization disabled - controlled by navigation.js
// document.addEventListener('DOMContentLoaded', () => {
//     window.analyzer = new MomentousAnalyzer();
// });

// Helper function for running scraper (if needed)
async function runScraper() {
    alert('To run the scraper, execute: npm run scrape in your terminal');
}

// Edit functionality
let currentEditProduct = null;

function toggleEditMode(productTitle, currentCategories, currentGoals) {
    currentEditProduct = productTitle;
    
    // Create modal if it doesn't exist
    let modal = document.getElementById('editModal');
    if (!modal) {
        createEditModal();
        modal = document.getElementById('editModal');
    }
    
    // Populate form with current data
    document.getElementById('editProductTitle').textContent = productTitle;
    document.getElementById('editCategories').value = currentCategories || '';
    document.getElementById('editGoals').value = currentGoals || '';
    
    // Show modal
    modal.classList.remove('hidden');
}

function createEditModal() {
    const modal = document.createElement('div');
    modal.id = 'editModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 hidden';
    
    modal.innerHTML = `
        <div class="flex items-center justify-center min-h-screen p-4">
            <div class="bg-white rounded-lg max-w-md w-full p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">Edit Product</h3>
                    <button onclick="closeEditModal()" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="mb-4">
                    <h4 id="editProductTitle" class="font-medium text-gray-700 mb-3"></h4>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Categories</label>
                        <input type="text" id="editCategories" 
                               placeholder="Enter categories separated by commas"
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-gray-500 mt-1">Separate multiple categories with commas</p>
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Goals</label>
                        <input type="text" id="editGoals" 
                               placeholder="Enter goals separated by commas"
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-gray-500 mt-1">Separate multiple goals with commas</p>
                    </div>
                </div>
                
                <div class="flex justify-end space-x-3">
                    <button onclick="closeEditModal()" 
                            class="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">
                        Cancel
                    </button>
                    <button onclick="saveProductEdit()" 
                            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentEditProduct = null;
}

async function saveProductEdit() {
    if (!currentEditProduct) return;
    
    const categoriesInput = document.getElementById('editCategories').value;
    const goalsInput = document.getElementById('editGoals').value;
    
    const categories = categoriesInput ? categoriesInput.split(',').map(c => c.trim()).filter(c => c) : [];
    const goals = goalsInput ? goalsInput.split(',').map(g => g.trim()).filter(g => g) : [];
    
    try {
        const response = await fetch(`/api/products/${encodeURIComponent(currentEditProduct)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                categories,
                goals
            })
        });
        
        if (response.ok) {
            // Close modal
            closeEditModal();
            
            // Refresh the data to show updated product
            if (window.analyzer) {
                await window.analyzer.loadData();
            }
            
            // Show success message
            showNotification('Product updated successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification(`Failed to update product: ${error.error}`, 'error');
        }
    } catch (error) {
        console.error('Error updating product:', error);
        showNotification('Failed to update product. Please try again.', 'error');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-md text-white ${
        type === 'success' ? 'bg-green-600' : 
        type === 'error' ? 'bg-red-600' : 
        'bg-blue-600'
    } shadow-lg`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}