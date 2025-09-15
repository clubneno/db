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
                // PRESERVE Supabase data first, then enhance with local data only where missing
                return {
                    // Always preserve ALL Supabase data (including user-added data)
                    ...supabaseProduct,
                    
                    // Only enhance with local data if Supabase field is empty/null
                    title: supabaseProduct.title || localProduct.title,
                    description: supabaseProduct.description || localProduct.description,
                    full_description: supabaseProduct.full_description || localProduct.fullDescription,
                    image: supabaseProduct.image || localProduct.image,
                    main_image: supabaseProduct.main_image || localProduct.image,
                    price_amount: supabaseProduct.price_amount || (localProduct.price ? parseFloat(localProduct.price.replace(/[$,]/g, '')) : null),
                    price_display: supabaseProduct.price_display || localProduct.price,
                    subscription_price_amount: supabaseProduct.subscription_price_amount || (localProduct.subscriptionPrice ? parseFloat(localProduct.subscriptionPrice.replace(/[$,]/g, '')) : null),
                    subscription_price_display: supabaseProduct.subscription_price_display || localProduct.subscriptionPrice,
                    category: supabaseProduct.category || localProduct.category,
                    primary_goal: supabaseProduct.primary_goal || localProduct.primaryGoal,
                    link: supabaseProduct.link || localProduct.link,
                    availability: supabaseProduct.availability || localProduct.availability,
                    product_type: supabaseProduct.product_type || localProduct.productType,
                    
                    // Add local-only fields as additional data (not overwriting Supabase)
                    local_images: localProduct.images,
                    local_variants: localProduct.variants,
                    local_benefits: localProduct.benefits,
                    local_ingredients: localProduct.ingredients,
                    local_usage: localProduct.usage,
                    local_tags: localProduct.tags
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
