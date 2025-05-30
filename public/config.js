// Generated config file - DO NOT EDIT DIRECTLY
window.env = {
    API_URL: 'https://api.bithead.at',
    FRONTEND_URL: 'https://bithead.at',
    SOLANA_RPC_URL: 'https://fragrant-icy-general.solana-mainnet.quiknode.pro/71ce468fd28dbbcf7e3a1b2e404bfacac9f60a55/',
    SOLANA_NETWORK: 'mainnet-beta'
};

export async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(
            `${window.env.API_URL}${endpoint}`,
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
}