import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom format for monitoring metrics
const monitoringFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] : ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += JSON.stringify(metadata);
    }
    return msg;
});

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        monitoringFormat
    ),
    defaultMeta: { service: 'bitheadz' },
    transports: [
        // Write all logs to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({ 
            filename: path.join(__dirname, '../logs/error.log'), 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({ 
            filename: path.join(__dirname, '../logs/combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Monitoring metrics
const metrics = {
    uptime: {
        startTime: Date.now(),
        lastCheck: Date.now()
    },
    errors: {
        total: 0,
        byType: {}
    },
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
    requests: {
        total: 0,
        byEndpoint: {}
    }
};

// Update metrics functions
export const updateMetrics = {
    error: (errorType) => {
        metrics.errors.total++;
        metrics.errors.byType[errorType] = (metrics.errors.byType[errorType] || 0) + 1;
        logger.error('Error occurred', { errorType, metrics: metrics.errors });
    },
    
    transaction: (status) => {
        metrics.transactions.total++;
        metrics.transactions[status]++;
        logger.info('Transaction status update', { status, metrics: metrics.transactions });
    },
    
    rateLimit: (wasBlocked) => {
        metrics.rateLimits.hits++;
        if (wasBlocked) {
            metrics.rateLimits.blocked++;
        }
        logger.info('Rate limit hit', { wasBlocked, metrics: metrics.rateLimits });
    },
    
    request: (endpoint) => {
        metrics.requests.total++;
        metrics.requests.byEndpoint[endpoint] = (metrics.requests.byEndpoint[endpoint] || 0) + 1;
    },
    
    uptime: () => {
        metrics.uptime.lastCheck = Date.now();
    }
};

// Get current metrics
export const getMetrics = () => {
    const currentTime = Date.now();
    return {
        ...metrics,
        uptime: {
            ...metrics.uptime,
            uptimeSeconds: Math.floor((currentTime - metrics.uptime.startTime) / 1000),
            lastCheckSeconds: Math.floor((currentTime - metrics.uptime.lastCheck) / 1000)
        }
    };
};

// Reset metrics (useful for testing or daily resets)
export const resetMetrics = () => {
    Object.keys(metrics).forEach(key => {
        if (typeof metrics[key] === 'object') {
            if (Array.isArray(metrics[key])) {
                metrics[key] = [];
            } else {
                metrics[key] = {};
            }
        } else {
            metrics[key] = 0;
        }
    });
    metrics.uptime.startTime = Date.now();
    metrics.uptime.lastCheck = Date.now();
    logger.info('Metrics reset');
};

export default logger; 