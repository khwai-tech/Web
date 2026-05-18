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

// ─── UI: TABS & NAVIGATION ──────────────────────────────
// ─── UI: TABS & NAVIGATION (WITH MEMORY) ──────────────────────────────
// ─── UI: TABS & NAVIGATION ──────────────────────────────
function initTabs() {
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
      localStorage.setItem('bs_active_tab', btn.dataset.tab); // Save main tab
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
      localStorage.setItem('bs_active_stab_' + parent.id, btn.dataset.stab); // Save sub-tab
    });
  });

  // 1. Immediately jump to the saved tab (or default to dashboard)
  const savedTab = localStorage.getItem('bs_active_tab') || 'dashboard';
  switchTab(savedTab);

  // 2. Restore Sub-Tabs quietly
  document.querySelectorAll('.tab-pane').forEach(pane => {
    const savedStab = localStorage.getItem('bs_active_stab_' + pane.id);
    if (savedStab) {
      const stabBtn = pane.querySelector(`.sec-tab[data-stab="${savedStab}"]`);
      if (stabBtn) stabBtn.click();
    }
  });
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
  // Finds ALL modals and completely clears any stuck inline styles
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.classList.remove('open');
    modal.style.display = ''; 
  });
}

function closeSampleModal() {
  const m = document.getElementById('sampleModal');
  if (m) {
    m.classList.remove('open');
    m.style.display = '';
  }
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
    // Fetch all 7 tables
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

    // Update the Dropdown Labels to show custom Store Names
    if (allStoresRes && allStoresRes.data && storeDropdown) {
      Array.from(storeDropdown.options).forEach(opt => {
        const sData = allStoresRes.data.find(s => s.store_id === opt.value);
        if (sData && sData.profile_data && sData.profile_data.storeAlias) {
          opt.text = `${opt.value} — ${sData.profile_data.storeAlias}`;
        } else {
          opt.text = opt.value; 
        }
      });
    }

    // Inject Cloud Settings into UI
    if (settRes.data && settRes.data.profile_data) {
      bizProfile = settRes.data.profile_data;
    } else {
      bizProfile = {}; 
    }
    if (typeof populateSettingsUI === 'function') populateSettingsUI();

    // Map SQL to JS (inventory and suppliers still use snake_case)
    inventoryStock.length = 0; if (invRes.data) inventoryStock.push(...invRes.data.map(p => ({ ...p, costPrice: p.cost_price, sellPrice: p.sell_price, gstRate: p.gst_rate })));
    suppliersArray.length = 0; if (suppRes.data) suppliersArray.push(...suppRes.data.map(s => ({ ...s, paymentTerms: s.payment_terms })));
    expensesArray.length = 0;  if (expRes.data) expensesArray.push(...expRes.data.map(e => ({ ...e, desc: e.desc_text })));
    customersArray.length = 0; if (custRes.data) customersArray.push(...custRes.data);
    
    // Invoices and Purchases map perfectly now thanks to your DB changes!
    invoicesArray.length = 0;  if (invcRes.data) invoicesArray.push(...invcRes.data);
    purchasesArray.length = 0; if (purRes.data) purchasesArray.push(...purRes.data);

    if (statusLabel) statusLabel.textContent = 'Supabase Connected';
    const lastSyncLabel = document.getElementById('apiLastSync');
    if (lastSyncLabel) lastSyncLabel.textContent = 'Store: ' + currentStoreId;
    
    if (typeof updateDatalists === 'function') updateDatalists();
    if (typeof renderInventoryTable === 'function') renderInventoryTable();
    if (typeof renderProductGrid === 'function') renderProductGrid();
    if (typeof renderCustomerGrid === 'function') renderCustomerGrid();
    if (typeof renderSupplierGrid === 'function') renderSupplierGrid();
    if (typeof renderInvoiceLists === 'function') renderInvoiceLists();
    if (typeof renderPurchaseLists === 'function') renderPurchaseLists();
    if (typeof renderExpenses === 'function') renderExpenses();
    if (typeof updateDashboard === 'function') updateDashboard();

  } catch (error) {
    console.error("Supabase Sync Error:", error);
    if (led) led.className = 'led error';
    if (statusLabel) statusLabel.textContent = 'Offline';
    toast('Failed to sync with Supabase.', 'error');
  }
}

// ══════════════════════════════════════════════════════════════
//        GLOBAL UTILITY & HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════

function esc(str) {
  if (str === null || str === undefined) return '';
  return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt(num) {
  return parseFloat(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function dateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

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

function numberToWords(num) {
  if (!num || num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function inWords(n) {
    let str = "";
    if (n > 9999999) { str += inWords(Math.floor(n / 10000000)) + " Crore "; n %= 10000000; }
    if (n > 99999)   { str += inWords(Math.floor(n / 100000)) + " Lakh "; n %= 100000; }
    if (n > 999)     { str += inWords(Math.floor(n / 1000)) + " Thousand "; n %= 1000; }
    if (n > 99)      { str += inWords(Math.floor(n / 100)) + " Hundred "; n %= 100; }
    if (n > 19)      { str += tens[Math.floor(n / 10)] + " "; n %= 10; }
    if (n > 0)       { str += ones[n] + " "; }
    return str.trim();
  }
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);
  let result = inWords(integerPart);
  if (decimalPart > 0) result += " and " + inWords(decimalPart) + " Paisa";
  return result;
}

// ─── ID GENERATORS ───
function getNextId(type) {
  let arr, key, prefix;
  
  if (type === 'invoice') {
    arr = invoicesArray; key = 'invoiceId'; prefix = bizProfile.invPrefix || 'INV-';
  } else if (type === 'purchase') {
    arr = purchasesArray; key = 'poNumber'; prefix = bizProfile.poPrefix || 'PO-';
  } else if (type === 'product') {
    arr = inventoryStock; key = 'id'; prefix = 'ITM-';
  }
  
  // Ensure the prefix ends cleanly with a dash if the user didn't type one
  const pfx = prefix.endsWith('-') ? prefix : prefix + '-';
  
  if (!arr || arr.length === 0) return pfx + '001';
  
  let max = 0;
  arr.forEach(obj => {
    const str = String(obj[key] || '');
    const match = str.match(/\d+$/); // Grabs the number at the very end
    if (match) {
      const num = parseInt(match[0], 10);
      if (num > max) max = num;
    }
  });
  
  return pfx + (max + 1).toString().padStart(3, '0');
}

function isInvoiceIdDuplicate(id) {
  return invoicesArray.some(i => String(i.invoiceId).toLowerCase() === String(id).toLowerCase());
}

function isPoIdDuplicate(id) {
  return purchasesArray.some(p => String(p.poNumber).toLowerCase() === String(id).toLowerCase());
}

// ─── UI BADGES ───
function getStatusBadge(obj) {
  const safeStatus = (typeof obj === 'string' ? obj : (obj.status || 'unpaid')).toLowerCase();
  let bg = 'var(--surface3)', color = 'var(--ink2)';
  if (safeStatus === 'paid') { bg = 'var(--accent-light)'; color = 'var(--accent2)'; } 
  else if (safeStatus === 'unpaid') { bg = 'var(--danger-light)'; color = 'var(--danger)'; } 
  else if (safeStatus === 'overdue') { bg = 'var(--gold-light)'; color = 'var(--gold)'; } 
  else if (safeStatus === 'draft') { bg = 'var(--info-light)'; color = 'var(--info)'; }
  return `<span style="display:inline-block; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:700; text-transform:uppercase; background:${bg}; color:${color};">${safeStatus}</span>`;
}

// ─── BUTTON SPINNERS ───
function setButtonLoading(buttonElement, isLoading, originalText = 'Save') {
  if (!buttonElement) return;
  if (isLoading) {
    buttonElement.disabled = true;
    buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  } else {
    buttonElement.disabled = false;
    buttonElement.innerHTML = originalText;
  }
}

// ─── 1-CLICK DATABASE BACKUP ──────────────────────────────
function downloadDatabaseBackup() {
  toast('Generating database backup...', 'info');
  const backupData = {
    store_id: currentStoreId,
    timestamp: new Date().toISOString(),
    business_profile: bizProfile,
    customers: customersArray,
    inventory: inventoryStock,
    suppliers: suppliersArray,
    invoices: invoicesArray,
    purchases: purchasesArray,
    expenses: expensesArray
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `BillingSuite_Backup_${currentStoreId.replace(/\s+/g, '_')}_${today()}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
  toast('Backup downloaded successfully!', 'success');
}



// ══════════════════════════════════════════════════════════════
//        DASHBOARD & REPORTS ENGINE
// ══════════════════════════════════════════════════════════════

function updateDashboard() {
  let totalRev = 0, totalPur = 0;
  
  invoicesArray.filter(i => i.status !== 'draft').forEach(i => totalRev += (i.grandTotal || 0));
  purchasesArray.forEach(p => totalPur += (p.totalAmount || 0));
  
  const dRev = document.getElementById('dashTotalRevenue'); if(dRev) dRev.textContent = '₹' + fmt(totalRev);
  const dPur = document.getElementById('dashTotalPurchases'); if(dPur) dPur.textContent = '₹' + fmt(totalPur);
  const dCnt = document.getElementById('dashInvCount'); if(dCnt) dCnt.textContent = invoicesArray.length;
  
  const topProducts = {};
  invoicesArray.filter(i => i.status !== 'draft').forEach(inv => {
    (inv.items || []).forEach(it => {
      const name = it.description || it.desc;
      if (!name) return;
      if (!topProducts[name]) topProducts[name] = { qty: 0, revenue: 0 };
      topProducts[name].qty += parseFloat(it.quantity || it.qty || 0);
      topProducts[name].revenue += parseFloat(it.unitPrice || it.price || 0) * parseFloat(it.quantity || it.qty || 0);
    });
  });

  const sortedTop = Object.entries(topProducts).sort((a,b) => b[1].revenue - a[1].revenue).slice(0, 5);
  const topEl = document.getElementById('dashTopProducts');
  if (topEl) {
    topEl.innerHTML = sortedTop.length 
      ? sortedTop.map(p => `<div class="list-item"><div><div class="list-item-title">${esc(p[0])}</div><div class="list-item-sub">Sold: ${p[1].qty} units</div></div><div class="list-item-amount">₹${fmt(p[1].revenue)}</div></div>`).join('')
      : '<div class="empty-state"><i class="fas fa-star"></i><p>No sales data yet</p></div>';
  }
  
  if (typeof generateReports === 'function') generateReports();
}

function setDashPeriod(period, btnElement) {
  document.querySelectorAll('.dash-period-btn').forEach(b => b.classList.remove('active'));
  if(btnElement) btnElement.classList.add('active');
  // Logic for filtering by date can be added here!
  updateDashboard(); 
}

function setReportRange(range, btnElement) {
  if (btnElement) {
    document.querySelectorAll('.date-filter-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
  }
  generateReports();
}

function generateReports() {
  let salesRev = 0, salesTotal = 0, purTotal = 0;
  let gstColl = 0, gstPaid = 0;
  
  invoicesArray.filter(i => i.status !== 'draft').forEach(i => {
    salesRev += (i.subtotal || 0);
    salesTotal += (i.grandTotal || 0);
    gstColl += (i.gstAmount || 0);
  });
  
  purchasesArray.forEach(p => {
    purTotal += (p.totalAmount || 0);
    gstPaid += (p.gstAmount || 0);
  });
  
  const profit = salesTotal - purTotal;
  
  // Update KPI Cards
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = '₹' + fmt(val); };
  setEl('repSalesRevenue', salesRev);
  setEl('repTotalSales', salesTotal);
  setEl('repTotalPurchases', purTotal);
  setEl('repGSTCollected', gstColl);
  setEl('repGSTPaid', gstPaid);
  setEl('repGSTNet', gstColl - gstPaid);
  
  const repInv = document.getElementById('repInvCount'); if (repInv) repInv.textContent = invoicesArray.length;
  
  const pBox = document.getElementById('repProfitBox');
  const lBox = document.getElementById('repLossBox');
  if (profit >= 0) {
    setEl('repProfit', profit); setEl('repLoss', 0);
    if(pBox) pBox.style.borderColor = 'var(--accent2)'; if(lBox) lBox.style.borderColor = 'transparent';
  } else {
    setEl('repProfit', 0); setEl('repLoss', Math.abs(profit));
    if(pBox) pBox.style.borderColor = 'transparent'; if(lBox) lBox.style.borderColor = 'var(--danger)';
  }

  // Update GST Breakdown
  const gstC = document.getElementById('gCGSTColl'), gstP = document.getElementById('gCGSTPaid'), gstN = document.getElementById('gCGSTNet');
  const sgtC = document.getElementById('gSGSTColl'), sgtP = document.getElementById('gSGSTPaid'), sgtN = document.getElementById('gSGSTNet');
  const totC = document.getElementById('gTotalColl'), totP = document.getElementById('gTotalPaid'), totN = document.getElementById('gTotalNet');
  
  if (bizProfile.supplyType === 'inter') {
    if(gstC) gstC.textContent = '-'; if(gstP) gstP.textContent = '-'; if(gstN) gstN.textContent = '-';
    if(sgtC) sgtC.textContent = '-'; if(sgtP) sgtP.textContent = '-'; if(sgtN) sgtN.textContent = '-';
  } else {
    const cVal = gstColl/2, pVal = gstPaid/2;
    if(gstC) gstC.textContent = '₹'+fmt(cVal); if(gstP) gstP.textContent = '₹'+fmt(pVal); if(gstN) gstN.textContent = '₹'+fmt(cVal-pVal);
    if(sgtC) sgtC.textContent = '₹'+fmt(cVal); if(sgtP) sgtP.textContent = '₹'+fmt(pVal); if(sgtN) sgtN.textContent = '₹'+fmt(cVal-pVal);
  }
  if(totC) totC.textContent = '₹'+fmt(gstColl); if(totP) totP.textContent = '₹'+fmt(gstPaid); if(totN) totN.textContent = '₹'+fmt(gstColl-gstPaid);

  renderCharts(salesTotal, purTotal);
}

function renderCharts(sales, purchases) {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.color = '#6b6560';

  // Sales vs Purchases Chart
  const ctxSales = document.getElementById('reportSalesChart');
  if (ctxSales) {
    if (App.chartSales) App.chartSales.destroy();
    App.chartSales = new Chart(ctxSales, {
      type: 'bar',
      data: { labels: ['Overall'], datasets: [
        { label: 'Sales', data: [sales], backgroundColor: '#2d7a62', borderRadius: 4 },
        { label: 'Purchases', data: [purchases], backgroundColor: '#c8933a', borderRadius: 4 }
      ]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  // Profit Trend (Placeholder logic for visual)
  const ctxProfit = document.getElementById('reportProfitChart');
  if (ctxProfit) {
    if (App.chartProfit) App.chartProfit.destroy();
    App.chartProfit = new Chart(ctxProfit, {
      type: 'line',
      data: { labels: ['W1', 'W2', 'W3', 'W4'], datasets: [{ label: 'Net Profit', data: [0, sales*0.2, sales*0.5, sales - purchases], borderColor: '#1a5276', backgroundColor: 'rgba(26,82,118,0.1)', fill: true, tension: 0.4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

  // Pie Chart
  const ctxPie = document.getElementById('reportPieChart');
  if (ctxPie) {
    if (App.chartPie) App.chartPie.destroy();
    App.chartPie = new Chart(ctxPie, {
      type: 'doughnut',
      data: { labels: ['Profit', 'Expenses/Cost'], datasets: [{ data: [Math.max(0, sales - purchases), purchases], backgroundColor: ['#2d7a62', '#c0392b'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom' } } }
    });
  }
}

// ─── THEME & DARK MODE ENGINE ───
function toggleDark() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const pill = document.getElementById('darkPill');
  
  if (isDark) {
    html.removeAttribute('data-theme');
    localStorage.setItem('bs_theme', 'light');
    if(pill) pill.classList.remove('on');
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('bs_theme', 'dark');
    if(pill) pill.classList.add('on');
  }
}

function initThemeUI() {
  const pill = document.getElementById('darkPill');
  if (localStorage.getItem('bs_theme') === 'dark' && pill) {
    pill.classList.add('on');
  }
}

// Kickoff
window.addEventListener('DOMContentLoaded', () => {
  initThemeUI();
  initTabs();
  loadSupabaseData();
  
  // Reveal the app seamlessly after everything is set up
  setTimeout(() => {
    const layout = document.querySelector('.layout');
    if (layout) layout.style.opacity = '1';
  }, 50); 
});
