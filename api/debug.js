// Debug endpoint to check environment variables
const express = require('express');
const router = express.Router();

// Debug endpoint - REMOVE THIS IN PRODUCTION!
router.get('/debug', (req, res) => {
    const envVars = {
        NODE_ENV: process.env.NODE_ENV,
        SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT SET',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'
    };
    
    res.json({
        message: 'Environment Variables Status',
        env: envVars,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;