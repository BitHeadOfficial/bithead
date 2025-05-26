// Initialize Solana connection
const connection = new solanaWeb3.Connection(window.env.SOLANA_RPC_URL, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000
});

// DOM Elements
const connectWalletBtn = document.getElementById('connectWallet');
const walletStatus = document.getElementById('walletStatus');
const logoForm = document.getElementById('logoForm');
const logoFile = document.getElementById('logoFile');
const filePreview = document.getElementById('filePreview');
const submitLogoBtn = document.getElementById('submitLogo');
const submissionStatus = document.getElementById('submissionStatus');
const currentPriceEl = document.getElementById('currentPrice');
const totalSubmissionsEl = document.getElementById('totalSubmissions');
const logoGrid = document.getElementById('logoGrid');

// State
let selectedFile = null;
let walletConnected = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadPriceInfo();
    loadLogos();
    setupWalletConnection();
    setupFileUpload();
    setupFormSubmission();
});

// Load current price and total submissions
async function loadPriceInfo() {
    try {
        const response = await fetch(`${window.env.API_URL}/api/logo/price`);
        const data = await response.json();
        
        currentPriceEl.textContent = data.price.toFixed(2);
        totalSubmissionsEl.textContent = data.count;
    } catch (error) {
        console.error('Error loading price info:', error);
        currentPriceEl.textContent = 'Error';
        totalSubmissionsEl.textContent = 'Error';
    }
}

// Load and display logos
async function loadLogos() {
    try {
        const response = await fetch(`${window.env.API_URL}/api/logo/logos`);
        const logos = await response.json();
        
        logoGrid.innerHTML = '';
        logos.forEach(logo => {
            const logoItem = createLogoElement(logo);
            logoGrid.appendChild(logoItem);
        });
    } catch (error) {
        console.error('Error loading logos:', error);
        logoGrid.innerHTML = '<p class="error">Failed to load logos</p>';
    }
}

// Create logo element
function createLogoElement(logo) {
    const div = document.createElement('div');
    div.className = 'logo-item';
    
    const img = document.createElement('img');
    img.src = logo.logo_url;
    img.alt = `Logo #${logo.position}`;
    
    const position = document.createElement('div');
    position.className = 'position';
    position.textContent = `#${logo.position}`;
    
    const amount = document.createElement('div');
    amount.className = 'amount';
    amount.textContent = `${logo.amount} SOL`;
    
    div.appendChild(img);
    div.appendChild(position);
    div.appendChild(amount);
    
    return div;
}

// Setup wallet connection
function setupWalletConnection() {
    connectWalletBtn.addEventListener('click', async () => {
        try {
            if (!window.solana || !window.solana.isPhantom) {
                showStatus(walletStatus, 'Please install Phantom wallet', 'error');
                return;
            }

            if (!window.solana.isConnected) {
                await window.solana.connect();
            }

            walletConnected = true;
            connectWalletBtn.textContent = 'Wallet Connected';
            connectWalletBtn.disabled = true;
            showStatus(walletStatus, 'Wallet connected successfully', 'success');
            submitLogoBtn.disabled = false;
        } catch (error) {
            console.error('Wallet connection error:', error);
            showStatus(walletStatus, 'Failed to connect wallet', 'error');
        }
    });
}

// Setup file upload
function setupFileUpload() {
    logoFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) {
            showStatus(submissionStatus, 'Invalid file type. Please upload an image.', 'error');
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            showStatus(submissionStatus, 'File too large. Maximum size is 5MB.', 'error');
            return;
        }

        selectedFile = file;
        
        // Preview image
        const reader = new FileReader();
        reader.onload = (e) => {
            filePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    });
}

// Setup form submission
function setupFormSubmission() {
    logoForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!walletConnected) {
            showStatus(submissionStatus, 'Please connect your wallet first', 'error');
            return;
        }

        if (!selectedFile) {
            showStatus(submissionStatus, 'Please select a logo file', 'error');
            return;
        }

        try {
            submitLogoBtn.disabled = true;
            showStatus(submissionStatus, 'Preparing submission...', 'info');

            // Create form data
            const formData = new FormData();
            formData.append('logo', selectedFile);
            formData.append('publicKey', window.solana.publicKey.toString());

            // Submit logo
            const response = await fetch(`${window.env.API_URL}/api/logo/submit`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to submit logo');
            }

            const { transaction: serializedTransaction, submissionId } = await response.json();

            // Convert base64 to Uint8Array
            const transactionBytes = Uint8Array.from(atob(serializedTransaction), c => c.charCodeAt(0));
            const transaction = solanaWeb3.Transaction.from(transactionBytes);

            // Sign and send transaction
            showStatus(submissionStatus, 'Please sign the transaction in your wallet...', 'info');
            const signed = await window.solana.signAndSendTransaction(transaction);
            
            // Wait for confirmation
            showStatus(submissionStatus, 'Transaction sent! Waiting for confirmation...', 'info');
            
            const confirmation = await connection.confirmTransaction(signed.signature, 'confirmed');
            if (confirmation.value.err) {
                throw new Error('Transaction failed');
            }

            // Confirm submission
            const confirmResponse = await fetch(`${window.env.API_URL}/api/logo/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId, signature: signed.signature })
            });

            if (!confirmResponse.ok) {
                throw new Error('Failed to confirm submission');
            }

            // Success
            showStatus(submissionStatus, 'Logo submitted successfully!', 'success');
            
            // Reset form
            logoForm.reset();
            filePreview.innerHTML = '';
            selectedFile = null;
            
            // Reload data
            loadPriceInfo();
            loadLogos();

        } catch (error) {
            console.error('Submission error:', error);
            showStatus(submissionStatus, error.message || 'Failed to submit logo', 'error');
        } finally {
            submitLogoBtn.disabled = false;
        }
    });
}

// Helper function to show status messages
function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status ${type}`;
    element.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
} 