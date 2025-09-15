// Combined API handler for all routes - Vercel catch-all function
const { createClient } = require('@supabase/supabase-js');
const url = require('url');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// In-memory session store (shared across all routes in this function)
const sessions = new Map();
const users = {
    'admin': 'password123',
    'user': 'pass123'
};

// Generate simple token
function generateToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Auth middleware
function requireAuth(req) {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                 req.body?.token || 
                 req.query?.token;
    
    if (!token || !sessions.has(token)) {
        return { error: 'Authentication required', status: 401 };
    }
    
    const session = sessions.get(token);
    if (Date.now() > session.expires) {
        sessions.delete(token);
        return { error: 'Session expired', status: 401 };
    }
    
    return { user: session.user };
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
        // Login endpoint
        if (req.method === 'POST' && pathname === '/api/login') {
            const { username, password } = req.body || {};
            
            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password required' });
            }
            
            if (users[username] && users[username] === password) {
                const token = generateToken();
                const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
                
                sessions.set(token, {
                    user: username,
                    expires: expires
                });
                
                return res.json({ 
                    success: true, 
                    token: token,
                    user: username,
                    message: 'Login successful'
                });
            } else {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        }
        
        // Logout endpoint
        if (req.method === 'POST' && pathname === '/api/logout') {
            const token = req.headers.authorization?.replace('Bearer ', '') || 
                         req.body?.token || 
                         req.query?.token;
            
            if (token && sessions.has(token)) {
                sessions.delete(token);
            }
            
            return res.json({ success: true, message: 'Logout successful' });
        }
        
        // Auth check endpoint
        if (req.method === 'GET' && pathname === '/api/auth/check') {
            const authResult = requireAuth(req);
            if (authResult.error) {
                return res.status(authResult.status).json({ error: authResult.error });
            }
            return res.json({ 
                authenticated: true, 
                user: authResult.user 
            });
        }
        
        // Products endpoint
        if (req.method === 'GET' && pathname === '/api/products') {
            const authResult = requireAuth(req);
            if (authResult.error) {
                return res.status(authResult.status).json({ error: authResult.error });
            }
            
            console.log('🔍 Fetching products from Supabase...');
            
            let dbQuery = supabase.from('products').select('*');
            
            // Apply filters
            const { category, goal, minPrice, maxPrice, search, sortBy, euNotificationStatus } = query;
            
            if (search) {
                dbQuery = dbQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
            }
            
            if (category) {
                dbQuery = dbQuery.or(`category.ilike.%${category}%,categories.cs.["${category}"]`);
            }
            
            if (goal) {
                dbQuery = dbQuery.or(`primary_goal.ilike.%${goal}%,goals.cs.["${goal}"]`);
            }
            
            if (minPrice) {
                dbQuery = dbQuery.gte('price_amount', parseFloat(minPrice));
            }
            
            if (maxPrice) {
                dbQuery = dbQuery.lte('price_amount', parseFloat(maxPrice));
            }
            
            if (euNotificationStatus) {
                dbQuery = dbQuery.eq('eu_notification_status', euNotificationStatus);
            }
            
            // Apply sorting
            if (sortBy) {
                switch (sortBy) {
                    case 'price_asc':
                        dbQuery = dbQuery.order('price_amount', { ascending: true });
                        break;
                    case 'price_desc':
                        dbQuery = dbQuery.order('price_amount', { ascending: false });
                        break;
                    case 'name_asc':
                        dbQuery = dbQuery.order('title', { ascending: true });
                        break;
                    case 'name_desc':
                        dbQuery = dbQuery.order('title', { ascending: false });
                        break;
                    default:
                        dbQuery = dbQuery.order('title', { ascending: true });
                }
            } else {
                dbQuery = dbQuery.order('title', { ascending: true });
            }
            
            const { data: products, error } = await dbQuery;
            
            if (error) {
                console.error('❌ Supabase error:', error);
                return res.status(500).json({ error: 'Failed to fetch products from database' });
            }
            
            console.log(`✅ Fetched ${products?.length || 0} products from Supabase`);
            
            return res.json({
                products: products || [],
                total: products?.length || 0,
                source: 'supabase'
            });
        }
        
        // Analytics endpoint
        if (req.method === 'GET' && pathname === '/api/analytics') {
            const authResult = requireAuth(req);
            if (authResult.error) {
                return res.status(authResult.status).json({ error: authResult.error });
            }
            
            console.log('📊 Generating analytics from Supabase...');
            
            const { data: products, error } = await supabase
                .from('products')
                .select('price_amount, category, primary_goal, categories, goals, db_created_at');
            
            if (error) {
                console.error('❌ Supabase analytics error:', error);
                return res.status(500).json({ error: 'Failed to fetch analytics data' });
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
            
            // Generate analytics
            const prices = products
                .map(p => p.price_amount)
                .filter(p => p !== null && !isNaN(p));
            
            const categories = {};
            const goals = {};
            
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
                source: 'supabase'
            };
            
            console.log(`✅ Analytics generated for ${products.length} products`);
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
                timestamp: new Date().toISOString(),
                sessions_count: sessions.size
            });
        }
        
        // Default response
        return res.status(404).json({ error: 'Endpoint not found' });
        
    } catch (error) {
        console.error('💥 API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};