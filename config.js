// ─── CONFIG ───────────────────────────────────
const API_URL = "https://script.google.com/macros/s/AKfycbwJupk6QkzY_BMKwMD1GZwq3fMxcL_L5Ma6IOu8uxctzgLaN0OGsQgZiaZoBbrxpR-k/exec";
let LOW_STOCK_THRESHOLD = 10;

// ─── NAMESPACE — all state in one object (fix: no more accidental global overwrites) ──
const App = {
  customersArray: [],
  inventoryStock: [],
  invoicesArray: [],
  purchasesArray: [],
  suppliersArray: [],
  productViewMode: 'grid',
  invLineItems: [{ desc: "", qty: 1, price: 0, gstRate: 0.18 }],
  purLineItems: [{ desc: "", qty: 1, cost: 0, gstRate: 0.18 }],
  invGstType: "Exclusive",
  purGstType: "Exclusive",
  invDiscType: "flat",
  chartSales: null, chartProfit: null, chartPie: null,
  reportRange: { from: null, to: null },
  isSaving: false,   // fix: prevents double-click duplicate saves
  editingInvoiceId: null,   // <--- ADD THIS
  editingPurchaseId: null,   // <--- ADD THIS
  editingInvoiceStatus: 'paid' // <--- ADD THIS
};

// Shorthand references (for backward-compatibility across files)
let customersArray   = App.customersArray;
let inventoryStock   = App.inventoryStock;
let invoicesArray    = App.invoicesArray;
let purchasesArray   = App.purchasesArray;
let suppliersArray   = App.suppliersArray;
let productViewMode  = App.productViewMode;
let invLineItems     = App.invLineItems;
let purLineItems     = App.purLineItems;
let invGstType       = App.invGstType;
let purGstType       = App.purGstType;
let invDiscType      = App.invDiscType;
let chartSales       = App.chartSales;
let chartProfit      = App.chartProfit;
let chartPie         = App.chartPie;
let reportRange      = App.reportRange;

// ─── SETTINGS ─────────────────────────────────
let bizProfile = JSON.parse(localStorage.getItem('bs_settings')) || {
  name: '', gstin: '', address: '', phone: '', email: '',
  pan: '', bankName: '', bankAcc: '', bankIFSC: '', state: '',
  terms: '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.',
  logo: '', printTemplate: 'tpl-standard', supplyType: 'intra', printSize: 'auto',
  // 👇 Default variables for the new tabs
  invPrefix: 'INV-', payTerms: 'Due on Receipt',
  poPrefix: 'PO-', deliveryLoc: '', defaultMargin: 50
};

// ─── SETTINGS LOAD / SAVE ─────────────────────
function loadSettings() {
  // Sync the latest saved settings from memory
  const s = localStorage.getItem('bs_settings');
  if (s) bizProfile = { ...bizProfile, ...JSON.parse(s) };

  // Safe helper to prevent crashes if an HTML element is missing
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

  // Business Tab
  setVal('settBizName', bizProfile.name || '');
  setVal('settGSTIN', bizProfile.gstin || '');
  setVal('settBizAddr', bizProfile.address || '');
  setVal('state-list',  bizProfile.state || '');
  setVal('settPhone',   bizProfile.phone || '');
  setVal('settEmail',   bizProfile.email || '');
  setVal('settPAN',     bizProfile.pan || '');
  setVal('settBankName',bizProfile.bankName || '');
  setVal('settBankAcc', bizProfile.bankAcc || '');
  setVal('settBankIFSC',bizProfile.bankIFSC || '');
  
  // Invoice & Purchase Tabs 
  setVal('settTerms',       bizProfile.terms || '');
  setVal('settInvPrefix',   bizProfile.invPrefix || 'INV-');
  setVal('settPayTerms',    bizProfile.payTerms || 'Due on Receipt');
  setVal('settPoPrefix',    bizProfile.poPrefix || 'PO-');
  setVal('settDeliveryLoc', bizProfile.deliveryLoc || '');
  
  // Product Tab
  setVal('settDefaultMargin', bizProfile.defaultMargin || 50);

  // Dropdowns (Template, Size, Tax)
  const tplSel = document.getElementById('settPrintTemplate');
  if (tplSel) { 
    tplSel.value = bizProfile.printTemplate || 'tpl-standard'; 
    if (typeof selectTemplate === 'function') selectTemplate(tplSel.value, true);
  }
  const sizeSel = document.getElementById('settPrintSize');
  if (sizeSel) sizeSel.value = bizProfile.printSize || 'auto';
  const supSel = document.getElementById('settSupplyType');
  if (supSel) supSel.value = bizProfile.supplyType || 'intra';
  
  // Low Stock Threshold
  const thresh = localStorage.getItem('bs_thresh');
  if (thresh) { 
    LOW_STOCK_THRESHOLD = parseInt(thresh); 
    setVal('settLowStockThresh', LOW_STOCK_THRESHOLD);
  }
  
  if (typeof updatePrintHeaders === 'function') updatePrintHeaders();
}

// ─── SAVE SETTINGS & BUSINESS PROFILE ────────────────────
function saveSettings() {
  // 1. Collect all data from the Settings form
  bizProfile.name       = document.getElementById('settBizName')?.value.trim()  || '';
  bizProfile.gstin      = document.getElementById('settGSTIN')?.value.trim() || '';
  bizProfile.address    = document.getElementById('settBizAddr')?.value.trim() || '';
  bizProfile.state      = document.getElementById('state-list')?.value || '';
  bizProfile.phone      = document.getElementById('settPhone')?.value.trim() || '';
  bizProfile.email      = document.getElementById('settEmail')?.value.trim() || '';
  bizProfile.pan        = document.getElementById('settPAN')?.value.trim() || '';
  bizProfile.bankName   = document.getElementById('settBankName')?.value.trim() || '';
  bizProfile.bankAcc    = document.getElementById('settBankAcc')?.value.trim() || '';
  bizProfile.bankIFSC   = document.getElementById('settBankIFSC')?.value.trim() || '';
  
  bizProfile.terms        = document.getElementById('settTerms')?.value.trim() || '';
  bizProfile.invPrefix    = document.getElementById('settInvPrefix')?.value.trim() || 'INV-';
  bizProfile.payTerms     = document.getElementById('settPayTerms')?.value.trim() || '';
  bizProfile.poPrefix     = document.getElementById('settPoPrefix')?.value.trim() || 'PO-';
  bizProfile.deliveryLoc  = document.getElementById('settDeliveryLoc')?.value.trim() || '';
  bizProfile.defaultMargin = parseInt(document.getElementById('settDefaultMargin')?.value) || 50;

  const tplSel = document.getElementById('settPrintTemplate');
  if (tplSel) bizProfile.printTemplate = tplSel.value;
  const supSel = document.getElementById('settSupplyType');
  const sizeSel = document.getElementById('settPrintSize');
  if (sizeSel) bizProfile.printSize = sizeSel.value;
  if (supSel) bizProfile.supplyType = supSel.value;
  
  LOW_STOCK_THRESHOLD = parseInt(document.getElementById('settLowStockThresh')?.value) || 10;
  
  // 2. Save instantly to local browser storage
  localStorage.setItem('bs_settings', JSON.stringify(bizProfile));
  localStorage.setItem('bs_thresh', LOW_STOCK_THRESHOLD);
  
  if (typeof updatePrintHeaders === 'function') updatePrintHeaders();
  
  toast('Syncing settings to database...', 'warn');
  
  // 3. Send payload to Google Apps Script Backend
  const payload = {
    action: "saveSettings",
    settings: bizProfile
  };

  fetch(API_URL, { 
    method: "POST", 
    mode: "no-cors", 
    headers: { "Content-Type": "text/plain;charset=utf-8" }, 
    body: JSON.stringify(payload) 
  }).then(() => {
    toast('Business profile saved permanently!', 'success');
  }).catch(err => {
    console.error(err);
    toast('Saved locally, but offline.', 'error');
  });
}

// ─── SHARED GST HELPER (fix: single source of truth — was copy-pasted 6x) ──
function calcGST(base, gstRate, gstType) {
  if (gstType === 'Inclusive') {
    const gst = base - base / (1 + gstRate);
    return { gst, subtotalPart: base - gst, total: base };
  } else {
    const gst = base * gstRate;
    return { gst, subtotalPart: base, total: base + gst };
  }
}

// ─── SMART GST ENGINE ─────────────────────────────────
function getSmartSupplyType(customerGstin) {
  // 1. Get your business state code from the Settings tab
  const myStateCode = document.getElementById('state-list')?.value;
  
  // 2. If customer has no GSTIN, or it's too short -> Intra-state (CGST+SGST)
  if (!customerGstin || customerGstin.trim().length < 2) {
    return 'intra'; 
  }
  
  // 3. Extract the first 2 characters of the customer's GSTIN
  const custStateCode = customerGstin.trim().substring(0, 2);
  
  // 4. Compare and decide
  if (myStateCode && custStateCode === myStateCode) {
    return 'intra'; // Same state -> CGST + SGST
  } else {
    return 'inter'; // Different state -> IGST
  }
}

// ─── HTML ESCAPE (fix: XSS — never inject raw user input into innerHTML) ──
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── LOGO ENCODER ─────────────────────────────
function encodeLogo(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      bizProfile.logo = e.target.result;
      const prev = document.getElementById('logoPreview');
      if (prev) { prev.src = e.target.result; prev.style.display = 'block'; }
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// ─── TEMPLATE PREVIEW ─────────────────────────
function updateTemplatePreview() {
  const tpl = document.getElementById('settPrintTemplate').value;
  const viz = document.getElementById('tplPreviewViz');
  const descTitle = document.querySelector('#tplPreviewDesc h4');
  const descText  = document.querySelector('#tplPreviewDesc p');
  if (!viz) return;
  viz.className = 'tpl-viz ' + tpl.replace('tpl-', '');
  const map = {
    'tpl-standard':  ['Standard Professional', 'A clean, traditional portrait layout — ideal for standard B2B billing.'],
    'tpl-minimal':   ['Clean & Minimalist',    'Strips borders and heavy color for a sleek, ink-saving design.'],
    'tpl-bold':      ['Bold & Modern',         'Uses brand colors heavily in the header and totals for a premium look.'],
    'tpl-landscape': ['Wide Data (Landscape)', 'Flips the page horizontally — perfect for invoices with many columns.'],
    'tpl-elegant':   ['Elegant Serif',         'Uses a serif font with a side-accent bar — classic and premium feel.'],
    'tpl-twocolor':  ['Two-Colour Pro',        'A deep navy header paired with an amber accent stripe — striking contrast.'],
    'tpl-compact':   ['Compact Receipt',       'Narrow, receipt-style layout for quick POS or retail invoices.'],
  };
  const [title, desc] = map[tpl] || ['Custom', ''];
  if (descTitle) descTitle.textContent = title;
  if (descText)  descText.textContent  = desc;
}

function updatePrintHeaders() {
  ['printBizName','purPrintBizName'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = esc(bizProfile.name); });
  const ga = document.getElementById('printBizAddr'); if (ga) ga.textContent = esc(bizProfile.address);
  const gg = document.getElementById('printBizGst');  if (gg) gg.textContent = bizProfile.gstin ? 'GSTIN: ' + esc(bizProfile.gstin) : '';
  const pl = document.getElementById('printLogo');
  if (pl && bizProfile.logo) { pl.src = bizProfile.logo; pl.style.display = 'block'; }
}

// ─── DATA BACKUP / RESTORE (new feature) ──────
function exportBackup() {
  const data = {
    invoices:   invoicesArray,
    purchases:  purchasesArray,
    customers:  customersArray,
    suppliers:  suppliersArray,
    inventory:  inventoryStock,
    settings:   bizProfile,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'BillingSuite_backup_' + today() + '.json';
  a.click();
  toast('Backup exported!', 'success');
}

function importBackup(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.invoices)  { invoicesArray.length = 0;  invoicesArray.push(...data.invoices);  localStorage.setItem('bs_invoices',   JSON.stringify(invoicesArray)); }
      if (data.purchases) { purchasesArray.length = 0; purchasesArray.push(...data.purchases); localStorage.setItem('bs_purchases',  JSON.stringify(purchasesArray)); }
      if (data.customers) { customersArray.length = 0; customersArray.push(...data.customers); }
      if (data.suppliers) { suppliersArray.length = 0; suppliersArray.push(...data.suppliers); }
      if (data.inventory) { inventoryStock.length = 0; inventoryStock.push(...data.inventory); }
      if (data.settings)  { bizProfile = { ...bizProfile, ...data.settings }; localStorage.setItem('bs_settings', JSON.stringify(bizProfile)); }
      renderInvoiceLists(); renderPurchaseLists(); updateDashboard();
      renderInventoryTable(); renderProductGrid(); renderCustomerGrid();
      loadSettings();
      toast('Backup restored successfully!', 'success');
    } catch(err) {
      toast('Invalid backup file', 'error');
    }
  };
  reader.readAsText(input.files[0]);
}

// ─── DARK MODE ────────────────────────────────
function toggleDark() { setTheme(document.documentElement.getAttribute('data-theme') !== 'dark'); }
function setTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
  const pill = document.getElementById('darkPill');
  if (pill) pill.className = 'toggle-pill' + (dark ? ' on' : '');
  localStorage.setItem('bs_dark', dark ? '1' : '0');
}
function loadTheme() { if (localStorage.getItem('bs_dark') === '1') setTheme(true); }

// ─── UTILS ────────────────────────────────────
function fmt(n) {
  const num = parseFloat(n) || 0;
  return '₹' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function today() { return new Date().toISOString().slice(0, 10); }
function dateLabel(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch(e) { return d; }
}

// ─── UTILITIES ─────────────────────────────────

// Safely calculates highest ID using custom prefixes from Settings
function getNextId(array, fallbackPrefix) {
  // Grab custom prefix from settings, or use fallback
  const customPrefix = fallbackPrefix === 'INV' 
    ? (typeof bizProfile !== 'undefined' && bizProfile.invPrefix ? bizProfile.invPrefix : 'INV-') 
    : (typeof bizProfile !== 'undefined' && bizProfile.poPrefix ? bizProfile.poPrefix : 'PO-');
  
  if (!array || !array.length) return `${customPrefix}001`;
  
  let maxNum = 0;
  
  array.forEach(item => {
    const id = item.invoiceId || item.poNumber || '';
    // This safely extracts the numbers at the end of the string, ignoring the letters
    const match = id.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  });
  
  return `${customPrefix}${String(maxNum + 1).padStart(3, '0')}`;
}

// fix: check for duplicate invoice ID before saving
function isInvoiceIdDuplicate(id) { return invoicesArray.some(i => i.invoiceId === id); }
function isPoIdDuplicate(id)      { return purchasesArray.some(p => p.poNumber === id); }

function getStatusBadge(inv) {
  const s = inv.status;
  if (!s || s === 'paid')    return '<span class="badge status-paid">Paid</span>';
  if (s === 'unpaid')        return '<span class="badge status-unpaid">Unpaid</span>';
  if (s === 'draft')         return '<span class="badge status-draft">Draft</span>';
  if (s === 'overdue')       return '<span class="badge status-overdue">Overdue</span>';
  return '<span class="badge badge-green">Saved</span>';
}

function toast(msg, type = 'success', undoFn = null) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const icons = { success: 'check-circle', error: 'times-circle', warn: 'exclamation-circle' };
  const d = document.createElement('div');
  d.className = `toast ${type}`;
  d.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i> ${esc(msg)}`;
  if (undoFn) {
    const ub = document.createElement('button');
    ub.className = 'toast-undo';
    ub.textContent = 'Undo';
    ub.onclick = () => { undoFn(); d.remove(); };
    d.appendChild(ub);
  }
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 4500);
}

// ─── MODAL ────────────────────────────────────
function closeModal() { document.getElementById('detailModal').classList.remove('open'); }
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('detailModal');
  if (overlay) overlay.addEventListener('click', function(e) { if (e.target === this) closeModal(); });
});

function selectTemplate(tplId) {
  // 1. Reset all buttons back to normal
  document.querySelectorAll('.template-item').forEach(el => {
    el.classList.remove('active');
    const btn = el.querySelector('.btn-secondary, .btn-success');
    if (btn) { 
      btn.className = 'btn btn-secondary btn-sm'; 
      btn.innerHTML = 'Select Default'; 
    }
  });
  
  // 2. Highlight the clicked card and change button to Green 'Active'
  const activeEl = document.getElementById('opt-' + tplId);
  if (activeEl) {
    activeEl.classList.add('active');
    const btn = activeEl.querySelector('.btn-secondary, .btn-success');
    if (btn) { 
      btn.className = 'btn btn-success btn-sm'; 
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Active'; 
      btn.style.backgroundColor = 'var(--accent2)';
      btn.style.borderColor = 'var(--accent2)';
      btn.style.color = 'white';
    }
  }
  
  // 3. Save to database INSTANTLY
  const hiddenInput = document.getElementById('settPrintTemplate');
  if (hiddenInput) hiddenInput.value = tplId;
  
  bizProfile.printTemplate = tplId; 
  localStorage.setItem('bs_settings', JSON.stringify(bizProfile)); 
  
  toast('Default template saved!', 'success');
}

// ─── IMAGE UPLOAD LOGIC (Upgraded with Preview & Delete) ───

function processImageUpload(inputElement, keyName) {
  const file = inputElement.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const base64String = event.target.result;
    
    // 1. Save to memory
    bizProfile[keyName] = base64String;
    localStorage.setItem("bs_profile", JSON.stringify(bizProfile));
    
    // 2. Instantly show the preview UI
    showImagePreview(keyName, base64String);
    
    toast(`${keyName === 'logo' ? 'Logo' : 'Signature'} saved successfully!`, 'success');
  };
  
  reader.readAsDataURL(file); 
}

// Helper: Displays the preview box
function showImagePreview(keyName, srcString) {
  const isLogo = keyName === 'logo';
  const imgEl = document.getElementById(isLogo ? 'logoPreviewImg' : 'sigPreviewImg');
  const containerEl = document.getElementById(isLogo ? 'logoPreviewContainer' : 'sigPreviewContainer');
  
  if (imgEl && containerEl && srcString) {
    imgEl.src = srcString;
    containerEl.style.display = 'block';
  }
}

// Helper: Deletes the image from memory and hides the preview
function removeImage(keyName) {
  // 1. Wipe it from memory
  bizProfile[keyName] = '';
  localStorage.setItem("bs_profile", JSON.stringify(bizProfile));
  
  // 2. Hide the preview box
  const isLogo = keyName === 'logo';
  const containerEl = document.getElementById(isLogo ? 'logoPreviewContainer' : 'sigPreviewContainer');
  const inputEl = document.getElementById(isLogo ? 'logoInput' : 'sigInput');
  
  if (containerEl) containerEl.style.display = 'none';
  if (inputEl) inputEl.value = ''; // Clears the file input text
  
  toast(`${keyName === 'logo' ? 'Logo' : 'Signature'} removed.`, 'warn');
}

// ─── INITIALIZE PREVIEWS ON PAGE LOAD ───
function loadSettingsPreviews() {
  if (bizProfile.logo) showImagePreview('logo', bizProfile.logo);
  if (bizProfile.signature) showImagePreview('signature', bizProfile.signature);
}
