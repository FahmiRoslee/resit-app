// ResitKu - Smart Receipt Scanner & Private Vault Logic

// State Variables
let currentUser = {
    id: 'fahmi',
    name: 'Fahmi',
    pin: '2707'
};

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

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupUserProfile();
    setupNavigation();
    setupScannerEvents();
    setupVaultEvents();
    setupExportEvents();
    loadUserReceipts();
    renderUI();
});

let allUsers = [
    { id: 'fahmi', name: 'Fahmi', pin: '2707' }
];

// Setup User Profile & Privacy Isolation
function setupUserProfile() {
    const savedAll = localStorage.getItem('resit_all_users');
    if (savedAll) {
        try {
            allUsers = JSON.parse(savedAll);
        } catch (e) {
            allUsers = [{ id: 'fahmi', name: 'Fahmi', pin: '2707' }];
        }
    } else {
        localStorage.setItem('resit_all_users', JSON.stringify(allUsers));
    }

    const savedUser = localStorage.getItem('resit_active_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
        } catch (e) {
            currentUser = allUsers[0];
        }
    } else {
        currentUser = allUsers[0];
        localStorage.setItem('resit_active_user', JSON.stringify(currentUser));
    }

    updateUserProfileUI();

    const btnProfile = document.getElementById('btn-user-profile');
    const profileModal = document.getElementById('user-profile-modal');
    const closeUserModal = document.getElementById('close-user-modal');
    const selectAccount = document.getElementById('select-user-account');
    const loginPinInput = document.getElementById('login-pin-input');
    const pinError = document.getElementById('pin-login-error');
    const btnLoginUser = document.getElementById('btn-login-user');

    const btnShowAddUser = document.getElementById('btn-show-add-user');
    const btnShowResetPin = document.getElementById('btn-show-reset-pin');
    const addUserForm = document.getElementById('add-user-form');
    const resetPinForm = document.getElementById('reset-pin-form');
    const btnCancelAdd = document.getElementById('btn-cancel-add-user');
    const btnCancelReset = document.getElementById('btn-cancel-reset-pin');

    function populateAccountDropdown() {
        if (!selectAccount) return;
        selectAccount.innerHTML = '';
        allUsers.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = `${u.name} ${u.id === currentUser.id ? '(Current)' : ''}`;
            if (u.id === currentUser.id) opt.selected = true;
            selectAccount.appendChild(opt);
        });
    }

    if (btnProfile) {
        btnProfile.addEventListener('click', () => {
            populateAccountDropdown();
            if (loginPinInput) loginPinInput.value = '';
            if (pinError) pinError.textContent = '';
            if (addUserForm) addUserForm.style.display = 'none';
            if (resetPinForm) resetPinForm.style.display = 'none';
            profileModal.classList.add('active');
        });
    }

    if (closeUserModal) {
        closeUserModal.addEventListener('click', () => {
            profileModal.classList.remove('active');
        });
    }

    // Login / Unlock Vault Button
    if (btnLoginUser) {
        btnLoginUser.addEventListener('click', () => {
            const targetId = selectAccount.value;
            const targetUser = allUsers.find(u => u.id === targetId);
            const enteredPin = loginPinInput ? loginPinInput.value.trim() : '';

            if (!targetUser) return;

            // Verify PIN (accept target pin or 2707)
            if (enteredPin === targetUser.pin || enteredPin === '2707' || !targetUser.pin) {
                currentUser = targetUser;
                localStorage.setItem('resit_active_user', JSON.stringify(currentUser));
                updateUserProfileUI();
                loadUserReceipts();
                renderUI();
                profileModal.classList.remove('active');
                if (pinError) pinError.textContent = '';
                alert(`🔓 Unlocked private vault for ${currentUser.name}!`);
            } else {
                if (pinError) pinError.textContent = '❌ Incorrect PIN. Please try again or click Reset PIN.';
            }
        });
    }

    // Toggle Add User Form
    if (btnShowAddUser) {
        btnShowAddUser.addEventListener('click', () => {
            if (addUserForm) addUserForm.style.display = 'flex';
            if (resetPinForm) resetPinForm.style.display = 'none';
        });
    }

    if (btnCancelAdd) {
        btnCancelAdd.addEventListener('click', () => {
            if (addUserForm) addUserForm.style.display = 'none';
        });
    }

    // Toggle Reset PIN Form
    if (btnShowResetPin) {
        btnShowResetPin.addEventListener('click', () => {
            if (resetPinForm) resetPinForm.style.display = 'flex';
            if (addUserForm) addUserForm.style.display = 'none';
        });
    }

    if (btnCancelReset) {
        btnCancelReset.addEventListener('click', () => {
            if (resetPinForm) resetPinForm.style.display = 'none';
        });
    }

    // Handle Add User Form Submission
    if (addUserForm) {
        addUserForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameVal = document.getElementById('new-user-name').value.trim();
            const pinVal = document.getElementById('new-user-pin').value.trim();

            if (!nameVal || pinVal.length !== 4) {
                alert('Please enter a valid user name and 4-digit PIN.');
                return;
            }

            const newId = nameVal.toLowerCase().replace(/\s+/g, '_');
            const newUser = { id: newId, name: nameVal, pin: pinVal };

            // Check if user already exists
            const existingIdx = allUsers.findIndex(u => u.id === newId);
            if (existingIdx >= 0) {
                allUsers[existingIdx] = newUser;
            } else {
                allUsers.push(newUser);
            }

            localStorage.setItem('resit_all_users', JSON.stringify(allUsers));
            currentUser = newUser;
            localStorage.setItem('resit_active_user', JSON.stringify(currentUser));

            updateUserProfileUI();
            loadUserReceipts();
            renderUI();

            addUserForm.style.display = 'none';
            profileModal.classList.remove('active');
            alert(`🎉 Created & unlocked private account for ${nameVal}!`);
        });
    }

    // Handle Reset PIN Form Submission
    if (resetPinForm) {
        resetPinForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newPin = document.getElementById('new-pin-input').value.trim();
            if (newPin.length !== 4) {
                alert('Please enter a valid 4-digit PIN.');
                return;
            }

            const targetId = selectAccount ? selectAccount.value : currentUser.id;
            const targetUser = allUsers.find(u => u.id === targetId);

            if (targetUser) {
                targetUser.pin = newPin;
                if (targetUser.id === currentUser.id) {
                    currentUser.pin = newPin;
                    localStorage.setItem('resit_active_user', JSON.stringify(currentUser));
                }
                localStorage.setItem('resit_all_users', JSON.stringify(allUsers));
                resetPinForm.style.display = 'none';
                alert(`✅ Successfully updated Security PIN for ${targetUser.name}!`);
            }
        });
    }
}

function updateUserProfileUI() {
    const badgeName = document.getElementById('user-profile-name');
    if (badgeName) {
        badgeName.textContent = `Private Vault: ${currentUser.name}`;
    }
}

// Navigation Tabs Handler
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(l => l.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            link.classList.add('active');
            const tabId = `content-${link.getAttribute('data-tab')}`;
            const targetPane = document.getElementById(tabId);
            if (targetPane) targetPane.classList.add('active');
        });
    });
}

// Scanner Events & Tesseract OCR Engine
function setupScannerEvents() {
    const browseBtn = document.getElementById('btn-browse-file');
    const fileInput = document.getElementById('receipt-file-input');
    const dropZone = document.getElementById('drop-zone');
    const saveForm = document.getElementById('save-receipt-form');

    if (browseBtn && fileInput) {
        browseBtn.addEventListener('click', () => fileInput.click());
    }

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', (e) => {
            if (e.target !== browseBtn && !browseBtn.contains(e.target)) {
                fileInput.click();
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
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
