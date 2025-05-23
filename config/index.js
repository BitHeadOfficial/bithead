import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

export const config = {
    // Server configuration
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // JWT configuration
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiration: process.env.JWT_EXPIRATION || '24h',
    
    // Solana configuration
    solanaNetwork: process.env.SOLANA_NETWORK || 'mainnet-beta',
    solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://fragrant-icy-general.solana-mainnet.quiknode.pro/71ce468fd28dbbcf7e3a1b2e404bfacac9f60a55/',
    recipientWallet: process.env.RECIPIENT_WALLET || '5Zd2EiC7S2DaT5mQyC1etYmusNPyEQtHDgojdf5oLHLE',
    
    // Access control
    accessPassword: process.env.ACCESS_PASSWORD || 'default-password',
    
    // Rate limiting
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 100 requests per window
    
    // Admin configuration
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
    
    // Database configuration (if needed)
    databaseUrl: process.env.DATABASE_URL,
    
    // Logging configuration
    logLevel: process.env.LOG_LEVEL || 'info'
};

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'RECIPIENT_WALLET', 'ACCESS_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.warn('Warning: The following required environment variables are not set:');
    missingVars.forEach(varName => console.warn(`- ${varName}`));
    console.warn('Please set these variables in your .env file.');
}

export default config; 