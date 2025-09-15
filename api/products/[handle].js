// Individual product API endpoint for updates
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
    
    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // Check authentication
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        console.log('PUT /api/products/[handle] - Token received:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
        console.log('PUT /api/products/[handle] - Headers:', JSON.stringify(req.headers, null, 2));
        
        if (!token) {
            console.log('No token provided');
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Verify token
        console.log('PUT /api/products/[handle] - Attempting to verify token with Supabase...');
        const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
        
        console.log('PUT /api/products/[handle] - Supabase auth result:', { user: !!user, error: error?.message });
        
        if (error || !user) {
            console.log('Auth verification failed:', error?.message);
            return res.status(401).json({ error: 'Invalid or expired token', details: error?.message });
        }
        
        console.log('Auth successful for user:', user.email);
        
        // Get product handle from URL
        const { handle } = req.query;
        
        if (!handle) {
            return res.status(400).json({ error: 'Product handle is required' });
        }
        
        // Get update data from request body
        const updateData = req.body;
        
        console.log('Updating product:', handle, 'with data:', updateData);
        
        // Update product in Supabase
        const { data, error: updateError } = await supabase
            .from('products')
            .update({
                title: updateData.productName,
                eu_allowed: updateData.euAllowed,
                size: updateData.size,
                servings: updateData.servings,
                intake_frequency: updateData.intakeFrequency,
                reorder_period: updateData.reorderPeriod,
                nutraceuticals_regular_price: updateData.nutraceuticalsRegularPrice,
                nutraceuticals_subscription_price: updateData.nutraceuticalsSubscriptionPrice,
                clubneno_regular_price: updateData.clubnenoRegularPrice,
                clubneno_subscription_price: updateData.clubnenoSubscriptionPrice,
                categories: updateData.categories ? JSON.stringify(updateData.categories) : null,
                goals: updateData.goals ? JSON.stringify(updateData.goals) : null,
                eu_notification_status: updateData.euNotificationStatus,
                flavors: updateData.flavors ? JSON.stringify(updateData.flavors) : null,
                skus: updateData.skus ? JSON.stringify(updateData.skus) : null,
                flavor_skus: updateData.flavorSkus ? JSON.stringify(updateData.flavorSkus) : null,
                flavor_hs_codes: updateData.flavorHsCodes ? JSON.stringify(updateData.flavorHsCodes) : null,
                flavor_duty_rates: updateData.flavorDutyRates ? JSON.stringify(updateData.flavorDutyRates) : null,
                flavor_eu_notifications: updateData.flavorEuNotifications ? JSON.stringify(updateData.flavorEuNotifications) : null,
                flavor_notes: updateData.flavorNotes ? JSON.stringify(updateData.flavorNotes) : null,
                flavor_links: updateData.flavorLinks ? JSON.stringify(updateData.flavorLinks) : null,
                flavor_ingredients: updateData.flavorIngredients ? JSON.stringify(updateData.flavorIngredients) : null,
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
        console.error('Endpoint error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};