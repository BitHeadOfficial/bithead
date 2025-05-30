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

// Copy config.js to dist/scripts
console.log('Copying config.js to dist/scripts...');
fs.copyFileSync(
    path.join(__dirname, '..', 'public', 'scripts', 'config.js'),
    path.join(distScriptsDir, 'config.js')
);

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