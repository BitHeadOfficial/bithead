// Initialize Solana connection
const connection = new solanaWeb3.Connection(window.env.SOLANA_RPC_URL);

// Fibonacci sequence for pricing
const getFibonacciPrice = (n) => {
    if (n <= 0) return 0;
    if (n === 1) return 0.01; // First submission is 0.01 SOL
    
    let a = 0.01, b = 0.02; // Start with 0.01 and 0.02
    for (let i = 2; i < n; i++) {
        [a, b] = [b, a + b];
    }
    return b;
};

// DOM Elements
const connectWalletBtn = document.getElementById('connectWallet');
const walletStatus = document.getElementById('walletStatus');
const logoForm = document.getElementById('logoForm');
const logoFile = document.getElementById('logoFile');
const filePreview = document.getElementById('filePreview');
const submitLogoBtn = document.getElementById('submitLogo');
const submissionStatus = document.getElementById('submissionStatus');
const currentPriceSpan = document.getElementById('currentPrice');
const totalSubmissionsSpan = document.getElementById('totalSubmissions');
const logoGrid = document.getElementById('logoGrid');

let wallet = null;
let totalSubmissions = 0;

// Load total submissions and update price
async function loadTotalSubmissions() {
    try {
        const response = await fetch('/api/founders/total');
        const data = await response.json();
        if (data.success) {
            totalSubmissions = data.total;
            totalSubmissionsSpan.textContent = totalSubmissions;
            currentPriceSpan.textContent = getFibonacciPrice(totalSubmissions + 1).toFixed(2);
        }
    } catch (error) {
        console.error('Error loading total submissions:', error);
    }
}

// Connect wallet
async function connectWallet() {
    try {
        if (!window.solana) {
            throw new Error('Solana wallet not found! Please install Phantom wallet.');
        }

        const resp = await window.solana.connect();
        wallet = resp.publicKey;
        
        connectWalletBtn.textContent = `${wallet.toString().slice(0, 4)}...${wallet.toString().slice(-4)}`;
        connectWalletBtn.classList.add('connected');
        walletStatus.textContent = 'Wallet connected!';
        walletStatus.className = 'status success';
        
        submitLogoBtn.disabled = false;
    } catch (error) {
        console.error('Error connecting wallet:', error);
        walletStatus.textContent = error.message;
        walletStatus.className = 'status error';
    }
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        submissionStatus.textContent = 'Please select a valid image file (JPG, PNG, or GIF).';
        submissionStatus.className = 'status error';
        logoFile.value = ''; // Clear the file input
        return;
    }

    // Check file extension
    const ext = file.name.split('.').pop().toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif'];
    if (!allowedExtensions.includes(ext)) {
        submissionStatus.textContent = 'Invalid file extension. Only JPG, PNG, and GIF are allowed.';
        submissionStatus.className = 'status error';
        logoFile.value = ''; // Clear the file input
        return;
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        submissionStatus.textContent = 'File size must be less than 5MB.';
        submissionStatus.className = 'status error';
        logoFile.value = ''; // Clear the file input
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        filePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        submissionStatus.textContent = ''; // Clear any previous error messages
        submissionStatus.className = 'status';
    };
    reader.readAsDataURL(file);
}

// Submit logo
async function submitLogo(event) {
    event.preventDefault();
    
    if (!wallet) {
        submissionStatus.textContent = 'Please connect your wallet first.';
        submissionStatus.className = 'status error';
        return;
    }

    const file = logoFile.files[0];
    if (!file) {
        submissionStatus.textContent = 'Please select a logo file.';
        submissionStatus.className = 'status error';
        return;
    }

    try {
        submissionStatus.textContent = 'Processing submission...';
        submissionStatus.className = 'status';

        // Calculate price
        const price = getFibonacciPrice(totalSubmissions + 1);
        
        // Create transaction
        const transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: wallet,
                toPubkey: new solanaWeb3.PublicKey(window.env.FOUNDERS_WALLET_ADDRESS),
                lamports: price * solanaWeb3.LAMPORTS_PER_SOL
            })
        );

        // Sign and send transaction
        const signature = await window.solana.signAndSendTransaction(transaction);
        await connection.confirmTransaction(signature.signature);

        // Upload logo
        const formData = new FormData();
        formData.append('logo', file);
        formData.append('wallet', wallet.toString());
        formData.append('signature', signature.signature);

        const response = await fetch('/api/founders/submit', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (data.success) {
            submissionStatus.textContent = 'Logo submitted successfully!';
            submissionStatus.className = 'status success';
            logoForm.reset();
            filePreview.innerHTML = '';
            await loadTotalSubmissions();
            await loadLogos();
        } else {
            throw new Error(data.error || 'Failed to submit logo');
        }
    } catch (error) {
        console.error('Error submitting logo:', error);
        submissionStatus.textContent = error.message;
        submissionStatus.className = 'status error';
    }
}

// Load logos
async function loadLogos() {
    try {
        const response = await fetch('/api/founders/logos');
        const data = await response.json();
        
        if (data.success) {
            logoGrid.innerHTML = data.logos.map(logo => `
                <div class="logo-item">
                    <img src="${logo.url}" alt="${logo.wallet}">
                    <div class="timestamp">${new Date(logo.timestamp).toLocaleDateString()}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading logos:', error);
    }
}

// Event Listeners
connectWalletBtn.addEventListener('click', connectWallet);
logoFile.addEventListener('change', handleFileSelect);
logoForm.addEventListener('submit', submitLogo);

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadTotalSubmissions();
    await loadLogos();
}); 