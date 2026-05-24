// ══════════════════════════════════════════════════════════════
//        BILLINGSUITE PRO - CORE APPLICATION ENGINE (SUPABASE)
// ══════════════════════════════════════════════════════════════

const GST_STATE_CODES = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "25": "Daman and Diu", "26": "Dadra and Nagar Haveli", "27": "Maharashtra", "28": "Andhra Pradesh",
  "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh",
  "38": "Ladakh"
};

// ─── SETTINGS: SEED INDIAN GST STATE DROPDOWN OPTIONS ───
function initStateDropdown() {
  const select = document.getElementById('state-list');
  if (!select) return;
  
  // Clear any baseline hardcoded placeholders
  select.innerHTML = '<option value="">-- Select State / Place of Supply --</option>';
  
  // Generate valid alpha-ordered option tag templates
  Object.keys(GST_STATE_CODES).sort().forEach(code => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = `${GST_STATE_CODES[code]}`;
    select.appendChild(opt);
  });
}

// ─── UI: TABS & NAVIGATION (WITH TIGHT STATE RETENTION) ──────────────────────────────
function initTabs() {
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
      localStorage.setItem('bs_active_tab', btn.dataset.tab);
    });
  });
  
  document.querySelectorAll('.sec-tab[data-stab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.tab-pane');
      parent.querySelectorAll('.sec-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      parent.querySelectorAll('.stab-pane').forEach(p => p.style.display = 'none');
      const target = document.getElementById(btn.dataset.stab);
      if (target) target.style.display = 'block';
      localStorage.setItem('bs_active_stab_' + parent.id, btn.dataset.stab);
    });
  });

  const savedTab = localStorage.getItem('bs_active_tab') || 'dashboard';
  switchTab(savedTab);

  document.querySelectorAll('.tab-pane').forEach(pane => {
    const savedStab = localStorage.getItem('bs_active_stab_' + pane.id);
    if (savedStab) {
      const stabBtn = pane.querySelector(`.sec-tab[data-stab="${savedStab}"]`);
      if (stabBtn) stabBtn.click();
    }
  });
}

// ─── INITIALIZE AUTO-FILL HOOKS FOR INVOICING & PROCUREMENT ───

function initCustomerAutoFill() {
  const nameInput = document.getElementById('customerName');
  if (!nameInput) return;

  const autoEvent = () => {
    const val = nameInput.value.trim();
    if (!val) return;
    
    // Scan matching profiles in memory array case-insensitively
    const match = customersArray.find(c => c.name.toLowerCase() === val.toLowerCase());
    if (match) {
      const emailField = document.getElementById('customerEmail');
      const gstinField = document.getElementById('customerGstin');
      const addrField = document.getElementById('billingAddr');
      
      if (emailField) emailField.value = match.email || '';
      if (gstinField) gstinField.value = match.gstin || '';
      if (addrField) addrField.value = match.address || '';
      
      // Trigger advance cash pool check alert strip instantly
      if (typeof checkCustomerAdvance === 'function') checkCustomerAdvance();
    }
  };

  nameInput.addEventListener('input', autoEvent);
  nameInput.addEventListener('change', autoEvent);
}

function initSupplierAutoFill() {
  const nameInput = document.getElementById('supplierName');
  if (!nameInput) return;

  const autoEvent = () => {
    const val = nameInput.value.trim();
    if (!val) return;

    const match = suppliersArray.find(s => s.name.toLowerCase() === val.toLowerCase());
    if (match) {
      // Trigger advance deposit float check alert strip instantly
      if (typeof checkSupplierAdvance === 'function') checkSupplierAdvance();
    }
  };

  nameInput.addEventListener('input', autoEvent);
  nameInput.addEventListener('change', autoEvent);
}


function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  
  const targetPane = document.getElementById(tabId + 'Pane');
  const targetBtn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  
  if (targetPane) targetPane.style.display = 'block';
  if (targetBtn) targetBtn.classList.add('active');
}

function closeModal() {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.classList.remove('open');
    modal.style.display = ''; 
  });
}

function closeSampleModal() {
  const m = document.getElementById('sampleModal');
  if (m) { m.classList.remove('open'); m.style.display = ''; }
}

function toast(msg, type = 'info') {
  const existing = document.getElementById('toastMsg');
  if (existing) existing.remove();
  
  const t = document.createElement('div');
  t.id = 'toastMsg';
  t.textContent = msg;
  
  let bg = '#1a5276'; 
  if (type === 'success') bg = '#1a4a3a'; 
  if (type === 'error' || type === 'warn') bg = '#c0392b'; 
  
  t.style.cssText = `position:fixed; bottom:20px; right:20px; background:${bg}; color:#fff; padding:12px 24px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:9999; font-family:'DM Sans', sans-serif; font-weight:500; font-size:0.9rem; animation: slideUp 0.3s ease;`;
  
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// ─── STORE SWITCHER FUNCTION ──────────────────────────────
function changeActiveStore() {
  const newStore = document.getElementById('settingStoreSelect').value;
  if (newStore === currentStoreId) {
    toast('This store is already active.', 'info');
    return;
  }
  localStorage.setItem('bs_active_store', newStore); 
  loadSupabaseData(); 
}

// ─── SUPABASE MULTI-STORE SYNC ENGINE ───────────────────
async function loadSupabaseData() {
  currentStoreId = localStorage.getItem('bs_active_store') || 'Store 1';
  
  const storeDropdown = document.getElementById('settingStoreSelect');
  if (storeDropdown) storeDropdown.value = currentStoreId;
  
  const led = document.getElementById('statusLed');
  const statusLabel = document.getElementById('apiStatusLabel');
  if (led) led.className = 'led';
  if (statusLabel) statusLabel.textContent = 'Syncing...';

  try {
    const [invRes, custRes, suppRes, invcRes, purRes, expRes, settRes, allStoresRes] = await Promise.all([
      supabase.from('inventory').select('*').eq('store_id', currentStoreId),
      supabase.from('customers').select('*').eq('store_id', currentStoreId),
      supabase.from('suppliers').select('*').eq('store_id', currentStoreId),
      supabase.from('invoices').select('*').eq('store_id', currentStoreId).order('created_at', { ascending: false }),
      supabase.from('purchases').select('*').eq('store_id', currentStoreId).order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').eq('store_id', currentStoreId).order('date', { ascending: false }),
      supabase.from('store_settings').select('*').eq('store_id', currentStoreId).single(),
      supabase.from('store_settings').select('store_id, profile_data') 
    ]);

    // Update Dropdown Names
    if (allStoresRes && allStoresRes.data && storeDropdown) {
      Array.from(storeDropdown.options).forEach(opt => {
        const sData = allStoresRes.data.find(s => s.store_id === opt.value);
        if (sData && sData.profile_data && sData.profile_data.storeAlias) {
          opt.text = `${opt.value} — ${sData.profile_data.storeAlias}`;
        } else { opt.text = opt.value; }
      });
    }

    // FIX 1: Safely mutate bizProfile to preserve memory references across files
    if (typeof bizProfile === 'undefined') window.bizProfile = {}; // Fallback init
    Object.keys(bizProfile).forEach(key => delete bizProfile[key]); // Clear old keys
    if (settRes.data && settRes.data.profile_data) { 
        Object.assign(bizProfile, settRes.data.profile_data); // Inject new keys safely
    } 
    
    if (typeof populateSettingsUI === 'function') populateSettingsUI();

    // FIX 2: Check for data BEFORE clearing arrays to prevent network wipeouts!
    if (invRes.data) {
      inventoryStock.length = 0; 
      inventoryStock.push(...invRes.data.map(p => ({ 
        ...p, costPrice: parseFloat(p.cost_price || 0), sellPrice: parseFloat(p.sell_price || 0), gstRate: parseFloat(p.gst_rate || 0), stock: parseFloat(p.stock || 0) 
      })));
    } else if (invRes.error) console.error("Inventory fetch error:", invRes.error);
    
    if (custRes.data) {
      customersArray.length = 0; 
      customersArray.push(...custRes.data.map(c => ({ ...c, advanceBalance: parseFloat(c.advanceBalance || 0) })));
    } else if (custRes.error) console.error("Customer fetch error:", custRes.error);
    
    if (suppRes.data) {
      suppliersArray.length = 0; 
      suppliersArray.push(...suppRes.data.map(s => ({ ...s, paymentTerms: s.payment_terms, advanceBalance: parseFloat(s.advanceBalance || 0) })));
    } else if (suppRes.error) console.error("Supplier fetch error:", suppRes.error);
    
    if (expRes.data) {
      expensesArray.length = 0;  
      expensesArray.push(...expRes.data.map(e => ({ ...e, desc: e.desc_text, amount: parseFloat(e.amount || 0) })));
    } else if (expRes.error) console.error("Expense fetch error:", expRes.error);
    
    if (invcRes.data) {
      invoicesArray.length = 0;  
      invoicesArray.push(...invcRes.data.map(i => ({
        ...i, subtotal: parseFloat(i.subtotal||0), gstAmount: parseFloat(i.gstAmount||0), discount: parseFloat(i.discount||0), grandTotal: parseFloat(i.grandTotal||0), amountPaid: parseFloat(i.amountPaid||0)
      })));
    } else if (invcRes.error) console.error("Invoice fetch error:", invcRes.error);
    
    if (purRes.data) {
      purchasesArray.length = 0; 
      purchasesArray.push(...purRes.data.map(p => ({
        ...p, subtotal: parseFloat(p.subtotal||0), gstAmount: parseFloat(p.gstAmount||0), totalAmount: parseFloat(p.totalAmount||0), amountPaid: parseFloat(p.amountPaid||0)
      })));
    } else if (purRes.error) console.error("Purchase fetch error:", purRes.error);

    if (statusLabel) statusLabel.textContent = 'Supabase Connected';
    const lastSyncLabel = document.getElementById('apiLastSync');
    if (lastSyncLabel) lastSyncLabel.textContent = 'Store: ' + currentStoreId;
    
    syncUI();

  } catch (error) {
    console.error("Supabase Sync Error:", error);
    if (led) led.className = 'led error';
    if (statusLabel) statusLabel.textContent = 'Offline';
    toast('Failed to sync with Supabase.', 'error');
  }
}

// ─── GLOBAL UTILITY & HELPER FUNCTIONS ──────────────────────────
function esc(str) { if (str === null || str === undefined) return ''; return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmt(num) { return parseFloat(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
// Fixed position dictionary alignment lookups format override for custom lexicographical arrays if needed
function today() { return new Date().toISOString().split('T')[0]; }
function dateLabel(dateStr) { if (!dateStr) return ''; const d = new Date(dateStr); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

function calcGST(amount, rate, type) {
  const gstRate = parseFloat(rate) || 0;
  let gst = 0, subtotalPart = 0, total = 0;
  
  if (type === 'Inclusive') {
    total = amount;
    subtotalPart = total / (1 + gstRate);
    gst = total - subtotalPart;
  } else {
    subtotalPart = amount;
    gst = amount * gstRate;
    total = amount + gst;
  }
  
  return { gst, subtotalPart, total };
}

// ─── MASTER ZERO-REFRESH UI REDRAW SYNC ───
function syncUI() {
  if (typeof updateDatalists === 'function') updateDatalists();
  if (typeof renderProductGrid === 'function') renderProductGrid();
  if (typeof renderCustomerGrid === 'function') renderCustomerGrid();
  if (typeof renderSupplierGrid === 'function') renderSupplierGrid();
  if (typeof renderInvoiceLists === 'function') renderInvoiceLists();
  if (typeof renderPurchaseLists === 'function') renderPurchaseLists();
  if (typeof renderExpenses === 'function') renderExpenses();
  if (typeof updateDashboard === 'function') updateDashboard();
}

// ─── UNIVERSAL 3-VIEW CONTROLLER ENGINE ───
function changeView(moduleName, viewType) {
  localStorage.setItem(`bs_view_${moduleName}`, viewType);
  restoreViewButtons();
  syncUI(); 
}

function restoreViewButtons() {
  ['customer', 'supplier', 'product'].forEach(mod => {
    const savedView = localStorage.getItem(`bs_view_${mod}`) || 'grid';
    document.querySelectorAll(`.view-btn[data-module="${mod}"]`).forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.view-btn[data-module="${mod}"][data-view="${savedView}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  });
}

// ─── UNIFIED ID GENERATION MATRIX ───
function getNextId(type) {
  let arr, key, prefix;
  
  // 1. Read directly from bizProfile (with ?. fallback in case settings are loading)
  if (type === 'invoice') { arr = invoicesArray; key = 'invoiceId'; prefix = bizProfile?.invPrefix || 'INV-'; } 
  else if (type === 'purchase') { arr = purchasesArray; key = 'poNumber'; prefix = bizProfile?.poPrefix || 'PO-'; } 
  else if (type === 'product') { arr = inventoryStock; key = 'id'; prefix = bizProfile?.productPrefix || 'ITM-'; }
  else return 'ID-001'; 

  // 2. Ensure it ends with a hyphen
  let pfx = prefix.endsWith('-') ? prefix : prefix + '-';

  if (!arr || arr.length === 0) return pfx + '001';
  
  let max = 0;
  
  arr.forEach(obj => {
    const str = String(obj[key] || '');
    
    // 3. Strict match: Only count items that start with this exact prefix
    if (str.startsWith(pfx)) {
      // Strip the prefix away, leaving only the number (e.g., "045")
      const numStr = str.replace(pfx, ''); 
      const num = parseInt(numStr, 10);
      
      if (!isNaN(num) && num > max) {
        max = num;
      }
    }
  });
  
  return pfx + (max + 1).toString().padStart(3, '0');
}

// ─── THEME & DARK MODE TOGGLE ENGINE ───
function toggleDark() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const pill = document.getElementById('darkPill');
  if (isDark) {
    html.removeAttribute('data-theme'); localStorage.setItem('bs_theme', 'light'); if(pill) pill.classList.remove('on');
  } else {
    html.setAttribute('data-theme', 'dark'); localStorage.setItem('bs_theme', 'dark'); if(pill) pill.classList.add('on');
  }
}
function initThemeUI() {
  const pill = document.getElementById('darkPill');
  if (localStorage.getItem('bs_theme') === 'dark' && pill) { pill.classList.add('on'); }
}

function isInvoiceIdDuplicate(id) { return invoicesArray.some(i => String(i.invoiceId).toLowerCase() === String(id).toLowerCase()); }
function isPoIdDuplicate(id) { return purchasesArray.some(p => String(p.poNumber).toLowerCase() === String(id).toLowerCase()); }

function getStatusBadge(obj) {
  const safeStatus = (typeof obj === 'string' ? obj : (obj.status || 'unpaid')).toLowerCase();
  let bg = 'var(--surface3)', color = 'var(--ink2)';
  if (safeStatus === 'paid') { bg = 'var(--accent-light)'; color = 'var(--accent2)'; } 
  else if (safeStatus === 'unpaid') { bg = 'var(--danger-light)'; color = 'var(--danger)'; } 
  else if (safeStatus === 'overdue') { bg = 'var(--gold-light)'; color = 'var(--gold)'; } 
  else if (safeStatus === 'draft') { bg = 'var(--info-light)'; color = 'var(--info)'; }
  else if (safeStatus === 'partial') { bg = '#e0f2fe'; color = '#1d4ed8'; } 
  return `<span style="display:inline-block; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:700; text-transform:uppercase; background:${bg}; color:${color};">${safeStatus}</span>`;
}

function setButtonLoading(buttonElement, isLoading, originalText = 'Save') {
  if (!buttonElement) return;
  if (isLoading) { buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; } 
  else { buttonElement.disabled = false; buttonElement.innerHTML = originalText; }
}

function downloadDatabaseBackup() {
  toast('Generating database backup...', 'info');
  const backupData = { store_id: currentStoreId, timestamp: new Date().toISOString(), business_profile: bizProfile, customers: customersArray, inventory: inventoryStock, suppliers: suppliersArray, invoices: invoicesArray, purchases: purchasesArray, expenses: expensesArray };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
  const dlAnchor = document.createElement('a'); dlAnchor.setAttribute("href", dataStr); dlAnchor.setAttribute("download", `BillingSuite_Backup_${currentStoreId.replace(/\s+/g, '_')}_${today()}.json`);
  document.body.appendChild(dlAnchor); dlAnchor.click(); dlAnchor.remove(); toast('Backup downloaded successfully!', 'success');
}

// ══════════════════════════════════════════════════════════════
//        MISSING ENTERPRISE DASHBOARD CORE EXECUTOR ENCLOSURE
// ══════════════════════════════════════════════════════════════

// ─── FILTER HELPER BY TIME PERIOD ───
function isDocInPeriod(dateStr, period) {
  if (period === 'all') return true;
  if (!dateStr) return false;
  
  const docDate = new Date(dateStr);
  const todayDate = new Date();
  
  // Strip out time parameters for absolute calendar matching
  docDate.setHours(0,0,0,0);
  todayDate.setHours(0,0,0,0);
  
  const diffTime = todayDate - docDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (period === 'day') return docDate.toDateString() === todayDate.toDateString();
  if (period === 'week') return diffDays >= 0 && diffDays <= 7;
  if (period === 'month') return diffDays >= 0 && diffDays <= 30;
  return true;
}

// ─── BUTTON TRIGGER: DASHBOARD METRICS PERIOD ───
function setDashPeriod(period, btn) {
  currentDashPeriod = period;
  document.querySelectorAll('.dash-period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  
  // Sync descriptive period indicator labels across KPI cards
  const labels = { 'day': 'Today', 'week': 'Past 7 Days', 'month': 'Past 30 Days', 'all': 'All Time' };
  const lblText = labels[period] || 'All Time';
  
  const revL = document.getElementById('dashRevLabel'); if (revL) revL.textContent = lblText;
  const purL = document.getElementById('dashPurLabel'); if (purL) purL.textContent = lblText;
  const invL = document.getElementById('dashInvLabel'); if (invL) invL.textContent = lblText;

  updateDashboard(); // Recalculate and update values across every interface module
}

// ─── BUTTON TRIGGER: VIEW CHART TYPE OVERRIDES ───
let activeChartType = 'revpur';

function switchDashChart(chartType, btn = null) {

  // ─────────────────────────────────────────
  // SAVE ACTIVE TYPE
  // ─────────────────────────────────────────
  activeChartType = chartType;

  // ─────────────────────────────────────────
  // ACTIVE BUTTON UI
  // ─────────────────────────────────────────
  document.querySelectorAll('.chart-tab')
    .forEach(tab => tab.classList.remove('active'));

  if (btn) {
    btn.classList.add('active');
  }

  // ─────────────────────────────────────────
  // DYNAMIC TITLES
  // ─────────────────────────────────────────
  const titles = {

    revpur:
      'Revenue vs Purchases',

    salesrec:
      'Invoice Volume Analytics',

    salesamt:
      'Sales Growth Trend',

    profit:
      'Profit Performance',

    topcat:
      'Category Performance'

  };

  // ─────────────────────────────────────────
  // UPDATE TITLE
  // ─────────────────────────────────────────
  const titleEl =
    document.getElementById('dashChartTitle');

  if (titleEl) {
    titleEl.textContent =
      titles[chartType] || 'Business Analytics';
  }

  // ─────────────────────────────────────────
  // OPTIONAL SUBTITLE
  // ─────────────────────────────────────────
  const subtitle =
    document.getElementById('dashChartSubTitle');

  if (subtitle) {

    const subMap = {

      revpur:
        'Compare revenue against procurement costs',

      salesrec:
        'Track invoice generation volume',

      salesamt:
        'Visualize sales growth patterns',

      profit:
        'Monitor operational profitability',

      topcat:
        'Analyze best-performing categories'
    };

    subtitle.textContent =
      subMap[chartType] || '';
  }

  // ─────────────────────────────────────────
  // RE-RENDER CHART
  // ─────────────────────────────────────────
  renderDashChart();
}



// ─── MOBILE SIDEBAR LOGIC ───
document.addEventListener('DOMContentLoaded', () => {
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  
  // 1. Create the dark overlay element automatically
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay no-print';
  document.body.appendChild(overlay);

  // 2. The Toggle Engine
  function toggleMobileMenu() {
    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
      if(mobileBtn) mobileBtn.setAttribute('aria-expanded', 'false');
    } else {
      sidebar.classList.add('open');
      overlay.classList.add('open');
      if(mobileBtn) mobileBtn.setAttribute('aria-expanded', 'true');
    }
  }

  // 3. Bind clicks to the button and the dark overlay
  if (mobileBtn) mobileBtn.addEventListener('click', toggleMobileMenu);
  overlay.addEventListener('click', toggleMobileMenu);

  // 4. Auto-close the menu when a navigation item is clicked on mobile
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.innerWidth <= 900 && sidebar.classList.contains('open')) {
        toggleMobileMenu();
      }
    });
  });
});

// Micro internal helper string binder
function writeText(id, str) { const el = document.getElementById(id); if (el) el.textContent = str; }

// Kickoff Engine
window.addEventListener('DOMContentLoaded', () => {
  initThemeUI();
  initTabs();
  restoreViewButtons();
  loadSupabaseData();
  initCustomerAutoFill();
  initSupplierAutoFill();
  closeInvoiceEditor();
  closePurchaseEditor();
  closeCustomerLedger();
  closeSupplierLedger()
  setTimeout(() => { const layout = document.querySelector('.layout'); if (layout) layout.style.opacity = '1'; }, 50);
});

// ─── PERFORMANCE FAILSAFE: PREVENT WHITE SCREEN ───
window.addEventListener('DOMContentLoaded', () => {
  // Wait exactly 400ms. If the app hasn't painted yet, force it to appear.
  setTimeout(() => {
    const layout = document.querySelector('.layout');
    if (layout && layout.style.opacity === '0') {
      layout.style.opacity = '1';
      console.warn("Failsafe triggered: Forced UI paint.");
    }
  }, 400); 
});


// ══════════════════════════════════════════════════════════════
//        PERFECT HYBRID ERP DASHBOARD ENGINE
// ══════════════════════════════════════════════════════════════

let currentDashPeriod = 'month';
let dashChartInstance = null;

// ─────────────────────────────────────────────────────────────
// SAFE HELPERS
// ─────────────────────────────────────────────────────────────
function dashWrite(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function safeNum(v) {
  return parseFloat(v || 0) || 0;
}

function isDocInPeriod(dateStr, period = 'month') {
  if (period === 'all') return true;
  if (!dateStr) return false;

  const docDate = new Date(dateStr);
  const now = new Date();

  docDate.setHours(0,0,0,0);
  now.setHours(0,0,0,0);

  const diffDays = Math.floor((now - docDate) / (1000 * 60 * 60 * 24));

  if (period === 'day') return diffDays === 0;
  if (period === 'week') return diffDays >= 0 && diffDays <= 7;
  if (period === 'month') return diffDays >= 0 && diffDays <= 30;

  return true;
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD MASTER ENGINE
// ─────────────────────────────────────────────────────────────
function updateDashboard() {

  // ─── Greeting Logic ───
  const greeting = document.getElementById('dashGreetingText');

  if (greeting) {
    const hr = new Date().getHours();

    let text = 'Good Morning';

    if (hr >= 12 && hr < 17) {
      text = 'Good Afternoon';
    } else if (hr >= 17 || hr < 4) {
      text = 'Good Evening';
    }

    greeting.innerHTML = `${text}, Admin <span style="font-size:1.2rem;">👋</span>`;
  }

  dashWrite('dashDate', "Here's what's happening in your business today.");

  // ─────────────────────────────────────────────────────────
  // MASTER METRICS
  // ─────────────────────────────────────────────────────────

  let totalRevenue = 0;
  let totalReceivables = 0;
  let totalPurchases = 0;
  let totalPayables = 0;
  let totalExpenses = 0;
  let customerAdvances = 0;
  let totalStockValue = 0;
  let invoiceCount = 0;

  const activityLogs = [];
  const productSalesMap = new Map();
  const customerLeaderboard = {};

  // ─────────────────────────────────────────────────────────
  // INVOICES
  // ─────────────────────────────────────────────────────────

  invoicesArray.forEach(inv => {

    if (inv.status === 'draft') return;

    if (!isDocInPeriod(inv.date, currentDashPeriod)) return;

    const grand = safeNum(inv.grandTotal || inv.grand_total);
    const paid = safeNum(inv.amountPaid || inv.amount_paid);

    totalRevenue += grand;
    totalReceivables += Math.max(0, grand - paid);
    invoiceCount++;

    // Activity Feed
    activityLogs.push({
      type: 'sale',
      date: inv.date,
      text: `Invoice ${inv.invoiceId} created for ${inv.customerName}`,
      amount: grand
    });

    // Customer Leaderboard
    const cust = inv.customerName || 'Walk-In Customer';
    customerLeaderboard[cust] = (customerLeaderboard[cust] || 0) + grand;

    // Product Analytics
    (inv.items || []).forEach(it => {

      const rawName = it.description || it.product || it.desc || 'Unknown Product';

      const key = rawName.trim().toLowerCase();

      const qty = safeNum(it.quantity || it.qty);
      const price = safeNum(it.unitPrice || it.price);

      const revenue = qty * price;

      if (!productSalesMap.has(key)) {
        productSalesMap.set(key, {
          name: rawName,
          qtySold: 0,
          revenue: 0
        });
      }

      const data = productSalesMap.get(key);

      data.qtySold += qty;
      data.revenue += revenue;
    });
  });

  // ─────────────────────────────────────────────────────────
  // PURCHASES
  // ─────────────────────────────────────────────────────────

  purchasesArray.forEach(p => {

    if (!isDocInPeriod(p.date, currentDashPeriod)) return;

    const total = safeNum(p.totalAmount || p.total_amount);
    const paid = safeNum(p.amountPaid || p.amount_paid);

    totalPurchases += total;
    totalPayables += Math.max(0, total - paid);

    activityLogs.push({
      type: 'purchase',
      date: p.date,
      text: `Purchase ${p.poNumber} from ${p.supplier}`,
      amount: total
    });
  });

  // ─────────────────────────────────────────────────────────
  // EXPENSES
  // ─────────────────────────────────────────────────────────

  expensesArray.forEach(e => {

    if (!isDocInPeriod(e.date, currentDashPeriod)) return;

    const amt = safeNum(e.amount);

    totalExpenses += amt;

    activityLogs.push({
      type: 'expense',
      date: e.date,
      text: `Expense: ${e.desc || e.category}`,
      amount: amt
    });
  });

  // ─────────────────────────────────────────────────────────
  // CUSTOMER ADVANCES
  // ─────────────────────────────────────────────────────────

  customersArray.forEach(c => {
    customerAdvances += safeNum(c.advanceBalance || c.advancebalance);
  });

  // ─────────────────────────────────────────────────────────
  // STOCK VALUE
  // ─────────────────────────────────────────────────────────

  inventoryStock.forEach(p => {

    const stock = safeNum(p.stock);
    const price = safeNum(p.sellPrice || p.sell_price || p.price);

    totalStockValue += stock * price;
  });

  // ─────────────────────────────────────────────────────────
  // PROFIT CALCULATION
  // ─────────────────────────────────────────────────────────

  const netProfit = totalRevenue - totalPurchases - totalExpenses;

  const marginPct = totalRevenue > 0
    ? ((netProfit / totalRevenue) * 100).toFixed(1)
    : '0.0';

  // ─────────────────────────────────────────────────────────
  // KPI BINDING
  // ─────────────────────────────────────────────────────────

  dashWrite('dashTotalRevenue', '₹' + fmt(totalRevenue));
  dashWrite('dashInvoiceCount', invoiceCount);
  dashWrite('dashTotalPurchases', '₹' + fmt(totalPurchases));
  dashWrite('dashTotalProducts', inventoryStock.length);
  dashWrite('dashPendingReceivables', '₹' + fmt(totalReceivables));

  dashWrite('dashGrossProfit', '₹' + fmt(netProfit));
  dashWrite('dashTotalExpenses', '₹' + fmt(totalExpenses));
  dashWrite('dashProfitMargin', marginPct + '%');
  dashWrite('dashTotalReceivables', '₹' + fmt(totalReceivables));
  dashWrite('dashStockValueMetric', '₹' + fmt(totalStockValue));

  // ─────────────────────────────────────────────────────────
  // LOW STOCK ALERT
  // ─────────────────────────────────────────────────────────

  const threshold = typeof LOW_STOCK_THRESHOLD !== 'undefined'
    ? LOW_STOCK_THRESHOLD
    : 10;

  const lowStockCount = inventoryStock.filter(p => safeNum(p.stock) <= threshold).length;

  const lowBox = document.getElementById('dashLowStockAlertBox');

  if (lowBox) {
    lowBox.style.display = lowStockCount > 0 ? 'flex' : 'none';
  }

  dashWrite('dashLowStockCountText', `${lowStockCount} Low Stock Items`);

  // ─────────────────────────────────────────────────────────
  // OVERDUE ALERTS
  // ─────────────────────────────────────────────────────────

  const overdueInvoices = invoicesArray.filter(i => i.status === 'overdue');

  let overdueAmount = 0;

  overdueInvoices.forEach(i => {
    overdueAmount += Math.max(
      0,
      safeNum(i.grandTotal) - safeNum(i.amountPaid)
    );
  });

  const overdueBox = document.getElementById('dashOverdueAlertBox');

  if (overdueBox) {
    overdueBox.style.display = overdueInvoices.length > 0 ? 'flex' : 'none';
  }

  dashWrite('dashOverdueCountText', `${overdueInvoices.length} Overdue Invoices`);
  dashWrite('dashOverdueAmountText', `Total amount ₹${fmt(overdueAmount)}`);

  // ─────────────────────────────────────────────────────────
  // TOP PRODUCTS
  // ─────────────────────────────────────────────────────────

  renderDashTopProducts(productSalesMap);

  // ─────────────────────────────────────────────────────────
  // ACTIVITY FEED
  // ─────────────────────────────────────────────────────────

  renderDashActivity(activityLogs);

  // ─────────────────────────────────────────────────────────
  // CHARTS
  // ─────────────────────────────────────────────────────────

  renderDashChart();
}

// ─────────────────────────────────────────────────────────────
// TOP PRODUCTS RENDERER
// ─────────────────────────────────────────────────────────────
function renderDashTopProducts(productSalesMap) {

  const container = document.getElementById('dashTopProducts');

  if (!container) return;

  const sorted = Array.from(productSalesMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  if (!sorted.length) {
    container.innerHTML = `
      <div style="padding:20px; text-align:center; color:var(--ink3);">
        No sales yet.
      </div>
    `;
    return;
  }

  container.innerHTML = sorted.map((p, idx) => `

    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--surface3);">

      <div style="display:flex; align-items:center; gap:12px;">

        <div style="width:28px; height:28px; border-radius:50%; background:var(--surface2); display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:700;">
          ${idx + 1}
        </div>

        <div>
          <div style="font-weight:700; font-size:0.88rem;">${esc(p.name)}</div>
          <div style="font-size:0.74rem; color:var(--ink3);">
            ${p.qtySold} items sold
          </div>
        </div>
      </div>

      <div style="font-weight:700; color:var(--accent);">
        ₹${fmt(p.revenue)}
      </div>

    </div>

  `).join('');
}

// ─────────────────────────────────────────────────────────────
// ACTIVITY FEED
// ─────────────────────────────────────────────────────────────
function renderDashActivity(logs) {

  const feed = document.getElementById('dashActivityFeed');

  if (!feed) return;

  logs.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!logs.length) {
    feed.innerHTML = `
      <div style="padding:20px; text-align:center; color:var(--ink3);">
        No activity yet.
      </div>
    `;
    return;
  }

  feed.innerHTML = logs.slice(0, 6).map(log => {

    let icon = 'fa-file-invoice';
    let color = 'var(--info)';

    if (log.type === 'purchase') {
      icon = 'fa-shopping-cart';
      color = 'var(--gold)';
    }

    if (log.type === 'expense') {
      icon = 'fa-wallet';
      color = 'var(--danger)';
    }

    return `

      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid var(--surface3);">

        <div style="display:flex; align-items:center; gap:12px;">

          <div style="width:34px; height:34px; border-radius:50%; background:var(--surface2); display:flex; align-items:center; justify-content:center; color:${color};">
            <i class="fas ${icon}"></i>
          </div>

          <div>
            <div style="font-size:0.84rem; font-weight:600;">
              ${esc(log.text)}
            </div>
            <div style="font-size:0.72rem; color:var(--ink3);">
              ${dateLabel(log.date)}
            </div>
          </div>

        </div>

        <div style="font-weight:700; font-size:0.85rem;">
          ₹${fmt(log.amount)}
        </div>

      </div>

    `;

  }).join('');
}

// ─────────────────────────────────────────────────────────────
// CHART ENGINE
// ─────────────────────────────────────────────────────────────
function renderDashChart() {

  const canvas =
    document.getElementById('dashMainChart');

  if (!canvas) return;

  // Destroy previous chart
  if (dashChartInstance) {
    dashChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');

  // ─────────────────────────────────────────
  // SETTINGS
  // ─────────────────────────────────────────
  const scope =
    document.getElementById('chartScopeSelect')
    ?.value || 'month';

  const totalMonths =
    scope === 'year' ? 12 : 6;

  const labels = [];

  const sales =
    Array(totalMonths).fill(0);

  const purchases =
    Array(totalMonths).fill(0);

  const profits =
    Array(totalMonths).fill(0);

  const invoiceCounts =
    Array(totalMonths).fill(0);

  const now = new Date();

  // ─────────────────────────────────────────
  // LABELS
  // ─────────────────────────────────────────
  for (let i = totalMonths - 1; i >= 0; i--) {

    const d = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1
    );

    labels.push(
      d.toLocaleString('default', {
        month: 'short'
      })
    );
  }

  // ─────────────────────────────────────────
  // MONTH INDEX
  // ─────────────────────────────────────────
  function monthIndex(dateStr) {

    if (!dateStr) return -1;

    const d = new Date(dateStr);

    for (let i = totalMonths - 1; i >= 0; i--) {

      const target = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1
      );

      if (
        d.getMonth() === target.getMonth() &&
        d.getFullYear() === target.getFullYear()
      ) {
        return totalMonths - 1 - i;
      }
    }

    return -1;
  }

  // ─────────────────────────────────────────
  // INVOICE DATA
  // ─────────────────────────────────────────
  invoicesArray.forEach(i => {

    if (i.status === 'draft') return;

    const idx = monthIndex(i.date);

    if (idx < 0) return;

    const grand =
      safeNum(i.grandTotal);

    sales[idx] += grand;

    invoiceCounts[idx] += 1;
  });

  // ─────────────────────────────────────────
  // PURCHASE DATA
  // ─────────────────────────────────────────
  purchasesArray.forEach(p => {

    const idx = monthIndex(p.date);

    if (idx < 0) return;

    purchases[idx] +=
      safeNum(p.totalAmount);
  });

  // ─────────────────────────────────────────
  // PROFIT DATA
  // ─────────────────────────────────────────
  for (let i = 0; i < totalMonths; i++) {

    profits[i] =
      sales[i] - purchases[i];
  }

  // ─────────────────────────────────────────
  // CHART MODES
  // ─────────────────────────────────────────
  let datasets = [];
  let chartType = 'bar';

  // Revenue vs Purchases
  if (activeChartType === 'revpur') {

    datasets = [

      {
        label: 'Sales',
        data: sales,
        borderRadius: 8
      },

      {
        label: 'Purchases',
        data: purchases,
        borderRadius: 8
      }
    ];
  }

  // Invoice Volume
  else if (activeChartType === 'salesrec') {

    chartType = 'line';

    datasets = [

      {
        label: 'Invoices',
        data: invoiceCounts,
        tension: 0.4,
        fill: true
      }
    ];
  }

  // Sales Trend
  else if (activeChartType === 'salesamt') {

    chartType = 'line';

    datasets = [

      {
        label: 'Sales Growth',
        data: sales,
        tension: 0.45,
        fill: true
      }
    ];
  }

  // Profit
  else if (activeChartType === 'profit') {

    chartType = 'line';

    datasets = [

      {
        label: 'Profit',
        data: profits,
        tension: 0.45,
        fill: true
      }
    ];
  }

  // Default fallback
  else {

    datasets = [

      {
        label: 'Sales',
        data: sales,
        borderRadius: 8
      }
    ];
  }

  // ─────────────────────────────────────────
  // RENDER CHART
  // ─────────────────────────────────────────
  dashChartInstance = new Chart(ctx, {

    type: chartType,

    data: {
      labels,
      datasets
    },

    options: {

      responsive: true,

      maintainAspectRatio: false,

      interaction: {
        intersect: false,
        mode: 'index'
      },

      plugins: {

        legend: {
          position: 'top'
        },

        tooltip: {
          enabled: true
        }
      },

      scales: {

        x: {
          grid: {
            display: false
          }
        },

        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────
// PERIOD FILTER
// ─────────────────────────────────────────────────────────────
function updateDashboardMetrics() {

  const sel = document.getElementById('dashPeriodSelect');

  currentDashPeriod = sel ? sel.value : 'month';

  updateDashboard();
}
