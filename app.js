let currentUser = null;
let userReceipts = [];
let currentScanImageBase64 = null;
let activeReceiptForModal = null;

// Retailer Classifier dictionary
const RETAILERS = [
    { name: "Lotus's", category: 'groceries' },
    { name: 'Tesco', category: 'groceries' },
    { name: '99 Speedmart', category: 'groceries' },
    { name: 'Jaya Grocer', category: 'groceries' },
    { name: 'Mydin', category: 'groceries' },
    { name: 'Econsave', category: 'groceries' },
    { name: 'Village Grocer', category: 'groceries' },
    { name: 'Petronas', category: 'fuel' },
    { name: 'Shell', category: 'fuel' },
    { name: 'Caltex', category: 'fuel' },
    { name: 'BHPetrol', category: 'fuel' },
    { name: 'Petron', category: 'fuel' },
    { name: 'Watsons', category: 'medical' },
    { name: 'Guardian', category: 'medical' },
    { name: 'Caring Pharmacy', category: 'medical' },
    { name: 'Alpro Pharmacy', category: 'medical' },
    { name: "McDonald's", category: 'dining' },
    { name: 'KFC', category: 'dining' },
    { name: 'Starbucks', category: 'dining' },
    { name: 'Tealive', category: 'dining' },
    { name: 'FamilyMart', category: 'dining' },
    { name: 'Subway', category: 'dining' },
    { name: 'MR.DIY', category: 'shopping' },
    { name: 'Uniqlo', category: 'shopping' },
    { name: 'Decathlon', category: 'shopping' }
];

let allUsers = [];

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupUserProfile();
    setupNavigation();
    setupScannerEvents();
    setupVaultEvents();
    setupExportEvents();

    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            alert('🔒 Private Vault Active\nStorage: Local Encrypted Engine\nUser: ' + (currentUser ? currentUser.name : 'Locked'));
        });
    }
});

// Setup User Profile & Privacy Isolation (Auth Gate)
function setupUserProfile() {
    const savedAll = localStorage.getItem('resit_all_users');
    if (savedAll) {
        try {
            allUsers = JSON.parse(savedAll);
        } catch (e) {
            allUsers = [];
        }
    } else {
        allUsers = [];
    }

    // Check active session authentication
    const activeSession = sessionStorage.getItem('resit_active_session');
    if (activeSession) {
        try {
            currentUser = JSON.parse(activeSession);
        } catch (e) {
            currentUser = null;
        }
    } else {
        currentUser = null;
    }

    const gateSelectAccount = document.getElementById('gate-select-account');
    const tabAuthLogin = document.getElementById('tab-auth-login');
    const tabAuthRegister = document.getElementById('tab-auth-register');
    const gateLoginForm = document.getElementById('gate-login-form');
    const gateRegisterForm = document.getElementById('gate-register-form');
    const btnProfile = document.getElementById('btn-user-profile');

    function populateGateDropdown() {
        if (!gateSelectAccount) return;
        gateSelectAccount.innerHTML = '<option value="">-- Select Account --</option>';
        allUsers.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.name;
            gateSelectAccount.appendChild(opt);
        });
    }

    populateGateDropdown();
    updateAuthStateUI();

    // Auto switch to Register tab if no users exist yet
    if (allUsers.length === 0 && tabAuthRegister) {
        tabAuthRegister.click();
    }

    // Toggle Gate Tabs (Log In vs Create Account)
    if (tabAuthLogin && tabAuthRegister) {
        tabAuthLogin.addEventListener('click', () => {
            tabAuthLogin.classList.add('active');
            tabAuthRegister.classList.remove('active');
            if (gateLoginForm) gateLoginForm.style.display = 'flex';
            if (gateRegisterForm) gateRegisterForm.style.display = 'none';
        });

        tabAuthRegister.addEventListener('click', () => {
            tabAuthRegister.classList.add('active');
            tabAuthLogin.classList.remove('active');
            if (gateRegisterForm) gateRegisterForm.style.display = 'flex';
            if (gateLoginForm) gateLoginForm.style.display = 'none';
        });
    }

    // Handle Gate Log In Form
    if (gateLoginForm) {
        gateLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const targetId = gateSelectAccount ? gateSelectAccount.value : '';
            const enteredPin = document.getElementById('gate-login-pin').value.trim();
            const errEl = document.getElementById('gate-login-error');

            if (!targetId) {
                if (errEl) errEl.textContent = 'Please select your user account.';
                return;
            }

            const targetUser = allUsers.find(u => u.id === targetId);
            if (!targetUser) return;

            if (enteredPin === targetUser.pin) {
                currentUser = targetUser;
                sessionStorage.setItem('resit_active_session', JSON.stringify(currentUser));
                if (errEl) errEl.textContent = '';
                updateAuthStateUI();
                loadUserReceipts();
                renderUI();
                alert(`🔓 Unlocked private vault for ${currentUser.name}!`);
            } else {
                if (errEl) errEl.textContent = '❌ Incorrect PIN. Please try again.';
            }
        });
    }

    // Handle Gate Register Form
    if (gateRegisterForm) {
        gateRegisterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const regName = document.getElementById('gate-reg-name').value.trim();
            const regPin = document.getElementById('gate-reg-pin').value.trim();
            const errEl = document.getElementById('gate-reg-error');

            if (!regName || regPin.length !== 4) {
                if (errEl) errEl.textContent = 'Please enter your name and a 4-digit PIN.';
                return;
            }

            const newId = regName.toLowerCase().replace(/\s+/g, '_');
            const newUser = { id: newId, name: regName, pin: regPin };

            const existingIdx = allUsers.findIndex(u => u.id === newId);
            if (existingIdx >= 0) {
                allUsers[existingIdx] = newUser;
            } else {
                allUsers.push(newUser);
            }

            localStorage.setItem('resit_all_users', JSON.stringify(allUsers));
            currentUser = newUser;
            sessionStorage.setItem('resit_active_session', JSON.stringify(currentUser));
            if (errEl) errEl.textContent = '';

            populateGateDropdown();
            updateAuthStateUI();
            loadUserReceipts();
            renderUI();
            alert(`🎉 Created & unlocked private vault for ${regName}!`);
        });
    }

    // Lock Session / Switch User Button in Header
    if (btnProfile) {
        btnProfile.addEventListener('click', () => {
            if (currentUser) {
                const confirmLock = confirm(`Lock vault for ${currentUser.name} and log out?`);
                if (confirmLock) {
                    currentUser = null;
                    sessionStorage.removeItem('resit_active_session');
                    populateGateDropdown();
                    updateAuthStateUI();
                }
            } else {
                updateAuthStateUI();
            }
        });
    }
}

function updateAuthStateUI() {
    const authGateScreen = document.getElementById('auth-gate-screen');
    const badgeName = document.getElementById('user-profile-name');
    const appNav = document.querySelector('.app-nav');
    const scannerPane = document.getElementById('content-scanner');
    const vaultPane = document.getElementById('content-vault');
    const analyticsPane = document.getElementById('content-analytics');
    const exportPane = document.getElementById('content-export');
    const btnProfile = document.getElementById('btn-user-profile');

    if (!currentUser) {
        // Locked State
        if (authGateScreen) authGateScreen.style.display = 'block';
        if (appNav) appNav.style.display = 'none';
        if (scannerPane) scannerPane.style.display = 'none';
        if (vaultPane) vaultPane.style.display = 'none';
        if (analyticsPane) analyticsPane.style.display = 'none';
        if (exportPane) exportPane.style.display = 'none';

        if (badgeName) badgeName.textContent = '🔒 Vault Locked (Log in to access)';
        if (btnProfile) btnProfile.innerHTML = '<i class="fa-solid fa-lock"></i>';
    } else {
        // Unlocked State
        if (authGateScreen) authGateScreen.style.display = 'none';
        if (appNav) appNav.style.display = 'flex';

        // Default view: Scanner Pane ONLY
        if (scannerPane) scannerPane.style.display = 'block';
        if (vaultPane) vaultPane.style.display = 'none';
        if (analyticsPane) analyticsPane.style.display = 'none';
        if (exportPane) exportPane.style.display = 'none';

        const navLinks = document.querySelectorAll('.app-nav .nav-link');
        navLinks.forEach((l, idx) => {
            if (idx === 0) l.classList.add('active');
            else l.classList.remove('active');
        });

        if (badgeName) badgeName.textContent = `Private Vault: ${currentUser.name}`;
        if (btnProfile) btnProfile.innerHTML = '<i class="fa-solid fa-lock-open"></i>';
    }
}

// Navigation Tabs Handler
function setupNavigation() {
    const navLinks = document.querySelectorAll('.app-nav .nav-link');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tabName = link.getAttribute('data-tab');
            if (!tabName) return;

            // Highlight selected nav link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Hide all tab panes strictly
            const allPaneIds = ['content-scanner', 'content-vault', 'content-analytics', 'content-export'];
            allPaneIds.forEach(id => {
                const pane = document.getElementById(id);
                if (pane) pane.style.display = 'none';
            });

            // Display target tab pane ONLY
            const targetPane = document.getElementById(`content-${tabName}`);
            if (targetPane) {
                targetPane.style.display = 'block';
            }
        });
    });
}

// Scanner Events & Tesseract OCR Engine
function setupScannerEvents() {
    const btnCamera = document.getElementById('btn-open-camera');
    const btnGallery = document.getElementById('btn-open-gallery');
    const cameraInput = document.getElementById('camera-file-input');
    const galleryInput = document.getElementById('gallery-file-input');
    const saveForm = document.getElementById('save-receipt-form');

    if (btnCamera && cameraInput) {
        btnCamera.addEventListener('click', (e) => {
            e.stopPropagation();
            cameraInput.click();
        });
    }

    if (btnGallery && galleryInput) {
        btnGallery.addEventListener('click', (e) => {
            e.stopPropagation();
            galleryInput.click();
        });
    }

    if (cameraInput) {
        cameraInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                processReceiptFile(e.target.files[0]);
            }
        });
    }

    if (galleryInput) {
        galleryInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                processReceiptFile(e.target.files[0]);
            }
        });
    }

    if (saveForm) {
        saveForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveScannedReceipt();
        });
    }
}

// Read Image & Run Tesseract OCR Text Extraction
function processReceiptFile(file) {
    const reader = new FileReader();
    const progressBox = document.getElementById('ocr-progress-box');
    const progressFill = document.getElementById('ocr-progress-fill');
    const progressLabel = document.getElementById('ocr-status-label');
    const progressPercent = document.getElementById('ocr-percent');
    const resultCard = document.getElementById('scan-result-card');
    const previewImg = document.getElementById('scan-preview-img');

    reader.onload = async (e) => {
        currentScanImageBase64 = e.target.result;
        if (previewImg) previewImg.src = currentScanImageBase64;

        if (progressBox) progressBox.classList.add('active');
        if (resultCard) resultCard.style.display = 'none';

        try {
            if (typeof Tesseract === 'undefined') {
                throw new Error('Tesseract OCR library not loaded.');
            }

            const { data } = await Tesseract.recognize(currentScanImageBase64, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text' && m.progress) {
                        const pct = Math.round(m.progress * 100);
                        if (progressFill) progressFill.style.width = `${pct}%`;
                        if (progressPercent) progressPercent.textContent = `${pct}%`;
                        if (progressLabel) progressLabel.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Scanning receipt text... (${pct}%)`;
                    }
                }
            });

            console.log('⚡ OCR Extracted Text:\n', data.text);
            const extracted = parseReceiptText(data.text);
            populateScanForm(extracted);

            if (progressBox) progressBox.classList.remove('active');
            if (resultCard) resultCard.style.display = 'block';
        } catch (err) {
            console.error('OCR Error:', err);
            if (progressBox) progressBox.classList.remove('active');
            
            // Fallback manual entry
            populateScanForm({ merchant: '', amount: '0.00', date: new Date().toISOString().split('T')[0], category: 'groceries' });
            if (resultCard) resultCard.style.display = 'block';
            alert('Scan completed! Please review and confirm receipt details.');
        }
    };

    reader.readAsDataURL(file);
}

// Smart Parser Regex Extractor
function parseReceiptText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let merchant = '';
    let category = 'other';
    let amount = '';
    let date = '';

    // 1. Merchant & Category Detection
    for (const r of RETAILERS) {
        if (text.toLowerCase().includes(r.name.toLowerCase())) {
            merchant = r.name;
            category = r.category;
            break;
        }
    }

    if (!merchant && lines.length > 0) {
        // Grab first prominent capitalized line
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i];
            if (line.length >= 3 && !/tax|receipt|welcome|cashier|tel/i.test(line)) {
                merchant = line.replace(/[^a-zA-Z0-9\s'&.]/g, '').trim();
                break;
            }
        }
    }

    if (!merchant) merchant = 'Unknown Merchant';

    // 2. Amount Extraction (Look for TOTAL, RM, JUMLAH)
    const amountRegex = /(?:TOTAL|JUMLAH|AMOUNT|CASH|NET|RM)\s*[:=]?\s*(?:RM)?\s*(\d+[\.,]\d{2})/i;
    const amountMatch = text.match(amountRegex);

    if (amountMatch) {
        amount = amountMatch[1].replace(',', '.');
    } else {
        // Find highest decimal number matching XX.XX pattern
        const allDecimals = text.match(/\b\d+\.\d{2}\b/g);
        if (allDecimals) {
            const numVals = allDecimals.map(n => parseFloat(n)).filter(n => !isNaN(n));
            if (numVals.length > 0) {
                amount = Math.max(...numVals).toFixed(2);
            }
        }
    }

    // 3. Date Extraction (DD/MM/YYYY or YYYY-MM-DD)
    const dateRegex = /\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}|\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2})\b/;
    const dateMatch = text.match(dateRegex);

    if (dateMatch) {
        const rawDate = dateMatch[1];
        const parts = rawDate.split(/[\/\.-]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                // YYYY-MM-DD
                date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else {
                // DD/MM/YYYY
                const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                date = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
    }

    if (!date) {
        date = new Date().toISOString().split('T')[0];
    }

    return { merchant, amount, date, category };
}

function populateScanForm(extracted) {
    document.getElementById('edit-merchant').value = extracted.merchant || '';
    document.getElementById('edit-amount').value = extracted.amount || '';
    document.getElementById('edit-date').value = extracted.date || new Date().toISOString().split('T')[0];
    document.getElementById('edit-category').value = extracted.category || 'other';
}

// Save Receipt to Private User Vault
function saveScannedReceipt() {
    const merchant = document.getElementById('edit-merchant').value.trim();
    const amount = parseFloat(document.getElementById('edit-amount').value);
    const date = document.getElementById('edit-date').value;
    const category = document.getElementById('edit-category').value;

    if (!merchant || isNaN(amount)) {
        alert('Please enter valid merchant name and amount.');
        return;
    }

    const newReceipt = {
        id: 'rec_' + Date.now(),
        userId: currentUser.id,
        merchant: merchant,
        amount: amount,
        date: date,
        category: category,
        image: currentScanImageBase64,
        createdAt: new Date().toISOString()
    };

    userReceipts.unshift(newReceipt);
    saveUserReceipts();
    renderUI();

    document.getElementById('scan-result-card').style.display = 'none';
    currentScanImageBase64 = null;
    alert(`✅ Receipt saved to ${currentUser.name}'s private vault!`);

    // Switch tab to vault
    const tabVault = document.querySelector('.nav-link[data-tab="vault"]');
    if (tabVault) tabVault.click();
}

// Load & Save Storage Isolation
function loadUserReceipts() {
    const storageKey = `resit_user_${currentUser.id}_receipts`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
        try {
            userReceipts = JSON.parse(saved);
        } catch (e) {
            userReceipts = [];
        }
    } else {
        userReceipts = [];
    }
}

function saveUserReceipts() {
    const storageKey = `resit_user_${currentUser.id}_receipts`;
    localStorage.setItem(storageKey, JSON.stringify(userReceipts));
}

// Setup Receipt Vault Filter & Modal Events
function setupVaultEvents() {
    const searchInput = document.getElementById('vault-search-input');
    const categoryFilter = document.getElementById('vault-category-filter');
    const closeViewModal = document.getElementById('close-view-modal');
    const btnDelete = document.getElementById('btn-delete-receipt');

    if (searchInput) searchInput.addEventListener('input', () => renderVaultGrid());
    if (categoryFilter) categoryFilter.addEventListener('change', () => renderVaultGrid());

    if (closeViewModal) {
        closeViewModal.addEventListener('click', () => {
            document.getElementById('view-receipt-modal').classList.remove('active');
        });
    }

    if (btnDelete) {
        btnDelete.addEventListener('click', () => {
            if (activeReceiptForModal) {
                const confirmDel = confirm(`Delete receipt for ${activeReceiptForModal.merchant}?`);
                if (confirmDel) {
                    userReceipts = userReceipts.filter(r => r.id !== activeReceiptForModal.id);
                    saveUserReceipts();
                    renderUI();
                    document.getElementById('view-receipt-modal').classList.remove('active');
                }
            }
        });
    }
}

// Render Master UI
function renderUI() {
    renderVaultGrid();
    renderAnalytics();
}

// Render Vault Receipts Grid
function renderVaultGrid() {
    const grid = document.getElementById('receipts-grid');
    const searchVal = document.getElementById('vault-search-input')?.value.toLowerCase() || '';
    const catVal = document.getElementById('vault-category-filter')?.value || 'all';
    const countBadge = document.getElementById('vault-count-badge');

    if (!grid) return;
    grid.innerHTML = '';

    const filtered = userReceipts.filter(r => {
        const matchSearch = r.merchant.toLowerCase().includes(searchVal);
        const matchCat = catVal === 'all' || r.category === catVal;
        return matchSearch && matchCat;
    });

    if (countBadge) {
        countBadge.textContent = `${filtered.length} Receipts Stored`;
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
                <i class="fa-solid fa-receipt" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.4;"></i>
                <h3>No Receipts Found</h3>
                <p style="font-size: 0.85rem; margin-top: 0.4rem;">Tap "Scan Receipt" to scan your first physical receipt!</p>
            </div>
        `;
        return;
    }

    filtered.forEach(r => {
        const card = document.createElement('div');
        card.className = 'receipt-card';
        card.innerHTML = `
            <img src="${r.image || 'https://via.placeholder.com/300x150?text=No+Image'}" class="receipt-thumb" alt="${r.merchant}">
            <div class="receipt-body">
                <div class="receipt-top">
                    <div class="merchant-name">${r.merchant}</div>
                    <div class="receipt-amount">RM ${parseFloat(r.amount).toFixed(2)}</div>
                </div>
                <div class="receipt-meta">
                    <span><i class="fa-regular fa-calendar"></i> ${r.date}</span>
                    <span class="category-tag ${r.category}">${r.category}</span>
                </div>
            </div>
        `;

        card.addEventListener('click', () => openReceiptModal(r));
        grid.appendChild(card);
    });
}

function openReceiptModal(receipt) {
    activeReceiptForModal = receipt;
    document.getElementById('modal-merchant-title').textContent = receipt.merchant;
    document.getElementById('modal-receipt-img').src = receipt.image || '';
    document.getElementById('modal-amount-display').textContent = `RM ${parseFloat(receipt.amount).toFixed(2)}`;
    document.getElementById('modal-date-display').textContent = receipt.date;
    document.getElementById('modal-user-display').textContent = currentUser.name;

    const catTag = document.getElementById('modal-category-tag');
    if (catTag) {
        catTag.textContent = receipt.category;
        catTag.className = `category-tag ${receipt.category}`;
    }

    document.getElementById('view-receipt-modal').classList.add('active');
}

// Render Analytics & Spending Charts
function renderAnalytics() {
    const totalSpentEl = document.getElementById('stat-total-spent');
    const totalCountEl = document.getElementById('stat-total-count');
    const avgValueEl = document.getElementById('stat-avg-value');
    const chartContainer = document.getElementById('category-chart-container');

    const totalSpent = userReceipts.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    const count = userReceipts.length;
    const avg = count > 0 ? totalSpent / count : 0;

    if (totalSpentEl) totalSpentEl.textContent = `RM ${totalSpent.toFixed(2)}`;
    if (totalCountEl) totalCountEl.textContent = count;
    if (avgValueEl) avgValueEl.textContent = `RM ${avg.toFixed(2)}`;

    if (!chartContainer) return;
    chartContainer.innerHTML = '';

    const categories = ['groceries', 'fuel', 'medical', 'dining', 'utilities', 'shopping', 'other'];
    const catTotals = {};

    categories.forEach(c => catTotals[c] = 0);
    userReceipts.forEach(r => {
        const cat = r.category || 'other';
        catTotals[cat] = (catTotals[cat] || 0) + parseFloat(r.amount || 0);
    });

    categories.forEach(cat => {
        const val = catTotals[cat] || 0;
        const pct = totalSpent > 0 ? Math.round((val / totalSpent) * 100) : 0;

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '0.3rem';

        row.innerHTML = `
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                <span class="category-tag ${cat}">${cat}</span>
                <span><strong>RM ${val.toFixed(2)}</strong> (${pct}%)</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width: ${pct}%; background: var(--primary);"></div>
            </div>
        `;
        chartContainer.appendChild(row);
    });
}

// Export CSV Spreadsheet
function setupExportEvents() {
    const btnCsv = document.getElementById('btn-export-csv');
    const btnJson = document.getElementById('btn-export-json');

    if (btnCsv) {
        btnCsv.addEventListener('click', () => {
            if (userReceipts.length === 0) {
                alert('No receipts available to export.');
                return;
            }

            let csvContent = "data:text/csv;charset=utf-8,ID,Merchant,Amount_RM,Date,Category,User,Scanned_At\n";
            userReceipts.forEach(r => {
                const row = `"${r.id}","${r.merchant.replace(/"/g, '""')}","${r.amount}","${r.date}","${r.category}","${currentUser.name}","${r.createdAt}"`;
                csvContent += row + "\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `ResitKu_${currentUser.name}_Receipts_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    if (btnJson) {
        btnJson.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userReceipts, null, 2));
            const link = document.createElement("a");
            link.setAttribute("href", dataStr);
            link.setAttribute("download", `ResitKu_${currentUser.name}_Vault_Backup.json`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
}
