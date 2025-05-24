import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/index.js';
import { User } from '../models/index.js';
import { Payment } from '../models/index.js';
import { AccessLog } from '../models/index.js';
import { Settings } from '../models/index.js';
import { updateSettingsSchema } from '../validation/schemas.js';
import logger from '../utils/logger.js';
import db from '../db/index.js';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Initialize database
const dbPath = join(__dirname, '..', 'database.sqlite');
console.log('Database path:', dbPath);

// Ensure database file exists
if (!fs.existsSync(dbPath)) {
    console.error('Database file not found:', dbPath);
    fs.writeFileSync(dbPath, ''); // Create empty file
}

// Promisify database methods
const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Database query error:', err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) {
                console.error('Database query error:', err);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

// Admin login (secure, DB-based)
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        logger.info('Admin login attempt', { username, hasPassword: !!password });
        
        if (!username || !password) {
            logger.warn('Login attempt missing username or password', { 
                hasUsername: !!username, 
                hasPassword: !!password 
            });
            return res.status(400).json({ 
                success: false, 
                error: 'Username and password are required' 
            });
        }

        // Look up user in admin_users table
        logger.info('Looking up admin user in database...');
        const user = await dbGet('SELECT * FROM admin_users WHERE username = ?', [username]);
        
        if (!user) {
            logger.warn('Admin login failed - user not found', { username });
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid username or password' 
            });
        }

        logger.info('User found, comparing password hash...');
        // Compare password hash
        const valid = await bcrypt.compare(password, user.password_hash);
        
        if (!valid) {
            logger.warn('Admin login failed - invalid password', { username });
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid username or password' 
            });
        }

        // Success: issue JWT
        logger.info('Password valid, generating JWT token...');
        const token = jwt.sign(
            { 
                role: 'admin', 
                username: user.username,
                id: user.id 
            }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        logger.info('Admin login successful', { username });
        res.json({ 
            success: true, 
            token,
            user: {
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        logger.error('Admin login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error during login',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get all users
router.get('/users', authenticate, async (req, res) => {
    try {
        console.log('Fetching users...');
        const users = await dbAll('SELECT * FROM users ORDER BY created_at DESC');
        console.log('Users found:', users?.length || 0);
        res.json({ success: true, users: users || [] });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
});

// Get all payments
router.get('/payments', authenticate, async (req, res) => {
    try {
        console.log('Fetching payments...');
        const payments = await dbAll('SELECT * FROM payments ORDER BY created_at DESC');
        console.log('Payments found:', payments?.length || 0);
        res.json({ success: true, payments: payments || [] });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch payments' });
    }
});

// Get activity logs
router.get('/activity', authenticate, async (req, res) => {
    try {
        console.log('Fetching activity logs...');
        const logs = await dbAll(`
            SELECT al.*, u.wallet_address 
            FROM access_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT 50
        `);
        console.log('Activity logs found:', logs?.length || 0);
        res.json({ success: true, logs: logs || [] });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch activity logs' });
    }
});

// Get dashboard stats
router.get('/stats', authenticate, async (req, res) => {
    try {
        console.log('Fetching dashboard stats...');
        const stats = await dbGet(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM users WHERE is_premium = 1) as genesis_users,
                COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'completed'), 0) as total_revenue,
                (SELECT COUNT(DISTINCT user_id) FROM access_logs WHERE created_at > datetime('now', '-24 hours')) as active_users
        `);
        console.log('Stats:', stats);
        res.json({ success: true, stats: stats || {
            total_users: 0,
            genesis_users: 0,
            total_revenue: 0,
            active_users: 0
        }});
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// Update settings
router.put('/settings', authenticate, async (req, res) => {
    try {
        const { error } = updateSettingsSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, error: error.details[0].message });
        }

        for (const [key, value] of Object.entries(req.body)) {
            await dbAll('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
        }

        const settings = await dbAll('SELECT * FROM settings');
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
});

// Verify admin token
router.get('/verify', authenticate, (req, res) => {
    res.json({ success: true });
});

// Get all milestones
router.get('/milestones', authenticate, async (req, res) => {
    try {
        const milestones = await dbAll('SELECT * FROM milestones ORDER BY order_index ASC');
        res.json(milestones);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch milestones' });
    }
});

// Create new milestone
router.post('/milestones', authenticate, async (req, res) => {
    const { icon, title, description, order_index } = req.body;
    try {
        const result = await dbAll('INSERT INTO milestones (icon, title, description, order_index) VALUES (?, ?, ?, ?)', [icon, title, description, order_index]);
        res.json({ id: result.lastID, icon, title, description, order_index });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create milestone' });
    }
});

// Update milestone
router.put('/milestones/:id', authenticate, async (req, res) => {
    const { icon, title, description, order_index } = req.body;
    try {
        await dbAll('UPDATE milestones SET icon = ?, title = ?, description = ?, order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [icon, title, description, order_index, req.params.id]);
        res.json({ id: req.params.id, icon, title, description, order_index });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update milestone' });
    }
});

// Delete milestone
router.delete('/milestones/:id', authenticate, async (req, res) => {
    try {
        await dbAll('DELETE FROM milestones WHERE id = ?', [req.params.id]);
        res.json({ message: 'Milestone deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete milestone' });
    }
});

// --- WHITELIST ENDPOINTS ---
// Get all whitelist entries
router.get('/whitelist', authenticate, async (req, res) => {
  try {
    let whitelist = await dbAll('SELECT name, email, wallet_address, created_at FROM whitelist ORDER BY created_at DESC');
    // If there are legacy entries (from JSON or other source), map them to the correct structure
    whitelist = whitelist.map(entry => ({
      name: entry.name || '',
      email: entry.email || '',
      wallet_address: entry.wallet_address || entry.walletAddress || '',
      created_at: entry.created_at || entry.timestamp || ''
    }));
    res.json({ success: true, whitelist });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch whitelist' });
  }
});
// Add to whitelist (admin only)
router.post('/whitelist', authenticate, async (req, res) => {
  try {
    const { name, email, walletAddress } = req.body;
    await dbAll('INSERT INTO whitelist (name, email, wallet_address) VALUES (?, ?, ?)', [name, email, walletAddress]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add to whitelist' });
  }
});
// Remove from whitelist (admin only)
router.delete('/whitelist/:walletAddress', authenticate, async (req, res) => {
  try {
    await dbAll('DELETE FROM whitelist WHERE wallet_address = ?', [req.params.walletAddress]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove from whitelist' });
  }
});

export default router; 