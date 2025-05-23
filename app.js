const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');
require('dotenv').config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Verify environment variables
console.log('Checking environment variables...');
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('ACCESS_PASSWORD exists:', !!process.env.ACCESS_PASSWORD);

if (!process.env.JWT_SECRET) {
    console.error('Error: JWT_SECRET is not defined in .env file');
    process.exit(1);
}

if (!process.env.ACCESS_PASSWORD) {
    console.error('Error: ACCESS_PASSWORD is not defined in .env file');
    process.exit(1);
}

// Middleware
app.use(cors({
    origin: 'https://nimble-malabi-65e406.netlify.app'
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

// Placeholder Whitelist routes (Directly in app.js for debugging)
// app.post('/api/whitelist', (req, res) => {
//     console.log('Received POST request to /api/whitelist (direct in app.js)', { body: req.body });
//     res.json({ success: true, message: 'Whitelist submission received (placeholder - direct)' });
// });

// app.get('/api/admin/whitelist', (req, res) => {
//     console.log('Received GET request to /api/admin/whitelist (direct in app.js)');
//     res.json({ whitelist: [], message: 'Admin whitelist endpoint reached (placeholder - direct)' });
// });

// app.get('/api/check-whitelist', (req, res) => {
//      console.log('Received GET request to /api/check-whitelist (direct in app.js)', { query: req.query });
//      res.json({ isWhitelisted: false, message: 'Check whitelist endpoint reached (placeholder - direct)' });
// });

// Import routes
const paymentRoutes = require('./routes/payment');

// Routes
app.use('/api', paymentRoutes);

// Unlock endpoint
app.post('/api/unlock', (req, res) => {
    try {
        console.log('=== Unlock Request Debug ===');
        console.log('Received password in backend:', req.body.password);
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('Environment variables:', {
            JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Not set',
            ACCESS_PASSWORD: process.env.ACCESS_PASSWORD ? 'Set' : 'Not set'
        });

        const { password } = req.body;
        console.log('Received password:', password);
        console.log('Expected password:', process.env.ACCESS_PASSWORD);
        console.log('Password comparison:', password === process.env.ACCESS_PASSWORD);

        if (!password) {
            console.log('No password provided');
            return res.status(400).json({ error: 'Password is required' });
        }

        // Check for either the correct password or the Solana payment indicator
        if (password === process.env.ACCESS_PASSWORD || password === 'solana_payment') {
            console.log('Password match successful');
            try {
                console.log('Attempting to generate JWT token...');
                const token = jwt.sign(
                    { authorized: true },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h' }
                );
                console.log('Token generated successfully');
                console.log('=== End Unlock Request Debug ===');
                res.json({ token });
            } catch (jwtError) {
                console.error('JWT signing error:', jwtError);
                console.error('JWT error stack:', jwtError.stack);
                throw jwtError;
            }
        } else {
            console.log('Password match failed');
            console.log('=== End Unlock Request Debug ===');
            res.status(401).json({ error: 'Invalid password' });
        }
    } catch (error) {
        console.error('=== Unlock Endpoint Error ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('=== End Error Debug ===');
        res.status(500).json({ 
            error: 'Server error. Please try again later.',
            details: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 