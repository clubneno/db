// Analytics API endpoint
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase clients
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://baqdzabfkhtgnxzhoyax.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNjk4OSwiZXhwIjoyMDczNDkyOTg5fQ.SZmjBrkLRJ0jjNEiRUgXl2mLuTOqzU78t9abfojWixU'
);

const supabaseAuth = createClient(
  process.env.SUPABASE_URL || 'https://baqdzabfkhtgnxzhoyax.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MTY5ODksImV4cCI6MjA3MzQ5Mjk4OX0.qJZBWBApyQf8xgV0EuIZkGOy5pDbNhLXfzHklOL_V5o'
);

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // Check authentication
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            console.log('No token provided for analytics');
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Verify token
        const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
        
        if (error || !user) {
            console.log('Analytics auth verification failed:', error?.message);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        console.log('Analytics auth successful for user:', user.email);
        
        // Get products for analytics
        const { data: products, error: dbError } = await supabase
            .from('products')
            .select('price_amount, category, primary_goal, categories, goals');
        
        if (dbError) {
            console.error('Analytics database error:', dbError);
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Generate analytics
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
        
        console.log(`Analytics generated for ${products.length} products`);
        return res.json(analytics);
        
    } catch (error) {
        console.error('Analytics endpoint error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
