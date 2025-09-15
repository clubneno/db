// Flavors API endpoint
const fs = require('fs');
const path = require('path');

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
        // Load flavors from local JSON data (no auth required for flavors)
        let flavors = [];
        try {
            const possiblePaths = [
                path.join(process.cwd(), 'data', 'latest.json'),
                path.join(__dirname, '..', 'data', 'latest.json'),
                './data/latest.json'
            ];
            
            let dataLoaded = false;
            for (const dataPath of possiblePaths) {
                try {
                    if (fs.existsSync(dataPath)) {
                        const products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                        
                        // Extract unique flavors from products
                        const flavorSet = new Set();
                        products.forEach(product => {
                            if (product.flavors && Array.isArray(product.flavors)) {
                                product.flavors.forEach(flavor => {
                                    if (flavor && typeof flavor === 'string') {
                                        flavorSet.add(flavor.trim());
                                    }
                                });
                            }
                        });
                        
                        flavors = Array.from(flavorSet).sort();
                        console.log(`✅ Loaded ${flavors.length} unique flavors from ${dataPath}`);
                        dataLoaded = true;
                        break;
                    }
                } catch (pathError) {
                    console.log(`❌ Error with path ${dataPath}:`, pathError.message);
                }
            }
            
            if (!dataLoaded) {
                // Fallback flavors if no data found
                flavors = [
                    'Chocolate', 'Vanilla', 'Strawberry', 'Unflavored', 'Lemon',
                    'Vanilla Spice', 'Cappuccino', 'Passion Orange Guava', 'Mango',
                    'Strawberry Lime', 'Cherry Berry', 'Wild Berry', 'Orange Mango',
                    'Chocolate Coconut', 'Mint Chocolate', 'Chocolate Fudge',
                    'Spiced Chai'
                ];
                console.log('⚠️ Using fallback flavors list');
            }
        } catch (error) {
            console.log('💥 Error loading flavors:', error.message);
            // Return empty array on error
            flavors = [];
        }
        
        return res.json({
            flavors: flavors,
            total: flavors.length,
            source: 'local-data'
        });
        
    } catch (error) {
        console.error('Flavors endpoint error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};