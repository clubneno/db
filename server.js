const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://baqdzabfkhtgnxzhoyax.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNjk4OSwiZXhwIjoyMDczNDkyOTg5fQ.SZmjBrkLRJ0jjNEiRUgXl2mLuTOqzU78t9abfojWixU'
);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Config endpoint for frontend
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || 'https://baqdzabfkhtgnxzhoyax.supabase.co',
    supabaseKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MTY5ODksImV4cCI6MjA3MzQ5Mjk4OX0.qJZBWBApyQf8xgV0EuIZkGOy5pDbNhLXfzHklOL_V5o'
  });
});

// Authentication middleware
const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log('Auth error:', error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
    
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Products API - Get all products with optional filters
app.get('/api/products', async (req, res) => {
  try {
    const { search, category, goal, minPrice, maxPrice, sortBy, limit } = req.query;
    
    let query = supabase
      .from('products')
      .select('*');
    
    // Apply filters
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    if (category) {
      query = query.eq('category', category);
    }
    
    if (goal) {
      query = query.eq('primary_goal', goal);
    }
    
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
        case 'title_desc':
          query = query.order('title', { ascending: false });
          break;
        default:
          query = query.order('title', { ascending: true });
      }
    } else {
      query = query.order('title', { ascending: true });
    }
    
    if (limit) {
      query = query.limit(parseInt(limit));
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching products:', error);
      return res.status(500).json({ error: 'Failed to fetch products' });
    }
    
    res.json({
      products: data || [],
      total: data?.length || 0,
      source: 'supabase'
    });
    
  } catch (error) {
    console.error('Products API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product analytics
app.get('/api/analytics', async (req, res) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('price_amount, category, primary_goal');
    
    if (error) {
      console.error('Error fetching analytics:', error);
      return res.status(500).json({ error: 'Failed to fetch analytics' });
    }
    
    if (!products || products.length === 0) {
      return res.json({
        total_products: 0,
        price_stats: { min: 0, max: 0, average: 0, median: 0 },
        categories: {},
        goals: {},
        price_ranges: { '$0-25': 0, '$26-50': 0, '$51-100': 0, '$100+': 0 },
        source: 'supabase'
      });
    }
    
    // Calculate analytics
    const prices = products
      .map(p => p.price_amount)
      .filter(p => p !== null && !isNaN(p));
    
    const categories = {};
    const goals = {};
    
    products.forEach(product => {
      if (product.category) {
        categories[product.category] = (categories[product.category] || 0) + 1;
      }
      
      if (product.primary_goal) {
        goals[product.primary_goal] = (goals[product.primary_goal] || 0) + 1;
      }
    });
    
    const priceStats = prices.length > 0 ? {
      min: Math.min(...prices),
      max: Math.max(...prices),
      average: prices.reduce((a, b) => a + b, 0) / prices.length,
      median: prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
    } : { min: 0, max: 0, average: 0, median: 0 };
    
    const priceRanges = prices.length > 0 ? {
      '$0-25': prices.filter(p => p <= 25).length,
      '$26-50': prices.filter(p => p > 25 && p <= 50).length,
      '$51-100': prices.filter(p => p > 50 && p <= 100).length,
      '$100+': prices.filter(p => p > 100).length
    } : { '$0-25': 0, '$26-50': 0, '$51-100': 0, '$100+': 0 };
    
    res.json({
      total_products: products.length,
      price_stats: priceStats,
      categories,
      goals,
      price_ranges: priceRanges,
      source: 'supabase'
    });
    
  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update product
app.post('/api/products', async (req, res) => {
  try {
    const productData = req.body;
    
    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select();
    
    if (error) {
      console.error('Error creating product:', error);
      return res.status(500).json({ error: 'Failed to create product' });
    }
    
    res.json({
      success: true,
      product: data[0]
    });
    
  } catch (error) {
    console.error('Create product API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Error updating product:', error);
      return res.status(500).json({ error: 'Failed to update product' });
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({
      success: true,
      product: data[0]
    });
    
  } catch (error) {
    console.error('Update product API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting product:', error);
      return res.status(500).json({ error: 'Failed to delete product' });
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Delete product API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Categories API
app.get('/api/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error fetching categories:', error);
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }
    
    res.json({ categories: data || [] });
    
  } catch (error) {
    console.error('Categories API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name: name.trim() }])
      .select();
    
    if (error) {
      console.error('Error creating category:', error);
      return res.status(500).json({ error: 'Failed to create category' });
    }
    
    res.json({
      success: true,
      category: data[0]
    });
    
  } catch (error) {
    console.error('Create category API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting category:', error);
      return res.status(500).json({ error: 'Failed to delete category' });
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Delete category API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to check if table exists
async function checkTableExists(tableName) {
  try {
    const { data } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', tableName);
    
    return data && data.length > 0;
  } catch (error) {
    return false;
  }
}

// Product Categories Junction API
app.get('/api/products/:productId/categories', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Check if product_categories table exists, if not fall back to single category
    const tableExists = await checkTableExists('product_categories');
    
    if (tableExists) {
      // New structure: multiple categories via junction table
      const { data, error } = await supabase
        .from('product_categories')
        .select(`
          category_id,
          categories (
            id,
            name,
            parent_id,
            is_sub_category
          )
        `)
        .eq('product_id', productId);
      
      if (error) {
        console.error('Error fetching product categories:', error);
        return res.status(500).json({ error: 'Failed to fetch product categories' });
      }
      
      const categories = data?.map(pc => pc.categories) || [];
      res.json({ categories });
    } else {
      // Fallback to single category from products table
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .eq('id', productId)
        .single();
      
      if (error) {
        console.error('Error fetching product category:', error);
        return res.status(500).json({ error: 'Failed to fetch product category' });
      }
      
      // Find matching category
      if (data.category) {
        const { data: categories } = await supabase
          .from('categories')
          .select('*')
          .eq('name', data.category);
        
        res.json({ categories: categories || [] });
      } else {
        res.json({ categories: [] });
      }
    }
  } catch (error) {
    console.error('Product categories API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/products/:productId/categories', async (req, res) => {
  try {
    const { productId } = req.params;
    const { category_ids } = req.body;
    
    if (!category_ids || !Array.isArray(category_ids)) {
      return res.status(400).json({ error: 'category_ids array is required' });
    }
    
    // Check if product_categories table exists
    const tableExists = await checkTableExists('product_categories');
    
    if (!tableExists) {
      return res.status(400).json({ 
        error: 'Product categories junction table not created. Please run the migration first.' 
      });
    }
    
    // First, remove all existing category assignments for this product
    const { error: deleteError } = await supabase
      .from('product_categories')
      .delete()
      .eq('product_id', productId);
    
    if (deleteError) {
      console.error('Error removing existing categories:', deleteError);
      return res.status(500).json({ error: 'Failed to update categories' });
    }
    
    // Then, add new category assignments
    if (category_ids.length > 0) {
      const insertData = category_ids.map(category_id => ({
        product_id: productId,
        category_id: category_id
      }));
      
      const { error: insertError } = await supabase
        .from('product_categories')
        .insert(insertData);
      
      if (insertError) {
        console.error('Error inserting new categories:', insertError);
        return res.status(500).json({ error: 'Failed to assign categories' });
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Assign categories API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/products/:productId/categories/:categoryId', async (req, res) => {
  try {
    const { productId, categoryId } = req.params;
    
    const { error } = await supabase
      .from('product_categories')
      .delete()
      .eq('product_id', productId)
      .eq('category_id', categoryId);
    
    if (error) {
      console.error('Error removing category from product:', error);
      return res.status(500).json({ error: 'Failed to remove category' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Remove category API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enhanced products API to include category relationships
app.get('/api/products/with-categories', async (req, res) => {
  try {
    // Check if product_categories table exists
    const tableExists = await checkTableExists('product_categories');
    
    if (tableExists) {
      // New structure: fetch products with their categories via junction table
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_categories (
            categories (
              id,
              name,
              parent_id,
              is_sub_category
            )
          )
        `);
      
      if (error) {
        console.error('Error fetching products with categories:', error);
        return res.status(500).json({ error: 'Failed to fetch products' });
      }
      
      res.json({ products: data || [] });
    } else {
      // Fallback to single category structure
      const { data, error } = await supabase
        .from('products')
        .select('*');
      
      if (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ error: 'Failed to fetch products' });
      }
      
      res.json({ products: data || [] });
    }
  } catch (error) {
    console.error('Products with categories API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Goals API
app.get('/api/goals', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error fetching goals:', error);
      return res.status(500).json({ error: 'Failed to fetch goals' });
    }
    
    res.json({ goals: data || [] });
    
  } catch (error) {
    console.error('Goals API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/goals', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Goal name is required' });
    }
    
    const { data, error } = await supabase
      .from('goals')
      .insert([{ name: name.trim() }])
      .select();
    
    if (error) {
      console.error('Error creating goal:', error);
      return res.status(500).json({ error: 'Failed to create goal' });
    }
    
    res.json({
      success: true,
      goal: data[0]
    });
    
  } catch (error) {
    console.error('Create goal API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/goals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting goal:', error);
      return res.status(500).json({ error: 'Failed to delete goal' });
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Delete goal API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve the web interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: 'supabase'
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Momentous Product Manager running at http://localhost:${PORT}`);
    console.log(`📊 API endpoints:`);
    console.log(`   GET /api/products - Get all products with optional filters`);
    console.log(`   GET /api/analytics - Get product analytics`);
    console.log(`   GET /api/categories - Get all categories`);
    console.log(`   GET /api/goals - Get all goals`);
    console.log(`   POST /api/products - Create new product`);
    console.log(`   PUT /api/products/:id - Update product`);
    console.log(`   DELETE /api/products/:id - Delete product`);
    console.log(`   Database: Supabase`);
  });
}

// Export for Vercel
module.exports = app;