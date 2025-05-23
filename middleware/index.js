import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

// Authentication middleware
export const authenticate = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            logger.warn('No token provided');
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (!decoded || !decoded.role || decoded.role !== 'admin') {
            logger.warn('Invalid token or insufficient permissions:', decoded);
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient permissions' 
            });
        }

        req.user = decoded;
        next();
    } catch (error) {
        logger.error('Authentication error:', error);
        res.status(401).json({ 
            success: false, 
            error: 'Invalid token' 
        });
    }
};

// User authentication middleware
export const authenticateUser = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        jwt.verify(token, config.jwtSecret, (err, decoded) => {
            if (err || !decoded.userId) {
                logger.error('User token verification failed:', err);
                return res.status(401).json({ error: 'Invalid token' });
            }

            req.user = decoded;
            next();
        });
    } catch (error) {
        logger.error('User authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
};

// Request validation middleware
export const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            const { error } = schema.validate(req.body);
            if (error) {
                logger.warn('Validation error:', error.details[0].message);
                return res.status(400).json({ error: error.details[0].message });
            }
            next();
        } catch (error) {
            logger.error('Validation middleware error:', error);
            res.status(500).json({ error: 'Validation failed' });
        }
    };
};

// Error handling middleware
export const errorHandler = (err, req, res, next) => {
    logger.error('Error:', err);

    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Invalid token' });
    }

    res.status(500).json({ error: 'Internal server error' });
}; 