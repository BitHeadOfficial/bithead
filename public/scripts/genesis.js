// genesis.js
// API configuration
const API_URL = window.API_URL || 'https://bithead.onrender.com/api';

// Constants
const PAYMENT_AMOUNT = 0.01; // 0.01 SOL
const RECIPIENT_ADDRESS = '5Zd2EiC7S2DaT5mQyC1etYmusNPyEQtHDgojdf5oLHLE'; // Production recipient wallet
const TRANSACTION_TIMEOUT = 30000; // 30 seconds timeout for transaction confirmation

// Use global solanaWeb3 object
const { Connection, Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } = window.solanaWeb3 || {};

// Initialize Solana connection
let connection;

// Token management functions
const TOKEN_KEYS = {
    WALLET: 'bithead_wallet_token',
    PASSWORD: 'bithead_password_token',
    ACCESS_TYPE: 'bithead_access_type'
};

function storeToken(token, type) {
    if (type === 'wallet') {
        localStorage.setItem(TOKEN_KEYS.WALLET, token);
    } else if (type === 'password') {
        localStorage.setItem(TOKEN_KEYS.PASSWORD, token);
    }
    localStorage.setItem(TOKEN_KEYS.ACCESS_TYPE, type);
}

function getStoredToken() {
    const type = localStorage.getItem(TOKEN_KEYS.ACCESS_TYPE);
    if (type === 'wallet') {
        return localStorage.getItem(TOKEN_KEYS.WALLET);
    } else if (type === 'password') {
        return localStorage.getItem(TOKEN_KEYS.PASSWORD);
    }
    return null;
}

function clearTokens() {
    localStorage.removeItem(TOKEN_KEYS.WALLET);
    localStorage.removeItem(TOKEN_KEYS.PASSWORD);
    localStorage.removeItem(TOKEN_KEYS.ACCESS_TYPE);
}

// Initialize GSAP
function initializeGSAP() {
    return new Promise((resolve) => {
        if (typeof gsap !== 'undefined') {
            gsap.registerPlugin(ScrollTrigger);
            console.log('GSAP initialized successfully');
            resolve(true);
        } else {
            // Wait for GSAP to load
            const checkGSAP = setInterval(() => {
                if (typeof gsap !== 'undefined') {
                    clearInterval(checkGSAP);
                    gsap.registerPlugin(ScrollTrigger);
                    console.log('GSAP initialized successfully after waiting');
                    resolve(true);
                }
            }, 100);

            // Timeout after 5 seconds
            setTimeout(() => {
                clearInterval(checkGSAP);
                console.error('GSAP failed to load after timeout');
                resolve(false);
            }, 5000);
        }
    });
}

// Helper function to unlock content - moved outside DOMContentLoaded
function unlockContent() {
    console.log('Unlocking content...');
    const secretSection = document.getElementById('secretSection');
    const protectedContent = document.querySelectorAll('.protected-content');
    const fadeOverlay = document.querySelector('.fade-to-paywall');

    if (!secretSection) {
        console.error('Secret section not found');
        return;
    }

        // Remove hidden and secret classes
        secretSection.classList.remove('hidden', 'secret');
        protectedContent.forEach(content => {
            content.classList.remove('hidden', 'secret');
            content.style.display = 'block';
        });

        // Hide fade overlay
        if (fadeOverlay) {
            fadeOverlay.style.opacity = '0';
        }

        // Animate the content reveal with fade and scale
    if (typeof gsap !== 'undefined') {
        gsap.fromTo(secretSection, {
            opacity: 0,
            scale: 0.96
        }, {
            opacity: 1,
            scale: 1,
            duration: 1.1,
            ease: 'power2.out'
        });

        // Animate each protected content section
        protectedContent.forEach((content, index) => {
            gsap.fromTo(content, {
                opacity: 0,
                y: 30,
                scale: 0.96
            }, {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 1,
                delay: 0.2 + index * 0.15,
                ease: 'power2.out'
            });
        });
    } else {
        // Fallback if GSAP is not available
        secretSection.style.opacity = '1';
        secretSection.style.transform = 'scale(1)';
        protectedContent.forEach(content => {
            content.style.opacity = '1';
            content.style.transform = 'translateY(0) scale(1)';
        });
    }

    console.log('Content unlocked successfully');
}

// Update the showStatus function to always show messages
function showStatus(message, type) {
    const unlockStatus = document.getElementById('unlockStatus');
    if (unlockStatus) {
        unlockStatus.textContent = message;
        unlockStatus.className = `status ${type}`;
        unlockStatus.style.display = 'block';
        // Only auto-hide error messages
        if (type === 'error') {
            setTimeout(() => {
                unlockStatus.textContent = '';
                unlockStatus.className = 'status';
            }, 5000); // Increased timeout for error messages
        }
    }
}

// Update the button state management
function updateWalletButtonState() {
    console.log('Updating wallet button state...');
    const solanaPayBtn = document.getElementById('solanaPayBtn');
    const accessType = localStorage.getItem(TOKEN_KEYS.ACCESS_TYPE);

    if (solanaPayBtn) {
        // Always show "Sacrifice 0.01 SOL" text
        solanaPayBtn.textContent = 'Sacrifice 0.01 SOL';
        solanaPayBtn.onclick = handleSolanaPayment;
    }
}

// Update wallet connection management
function setupWalletConnection() {
    // Create wallet connect button if it doesn't exist
    let walletConnectBtn = document.getElementById('walletConnectBtn');
    if (!walletConnectBtn) {
        walletConnectBtn = document.createElement('button');
        walletConnectBtn.id = 'walletConnectBtn';
        walletConnectBtn.className = 'wallet-connect-btn';
        walletConnectBtn.innerHTML = '<i class="fas fa-wallet"></i> Connect Wallet';
        
        // Add to body for fixed positioning
        document.body.appendChild(walletConnectBtn);
    }

    // Update button state based on connection status
    function updateWalletButtonState() {
        const wallet = window.phantom?.solana || window.solana;
        if (wallet?.isConnected) {
            const publicKey = wallet.publicKey.toString();
            walletConnectBtn.innerHTML = `<i class="fas fa-wallet"></i> ${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
            walletConnectBtn.classList.add('connected');
            
            // Check for access when wallet is connected
            checkWalletAccessOnConnect(publicKey);
            
            // Update whitelist form
            const form = document.getElementById('whitelistForm');
            if (form) {
                const walletInput = document.getElementById('walletAddress');
                if (walletInput) {
                    walletInput.value = publicKey;
                }
            }
        } else {
            walletConnectBtn.innerHTML = '<i class="fas fa-wallet"></i> Connect Wallet';
            walletConnectBtn.classList.remove('connected');
        }
    }

    // Add click handler
    walletConnectBtn.addEventListener('click', async () => {
        try {
            const wallet = window.phantom?.solana || window.solana;
            if (!wallet?.isPhantom) {
                showStatus('Please install Phantom wallet to proceed', 'error');
                return;
            }

            if (!wallet.isConnected) {
                showStatus('Connecting to wallet...', 'info');
                await wallet.connect();
                showStatus('Wallet connected successfully', 'success');
                // Clear success message after 2 seconds
                setTimeout(() => {
                    const unlockStatus = document.getElementById('unlockStatus');
                    if (unlockStatus && unlockStatus.className.includes('success')) {
                        unlockStatus.textContent = '';
                        unlockStatus.className = 'status';
                    }
                }, 2000);
            } else {
                await wallet.disconnect();
                showStatus('Wallet disconnected', 'info');
                // Clear info message after 2 seconds
                setTimeout(() => {
                    const unlockStatus = document.getElementById('unlockStatus');
                    if (unlockStatus && unlockStatus.className.includes('info')) {
                        unlockStatus.textContent = '';
                        unlockStatus.className = 'status';
                    }
                }, 2000);
            }
            updateWalletButtonState();
        } catch (error) {
            console.error('Wallet connection error:', error);
            showStatus('Failed to connect wallet: ' + error.message, 'error');
        }
    });

    // Listen for wallet connection changes
    const wallet = window.phantom?.solana || window.solana;
    if (wallet) {
        wallet.on('connect', () => {
            console.log('Wallet connected');
            updateWalletButtonState();
        });

        wallet.on('disconnect', () => {
            console.log('Wallet disconnected');
            updateWalletButtonState();
        });

        wallet.on('accountChanged', (publicKey) => {
            console.log('Account changed:', publicKey.toString());
            updateWalletButtonState();
        });
    }

    // Initial state
    updateWalletButtonState();
}

// Update automatic wallet access check with rate limiting
async function checkWalletAccessOnConnect(publicKey) {
    console.log('Checking wallet access for:', publicKey);
    
    try {
        const response = await fetch(`${API_URL}/api/check-access-wallet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicKey })
        });

        if (!response.ok) {
            if (response.status === 429) {
                console.log('Rate limited, skipping wallet check');
                return;
            }
            throw new Error('Failed to check wallet access');
        }

        const data = await response.json();
        console.log('Wallet access check response:', data);

        // Check if user has already paid 0.01 SOL or more
        if (data.hasAccess || (data.totalSent && data.totalSent >= 0.01 * LAMPORTS_PER_SOL)) {
            if (data.token) {
                storeToken(data.token, 'wallet');
            }
            showStatus('Wallet access verified! Unlocking content...', 'success');
            unlockContent();
            // Clear success message after 2 seconds
            setTimeout(() => {
                const unlockStatus = document.getElementById('unlockStatus');
                if (unlockStatus && unlockStatus.className.includes('success')) {
                    unlockStatus.textContent = '';
                    unlockStatus.className = 'status';
                }
            }, 2000);
        } else {
            console.log('No wallet access found or insufficient payment');
        }
    } catch (error) {
        console.error('Wallet access check error:', error);
        // Don't show error status for automatic checks
    }
}

// Update API endpoint paths
async function checkWhitelistStatus(walletAddress) {
    try {
        const response = await fetch(`${API_URL}/api/whitelist/check?walletAddress=${encodeURIComponent(walletAddress)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        return data.isWhitelisted;
    } catch (error) {
        console.error('Error checking whitelist status:', error);
        return false;
    }
}

// Update the whitelist form handling
function setupWhitelistForm() {
    const form = document.getElementById('whitelistForm');
    const statusDiv = document.getElementById('whitelistStatus');
    const successDiv = document.getElementById('whitelistSuccess');
    const walletInput = document.getElementById('walletAddress');
    const submitButton = form?.querySelector('button[type="submit"]');

    if (!form || !walletInput || !submitButton) return;

    let isSubmitting = false; // Add a flag to prevent multiple submissions

    // Make wallet input read-only but keep original styling
    walletInput.readOnly = true;
    // Remove the opacity and cursor changes to keep original styling
    // walletInput.style.opacity = '0.7';
    // walletInput.style.cursor = 'not-allowed';

    // Add styles to maintain original form appearance
    const style = document.createElement('style');
    style.textContent = `
        #whitelistForm {
            max-width: 600px;
            margin: 2rem auto;
            padding: 2rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        #whitelistForm input {
            width: 100%;
            padding: 12px;
            margin: 8px 0;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            color: #fff;
            font-size: 16px;
        }

        #whitelistForm input:focus {
            outline: none;
            border-color: #00ff88;
            box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.2);
        }

        #whitelistForm button[type="submit"] {
            width: 100%;
            padding: 12px;
            margin-top: 1rem;
            background: linear-gradient(45deg, #00ff88, #00b8ff);
            border: none;
            border-radius: 6px;
            color: #000;
            font-weight: 600;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        #whitelistForm button[type="submit"]:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
        }

        #whitelistForm button[type="submit"]:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
        }

        #whitelistStatus {
            margin-top: 1rem;
            padding: 12px;
            border-radius: 6px;
            text-align: center;
            font-weight: 500;
        }

        #whitelistStatus.error {
            background: rgba(255, 0, 0, 0.1);
            color: #ff4444;
        }

        #whitelistSuccess {
            display: none;
            margin: 2rem auto;
            padding: 2rem;
            background: rgba(0, 255, 136, 0.1);
            border: 1px solid #00ff88;
            border-radius: 12px;
            text-align: center;
            color: #00ff88;
        }

        #whitelistSuccess.visible {
            display: block;
            animation: fadeIn 0.5s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
            #whitelistForm {
                margin: 1rem;
                padding: 1.5rem;
            }
        }
    `;
    document.head.appendChild(style);

    // Update form visibility based on wallet connection
    async function updateWhitelistForm() {
        if (window.solana && window.solana.isConnected) {
            const publicKey = window.solana.publicKey.toString();
            walletInput.value = publicKey;

            // Check if already whitelisted
            const isWhitelisted = await checkWhitelistStatus(publicKey);
            if (isWhitelisted) {
                form.style.display = 'none';
                successDiv.style.display = 'block';
                successDiv.classList.add('visible');
                statusDiv.textContent = '';
            } else {
                form.style.display = 'block';
                successDiv.style.display = 'none';
                successDiv.classList.remove('visible');
            }
        } else {
            form.style.display = 'none';
            successDiv.style.display = 'none';
            successDiv.classList.remove('visible');
            walletInput.value = '';
        }
    }

    // Update form submission handler
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (isSubmitting) {
            console.log('Whitelist form already submitting, ignoring.');
            return; // Prevent multiple submissions if already submitting
        }

        isSubmitting = true; // Set flag at the start of submission

        // Disable form elements immediately on submission
        const formElements = form.querySelectorAll('input, button');
        formElements.forEach(el => el.disabled = true);

        if (!window.solana || !window.solana.isConnected) {
            showStatus('Please connect your wallet first', 'error');
            // Re-enable form elements on error before fetch and reset flag
            formElements.forEach(el => el.disabled = false);
            isSubmitting = false;
            return;
        }

        statusDiv.textContent = '';
        const name = document.getElementById('whitelistName').value;
        const email = document.getElementById('whitelistEmail').value;
        const wallet = window.solana.publicKey.toString();

        try {
            const res = await fetch(`${API_URL}/api/whitelist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, walletAddress: wallet })
            });

            // Check for non-200 status codes
            if (!res.ok) {
                const errorData = await res.json(); // Attempt to parse JSON error
                if (errorData.error) {
                    if (errorData.error.includes('UNIQUE constraint failed')) {
                        statusDiv.textContent = 'You are already whitelisted with this email or wallet address.';
                    } else {
                        statusDiv.textContent = errorData.error;
                    }
                } else {
                    statusDiv.textContent = `Error: ${res.status} ${res.statusText}`; // Generic error for non-JSON responses
                }
            } else { // Success
            const data = await res.json();
            if (data.success) {
                form.style.display = 'none';
                successDiv.style.display = 'block';
                successDiv.classList.add('visible');
                statusDiv.textContent = '';
                    localStorage.setItem('whitelist_submitted', '1');
                    // No need to re-enable form or reset flag on success, form is hidden
                    return; // Exit after successful submission
                } else {
                     // This part might be redundant if backend always sends error in !res.ok
                    // but keep as a fallback for non-success data with 200 status
                    if (data.error && data.error.includes('UNIQUE constraint failed')) {
                        statusDiv.textContent = 'You are already whitelisted with this email or wallet address.';
            } else {
                statusDiv.textContent = data.error || 'Failed to join whitelist.';
                    }
                }
            }
        } catch (err) {
            console.error('Whitelist submission fetch error:', err);
            statusDiv.textContent = 'An unexpected error occurred. Please try again.';
        } finally {
            // Always re-enable form elements and reset flag on error or catch
            if (form.style.display !== 'none') { // Only re-enable if form is still visible
                formElements.forEach(el => el.disabled = false);
            }
            isSubmitting = false; // Reset flag
        }
    });

    // Update wallet connection handler
    if (window.solana) {
        window.solana.on('connect', () => {
            updateWhitelistForm();
        });

        window.solana.on('disconnect', () => {
            updateWhitelistForm();
        });
    }

    // Initial form state
    updateWhitelistForm();
}

// Initialize Solana
async function initSolana() {
    console.log('Initializing Solana...');
    try {
        if (typeof solanaWeb3 === 'undefined') {
            throw new Error('Solana web3.js not loaded');
        }
        
        // Initialize connection
        connection = new Connection(window.SOLANA_RPC_URL);
        console.log('Solana connection initialized');
        
        // Check for Phantom wallet with a more robust detection
        const checkPhantomWallet = () => {
            if (window.phantom?.solana?.isPhantom || window.solana?.isPhantom) {
                console.log('Phantom wallet detected');
                return true;
            }
            return false;
        };

        // Initial check
        if (checkPhantomWallet()) {
            // Set up event listeners for wallet changes
            window.addEventListener('phantomWalletChanged', () => {
                console.log('Phantom wallet state changed');
                updateWalletButtonState();
            });

            // Check if already connected
            if (window.solana?.isConnected) {
                console.log('Wallet already connected:', window.solana.publicKey.toString());
                await checkWalletAccessOnConnect(window.solana.publicKey.toString());
            }
        } else {
            console.warn('Phantom wallet not detected');
            // Set up polling for wallet detection
            const checkInterval = setInterval(() => {
                if (checkPhantomWallet()) {
                    console.log('Phantom wallet detected after polling');
                    clearInterval(checkInterval);
                    updateWalletButtonState();
                }
            }, 1000); // Check every second

            // Clear interval after 30 seconds to prevent infinite polling
            setTimeout(() => clearInterval(checkInterval), 30000);
        }
        
        return true;
    } catch (error) {
        console.error('Failed to initialize Solana:', error);
        return false;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // Initialize GSAP
    const gsapInitialized = await initializeGSAP();
    if (!gsapInitialized) {
        console.error('Failed to initialize GSAP, some animations may not work');
    }

    // Initialize Solana first
    const solanaInitialized = await initSolana();
    if (!solanaInitialized) {
        console.error('Failed to initialize Solana, wallet features will not work');
    }

    // Initialize other components
    setupWalletConnection();
    setupWhitelistForm();
    setupPaymentSection();
    initCountdown();

    // DOM Elements
    const secretPassword = document.getElementById('secretPassword');
    const unlockBtn = document.getElementById('unlockBtn');
    const unlockStatus = document.getElementById('unlockStatus');
    const secretSection = document.getElementById('secretSection');
    const logoutBtn = document.getElementById('logoutBtn');
    const panel = document.querySelector(".unlock-panel");
    const solanaPayBtn = document.getElementById('solanaPayBtn');
    const form = document.getElementById('whitelistForm');
    const statusDiv = document.getElementById('whitelistStatus');
    const successDiv = document.getElementById('whitelistSuccess');
    const mintCountdown = document.getElementById('mintCountdown');
    const hamburger = document.querySelector('.hamburger');
    const navContainer = document.querySelector('.nav-container');
    const donationWarningContainer = document.getElementById('donationWarningContainer');
    const donationAgreeCheckbox = document.getElementById('donationAgreeCheckbox');
  
    // Mobile navigation
    if (hamburger && navContainer) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navContainer.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!navContainer.contains(e.target) && !hamburger.contains(e.target)) {
                hamburger.classList.remove('active');
                navContainer.classList.remove('active');
            }
        });
    }

    // Hide all protected content initially
    const protectedContent = document.querySelectorAll('.protected-content');
    protectedContent.forEach(content => {
        content.style.display = 'none';
        content.classList.add('hidden', 'secret');
    });
  
    // Show unlock panel with a slight delay
    if (panel) {
        setTimeout(() => {
            panel.classList.add("visible");
            console.log('Unlock panel made visible');
        }, 500);
    } else {
        console.error('Unlock panel not found in DOM');
    }
  
    // 2) Animate teaser bullets
    if (gsapInitialized) {
        gsap.from(".drama-list li", {
            y: 30,
            opacity: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: "power3.out",
        });
    }
  
    // 3) Pillars intro fade‑in on scroll
    gsap
      .timeline({
        scrollTrigger: { trigger: ".pillars-intro", start: "top 85%" },
      })
      .to(".pillars-intro-title", {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power2.out",
      })
      .to(
        ".pillars-intro-text",
        { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
        "-=0.4"
      );
  
    // 4) Pillar boxes animate on scroll
    gsap.from(".pillar-box", {
      scrollTrigger: { trigger: ".pillars", start: "top 80%" },
      y: 30,
      opacity: 0,
      duration: 0.8,
      stagger: 0.1,
      ease: "power3.out",
    });
  
    // 5) Unlock logic
    unlockBtn.addEventListener("click", async () => {
      const password = secretPassword.value;
      console.log('Unlock button clicked with password:', password);
      
      try {
        console.log('Sending unlock request to:', `${API_URL}/api/unlock`);
        const response = await fetch(`${API_URL}/api/unlock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password }),
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Unlock response:', data);

        if (data.success) {
          console.log('Unlock successful, storing token');
                storeToken(data.token, 'password');
          if (unlockStatus) {
            unlockStatus.textContent = 'Access granted. Content Unlocked!';
          unlockStatus.className = 'status success';
            unlockStatus.style.display = 'block';
          }
          loadProtectedContent();
          // Hide and reset donation warning/checkbox if open
          if (donationWarningContainer) {
            donationWarningContainer.style.display = 'none';
          }
          if (donationAgreeCheckbox) {
            donationAgreeCheckbox.checked = false;
          }
          if (solanaPayBtn) {
            solanaPayBtn.disabled = false;
            solanaPayBtn.style.opacity = 1;
          }
        } else {
          console.log('Unlock failed:', data.error);
          unlockStatus.textContent = 'Wrong Password. Access denied!';
          unlockStatus.className = 'status error';
          unlockStatus.style.display = 'block';
          secretPassword.value = '';
        }
      } catch (error) {
        console.error('Error during unlock:', error);
        unlockStatus.textContent = 'Server error. Please try again later.';
        unlockStatus.className = 'status error';
      }
    });
  
    // 6) Seal the vault
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        gsap.to(secretSection, {
          opacity: 0,
          y: 20,
          duration: 0.4,
          ease: "power2.in",
          onComplete: () => {
            secretSection.classList.add('secret', 'hidden');
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        });
            clearTokens();
        unlockStatus.textContent = '';
        unlockStatus.className = 'status';
        donationWarningContainer.style.display = 'none';
        secretPassword.value = '';
      });
    }
  
    // 7) NFT parallax‑tilt
    const hero = document.getElementById("nftHero");
    const img = hero.querySelector(".nft-image");
    let rafId = null;
    let targetRotateX = 0, targetRotateY = 0;
    let currentRotateX = 0, currentRotateY = 0;
    const maxDeg = 12;

    function animateParallax() {
      currentRotateX += (targetRotateX - currentRotateX) * 0.15;
      currentRotateY += (targetRotateY - currentRotateY) * 0.15;
      img.style.transform = `rotateX(${-currentRotateX}deg) rotateY(${currentRotateY}deg)`;
      rafId = requestAnimationFrame(animateParallax);
    }

    hero.addEventListener("mousemove", (e) => {
      const { left, top, width, height } = hero.getBoundingClientRect();
      const x = (e.clientX - left) / width - 0.5;
      const y = (e.clientY - top) / height - 0.5;
      targetRotateX = Math.max(-maxDeg, Math.min(maxDeg, y * 2 * maxDeg));
      targetRotateY = Math.max(-maxDeg, Math.min(maxDeg, x * 2 * maxDeg));
      if (!rafId) animateParallax();
    });

    hero.addEventListener("mouseleave", () => {
      targetRotateX = 0;
      targetRotateY = 0;
      if (!rafId) animateParallax();
    });
  
    // Check for existing access
    const paymentToken = localStorage.getItem('paymentToken');
    if (paymentToken) {
        checkAccessStatus(paymentToken);
    }

    // Whitelist form submission
    if (localStorage.getItem('whitelist_submitted')) {
        form.style.display = 'none';
        successDiv.style.display = 'block';
        successDiv.classList.add('visible');
    } else {
        successDiv.style.display = 'none';
        successDiv.classList.remove('visible');
    }

    // Countdown timer
    initCountdown();

    // Update Solana payment button initialization
    if (solanaPayBtn) {
        console.log('Initializing Solana payment button...');
        solanaPayBtn.textContent = 'Sacrifice 0.01 SOL';
        solanaPayBtn.onclick = async (e) => {
            e.preventDefault();
            console.log('Payment button clicked');
            await handleSolanaPayment();
        };
        
        // Update the payment description text
        const paymentDescription = document.querySelector('.payment-description');
        if (paymentDescription) {
            paymentDescription.textContent = 'Support the cause by sending 0.01 SOL to unlock exclusive content.';
        }
            } else {
        console.error('Solana payment button not found in DOM');
    }

    // Check for existing access
    const storedToken = getStoredToken();
    if (storedToken) {
        console.log('Found existing token, checking access...');
        loadProtectedContent();
    }

    // Check if already unlocked
    if (localStorage.getItem('genesisUnlocked')) {
        unlockContent();
    }

    // Milestone panel interaction
    const milestonePanel = document.getElementById('milestone-panel');
    const milestoneTitle = document.getElementById('milestone-title');
    const milestoneDescription = document.getElementById('milestone-description');
    const milestones = document.querySelectorAll('.milestone');

    const milestoneData = {
        1: {
            title: "Phase 1: Community Building",
            description: "Focus on establishing our core community, building a strong online presence, and generating initial excitement for the project."
        },
        2: {
            title: "Current Phase: Whitelist & Prep",
            description: "Opening the whitelist, finalizing smart contracts, and preparing all technical aspects for a smooth and successful minting event."
        },
        3: {
            title: "Phase 3: The Mint",
            description: "The official launch and minting of the Genesis NFT collection. This is the moment our community can secure their unique digital assets."
        },
        4: {
            title: "Phase 4: Utility & Expansion",
            description: "Post-mint activities including NFT reveal, development of utility features (like the AI Branding Forge), collaborations, and planning for future project growth."
        }
    };

    milestones.forEach(milestone => {
        milestone.addEventListener('click', () => {
            const milestoneNum = milestone.getAttribute('data-milestone');
            const data = milestoneData[milestoneNum];
            
          if (data) {
                milestoneTitle.textContent = data.title;
                milestoneDescription.textContent = data.description;
                milestonePanel.style.display = 'flex';
                
                // Scroll to panel with smooth animation
                milestonePanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
      });
    });

    // Close milestone panel when clicking outside
    document.addEventListener('click', (e) => {
        if (!milestonePanel.contains(e.target) && !e.target.closest('.milestone')) {
            milestonePanel.style.display = 'none';
        }
    });

    // Initialize password unlock
    handlePasswordUnlock();
});
  
// Load protected content
async function loadProtectedContent() {
    try {
        console.log('Loading protected content...');
        
        const token = getStoredToken();
        if (!token) {
            console.log('No token found');
            throw new Error('No access token found');
        }

        console.log('Verifying access with token...');
        const response = await fetch(`${API_URL}/api/check-access`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.log('Access verification failed:', response.status);
            clearTokens();
            throw new Error('Failed to verify access');
        }

        const data = await response.json();
        console.log('Access check response:', data);

        if (data.hasAccess) {
            // Store the token type for future reference
            storeToken(token, data.accessType);

        // Call unlockContent for consistent animation behavior
        unlockContent();
        
        // Update status
        const unlockStatus = document.getElementById('unlockStatus');
        if (unlockStatus) {
                if (data.accessType === 'password') {
                    unlockStatus.textContent = 'Password access granted. Content Unlocked!';
                } else if (data.accessType === 'wallet') {
                    unlockStatus.textContent = `Wallet access granted. Total sent: ${data.totalSent / LAMPORTS_PER_SOL} SOL`;
                }
            unlockStatus.className = 'status success';
            unlockStatus.style.display = 'block';
        }
            
            // Update button states
            updateWalletButtonState();
        
        console.log('Protected content loaded successfully');
        } else {
            console.log('Access denied by server');
            clearTokens();
            throw new Error('Access denied');
        }
    } catch (error) {
        console.error('Error loading protected content:', error);
        const unlockStatus = document.getElementById('unlockStatus');
        if (unlockStatus) {
            unlockStatus.textContent = error.message || 'Error loading content. Please try again.';
            unlockStatus.className = 'status error';
        }
        // Reset button states on error
        updateWalletButtonState();
    }
}

// Update content in the DOM
function updateContent(data) {
    console.log('Updating content in DOM');
    // Update vault items
    const vaultGrid = document.querySelector('.vault-grid');
    console.log('Vault grid element:', vaultGrid);
    
    if (vaultGrid && data.vaultItems) {
        console.log('Updating vault items:', data.vaultItems);
        vaultGrid.innerHTML = data.vaultItems.map(item => `
            <article class="vault-item">
                <img src="${item.imageUrl}" alt="${item.title}" />
                <h3>${item.title}</h3>
                <p>${item.description}</p>
            </article>
        `).join('');
    }

    // Animate the vault items
    gsap.from(".vault-item", {
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out",
        delay: 0.6 // Wait for the section animation to complete
    });
}

// Initialize countdown timer
function initCountdown() {
    const countdownDate = new Date('2025-10-25T00:00:00+02:00').getTime();
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    if (!daysEl || !hoursEl || !minutesEl || !secondsEl) {
        console.warn('Countdown elements not found');
        return;
    }

    function updateCountdown() {
        const now = new Date().getTime();
        const distance = countdownDate - now;

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        daysEl.textContent = String(days).padStart(2, '0');
        hoursEl.textContent = String(hours).padStart(2, '0');
        minutesEl.textContent = String(minutes).padStart(2, '0');
        secondsEl.textContent = String(seconds).padStart(2, '0');
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// Start the countdown
initCountdown();

// Initialize GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

// Animate matrix cards
document.querySelectorAll('.matrix-card').forEach((card, index) => {
  gsap.from(card, {
    scrollTrigger: {
      trigger: card,
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    opacity: 0,
    y: 50,
    duration: 0.6,
    delay: index * 0.2
  });
});

// Animate timeline events
document.querySelectorAll('.timeline-event').forEach((event, index) => {
  gsap.from(event, {
    scrollTrigger: {
      trigger: event,
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    opacity: 0,
    x: index % 2 === 0 ? -50 : 50,
    duration: 0.8,
    delay: index * 0.3
  });
});

// Animate achievement cards
document.querySelectorAll('.achievement-card').forEach((card, index) => {
  gsap.from(card, {
    scrollTrigger: {
      trigger: card,
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    opacity: 0,
    scale: 0.8,
    duration: 0.6,
    delay: index * 0.15
  });
});

// Matrix card hover effect
document.querySelectorAll('.matrix-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
  });
  
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'none';
  });
});

// Timeline dot glow effect
document.querySelectorAll('.event-dot').forEach(dot => {
  gsap.to(dot, {
    boxShadow: '0 0 30px rgba(66, 150, 210, 0.8)',
    duration: 1.5,
    repeat: -1,
    yoyo: true
  });
});

// Achievement stats counter animation
document.querySelectorAll('.stat-value').forEach(stat => {
  const value = stat.textContent;
  
  // Extract numeric value and suffix
  let number;
  let suffix = '';
  let format = 'default';
  
  if (value.includes('K')) {
    number = parseFloat(value.replace('K', ''));
    suffix = 'K';
    format = 'thousands';
  } else if (value.includes('s')) {
    number = parseFloat(value.replace('s', ''));
    suffix = 's';
    format = 'seconds';
  } else if (value.includes('%')) {
    number = parseFloat(value.replace('%', ''));
    suffix = '%';
    format = 'percentage';
  } else if (value.includes('bit')) {
    number = parseInt(value.replace('-bit', ''));
    suffix = '-bit';
    format = 'bit';
  } else if (value.includes('/')) {
    // Handle 24/7 format
    suffix = value; // Keep the original value
    number = 24; // Start from 0 and count to 24
    format = 'ratio';
  } else {
    number = parseFloat(value.replace(/[^0-9.]/g, ''));
    suffix = value.replace(/[0-9.]/g, '').trim();
    format = 'default';
  }
  
  // Skip animation for non-numeric values
  if (isNaN(number)) return;
  
  gsap.from(stat, {
    scrollTrigger: {
      trigger: stat,
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    textContent: 0,
    duration: 2,
    ease: "power2.out",
    snap: { textContent: 0.001 },
    onUpdate: function() {
      const current = parseFloat(this.targets()[0].textContent);
      switch (format) {
        case 'seconds':
          // Format with 3 decimal places for seconds
          stat.textContent = current.toFixed(3) + suffix;
          break;
        case 'thousands':
          // Format with K suffix, no decimal places
          stat.textContent = Math.round(current) + suffix;
          break;
        case 'percentage':
          // Format with 1 decimal place for percentages
          stat.textContent = current.toFixed(1) + suffix;
          break;
        case 'bit':
          // Format without decimal places
          stat.textContent = Math.round(current) + suffix;
          break;
        case 'ratio':
          // Keep original format (24/7)
          stat.textContent = suffix;
          break;
        default:
          // Default formatting
          stat.textContent = Math.round(current) + suffix;
      }
    }
  });
});

function updateWhitelistTable(whitelist) {
    const tbody = document.getElementById('whitelistTableBody');
    tbody.innerHTML = whitelist.map(entry => `
        <tr>
            <td>${entry.email}</td>
            <td>${entry.wallet_address}</td>
            <td>${new Date(entry.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="removeFromWhitelist('${entry.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Update handleSolanaPayment to include more logging
async function handleSolanaPayment() {
    console.log('handleSolanaPayment called');
    const solanaPayBtn = document.getElementById('solanaPayBtn');
    if (!solanaPayBtn) {
        console.error('Solana pay button not found');
        return;
    }

    try {
        // Check if Phantom wallet is installed
        if (!window.solana || !window.solana.isPhantom) {
            console.error('Phantom wallet not detected');
            showStatus('Please install Phantom wallet to proceed', 'error');
            return;
        }

        // Check if wallet is connected
        if (!window.solana.isConnected) {
            console.error('Wallet not connected');
            showStatus('Please connect your wallet first', 'error');
            return;
        }

        const publicKey = window.solana.publicKey.toString();
        console.log('Initiating payment with public key:', publicKey);

        showStatus('Creating transaction...', 'info');
        solanaPayBtn.disabled = true;

        console.log('Sending payment request to server...');
        const response = await fetch(`${API_URL}/api/payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicKey, amount: PAYMENT_AMOUNT })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Payment request failed:', response.status, errorText);
            throw new Error(`Payment request failed: ${response.statusText}`);
        }

        const { transaction: serializedTransaction, token } = await response.json();
        console.log('Payment request successful, token received');
        
        // Convert base64 to Uint8Array using browser-compatible methods
        const transactionBytes = Uint8Array.from(atob(serializedTransaction), c => c.charCodeAt(0));
        const transaction = Transaction.from(transactionBytes);
        
        showStatus('Please sign the transaction in your wallet...', 'info');
        
        console.log('Signing and sending transaction...');
        const signed = await window.solana.signAndSendTransaction(transaction);
        console.log('Transaction signed and sent:', signed.signature);
        
        // Update status immediately after sending
        showStatus('Transaction sent! Waiting for confirmation...', 'info');
        
        // Add a small delay to allow the transaction to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Waiting for transaction confirmation with timeout:', TRANSACTION_TIMEOUT, 'ms');
        let confirmationAttempts = 0;
        const maxAttempts = 3;
        let confirmationSuccess = false;
        
        while (confirmationAttempts < maxAttempts && !confirmationSuccess) {
            try {
                console.log(`Confirmation attempt ${confirmationAttempts + 1}/${maxAttempts}`);
                
                // First check if the transaction is already confirmed
                const status = await connection.getSignatureStatus(signed.signature, {
                    searchTransactionHistory: true
                });
                console.log('Transaction status:', status);
                
                if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
                    console.log('Transaction already confirmed!');
                    confirmationSuccess = true;
                } else {
                    // If not confirmed, wait for confirmation
                    const confirmation = await Promise.race([
                        connection.confirmTransaction({
                            signature: signed.signature,
                            blockhash: transaction.recentBlockhash,
                            lastValidBlockHeight: status?.value?.lastValidBlockHeight
                        }, {
                            commitment: 'confirmed',
                            maxRetries: 5
                        }),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Transaction confirmation timeout - please check your wallet for status')), TRANSACTION_TIMEOUT)
                        )
                    ]);

                    if (confirmation.value.err) {
                        console.error('Transaction failed:', confirmation.value.err);
                        throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
                    }

                    console.log('Transaction confirmed successfully on attempt', confirmationAttempts + 1);
                    confirmationSuccess = true;
                }

                if (confirmationSuccess) {
                    // Store token and unlock content immediately after confirmation
                    console.log('Storing token and unlocking content...');
                    storeToken(token, 'wallet');
                    
                    // Force a check-access call to verify the token
                    try {
                        const verifyResponse = await fetch(`${API_URL}/api/check-access`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (verifyResponse.ok) {
                            const verifyData = await verifyResponse.json();
                            if (verifyData.hasAccess) {
                                console.log('Access verified, unlocking content...');
                                showStatus('Payment successful! Unlocking content...', 'success');
                                unlockContent();
                                // Update wallet button state
                                updateWalletButtonState();
                                break;
                            }
                        }
                    } catch (verifyError) {
                        console.error('Error verifying access:', verifyError);
                        // Continue with unlock anyway since we have the token
                        showStatus('Payment successful! Unlocking content...', 'success');
                        unlockContent();
                        updateWalletButtonState();
                    }
                }
                
            } catch (error) {
                confirmationAttempts++;
                console.log(`Confirmation attempt ${confirmationAttempts} failed:`, error.message);
                
                if (confirmationAttempts >= maxAttempts) {
                    // Even if confirmation fails, try to unlock content if we have the token
                    console.log('Attempting to unlock content despite confirmation failure...');
                    storeToken(token, 'wallet');
                    unlockContent();
                    updateWalletButtonState();
                    throw new Error('Transaction sent but confirmation status unclear. Content unlocked anyway - please check your wallet for status.');
                }
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        if (!confirmationSuccess) {
            // Try to unlock content anyway
            console.log('Attempting to unlock content despite confirmation failure...');
            storeToken(token, 'wallet');
            unlockContent();
            updateWalletButtonState();
            throw new Error('Transaction sent but confirmation status unclear. Content unlocked anyway - please check your wallet for status.');
        }

    } catch (error) {
        console.error('Transaction error:', error);
        if (error.message.includes('timeout') || error.message.includes('confirmation status unclear')) {
            showStatus('Transaction sent but taking longer than expected to confirm. Content unlocked anyway - please check your wallet for status.', 'warning');
        } else {
            showStatus('Transaction failed: ' + error.message, 'error');
        }
    } finally {
        solanaPayBtn.disabled = false;
    }
}

// Update the CSS for the wallet connect button
const style = document.createElement('style');
style.textContent = `
    .wallet-connect-btn {
        position: fixed;
        top: 100px; /* Increased space from top */
        right: 40px; /* Increased space from right */
        z-index: 1000;
        background: linear-gradient(45deg, #2196F3, #00BCD4);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .wallet-connect-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
    }

    .wallet-connect-btn.connected {
        background: linear-gradient(45deg, #4CAF50, #8BC34A);
    }

    .wallet-connect-btn i {
        font-size: 16px;
    }

    @media (max-width: 768px) {
        .wallet-connect-btn {
            top: 90px; /* Increased space from top on mobile */
            right: 20px; /* Increased space from right on mobile */
            padding: 6px 12px;
            font-size: 12px;
        }
    }
`;
document.head.appendChild(style);

function setupPaymentSection() {
    const paymentSection = document.getElementById('payment-section');
    if (!paymentSection) return;

    // Add donation acknowledgment text and checkbox
    const acknowledgmentDiv = document.createElement('div');
    acknowledgmentDiv.className = 'donation-acknowledgment';
    acknowledgmentDiv.innerHTML = `
        <div class="acknowledgment-text">
            <p>By proceeding with this payment, you acknowledge that:</p>
            <ul>
                <li>This is a voluntary donation</li>
                <li>You expect nothing in return</li>
                <li>This payment is non-refundable</li>
                <li>This is not an investment</li>
            </ul>
        </div>
        <div class="acknowledgment-checkbox">
            <input type="checkbox" id="donation-acknowledgment" required>
            <label for="donation-acknowledgment">I understand and agree to the above terms</label>
        </div>
    `;
    paymentSection.insertBefore(acknowledgmentDiv, paymentSection.firstChild);

    // Add styles for the acknowledgment section
    const style = document.createElement('style');
    style.textContent = `
        .donation-acknowledgment {
            margin-bottom: 2rem;
            padding: 1.5rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .acknowledgment-text {
            margin-bottom: 1rem;
            color: #e0e0e0;
        }
        .acknowledgment-text p {
            margin-bottom: 0.5rem;
            font-weight: 500;
        }
        .acknowledgment-text ul {
            list-style-type: none;
            padding-left: 1rem;
            margin: 0;
        }
        .acknowledgment-text li {
            margin: 0.5rem 0;
            position: relative;
            padding-left: 1.5rem;
        }
        .acknowledgment-text li:before {
            content: "•";
            position: absolute;
            left: 0;
            color: #00ff88;
        }
        .acknowledgment-checkbox {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: #e0e0e0;
        }
        .acknowledgment-checkbox input[type="checkbox"] {
            width: 18px;
            height: 18px;
            accent-color: #00ff88;
            cursor: pointer;
        }
        .acknowledgment-checkbox label {
            cursor: pointer;
            user-select: none;
        }
    `;
    document.head.appendChild(style);

    // Modify the payment button click handler to check for acknowledgment
    const paymentButton = document.getElementById('payment-button');
    if (paymentButton) {
        const originalClickHandler = paymentButton.onclick;
        paymentButton.onclick = async (e) => {
            const checkbox = document.getElementById('donation-acknowledgment');
            if (!checkbox.checked) {
                showStatus('Please acknowledge the donation terms before proceeding', 'error');
                return;
            }
            if (originalClickHandler) {
                await originalClickHandler(e);
            }
        };
    }
}

// Handle password unlock
async function handlePasswordUnlock() {
    const secretPassword = document.getElementById('secretPassword');
    const unlockBtn = document.getElementById('unlockBtn');
    const unlockStatus = document.getElementById('unlockStatus');
    
    if (!secretPassword || !unlockBtn || !unlockStatus) {
        console.error('Required elements not found for password unlock');
        return;
    }
    
    unlockBtn.onclick = async () => {
        const password = secretPassword.value.trim();
        if (!password) {
            showStatus('Please enter the secret word', 'error');
            return;
        }
        
        try {
            unlockBtn.disabled = true;
            showStatus('Verifying...', 'info');
            
            const response = await fetch(`${API_URL}/api/check-access-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.hasAccess) {
                if (data.token) {
                    storeToken(data.token, 'password');
                }
                showStatus('Access granted! Unlocking content...', 'success');
                unlockContent();
            } else {
                showStatus(data.error || 'Invalid secret word', 'error');
            }
        } catch (error) {
            console.error('Password unlock error:', error);
            showStatus('Failed to verify access', 'error');
        } finally {
            unlockBtn.disabled = false;
        }
    };
}
  