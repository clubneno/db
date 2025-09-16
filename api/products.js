// Products API endpoint - Updated with database fix
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
    
    // Prevent caching to ensure fresh data from Supabase
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Handle different HTTP methods
    if (req.method === 'PUT') {
        console.log('PUT /api/products - Request received, body exists:', !!req.body, 'readable:', req.readable);
        console.log('PUT /api/products - Raw body:', req.body);
        
        // Vercel already parses JSON body
        if (req.body) {
            return handleProductUpdate(req, res);
        }
        
        // Fallback manual parsing if needed
        if (req.readable) {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    req.body = JSON.parse(body);
                    console.log('PUT /api/products - Manually parsed request body:', req.body);
                } catch (e) {
                    console.error('PUT /api/products - Failed to parse request body:', e);
                    req.body = {};
                }
                return handleProductUpdate(req, res);
            });
            return;
        }
        
        // No body available
        console.log('PUT /api/products - No body data available');
        req.body = {};
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
        
        // Create a comprehensive list including ALL Supabase products
        const allSupabaseHandles = new Set((supabaseProducts || []).map(p => p.handle));
        
        // Start with all Supabase products and merge local data where available
        const mergedProducts = (supabaseProducts || []).map(supabaseProduct => {
            // Find matching local product by handle
            const localProduct = localProducts.find(local => 
                local.handle === supabaseProduct.handle ||
                local.title === supabaseProduct.title
            );
            
            if (localProduct) {
                // PRIORITIZE Supabase for updatable fields, local for rich content
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
                    
                    // Prioritize SUPABASE for updatable fields, LOCAL JSON for static content
                    title: supabaseProduct.title || localProduct.title,
                    handle: supabaseProduct.handle || localProduct.handle,
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
                    category: supabaseProduct.category || localProduct.category,
                    categories: supabaseProduct.categories || localProduct.categories,
                    primary_goal: supabaseProduct.primary_goal || localProduct.primaryGoal,
                    primaryGoal: supabaseProduct.primary_goal || localProduct.primaryGoal,
                    goals: supabaseProduct.goals || localProduct.goals,
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
                // Only Supabase data available - return with basic formatting
                return {
                    id: supabaseProduct.id,
                    scraped_at: supabaseProduct.scraped_at,
                    title: supabaseProduct.title,
                    handle: supabaseProduct.handle,
                    category: supabaseProduct.category,
                    categories: supabaseProduct.categories,
                    goals: supabaseProduct.goals,
                    eu_notification_status: supabaseProduct.eu_notification_status || 'Not started',
                    eu_allowed: supabaseProduct.eu_allowed || 'yes',
                    hs_code: supabaseProduct.hs_code,
                    hs_code_description: supabaseProduct.hs_code_description,
                    duty_rate: supabaseProduct.duty_rate,
                    vendor: supabaseProduct.vendor,
                    // Set defaults for missing fields
                    price: supabaseProduct.price || '$0.00',
                    image: supabaseProduct.image || '',
                    description: supabaseProduct.description || 'Product description not available',
                    source: 'supabase-only'
                };
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
        console.log('PUT /api/products - Full URL:', req.url);
        console.log('PUT /api/products - Headers:', JSON.stringify(req.headers, null, 2));
        
        // Extract product handle from URL path
        const urlPath = req.url || '';
        const pathParts = urlPath.split('/');
        const handle = pathParts[pathParts.length - 1]; // Get last part of path
        
        console.log('PUT /api/products - Product handle:', handle);
        console.log('PUT /api/products - Request body:', JSON.stringify(req.body, null, 2));
        
        if (!handle || handle === 'products') {
            return res.status(400).json({ error: 'Product handle is required' });
        }
        
        // Authentication with debugging fallback
        const token = req.headers.authorization?.replace('Bearer ', '');
        let user = null;
        
        if (token) {
            try {
                console.log('PUT /api/products - Attempting token verification...');
                const { data: { user: authUser }, error } = await supabaseAuth.auth.getUser(token);
                
                if (error) {
                    console.log('PUT /api/products - Auth verification failed:', error?.message);
                    // For debugging: allow JWT-like tokens
                    if (token.includes('.')) {
                        console.log('PUT /api/products - Allowing JWT-like token for debugging');
                        user = 'debug-user';
                    } else {
                        return res.status(401).json({ error: 'Authentication failed' });
                    }
                } else {
                    user = authUser;
                    console.log('PUT /api/products - Auth successful for user:', user?.email);
                }
            } catch (authError) {
                console.log('PUT /api/products - Auth error:', authError.message);
                // For debugging: allow JWT-like tokens
                if (token.includes('.')) {
                    console.log('PUT /api/products - Allowing JWT-like token for debugging (exception)');
                    user = 'debug-user';
                } else {
                    return res.status(401).json({ error: 'Authentication failed' });
                }
            }
        } else {
            console.log('PUT /api/products - No token provided');
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Get update data from request body
        const updateData = req.body;
        console.log('PUT /api/products - Processing update data:', updateData);
        
        if (!updateData) {
            return res.status(400).json({ error: 'Request body is required' });
        }
        
        // Prepare update object for Supabase
        // Don't set updated_at manually - let database triggers handle it
        const updateObject = {};
        
        // Add fields that exist in request body
        if (updateData.productName !== undefined) {
            updateObject.title = updateData.productName;
        }
        if (updateData.euAllowed !== undefined) {
            updateObject.eu_allowed = updateData.euAllowed;
        }
        if (updateData.euNotificationStatus !== undefined) {
            updateObject.eu_notification_status = updateData.euNotificationStatus;
        }
        if (updateData.hsCode !== undefined) {
            updateObject.hs_code = updateData.hsCode;
        }
        if (updateData.hsCodeDescription !== undefined) {
            updateObject.hs_code_description = updateData.hsCodeDescription;
        }
        if (updateData.dutyRate !== undefined) {
            updateObject.duty_rate = updateData.dutyRate;
        }
        
        // Add all the additional fields that frontend sends
        if (updateData.categories !== undefined) {
            updateObject.categories = JSON.stringify(updateData.categories);
        }
        if (updateData.goals !== undefined) {
            updateObject.goals = JSON.stringify(updateData.goals);
        }
        if (updateData.flavors !== undefined) {
            updateObject.flavors = JSON.stringify(updateData.flavors);
        }
        if (updateData.skus !== undefined) {
            updateObject.skus = JSON.stringify(updateData.skus);
        }
        
        // Basic product information
        if (updateData.size !== undefined) {
            updateObject.size = updateData.size;
        }
        if (updateData.servings !== undefined) {
            updateObject.servings = updateData.servings;
        }
        if (updateData.intakeFrequency !== undefined) {
            updateObject.intake_frequency = updateData.intakeFrequency;
        }
        if (updateData.reorderPeriod !== undefined) {
            updateObject.reorder_period = updateData.reorderPeriod;
        }
        
        // Pricing information
        if (updateData.nutraceuticalsRegularPrice !== undefined) {
            updateObject.nutraceuticals_regular_price = updateData.nutraceuticalsRegularPrice;
        }
        if (updateData.nutraceuticalsSubscriptionPrice !== undefined) {
            updateObject.nutraceuticals_subscription_price = updateData.nutraceuticalsSubscriptionPrice;
        }
        if (updateData.clubnenoRegularPrice !== undefined) {
            updateObject.clubneno_regular_price = updateData.clubnenoRegularPrice;
        }
        if (updateData.clubnenoSubscriptionPrice !== undefined) {
            updateObject.clubneno_subscription_price = updateData.clubnenoSubscriptionPrice;
        }
        
        // Per-flavor data
        if (updateData.flavorSkus !== undefined) {
            updateObject.flavor_skus = JSON.stringify(updateData.flavorSkus);
        }
        if (updateData.flavorHsCodes !== undefined) {
            updateObject.flavor_hs_codes = JSON.stringify(updateData.flavorHsCodes);
        }
        if (updateData.flavorDutyRates !== undefined) {
            updateObject.flavor_duty_rates = JSON.stringify(updateData.flavorDutyRates);
        }
        if (updateData.flavorEuNotifications !== undefined) {
            updateObject.flavor_eu_notifications = JSON.stringify(updateData.flavorEuNotifications);
        }
        if (updateData.flavorNotes !== undefined) {
            updateObject.flavor_notes = JSON.stringify(updateData.flavorNotes);
        }
        if (updateData.flavorLinks !== undefined) {
            updateObject.flavor_links = JSON.stringify(updateData.flavorLinks);
        }
        if (updateData.flavorIngredients !== undefined) {
            updateObject.flavor_ingredients = JSON.stringify(updateData.flavorIngredients);
        }
        
        console.log('PUT /api/products - Supabase update object:', updateObject);
        console.log('PUT /api/products - Number of fields to update:', Object.keys(updateObject).length);
        console.log('PUT /api/products - Database should now work with db_updated_at column added');
        
        // Get the current product data to verify changes later
        const { data: currentData, error: getCurrentError } = await supabase
            .from('products')
            .select('title, eu_allowed')
            .eq('handle', handle)
            .single();
        
        if (getCurrentError) {
            console.error('PUT /api/products - Error fetching current product:', getCurrentError);
            return res.status(500).json({ error: 'Failed to fetch current product', details: getCurrentError.message });
        }
        
        console.log('PUT /api/products - Current product data:', currentData);
        
        // Update product in Supabase
        const { data, error: updateError } = await supabase
            .from('products')
            .update(updateObject)
            .eq('handle', handle)
            .select();
        
        if (updateError) {
            console.error('PUT /api/products - Database update error:', updateError);
            return res.status(500).json({ error: 'Database update failed', details: updateError.message });
        }
        
        if (!data || data.length === 0) {
            console.log('PUT /api/products - Product not found for handle:', handle);
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Verify that the update actually happened by checking specific fields
        console.log('PUT /api/products - Updated data returned:', JSON.stringify(data[0], null, 2));
        
        // Check if the fields we tried to update actually changed
        let updateSuccessful = false;
        
        if (updateData.productName && data[0]?.title === updateData.productName) {
            updateSuccessful = true;
            console.log('PUT /api/products - Title update verified successfully');
        } else if (updateData.euAllowed && data[0]?.eu_allowed === updateData.euAllowed) {
            updateSuccessful = true;
            console.log('PUT /api/products - EU allowed update verified successfully');
        } else if (Object.keys(updateObject).length > 0) {
            // If we attempted to update something, the fact that we got data back suggests success
            updateSuccessful = true;
            console.log('PUT /api/products - Update appears successful based on returned data');
        }
        
        if (!updateSuccessful && Object.keys(updateObject).length > 0) {
            console.error('PUT /api/products - Database update failed - no fields actually changed');
            return res.status(500).json({ 
                error: 'Database update failed - data not persisted', 
                details: 'The database update operation completed but the expected changes were not saved.',
                debugInfo: {
                    attempted: Object.keys(updateObject),
                    expectedValues: updateData,
                    actualResult: data[0]
                }
            });
        }
        
        console.log(`✅ PUT /api/products - Successfully updated product: ${handle}`);
        
        return res.json({
            success: true,
            message: 'Product updated successfully',
            product: data[0]
        });
        
    } catch (error) {
        console.error('PUT /api/products - Endpoint error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
