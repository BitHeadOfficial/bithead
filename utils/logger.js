import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    transactions: 0,
    lastUpdated: new Date(),
};

// Update metrics
export const updateMetrics = (type) => {
    metrics[type]++;
    metrics.lastUpdated = new Date();
    
    // Log metrics every hour
    const now = new Date();
    if (now - metrics.lastUpdated > 3600000) { // 1 hour
        logger.info('Metrics Update:', metrics);
        // Reset metrics
        metrics = {
            requests: 0,
            errors: 0,
            walletConnections: 0,
            transactions: 0,
            lastUpdated: now,
        };
    }
};

// Get current metrics
export const getMetrics = () => ({ ...metrics });

// Error logging middleware
export const errorLogger = (err, req, res, next) => {
    logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    updateMetrics('errors');
    next(err);
};

// Request logging middleware
export const requestLogger = (req, res, next) => {
    logger.http(`${req.method} ${req.originalUrl} - ${req.ip}`);
    updateMetrics('requests');
    next();
};

// Wallet connection logger
export const logWalletConnection = (publicKey, success) => {
    if (success) {
        logger.info(`Wallet connected: ${publicKey}`);
        updateMetrics('walletConnections');
    } else {
        logger.warn(`Failed wallet connection attempt: ${publicKey}`);
    }
};

// Transaction logger
export const logTransaction = (txHash, amount, success) => {
    if (success) {
        logger.info(`Transaction successful: ${txHash} - Amount: ${amount} SOL`);
        updateMetrics('transactions');
    } else {
        logger.error(`Transaction failed: ${txHash} - Amount: ${amount} SOL`);
    }
};

// Export the logger instance
export default logger; 