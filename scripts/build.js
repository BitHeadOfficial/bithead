const fs = require('fs');
const path = require('path');

// Read the config template
const configPath = path.join(__dirname, '../public/config.js');
let configContent = fs.readFileSync(configPath, 'utf8');

// Replace environment variables
const envVars = {
    BACKEND_URL: process.env.BACKEND_URL || 'https://api.bithead.at',
    FRONTEND_URL: process.env.FRONTEND_URL || 'https://bithead.at',
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://fragrant-icy-general.solana-mainnet.quiknode.pro/71ce468fd28dbbcf7e3a1b2e404bfacac9f60a55/',
    SOLANA_NETWORK: process.env.SOLANA_NETWORK || 'mainnet-beta'
};

// Replace each environment variable
Object.entries(envVars).forEach(([key, value]) => {
    configContent = configContent.replace(
        new RegExp(`process\\.env\\.${key}`, 'g'),
        `'${value}'`
    );
});

// Write the processed config
fs.writeFileSync(configPath, configContent);
console.log('Config file processed successfully'); 