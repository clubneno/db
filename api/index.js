const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://baqdzabfkhtgnxzhoyax.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNjk4OSwiZXhwIjoyMDczNDkyOTg5fQ.SZmjBrkLRJ0jjNEiRUgXl2mLuTOqzU78t9abfojWixU'
);

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// Helper function to handle CORS preflight
const handleCors = (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'OK' });
  }
};

// Helper function to handle errors
const handleError = (res, error, message = 'Internal server error') => {
  console.error(message + ':', error);
  return res.status(500).json({ error: message });
};

// Helper function for successful responses
const sendResponse = (res, data, status = 200) => {
  return res.status(status).json(data);
};

// Helper function to parse request body
const parseBody = async (req) => {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
    } else {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          resolve({});
        }
      });
    }
  });
};

module.exports = async (req, res) => {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, method } = req;
  const path = url.split('?')[0];

  try {
    // Route: /api/config
    if (path === '/api/config' && method === 'GET') {
      return sendResponse(res, {
        supabaseUrl: process.env.SUPABASE_URL || 'https://baqdzabfkhtgnxzhoyax.supabase.co',
        supabaseKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MTY5ODksImV4cCI6MjA3MzQ5Mjk4OX0.qJZBWBApyQf8xgV0EuIZkGOy5pDbNhLXfzHklOL_V5o'
      });
    }

    // Route: /api/health
    if (path === '/api/health' && method === 'GET') {
      return sendResponse(res, {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'supabase'
      });
    }

    // Route: /api/products
    if (path === '/api/products' && method === 'GET') {
      const { search, category, goal, minPrice, maxPrice, sortBy, limit } = req.query;
      
      let query = supabase.from('products').select('*');
      
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
        return handleError(res, error, 'Failed to fetch products');
      }
      
      return sendResponse(res, {
        products: data || [],
        total: data?.length || 0,
        source: 'supabase'
      });
    }

    // Route: /api/products POST (Create product)
    if (path === '/api/products' && method === 'POST') {
      const body = await parseBody(req);
      
      const { data, error } = await supabase
        .from('products')
        .insert([body])
        .select();
      
      if (error) {
        return handleError(res, error, 'Failed to create product');
      }
      
      return sendResponse(res, {
        success: true,
        product: data[0]
      });
    }

    // Route: /api/products/:id PUT (Update product)
    if (path.match(/^\/api\/products\/\d+$/) && method === 'PUT') {
      const id = path.split('/')[3];
      const body = await parseBody(req);
      
      const { data, error } = await supabase
        .from('products')
        .update(body)
        .eq('id', id)
        .select();
      
      if (error) {
        return handleError(res, error, 'Failed to update product');
      }
      
      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      return sendResponse(res, {
        success: true,
        product: data[0]
      });
    }

    // Route: /api/products/:id DELETE (Delete product)
    if (path.match(/^\/api\/products\/\d+$/) && method === 'DELETE') {
      const id = path.split('/')[3];
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) {
        return handleError(res, error, 'Failed to delete product');
      }
      
      return sendResponse(res, { success: true });
    }

    // Route: /api/analytics
    if (path === '/api/analytics' && method === 'GET') {
      const { data: products, error } = await supabase
        .from('products')
        .select('price_amount, category, primary_goal');
      
      if (error) {
        return handleError(res, error, 'Failed to fetch analytics');
      }
      
      if (!products || products.length === 0) {
        return sendResponse(res, {
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
      const subcategories = {};
      
      products.forEach(product => {
        if (product.category) {
          categories[product.category] = (categories[product.category] || 0) + 1;
        }
        if (product.subcategory) {
          subcategories[product.subcategory] = (subcategories[product.subcategory] || 0) + 1;
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
      
      return sendResponse(res, {
        total_products: products.length,
        price_stats: priceStats,
        categories,
        subcategories,
        price_ranges: priceRanges,
        source: 'supabase'
      });
    }

    // Route: /api/categories
    if (path === '/api/categories' && method === 'GET') {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        return handleError(res, error, 'Failed to fetch categories');
      }
      
      return sendResponse(res, { categories: data || [] });
    }

    // Route: /api/categories POST (Create category)
    if (path === '/api/categories' && method === 'POST') {
      const body = await parseBody(req);
      const { name, parent_id, is_sub_category } = body;
      
      if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
      }
      
      const insertData = { name: name.trim() };
      if (parent_id) insertData.parent_id = parent_id;
      if (is_sub_category !== undefined) insertData.is_sub_category = is_sub_category;
      
      const { data, error } = await supabase
        .from('categories')
        .insert([insertData])
        .select();
      
      if (error) {
        return handleError(res, error, 'Failed to create category');
      }
      
      return sendResponse(res, {
        success: true,
        category: data[0]
      });
    }

    // Route: /api/categories/:id DELETE (Delete category)
    if (path.match(/^\/api\/categories\/\d+$/) && method === 'DELETE') {
      const id = path.split('/')[3];
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
      
      if (error) {
        return handleError(res, error, 'Failed to delete category');
      }
      
      return sendResponse(res, { success: true });
    }

    // Goals endpoints removed - using hierarchical categories instead

    // Default route - serve static files or 404
    if (path === '/' || path === '/index.html') {
      // For the root path, we'll let Vercel serve the static files
      return res.status(200).end();
    }

    // 404 for unmatched routes
    return res.status(404).json({ error: 'Route not found' });

  } catch (error) {
    return handleError(res, error);
  }
};