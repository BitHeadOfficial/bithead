# BitHeadz

A full-stack web application for digital content access and Solana payments.

## Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=your_jwt_secret_here
ACCESS_PASSWORD=your_access_password_here
ADMIN_PASSWORD=your_admin_password_here

# Database
DATABASE_URL=sqlite:///database.sqlite

# Formspree
FORMSPREE_ENDPOINT=https://formspree.io/f/your_form_id_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX=100  # requests per window

# Monitoring
ENABLE_METRICS=true
LOG_LEVEL=info

# Production URLs (update these for production)
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3000
```

## Deployment Instructions

### Backend (Render)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the service:
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Environment Variables: Add all variables from `.env`
   - Node Version: 18.x or later

### Frontend (Netlify)

1. Create a new site on Netlify
2. Connect your GitHub repository
3. Configure the build:
   - Build Command: `npm run build` (if you have one) or leave empty
   - Publish Directory: `public`
   - Environment Variables: Add any frontend-specific variables

### GitHub Setup

1. Initialize git (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Create a new repository on GitHub

3. Push your code:
   ```bash
   git remote add origin your-github-repo-url
   git push -u origin main
   ```

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   node server.js
   ```

3. Access the application at `http://localhost:3000`

## Production Checklist

Before deploying to production:

1. Update all environment variables with production values
2. Set `NODE_ENV=production`
3. Update `FRONTEND_URL` and `BACKEND_URL` to your production domains
4. Ensure all sensitive data is in environment variables
5. Test the contact form in production
6. Verify database connections
7. Check all API endpoints
8. Test rate limiting
9. Verify monitoring endpoints

## Monitoring

The application includes monitoring endpoints:

- `/health` - Basic health check
- `/status` - Detailed status information
- `/metrics` - System metrics
- `/api/monitoring/*` - Additional monitoring endpoints

## Security

- All sensitive data is stored in environment variables
- JWT is used for authentication
- Rate limiting is enabled
- Security headers are set
- CORS is configured
- Input validation is implemented

## Support

For any issues or questions, please contact the administrator.

## Platform-Specific Setup for NFT Generation (canvas dependency)

### macOS (Intel & Apple Silicon)

1. Install [Homebrew](https://brew.sh/) if you haven't already.
2. Run:
   ```sh
   brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman
   ```

### Windows

1. Install [Windows Build Tools](https://github.com/felixrieseberg/windows-build-tools):
   ```sh
   npm install --global --production windows-build-tools
   ```
2. Install GTK dependencies (see [node-canvas wiki](https://github.com/Automattic/node-canvas/wiki/Installation:-Windows)).

### Linux (Debian/Ubuntu)

1. Run:
   ```sh
   sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
   ```

## Low Memory Mode

The NFT Art Generator automatically uses **Low Memory Mode** for optimal compatibility across all hardware types. This ensures:
- Lower batch sizes and concurrency for image processing
- Reduced RAM usage for better stability
- Works reliably on systems with 8GB or less RAM
- Compatible with all platforms (macOS, Windows, Linux)

**Note:** The system is optimized for memory efficiency by default, so no manual configuration is needed.

--- 