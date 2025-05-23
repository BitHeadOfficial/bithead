import express from 'express';
import { getMetrics, updateMetrics } from '../utils/logger.js';
import { authenticate } from '../middleware/index.js';
import logger from '../utils/logger.js';
import { config } from '../config/index.js';

const router = express.Router();

// Add security headers for monitoring endpoints
const monitoringHeaders = (req, res, next) => {
    // Allow monitoring services to access these endpoints
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Cache control for monitoring endpoints
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
};

// Apply security headers to all monitoring routes
router.use(monitoringHeaders);

// Basic health check endpoint (public)
router.get('/health', (req, res) => {
    updateMetrics.uptime();
    updateMetrics.request('/health');
    
    const metrics = getMetrics();
    const healthStatus = {
        status: 'healthy',
        uptime: metrics.uptime.uptimeSeconds,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.nodeEnv,
        domain: 'bithead.at'
    };
    
    // Check if the application is responsive
    if (metrics.uptime.lastCheckSeconds > 300) { // 5 minutes
        healthStatus.status = 'degraded';
        healthStatus.warning = 'Application response time is high';
    }
    
    // Add additional health checks
    const memoryUsage = process.memoryUsage();
    healthStatus.memory = {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024) // MB
    };
    
    // Check database connection
    if (global.db) {
        healthStatus.database = 'connected';
    } else {
        healthStatus.database = 'disconnected';
        healthStatus.status = 'degraded';
        healthStatus.warning = 'Database connection issue';
    }
    
    res.json(healthStatus);
});

// Status endpoint with basic metrics (public)
router.get('/status', (req, res) => {
    updateMetrics.request('/status');
    const metrics = getMetrics();
    
    const status = {
        status: 'operational',
        uptime: metrics.uptime.uptimeSeconds,
        domain: 'bithead.at',
        environment: config.nodeEnv,
        transactions: {
            total: metrics.transactions.total,
            successRate: metrics.transactions.total > 0 
                ? (metrics.transactions.successful / metrics.transactions.total * 100).toFixed(2) 
                : 0,
            lastHour: metrics.transactions.total // You might want to implement time-based filtering
        },
        errors: {
            total: metrics.errors.total,
            rate: metrics.requests.total > 0 
                ? (metrics.errors.total / metrics.requests.total * 100).toFixed(2) 
                : 0,
            lastHour: metrics.errors.total // You might want to implement time-based filtering
        },
        rateLimits: {
            hits: metrics.rateLimits.hits,
            blocked: metrics.rateLimits.blocked,
            blockedPercentage: metrics.rateLimits.hits > 0 
                ? (metrics.rateLimits.blocked / metrics.rateLimits.hits * 100).toFixed(2) 
                : 0
        }
    };
    
    // Determine overall status
    if (metrics.errors.total > 100 || metrics.rateLimits.blocked > 50) {
        status.status = 'degraded';
        status.warning = 'High error rate or rate limit blocks detected';
    }
    
    // Add performance metrics
    const memoryUsage = process.memoryUsage();
    status.performance = {
        memory: {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
            rss: Math.round(memoryUsage.rss / 1024 / 1024) // MB
        },
        uptime: {
            days: Math.floor(metrics.uptime.uptimeSeconds / 86400),
            hours: Math.floor((metrics.uptime.uptimeSeconds % 86400) / 3600),
            minutes: Math.floor((metrics.uptime.uptimeSeconds % 3600) / 60)
        }
    };
    
    res.json(status);
});

// Detailed metrics endpoint (admin only)
router.get('/metrics', authenticate, (req, res) => {
    updateMetrics.request('/metrics');
    const metrics = getMetrics();
    
    // Add additional system metrics for admin view
    const detailedMetrics = {
        ...metrics,
        system: {
            nodeVersion: process.version,
            platform: process.platform,
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            uptime: process.uptime(),
            environment: config.nodeEnv,
            domain: 'bithead.at'
        },
        performance: {
            responseTime: metrics.uptime.lastCheckSeconds,
            activeConnections: global.activeConnections || 0,
            databaseStatus: global.db ? 'connected' : 'disconnected'
        }
    };
    
    res.json(detailedMetrics);
});

// Error simulation endpoint (admin only, for testing)
router.post('/simulate-error', authenticate, (req, res) => {
    const { type } = req.body;
    if (!type) {
        return res.status(400).json({ error: 'Error type required' });
    }
    
    updateMetrics.error(type);
    logger.error('Simulated error', { type });
    
    res.json({ 
        message: 'Error simulated', 
        metrics: getMetrics().errors,
        timestamp: new Date().toISOString(),
        domain: 'bithead.at'
    });
});

export default router; 