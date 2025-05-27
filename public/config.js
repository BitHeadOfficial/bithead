// Configuration for Netlify deployment
// These values are replaced at build time by Netlify
window.env = {
    API_URL: process.env.BACKEND_URL || 'https://api.bithead.at',
    FRONTEND_URL: process.env.FRONTEND_URL || 'https://bithead.at',
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://fragrant-icy-general.solana-mainnet.quiknode.pro/71ce468fd28dbbcf7e3a1b2e404bfacac9f60a55/',
    SOLANA_NETWORK: process.env.SOLANA_NETWORK || 'mainnet-beta'
}; 