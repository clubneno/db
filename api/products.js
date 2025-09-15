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
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Handle different HTTP methods
    if (req.method === 'PUT') {
        return handleProductUpdate(req, res);
    } else if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // Temporarily make authentication optional for debugging
        const token = req.headers.authorization?.replace('Bearer ', '');
        let user = null;
        
        if (token) {
            try {
                console.log('Token provided, attempting verification...');
                const { data: { user: authUser }, error } = await supabaseAuth.auth.getUser(token);
                
                if (error) {
                    console.log('Auth verification failed:', error?.message);
                    // Continue without auth for now
                } else {
                    user = authUser;
                    console.log('Auth successful for user:', user.email);
                }
            } catch (authError) {
                console.log('Auth error:', authError.message);
                // Continue without auth for now
            }
        } else {
            console.log('No token provided, continuing without auth');
        }
        
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
            // Try multiple possible paths in Vercel environment
            const possiblePaths = [
                path.join(process.cwd(), 'data', 'latest.json'),
                path.join(__dirname, '..', 'data', 'latest.json'),
                './data/latest.json'
            ];
            
            let dataLoaded = false;
            for (const dataPath of possiblePaths) {
                try {
                    if (fs.existsSync(dataPath)) {
                        localProducts = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                        console.log(`✅ Loaded ${localProducts.length} products from ${dataPath}`);
                        dataLoaded = true;
                        break;
                    } else {
                        console.log(`❌ Path not found: ${dataPath}`);
                    }
                } catch (pathError) {
                    console.log(`❌ Error with path ${dataPath}:`, pathError.message);
                }
            }
            
            if (!dataLoaded) {
                console.log('⚠️ No local product data found in any path');
            }
        } catch (error) {
            console.log('💥 Error loading local products:', error.message);
        }
        
        // Merge Supabase data with local data
        const mergedProducts = (supabaseProducts || []).map(supabaseProduct => {
            // Find matching local product by handle
            const localProduct = localProducts.find(local => 
                local.handle === supabaseProduct.handle ||
                local.title === supabaseProduct.title
            );
            
            if (localProduct) {
                // PRIORITIZE local JSON data (has user-added data) and supplement with Supabase metadata
                return {
                    // Keep essential Supabase metadata
                    id: supabaseProduct.id,
                    scraped_at: supabaseProduct.scraped_at,
                    
                    // Prioritize Supabase for EU/business fields (if they exist)
                    eu_notification_status: supabaseProduct.eu_notification_status || 'Not started',
                    eu_allowed: supabaseProduct.eu_allowed || 'yes',
                    hs_code: supabaseProduct.hs_code,
                    hs_code_description: supabaseProduct.hs_code_description,
                    duty_rate: supabaseProduct.duty_rate,
                    
                    // Prioritize LOCAL JSON for all content (has user-added data)
                    title: localProduct.title,
                    handle: localProduct.handle,
                    price: localProduct.price,
                    subscriptionPrice: localProduct.subscriptionPrice,
                    price_amount: localProduct.price ? parseFloat(localProduct.price.replace(/[$,]/g, '')) : null,
                    price_display: localProduct.price,
                    subscription_price_amount: localProduct.subscriptionPrice ? parseFloat(localProduct.subscriptionPrice.replace(/[$,]/g, '')) : null,
                    subscription_price_display: localProduct.subscriptionPrice,
                    image: localProduct.image,
                    main_image: localProduct.image,
                    images: localProduct.images,
                    description: localProduct.description,
                    full_description: localProduct.fullDescription,
                    category: localProduct.category,
                    categories: localProduct.categories,
                    primary_goal: localProduct.primaryGoal,
                    primaryGoal: localProduct.primaryGoal,
                    goals: localProduct.goals,
                    vendor: localProduct.vendor,
                    availability: localProduct.availability,
                    product_type: localProduct.productType,
                    productType: localProduct.productType,
                    link: localProduct.link,
                    variants: localProduct.variants,
                    benefits: localProduct.benefits,
                    ingredients: localProduct.ingredients,
                    usage: localProduct.usage,
                    tags: localProduct.tags,
                    tagsString: localProduct.tagsString,
                    flavors: localProduct.flavors,
                    
                    // Timestamps
                    created_at: localProduct.createdAt,
                    updated_at: localProduct.updatedAt,
                    createdAt: localProduct.createdAt,
                    updatedAt: localProduct.updatedAt
                };
            } else {
                // Only Supabase data available
                return supabaseProduct;
            }
        });
        
        console.log(`Merged data for ${mergedProducts.length} products (local: ${localProducts.length})`);
        
        // If no local data was found, return Supabase data with warning
        if (localProducts.length === 0) {
            console.log('⚠️ No local data available, returning Supabase data only');
            return res.json({
                products: supabaseProducts || [],
                total: (supabaseProducts || []).length,
                source: 'supabase-only',
                message: 'Local product data not available in serverless environment',
                warning: 'Rich product data not loaded - local JSON file not found'
            });
        }
        
        return res.json({
            products: mergedProducts,
            total: mergedProducts.length,
            source: 'hybrid-merged',
            message: `Products with merged local (${localProducts.length}) and Supabase (${(supabaseProducts || []).length}) data`
        });
        
    } catch (error) {
        console.error('Endpoint error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// Handle PUT requests for product updates
async function handleProductUpdate(req, res) {
    try {
        console.log('PUT /api/products - Handling product update request');
        
        // Extract product handle from URL path
        const urlPath = req.url || '';
        const pathParts = urlPath.split('/');
        const handle = pathParts[pathParts.length - 1]; // Get last part of path
        
        console.log('PUT /api/products - Product handle:', handle);
        console.log('PUT /api/products - Request body:', req.body);
        
        if (!handle || handle === 'products') {
            return res.status(400).json({ error: 'Product handle is required' });
        }
        
        // Temporarily make authentication optional for debugging
        const token = req.headers.authorization?.replace('Bearer ', '');
        let user = null;
        
        if (token) {
            console.log('PUT /api/products - Token provided, skipping auth for debugging');
            // Skip auth verification for now
        } else {
            console.log('PUT /api/products - No token provided, continuing without auth');
        }
        
        // Get update data from request body
        const updateData = req.body;
        
        // Update product in Supabase
        const { data, error: updateError } = await supabase
            .from('products')
            .update({
                title: updateData.productName,
                eu_allowed: updateData.euAllowed,
                updated_at: new Date().toISOString()
            })
            .eq('handle', handle)
            .select();
        
        if (updateError) {
            console.error('Database update error:', updateError);
            return res.status(500).json({ error: 'Database update failed', details: updateError.message });
        }
        
        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        console.log(`✅ Successfully updated product: ${handle}`);
        
        return res.json({
            success: true,
            message: 'Product updated successfully',
            product: data[0]
        });
        
    } catch (error) {
        console.error('PUT endpoint error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
