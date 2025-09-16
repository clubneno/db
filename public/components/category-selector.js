// Hierarchical Category Selector Component
// Handles both parent categories and their subcategories in a tree structure

class CategorySelector {
    constructor(categories, onSelectionChange) {
        this.categories = categories || [];
        this.selectedCategories = new Set();
        this.onSelectionChange = onSelectionChange || (() => {});
        this.container = null;
    }

    // Group categories into hierarchical structure
    getHierarchicalCategories() {
        const parentCategories = this.categories.filter(cat => !cat.is_sub_category);
        const subcategories = this.categories.filter(cat => cat.is_sub_category);
        
        return parentCategories.map(parent => ({
            ...parent,
            subcategories: subcategories.filter(sub => sub.parent_id === parent.id)
        }));
    }

    // Generate hierarchical category display for product cards
    generateCategoryHierarchyDisplay(productCategories) {
        if (!productCategories || productCategories.length === 0) {
            return '<div class="text-sm text-gray-500">No categories assigned</div>';
        }

        // Group by parent categories
        const hierarchyMap = new Map();
        
        productCategories.forEach(category => {
            if (category.is_sub_category) {
                // Find parent category
                const parent = this.categories.find(cat => cat.id === category.parent_id);
                if (parent) {
                    if (!hierarchyMap.has(parent.id)) {
                        hierarchyMap.set(parent.id, {
                            parent: parent,
                            subcategories: []
                        });
                    }
                    hierarchyMap.get(parent.id).subcategories.push(category);
                }
            } else {
                // Parent category
                if (!hierarchyMap.has(category.id)) {
                    hierarchyMap.set(category.id, {
                        parent: category,
                        subcategories: []
                    });
                }
            }
        });

        // Generate HTML for each hierarchy
        const hierarchyTags = [];
        hierarchyMap.forEach(({ parent, subcategories }) => {
            if (subcategories.length > 0) {
                // Parent with subcategories
                const subcatNames = subcategories.map(sub => sub.name).join(', ');
                hierarchyTags.push(`
                    <div class="mb-2">
                        <div class="inline-flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                            ${parent.name}
                        </div>
                        <div class="ml-2 mt-1 inline-flex flex-wrap gap-1">
                            ${subcategories.map(sub => `
                                <span class="inline-flex items-center bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">
                                    └ ${sub.name}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                `);
            } else {
                // Parent only
                hierarchyTags.push(`
                    <div class="inline-flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium mb-1 mr-1">
                        ${parent.name}
                    </div>
                `);
            }
        });

        return `<div class="category-hierarchy">${hierarchyTags.join('')}</div>`;
    }

    // Render the hierarchical selector UI
    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        this.container = container;
        const hierarchicalCategories = this.getHierarchicalCategories();

        container.innerHTML = `
            <div class="hierarchical-category-selector">
                <div class="mb-4">
                    <h4 class="text-sm font-semibold text-gray-700 mb-2">Select Categories & Subcategories</h4>
                    <div class="text-xs text-gray-500 mb-3">Products can belong to multiple category paths (e.g., Athletic Performance → Muscle Development)</div>
                </div>
                
                <div class="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    ${hierarchicalCategories.map(parent => this.renderCategoryTree(parent)).join('')}
                </div>
                
                <div class="mt-4">
                    <h5 class="text-sm font-medium text-gray-700 mb-2">Selected Categories:</h5>
                    <div id="selectedCategoriesDisplay" class="min-h-[40px] p-2 border border-gray-200 rounded bg-gray-50">
                        ${this.renderSelectedCategories()}
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        this.attachEventListeners();
    }

    renderCategoryTree(parent) {
        const isParentSelected = this.selectedCategories.has(parent.id);
        
        return `
            <div class="category-tree-item border-b border-gray-100 last:border-b-0">
                <div class="p-3">
                    <label class="flex items-center cursor-pointer">
                        <input type="checkbox" 
                               value="${parent.id}" 
                               ${isParentSelected ? 'checked' : ''}
                               class="category-checkbox mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                        <span class="text-sm font-medium text-gray-900">${parent.name}</span>
                        <span class="ml-2 text-xs text-gray-500">(Parent Category)</span>
                    </label>
                    
                    ${parent.subcategories.length > 0 ? `
                        <div class="ml-7 mt-2 space-y-2">
                            ${parent.subcategories.map(sub => {
                                const isSubSelected = this.selectedCategories.has(sub.id);
                                return `
                                    <label class="flex items-center cursor-pointer">
                                        <input type="checkbox" 
                                               value="${sub.id}" 
                                               ${isSubSelected ? 'checked' : ''}
                                               class="category-checkbox mr-2 h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                        <span class="text-sm text-gray-700">└ ${sub.name}</span>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderSelectedCategories() {
        if (this.selectedCategories.size === 0) {
            return '<div class="text-sm text-gray-500">No categories selected</div>';
        }

        const selectedCats = Array.from(this.selectedCategories).map(id => {
            return this.categories.find(cat => cat.id == id);
        }).filter(Boolean);

        // Group by parent-child relationships
        const hierarchyDisplay = this.generateSelectedHierarchyDisplay(selectedCats);
        
        return hierarchyDisplay;
    }

    generateSelectedHierarchyDisplay(selectedCats) {
        const hierarchyMap = new Map();
        
        selectedCats.forEach(category => {
            if (category.is_sub_category) {
                const parent = this.categories.find(cat => cat.id === category.parent_id);
                if (parent) {
                    const key = `${parent.id}-${parent.name}`;
                    if (!hierarchyMap.has(key)) {
                        hierarchyMap.set(key, {
                            parent: parent,
                            subcategories: [],
                            parentSelected: this.selectedCategories.has(parent.id)
                        });
                    }
                    hierarchyMap.get(key).subcategories.push(category);
                }
            } else {
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

        const tags = [];
        hierarchyMap.forEach(({ parent, subcategories, parentSelected }) => {
            if (subcategories.length > 0) {
                tags.push(`
                    <div class="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm m-1">
                        <span class="font-medium">${parent.name}</span>
                        <span class="mx-2">→</span>
                        <span>${subcategories.map(sub => sub.name).join(', ')}</span>
                        <button type="button" 
                                onclick="categorySelector.removeHierarchy('${parent.id}', [${subcategories.map(s => s.id).join(',')}])"
                                class="ml-2 text-blue-600 hover:text-blue-800">
                            <i class="fas fa-times text-xs"></i>
                        </button>
                    </div>
                `);
            } else if (parentSelected) {
                tags.push(`
                    <div class="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm m-1">
                        <span class="font-medium">${parent.name}</span>
                        <button type="button" 
                                onclick="categorySelector.removeCategory('${parent.id}')"
                                class="ml-2 text-blue-600 hover:text-blue-800">
                            <i class="fas fa-times text-xs"></i>
                        </button>
                    </div>
                `);
            }
        });

        return tags.length > 0 ? tags.join('') : '<div class="text-sm text-gray-500">No categories selected</div>';
    }

    attachEventListeners() {
        if (!this.container) return;

        const checkboxes = this.container.querySelectorAll('.category-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const categoryId = parseInt(e.target.value);
                if (e.target.checked) {
                    this.selectedCategories.add(categoryId);
                } else {
                    this.selectedCategories.delete(categoryId);
                }
                this.updateSelectedDisplay();
                this.onSelectionChange(Array.from(this.selectedCategories));
            });
        });
    }

    updateSelectedDisplay() {
        const display = this.container.querySelector('#selectedCategoriesDisplay');
        if (display) {
            display.innerHTML = this.renderSelectedCategories();
        }
    }

    removeCategory(categoryId) {
        this.selectedCategories.delete(parseInt(categoryId));
        this.updateCheckboxes();
        this.updateSelectedDisplay();
        this.onSelectionChange(Array.from(this.selectedCategories));
    }

    removeHierarchy(parentId, subcategoryIds) {
        this.selectedCategories.delete(parseInt(parentId));
        subcategoryIds.forEach(id => {
            this.selectedCategories.delete(parseInt(id));
        });
        this.updateCheckboxes();
        this.updateSelectedDisplay();
        this.onSelectionChange(Array.from(this.selectedCategories));
    }

    updateCheckboxes() {
        if (!this.container) return;
        
        const checkboxes = this.container.querySelectorAll('.category-checkbox');
        checkboxes.forEach(checkbox => {
            const categoryId = parseInt(checkbox.value);
            checkbox.checked = this.selectedCategories.has(categoryId);
        });
    }

    // Set selected categories (for editing existing products)
    setSelectedCategories(categoryIds) {
        this.selectedCategories = new Set(categoryIds.map(id => parseInt(id)));
        this.updateCheckboxes();
        this.updateSelectedDisplay();
    }

    // Get currently selected categories
    getSelectedCategories() {
        return Array.from(this.selectedCategories);
    }
}