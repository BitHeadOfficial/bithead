import express from 'express';
import fetch from 'node-fetch';
import FormData from 'form-data';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const router = express.Router();

// Contact form proxy endpoint
router.post('/', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        
        // Log incoming request
        logger.info('Contact form submission received', { 
            name, 
            email,
            messageLength: message.length 
        });
        
        // Validate input
        if (!name || !email || !message) {
            logger.warn('Contact form validation failed', { 
                name: !!name, 
                email: !!email, 
                message: !!message,
                receivedData: req.body 
            });
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Get Formspree endpoint from environment
        const formspreeEndpoint = process.env.FORMSPREE_ENDPOINT;
        if (!formspreeEndpoint) {
            logger.error('Formspree endpoint not configured in environment variables');
            return res.status(500).json({ 
                error: 'Contact form service is not properly configured. Please contact the administrator.',
                details: 'FORMSPREE_ENDPOINT environment variable is missing'
            });
        }
        
        // Forward to Formspree
        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        formData.append('message', message);
        
        // Log the FormData contents (without sensitive data)
        logger.info('FormData prepared', {
            nameLength: name.length,
            emailLength: email.length,
            messageLength: message.length
        });
        
        logger.info('Sending to Formspree endpoint');
        
        const response = await fetch(formspreeEndpoint, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        logger.info('Formspree response received', {
            status: response.status,
            statusText: response.statusText
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            logger.error('Formspree request failed', { 
                status: response.status,
                statusText: response.statusText,
                response: responseData
            });
            throw new Error('Formspree request failed: ' + (responseData.error || response.statusText));
        }
        
        logger.info('Contact form submission successful');
        
        res.json({ 
            success: true,
            message: 'Message sent successfully! We will get back to you soon.'
        });
    } catch (error) {
        logger.error('Contact form error:', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            error: 'Failed to send message. Please try again later.',
            details: error.message
        });
    }
});

export default router; 