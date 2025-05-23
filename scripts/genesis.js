let isCheckingAccess = false;
let accessCheckPromise = null;

async function checkAccess() {
    if (accessCheckPromise) {
        return accessCheckPromise;
    }

    accessCheckPromise = (async () => {
        try {
            if (isCheckingAccess) {
                return;
            }
            isCheckingAccess = true;

            const token = localStorage.getItem('accessToken');
            if (!token) {
                return { hasAccess: false };
            }

            try {
                const response = await fetch('/api/check-access', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Access check failed');
                }

                const data = await response.json();
                return data;
            } catch (error) {
                console.warn('Access check failed:', error);
                return { hasAccess: false };
            }
        } finally {
            isCheckingAccess = false;
            accessCheckPromise = null;
        }
    })();

    return accessCheckPromise;
}

async function loadProtectedContent() {
    try {
        const accessData = await checkAccess();
        
        if (!accessData.hasAccess) {
            // Don't show error, just return silently
            return;
        }

        // Rest of the protected content loading logic
        // ... existing code ...
    } catch (error) {
        console.warn('Error loading protected content:', error);
        // Don't show error to user, just return silently
    }
}

async function handleWalletConnection() {
    try {
        const wallet = await connectWallet();
        if (!wallet) return;

        const publicKey = wallet.publicKey.toString();
        console.log('Checking wallet access for:', publicKey);

        // Wait for access check to complete
        const accessData = await checkAccess();
        
        if (accessData.hasAccess) {
            unlockContent();
        } else {
            // Show unlock panel without error message
            showUnlockPanel();
        }
    } catch (error) {
        console.warn('Error handling wallet connection:', error);
        // Don't show error to user
    }
}

// Update the initialization code
document.addEventListener('DOMContentLoaded', async () => {
    // ... existing initialization code ...

    // Check for existing token
    const token = localStorage.getItem('accessToken');
    if (token) {
        try {
            const accessData = await checkAccess();
            if (accessData.hasAccess) {
                unlockContent();
            }
        } catch (error) {
            console.warn('Initial access check failed:', error);
            // Don't show error to user
        }
    }

    // ... rest of initialization code ...
}); 