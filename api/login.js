// Simple login endpoint for Vercel serverless functions
const sessions = new Map();
const users = {
    'admin': 'password123',
    'user': 'pass123'
};

module.exports = (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { username, password } = req.body || {};
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        if (users[username] && users[username] === password) {
            const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
            const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
            
            sessions.set(token, {
                user: username,
                expires: expires
            });
            
            return res.json({ 
                success: true, 
                token: token,
                user: username,
                message: 'Login successful'
            });
        } else {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};