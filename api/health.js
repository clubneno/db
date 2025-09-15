// Simple health check endpoint that doesn't depend on external services
const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'API is working',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

module.exports = router;