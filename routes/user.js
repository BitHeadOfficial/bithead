import express from 'express';
import { authenticate } from '../middleware/index.js';
import { User } from '../models/index.js';
import { AccessLog } from '../models/index.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Get user profile
router.get('/profile', authenticate, async (req, res) => {
    try {
        const user = await User.findByWalletAddress(req.user.walletAddress);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        logger.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// Update genesis status
router.put('/genesis', authenticate, async (req, res) => {
    const { isGenesis } = req.body;
    await User.updateGenesisStatus(req.user.id, isGenesis);
    await AccessLog.create(req.user.id, 'genesis_status_update');
    res.json({ message: 'Genesis status updated successfully' });
});

// Get user access logs
router.get('/logs', authenticate, async (req, res) => {
    try {
        const logs = await AccessLog.getUserLogs(req.user.id);
        res.json({ logs });
    } catch (error) {
        logger.error('Error fetching access logs:', error);
        res.status(500).json({ error: 'Failed to fetch access logs' });
    }
});

// Get genesis users
router.get('/genesis', authenticate, async (req, res) => {
    const users = await User.getGenesisUsers();
    res.json(users);
});

export default router; 