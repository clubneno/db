// Products API endpoint
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
            console.log('No token provided');
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Verify token
        const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
        
        if (error || !user) {
            console.log('Auth verification failed:', error?.message);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        console.log('Auth successful for user:', user.email);
        
        // Get products from Supabase
        const { data: products, error: dbError } = await supabase
            .from('products')
            .select('*');
        
        if (dbError) {
            console.error('Database error:', dbError);
            return res.status(500).json({ error: 'Database error' });
        }
        
        console.log(`Fetched ${products?.length || 0} products`);
        
        return res.json({
            products: products || [],
            total: products?.length || 0,
            source: 'supabase',
            message: 'Products endpoint working'
        });
        
    } catch (error) {
        console.error('Endpoint error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
