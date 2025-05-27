const fs = require('fs');
const path = require('path');

// Read the config template
const configPath = path.join(__dirname, '../public/config.js');
let configContent = fs.readFileSync(configPath, 'utf8');

// Get environment variables with fallbacks
const envVars = {
    BACKEND_URL: process.env.BACKEND_URL || 'https://api.bithead.at',
    FRONTEND_URL: process.env.FRONTEND_URL || 'https://bithead.at',
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://fragrant-icy-general.solana-mainnet.quiknode.pro/71ce468fd28dbbcf7e3a1b2e404bfacac9f60a55/',
    SOLANA_NETWORK: process.env.SOLANA_NETWORK || 'mainnet-beta'
};

// Create the final config content
const finalConfig = `// Generated config file - DO NOT EDIT DIRECTLY
window.env = {
    API_URL: '${envVars.BACKEND_URL}',
    FRONTEND_URL: '${envVars.FRONTEND_URL}',
    SOLANA_RPC_URL: '${envVars.SOLANA_RPC_URL}',
    SOLANA_NETWORK: '${envVars.SOLANA_NETWORK}'
};`;

// Write the processed config
fs.writeFileSync(configPath, finalConfig);
console.log('Config file generated successfully with values:', envVars); 