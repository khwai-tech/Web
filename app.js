// ─── TABS ─────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.querySelectorAll('.sec-tab[data-stab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.tab-pane');
      parent.querySelectorAll('.sec-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      parent.querySelectorAll('.stab-pane').forEach(p => p.style.display = 'none');
      const target = document.getElementById(btn.dataset.stab);
      if (target) target.style.display = 'block';
    });
  });
}

// ─── GST STATE CODES ─────────────────────────────────────
const GST_STATE_CODES = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "28": "Andhra Pradesh",
  "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana", "38": "Ladakh"
};

function buildStateDropdown() {
  const select = document.getElementById("state-list");
  if (!select) return;

  // 1. Wipe it clean so we don't accidentally duplicate the list
  select.innerHTML = '<option value="">--Select State--</option>';

  // 2. Build the list of states
  Object.entries(GST_STATE_CODES).sort((a, b) => a[1].localeCompare(b[1])).forEach(([code, name]) => {
      let option = document.createElement("option");
      option.value = code;
      option.text = `${name} (${code})`; // Added the GST code to the text for better UI!
      select.appendChild(option);
  });

  // ⚡ 3. CRITICAL FIX: Force it to select your saved state right NOW
  if (typeof bizProfile !== 'undefined' && bizProfile.state) {
      select.value = bizProfile.state;
  }
}

function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.nav-item[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');
  
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const pane = document.getElementById(tab + 'Pane');
  if (pane) pane.classList.add('active');
  
  if (tab === 'inventory') refreshInventory();
  if (tab === 'products')  renderProductGrid();
  if (tab === 'report')    buildReports();
  if (tab === 'customers') renderCustomerGrid();
  if (tab === 'suppliers') renderSupplierGrid();
  
  document.getElementById('sidebar').classList.remove('open');
  
  // 👇 FIX: Changed tabId to tab
  localStorage.setItem('bs_active_tab', tab); 
}

// ─── DATE SETUP ───────────────────────────────
function setupDates() {
  const d = today();
  ['invDate','purchaseDate'].forEach(id => { const el = document.getElementById(id); if (el) el.value = d; });
  const dashDate = document.getElementById('dashDate');
  if (dashDate) dashDate.textContent = 'Today, ' + new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── DASHBOARD PERIOD FILTER ──────────────────
let dashPeriod = 'all'; // 'day' | 'week' | 'month' | 'all'

function setDashPeriod(period, el) {
  dashPeriod = period;
  document.querySelectorAll('.dash-period-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  updateDashboard();
}

function _filterDashArray(arr, dateKey) {
  if (dashPeriod === 'all') return arr;
  const now = new Date();
  return arr.filter(item => {
    const d = item[dateKey] || (item.timestamp || '').slice(0, 10);
    if (!d) return false;
    const itemDate = new Date(d);
    if (dashPeriod === 'day') {
      return itemDate.toDateString() === now.toDateString();
    } else if (dashPeriod === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      return itemDate >= weekAgo;
    } else if (dashPeriod === 'month') {
      return itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth();
    }
    return true;
  });
}

// ─── DASHBOARD UPDATE ─────────────────────────
function updateDashboard() {
  const filtInv = _filterDashArray(invoicesArray,  'date');
  const filtPur = _filterDashArray(purchasesArray, 'date');

  const totalRevenue   = filtInv.reduce((s, i) => s + (i.grandTotal  || 0), 0);
  const totalPurchases = filtPur.reduce((s, p) => s + (p.totalAmount || 0), 0);

  const el = id => document.getElementById(id);
  if (el('dashTotalRevenue'))   el('dashTotalRevenue').textContent   = fmt(totalRevenue);
  if (el('dashTotalPurchases')) el('dashTotalPurchases').textContent = fmt(totalPurchases);
  if (el('dashInvCount'))       el('dashInvCount').textContent       = filtInv.length;

  // Period label on stat cards
  const labels = { day: 'Today', week: 'This Week', month: 'This Month', all: 'All Time' };
  const lab = labels[dashPeriod] || 'All Time';
  if (el('dashRevLabel'))   el('dashRevLabel').textContent   = lab;
  if (el('dashPurLabel'))   el('dashPurLabel').textContent   = lab;
  if (el('dashInvLabel'))   el('dashInvLabel').textContent   = lab;

  generateTopProducts();
}

function generateTopProducts() {
  const sales = {};
  invoicesArray.forEach(inv => (inv.items || []).forEach(it => {
    sales[it.description] = (sales[it.description] || 0) + (parseFloat(it.quantity) || 0);
  }));
  const sorted = Object.entries(sales).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const html = sorted.length
    ? sorted.map(([name, qty], i) => `
        <div class="list-item">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:28px;height:28px;background:var(--accent-light);color:var(--accent2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem">${i + 1}</div>
            <div class="list-item-title">${esc(name)}</div>
          </div>
          <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.9rem">${qty} units</div>
        </div>`).join('')
    : '<div class="empty-state"><i class="fas fa-chart-bar"></i><p>No sales data yet</p></div>';
  ['dashTopProducts','reportTopSellingList'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = html; });
}

// ─── REPORT DATE RANGE ────────────────────────
function setReportRange(type, btn) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  document.querySelectorAll('.date-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if      (type === 'day')     { reportRange = { from: today(), to: today() }; }
  else if (type === 'week')    { const s = new Date(y, m, d - now.getDay()); reportRange = { from: s.toISOString().slice(0, 10), to: today() }; }
  else if (type === 'month')   { reportRange = { from: new Date(y, m, 1).toISOString().slice(0, 10), to: today() }; }
  else if (type === 'quarter') { const qm = Math.floor(m / 3) * 3; reportRange = { from: new Date(y, qm, 1).toISOString().slice(0, 10), to: today() }; }
  else if (type === 'all')     { reportRange = { from: null, to: null }; }
  else if (type === 'custom')  {
    reportRange = { from: document.getElementById('reportFrom').value, to: document.getElementById('reportTo').value };
    document.querySelectorAll('.date-filter-btn').forEach(b => b.classList.remove('active'));
  }
  buildReports();
}

function filterByRange(arr) {
  if (!reportRange.from && !reportRange.to) return arr;
  return arr.filter(item => {
    const d = item.date || (item.timestamp || '').slice(0, 10);
    if (!d) return true;
    if (reportRange.from && d < reportRange.from) return false;
    if (reportRange.to   && d > reportRange.to)   return false;
    return true;
  });
}

function groupByMonth(arr, amtKey) {
  const m = {};
  arr.forEach(item => {
    const d = item.date || (item.timestamp || '').slice(0, 10);
    if (!d) return;
    const key = new Date(d).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    m[key] = (m[key] || 0) + (item[amtKey] || 0);
  });
  return m;
}

// ─── REPORTS ──────────────────────────────────
function buildReports() {
  generateTopProducts();

  const filtInv = filterByRange(invoicesArray);
  const filtPur = filterByRange(purchasesArray);

  // ── Core metrics
  const totalSalesRevenue = filtInv.reduce((s, i) => s + (i.grandTotal  || 0), 0);
  const totalPurchases    = filtPur.reduce((s, p) => s + (p.totalAmount || 0), 0);
  const gstCollected      = filtInv.reduce((s, i) => s + (i.gstAmount   || 0), 0);
  const gstPaid           = filtPur.reduce((s, p) => s + (p.gstAmount   || 0), 0);
  const salesExGST        = filtInv.reduce((s, i) => s + (i.subtotal    || 0), 0);
  const profit            = totalSalesRevenue - totalPurchases;
  const totalLoss         = profit < 0 ? Math.abs(profit) : 0;
  const totalProfit       = profit > 0 ? profit : 0;

  const el = id => document.getElementById(id);

  // ── Row 1: Sales Revenue, Total Sales, Total Purchase, Profit, Loss
  if (el('repSalesRevenue'))    el('repSalesRevenue').textContent    = fmt(salesExGST);
  if (el('repTotalSales'))      el('repTotalSales').textContent      = fmt(totalSalesRevenue);
  if (el('repTotalPurchases'))  el('repTotalPurchases').textContent  = fmt(totalPurchases);
  if (el('repProfit'))          el('repProfit').textContent          = fmt(totalProfit);
  if (el('repLoss'))            el('repLoss').textContent            = fmt(totalLoss);

  // Colour profit/loss box dynamically
  const profitBox = document.getElementById('repProfitBox');
  const lossBox   = document.getElementById('repLossBox');
  if (profitBox) profitBox.style.borderColor = profit >= 0 ? 'var(--accent2)' : 'transparent';
  if (lossBox)   lossBox.style.borderColor   = profit <  0 ? 'var(--danger)'  : 'transparent';

  // ── Row 2: GST KPIs
  if (el('repGSTCollected')) el('repGSTCollected').textContent = fmt(gstCollected);
  if (el('repGSTPaid'))      el('repGSTPaid').textContent      = fmt(gstPaid);
  if (el('repGSTNet'))       el('repGSTNet').textContent       = fmt(gstCollected - gstPaid);
  if (el('repInvCount'))     el('repInvCount').textContent     = filtInv.length;

  // ── GST Summary table
  const isInter = bizProfile.supplyType === 'inter';
  if (el('gCGSTLabel')) el('gCGSTLabel').textContent = isInter ? 'IGST (100%)' : 'CGST (50%)';
  if (el('gSGSTLabel')) el('gSGSTLabel').textContent = isInter ? '—'           : 'SGST (50%)';
  const cgstColl = isInter ? gstCollected : gstCollected / 2;
  const sgstColl = isInter ? 0            : gstCollected / 2;
  const cgstPaid = isInter ? gstPaid      : gstPaid / 2;
  const sgstPaid = isInter ? 0            : gstPaid / 2;
  if (el('gCGSTColl')) el('gCGSTColl').textContent = fmt(cgstColl);
  if (el('gCGSTPaid')) el('gCGSTPaid').textContent = fmt(cgstPaid);
  if (el('gCGSTNet'))  el('gCGSTNet').textContent  = fmt(cgstColl - cgstPaid);
  if (el('gSGSTColl')) el('gSGSTColl').textContent = fmt(sgstColl);
  if (el('gSGSTPaid')) el('gSGSTPaid').textContent = fmt(sgstPaid);
  if (el('gSGSTNet'))  el('gSGSTNet').textContent  = fmt(sgstColl - sgstPaid);
  if (el('gTotalColl')) el('gTotalColl').textContent = fmt(gstCollected);
  if (el('gTotalPaid')) el('gTotalPaid').textContent = fmt(gstPaid);
  if (el('gTotalNet'))  el('gTotalNet').textContent  = fmt(gstCollected - gstPaid);

  // ── GST rate slab breakdown
  const rateMap = {};
  filtInv.forEach(inv => (inv.items || []).forEach(it => {
    const r = ((it.gstRate || 0) * 100).toFixed(0) + '%';
    rateMap[r] = (rateMap[r] || 0) + (parseFloat(it.quantity) * parseFloat(it.unitPrice) * (it.gstRate || 0));
  }));
  const rateEl = el('gstRateBreakdown');
  if (rateEl) {
    rateEl.innerHTML = `<p style="font-size:0.8rem;color:var(--ink3);margin-bottom:12px">GST collected by rate slab:</p>` +
      (Object.entries(rateMap).map(([r, v]) =>
        `<div style="display:flex;justify-content:space-between;font-size:0.875rem;padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-weight:600">${r}</span><span style="color:var(--accent)">${fmt(v)}</span></div>`
      ).join('') || '<p style="color:var(--ink3);font-size:0.85rem">No GST data in range</p>');
  }

  // ── Charts
  const invByMonth = groupByMonth(filtInv, 'grandTotal');
  const purByMonth = groupByMonth(filtPur, 'totalAmount');
  const allMonths  = [...new Set([...Object.keys(invByMonth), ...Object.keys(purByMonth)])];
  if (!allMonths.length) allMonths.push('No Data');

  const salesData  = allMonths.map(m => invByMonth[m] || 0);
  const purData    = allMonths.map(m => purByMonth[m] || 0);
  const profitData = allMonths.map(m => (invByMonth[m] || 0) - (purByMonth[m] || 0));

  const ctxSales  = el('reportSalesChart')?.getContext('2d');
  const ctxProfit = el('reportProfitChart')?.getContext('2d');
  const ctxPie    = el('reportPieChart')?.getContext('2d');

  if (App.chartSales)  { App.chartSales.destroy();  App.chartSales  = null; }
  if (App.chartProfit) { App.chartProfit.destroy();  App.chartProfit = null; }
  if (App.chartPie)    { App.chartPie.destroy();     App.chartPie    = null; }

  const tickFmt   = v => '₹' + v.toLocaleString('en-IN');
  const gridColor = 'rgba(0,0,0,0.04)';

  if (ctxSales) {
    App.chartSales = new Chart(ctxSales, {
      type: 'bar',
      data: { labels: allMonths, datasets: [
        { label: 'Sales (₹)',     data: salesData, backgroundColor: '#1a4a3a', borderRadius: 6 },
        { label: 'Purchases (₹)', data: purData,   backgroundColor: '#c8933a', borderRadius: 6 }
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { y: { ticks: { callback: tickFmt }, grid: { color: gridColor } }, x: { grid: { display: false } } } }
    });
  }

  if (ctxProfit) {
    App.chartProfit = new Chart(ctxProfit, {
      type: 'line',
      data: { labels: allMonths, datasets: [
        { label: 'Profit (₹)', data: profitData,
          borderColor: '#2d7a62', backgroundColor: 'rgba(45,122,98,0.1)',
          fill: true, tension: 0.4, pointBackgroundColor: '#2d7a62', borderWidth: 2.5 }
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { y: { ticks: { callback: tickFmt }, grid: { color: gridColor } }, x: { grid: { display: false } } } }
    });
  }

  if (ctxPie) {
    const totalInv = inventoryStock.reduce((s, p) => s + (p.stock || 0) * (p.sellPrice || p.costPrice || 0), 0);
    App.chartPie = new Chart(ctxPie, {
      type: 'doughnut',
      data: { labels: ['Revenue', 'Purchases', 'Stock Value'],
        datasets: [{ data: [totalSalesRevenue || 0.1, totalPurchases || 0.1, totalInv || 0.1],
          backgroundColor: ['#1a4a3a', '#c8933a', '#2d7a62'], borderWidth: 0, hoverOffset: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed)}` } } } }
    });
  }
}

// ─── GLOBAL SEARCH ────────────────────────────
function doGlobalSearch() {
  const q    = document.getElementById('globalSearchInput').value.trim().toLowerCase();
  const drop = document.getElementById('globalSearchDrop');
  if (!q) { drop.classList.remove('open'); return; }
  const results = [];
  invoicesArray.filter(i  => i.invoiceId.toLowerCase().includes(q)  || i.customerName.toLowerCase().includes(q) || String(i.grandTotal||'').includes(q) || (i.date||'').includes(q)).slice(0, 3).forEach(i  => results.push({ label: `${i.invoiceId} — ${i.customerName}`,  tag: 'Invoice',  action: () => { switchTab('invoice');  showInvoiceDetail(i.invoiceId); } }));
  purchasesArray.filter(p => p.poNumber.toLowerCase().includes(q)   || p.supplier.toLowerCase().includes(q)).slice(0, 3).forEach(p  => results.push({ label: `${p.poNumber} — ${p.supplier}`,          tag: 'Purchase', action: () => { switchTab('purchase'); showPurchaseDetail(p.poNumber); } }));
  inventoryStock.filter(p => (p.name||'').toLowerCase().includes(q) || (p.id||'').toLowerCase().includes(q)).slice(0, 3).forEach(p => results.push({ label: `${p.name} (${p.id})`,                     tag: 'Product',  action: () => { switchTab('products'); } }));
  customersArray.filter(c => (c.name||'').toLowerCase().includes(q)).slice(0, 2).forEach(c => results.push({ label: c.name,                                                                                   tag: 'Customer', action: () => { switchTab('customers'); } }));

  if (!results.length) { drop.innerHTML = '<div class="sr-item" style="color:var(--ink3)">No results found</div>'; drop.classList.add('open'); return; }
  drop.innerHTML = results.map((r, idx) => `<div class="sr-item" data-idx="${idx}"><div class="sr-item-tag">${r.tag}</div>${esc(r.label)}</div>`).join('');
  drop.classList.add('open');
  drop.querySelectorAll('.sr-item[data-idx]').forEach(item => {
    item.addEventListener('click', () => { results[+item.dataset.idx].action(); drop.classList.remove('open'); document.getElementById('globalSearchInput').value = ''; });
  });
}
document.addEventListener('click', e => { if (!e.target.closest('.global-search-wrap')) { const d = document.getElementById('globalSearchDrop'); if (d) d.classList.remove('open'); } });

// ─── KEYBOARD SHORTCUTS ───────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const hint = document.getElementById('kbHint');
  const showHint = msg => { if (hint) { hint.textContent = msg; hint.style.display = 'block'; setTimeout(() => hint.style.display = 'none', 1600); } };
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); switchTab('invoice');  showHint('⌃N — New Invoice'); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); switchTab('purchase'); showHint('⌃P — New Purchase'); }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const active = document.querySelector('.tab-pane.active');
    if (active?.id === 'invoicePane')  saveInvoice();
    if (active?.id === 'purchasePane') savePurchase();
    showHint('⌃S — Saved');
  }
  if (e.key === 'Escape') closeModal();
  if (e.key === '/' && !e.ctrlKey) { e.preventDefault(); document.getElementById('globalSearchInput')?.focus(); }
});

// ─── AUTO-FILLS ───────────────────────────────
function initSupplierAutoFill() {
  const suppInput = document.getElementById('supplierName');
  if (!suppInput) return;
  suppInput.addEventListener('change', () => {
    const name  = suppInput.value.trim();
    const match = suppliersArray.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (match) toast(`Supplier: ${esc(match.name)}${match.paymentTerms ? ' · ' + match.paymentTerms : ''}`, 'success');
  });
}

// ─── AUTO-FILLS ───────────────────────────────
function initCustomerAutoFill() {
  const custInput = document.getElementById('customerName');
  const gstinInput = document.getElementById('customerGstin');

  // 1. Auto-fill when selecting a saved customer
  if (custInput) {
    custInput.addEventListener('change', () => {
      const name  = custInput.value.trim();
      const match = customersArray.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (match) {
        const emailEl = document.getElementById('customerEmail');
        const addrEl  = document.getElementById('billingAddr');
        if (emailEl && match.email)   emailEl.value = match.email;
        if (addrEl  && match.address) addrEl.value  = match.address;
        if (gstinInput && match.gstin) gstinInput.value = match.gstin;

        // ⚡ FIRE THE TAX ENGINE ⚡
        App.currentInvoiceSupplyType = getSmartSupplyType(match.gstin);
        if (typeof calcInvoiceTotals === 'function') calcInvoiceTotals();
        
        toast(`Loaded details for ${esc(match.name)}`, 'success');
      }
    });
  }

  // 2. Auto-switch tax if user manually types/changes the GSTIN
  if (gstinInput) {
    gstinInput.addEventListener('change', () => {
      App.currentInvoiceSupplyType = getSmartSupplyType(gstinInput.value);
      if (typeof calcInvoiceTotals === 'function') calcInvoiceTotals();
      
      const typeLabel = App.currentInvoiceSupplyType === 'inter' ? 'IGST' : 'CGST & SGST';
      toast(`Tax switched to ${typeLabel}`, 'info');
    });
  }
}

// ─── INIT ─────────────────────────────────────
function init() {
  const lastTab = localStorage.getItem('bs_active_tab') || 'dashboard';
  
  try {
    switchTab(lastTab);
  } catch (err) {}

  loadTheme();
  setupDates();
  loadSettingsPreviews();

  // 👇 ADD THIS LINE: Build the dropdown and apply the saved state
  if (typeof buildStateDropdown === 'function') buildStateDropdown();

  loadSettings();

    invoicesArray.length  = 0; invoicesArray.push(...JSON.parse(localStorage.getItem('bs_invoices')  || '[]'));
  purchasesArray.length = 0; purchasesArray.push(...JSON.parse(localStorage.getItem('bs_purchases') || '[]'));

  renderInvoiceEditor();
  renderPurchaseEditor();
  renderInvoiceLists();
  renderPurchaseLists();
  updateDashboard();
  initTabs();
  initCustomerAutoFill();
  initSupplierAutoFill();

  const invEl = document.getElementById('invNumber');
  const poEl  = document.getElementById('poNumber');
  if (invEl) invEl.value = getNextId(invoicesArray,  'INV');
  if (poEl)  poEl.value  = getNextId(purchasesArray, 'PO');

  setReportRange('all', document.querySelector('.date-filter-btn[onclick*="\'all\'"]'));

  const expBtn = document.getElementById('backupExportBtn');
  if (expBtn) expBtn.addEventListener('click', exportBackup);
  const impInp = document.getElementById('backupImportInput');
  if (impInp) impInp.addEventListener('change', () => importBackup(impInp));

  document.getElementById('addInvoiceItemBtn')?.addEventListener('click', () => { invLineItems.push({ desc: '', qty: 1, price: 0, gstRate: 0.18 }); renderInvoiceEditor(); });
  document.getElementById('saveInvoiceBtn')?.addEventListener('click', saveInvoice);
  document.getElementById('clearInvoiceFormBtn')?.addEventListener('click', () => clearInvoiceForm());
  document.getElementById('addPurchaseItemBtn')?.addEventListener('click', () => { purLineItems.push({ desc: '', qty: 1, cost: 0, gstRate: 0.18 }); renderPurchaseEditor(); });
  document.getElementById('savePurchaseBtn')?.addEventListener('click', savePurchase);
  document.getElementById('refreshInventoryBtn')?.addEventListener('click', refreshInventory);
  document.getElementById('refreshInvoiceHistoryBtn')?.addEventListener('click', () => { renderInvoiceLists(); toast('Invoices refreshed'); });
  document.getElementById('refreshPurchaseHistoryBtn')?.addEventListener('click', () => { renderPurchaseLists(); toast('Purchases refreshed'); });
  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));

  fetchDatabaseContacts();

  fetchInventoryAndReports();
}

document.addEventListener('DOMContentLoaded', init);



// ─── FETCH CONTACTS FROM DATABASE ────────────────────────────
function fetchDatabaseContacts() {
  toast('Loading customers & suppliers...', 'info');
  
  // Calls the doGet() function in your Google Apps Script
  fetch(API_URL)
    .then(response => response.json())
    .then(data => {
      
      // 1. Parse Customers (Skipping row 0 because it's the Header row)
      if (data.customers && data.customers.length > 1) {
        customersArray.length = 0; // Clear the temporary local array
        const custRows = data.customers.slice(1);
        
        custRows.forEach(row => {
          if (row[0]) { // Check if ID exists
            customersArray.push({
              id: row[0],
              name: row[1] || '',
              email: row[2] || '',
              phone: row[3] || '',
              address: row[4] || '',
              gstin: row[5] || ''
            });
          }
        });
      }

      // 2. Parse Suppliers (Skipping row 0)
      if (data.suppliers && data.suppliers.length > 1) {
        suppliersArray.length = 0; // Clear the temporary local array
        const suppRows = data.suppliers.slice(1);
        
        suppRows.forEach(row => {
          if (row[0]) {
            suppliersArray.push({
              id: row[0],
              name: row[1] || '',
              phone: row[2] || '',
              address: row[3] || '',
              paymentTerms: row[4] || '',
              gstin: row[5] || ''
            });
          }
        });
      }

      // 3. Update the UI with the fresh data
      if (typeof renderCustomerGrid === 'function') renderCustomerGrid();
      if (typeof renderSupplierGrid === 'function') renderSupplierGrid();
      if (typeof updateDatalists === 'function') updateDatalists();
      
      toast('Contacts synced from database!', 'success');
    })
    .catch(err => {
      console.error("Database Sync Error:", err);
      toast('Failed to fetch from database. Using local data.', 'error');
    });
}

// ─── NUMBER TO WORDS CONVERTER (Indian System) ────────────
function numberToWords(num) {
  if (num === 0) return "Zero";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  function inWords(n) {
    let str = "";
    if (n > 9999999) { str += inWords(Math.floor(n / 10000000)) + " Crore "; n %= 10000000; }
    if (n > 99999)   { str += inWords(Math.floor(n / 100000)) + " Lakh "; n %= 100000; }
    if (n > 999)     { str += inWords(Math.floor(n / 1000)) + " Thousand "; n %= 1000; }
    if (n > 99)      { str += a[Math.floor(n / 100)] + " Hundred "; n %= 100; }
    if (n > 0) {
      if (str !== "") str += "and ";
      if (n < 20) str += a[n];
      else {
        str += b[Math.floor(n / 10)];
        if (n % 10 > 0) str += " " + a[n % 10];
      }
    }
    return str;
  }
  return inWords(Math.round(num)).trim();
}

