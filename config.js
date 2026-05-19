// ─── SUPABASE CONFIGURATION ───────────────────────────────────
const SUPABASE_URL = 'https://obalzdolembdywxuyyqu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3w_55vQzZezuVA37H4Y4TQ_QYFC1cms';
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentStoreId = 'Store 1'; 
let LOW_STOCK_THRESHOLD = 10;

// ─── NAMESPACE — all state in one object ──
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
  isSaving: false,
  editingInvoiceId: null,
  editingPurchaseId: null,
  editingInvoiceStatus: 'paid'
};

// Shorthand references
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
let bizProfile       = {};


// ─── SUPABASE SYNC: SAVE SETTINGS ──────────────────────────
// ─── SUPABASE SYNC: SAVE SETTINGS ──────────────────────────
async function saveSettings() {
  bizProfile.storeAlias = document.getElementById('settStoreAlias')?.value.trim() || '';
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
  bizProfile.bankHolder = document.getElementById('settBankHolder')?.value.trim() || '';
  bizProfile.bankBranch = document.getElementById('settBankBranch')?.value.trim() || '';
  
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

  const isChecked = (id) => document.getElementById(id) ? document.getElementById(id).checked : true;
  bizProfile.printOptions = {
    showLogo:     isChecked('ptShowLogo'), showBizAddr:  isChecked('ptShowBizAddr'),
    showBizGst:   isChecked('ptShowBizGst'), showBizPan:   isChecked('ptShowBizPan'),
    showTaxLabel: isChecked('ptShowTaxLabel'), showHsn:      isChecked('ptShowHsn'),
    showTax:      isChecked('ptShowTax'), showPos:      isChecked('ptShowPos'),
    showBank:     isChecked('ptShowBank'), showTerms:    isChecked('ptShowTerms'), showSig:      isChecked('ptShowSig')
  };

  const btn = document.getElementById('saveSettingsBtn');
  if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  // Push securely to Supabase
  const { error } = await supabase.from('store_settings').upsert([
    { store_id: currentStoreId, profile_data: bizProfile }
  ]);

  if (btn) btn.innerHTML = '<i class="fas fa-save"></i> Save Settings';

  if (error) {
    console.error(error);
    toast('Failed to save to cloud.', 'error');
  } else {
    toast(`${currentStoreId} profile saved successfully!`, 'success');
  }
}

// ─── POPULATE SETTINGS UI WHEN STORE CHANGES ───────────────
function populateSettingsUI() {

  initStateDropdown();

  const stateSelect = document.getElementById('state-list');
  if (stateSelect && bizProfile && bizProfile.state) {
    stateSelect.value = bizProfile.state;
  }
  const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
  
  setVal('settStoreAlias', bizProfile.storeAlias);
  setVal('settBizName', bizProfile.name);
  setVal('settGSTIN', bizProfile.gstin);
  setVal('settBizAddr', bizProfile.address);
  setVal('state-list', bizProfile.state);
  setVal('settPhone', bizProfile.phone);
  setVal('settEmail', bizProfile.email);
  setVal('settPAN', bizProfile.pan);
  setVal('settBankName', bizProfile.bankName);
  setVal('settBankAcc', bizProfile.bankAcc);
  setVal('settBankIFSC', bizProfile.bankIFSC);
  setVal('settBankHolder', bizProfile.bankHolder);
  setVal('settBankBranch', bizProfile.bankBranch);
  setVal('settTerms', bizProfile.terms);
  setVal('settInvPrefix', bizProfile.invPrefix);
  setVal('settPoPrefix', bizProfile.poPrefix);
  
  const logoCont = document.getElementById('logoPreviewContainer');
  const sigCont = document.getElementById('sigPreviewContainer');

  if (bizProfile.logo) {
    showImagePreview('logo', bizProfile.logo);
  } else {
    if (logoCont) logoCont.style.display = 'none';
    const logoInput = document.getElementById('logoInput');
    if (logoInput) logoInput.value = '';
  }

  if (bizProfile.signature) {
    showImagePreview('signature', bizProfile.signature);
  } else {
    if (sigCont) sigCont.style.display = 'none';
    const sigInput = document.getElementById('sigInput');
    if (sigInput) sigInput.value = '';
  }
}

// ─── IMAGE UPLOAD HANDLING ──────────────────────────────
function processImageUpload(input, keyName) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Str = e.target.result;
    bizProfile[keyName] = base64Str;
    showImagePreview(keyName, base64Str);
    toast(`${keyName === 'logo' ? 'Logo' : 'Signature'} updated (Remember to Save Settings)`, 'info');
  };
  reader.readAsDataURL(file);
}

function showImagePreview(keyName, src) {
  const isLogo = keyName === 'logo';
  const containerEl = document.getElementById(isLogo ? 'logoPreviewContainer' : 'sigPreviewContainer');
  const imgEl = document.getElementById(isLogo ? 'logoPreviewImg' : 'sigPreviewImg');
  
  if (imgEl && containerEl) {
    imgEl.src = src;
    containerEl.style.display = 'block';
  }
}

function removeImage(keyName) {
  bizProfile[keyName] = '';
  
  const isLogo = keyName === 'logo';
  const containerEl = document.getElementById(isLogo ? 'logoPreviewContainer' : 'sigPreviewContainer');
  const inputEl = document.getElementById(isLogo ? 'logoInput' : 'sigInput');
  
  if (containerEl) containerEl.style.display = 'none';
  if (inputEl) inputEl.value = '';
  
  toast(`${keyName === 'logo' ? 'Logo' : 'Signature'} removed.`, 'warn');
}

function loadSettingsPreviews() {
  if (bizProfile.logo) showImagePreview('logo', bizProfile.logo);
  if (bizProfile.signature) showImagePreview('signature', bizProfile.signature);
}


