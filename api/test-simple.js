// Simple test endpoint to verify Vercel function works
module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    return res.json({
        message: 'Simple test endpoint working',
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString()
    });
};