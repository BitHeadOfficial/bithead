import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { verifyToken } from '../middleware/auth.js';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/uploads/founders');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow specific image formats that are safe
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            // Additional check for file extension
            const ext = path.extname(file.originalname).toLowerCase();
            const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
            if (allowedExtensions.includes(ext)) {
                cb(null, true);
            } else {
                cb(new Error('Invalid file extension. Only JPG, PNG, and GIF are allowed.'));
            }
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'));
        }
    }
});

// Initialize database table if it doesn't exist
const db = new sqlite3.Database(path.join(__dirname, '../database.sqlite'));
db.run(`
    CREATE TABLE IF NOT EXISTS founders_logos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet TEXT NOT NULL,
        filename TEXT NOT NULL,
        signature TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Get total submissions
router.get('/total', async (req, res) => {
    try {
        db.get('SELECT COUNT(*) as total FROM founders_logos', (err, row) => {
            if (err) {
                logger.error('Error getting total submissions:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            res.json({ success: true, total: row.total });
        });
    } catch (error) {
        logger.error('Error in /total endpoint:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Get all logos
router.get('/logos', async (req, res) => {
    try {
        db.all('SELECT * FROM founders_logos ORDER BY timestamp DESC', (err, rows) => {
            if (err) {
                logger.error('Error getting logos:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            const logos = rows.map(row => ({
                url: `/uploads/founders/${row.filename}`,
                wallet: row.wallet,
                timestamp: row.timestamp
            }));
            
            res.json({ success: true, logos });
        });
    } catch (error) {
        logger.error('Error in /logos endpoint:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Submit logo
router.post('/submit', upload.single('logo'), async (req, res) => {
    try {
        const { wallet, signature } = req.body;
        const file = req.file;

        if (!wallet || !signature || !file) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Verify signature (you might want to add more verification here)
        const expectedWallet = new solanaWeb3.PublicKey(process.env.RECIPIENT_WALLET);
        if (wallet !== expectedWallet.toString()) {
            return res.status(400).json({ success: false, error: 'Invalid wallet address' });
        }

        // Save to database
        db.run(
            'INSERT INTO founders_logos (wallet, filename, signature) VALUES (?, ?, ?)',
            [wallet, file.filename, signature],
            function(err) {
                if (err) {
                    logger.error('Error saving logo:', err);
                    return res.status(500).json({ success: false, error: 'Database error' });
                }
                res.json({ success: true, id: this.lastID });
            }
        );
    } catch (error) {
        logger.error('Error in /submit endpoint:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Add security headers middleware
router.use((req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prevent embedding in iframes
    res.setHeader('X-Frame-Options', 'DENY');
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

export default router; 