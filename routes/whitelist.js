import express from 'express';
import logger from '../utils/logger.js';
import db from '../db/index.js';

const router = express.Router();

// Promisify database methods
const dbRun = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) {
                console.error('Database run error:', err);
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
};

const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) {
                console.error('Database get error:', err);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

// Create whitelist table if it doesn't exist
dbRun(`
    CREATE TABLE IF NOT EXISTS whitelist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        wallet_address TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).catch(err => logger.error('Error creating whitelist table:', err));

// Public whitelist submission
router.post('/', async (req, res) => {
    try {
        const { name, email, walletAddress } = req.body;
        logger.info('Received whitelist submission:', { name, email, walletAddress });

        if (!name || !email || !walletAddress) {
            logger.warn('Missing required fields in whitelist submission');
            return res.status(400).json({ 
                success: false, 
                error: 'Name, email, and wallet address are required' 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            logger.warn('Invalid email format in whitelist submission:', email);
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid email format' 
            });
        }

        // Check if already whitelisted
        const existing = await dbGet(
            'SELECT * FROM whitelist WHERE email = ? OR wallet_address = ?',
            [email, walletAddress]
        );

        if (existing) {
            logger.warn('Duplicate whitelist submission:', { email, walletAddress });
            return res.status(400).json({ 
                success: false, 
                error: 'Email or wallet address already whitelisted' 
            });
        }

        // Add to whitelist
        await dbRun(
            'INSERT INTO whitelist (name, email, wallet_address) VALUES (?, ?, ?)',
            [name, email, walletAddress]
        );

        logger.info('Whitelist submission successful:', { email, walletAddress });
        res.json({ success: true, message: 'Successfully added to whitelist' });
    } catch (error) {
        logger.error('Whitelist submission error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process whitelist submission' 
        });
    }
});

// Check whitelist status
router.get('/check', async (req, res) => {
    try {
        const { walletAddress } = req.query;
        logger.info('Checking whitelist status for wallet:', walletAddress);

        if (!walletAddress) {
            return res.status(400).json({ 
                success: false, 
                error: 'Wallet address is required' 
            });
        }

        const entry = await dbGet(
            'SELECT * FROM whitelist WHERE wallet_address = ?',
            [walletAddress]
        );

        res.json({ 
            success: true, 
            isWhitelisted: !!entry,
            entry: entry ? {
                name: entry.name,
                email: entry.email,
                walletAddress: entry.wallet_address,
                createdAt: entry.created_at
            } : null
        });
    } catch (error) {
        logger.error('Whitelist check error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to check whitelist status' 
        });
    }
});

// Admin whitelist management (protected by admin middleware)
router.get('/admin', async (req, res) => {
    try {
        const entries = await dbGet('SELECT * FROM whitelist ORDER BY created_at DESC');
        res.json({ 
            success: true, 
            whitelist: entries.map(entry => ({
                name: entry.name,
                email: entry.email,
                walletAddress: entry.wallet_address,
                createdAt: entry.created_at
            }))
        });
    } catch (error) {
        logger.error('Admin whitelist fetch error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch whitelist' 
        });
    }
});

export default router; 