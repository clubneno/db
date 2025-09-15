// Simple products endpoint for Vercel serverless functions
const { createClient } = require('@supabase/supabase-js');

// Simple session-based authentication store (in-memory for serverless)
const sessions = new Map();
const users = {
    'admin': 'password123',
    'user': 'pass123'
};

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Simple auth check
function requireAuth(req, res, callback) {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                 req.body?.token || 
                 req.query?.token;
    
    if (!token || !sessions.has(token)) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const session = sessions.get(token);
    if (Date.now() > session.expires) {
        sessions.delete(token);
        return res.status(401).json({ error: 'Session expired' });
    }
    
    callback();
}

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
        if (req.method === 'POST' && req.url === '/api/login') {
            const { username, password } = req.body || {};
            
            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password required' });
            }
            
            if (users[username] && users[username] === password) {
                const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
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
        
        if (req.method === 'GET' && req.url.startsWith('/api/products')) {
            return requireAuth(req, res, async () => {
                console.log('🔍 Fetching products from Supabase...');
                
                const { data: products, error } = await supabase
                    .from('products')
                    .select('*')
                    .order('title', { ascending: true });
                
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
            });
        }
        
        // Default response
        res.status(404).json({ error: 'Not found' });
        
    } catch (error) {
        console.error('💥 Error in products endpoint:', error);
        res.status(500).json({ error: 'Server error' });
    }
};