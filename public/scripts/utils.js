// Global constants and utilities
window.API_URL = window.API_URL || 'https://bithead.at/api';

// Token management
const TOKEN_KEYS = {
    WALLET: 'bithead_wallet_token',
    PASSWORD: 'bithead_password_token',
    ACCESS_TYPE: 'bithead_access_type',
    ADMIN: 'admin_token'
};

// Token management functions
function storeToken(token, type) {
    if (type === 'wallet') {
        localStorage.setItem(TOKEN_KEYS.WALLET, token);
    } else if (type === 'password') {
        localStorage.setItem(TOKEN_KEYS.PASSWORD, token);
    } else if (type === 'admin') {
        localStorage.setItem(TOKEN_KEYS.ADMIN, token);
    }
    if (type !== 'admin') {
        localStorage.setItem(TOKEN_KEYS.ACCESS_TYPE, type);
    }
}

function getStoredToken(type) {
    if (type === 'admin') {
        return localStorage.getItem(TOKEN_KEYS.ADMIN);
    }
    const accessType = localStorage.getItem(TOKEN_KEYS.ACCESS_TYPE);
    if (accessType === 'wallet') {
        return localStorage.getItem(TOKEN_KEYS.WALLET);
    } else if (accessType === 'password') {
        return localStorage.getItem(TOKEN_KEYS.PASSWORD);
    }
    return null;
}

function clearTokens(type) {
    if (type === 'admin') {
        localStorage.removeItem(TOKEN_KEYS.ADMIN);
    } else {
        localStorage.removeItem(TOKEN_KEYS.WALLET);
        localStorage.removeItem(TOKEN_KEYS.PASSWORD);
        localStorage.removeItem(TOKEN_KEYS.ACCESS_TYPE);
    }
}

// Export functions to window object
window.storeToken = storeToken;
window.getStoredToken = getStoredToken;
window.clearTokens = clearTokens;
window.TOKEN_KEYS = TOKEN_KEYS; 