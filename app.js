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

// ─── UPGRADED ENTERPRISE DASHBOARD COMPUTATION ENGINE ──────────────────
function updateDashboard() {
  // TIME-AWARE DYNAMIC GREETING LOGIC
  const dashGreeting = document.getElementById('dashGreetingText');
  if (dashGreeting) {
    const hours = new Date().getHours();
    let greetingWord = "Good Morning";
    
    if (hours >= 12 && hours < 17) {
      greetingWord = "Good Afternoon";
    } else if (hours >= 17 || hours < 4) {
      greetingWord = "Good Evening";
    }
    
    dashGreeting.innerHTML = `${greetingWord}, Admin <span style="font-size:1.4rem;">👋</span>`;
  }

  const dashDate = document.getElementById('dashDate');
  if (dashDate) dashDate.textContent = "Here's what's happening in your business today.";

  let totalRevenue = 0;
  let totalReceivables = 0;
  let totalPurchases = 0;
  let totalPayables = 0;
  let totalExpenses = 0;
  let customerAdvances = 0;
  let totalStockAssetValue = 0;

  // 1. Calculate Customer Invoices & Outstanding Receivables
  invoicesArray.forEach(i => {
    if (i.status === 'draft') return;
    totalRevenue += parseFloat(i.grandTotal || i.grandtotal || 0);
    totalReceivables += Math.max(0, parseFloat(i.grandTotal || i.grandtotal || 0) - parseFloat(i.amountPaid || i.amountpaid || 0));
  });

  // 2. Calculate Supplier Procurement Volume & Active Accounts Payable
  purchasesArray.forEach(p => {
    totalPurchases += parseFloat(p.totalAmount || p.total || 0);
    totalPayables += Math.max(0, parseFloat(p.totalAmount || p.total || 0) - parseFloat(p.amountPaid || p.amountpaid || 0));
  });

  // 3. Calculate Operational Expense Outlays
  expensesArray.forEach(e => {
    totalExpenses += parseFloat(e.amount || 0);
  });

  // 4. Sum Registered Client Advance Reserves
  customersArray.forEach(c => {
    customerAdvances += parseFloat(c.advanceBalance || c.advancebalance || 0);
  });

  // 5. Calculate Total Real-time Catalog Stock Assets Inventory Valuation
  inventoryStock.forEach(p => {
    const stockQty = parseFloat(p.stock || 0);
    const salePrice = parseFloat(p.sellPrice || p.price || 0);
    if (stockQty > 0) {
      totalStockAssetValue += (stockQty * salePrice);
    }
  });

  // 6. Compute True Net Profit Margins
  const netProfit = totalRevenue - totalPurchases - totalExpenses;
  const marginPct = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  // 7. Bind Values Safely onto the Live Wireframe Layout DOM Elements
  const bindVal = (id, val, isCurrency = true) => {
    const el = document.getElementById(id);
    if (el) el.textContent = isCurrency ? "₹" + fmt(val) : val;
  };

  // Primary Metrics Row Card Elements
  bindVal('dashTotalRevenue', totalRevenue);
  bindVal('dashInvoiceCount', invoicesArray.filter(i => i.status !== 'draft').length, false);
  bindVal('dashTotalPurchases', totalPurchases);
  bindVal('dashTotalProducts', inventoryStock.length, false);

  // Bottom Business Summary Metrics Layout Row Elements
  bindVal('dashGrossProfit', netProfit);
  bindVal('dashTotalExpenses', totalExpenses);
  bindVal('dashTotalReceivables', totalReceivables);
  bindVal('dashTotalPayables', totalPayables);
  bindVal('dashCustomerAdvances', customerAdvances);
  bindVal('dashStockValueMetric', totalStockAssetValue);

  const marginEl = document.getElementById('dashProfitMargin');
  if (marginEl) marginEl.textContent = marginPct + "%";

  // 8. Handle Overdue & Low Stock Side Alert Cards
  const lowStockCount = inventoryStock.filter(p => parseFloat(p.stock || 0) <= (bizProfile.lowStockThreshold || 10)).length;
  const lowStockBox = document.getElementById('dashLowStockAlertBox');
  if (lowStockBox) {
    lowStockBox.style.display = lowStockCount > 0 ? 'flex' : 'none';
    const txt = document.getElementById('dashLowStockCountText');
    if (txt) txt.textContent = `${lowStockCount} Low Stock Items`;
  }

  const overdueInvoices = invoicesArray.filter(i => i.status === 'overdue');
  const overdueBox = document.getElementById('dashOverdueAlertBox');
  if (overdueBox) {
    overdueBox.style.display = overdueInvoices.length > 0 ? 'flex' : 'none';
    const txtCount = document.getElementById('dashOverdueCountText');
    const txtAmt = document.getElementById('dashOverdueAmountText');
    
    let totalOverdueAmt = 0;
    overdueInvoices.forEach(i => totalOverdueAmt += (parseFloat(i.grandTotal || i.grandtotal || 0) - parseFloat(i.amountPaid || i.amountpaid || 0)));
    
    if (txtCount) txtCount.textContent = `${overdueInvoices.length} Overdue Invoices`;
    if (txtAmt) txtAmt.textContent = `Total amount ₹${fmt(totalOverdueAmt)}`;
  }

  // 9. Compile and Render the "Top Selling Products" Ranking Catalog Rows
  renderDashTopProductsCatalog();

  // 10. Update History Widgets and Refresh Charts
  if (typeof renderInvoiceLists === 'function') renderInvoiceLists();
  if (typeof renderPurchaseLists === 'function') renderPurchaseLists();
  if (typeof renderDashChart === 'function') renderDashChart();
}

// ─── HELPER CORE: HIGH-DENSITY TOP PRODUCT EXTRACTOR ──────────────────
function renderDashTopProductsCatalog() {
  const container = document.getElementById('dashTopProducts');
  if (!container) return;

  // Compile total item sales frequencies from saved invoices
  const productSalesMap = new Map();

  invoicesArray.forEach(inv => {
    if (inv.status === 'draft') return;
    (inv.items || []).forEach(it => {
      const name = it.description || it.product || it.desc || 'Unknown Product';
      const qty = parseFloat(it.quantity || it.qty || 0);
      const price = parseFloat(it.unitPrice || it.price || 0);
      const itemRevenue = qty * price;

      if (!productSalesMap.has(name)) {
        productSalesMap.set(name, { name: name, qtySold: 0, revenue: 0 });
      }
      const data = productSalesMap.get(name);
      data.qtySold += qty;
      data.revenue += itemRevenue;
    });
  });

  // Sort descending by highest generated revenue volumes
  const sortedProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5); // Take top 5 lines just like the mockup image

  if (sortedProducts.length === 0) {
    container.innerHTML = `<p style="text-align:center; font-size:0.8rem; color:var(--ink3); padding:20px 0;">No sales logged this period.</p>`;
    return;
  }

  container.innerHTML = sortedProducts.map((p, index) => `
    <div class="catalog-row">
      <div class="catalog-item-info">
        <span class="catalog-index-badge">${index + 1}</span>
        <div class="catalog-item-text">
          <span class="catalog-title">${esc(p.name)}</span>
          <span class="catalog-subtext">${p.qtySold} items sold</span>
        </div>
      </div>
      <span class="catalog-valuation">₹${fmt(p.revenue)}</span>
    </div>
  `).join('');
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

    if (allStoresRes && allStoresRes.data && storeDropdown) {
      Array.from(storeDropdown.options).forEach(opt => {
        const sData = allStoresRes.data.find(s => s.store_id === opt.value);
        if (sData && sData.profile_data && sData.profile_data.storeAlias) {
          opt.text = `${opt.value} — ${sData.profile_data.storeAlias}`;
        } else { opt.text = opt.value; }
      });
    }

    if (settRes.data && settRes.data.profile_data) { bizProfile = settRes.data.profile_data; } 
    else { bizProfile = {}; }
    if (typeof populateSettingsUI === 'function') populateSettingsUI();

    // Mapping with Type Safety Coercion
    inventoryStock.length = 0; 
    if (invRes.data) {
      inventoryStock.push(...invRes.data.map(p => ({ 
        ...p, costPrice: parseFloat(p.cost_price || 0), sellPrice: parseFloat(p.sell_price || 0), gstRate: parseFloat(p.gst_rate || 0), stock: parseFloat(p.stock || 0) 
      })));
    }
    
    customersArray.length = 0; 
    if (custRes.data) {
      customersArray.push(...custRes.data.map(c => ({ ...c, advanceBalance: parseFloat(c.advanceBalance || 0) })));
    }
    
    suppliersArray.length = 0; 
    if (suppRes.data) {
      suppliersArray.push(...suppRes.data.map(s => ({ ...s, paymentTerms: s.payment_terms, advanceBalance: parseFloat(s.advanceBalance || 0) })));
    }
    
    expensesArray.length = 0;  
    if (expRes.data) {
      expensesArray.push(...expRes.data.map(e => ({ ...e, desc: e.desc_text, amount: parseFloat(e.amount || 0) })));
    }
    
    invoicesArray.length = 0;  
    if (invcRes.data) {
      invoicesArray.push(...invcRes.data.map(i => ({
        ...i, subtotal: parseFloat(i.subtotal||0), gstAmount: parseFloat(i.gstAmount||0), discount: parseFloat(i.discount||0), grandTotal: parseFloat(i.grandTotal||0), amountPaid: parseFloat(i.amountPaid||0)
      })));
    }
    
    purchasesArray.length = 0; 
    if (purRes.data) {
      purchasesArray.push(...purRes.data.map(p => ({
        ...p, subtotal: parseFloat(p.subtotal||0), gstAmount: parseFloat(p.gstAmount||0), totalAmount: parseFloat(p.totalAmount||0), amountPaid: parseFloat(p.amountPaid||0)
      })));
    }

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
  if (type === 'invoice') { arr = invoicesArray; key = 'invoiceId'; prefix = bizProfile.invPrefix || 'INV-'; } 
  else if (type === 'purchase') { arr = purchasesArray; key = 'poNumber'; prefix = bizProfile.poPrefix || 'PO-'; } 
  else if (type === 'product') { arr = inventoryStock; key = 'id'; prefix = 'ITM-'; }
  const pfx = prefix.endsWith('-') ? prefix : prefix + '-';
  if (!arr || arr.length === 0) return pfx + '001';
  let max = 0;
  arr.forEach(obj => {
    const str = String(obj[key] || '');
    const match = str.match(/\d+$/);
    if (match) { const num = parseInt(match[0], 10); if (num > max) max = num; }
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

let currentDashPeriod = 'all'; // Global state tracker for period metrics
let activeChartType = 'revpur'; // Global state tracker for Chart.js view types
let dashChartInstance = null;  // Chart.js instance holder context for safe redraws

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
function switchDashChart(chartType, btn) {
  activeChartType = chartType;
  document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  
  const titles = {
    'revpur': 'Revenue vs Purchases Breakdown',
    'salesrec': 'Volume Analysis (Total Invoices)',
    'salesamt': 'Sales Trajectory Growth Inflow Curves',
    'profit': 'Profit Projections margin',
    'topcat': 'Product Categories Performance'
  };
  const titleEl = document.getElementById('dashChartTitle');
  if (titleEl) titleEl.textContent = titles[chartType] || 'Financial Matrix Analytics';

  renderDashChart(); // Re-index datasets and redraw chart layouts
}

// ─── MASTER ENTRY POINT FOR DATA BINDING WIDGETS ───
function updateDashboard() {
  const dashDate = document.getElementById('dashDate');
  if (dashDate) dashDate.textContent = "Live Financial Metrics Summary: " + dateLabel(today());

  let totalRevenue = 0, totalReceivables = 0, invoiceCount = 0;
  let totalPurchases = 0, totalPayables = 0;
  let totalExpenses = 0, customerAdvances = 0;

  // Track product velocity and buyer metrics inside historical memory maps
  const productVelocity = {}, customerLeaderboard = {}, activityLogs = [];

  // 1. Process Customer Sales Invoices
  invoicesArray.forEach(i => {
    if (i.status === 'draft') return;
    
    // Log Activity Context
    activityLogs.push({ date: i.date, text: `Invoice ${i.invoiceId} raised for ${i.customerName}`, type: 'sale', amt: i.grandTotal });
    
    if (!isDocInPeriod(i.date, currentDashPeriod)) return;

    totalRevenue += (i.grandTotal || 0);
    totalReceivables += Math.max(0, (i.grandTotal || 0) - (i.amountPaid || 0));
    invoiceCount++;

    // Track Customer Volume Metrics
    const cKey = i.customerName || 'Walk-In Customer';
    customerLeaderboard[cKey] = (customerLeaderboard[cKey] || 0) + (i.grandTotal || 0);

    // Track Product Sales Item Loops
    (i.items || []).forEach(it => {
      const pKey = it.description || it.desc || 'Unknown Item';
      productVelocity[pKey] = (productVelocity[pKey] || 0) + (parseFloat(it.quantity) || 0);
    });
  });

  // 2. Process Supplier Procurement Orders
  purchasesArray.forEach(p => {
    activityLogs.push({ date: p.date, text: `Purchase Order ${p.poNumber} booked with ${p.supplier}`, type: 'purchase', amt: p.totalAmount });
    
    if (!isDocInPeriod(p.date, currentDashPeriod)) return;
    
    totalPurchases += (p.totalAmount || 0);
    totalPayables += Math.max(0, (p.totalAmount || 0) - (p.amountPaid || 0));
  });

  // 3. Process Expenditures
  expensesArray.forEach(e => {
    activityLogs.push({ date: e.date, text: `Expense logged: ${e.desc || e.category}`, type: 'expense', amt: e.amount });
    
    if (!isDocInPeriod(e.date, currentDashPeriod)) return;
    totalExpenses += (e.amount || 0);
  });

  // 4. Summarize Credits (Always absolute total value)
  customersArray.forEach(c => customerAdvances += (c.advanceBalance || 0));

  // Compute Net Net Operational Margins
  const netProfit = totalRevenue - totalPurchases - totalExpenses;
  const marginPct = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  // Bind parameters cleanly straight into HTML interface locations
  const writeText = (id, str) => { const el = document.getElementById(id); if (el) el.textContent = str; };
  
  writeText('dashTotalRevenue', '₹' + fmt(totalRevenue));
  writeText('dashTotalPurchases', '₹' + fmt(totalPurchases));
  writeText('dashTotalExpenses', '₹' + fmt(totalExpenses));
  writeText('dashGrossProfit', '₹' + fmt(netProfit));
  writeText('dashTotalReceivables', '₹' + fmt(totalReceivables));
  writeText('dashTotalPayables', '₹' + fmt(totalPayables));
  writeText('dashCustomerAdvances', '₹' + fmt(customerAdvances));
  writeText('dashProfitMargin', marginPct + '%');
  writeText('dashInvCount', invoiceCount);

  // 5. Populate Reminder Flags & Live Notification Overdue Elements
  const overdueWidget = document.getElementById('dashOverdueWidget');
  if (overdueWidget) {
    const outstandingBills = invoicesArray.filter(i => i.status !== 'paid' && i.status !== 'draft');
    const pill = document.getElementById('dashOverduePill');
    const pillTxt = document.getElementById('dashOverduePillText');
    
    if (outstandingBills.length > 0) {
      if (pill) pill.style.display = 'inline-flex';
      if (pillTxt) pillTxt.textContent = `${outstandingBills.length} outstanding bills`;
      document.getElementById('dashOverdueTotalBar').style.display = 'block';
      writeText('dashOverdueTotal', '₹' + fmt(totalReceivables));
      
      overdueWidget.innerHTML = outstandingBills.slice(0, 3).map(i => `
        <div class="list-item" onclick="showInvoiceDetail('${esc(i.invoiceId)}')">
          <div>
            <div class="list-item-title">${esc(i.invoiceId)} · ${esc(i.customerName)}</div>
            <div class="list-item-sub">Outstanding Balance: <strong>₹${fmt((i.grandTotal||0)-(i.amountPaid||0))}</strong></div>
          </div>
          <div>${getStatusBadge(i.status)}</div>
        </div>
      `).join('');
    } else {
      if (pill) pill.style.display = 'none';
      document.getElementById('dashOverdueTotalBar').style.display = 'none';
      overdueWidget.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--accent2)"></i><p style="color:var(--accent2)">All customer pipelines completely cleared!</p></div>';
    }
  }

  // 6. Populate Top Customers Leaderboard
  const topCustWidget = document.getElementById('dashTopCustomers');
  if (topCustWidget) {
    const sortedCust = Object.keys(customerLeaderboard).sort((a,b) => customerLeaderboard[b] - customerLeaderboard[a]);
    topCustWidget.innerHTML = sortedCust.length ? sortedCust.slice(0,3).map((name, idx) => `
      <div class="list-item">
        <div><div class="list-item-title"><i class="fas fa-medal" style="color:${idx===0?'#gold':idx===1?'#silver':'#cd7f32'}; margin-right:6px"></i>${esc(name)}</div></div>
        <div style="text-align:right"><div class="list-item-amount">₹${fmt(customerLeaderboard[name])}</div><div class="list-item-sub">Total Contributed Revenue</div></div>
      </div>
    `).join('') : '<div class="empty-state"><i class="fas fa-users"></i><p>Save customer invoices to generate ranks.</p></div>';
  }

  // 7. Populate Fast Moving Stock Items List
  const topProdWidget = document.getElementById('dashTopProducts');
  if (topProdWidget) {
    const sortedProds = Object.keys(productVelocity).sort((a,b) => productVelocity[b] - productVelocity[a]);
    topProdWidget.innerHTML = sortedProds.length ? sortedProds.slice(0, 3).map(pName => {
      const stockMatch = inventoryStock.find(x => x.name.toLowerCase() === pName.toLowerCase());
      const remainingStock = stockMatch ? stockMatch.stock : 0;
      return `
        <div class="list-item">
          <div><div class="list-item-title">${esc(pName)}</div><div class="list-item-sub">Current Stock On Hand: ${remainingStock} units</div></div>
          <div style="text-align:right"><div class="list-item-amount" style="color:var(--accent2)">${productVelocity[pName]} units</div><div class="list-item-sub">Volume Sold</div></div>
        </div>`;
    }).join('') : '<div class="empty-state"><i class="fas fa-box"></i><p>Sales velocities show up here after billing.</p></div>';
  }

  // 8. Render Real-time Activity Feed Logs
  const feedWidget = document.getElementById('dashActivityFeed');
  if (feedWidget) {
    activityLogs.sort((a,b) => new Date(b.date) - new Date(a.date));
    feedWidget.innerHTML = activityLogs.length ? activityLogs.slice(0, 4).map(log => {
      let icon = 'fa-file-invoice-dollar', iconColor = 'var(--info)';
      if (log.type === 'purchase') { icon = 'fa-truck'; iconColor = 'var(--gold)'; }
      if (log.type === 'expense') { icon = 'fa-wallet'; iconColor = 'var(--danger)'; }
      return `
        <div class="list-item" style="padding: 10px 14px;">
          <div style="display:flex; gap:12px; align-items:center;">
            <i class="fas ${icon}" style="color:${iconColor}; background:var(--surface2); padding:8px; border-radius:50%; width:16px; text-align:center;"></i>
            <div><div class="list-item-title" style="font-size:0.85rem">${esc(log.text)}</div><div class="list-item-sub">${dateLabel(log.date)}</div></div>
          </div>
          <div style="text-align:right; font-weight:600; font-size:0.85rem;">₹${fmt(log.amt)}</div>
        </div>`;
    }).join('') : '<div class="empty-state"><i class="fas fa-stream"></i><p>No transactions registered across this active database.</p></div>';
  }

  // Run the data visual charts generator
  renderDashChart();
}

// ─── DATA RENDERING ENGINE: CHART.JS GRAPH CORE VIA APP.JS ───
function renderDashChart() {
  const canvas = document.getElementById('dashMainChart');
  if (!canvas) return;
  
  // Safe Cleanup: Destroy preceding reference footprints before repainting
  if (dashChartInstance) { dashChartInstance.destroy(); dashChartInstance = null; }

  const ctx = canvas.getContext('2d');
  
  // Setup baseline rolling chronological 6-month indexing maps
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const labels = [];
  const monthlyRevenue = Array(6).fill(0);
  const monthlyPurchases = Array(6).fill(0);
  const monthlyNet = Array(6).fill(0);

  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(monthNames[d.getMonth()] + " " + String(d.getFullYear()).slice(-2));
  }

  // Helper macro index locator
  const getMonthIndex = (dateStr) => {
    if (!dateStr) return -1;
    const d = new Date(dateStr);
    for (let i = 5; i >= 0; i--) {
      const target = new Date(now.getFullYear(), now.getMonth() - i, 1);
      if (d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth()) return 5 - i;
    }
    return -1;
  };

  // Compile totals maps sequentially
  invoicesArray.forEach(i => {
    if (i.status === 'draft') return;
    const idx = getMonthIndex(i.date);
    if (idx >= 0) monthlyRevenue[idx] += (i.grandTotal || 0);
  });
  purchasesArray.forEach(p => {
    const idx = getMonthIndex(p.date);
    if (idx >= 0) monthlyPurchases[idx] += (p.totalAmount || 0);
  });
  for (let idx = 0; idx < 6; idx++) {
    monthlyNet[idx] = monthlyRevenue[idx] - monthlyPurchases[idx];
  }

  // Update Chart Header Total Fields dynamically
  const total6MRev = monthlyRevenue.reduce((a, b) => a + b, 0);
  const total6MPur = monthlyPurchases.reduce((a, b) => a + b, 0);
  writeText('dashCMRev', '₹' + fmt(total6MRev));
  writeText('dashCMPur', '₹' + fmt(total6MPur));
  writeText('dashCMProfit', '₹' + fmt(total6MRev - total6MPur));

  // Determine structural view configurations based on chart options selected
  let chartData = {};
  const themeAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1a4a3a';
  const themeGold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#c8933a';

  if (activeChartType === 'revpur') {
    chartData = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Revenue Inflow', data: monthlyRevenue, backgroundColor: themeAccent, borderRadius: 4 },
          { label: 'Procurement Purchases', data: monthlyPurchases, backgroundColor: themeGold, borderRadius: 4 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.03)' } }, x: { grid: { display: false } } } }
    };
  } 
  else if (activeChartType === 'salesamt' || activeChartType === 'profit') {
    const focusData = activeChartType === 'salesamt' ? monthlyRevenue : monthlyNet;
    const focusLabel = activeChartType === 'salesamt' ? 'Sales Inflow Progress' : 'Net Operations Margin';
    chartData = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{ label: focusLabel, data: focusData, borderColor: themeAccent, backgroundColor: 'rgba(26, 74, 58, 0.05)', fill: true, tension: 0.3, borderWidth: 3 }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    };
  }
  else {
    // Basic fallback context mapping to line view configuration for density
    chartData = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{ label: 'Sales Activity Tracking Index', data: monthlyRevenue, borderColor: themeGold, tension: 0.1, fill: false }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    };
  }

  dashChartInstance = new Chart(ctx, chartData);
}

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
  setTimeout(() => { const layout = document.querySelector('.layout'); if (layout) layout.style.opacity = '1'; }, 50);
});

