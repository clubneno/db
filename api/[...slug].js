// Combined API handler for all routes - Vercel catch-all function
const { createClient } = require('@supabase/supabase-js');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://baqdzabfkhtgnxzhoyax.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNjk4OSwiZXhwIjoyMDczNDkyOTg5fQ.SZmjBrkLRJ0jjNEiRUgXl2mLuTOqzU78t9abfojWixU'
);

// Helper function to load local product data
const loadLocalProducts = () => {
  try {
    const dataPath = path.join(process.cwd(), 'data', 'latest.json');
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
    return [];
  } catch (error) {
    console.error('Error loading local products:', error);
    return [];
  }
};

// Helper function to extract price from string
const extractPrice = (priceString) => {
  if (!priceString) return 0;
  const matches = priceString.toString().match(/[\d,]+\.?\d*/);
  return matches ? parseFloat(matches[0].replace(',', '')) : 0;
};

// Authentication middleware for Supabase
async function requireAuth(req) {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        console.log('Auth check - Token present:', !!token);
        console.log('Auth check - Supabase client initialized:', !!supabase);
        
        if (!token) {
            console.log('No token provided');
            return { error: 'Authentication required', status: 401 };
        }
        
        // Verify the token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        console.log('Supabase auth result:', { user: !!user, error: error?.message });
        
        if (error || !user) {
            console.log('Auth verification failed:', error);
            return { error: 'Invalid or expired token', status: 401 };
        }
        
        console.log('Auth successful for user:', user.email);
        return { user: user };
        
    } catch (error) {
        console.error('Authentication middleware error:', error);
        return { error: 'Authentication failed', status: 401 };
    }
}

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;
    
    try {
        // Config endpoint for frontend
        if (req.method === 'GET' && pathname === '/api/config') {
            return res.json({
                supabaseUrl: process.env.SUPABASE_URL || 'https://baqdzabfkhtgnxzhoyax.supabase.co',
                supabaseKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MTY5ODksImV4cCI6MjA3MzQ5Mjk4OX0.qJZBWBApyQf8xgV0EuIZkGOy5pDbNhLXfzHklOL_V5o'
            });
        }
        
        // Products endpoint - Hybrid approach (Supabase + Local JSON fallback)
        if (req.method === 'GET' && pathname === '/api/products') {
            const authResult = await requireAuth(req);
            if (authResult.error) {
                return res.status(authResult.status).json({ error: authResult.error });
            }
            
            console.log('🔍 Fetching products...');
            
            // Try Supabase first
            const { data: supabaseProducts } = await supabase.from('products').select('*').limit(5);
            
            // Check if Supabase has meaningful data
            const hasUsefulSupabaseData = supabaseProducts && supabaseProducts.some(p => 
              p.price_amount || p.description || p.image || p.category
            );
            
            let products = [];
            let dataSource = 'local';
            
            if (hasUsefulSupabaseData) {
                console.log('✅ Using Supabase data');
                dataSource = 'supabase';
                let dbQuery = supabase.from('products').select('*');
                
                const { category, goal, minPrice, maxPrice, search, sortBy, euNotificationStatus } = query;
                
                if (search) dbQuery = dbQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
                if (category) dbQuery = dbQuery.or(`category.ilike.%${category}%,categories.cs.["%{category}"]`);
                if (goal) dbQuery = dbQuery.or(`primary_goal.ilike.%${goal}%,goals.cs.["%{goal}"]`);
                if (minPrice) dbQuery = dbQuery.gte('price_amount', parseFloat(minPrice));
                if (maxPrice) dbQuery = dbQuery.lte('price_amount', parseFloat(maxPrice));
                if (euNotificationStatus) dbQuery = dbQuery.eq('eu_notification_status', euNotificationStatus);
                
                if (sortBy) {
                    switch (sortBy) {
                        case 'price_asc': dbQuery = dbQuery.order('price_amount', { ascending: true }); break;
                        case 'price_desc': dbQuery = dbQuery.order('price_amount', { ascending: false }); break;
                        case 'name_asc': dbQuery = dbQuery.order('title', { ascending: true }); break;
                        case 'name_desc': dbQuery = dbQuery.order('title', { ascending: false }); break;
                        default: dbQuery = dbQuery.order('title', { ascending: true });
                    }
                } else {
                    dbQuery = dbQuery.order('title', { ascending: true });
                }
                
                const { data } = await dbQuery;
                products = data || [];
            } else {
                console.log('⚠️ Supabase data is incomplete, using local JSON');
                
                // Load from local JSON
                let localProducts = loadLocalProducts();
                const { category, goal, minPrice, maxPrice, search, sortBy } = query;
                
                // Apply filters to local data
                if (search) {
                    const searchLower = search.toLowerCase();
                    localProducts = localProducts.filter(p => 
                        (p.title && p.title.toLowerCase().includes(searchLower)) ||
                        (p.description && p.description.toLowerCase().includes(searchLower))
                    );
                }
                
                if (category) {
                    localProducts = localProducts.filter(p => 
                        (p.category && p.category.toLowerCase().includes(category.toLowerCase())) ||
                        (p.categories && p.categories.some(c => c.toLowerCase().includes(category.toLowerCase())))
                    );
                }
                
                if (goal) {
                    localProducts = localProducts.filter(p => 
                        (p.primaryGoal && p.primaryGoal.toLowerCase().includes(goal.toLowerCase())) ||
                        (p.goals && p.goals.some(g => g.toLowerCase().includes(goal.toLowerCase())))
                    );
                }
                
                if (minPrice || maxPrice) {
                    localProducts = localProducts.filter(p => {
                        const price = extractPrice(p.price);
                        if (minPrice && price < parseFloat(minPrice)) return false;
                        if (maxPrice && price > parseFloat(maxPrice)) return false;
                        return true;
                    });
                }
                
                // Apply sorting
                if (sortBy) {
                    switch (sortBy) {
                        case 'price_asc':
                            localProducts.sort((a, b) => extractPrice(a.price) - extractPrice(b.price));
                            break;
                        case 'price_desc':
                            localProducts.sort((a, b) => extractPrice(b.price) - extractPrice(a.price));
                            break;
                        case 'name_asc':
                            localProducts.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                            break;
                        case 'name_desc':
                            localProducts.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
                            break;
                    }
                }
                
                products = localProducts;
            }
            
            console.log(`✅ Returning ${products.length} products from ${dataSource}`);
            
            return res.json({
                products: products,
                total: products.length,
                source: dataSource,
                scraped_at: dataSource === 'local' ? new Date().toISOString() : null
            });
        }
        
        // Analytics endpoint
        if (req.method === 'GET' && pathname === '/api/analytics') {
            const authResult = await requireAuth(req);
            if (authResult.error) {
                return res.status(authResult.status).json({ error: authResult.error });
            }
            
            console.log('📊 Generating analytics...');
            
            // Check which data source to use (same logic as products endpoint)
            const { data: supabaseProducts } = await supabase.from('products').select('*').limit(5);
            const hasUsefulSupabaseData = supabaseProducts && supabaseProducts.some(p => 
                p.price_amount || p.description || p.image || p.category
            );
            
            let products = [];
            let dataSource = 'local';
            
            if (hasUsefulSupabaseData) {
                console.log('✅ Using Supabase data for analytics');
                dataSource = 'supabase';
                const { data } = await supabase
                    .from('products')
                    .select('price_amount, category, primary_goal, categories, goals, db_created_at');
                products = data || [];
            } else {
                console.log('⚠️ Using local JSON for analytics');
                products = loadLocalProducts();
            }
            
            if (!products || products.length === 0) {
                return res.json({
                    total_products: 0,
                    price_stats: { min: 0, max: 0, average: 0, median: 0 },
                    categories: {},
                    goals: {},
                    price_ranges: { '$0-25': 0, '$26-50': 0, '$51-100': 0, '$100+': 0 },
                    source: dataSource
                });
            }
            
            // Generate analytics based on data source
            let prices = [];
            const categories = {};
            const goals = {};
            
            if (dataSource === 'supabase') {
                // Supabase data structure
                prices = products
                    .map(p => p.price_amount)
                    .filter(p => p !== null && !isNaN(p));
                
                products.forEach(product => {
                    if (product.categories && Array.isArray(product.categories)) {
                        product.categories.forEach(category => {
                            if (category) categories[category] = (categories[category] || 0) + 1;
                        });
                    }
                    if (product.category) {
                        categories[product.category] = (categories[product.category] || 0) + 1;
                    }
                    
                    if (product.goals && Array.isArray(product.goals)) {
                        product.goals.forEach(goal => {
                            if (goal) goals[goal] = (goals[goal] || 0) + 1;
                        });
                    }
                    if (product.primary_goal) {
                        goals[product.primary_goal] = (goals[product.primary_goal] || 0) + 1;
                    }
                });
            } else {
                // Local JSON data structure
                prices = products
                    .map(p => extractPrice(p.price))
                    .filter(p => p > 0);
                
                products.forEach(product => {
                    if (product.categories && Array.isArray(product.categories)) {
                        product.categories.forEach(category => {
                            if (category) categories[category] = (categories[category] || 0) + 1;
                        });
                    }
                    if (product.category) {
                        categories[product.category] = (categories[product.category] || 0) + 1;
                    }
                    
                    if (product.goals && Array.isArray(product.goals)) {
                        product.goals.forEach(goal => {
                            if (goal) goals[goal] = (goals[goal] || 0) + 1;
                        });
                    }
                    if (product.primaryGoal) {
                        goals[product.primaryGoal] = (goals[product.primaryGoal] || 0) + 1;
                    }
                });
            }
            
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
                price_ranges: prices.length > 0 ? {
                    '$0-25': prices.filter(p => p <= 25).length,
                    '$26-50': prices.filter(p => p > 25 && p <= 50).length,
                    '$51-100': prices.filter(p => p > 50 && p <= 100).length,
                    '$100+': prices.filter(p => p > 100).length
                } : { '$0-25': 0, '$26-50': 0, '$51-100': 0, '$100+': 0 },
                source: dataSource
            };
            
            console.log(`✅ Analytics generated for ${products.length} products from ${dataSource}`);
            return res.json(analytics);
        }
        
        // Debug endpoint
        if (req.method === 'GET' && pathname === '/api/debug') {
            const envVars = {
                NODE_ENV: process.env.NODE_ENV,
                SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT SET',
                SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
                SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'
            };
            
            return res.json({
                message: 'Environment Variables Status',
                env: envVars,
                timestamp: new Date().toISOString()
            });
        }
        
        // Debug auth endpoint
        if (req.method === 'GET' && pathname === '/api/debug-auth') {
            const token = req.headers.authorization?.replace('Bearer ', '');
            const authResult = await requireAuth(req);
            
            return res.json({
                message: 'Authentication Debug',
                hasToken: !!token,
                tokenLength: token ? token.length : 0,
                authResult: {
                    hasError: !!authResult.error,
                    error: authResult.error,
                    hasUser: !!authResult.user,
                    userEmail: authResult.user?.email
                },
                timestamp: new Date().toISOString()
            });
        }
        
        // Default response
        return res.status(404).json({ error: 'Endpoint not found' });
        
    } catch (error) {
        console.error('💥 API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};