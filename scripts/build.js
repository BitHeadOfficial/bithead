import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment variables
const env = {
    BACKEND_URL: process.env.BACKEND_URL || 'https://bithead.onrender.com',
    FRONTEND_URL: process.env.FRONTEND_URL || 'https://bithead.at',
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
    SOLANA_NETWORK: process.env.SOLANA_NETWORK
};

// Create a script to inject environment variables
const envScript = `
<script>
window.env = ${JSON.stringify(env, null, 2)};
</script>
`;

// Create config.js content
const configContent = `
// Shared configuration and utilities
export const API_URL = window.env.BACKEND_URL;
export const SOLANA_RPC_URL = window.env.SOLANA_RPC_URL;
export const SOLANA_NETWORK = window.env.SOLANA_NETWORK;

// Utility functions
export function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

export function setupScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('nav a[href^="#"]');

    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (window.scrollY >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').slice(1) === current) {
                link.classList.add('active');
            }
        });
    });
}

// Common API function
export async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(\`\${API_URL}\${endpoint}\`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(\`HTTP error! status: \${response.status}\`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}
`;

// Function to inject environment variables into HTML files
function injectEnvIntoHtml(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const updatedContent = content.replace(
        /<head>/,
        `<head>${envScript}`
    );
    fs.writeFileSync(filePath, updatedContent);
}

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy directory recursively
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// First, copy the entire public directory to dist
console.log('Copying public directory to dist...');
copyDir(path.join(__dirname, '..', 'public'), distDir);

// Create scripts directory in dist if it doesn't exist
const distScriptsDir = path.join(distDir, 'scripts');
if (!fs.existsSync(distScriptsDir)) {
    fs.mkdirSync(distScriptsDir, { recursive: true });
}

// Create config.js in dist/scripts
console.log('Creating config.js in dist/scripts...');
fs.writeFileSync(path.join(distScriptsDir, 'config.js'), configContent);

// Inject environment variables into HTML files
console.log('Injecting environment variables into HTML files...');
const htmlFiles = [
    'index.html',
    'genesis.html',
    'admin.html',
    '404.html',
    'terms-of-service.html',
    'privacy-policy.html'
];

htmlFiles.forEach(file => {
    const filePath = path.join(distDir, file);
    if (fs.existsSync(filePath)) {
        console.log(`Injecting env into ${file}...`);
        injectEnvIntoHtml(filePath);
    }
});

console.log('Build completed successfully!'); 