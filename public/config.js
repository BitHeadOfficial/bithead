// Environment configuration
window.env = {
    // API URL - will be set based on environment
    API_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000'  // Development
        : 'https://bithead.onrender.com',  // Production (Render free tier)
    // Add other environment variables as needed
};
