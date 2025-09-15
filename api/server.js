const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Supabase client with service role for database operations
const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Supabase authentication middleware
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required - missing token' });
        }
        
        const token = authHeader.replace('Bearer ', '');
        
        // Verify the JWT token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            console.error('Authentication error:', error);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication middleware error:', error);
        return res.status(401).json({ error: 'Authentication failed' });
    }
};

// Authentication Routes
app.get('/api/auth/check', requireAuth, (req, res) => {
    res.json({ 
        authenticated: true, 
        user: req.user 
    });
});

// Protected Routes
app.get('/api/products', requireAuth, async (req, res) => {
  try {
    const { category, goal, minPrice, maxPrice, search, sortBy, euNotificationStatus } = req.query;
    
    // Build Supabase query
    let query = supabase
      .from('products')
      .select('*');
    
    // Apply search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    // Apply category filter
    if (category) {
      query = query.or(`category.ilike.%${category}%`);
    }
    
    // Apply primary goal filter
    if (goal) {
      query = query.or(`primary_goal.ilike.%${goal}%`);
    }
    
    // Apply price range filters
    if (minPrice) {
      query = query.gte('price_amount', parseFloat(minPrice));
    }
    if (maxPrice) {
      query = query.lte('price_amount', parseFloat(maxPrice));
    }
    
    // Apply sorting
    if (sortBy) {
      switch (sortBy) {
        case 'price_asc':
          query = query.order('price_amount', { ascending: true });
          break;
        case 'price_desc':
          query = query.order('price_amount', { ascending: false });
          break;
        case 'name_asc':
          query = query.order('title', { ascending: true });
          break;
        case 'name_desc':
          query = query.order('title', { ascending: false });
          break;
        default:
          query = query.order('title', { ascending: true });
      }
    } else {
      query = query.order('title', { ascending: true });
    }
    
    const { data: products, error } = await query;
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to load product data from database' });
    }
    
    // Transform data to match expected format
    const transformedProducts = products.map(product => ({
      ...product,
      price: product.price_display || `$${product.price_amount || 0}`,
      subscriptionPrice: product.subscription_price_display || `$${product.subscription_price_amount || 0}`,
      primaryGoal: product.primary_goal,
      euAllowed: product.eu_allowed,
      createdAt: product.created_at,
      updatedAt: product.updated_at || product.created_at
    }));
    
    res.json({
      products: transformedProducts,
      total: transformedProducts.length,
      scraped_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error loading products:', error);
    res.status(500).json({ error: 'Failed to load product data' });
  }
});

app.get('/api/analytics', requireAuth, async (req, res) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('price_amount, category, primary_goal, created_at');
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to load product data from database' });
    }
    
    // Generate analytics
    const prices = products
      .map(p => p.price_amount)
      .filter(p => p !== null && !isNaN(p));
    
    const categories = {};
    const goals = {};
    
    products.forEach(product => {
      // Count categories
      if (product.category) {
        categories[product.category] = (categories[product.category] || 0) + 1;
      }
      
      // Count goals
      if (product.primary_goal) {
        goals[product.primary_goal] = (goals[product.primary_goal] || 0) + 1;
      }
    });
    
    const analytics = {
      total_products: products.length,
      price_stats: prices.length > 0 ? {
        min: Math.min(...prices),
        max: Math.max(...prices),
        average: prices.reduce((a, b) => a + b, 0) / prices.length,
        median: prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
      } : { min: 0, max: 0, average: 0, median: 0 },
      categories,
      goals,
      price_ranges: {
        '$0-25': prices.filter(p => p <= 25).length,
        '$26-50': prices.filter(p => p > 25 && p <= 50).length,
        '$51-100': prices.filter(p => p > 50 && p <= 100).length,
        '$100+': prices.filter(p => p > 100).length
      },
      last_updated: new Date().toISOString()
    };
    
    res.json(analytics);
    
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// Update product goals, sub-goals, and flavors
app.put('/api/products/:handle', requireAuth, (req, res) => {
  try {
    const { handle } = req.params;
    const { categories, goals, flavors, euNotificationStatus, skus, hsCode, hsCodeDescription, dutyRate, productName, euAllowed, size, servings, intakeFrequency, reorderPeriod, nutraceuticalsRegularPrice, nutraceuticalsSubscriptionPrice, clubnenoRegularPrice, clubnenoSubscriptionPrice, flavorSkus, flavorHsCodes, flavorDutyRates, flavorEuNotifications, flavorNotes, flavorLinks, flavorIngredients } = req.body;
    
    console.log('Server received categories:', categories);
    console.log('Server received goals:', goals);
    console.log('Server received flavorNotes:', flavorNotes);
    console.log('Server received product name:', productName);
    console.log('Server received basic product info:', { size, servings, intakeFrequency, reorderPeriod });
    console.log('Server received pricing info:', { nutraceuticalsRegularPrice, nutraceuticalsSubscriptionPrice, clubnenoRegularPrice, clubnenoSubscriptionPrice });
    
    const dataPath = path.join(__dirname, '..', 'data', 'latest.json');
    if (!fs.existsSync(dataPath)) {
      return res.status(404).json({ error: 'No product data found' });
    }

    const products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const productIndex = products.findIndex(p => p.handle === handle || p.title === handle);
    
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Update product
    if (categories) products[productIndex].categories = categories;
    if (goals) products[productIndex].goals = goals;
    if (flavors) products[productIndex].flavors = flavors;
    if (skus) products[productIndex].skus = skus;
    if (euNotificationStatus !== undefined) products[productIndex].euNotificationStatus = euNotificationStatus;
    if (hsCode !== undefined) products[productIndex].hsCode = hsCode;
    if (hsCodeDescription !== undefined) products[productIndex].hsCodeDescription = hsCodeDescription;
    if (dutyRate !== undefined && dutyRate !== null) products[productIndex].dutyRate = dutyRate;
    
    // Update product name
    if (productName !== undefined && productName.trim() !== '') products[productIndex].title = productName.trim();
    
    // Update EU availability
    if (euAllowed !== undefined) products[productIndex].euAllowed = euAllowed;
    
    // Update basic product information
    if (size !== undefined) products[productIndex].size = size || null;
    if (servings !== undefined) products[productIndex].servings = servings || null;
    if (intakeFrequency !== undefined) products[productIndex].intakeFrequency = intakeFrequency || null;
    if (reorderPeriod !== undefined) products[productIndex].reorderPeriod = reorderPeriod || null;
    
    // Update pricing information
    if (nutraceuticalsRegularPrice !== undefined) products[productIndex].nutraceuticalsRegularPrice = nutraceuticalsRegularPrice || null;
    if (nutraceuticalsSubscriptionPrice !== undefined) products[productIndex].nutraceuticalsSubscriptionPrice = nutraceuticalsSubscriptionPrice || null;
    if (clubnenoRegularPrice !== undefined) products[productIndex].clubnenoRegularPrice = clubnenoRegularPrice || null;
    if (clubnenoSubscriptionPrice !== undefined) products[productIndex].clubnenoSubscriptionPrice = clubnenoSubscriptionPrice || null;
    
    if (categories && categories.length > 0) products[productIndex].category = categories[0];
    if (goals && goals.length > 0) products[productIndex].primaryGoal = goals[0];

    // Handle per-flavor data
    if (flavorSkus && Object.keys(flavorSkus).length > 0) products[productIndex].flavorSkus = flavorSkus;
    if (flavorHsCodes && Object.keys(flavorHsCodes).length > 0) products[productIndex].flavorHsCodes = flavorHsCodes;
    if (flavorDutyRates && Object.keys(flavorDutyRates).length > 0) products[productIndex].flavorDutyRates = flavorDutyRates;
    if (flavorEuNotifications && Object.keys(flavorEuNotifications).length > 0) products[productIndex].flavorEuNotifications = flavorEuNotifications;
    if (flavorNotes) products[productIndex].flavorNotes = flavorNotes;
    if (flavorLinks) products[productIndex].flavorLinks = flavorLinks;
    if (flavorIngredients) products[productIndex].flavorIngredients = flavorIngredients;

    // Save updated data
    fs.writeFileSync(dataPath, JSON.stringify(products, null, 2));
    
    res.json({ success: true, product: products[productIndex] });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Add new category
app.post('/api/categories', requireAuth, (req, res) => {
  try {
    const { name, parentId, isSubCategory } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Load existing categories
    const categoriesPath = path.join(__dirname, '..', 'data', 'categories.json');
    let categories = [];
    if (fs.existsSync(categoriesPath)) {
      categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
    }

    if (isSubCategory && parentId) {
      // Adding a sub-category
      const parentCategory = categories.find(cat => cat.id === parentId);
      if (!parentCategory) {
        return res.status(400).json({ error: 'Parent category not found' });
      }
      
      if (parentCategory.subCategories.includes(name)) {
        return res.status(400).json({ error: 'Sub-category already exists' });
      }
      
      parentCategory.subCategories.push(name);
      parentCategory.subCategories.sort();
    } else {
      // Adding a parent category
      const categoryId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      if (categories.find(cat => cat.id === categoryId)) {
        return res.status(400).json({ error: 'Category already exists' });
      }
      
      categories.push({
        id: categoryId,
        name: name,
        subCategories: []
      });
      categories.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Save updated categories
    fs.writeFileSync(categoriesPath, JSON.stringify(categories, null, 2));

    res.json({ success: true, category: name });
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ error: 'Failed to add category' });
  }
});

// Add new goal
app.post('/api/goals', requireAuth, (req, res) => {
  try {
    const { name, parentId, isSubGoal } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Goal name is required' });
    }

    // Load existing goals
    const goalsPath = path.join(__dirname, '..', 'data', 'goals.json');
    let goals = [];
    if (fs.existsSync(goalsPath)) {
      goals = JSON.parse(fs.readFileSync(goalsPath, 'utf8'));
    }

    if (isSubGoal && parentId) {
      // Adding a sub-goal
      const parentGoal = goals.find(goal => goal.id === parentId);
      if (!parentGoal) {
        return res.status(400).json({ error: 'Parent goal not found' });
      }
      
      if (parentGoal.subGoals.includes(name)) {
        return res.status(400).json({ error: 'Sub-goal already exists' });
      }
      
      parentGoal.subGoals.push(name);
      parentGoal.subGoals.sort();
    } else {
      // Adding a parent goal
      const goalId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      if (goals.find(goal => goal.id === goalId)) {
        return res.status(400).json({ error: 'Goal already exists' });
      }
      
      goals.push({
        id: goalId,
        name: name,
        subGoals: []
      });
      goals.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Save updated goals
    fs.writeFileSync(goalsPath, JSON.stringify(goals, null, 2));

    res.json({ success: true, goal: name });
  } catch (error) {
    console.error('Error adding goal:', error);
    res.status(500).json({ error: 'Failed to add goal' });
  }
});

// Add new flavor
app.post('/api/flavors', requireAuth, (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Flavor name is required' });
    }

    // Load existing flavors
    const flavorsPath = path.join(__dirname, '..', 'data', 'flavors.json');
    let flavors = [];
    if (fs.existsSync(flavorsPath)) {
      flavors = JSON.parse(fs.readFileSync(flavorsPath, 'utf8'));
    }

    // Check if flavor already exists
    if (flavors.includes(name)) {
      return res.status(400).json({ error: 'Flavor already exists' });
    }

    // Add new flavor
    flavors.push(name);
    flavors.sort();

    // Save updated flavors
    fs.writeFileSync(flavorsPath, JSON.stringify(flavors, null, 2));

    res.json({ success: true, flavor: name });
  } catch (error) {
    console.error('Error adding flavor:', error);
    res.status(500).json({ error: 'Failed to add flavor' });
  }
});

// Delete category
app.delete('/api/categories/:name', requireAuth, (req, res) => {
  try {
    const { name } = req.params;
    
    // Remove from categories.json (persistent storage)
    const categoriesPath = path.join(__dirname, '..', 'data', 'categories.json');
    let categories = [];
    if (fs.existsSync(categoriesPath)) {
      categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
      
      // Check if it's a parent category or sub-category
      let found = false;
      categories = categories.filter(category => {
        if (category.name === name) {
          found = true;
          return false; // Remove parent category
        }
        
        // Check sub-categories
        if (category.subCategories && category.subCategories.includes(name)) {
          category.subCategories = category.subCategories.filter(subCat => subCat !== name);
          found = true;
        }
        
        return true;
      });
      
      if (found) {
        fs.writeFileSync(categoriesPath, JSON.stringify(categories, null, 2));
      }
    }

    // Remove category from all products in latest.json
    const dataPath = path.join(__dirname, '..', 'data', 'latest.json');
    if (fs.existsSync(dataPath)) {
      const products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      
      products.forEach(product => {
        if (product.categories) {
          product.categories = product.categories.filter(cat => cat !== name);
        }
        if (product.category === name && product.categories && product.categories.length > 0) {
          product.category = product.categories[0];
        }
      });

      fs.writeFileSync(dataPath, JSON.stringify(products, null, 2));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Delete goal
app.delete('/api/goals/:name', requireAuth, (req, res) => {
  try {
    const { name } = req.params;
    
    // Remove from goals.json (persistent storage)
    const goalsPath = path.join(__dirname, '..', 'data', 'goals.json');
    let goals = [];
    if (fs.existsSync(goalsPath)) {
      goals = JSON.parse(fs.readFileSync(goalsPath, 'utf8'));
      
      // Check if it's a parent goal or sub-goal
      let found = false;
      goals = goals.filter(goal => {
        if (goal.name === name) {
          found = true;
          return false; // Remove parent goal
        }
        
        // Check sub-goals
        if (goal.subGoals && goal.subGoals.includes(name)) {
          goal.subGoals = goal.subGoals.filter(subGoal => subGoal !== name);
          found = true;
        }
        
        return true;
      });
      
      if (found) {
        fs.writeFileSync(goalsPath, JSON.stringify(goals, null, 2));
      }
    }

    // Remove goal from all products in latest.json
    const dataPath = path.join(__dirname, '..', 'data', 'latest.json');
    if (fs.existsSync(dataPath)) {
      const products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      
      products.forEach(product => {
        if (product.goals) {
          product.goals = product.goals.filter(goal => goal !== name);
        }
        if (product.primaryGoal === name && product.goals && product.goals.length > 0) {
          product.primaryGoal = product.goals[0];
        }
      });

      fs.writeFileSync(dataPath, JSON.stringify(products, null, 2));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// Get categories
app.get('/api/categories', requireAuth, async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to load categories from database' });
    }
    
    res.json({ categories });
  } catch (error) {
    console.error('Error loading categories:', error);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

// Get goals
app.get('/api/goals', requireAuth, async (req, res) => {
  try {
    const { data: goals, error } = await supabase
      .from('goals')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to load goals from database' });
    }
    
    res.json({ goals });
  } catch (error) {
    console.error('Error loading goals:', error);
    res.status(500).json({ error: 'Failed to load goals' });
  }
});

// Get flavors
app.get('/api/flavors', requireAuth, async (req, res) => {
  try {
    const { data: flavors, error } = await supabase
      .from('flavors')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to load flavors from database' });
    }
    
    res.json({ flavors });
  } catch (error) {
    console.error('Error loading flavors:', error);
    res.status(500).json({ error: 'Failed to load flavors' });
  }
});

// Delete flavor
app.delete('/api/flavors/:name', requireAuth, (req, res) => {
  try {
    const { name } = req.params;
    
    // Remove from flavors.json
    const flavorsPath = path.join(__dirname, '..', 'data', 'flavors.json');
    let flavors = [];
    if (fs.existsSync(flavorsPath)) {
      flavors = JSON.parse(fs.readFileSync(flavorsPath, 'utf8'));
      flavors = flavors.filter(flavor => flavor !== name);
      fs.writeFileSync(flavorsPath, JSON.stringify(flavors, null, 2));
    }

    // Remove flavor from all products
    const dataPath = path.join(__dirname, '..', 'data', 'latest.json');
    if (fs.existsSync(dataPath)) {
      const products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      
      products.forEach(product => {
        if (product.flavors) {
          product.flavors = product.flavors.filter(flavor => flavor !== name);
        }
      });

      fs.writeFileSync(dataPath, JSON.stringify(products, null, 2));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting flavor:', error);
    res.status(500).json({ error: 'Failed to delete flavor' });
  }
});

// Serve the web interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Product analyzer running at http://localhost:${PORT}`);
    console.log(`📊 API endpoints:`);
    console.log(`   GET /api/products - Get all products with optional filters`);
    console.log(`   GET /api/analytics - Get product analytics`);
  });
}

// Export for Vercel
module.exports = app;