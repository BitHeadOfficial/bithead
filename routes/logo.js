import express from 'express';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { LogoSubmission } from '../models/index.js';
import db from '../db/index.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Initialize Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL);

// Configure multer for logo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and SVG are allowed.'));
        }
    }
});

// Calculate next price using Fibonacci sequence
function calculateNextPrice(count) {
    if (count === 0) return 0.01; // Starting price: 0.01 SOL
    if (count === 1) return 0.02; // Second price: 0.02 SOL
    
    let a = 0.01;
    let b = 0.02;
    for (let i = 2; i <= count; i++) {
        const next = a + b;
        a = b;
        b = next;
    }
    return b;
}

// Get current price
router.get('/price', async (req, res) => {
    try {
        const count = await LogoSubmission.getCount(db);
        const nextPrice = calculateNextPrice(count);
        res.json({ price: nextPrice, count });
    } catch (error) {
        logger.error('Error getting price:', error);
        res.status(500).json({ error: 'Failed to get price' });
    }
});

// Get all logos
router.get('/logos', async (req, res) => {
    try {
        const logos = await LogoSubmission.getLatest(db);
        res.json(logos);
    } catch (error) {
        logger.error('Error getting logos:', error);
        res.status(500).json({ error: 'Failed to get logos' });
    }
});

// Submit logo
router.post('/submit', upload.single('logo'), async (req, res) => {
    try {
        const { publicKey } = req.body;
        const logoFile = req.file;

        if (!publicKey || !logoFile) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Get current count and calculate price
        const count = await LogoSubmission.getCount(db);
        const price = calculateNextPrice(count);

        // Create transaction
        const transaction = new Transaction();
        const { blockhash } = await connection.getLatestBlockhash();
        
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = new PublicKey(publicKey);

        // Add transfer instruction
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: new PublicKey(publicKey),
                toPubkey: new PublicKey(process.env.RECIPIENT_WALLET),
                lamports: price * LAMPORTS_PER_SOL,
            })
        );

        // Get next position
        const position = await LogoSubmission.getNextPosition(db);

        // Store submission in database (pending)
        const submission = await LogoSubmission.create(db, {
            walletAddress: publicKey,
            logoUrl: `/uploads/logos/${logoFile.filename}`,
            amount: price,
            position
        });

        // Serialize transaction
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        });

        res.json({
            transaction: serializedTransaction.toString('base64'),
            submissionId: submission,
            price,
            position
        });

    } catch (error) {
        logger.error('Error submitting logo:', error);
        res.status(500).json({ error: 'Failed to submit logo' });
    }
});

// Confirm submission
router.post('/confirm', async (req, res) => {
    try {
        const { submissionId, signature } = req.body;

        if (!submissionId || !signature) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Verify transaction
        const tx = await connection.getTransaction(signature);
        if (!tx) {
            return res.status(400).json({ error: 'Transaction not found' });
        }

        // Get submission
        const submission = await db.get('SELECT * FROM logo_submissions WHERE id = ?', [submissionId]);
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // Update submission status
        await db.run('UPDATE logo_submissions SET status = ? WHERE id = ?', ['confirmed', submissionId]);

        res.json({ success: true, submission });

    } catch (error) {
        logger.error('Error confirming submission:', error);
        res.status(500).json({ error: 'Failed to confirm submission' });
    }
});

export default router; 