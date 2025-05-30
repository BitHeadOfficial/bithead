// Generated config file - DO NOT EDIT DIRECTLY
window.env = {
    BACKEND_URL: 'https://bithead.onrender.com',
    FRONTEND_URL: 'https://bithead.at',
    SOLANA_RPC_URL: 'https://fragrant-icy-general.solana-mainnet.quiknode.pro/71ce468fd28dbbcf7e3a1b2e404bfacac9f60a55/',
    SOLANA_NETWORK: 'mainnet-beta'
};

export const API_URL = window.env.BACKEND_URL;

export async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(
            `${API_URL}${endpoint}`,
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