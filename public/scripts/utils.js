// Global constants and utilities
window.API_URL = window.env.API_URL || 'https://bithead.onrender.com';

// Token management
const TOKEN_KEYS = {
    WALLET: 'bithead_wallet_token',
    PASSWORD: 'bithead_password_token',
    ACCESS_TYPE: 'bithead_access_type',
    ADMIN: 'admin_token'
};

// Component loading functions
async function loadComponent(containerId, componentPath) {
    try {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container ${containerId} not found`);
            return;
        }

        const response = await fetch(componentPath);
        if (!response.ok) {
            throw new Error(`Failed to load component: ${response.statusText}`);
        }

        const html = await response.text();
        container.innerHTML = html;

        // Execute any scripts in the loaded component
        const scripts = container.getElementsByTagName('script');
        for (const script of scripts) {
            const newScript = document.createElement('script');
            newScript.textContent = script.textContent;
            script.parentNode.replaceChild(newScript, script);
        }
    } catch (error) {
        console.error(`Error loading component ${componentPath}:`, error);
    }
}

// Load header and footer on page load
document.addEventListener('DOMContentLoaded', () => {
    loadComponent('header-container', '/components/header.html');
    loadComponent('footer-container', '/components/footer.html');
});

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
window.loadComponent = loadComponent; 