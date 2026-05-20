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
  
  bizProfile.terms         = document.getElementById('settTerms')?.value.trim() || '';
  bizProfile.invPrefix     = document.getElementById('settInvPrefix')?.value.trim() || 'INV-';
  bizProfile.payTerms      = document.getElementById('settPayTerms')?.value.trim() || '';
  bizProfile.poPrefix      = document.getElementById('settPoPrefix')?.value.trim() || 'PO-';
  bizProfile.productPrefix = document.getElementById('settProductPrefix')?.value.trim() || 'ITM-';
  bizProfile.deliveryLoc   = document.getElementById('settDeliveryLoc')?.value.trim() || '';
  bizProfile.costMargin = parseFloat(document.getElementById('settCostMargin')?.value) || 30;
  bizProfile.sellingMargin = parseFloat(document.getElementById('settSellingMargin')?.value) || 40;

  const tplSel = document.getElementById('settPrintTemplate');
  if (tplSel) bizProfile.printTemplate = tplSel.value;
  
  const sizeSel = document.getElementById('settPrintSize');
  if (sizeSel) bizProfile.printSize = sizeSel.value;
  
  const supSel = document.getElementById('settSupplyType');
  if (supSel) bizProfile.supplyType = supSel.value;
  
  // FIX 1: Attach to the payload first, then update the global variable
  bizProfile.lowStockThreshold = parseInt(document.getElementById('settLowStockThresh')?.value) || 10;
  LOW_STOCK_THRESHOLD = bizProfile.lowStockThreshold;

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

  // FIX 2: Added conflict resolution to ensure true Upsert behavior
  const { error } = await supabase
    .from('store_settings')
    .upsert(
      [{ store_id: currentStoreId, profile_data: bizProfile }],
      { onConflict: 'store_id' } 
    );

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
  if (typeof initStateDropdown === 'function') initStateDropdown();

  // Safely sets values without overriding with undefined
  const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val !== undefined ? val : ''; };
  const setCheck = (id, val) => { const el = document.getElementById(id); if(el) el.checked = (val !== false); };
  
  // 1. Map Text and Input Parameter Controls
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
  setVal('settPayTerms', bizProfile.payTerms);
  setVal('settPoPrefix', bizProfile.poPrefix);
  setVal('settDeliveryLoc', bizProfile.deliveryLoc);
  
  // ─── UPDATED: New Margin & Prefix Architecture ───
  setVal('settProductPrefix', bizProfile.productPrefix);
  setVal('settCostMargin', bizProfile.costMargin);
  setVal('settSellingMargin', bizProfile.sellingMargin);
  
  LOW_STOCK_THRESHOLD = bizProfile.lowStockThreshold || bizProfile.settLowStockThresh || 10;
  setVal('settLowStockThresh', LOW_STOCK_THRESHOLD);

  // 2. Map and Restore Select Dropdown State Mappings
  setVal('settPrintTemplate', bizProfile.printTemplate || 'tpl-standard');
  setVal('settPrintSize', bizProfile.printSize || 'auto');
  setVal('settSupplyType', bizProfile.supplyType || 'intra');

  // 3. Highlight Selected Template Selection Visual Cards on Refresh
  const currentTemplate = bizProfile.printTemplate || 'tpl-standard';
  
  // Clear layout button active states
  document.querySelectorAll('.template-item').forEach(el => {
    el.classList.remove('active');
    const btn = el.querySelector('.btn-secondary, .btn-success');
    if (btn) { btn.className = 'btn btn-secondary btn-sm'; btn.innerHTML = 'Select Default'; }
  });

  // Apply Active styling onto your saved choice card panel
  const savedCard = document.getElementById('opt-' + currentTemplate);
  if (savedCard) {
    savedCard.classList.add('active');
    const btn = savedCard.querySelector('.btn-secondary, .btn-success');
    if (btn) {
      btn.className = 'btn btn-success btn-sm';
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Active';
      btn.style.backgroundColor = 'var(--accent2)';
      btn.style.borderColor = 'var(--accent2)';
      btn.style.color = 'white';
    }
  }

  // 4. Map and Bind Print Option Checklist Checkbox Configurations
  const opts = bizProfile.printOptions || {};
  setCheck('ptShowLogo', opts.showLogo);
  setCheck('ptShowBizAddr', opts.showBizAddr);
  setCheck('ptShowBizGst', opts.showBizGst);
  setCheck('ptShowBizPan', opts.showBizPan);
  setCheck('ptShowTaxLabel', opts.showTaxLabel);
  setCheck('ptShowHsn', opts.showHsn);
  setCheck('ptShowTax', opts.showTax);
  setCheck('ptShowPos', opts.showPos);
  setCheck('ptShowBank', opts.showBank);
  setCheck('ptShowTerms', opts.showTerms);
  setCheck('ptShowSig', opts.showSig);
  
  // 5. Handle Graphic Previews
  const logoCont = document.getElementById('logoPreviewContainer');
  const sigCont = document.getElementById('sigPreviewContainer');

  if (bizProfile.logo) { showImagePreview('logo', bizProfile.logo); } 
  else { if (logoCont) logoCont.style.display = 'none'; }
  
  if (bizProfile.signature) { showImagePreview('signature', bizProfile.signature); } 
  else { if (sigCont) sigCont.style.display = 'none'; }
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

function selectTemplate(tplId) {
  if (!tplId) return;
  
  // 1. Normalize the ID string to prevent duplicate "tpl-" prefix bugs
  const cleanId = tplId.startsWith('tpl-') ? tplId : 'tpl-' + tplId;
  const targetElementId = 'opt-' + cleanId;

  // 2. Clear out previous active styling from all selection items
  document.querySelectorAll('.template-item').forEach(el => {
    el.classList.remove('active');
    const btn = el.querySelector('.btn-secondary, .btn-success');
    if (btn) { 
      btn.className = 'btn btn-secondary btn-sm'; 
      btn.innerHTML = 'Select Default'; 

      btn.style.backgroundColor = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }
  });
  
  // 3. Apply high-contrast active styling to the chosen template card
  const activeEl = document.getElementById(targetElementId);
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
  
  // 4. Update the hidden tracking input box element safely
  const hiddenInput = document.getElementById('settPrintTemplate');
  if (hiddenInput) hiddenInput.value = cleanId;
  
  // 5. Update local memory object state properties safely
  bizProfile.printTemplate = cleanId;
  
  // 6. SURGICAL CLOUD SAVE: Syncs local bizProfile to Supabase
  if (window.supabase && typeof currentStoreId !== 'undefined' && currentStoreId) {
    supabase.from('store_settings')
      .upsert(
        [{ store_id: currentStoreId, profile_data: bizProfile }],
        { onConflict: 'store_id' } // FIX: Ensure we update the existing store row, not duplicate!
      )
      .then(({ error }) => {
        if (error) {
          console.error("Cloud template sync failed:", error);
          toast('Saved template locally, cloud sync delayed.', 'warn');
        } else {
          toast(`Default template updated to ${cleanId.replace('tpl-', '')}!`, 'success');
        }
      });
  }
}

function setContactView(type, tab) {
  const container = document.getElementById(tab.toLowerCase() + 'Grid');
  const btnGrid = document.getElementById('btnGrid' + tab);
  const btnList = document.getElementById('btnList' + tab);
  const btnDetail = document.getElementById('btnDetail' + tab);
  if (!container || !btnGrid || !btnList || !btnDetail) return;

  [btnGrid, btnList, btnDetail].forEach(btn => {
    btn.classList.remove('active'); btn.style.background = 'transparent'; btn.style.color = 'var(--ink3)';
  });

  container.classList.remove('view-grid', 'view-list', 'view-detail');
  container.classList.add('view-' + type);
  
  let activeBtn = type === 'grid' ? btnGrid : (type === 'list' ? btnList : btnDetail);
  activeBtn.classList.add('active'); activeBtn.style.background = 'white'; activeBtn.style.color = 'var(--ink)';
}

function closeModal() { 
  document.getElementById('detailModal')?.classList.remove('open'); 
}

async function loadStoreSettingsOnBoot() {
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('profile_data')
      .eq('store_id', currentStoreId)
      .single();

    if (error) throw error;

    if (data && data.profile_data) {
      // FIX 1: The "Amnesia" Bug
      // Safely mutate bizProfile to preserve memory references across all files!
      if (typeof bizProfile === 'undefined') window.bizProfile = {}; 
      
      // Clear the old keys out of the object
      Object.keys(bizProfile).forEach(key => delete bizProfile[key]); 
      
      // Inject the new keys directly into the existing object memory space
      Object.assign(bizProfile, data.profile_data); 

      // FIX 2: Ensure dependent global variables are synced
      if (bizProfile.lowStockThreshold) {
        LOW_STOCK_THRESHOLD = parseInt(bizProfile.lowStockThreshold, 10);
      }

      // FIX 3: Fire the layout mapping engine to draw saved defaults on screen!
      if (typeof populateSettingsUI === 'function') {
        populateSettingsUI();
      }
      
      console.log(`Store settings profile for ${currentStoreId} mapped and painted successfully.`);
    }
  } catch (err) {
    console.error("Error executing system boot configuration metrics:", err);
  }
}