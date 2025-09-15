// Products API endpoint
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
        const { data: supabaseProducts, error: dbError } = await supabase
            .from('products')
            .select('*');
        
        if (dbError) {
            console.error('Database error:', dbError);
            return res.status(500).json({ error: 'Database error' });
        }
        
        console.log(`Fetched ${supabaseProducts?.length || 0} products from Supabase`);
        
        // Load local JSON data with rich information
        let localProducts = [];
        try {
            const dataPath = path.join(process.cwd(), 'data', 'latest.json');
            if (fs.existsSync(dataPath)) {
                localProducts = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                console.log(`Loaded ${localProducts.length} products from local JSON`);
            }
        } catch (error) {
            console.log('Could not load local products:', error.message);
        }
        
        // Merge Supabase data with local data
        const mergedProducts = (supabaseProducts || []).map(supabaseProduct => {
            // Find matching local product by handle
            const localProduct = localProducts.find(local => 
                local.handle === supabaseProduct.handle ||
                local.title === supabaseProduct.title
            );
            
            if (localProduct) {
                // Merge: use local data for rich content, Supabase for metadata
                return {
                    // From Supabase (IDs, metadata, custom fields)
                    id: supabaseProduct.id,
                    eu_notification_status: supabaseProduct.eu_notification_status,
                    eu_allowed: supabaseProduct.eu_allowed,
                    hs_code: supabaseProduct.hs_code,
                    duty_rate: supabaseProduct.duty_rate,
                    
                    // From local JSON (rich content)
                    title: localProduct.title || supabaseProduct.title,
                    handle: localProduct.handle || supabaseProduct.handle,
                    price: localProduct.price,
                    subscriptionPrice: localProduct.subscriptionPrice,
                    price_amount: localProduct.price ? parseFloat(localProduct.price.replace(/[$,]/g, '')) : null,
                    subscription_price_amount: localProduct.subscriptionPrice ? parseFloat(localProduct.subscriptionPrice.replace(/[$,]/g, '')) : null,
                    image: localProduct.image,
                    images: localProduct.images,
                    description: localProduct.description,
                    fullDescription: localProduct.fullDescription,
                    category: localProduct.category || supabaseProduct.category,
                    primaryGoal: localProduct.primaryGoal || supabaseProduct.primary_goal,
                    vendor: localProduct.vendor || supabaseProduct.vendor,
                    availability: localProduct.availability,
                    productType: localProduct.productType,
                    link: localProduct.link,
                    variants: localProduct.variants,
                    benefits: localProduct.benefits,
                    ingredients: localProduct.ingredients,
                    usage: localProduct.usage,
                    tags: localProduct.tags,
                    
                    // Timestamps
                    createdAt: localProduct.createdAt,
                    updatedAt: localProduct.updatedAt,
                    scraped_at: supabaseProduct.scraped_at
                };
            } else {
                // Only Supabase data available
                return supabaseProduct;
            }
        });
        
        console.log(`Merged data for ${mergedProducts.length} products`);
        
        return res.json({
            products: mergedProducts,
            total: mergedProducts.length,
            source: 'hybrid-merged',
            message: 'Products with merged local and Supabase data'
        });
        
    } catch (error) {
        console.error('Endpoint error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
