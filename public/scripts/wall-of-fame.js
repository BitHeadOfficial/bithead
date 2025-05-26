// Initialize Solana connection
const connection = new solanaWeb3.Connection(
    window.location.hostname === 'localhost'
        ? 'http://localhost:8899'  // Development
        : 'https://api.mainnet-beta.solana.com'  // Production
);

// DOM Elements
const connectWalletBtn = document.getElementById('connectWallet');
const walletStatus = document.getElementById('walletStatus');
const logoFileInput = document.getElementById('logoFile');
const filePreview = document.getElementById('filePreview');
const submitButton = document.getElementById('submitButton');
const statusMessage = document.getElementById('statusMessage');
const currentPriceEl = document.getElementById('currentPrice');
const totalSubmissionsEl = document.getElementById('totalSubmissions');
const logoGrid = document.getElementById('logoGrid');

let wallet = null;
let selectedFile = null;

// Load current price and total submissions
async function loadPriceInfo() {
    try {
        const response = await fetch(`${window.API_URL}/api/logo/price`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (currentPriceEl) currentPriceEl.textContent = data.price.toFixed(2);
        if (totalSubmissionsEl) totalSubmissionsEl.textContent = data.count;
    } catch (error) {
        console.error('Error loading price info:', error);
        if (statusMessage) {
            statusMessage.textContent = 'Error loading price information. Please try again later.';
            statusMessage.className = 'status-message error';
        }
    }
}

// Load and display logos
async function loadLogos() {
    try {
        const response = await fetch(`${window.API_URL}/api/logo/logos`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const logos = await response.json();
        
        if (!logoGrid) return;

        logoGrid.innerHTML = '';
        logos.forEach(logo => {
            const logoItem = document.createElement('div');
            logoItem.className = 'logo-item';
            
            const img = document.createElement('img');
            img.src = logo.logo_url;
            img.alt = `Logo #${logo.position}`;
            img.onerror = () => {
                img.src = '/images/placeholder-logo.png';
                img.alt = 'Logo not available';
            };
            
            const position = document.createElement('div');
            position.className = 'position';
            position.textContent = `#${logo.position}`;
            
            const amount = document.createElement('div');
            amount.className = 'amount';
            amount.textContent = `${logo.amount} SOL`;
            
            logoItem.appendChild(img);
            logoItem.appendChild(position);
            logoItem.appendChild(amount);
            
            logoGrid.appendChild(logoItem);
        });
    } catch (error) {
        console.error('Error loading logos:', error);
        if (statusMessage) {
            statusMessage.textContent = 'Error loading logos. Please try again later.';
            statusMessage.className = 'status-message error';
        }
    }
}

// Setup wallet connection
function setupWalletConnection() {
    if (!connectWalletBtn) return;

    connectWalletBtn.addEventListener('click', async () => {
        try {
            if (!window.solana || !window.solana.isPhantom) {
                window.open('https://phantom.app/', '_blank');
                throw new Error('Phantom wallet is not installed!');
            }

            const resp = await window.solana.connect();
            wallet = resp.publicKey.toString();
            
            walletStatus.textContent = `Connected: ${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
            walletStatus.className = 'wallet-status success';
            
            // Enable submit button if file is selected
            if (selectedFile) {
                submitButton.disabled = false;
            }
        } catch (error) {
            console.error('Wallet connection error:', error);
            walletStatus.textContent = error.message;
            walletStatus.className = 'wallet-status error';
        }
    });
}

// Setup file upload
function setupFileUpload() {
    if (!logoFileInput || !filePreview) return;

    logoFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            statusMessage.textContent = 'Please select an image file';
            statusMessage.className = 'status-message error';
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            statusMessage.textContent = 'File size must be less than 5MB';
            statusMessage.className = 'status-message error';
            return;
        }

        selectedFile = file;
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            filePreview.innerHTML = `<img src="${e.target.result}" alt="Logo preview">`;
        };
        reader.readAsDataURL(file);

        // Enable submit button if wallet is connected
        if (wallet) {
            submitButton.disabled = false;
        }

        statusMessage.textContent = '';
        statusMessage.className = 'status-message';
    });
}

// Setup form submission
function setupFormSubmission() {
    if (!submitButton) return;

    submitButton.addEventListener('click', async () => {
        if (!wallet || !selectedFile) {
            statusMessage.textContent = 'Please connect wallet and select a logo';
            statusMessage.className = 'status-message error';
            return;
        }

        try {
            submitButton.disabled = true;
            statusMessage.textContent = 'Creating transaction...';
            statusMessage.className = 'status-message';

            // Get current price
            const priceResponse = await fetch(`${window.API_URL}/api/logo/price`);
            const priceData = await priceResponse.json();
            const amount = priceData.price;

            // Create transaction
            const response = await fetch(`${window.API_URL}/api/logo/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    wallet_address: wallet,
                    amount: amount
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create transaction');
            }

            // Sign and send transaction
            const transaction = solanaWeb3.Transaction.from(Buffer.from(data.transaction, 'base64'));
            const signed = await window.solana.signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signed.serialize());
            
            statusMessage.textContent = 'Confirming transaction...';
            
            // Wait for confirmation
            await connection.confirmTransaction(signature);
            
            // Upload logo
            const formData = new FormData();
            formData.append('logo', selectedFile);
            formData.append('signature', signature);
            
            const uploadResponse = await fetch(`${window.API_URL}/api/logo/confirm`, {
                method: 'POST',
                body: formData
            });
            
            if (!uploadResponse.ok) {
                throw new Error('Failed to upload logo');
            }

            statusMessage.textContent = 'Logo submitted successfully!';
            statusMessage.className = 'status-message success';
            
            // Reset form
            logoFileInput.value = '';
            filePreview.innerHTML = '';
            selectedFile = null;
            submitButton.disabled = true;
            
            // Reload data
            loadPriceInfo();
            loadLogos();
            
        } catch (error) {
            console.error('Submission error:', error);
            statusMessage.textContent = error.message || 'Failed to submit logo';
            statusMessage.className = 'status-message error';
            submitButton.disabled = false;
        }
    });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    setupWalletConnection();
    setupFileUpload();
    setupFormSubmission();
    loadPriceInfo();
    loadLogos();
}); 