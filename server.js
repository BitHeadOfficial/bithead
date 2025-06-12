// server.js
// Core Node.js modules
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// NPM dependencies
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import sqlite3 from 'sqlite3';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';

// Local modules
import { errorHandler } from './middleware/index.js';
import { config } from './config/index.js';
import logger from './utils/logger.js';
import userRoutes from './routes/user.js';
import paymentRoutes from './routes/payment.js';
import adminRouter from './routes/admin.js';
import db from './db/index.js';
import monitoringRoutes from './routes/monitoring.js';
import { updateMetrics } from './utils/logger.js';
import contactRoutes from './routes/contact.js';
import whitelistRoutes from './routes/whitelist.js';
import nftGeneratorRoutes from './routes/nft-generator.js';
import { errorLogger, requestLogger, logWalletConnection, logTransaction } from './utils/logger.js';

// Initialize error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    console.error('Stack trace:', error.stack);
    logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    console.error('Stack trace:', reason?.stack);
    logger.error('Unhandled Rejection:', { 
        reason: reason?.message || reason, 
        stack: reason?.stack 
    });
    process.exit(1);
});

// Initialize environment
console.log('Loading environment variables...');
try {
    dotenv.config();
    console.log('Environment variables loaded');
} catch (error) {
    console.error('Failed to load environment variables:', error);
    logger.error('Failed to load environment variables:', { error: error.message });
    process.exit(1);
}

// Initialize metrics
try {
    updateMetrics.uptime();
    logger.info('Metrics system initialized');
} catch (error) {
    console.error('Failed to initialize metrics:', error);
    logger.error('Failed to initialize metrics:', { error: error.message });
    // Don't exit here, as metrics are not critical for server operation
}

// Setup __dirname equivalent for ES modules
console.log('Setting up module paths...');
let __dirname;
try {
    const __filename = fileURLToPath(import.meta.url);
    __dirname = dirname(__filename);
    console.log('Module paths configured');
} catch (error) {
    console.error('Failed to setup module paths:', error);
    process.exit(1);
}

// Add basic console logging at the start
console.log('Starting server initialization...');

// Move app configuration before server creation
const app = express();

// Create a write stream for morgan logging
console.log('Setting up logging...');
let accessLogStream;
try {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create a write stream for morgan
    accessLogStream = fs.createWriteStream(
        path.join(logsDir, 'access.log'),
        { flags: 'a' }
    );
    console.log('Logging setup complete');
} catch (error) {
    console.error('Failed to setup logging:', error);
    process.exit(1);
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 
                       "https://cdn.jsdelivr.net", 
                       "https://unpkg.com", 
                       "https://cdnjs.cloudflare.com",
                       "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/",
                       "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"],
            styleSrc: ["'self'", "'unsafe-inline'", 
                      "https://cdn.jsdelivr.net", 
                      "https://fonts.googleapis.com", 
                      "https://cdnjs.cloudflare.com",
                      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/"],
            imgSrc: ["'self'", "data:", 
                    "https://cdn.jsdelivr.net", 
                    "https://unpkg.com",
                    "https://cdnjs.cloudflare.com",
                    "https://abs.twimg.com",
                    "https://pbs.twimg.com",
                    "https://unavatar.io"],
            connectSrc: ["'self'", 
                        "https://fragrant-icy-general.solana-mainnet.quiknode.pro",
                        "wss://fragrant-icy-general.solana-mainnet.quiknode.pro",
                        "https://cdnjs.cloudflare.com",
                        "https://unpkg.com"],
            fontSrc: ["'self'", 
                     "https://fonts.gstatic.com", 
                     "https://cdnjs.cloudflare.com",
                     "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            workerSrc: ["'self'", "blob:"],
            childSrc: ["'self'"],
            formAction: ["'self'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            upgradeInsecureRequests: []
        }
    }
}));
app.use(cors({
    origin: ['https://www.bithead.at', 'https://bithead.at'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());
app.use(requestLogger);
app.use(morgan('combined', { stream: accessLogStream }));

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Protected content
const protectedContent = {
  vaultItems: [
    {
      title: "Neuro Genesis Manuscript",
      description: "An original hand‑written draft detailing the first cognitive Web3 DAO.",
      imageUrl: "/assets/images/sci-fi-concept_1.jpg"
    },
    {
      title: "Anti‑Fade Algorithm Blueprints",
      description: "The schematics for a self‑healing image‑fading algorithm lost in the 2023 crash.",
      imageUrl: "/assets/images/sci-fi-concept_1.jpg"
    },
    {
      title: "Neural Network Prototype",
      description: "A pre‑release ML model that predicted gas fees with 99.7% accuracy.",
      imageUrl: "/assets/images/sci-fi-concept_1.jpg"
    }
  ],
  pillars: [
    "Open Source First",
    "Decentralize Everything",
    "Code Over Conversation",
    "Community Over Competition",
    "Learn Constantly",
    "Ship Early, Ship Often",
    "Respect the Chain",
    "Embrace Failure",
    "Act with Integrity",
    "Pay It Forward",
    "Cultivate Empathy",
    "Think Long Term"
  ]
};

// Whitelist storage
const WHITELIST_FILE = path.join(__dirname, 'data', 'secure', 'whitelist.json');

// Ensure data/secure directory exists
const secureDir = path.join(__dirname, 'data', 'secure');
if (!fs.existsSync(secureDir)) {
    fs.mkdirSync(secureDir, { recursive: true });
}

// Initialize whitelist file if it doesn't exist
if (!fs.existsSync(WHITELIST_FILE)) {
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify([]));
    fs.chmodSync(WHITELIST_FILE, 0o600); // Set secure permissions
}

// Initialize Solana connection
const connection = new Connection(config.solanaRpcUrl);

// Authentication middleware
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }
};

// Unlock endpoint
app.post('/api/unlock', (req, res) => {
    try {
        console.log('=== Unlock Request Debug ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('Environment variables:', {
            JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Not set',
            ACCESS_PASSWORD: process.env.ACCESS_PASSWORD ? 'Set' : 'Not set'
        });

        const { password } = req.body;
        
        if (!password) {
            console.log('No password provided');
            return res.status(400).json({ 
                error: 'Password is required',
                success: false,
                debug: 'No password in request body'
            });
        }

        console.log('Received password:', password);
        console.log('Expected password:', process.env.ACCESS_PASSWORD);
        console.log('Password comparison:', password === process.env.ACCESS_PASSWORD);

        if (password === process.env.ACCESS_PASSWORD) {
            console.log('Password match successful');
            try {
                console.log('Attempting to generate JWT token...');
                const token = jwt.sign(
                    { 
                        authorized: true,
                        accessType: 'password'  // Add access type to distinguish from wallet access
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h' }
                );
                console.log('Token generated successfully');
                console.log('=== End Unlock Request Debug ===');
                res.json({ 
                    token,
                    success: true,
                    message: 'Access granted',
                    debug: 'Token generated and sent'
                });
            } catch (jwtError) {
                console.error('JWT signing error:', jwtError);
                res.status(500).json({ 
                    error: 'Failed to generate access token',
                    success: false,
                    debug: 'JWT signing failed'
                });
            }
        } else {
            console.log('Password match failed');
            res.status(401).json({ 
                error: 'Invalid password',
                success: false,
                debug: 'Password did not match'
            });
        }
    } catch (error) {
        console.error('Unlock endpoint error:', error);
        res.status(500).json({ 
            error: 'Server error',
            success: false,
            debug: error.message
        });
    }
});

// Protected content endpoint
app.get('/api/content', verifyToken, (req, res) => {
  console.log('Sending protected content');
  res.json(protectedContent);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Check access status
app.get('/api/check-access', verifyToken, async (req, res) => {
    try {
        console.log('Checking access status for token:', req.user);
        
        // Handle password-based access
        if (req.user.accessType === 'password') {
            return res.json({ hasAccess: true, accessType: 'password' });
        }
        
        // Handle wallet-based access
        const publicKey = req.user.publicKey;
        if (!publicKey) {
            return res.status(400).json({ hasAccess: false, error: 'No public key in token' });
        }

        const recipient = new PublicKey(process.env.RECIPIENT_WALLET);
        const userPubkey = new PublicKey(publicKey);
        const ACCESS_THRESHOLD_LAMPORTS = 1 * 1e9; // 1 SOL
        
        const sigs = await connection.getSignaturesForAddress(userPubkey, { limit: 1000 });
        let totalLamports = 0;
        
        for (const sigInfo of sigs) {
            try {
                if (!sigInfo.confirmationStatus || sigInfo.confirmationStatus === 'processed') continue;
                const tx = await connection.getTransaction(sigInfo.signature, { commitment: 'confirmed' });
                if (!tx || !tx.meta || !tx.transaction || !tx.transaction.message) continue;
                
                for (const ix of tx.transaction.message.instructions) {
                    if (!ix.programId || !ix.programId.toBase58) continue;
                    if (ix.programId.toBase58() !== SystemProgram.programId.toBase58()) continue;
                    
                    try {
                        const parsed = SystemProgram.decodeInstruction(ix);
                        if (!parsed || !parsed.keys || !parsed.data) continue;
                        
                        if (parsed.keys.length >= 2 && 
                            parsed.keys[0].pubkey && 
                            parsed.keys[1].pubkey &&
                            parsed.keys[0].pubkey.equals(userPubkey) &&
                            parsed.keys[1].pubkey.equals(recipient)) {
                            totalLamports += parsed.data.lamports || 0;
                        }
                    } catch (e) {
                        console.log('Error parsing instruction:', e.message);
                        continue;
                    }
                }
            } catch (e) {
                console.log('Error processing signature:', e.message);
                continue;
            }
        }
        
        console.log(`Total lamports sent from ${publicKey} to recipient:`, totalLamports);
        if (totalLamports >= ACCESS_THRESHOLD_LAMPORTS) {
            res.json({ 
                hasAccess: true, 
                totalSent: totalLamports,
                accessType: 'wallet'
            });
        } else {
            res.json({ 
                hasAccess: false, 
                totalSent: totalLamports,
                accessType: 'wallet'
            });
        }
    } catch (error) {
        console.error('Error checking access:', error);
        res.status(500).json({ error: 'Failed to check access status' });
    }
});

// Check access by wallet public key (no JWT required)
app.post('/api/check-access-wallet', async (req, res) => {
    try {
        const { publicKey } = req.body;
        logWalletConnection(publicKey, true);
        console.log('[WalletCheck] Checking access for publicKey:', publicKey);
        if (!publicKey) {
            console.log('[WalletCheck] No public key provided');
            return res.status(400).json({ hasAccess: false, error: 'No public key provided' });
        }
        const recipient = new PublicKey(process.env.RECIPIENT_WALLET);
        console.log('[WalletCheck] Recipient address:', recipient.toBase58());
        const userPubkey = new PublicKey(publicKey);
        const ACCESS_THRESHOLD_LAMPORTS = 1 * 1e9; // 1 SOL
        
        // Get signatures with a smaller limit to avoid rate limiting
        const sigs = await connection.getSignaturesForAddress(userPubkey, { limit: 10 });
        console.log(`[WalletCheck] Found ${sigs.length} signatures for user`);
        let totalLamports = 0;
        
        // Process transactions sequentially with delay to avoid rate limiting
        for (const sigInfo of sigs) {
            try {
                // Add delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
                
                const tx = await connection.getTransaction(sigInfo.signature, { 
                    commitment: 'confirmed',
                    maxSupportedTransactionVersion: 0
                });
                
                if (!tx || !tx.meta || !tx.transaction || !tx.transaction.message) {
                    console.log('[WalletCheck] Skipping transaction - missing data:', sigInfo.signature);
                    continue;
                }
                
                console.log('[WalletCheck] Processing transaction:', sigInfo.signature);
                
                // Check pre and post balances
                if (tx.meta.preBalances && tx.meta.postBalances && tx.transaction.message.accountKeys) {
                    const fromIndex = tx.transaction.message.accountKeys.findIndex(key => 
                        key.toBase58() === userPubkey.toBase58()
                    );
                    const toIndex = tx.transaction.message.accountKeys.findIndex(key => 
                        key.toBase58() === recipient.toBase58()
                    );
                    
                    if (fromIndex !== -1 && toIndex !== -1) {
                        const preBalance = tx.meta.preBalances[fromIndex];
                        const postBalance = tx.meta.postBalances[fromIndex];
                        const transferAmount = preBalance - postBalance;
                        
                        if (transferAmount > 0) {
                            totalLamports += transferAmount;
                            console.log(`[WalletCheck] Found transfer: +${transferAmount} lamports in tx ${sigInfo.signature}`);
                        }
                    }
                }
                
                // Also check instructions as backup
                for (const ix of tx.transaction.message.instructions) {
                    if (!ix.programId || !ix.programId.toBase58) continue;
                    if (ix.programId.toBase58() !== SystemProgram.programId.toBase58()) continue;
                    
                    try {
                        const parsed = SystemProgram.decodeInstruction(ix);
                        if (!parsed || !parsed.keys || !parsed.data) continue;
                        
                        if (parsed.keys.length >= 2 && 
                            parsed.keys[0].pubkey && 
                            parsed.keys[1].pubkey &&
                            parsed.keys[0].pubkey.equals(userPubkey) &&
                            parsed.keys[1].pubkey.equals(recipient)) {
                            const lamports = parsed.data.lamports || 0;
                            if (lamports > 0) {
                                totalLamports += lamports;
                                console.log(`[WalletCheck] Found transfer in instruction: +${lamports} lamports in tx ${sigInfo.signature}`);
                            }
                        }
                    } catch (e) {
                        console.log('[WalletCheck] Error parsing instruction:', e.message);
                        continue;
                    }
                }
            } catch (e) {
                console.log('[WalletCheck] Error processing signature:', e.message);
                continue;
            }
        }
        
        console.log(`[WalletCheck] Total lamports sent from ${publicKey} to recipient:`, totalLamports);
        if (totalLamports >= ACCESS_THRESHOLD_LAMPORTS) {
            updateMetrics.transaction('successful');
            const token = jwt.sign(
                { publicKey, accessType: 'wallet' },
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );
            console.log('[WalletCheck] Access granted, token issued');
            return res.json({ hasAccess: true, token, totalSent: totalLamports });
        } else {
            updateMetrics.transaction('failed');
            console.log('[WalletCheck] Access denied, not enough sent');
            return res.json({ hasAccess: false, totalSent: totalLamports });
        }
    } catch (error) {
        logWalletConnection(req.body.publicKey, false);
        updateMetrics.error('WalletCheckError');
        console.error('Error in /api/check-access-wallet:', error);
        if (error && error.stack) console.error(error.stack);
        res.status(500).json({ error: 'Failed to check wallet access' });
    }
});

// API routes
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRouter);
app.use('/api/whitelist', whitelistRoutes);

// Add monitoring routes
app.use('/api/monitoring', monitoringRoutes);

// Register routes
app.use('/api/contact', contactRoutes);

// Add NFT generator routes
app.use('/api/nft-generator', nftGeneratorRoutes);

// Update rate limit handling to use metrics
const rateLimiter = rateLimit({
    windowMs: config.rateLimitWindow,
    max: config.rateLimitMax,
    handler: (req, res) => {
        updateMetrics.rateLimit(true);
        res.status(429).json({ 
            error: 'Too many requests, please try again later' 
        });
    }
});

// Request logging middleware
app.use((req, res, next) => {
    updateMetrics.request(req.path);
    next();
});

// Payment endpoint
app.post('/api/payment', async (req, res) => {
    try {
        console.log('Payment request received:', req.body);
        
        const { publicKey, amount } = req.body;
        
        if (!publicKey || !amount) {
            console.log('Missing parameters:', { publicKey, amount });
            updateMetrics.error('InvalidPaymentRequest');
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        try {
            // Convert amount to lamports (1 SOL = 1,000,000,000 lamports)
            const lamports = amount * 1000000000;
            console.log('Creating transaction for:', { amount, lamports });

            // Create a new transaction
            const transaction = new Transaction();

            // Get recent blockhash
            console.log('Getting latest blockhash...');
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            console.log('Blockhash received:', blockhash);
            
            // Set transaction parameters
            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;
            transaction.feePayer = new PublicKey(publicKey);

            // Add the transfer instruction
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: new PublicKey(publicKey),
                    toPubkey: new PublicKey(process.env.RECIPIENT_WALLET),
                    lamports: lamports,
                })
            );

            console.log('Transaction created successfully');

            // Serialize the transaction
            const serializedTransaction = transaction.serialize({
                requireAllSignatures: false,
                verifySignatures: false
            });

            // Generate JWT token
            const token = jwt.sign(
                { publicKey },
                process.env.JWT_SECRET,
                { expiresIn: '30d' } // Token expires in 30 days
            );

            // Store payment record in database
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30); // Access expires in 30 days

            // Update metrics for successful transaction creation
            updateMetrics.transaction('pending');

            // Return the transaction to be signed by the client
            res.json({ 
                transaction: serializedTransaction.toString('base64'),
                token,
                expiresAt: expiresAt.toISOString(),
                message: 'Please sign the transaction in your wallet'
            });

            logTransaction(transaction.signature, amount, true);

        } catch (error) {
            logTransaction(req.body.transactionId, req.body.amount, false);
            updateMetrics.transaction('failed');
            updateMetrics.error('PaymentError');
            console.error('Transaction creation error:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({ 
                error: 'Failed to create payment transaction',
                details: error.message
            });
        }

    } catch (error) {
        console.error('Payment error:', error);
        console.error('Error stack:', error.stack);
        updateMetrics.error('PaymentError');
        res.status(500).json({ 
            error: 'Failed to process payment request',
            details: error.message
        });
    }
});

// Public join whitelist endpoint
app.post('/api/whitelist', async (req, res) => {
    try {
        const { name, email, walletAddress } = req.body;
        console.log('[Whitelist] Received:', { name, email, walletAddress });
        if (!name || !email || !walletAddress) {
            return res.status(400).json({ success: false, error: 'Name, email, and wallet address are required.' });
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, error: 'Invalid email format.' });
        }
        // Validate wallet address (basic length check)
        if (walletAddress.length < 20) {
            return res.status(400).json({ success: false, error: 'Invalid wallet address.' });
        }
        // Insert into database
        db.run(
            'INSERT INTO whitelist (name, email, wallet_address) VALUES (?, ?, ?)',
            [name, email, walletAddress],
            function(err) {
                if (err) {
                    console.error('[Whitelist] DB Error:', err.message);
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ success: false, error: 'Email or wallet address already whitelisted.' });
                    }
                    return res.status(500).json({ success: false, error: 'Failed to join whitelist.', details: err.message });
                }
                res.json({ success: true });
        });
    } catch (error) {
        console.error('[Whitelist] Handler Error:', error.message, error.stack);
        res.status(500).json({ success: false, error: 'Server error.', details: error.message });
    }
});

// --- Leaderboard Endpoints ---
// Get top 10 leaderboard entries
app.get('/api/leaderboard', async (req, res) => {
    try {
        db.all(
            'SELECT display_name, twitter_handle, profile_pic, score, created_at FROM leaderboard ORDER BY score DESC, created_at ASC LIMIT 10',
            [],
            (err, rows) => {
                if (err) {
                    console.error('[Leaderboard] DB Error:', err.message);
                    return res.status(500).json({ success: false, error: 'Failed to fetch leaderboard.' });
                }
                res.json({ success: true, leaderboard: rows });
            }
        );
    } catch (error) {
        console.error('[Leaderboard] Handler Error:', error.message, error.stack);
        res.status(500).json({ success: false, error: 'Server error.' });
    }
});

// Add a new leaderboard entry
app.post('/api/leaderboard', async (req, res) => {
    try {
        let { displayName, twitterHandle, profilePic, score } = req.body;
        if (typeof displayName !== 'string' || typeof twitterHandle !== 'string') {
            return res.status(400).json({ success: false, error: 'Invalid input.' });
        }
        displayName = displayName.trim().slice(0, 20);
        twitterHandle = twitterHandle.trim().replace(/^@*/, '@').slice(0, 16);
        if (!displayName || !twitterHandle || typeof score !== 'number') {
            return res.status(400).json({ success: false, error: 'Missing required fields.' });
        }
        if (!/^@[a-zA-Z0-9_]{1,15}$/.test(twitterHandle)) {
            return res.status(400).json({ success: false, error: 'Invalid Twitter handle.' });
        }
        // Use Twitter avatar if not provided
        if (!profilePic) {
            profilePic = `https://unavatar.io/twitter/${twitterHandle.replace('@','')}`;
        }
        // Upsert logic: update if exists and new score is higher, else insert
        db.get('SELECT * FROM leaderboard WHERE display_name = ? OR twitter_handle = ?', [displayName, twitterHandle], (err, row) => {
            if (err) {
                console.error('[Leaderboard] DB Error:', err.message);
                return res.status(500).json({ success: false, error: 'Failed to check leaderboard.' });
            }
            if (row) {
                // Only update if new score is higher
                if (score > row.score) {
                    db.run('UPDATE leaderboard SET score = ?, profile_pic = ? WHERE id = ?', [score, profilePic, row.id], function(err2) {
                        if (err2) {
                            console.error('[Leaderboard] DB Error:', err2.message);
                            return res.status(500).json({ success: false, error: 'Failed to update leaderboard.' });
                        }
                        // Return updated leaderboard
                        db.all('SELECT display_name, twitter_handle, profile_pic, score, created_at FROM leaderboard ORDER BY score DESC, created_at ASC LIMIT 10', [], (err3, rows) => {
                            if (err3) {
                                console.error('[Leaderboard] DB Error:', err3.message);
                                return res.status(500).json({ success: false, error: 'Failed to fetch leaderboard.' });
                            }
                            res.json({ success: true, leaderboard: rows });
                        });
                    });
                } else {
                    // No update needed, just return leaderboard
                    db.all('SELECT display_name, twitter_handle, profile_pic, score, created_at FROM leaderboard ORDER BY score DESC, created_at ASC LIMIT 10', [], (err3, rows) => {
                        if (err3) {
                            console.error('[Leaderboard] DB Error:', err3.message);
                            return res.status(500).json({ success: false, error: 'Failed to fetch leaderboard.' });
                        }
                        res.json({ success: true, leaderboard: rows });
                    });
                }
            } else {
                db.run('INSERT INTO leaderboard (display_name, twitter_handle, profile_pic, score) VALUES (?, ?, ?, ?)', [displayName, twitterHandle, profilePic, score], function(err2) {
                    if (err2) {
                        console.error('[Leaderboard] DB Error:', err2.message);
                        return res.status(500).json({ success: false, error: 'Failed to add leaderboard entry.' });
                    }
                    db.all('SELECT display_name, twitter_handle, profile_pic, score, created_at FROM leaderboard ORDER BY score DESC, created_at ASC LIMIT 10', [], (err3, rows) => {
                        if (err3) {
                            console.error('[Leaderboard] DB Error:', err3.message);
                            return res.status(500).json({ success: false, error: 'Failed to fetch leaderboard.' });
                        }
                        res.json({ success: true, leaderboard: rows });
                    });
                });
            }
        });
    } catch (error) {
        console.error('[Leaderboard] Handler Error:', error.message, error.stack);
        res.status(500).json({ success: false, error: 'Server error.' });
    }
});

// Clear all leaderboard entries (for admin/maintenance)
app.delete('/api/leaderboard', async (req, res) => {
    try {
        db.run('DELETE FROM leaderboard', [], function(err) {
            if (err) {
                console.error('[Leaderboard] DB Error:', err.message);
                return res.status(500).json({ success: false, error: 'Failed to clear leaderboard.' });
            }
            res.json({ success: true });
        });
    } catch (error) {
        console.error('[Leaderboard] Handler Error:', error.message, error.stack);
        res.status(500).json({ success: false, error: 'Server error.' });
    }
});

// Add error handling middleware at the end
app.use(errorLogger);
app.use((err, req, res, next) => {
    try {
        logger.error('Server error:', { 
            error: err.message, 
            stack: err.stack,
            path: req.path,
            method: req.method
        });
        
        // Update error metrics
        updateMetrics.error('server_error');
        
        // Send error response
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'An error occurred' 
                : err.message,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // If error handling itself fails, send a basic error
        console.error('Error in error handler:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});

// Apply rate limiting to all routes
app.use(rateLimiter);

// Catch-all route for the genesis page
app.get('/genesis', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'genesis.html'));
});

// Route for the admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve 404 page for all other unmatched routes
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Promisify database methods (add dbRun)
const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Database all error:', err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) {
                console.error('Database get error:', err);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

const dbRun = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) {
                console.error('Database run error:', err);
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
};

// Add database connection verification
async function verifyDatabaseConnection() {
    return new Promise((resolve, reject) => {
        console.log('Verifying database connection...');
        db.get('SELECT 1', (err, row) => {
            if (err) {
                console.error('Database connection error:', err);
                reject(err);
            } else {
                console.log('Database connection verified');
                resolve();
            }
        });
    });
}

// Modify initializeDatabase function
async function initializeDatabase() {
    // Implementation of initializeDatabase function
}

// Wrap server startup in async function with detailed error handling
async function startServer() {
    try {
        console.log('Initializing database...');
        await initializeDatabase();
        console.log('Database initialized successfully');

        console.log('Starting server...');
        console.log('Current working directory:', process.cwd());
        console.log('Node version:', process.version);
        
        console.log('Checking environment variables...');
        console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
        console.log('ACCESS_PASSWORD exists:', !!process.env.ACCESS_PASSWORD);
        console.log('ADMIN_PASSWORD exists:', !!process.env.ADMIN_PASSWORD);
        console.log('PORT exists:', !!process.env.PORT);
        console.log('NODE_ENV:', process.env.NODE_ENV);

        // Create HTTP server after app is fully configured
        console.log('Creating HTTP server...');
        const server = http.createServer(app);
        
        // Configure server timeouts for long-running operations
        server.timeout = 300000; // 5 minutes for long operations
        server.keepAliveTimeout = 65000; // 65 seconds
        server.headersTimeout = 66000; // 66 seconds
        
        // Get port from environment variable or use default
        const port = process.env.PORT || 3000;
        console.log('Attempting to listen on port:', port);

        // Wrap server.listen in a promise
        await new Promise((resolve, reject) => {
            server.listen(port, '0.0.0.0', () => {
                console.log(`Server is running on port ${port}`);
                resolve();
            }).on('error', (error) => {
                console.error('Server failed to start:', error);
                reject(error);
            });
        });

        // Add error handlers for the server
        server.on('error', (error) => {
            console.error('Server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use`);
            }
        });

    } catch (error) {
        console.error('Server startup failed:', error);
        console.error('Error stack:', error.stack);
        process.exit(1);
    }
}

// Start the server
startServer().catch(error => {
    console.error('Fatal error during server startup:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
});

export default app;
