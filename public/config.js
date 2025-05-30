// Generated config file - DO NOT EDIT DIRECTLY
window.env = {
    BACKEND_URL: 'https://bithead.onrender.com',
    FRONTEND_URL: 'https://bithead.at',
    SOLANA_RPC_URL: 'https://fragrant-icy-general.solana-mainnet.quiknode.pro/71ce468fd28dbbcf7e3a1b2e404bfacac9f60a55/',
    SOLANA_NETWORK: 'mainnet-beta'
};

// Make these available globally
window.API_URL = window.env.BACKEND_URL;
window.SOLANA_RPC_URL = window.env.SOLANA_RPC_URL;
window.SOLANA_NETWORK = window.env.SOLANA_NETWORK;

// Only export if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API_URL: window.API_URL,
        SOLANA_RPC_URL: window.SOLANA_RPC_URL,
        SOLANA_NETWORK: window.SOLANA_NETWORK
    };
}

// Common API function
window.fetchAPI = async function(endpoint, options = {}) {
    try {
        const response = await fetch(
            `${window.API_URL}${endpoint}`,
            {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
};