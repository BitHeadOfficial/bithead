import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`,
    ),
);

// Define which transports to use based on environment
const transports = [
    // Console transport for all environments
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }),
    // Error log file
    new winston.transports.File({
        filename: path.join(__dirname, '../logs/error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
        filename: path.join(__dirname, '../logs/combined.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }),
];

// Create the logger instance
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    levels,
    format,
    transports,
    // Handle uncaught exceptions and rejections
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/exceptions.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/rejections.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});

// Create a stream object for Morgan
export const stream = {
    write: (message) => {
        logger.http(message.trim());
    },
};

// Metrics tracking
let metrics = {
    requests: 0,
    errors: 0,
    walletConnections: 0,
    transactions: {
        total: 0,
        successful: 0,
        failed: 0,
        pending: 0
    },
    rateLimits: {
        hits: 0,
        blocked: 0
    },
    uptime: {
        startTime: Date.now(),
        uptimeSeconds: 0,
        lastCheckSeconds: 0
    },
    lastUpdated: new Date()
};

// Initialize metrics
const initializeMetrics = () => {
    metrics.uptime.startTime = Date.now();
    metrics.uptime.uptimeSeconds = 0;
    metrics.uptime.lastCheckSeconds = 0;
    metrics.lastUpdated = new Date();
};

// Update metrics
export const updateMetrics = {
    request: (type) => {
        try {
            metrics.requests++;
            metrics.lastUpdated = new Date();
            metrics.uptime.lastCheckSeconds = Math.floor((Date.now() - metrics.uptime.startTime) / 1000);
            metrics.uptime.uptimeSeconds = metrics.uptime.lastCheckSeconds;
        } catch (error) {
            logger.error('Error updating request metrics:', error);
        }
    },
    error: (type) => {
        try {
            metrics.errors++;
            metrics.lastUpdated = new Date();
        } catch (error) {
            logger.error('Error updating error metrics:', error);
        }
    },
    walletConnection: () => {
        try {
            metrics.walletConnections++;
            metrics.lastUpdated = new Date();
        } catch (error) {
            logger.error('Error updating wallet connection metrics:', error);
        }
    },
    transaction: (status) => {
        try {
            metrics.transactions.total++;
            if (status === 'successful') metrics.transactions.successful++;
            else if (status === 'failed') metrics.transactions.failed++;
            else if (status === 'pending') metrics.transactions.pending++;
            metrics.lastUpdated = new Date();
        } catch (error) {
            logger.error('Error updating transaction metrics:', error);
        }
    },
    rateLimit: (blocked) => {
        try {
            if (blocked) metrics.rateLimits.blocked++;
            metrics.rateLimits.hits++;
            metrics.lastUpdated = new Date();
        } catch (error) {
            logger.error('Error updating rate limit metrics:', error);
        }
    },
    uptime: () => {
        try {
            metrics.uptime.lastCheckSeconds = Math.floor((Date.now() - metrics.uptime.startTime) / 1000);
            metrics.uptime.uptimeSeconds = metrics.uptime.lastCheckSeconds;
            metrics.lastUpdated = new Date();
        } catch (error) {
            logger.error('Error updating uptime metrics:', error);
        }
    }
};

// Initialize metrics on module load
initializeMetrics();

// Log metrics every hour
const logMetrics = () => {
    try {
        const now = new Date();
        if (now - metrics.lastUpdated > 3600000) { // 1 hour
            logger.info('Metrics Update:', metrics);
            // Reset metrics but keep uptime
            const uptime = metrics.uptime;
            metrics = {
                requests: 0,
                errors: 0,
                walletConnections: 0,
                transactions: {
                    total: 0,
                    successful: 0,
                    failed: 0,
                    pending: 0
                },
                rateLimits: {
                    hits: 0,
                    blocked: 0
                },
                uptime,
                lastUpdated: now
            };
        }
    } catch (error) {
        logger.error('Error logging metrics:', error);
    }
};

// Start metrics logging interval
setInterval(logMetrics, 3600000); // Log every hour

// Get current metrics
export const getMetrics = () => {
    try {
        // Update uptime before returning
        updateMetrics.uptime();
        return { ...metrics };
    } catch (error) {
        logger.error('Error getting metrics:', error);
        return {
            error: 'Failed to get metrics',
            timestamp: new Date().toISOString()
        };
    }
};

// Error logging middleware
export const errorLogger = (err, req, res, next) => {
    try {
        logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
        updateMetrics.error('request');
        next(err);
    } catch (error) {
        logger.error('Error in errorLogger middleware:', error);
        next(err);
    }
};

// Request logging middleware
export const requestLogger = (req, res, next) => {
    try {
        logger.http(`${req.method} ${req.originalUrl} - ${req.ip}`);
        updateMetrics.request(req.path);
        next();
    } catch (error) {
        logger.error('Error in requestLogger middleware:', error);
        next();
    }
};

// Wallet connection logger
export const logWalletConnection = (publicKey, success) => {
    try {
        if (success) {
            logger.info(`Wallet connected: ${publicKey}`);
            updateMetrics.walletConnection();
        } else {
            logger.warn(`Failed wallet connection attempt: ${publicKey}`);
        }
    } catch (error) {
        logger.error('Error in logWalletConnection:', error);
    }
};

// Transaction logger
export const logTransaction = (txHash, amount, success) => {
    try {
        if (success) {
            logger.info(`Transaction successful: ${txHash} - Amount: ${amount} SOL`);
            updateMetrics.transaction('successful');
        } else {
            logger.error(`Transaction failed: ${txHash} - Amount: ${amount} SOL`);
            updateMetrics.transaction('failed');
        }
    } catch (error) {
        logger.error('Error in logTransaction:', error);
    }
};

// Export the logger instance
export default logger; 