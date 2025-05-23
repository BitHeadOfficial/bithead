// Admin Panel JavaScript

const API_URL = window.location.origin + '/api';
const TOKEN_KEY = 'admin_token';

// Remove hardcoded JWT token
// const FORCED_JWT = '...'; // Removed for security

const loginForm = document.getElementById('adminLoginForm');
const dashboard = document.getElementById('adminDashboard');
const loginButton = document.getElementById('loginButton');
const loginError = document.getElementById('loginError');
const username = document.getElementById('username');
const password = document.getElementById('password');
const addWhitelistBtn = document.getElementById('addWhitelistEntry');
const exportWhitelistBtn = document.getElementById('exportWhitelist');
const whitelistSpots = document.getElementById('whitelistSpots');
const whitelistFullMsg = document.getElementById('whitelistFullMsg');
const addWhitelistModal = document.getElementById('addWhitelistModal');
const addWhitelistForm = document.getElementById('addWhitelistForm');
const closeModalBtns = document.querySelectorAll('.close-modal');

// Login
document.addEventListener('DOMContentLoaded', function() {
    const loginBtn = document.getElementById('loginButton');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
});

function showDashboard() {
    loginForm.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadMetricsAndWhitelist();
}

function showLoginForm() {
    dashboard.classList.add('hidden');
    loginForm.classList.remove('hidden');
    username.value = '';
    password.value = '';
}

async function handleLogin(e) {
    e.preventDefault();
    if (!username.value || !password.value) {
        showError('Username and password are required');
        return;
    }
    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username.value, password: password.value })
        });
        const data = await response.json();
        if (data.success) {
            localStorage.setItem(TOKEN_KEY, data.token);
            showDashboard();
        } else {
            showError(data.error || 'Login failed');
        }
    } catch (error) {
        showError('Server error. Please try again.');
    }
}

function showError(message) {
    loginError.textContent = message;
    loginError.style.display = 'block';
    setTimeout(() => { loginError.style.display = 'none'; }, 3000);
}

// Metrics and Whitelist
async function loadMetricsAndWhitelist() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        showLoginForm();
        return;
    }

    // Load metrics
    try {
        const statsRes = await fetch(`${API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const statsData = await statsRes.json();
        if (statsData.success) {
            document.getElementById('totalUsers').textContent = statsData.stats.total_users.count || 0;
            document.getElementById('genesisUsers').textContent = statsData.stats.genesis_users.count || 0;
        }
    } catch (e) {
        console.error('Error loading metrics:', e);
        if (e.status === 401) {
            showLoginForm();
        }
    }

    // Load whitelist
    try {
        const wlRes = await fetch(`${API_URL}/admin/whitelist`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const wlData = await wlRes.json();
        if (wlData.success) {
            updateWhitelistTable(wlData.whitelist);
            const spotsLeft = 8000 - wlData.whitelist.length;
            whitelistSpots.textContent = spotsLeft;
            if (spotsLeft <= 0) {
                addWhitelistBtn.disabled = true;
                whitelistFullMsg.style.display = 'block';
                whitelistFullMsg.textContent = 'Whitelist is full. No more entries can be added.';
                whitelistSpots.style.background = '#ff4c60';
                whitelistSpots.style.color = '#fff';
            } else if (spotsLeft <= 100) {
                whitelistSpots.style.background = '#ff9800';
                whitelistSpots.style.color = '#fff';
            } else {
                whitelistSpots.style.background = '#4CAF50';
                whitelistSpots.style.color = '#fff';
            }
            // Also lock modal form if full
            if (addWhitelistForm) {
                Array.from(addWhitelistForm.elements).forEach(el => {
                    if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') {
                        el.disabled = (spotsLeft <= 0);
                    }
                });
            }
        }
    } catch (e) {
        console.error('Error loading whitelist:', e);
        if (e.status === 401) {
            showLoginForm();
        }
    }
}

function showToast(message, type = 'success') {
    let toast = document.getElementById('adminToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'adminToast';
        toast.style.position = 'fixed';
        toast.style.top = '30px';
        toast.style.right = '30px';
        toast.style.zIndex = '9999';
        toast.style.padding = '1rem 2rem';
        toast.style.borderRadius = '8px';
        toast.style.fontWeight = 'bold';
        toast.style.fontSize = '1.1rem';
        toast.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.background = type === 'success' ? '#4CAF50' : '#ff4c60';
    toast.style.color = '#fff';
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
}

// Add search bar to dashboard
(function addSearchBar() {
    const dashboard = document.getElementById('adminDashboard');
    if (dashboard && !document.getElementById('whitelistSearch')) {
        const searchDiv = document.createElement('div');
        searchDiv.style.display = 'flex';
        searchDiv.style.justifyContent = 'flex-end';
        searchDiv.style.marginBottom = '1rem';
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'whitelistSearch';
        input.placeholder = 'Search name, email, or wallet...';
        input.className = 'form-control';
        input.style.maxWidth = '300px';
        searchDiv.appendChild(input);
        const mainContent = dashboard.querySelector('.main-content');
        if (mainContent) {
            mainContent.insertBefore(searchDiv, mainContent.firstChild);
        }
        input.addEventListener('input', function() {
            filterWhitelistTable(this.value);
        });
    }
})();

let lastWhitelist = [];
function updateWhitelistTable(whitelist) {
    lastWhitelist = whitelist;
    const searchValue = document.getElementById('whitelistSearch')?.value?.toLowerCase() || '';
    const filtered = whitelist.filter(entry =>
        (entry.name || '').toLowerCase().includes(searchValue) ||
        (entry.email || '').toLowerCase().includes(searchValue) ||
        (entry.wallet_address || '').toLowerCase().includes(searchValue)
    );
    const tbody = document.getElementById('whitelistTableBody');
    tbody.innerHTML = filtered.map(entry => `
        <tr data-wallet="${entry.wallet_address}">
            <td>${entry.name}</td>
            <td>${entry.email}</td>
            <td class="wallet-address" style="display:flex;align-items:center;gap:0.5em;">
                <span>${entry.wallet_address}</span>
                <button class="btn btn-secondary btn-sm copy-wallet" data-wallet="${entry.wallet_address}" title="Copy wallet address" style="padding:0.2em 0.5em;font-size:0.9em;">
                    <i class="fas fa-copy"></i>
                </button>
            </td>
            <td>${new Date(entry.created_at).toLocaleDateString()}</td>
            <td class="actions">
                <button class="btn btn-danger btn-sm remove-whitelist" data-wallet="${entry.wallet_address}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    document.querySelectorAll('.remove-whitelist').forEach(button => {
        button.addEventListener('click', () => removeFromWhitelist(button.dataset.wallet));
    });
    document.querySelectorAll('.copy-wallet').forEach(button => {
        button.addEventListener('click', function() {
            navigator.clipboard.writeText(button.dataset.wallet);
            showToast('Wallet address copied!');
        });
    });
    let countDiv = document.getElementById('whitelistCount');
    if (!countDiv) {
        countDiv = document.createElement('div');
        countDiv.id = 'whitelistCount';
        countDiv.style.fontWeight = 'bold';
        countDiv.style.margin = '0.5rem 0';
        tbody.parentElement.parentElement.insertBefore(countDiv, tbody.parentElement);
    }
    countDiv.textContent = `Total Whitelisted: ${filtered.length}`;
}

function filterWhitelistTable(value) {
    updateWhitelistTable(lastWhitelist);
}

// Add Whitelist Modal
addWhitelistBtn.addEventListener('click', () => {
    addWhitelistModal.classList.add('active');
    // Re-enable form if spots are available
    if (parseInt(whitelistSpots.textContent, 10) > 0) {
        Array.from(addWhitelistForm.elements).forEach(el => {
            if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') {
                el.disabled = false;
            }
        });
    }
});
closeModalBtns.forEach(btn => btn.addEventListener('click', () => {
    addWhitelistModal.classList.remove('active');
}));

addWhitelistForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        showLoginForm();
        return;
    }

    const name = document.getElementById('whitelistName').value;
    const email = document.getElementById('whitelistEmail').value;
    const walletAddress = document.getElementById('whitelistWallet').value;
    try {
        const response = await fetch(`${API_URL}/admin/whitelist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, email, walletAddress })
        });
        const data = await response.json();
        if (data.success) {
            addWhitelistModal.classList.remove('active');
            loadMetricsAndWhitelist();
            showToast('Added to whitelist!');
        } else {
            showToast(data.error || 'Failed to add to whitelist', 'error');
        }
    } catch (err) {
        console.error('Error adding to whitelist:', err);
        showToast('Server error', 'error');
        if (err.status === 401) {
            showLoginForm();
        }
    }
});

async function removeFromWhitelist(walletAddress) {
    if (!confirm('Are you sure you want to remove this entry from the whitelist?')) return;
    
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        showLoginForm();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/whitelist/${walletAddress}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            // Optionally highlight row before removal
            const row = document.querySelector(`tr[data-wallet='${walletAddress}']`);
            if (row) {
                row.style.background = '#ffebee';
                setTimeout(() => {
                    loadMetricsAndWhitelist();
                    showToast('Whitelist entry removed!', 'success');
                }, 400);
            } else {
                loadMetricsAndWhitelist();
                showToast('Whitelist entry removed!', 'success');
            }
        } else {
            showToast(data.error || 'Failed to remove from whitelist', 'error');
        }
    } catch (error) {
        console.error('Error removing from whitelist:', error);
        showToast('Failed to remove from whitelist', 'error');
        if (error.status === 401) {
            showLoginForm();
        }
    }
}

// Export CSV
exportWhitelistBtn.addEventListener('click', async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        showLoginForm();
        return;
    }

    try {
        const wlRes = await fetch(`${API_URL}/admin/whitelist`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const wlData = await wlRes.json();
        if (wlData.success) {
            const csv = [
                ['Name', 'Email', 'Wallet Address', 'Date Added'],
                ...wlData.whitelist.map(entry => [
                    entry.name,
                    entry.email,
                    entry.wallet_address,
                    new Date(entry.created_at).toLocaleDateString()
                ])
            ].map(row => row.map(field => '"' + String(field).replace(/"/g, '""') + '"').join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'whitelist.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (err) {
        console.error('Error exporting whitelist:', err);
        showToast('Failed to export CSV', 'error');
        if (err.status === 401) {
            showLoginForm();
        }
    }
});

// On load, check if already logged in
(function() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        fetch(`${API_URL}/admin/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json()).then(data => {
            if (data.success) {
                showDashboard();
            } else {
                showLoginForm();
            }
        }).catch(() => showLoginForm());
    } else {
        showLoginForm();
    }
})();

// Move logout button to top right
(function moveLogoutButton() {
    const dashboard = document.getElementById('adminDashboard');
    const logoutBtn = document.getElementById('logoutButton');
    const container = document.getElementById('logoutButtonContainer');
    if (dashboard && logoutBtn && container) {
        logoutBtn.style.margin = '1rem 0 0 0';
        logoutBtn.style.float = 'right';
        logoutBtn.style.display = 'inline-block';
        container.appendChild(logoutBtn);
    }
})();

// Always show dashboard on load
showDashboard();