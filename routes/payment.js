import express from 'express';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import jwt from 'jsonwebtoken';
import sqlite3 from 'sqlite3';
import { Payment } from '../models/index.js';
import { User } from '../models/index.js';
import { AccessLog } from '../models/index.js';
import { authenticate, authenticateUser, validateRequest } from '../middleware/index.js';
import { paymentSchema, createPaymentSchema, updatePaymentSchema } from '../validation/schemas.js';
import logger from '../utils/logger.js';
import solanaWeb3 from '@solana/web3.js';

const router = express.Router();

// Initialize Solana connection to mainnet (QuickNode)
const connection = new Connection(process.env.SOLANA_RPC_URL);

// Your devnet wallet address to receive payments
const RECIPIENT_WALLET = new PublicKey('5Zd2EiC7S2DaT5mQyC1etYmusNPyEQtHDgojdf5oLHLE');

// Database connection
const db = new sqlite3.Database('./database.sqlite');

router.post('/payment', async (req, res) => {
    try {
        console.log('Payment request received:', req.body);
        
        const { publicKey, amount } = req.body;
        
        if (!publicKey || !amount) {
            console.log('Missing parameters:', { publicKey, amount });
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        try {
            // Convert amount to lamports (1 SOL = 1,000,000,000 lamports)
            const lamports = amount * LAMPORTS_PER_SOL;
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
                    toPubkey: RECIPIENT_WALLET,
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

            const payment = await Payment.create({
                userId: req.user.id,
                amount,
                status: 'pending',
                transactionHash: null
            });

            // Return the transaction to be signed by the client
            res.json({ 
                transaction: serializedTransaction.toString('base64'),
                token,
                expiresAt: expiresAt.toISOString(),
                message: 'Please sign the transaction in your wallet'
            });

        } catch (error) {
            console.error('Transaction creation error:', error);
            console.error('Error stack:', error.stack);
            throw error;
        }

    } catch (error) {
        console.error('Payment error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to create payment transaction',
            details: error.message,
            stack: error.stack
        });
    }
});

// Create a new payment
router.post('/payments', validateRequest(createPaymentSchema), async (req, res) => {
    try {
        const { publicKey, amount } = req.body;
        
        // Create a connection to the Solana network
        const connection = new Connection(process.env.SOLANA_RPC_URL);
        
        // Create a transaction
        const transaction = new Transaction();
        
        // Add the transfer instruction
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: new PublicKey(publicKey),
                toPubkey: new PublicKey(process.env.RECIPIENT_WALLET),
                lamports: amount * LAMPORTS_PER_SOL
            })
        );
        
        // Get the latest blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = new PublicKey(publicKey);
        
        // Serialize the transaction
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        });
        
        // Convert to base64
        const base64Transaction = Buffer.from(serializedTransaction).toString('base64');
        
        // Create payment record
        const payment = await Payment.create({
            userId: publicKey,
            amount,
            status: 'pending'
        });
        
        // Generate JWT token
        const token = jwt.sign(
            { publicKey },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        logger.info(`Created payment request for user ${publicKey}`, { paymentId: payment.id });
        
        res.json({
            transaction: base64Transaction,
            paymentId: payment.id,
            token
        });
    } catch (error) {
        logger.error('Error creating payment:', error);
        res.status(500).json({ error: 'Failed to create payment' });
    }
});

// Update payment status
router.put('/:id', authenticate, validateRequest(updatePaymentSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        logger.info(`Updating payment status for payment: ${id}, status: ${status}`);
        const payment = await Payment.updateStatus(id, status);
        res.json({ payment });
    } catch (error) {
        logger.error('Payment status update error:', error);
        res.status(500).json({ error: 'Failed to update payment status' });
    }
});

// Get user payment history
router.get('/history', authenticate, async (req, res) => {
    try {
        logger.info(`Fetching payment history for user: ${req.user.id}`);
        const payments = await Payment.getUserPayments(req.user.id);
        res.json({ payments });
    } catch (error) {
        logger.error('Payment history retrieval error:', error);
        res.status(500).json({ error: 'Failed to retrieve payment history' });
    }
});

// Get payment statistics
router.get('/stats', authenticate, async (req, res) => {
    try {
        logger.info('Fetching payment statistics');
        const stats = await Payment.getStats();
        res.json({ stats });
    } catch (error) {
        logger.error('Payment statistics retrieval error:', error);
        res.status(500).json({ error: 'Failed to retrieve payment statistics' });
    }
});

// Get recent payments
router.get('/recent', authenticate, async (req, res) => {
    try {
        logger.info('Fetching recent payments');
        const payments = await Payment.getRecent();
        res.json({ payments });
    } catch (error) {
        logger.error('Recent payments retrieval error:', error);
        res.status(500).json({ error: 'Failed to retrieve recent payments' });
    }
});

// Placeholder Whitelist routes (Temporarily moved here for debugging)
router.post('/whitelist', (req, res) => {
    logger.info('Received POST request to /api/whitelist (placeholder)', { body: req.body });
    // Placeholder success response
    res.json({ success: true, message: 'Whitelist submission received (placeholder)' });
});

router.get('/admin/whitelist', (req, res) => {
    logger.info('Received GET request to /api/admin/whitelist (placeholder)');
    // Placeholder response
    res.json({ whitelist: [], message: 'Admin whitelist endpoint reached (placeholder)' });
});

router.get('/check-whitelist', (req, res) => {
     logger.info('Received GET request to /api/check-whitelist (placeholder)', { query: req.query });
     // Placeholder response - assume not whitelisted for now
     res.json({ isWhitelisted: false, message: 'Check whitelist endpoint reached (placeholder)' });
});

export default router; 