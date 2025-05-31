// ... existing code ...
async function verifyAccess(token) {
    try {
        console.log('Verifying access with token...');
        const response = await fetch('https://bithead.onrender.com/api/check-access-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
// ... existing code ...