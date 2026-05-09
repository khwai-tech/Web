// âââ CONFIG âââââââââââââââââââââââââââââââââââ
const API_URL = "https://script.google.com/macros/s/AKfycbwJupk6QkzY_BMKwMD1GZwq3fMxcL_L5Ma6IOu8uxctzgLaN0OGsQgZiaZoBbrxpR-k/exec";
let LOW_STOCK_THRESHOLD = 10;

// âââ STATE ââââââââââââââââââââââââââââââââââââ
let customersArray = [];
let inventoryStock = [];
let invoicesArray = [];
let purchasesArray = [];
let invLineItems = [{ desc:"Service / Product", qty:1, price:0, gstRate:0.18 }];
let purLineItems = [{ desc:"Raw Material", qty:1, cost:0, gstRate:0.18 }];
let invGstType = "Exclusive";
let purGstType = "Exclusive";
let invDiscType = "flat";
let chartSales = null, chartProfit = null, chartPie = null;
let reportRange = { from: null, to: null };
let undoStack = [];

// âââ SETTINGS âââââââââââââââââââââââââââââââââ
let bizProfile = { name:'BillingSuite Pro', gstin:'', address:'', phone:'', email:'' };

function loadSettings() {
  const s = localStorage.getItem('bs_settings');
  if (s) bizProfile = { ...bizProfile, ...JSON.parse(s) };
  document.getElementById('settBizName').value = bizProfile.name || '';
  document.getElementById('settGSTIN').value = bizProfile.gstin || '';
  document.getElementById('settBizAddr').value = bizProfile.address || '';
  document.getElementById('settPhone').value = bizProfile.phone || '';
  document.getElementById('settEmail').value = bizProfile.email || '';
  const thresh = localStorage.getItem('bs_thresh');
  if (thresh) { LOW_STOCK_THRESHOLD = parseInt(thresh); document.getElementById('settLowStockThresh').value = LOW_STOCK_THRESHOLD; }
  updatePrintHeaders();
}

function saveSettings() {
  bizProfile.name = document.getElementById('settBizName').value.trim() || 'BillingSuite Pro';
  bizProfile.gstin = document.getElementById('settGSTIN').value.trim();
  bizProfile.address = document.getElementById('settBizAddr').value.trim();
  bizProfile.phone = document.getElementById('settPhone').value.trim();
  bizProfile.email = document.getElementById('settEmail').value.trim();
  LOW_STOCK_THRESHOLD = parseInt(document.getElementById('settLowStockThresh').value) || 10;
  localStorage.setItem('bs_settings', JSON.stringify(bizProfile));
  localStorage.setItem('bs_thresh', LOW_STOCK_THRESHOLD);
  updatePrintHeaders();
  toast('Settings saved!', 'success');
}

function updatePrintHeaders() {
  ['printBizName','purPrintBizName'].forEach((id,i) => {
    const el = document.getElementById(id);
    if (el) el.textContent = bizProfile.name;
  });
  const ga = document.getElementById('printBizAddr');
  if (ga) ga.textContent = bizProfile.address;
  const gg = document.getElementById('printBizGst');
  if (gg) gg.textContent = bizProfile.gstin ? 'GSTIN: ' + bizProfile.gstin : '';
  const pa = document.getElementById('purPrintBizAddr');
  if (pa) pa.textContent = bizProfile.address;
}

// âââ DARK MODE ââââââââââââââââââââââââââââââââ
function toggleDark() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  setTheme(!isDark);
}
function setTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
  document.getElementById('darkPill').className = 'toggle-pill' + (dark ? ' on' : '');
  localStorage.setItem('bs_dark', dark ? '1' : '0');
}
function loadTheme() {
  if (localStorage.getItem('bs_dark') === '1') setTheme(true);
}

// âââ UTILS ââââââââââââââââââââââââââââââââââââ
function fmt(n) {
  const num = parseFloat(n) || 0;
  return 'â¹' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function today() { return new Date().toISOString().slice(0,10); }
function dateLabel(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }); }
  catch(e) { return d; }
}

function toast(msg, type='success', undoFn=null) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const icons = { success:'check-circle', error:'times-circle', warn:'exclamation-circle' };
  const d = document.createElement('div');
  d.className = `toast ${type}`;
  d.innerHTML = `<i class="fas fa-${icons[type]||'info-circle'}"></i> ${msg}`;
  if (undoFn) {
    const ub = document.createElement('button');
    ub.className = 'toast-undo';
    ub.textContent = 'Undo';
    ub.onclick = () => { undoFn(); d.remove(); };
    d.appendChild(ub);
  }
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 4000);
}

function genId(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase(); }
function getNextId(array, prefix) {
  if (!array || !array.length) return `${prefix}-2026-001`;
  const lastId = array[0].invoiceId || array[0].poNumber;
  const parts = lastId.split('-');
  const nextNum = parseInt(parts[parts.length-1]) + 1;
  return `${prefix}-2026-${String(nextNum).padStart(3,'0')}`;
}

function getStatusBadge(inv) {
  if (!inv.status || inv.status === 'paid') return '<span class="badge status-paid">Paid</span>';
  if (inv.status === 'unpaid') return '<span class="badge status-unpaid">Unpaid</span>';
  if (inv.status === 'draft') return '<span class="badge status-draft">Draft</span>';
  if (inv.status === 'overdue') return '<span class="badge status-overdue">Overdue</span>';
  return '<span class="badge badge-green">Saved</span>';
}

// âââ TABS âââââââââââââââââââââââââââââââââââââ
function initTabs() {
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.querySelectorAll('.sec-tab[data-stab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.tab-pane');
      parent.querySelectorAll('.sec-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      parent.querySelectorAll('.stab-pane').forEach(p => p.style.display='none');
      const target = document.getElementById(btn.dataset.stab);
      if (target) target.style.display='block';
    });
  });
}

function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.nav-item[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const pane = document.getElementById(tab + 'Pane');
  if (pane) pane.classList.add('active');
  if (tab === 'inventory') refreshInventory();
  if (tab === 'products') renderProductGrid();
  if (tab === 'report') buildReports();
  if (tab === 'customers') renderCustomerGrid();
  // close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
}

// âââ DATE SETUP âââââââââââââââââââââââââââââââ
function setupDates() {
  const d = today();
  document.getElementById('invDate').value = d;
  document.getElementById('purchaseDate').value = d;
  document.getElementById('reportFrom').value = d;
  document.getElementById('reportTo').value = d;
  document.getElementById('dashDate').textContent =
    'Today, ' + new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

// âââ INVOICE EDITOR (item-level GST) ââââââââââ
function renderInvoiceEditor() {
  const body = document.getElementById('invoiceItemsBody');
  body.innerHTML = invLineItems.map((it,i) => {
    const gstAmt = invGstType === 'Inclusive'
      ? it.qty * it.price - it.qty * (it.price / (1 + it.gstRate))
      : it.qty * it.price * it.gstRate;
    const total = invGstType === 'Inclusive'
      ? it.qty * it.price
      : it.qty * it.price + gstAmt;
    return `<tr>
      <td><input class="item-input inv-field" data-i="${i}" data-f="desc" value="${it.desc}" placeholder="Descriptionâ¦" list="invProductList"></td>
      <td><input class="item-input inv-field" data-i="${i}" data-f="qty" type="number" value="${it.qty}" min="0.01" step="0.01" style="width:60px"></td>
      <td><input class="item-input inv-field" data-i="${i}" data-f="price" type="number" value="${it.price}" min="0" step="0.01" style="width:90px"></td>
      <td class="no-print">
        <select class="gst-select-inline inv-gst-select" data-i="${i}">
          <option value="0" ${it.gstRate===0?'selected':''}>0%</option>
          <option value="0.05" ${it.gstRate===0.05?'selected':''}>5%</option>
          <option value="0.12" ${it.gstRate===0.12?'selected':''}>12%</option>
          <option value="0.18" ${it.gstRate===0.18?'selected':''}>18%</option>
          <option value="0.28" ${it.gstRate===0.28?'selected':''}>28%</option>
        </select>
      </td>
      <td style="color:var(--gold);font-weight:500">${fmt(gstAmt)}</td>
      <td style="font-weight:600;color:var(--accent)">${fmt(total)}</td>
      <td class="no-print"><button class="btn-icon rem-inv-item" data-i="${i}"><i class="fas fa-trash-alt"></i></button></td>
    </tr>`;
  }).join('');

  // Attach datalist from products
  if (!document.getElementById('invProductList')) {
    const dl = document.createElement('datalist');
    dl.id = 'invProductList';
    document.body.appendChild(dl);
  }
  const dl = document.getElementById('invProductList');
  dl.innerHTML = inventoryStock.map(p => `<option value="${p.name}">`).join('');

  body.querySelectorAll('.inv-field').forEach(inp => {
    inp.addEventListener('change', () => {
      const i = +inp.dataset.i, f = inp.dataset.f;
      if (!invLineItems[i]) return;
      if (f === 'qty' || f === 'price') invLineItems[i][f] = parseFloat(inp.value) || 0;
      else {
        invLineItems[i][f] = inp.value;
        // Auto-fill price+gst from product
        const match = inventoryStock.find(p => p.name.toLowerCase() === inp.value.toLowerCase());
        if (match) {
          invLineItems[i].price = match.price;
          invLineItems[i].gstRate = match.gstRate;
        }
      }
      renderInvoiceEditor();
    });
  });

  body.querySelectorAll('.inv-gst-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const i = +sel.dataset.i;
      if (invLineItems[i]) { invLineItems[i].gstRate = parseFloat(sel.value); renderInvoiceEditor(); }
    });
  });

  body.querySelectorAll('.rem-inv-item').forEach(btn => {
    btn.addEventListener('click', () => { invLineItems.splice(+btn.dataset.i, 1); renderInvoiceEditor(); });
  });

  calcInvoiceTotals();
}

function calcInvoiceTotals() {
  let sub = 0, gstTotal = 0, grand = 0;
  invLineItems.forEach(it => {
    const base = it.qty * it.price;
    const gst = invGstType === 'Inclusive'
      ? base - base / (1 + it.gstRate)
      : base * it.gstRate;
    sub += invGstType === 'Inclusive' ? base - gst : base;
    gstTotal += gst;
    grand += invGstType === 'Inclusive' ? base : base + gst;
  });

  // Discount
  const discVal = parseFloat(document.getElementById('invDiscountVal').value) || 0;
  let discount = 0;
  if (invDiscType === 'flat') discount = Math.min(discVal, grand);
  else discount = grand * (discVal / 100);
  grand -= discount;

  document.getElementById('subtotalVal').textContent = fmt(sub);
  document.getElementById('taxVal').textContent = fmt(gstTotal);
  document.getElementById('taxLabel').textContent = `GST Total â ${invGstType}`;
  document.getElementById('discountDisplay').textContent = `â ${fmt(discount)}`;
  document.getElementById('grandTotalVal').textContent = fmt(grand);
}

function setGstType(type) {
  invGstType = type;
  document.getElementById('gstExcBtn').classList.toggle('active', type==='Exclusive');
  document.getElementById('gstIncBtn').classList.toggle('active', type==='Inclusive');
  renderInvoiceEditor();
}

function setDiscType(type) {
  invDiscType = type;
  document.getElementById('discFlat').classList.toggle('active', type==='flat');
  document.getElementById('discPct').classList.toggle('active', type==='pct');
  calcInvoiceTotals();
}

// âââ SAVE INVOICE âââââââââââââââââââââââââââââ
function saveInvoice() {
  const invId = document.getElementById('invNumber').value.trim();
  if (!invId) { toast('Enter an invoice number', 'error'); return; }
  if (!document.getElementById('customerName').value.trim()) { toast('Enter a customer name', 'error'); return; }
  if (!invLineItems.length) { toast('Add at least one line item', 'error'); return; }

  let sub=0, gstTotal=0, grand=0;
  invLineItems.forEach(it => {
    const base = it.qty * it.price;
    const gst = invGstType === 'Inclusive' ? base - base/(1+it.gstRate) : base*it.gstRate;
    sub += invGstType === 'Inclusive' ? base-gst : base;
    gstTotal += gst;
    grand += invGstType === 'Inclusive' ? base : base+gst;
  });
  const discVal = parseFloat(document.getElementById('invDiscountVal').value) || 0;
  const discount = invDiscType === 'flat' ? Math.min(discVal, grand) : grand*(discVal/100);
  grand -= discount;

  const payload = {
    action:"saveInvoice", invoiceId:invId,
    date: document.getElementById('invDate').value,
    customerName: document.getElementById('customerName').value,
    customerEmail: document.getElementById('customerEmail').value,
    billingAddress: document.getElementById('billingAddr').value,
    gstType: invGstType,
    items: invLineItems.map(i => ({ description:i.desc, quantity:i.qty, unitPrice:i.price, gstRate:i.gstRate })),
    subtotal:sub, gstAmount:gstTotal, discount, grandTotal:grand, status:'paid'
  };

  toast(`Sending Invoice ${invId}â¦`, 'warn');
  fetch(API_URL, { method:"POST", mode:"no-cors", headers:{"Content-Type":"text/plain;charset=utf-8"}, body:JSON.stringify(payload) })
  .then(() => {
    invoicesArray.unshift({...payload, timestamp:new Date().toISOString()});
    localStorage.setItem("bs_invoices", JSON.stringify(invoicesArray));
    document.getElementById('invNumber').value = getNextId(invoicesArray, 'INV');
    renderInvoiceLists(); updateDashboard();
    toast(`Invoice ${invId} saved!`, 'success');
  })
  .catch(() => {
    invoicesArray.unshift({...payload, timestamp:new Date().toISOString()});
    localStorage.setItem("bs_invoices", JSON.stringify(invoicesArray));
    document.getElementById('invNumber').value = getNextId(invoicesArray, 'INV');
    renderInvoiceLists(); updateDashboard();
    toast(`Invoice ${invId} saved locally.`, 'success');
  });
}

function clearInvoiceForm() {
  invLineItems = [{ desc:"Service / Product", qty:1, price:0, gstRate:0.18 }];
  ['customerName','customerEmail','billingAddr','invDiscountVal'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  renderInvoiceEditor();
  toast('Form cleared', 'warn');
}

// âââ RENDER INVOICE LISTS âââââââââââââââââââââ
function renderInvoiceLists() {
  const makeItem = inv => `
    <div class="list-item" onclick="showInvoiceDetail('${inv.invoiceId}')">
      <div><div class="list-item-title">${inv.invoiceId}</div>
      <div class="list-item-sub">${inv.customerName} Â· ${dateLabel(inv.date)}</div></div>
      <div style="text-align:right">
        <div class="list-item-amount">${fmt(inv.grandTotal)}</div>
        ${getStatusBadge(inv)}
      </div>
    </div>`;

  const recent = invoicesArray.slice(0,3);
  document.getElementById('recentInvoiceList').innerHTML = recent.length ? recent.map(makeItem).join('') : '<div class="empty-state"><i class="fas fa-file"></i><p>No invoices</p></div>';
  document.getElementById('invoiceHistoryList').innerHTML = invoicesArray.length ? invoicesArray.map(makeItem).join('') : '<div class="empty-state"><i class="fas fa-archive"></i><p>No invoices saved</p></div>';
  document.getElementById('dashRecentInvoices').innerHTML = recent.length ? recent.map(makeItem).join('') : '<div class="empty-state"><i class="fas fa-file-invoice-dollar"></i><p>No invoices yet</p></div>';
}

function filterInvoices() {
  const q = document.getElementById('invoiceSearch').value.toLowerCase();
  const filtered = invoicesArray.filter(i => i.invoiceId.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q) || (i.customerEmail||'').toLowerCase().includes(q));
  document.getElementById('invoiceHistoryList').innerHTML = filtered.length ? filtered.map(inv => `
    <div class="list-item" onclick="showInvoiceDetail('${inv.invoiceId}')">
      <div><div class="list-item-title">${inv.invoiceId}</div><div class="list-item-sub">${inv.customerName} Â· ${dateLabel(inv.date)}</div></div>
      <div style="text-align:right"><div class="list-item-amount">${fmt(inv.grandTotal)}</div>${getStatusBadge(inv)}</div>
    </div>`).join('') : '<div class="empty-state"><i class="fas fa-search"></i><p>No results</p></div>';
}

function showInvoiceDetail(id) {
  const inv = invoicesArray.find(i => i.invoiceId===id);
  if (!inv) return;
  document.getElementById('modalTitle').textContent = inv.invoiceId + ' â ' + inv.customerName;
  document.getElementById('modalBody').innerHTML = `
    <div style="font-size:0.85rem;margin-bottom:12px;color:var(--ink2)">
      <strong>Date:</strong> ${dateLabel(inv.date)} &nbsp;|&nbsp;
      <strong>Customer:</strong> ${inv.customerName} &nbsp;|&nbsp;
      <strong>GST:</strong> ${inv.gstType}
    </div>
    <div class="items-table-wrap">
      <table class="items-table">
        <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>GST%</th><th>Total</th></tr></thead>
        <tbody>
          ${(inv.items||[]).map(it => `<tr><td>${it.description}</td><td>${it.quantity}</td><td>${fmt(it.unitPrice)}</td><td>${((it.gstRate||0)*100).toFixed(0)}%</td><td>${fmt(it.quantity*it.unitPrice)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="totals-box" style="margin-top:12px">
      <div class="totals-row"><span>Subtotal</span><span>${fmt(inv.subtotal)}</span></div>
      <div class="totals-row"><span>GST</span><span>${fmt(inv.gstAmount)}</span></div>
      ${inv.discount ? `<div class="totals-row discount-row"><span>Discount</span><span>â ${fmt(inv.discount)}</span></div>` : ''}
      <div class="totals-row grand"><span>Grand Total</span><span>${fmt(inv.grandTotal)}</span></div>
    </div>
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
      <select class="form-control" id="invStatusSel" style="max-width:160px">
        <option value="paid" ${inv.status==='paid'?'selected':''}>Paid</option>
        <option value="unpaid" ${inv.status==='unpaid'?'selected':''}>Unpaid</option>
        <option value="draft" ${inv.status==='draft'?'selected':''}>Draft</option>
        <option value="overdue" ${inv.status==='overdue'?'selected':''}>Overdue</option>
      </select>
      <button class="btn btn-secondary btn-sm" onclick="updateInvStatus('${id}')"><i class="fas fa-tag"></i> Update Status</button>
      <button class="btn btn-info btn-sm" onclick="duplicateInvoice('${id}')"><i class="fas fa-copy"></i> Duplicate</button>
      <button class="btn btn-danger btn-sm" onclick="deleteInvoice('${id}')"><i class="fas fa-trash"></i> Delete</button>
    </div>`;
  document.getElementById('detailModal').classList.add('open');
}

function updateInvStatus(id) {
  const inv = invoicesArray.find(i => i.invoiceId===id);
  if (inv) {
    inv.status = document.getElementById('invStatusSel').value;
    localStorage.setItem("bs_invoices", JSON.stringify(invoicesArray));
    renderInvoiceLists(); toast('Status updated', 'success');
  }
}

function duplicateInvoice(id) {
  const inv = invoicesArray.find(i => i.invoiceId===id);
  if (!inv) return;
  const newId = getNextId(invoicesArray, 'INV');
  const copy = { ...JSON.parse(JSON.stringify(inv)), invoiceId:newId, date:today(), timestamp:new Date().toISOString(), status:'draft' };
  invoicesArray.unshift(copy);
  localStorage.setItem("bs_invoices", JSON.stringify(invoicesArray));
  renderInvoiceLists(); updateDashboard(); closeModal();
  toast(`Duplicated as ${newId}`, 'success');
}

function deleteInvoice(id) {
  const snap = [...invoicesArray];
  invoicesArray = invoicesArray.filter(i => i.invoiceId!==id);
  localStorage.setItem("bs_invoices", JSON.stringify(invoicesArray));
  closeModal(); renderInvoiceLists(); updateDashboard();
  toast('Invoice deleted', 'warn', () => {
    invoicesArray = snap; localStorage.setItem("bs_invoices", JSON.stringify(invoicesArray));
    renderInvoiceLists(); updateDashboard(); toast('Undo successful', 'success');
  });
}

// âââ PURCHASE EDITOR (item-level GST) âââââââââ
function renderPurchaseEditor() {
  const body = document.getElementById('purchaseItemsBody');
  body.innerHTML = purLineItems.map((it,i) => {
    const gst = purGstType === 'Inclusive'
      ? it.qty * it.cost - it.qty * (it.cost/(1+it.gstRate))
      : it.qty * it.cost * it.gstRate;
    const total = purGstType === 'Inclusive' ? it.qty * it.cost : it.qty * it.cost + gst;
    return `<tr>
      <td><input class="item-input pur-field" data-i="${i}" data-f="desc" value="${it.desc}" placeholder="Product nameâ¦"></td>
      <td><input class="item-input pur-field" data-i="${i}" data-f="qty" type="number" value="${it.qty}" min="0.01" step="0.01" style="width:60px"></td>
      <td><input class="item-input pur-field" data-i="${i}" data-f="cost" type="number" value="${it.cost}" min="0" step="0.01" style="width:90px"></td>
      <td class="no-print">
        <select class="gst-select-inline pur-gst-select" data-i="${i}">
          <option value="0" ${it.gstRate===0?'selected':''}>0%</option>
          <option value="0.05" ${it.gstRate===0.05?'selected':''}>5%</option>
          <option value="0.12" ${it.gstRate===0.12?'selected':''}>12%</option>
          <option value="0.18" ${it.gstRate===0.18?'selected':''}>18%</option>
          <option value="0.28" ${it.gstRate===0.28?'selected':''}>28%</option>
        </select>
      </td>
      <td style="color:var(--gold);font-weight:500">${fmt(gst)}</td>
      <td style="font-weight:600;color:var(--accent)">${fmt(total)}</td>
      <td class="no-print"><button class="btn-icon rem-pur-item" data-i="${i}"><i class="fas fa-trash-alt"></i></button></td>
    </tr>`;
  }).join('');

  body.querySelectorAll('.pur-field').forEach(inp => {
    inp.addEventListener('change', () => {
      const i = +inp.dataset.i, f = inp.dataset.f;
      if (!purLineItems[i]) return;
      purLineItems[i][f] = (f==='qty'||f==='cost') ? parseFloat(inp.value)||0 : inp.value;
      renderPurchaseEditor();
    });
  });
  body.querySelectorAll('.pur-gst-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const i = +sel.dataset.i;
      if (purLineItems[i]) { purLineItems[i].gstRate = parseFloat(sel.value); renderPurchaseEditor(); }
    });
  });
  body.querySelectorAll('.rem-pur-item').forEach(btn => {
    btn.addEventListener('click', () => { purLineItems.splice(+btn.dataset.i,1); renderPurchaseEditor(); });
  });
  calcPurchaseTotals();
}

function calcPurchaseTotals() {
  let sub=0, gstTotal=0, total=0;
  purLineItems.forEach(it => {
    const gst = purGstType === 'Inclusive'
      ? it.qty*it.cost - it.qty*(it.cost/(1+it.gstRate))
      : it.qty*it.cost*it.gstRate;
    gstTotal += gst;
    if (purGstType === 'Inclusive') { sub += it.qty*it.cost - gst; total += it.qty*it.cost; }
    else { sub += it.qty*it.cost; total += it.qty*it.cost+gst; }
  });
  document.getElementById('purSubtotalVal').textContent = fmt(sub);
  document.getElementById('purTaxVal').textContent = fmt(gstTotal);
  document.getElementById('purTaxLabel').textContent = `GST Total â ${purGstType}`;
  document.getElementById('purchaseTotalSpan').textContent = fmt(total);
}

function setPurGstType(type) {
  purGstType = type;
  document.getElementById('purGstExcBtn').classList.toggle('active', type==='Exclusive');
  document.getElementById('purGstIncBtn').classList.toggle('active', type==='Inclusive');
  renderPurchaseEditor();
}

// âââ SAVE PURCHASE ââââââââââââââââââââââââââââ
function savePurchase() {
  const poId = document.getElementById('poNumber').value.trim();
  if (!poId) { toast('Enter a PO number','error'); return; }
  if (!document.getElementById('supplierName').value.trim()) { toast('Enter a supplier name','error'); return; }
  if (!purLineItems.length) { toast('Add at least one item','error'); return; }

  let sub=0, gstTotal=0, total=0;
  purLineItems.forEach(it => {
    const gst = purGstType==='Inclusive' ? it.qty*it.cost-it.qty*(it.cost/(1+it.gstRate)) : it.qty*it.cost*it.gstRate;
    gstTotal += gst;
    if (purGstType==='Inclusive') { sub+=it.qty*it.cost-gst; total+=it.qty*it.cost; }
    else { sub+=it.qty*it.cost; total+=it.qty*it.cost+gst; }
  });

  const payload = {
    action:"savePurchase", poNumber:poId,
    date: document.getElementById('purchaseDate').value,
    supplier: document.getElementById('supplierName').value,
    gstType: purGstType,
    items: purLineItems.map(i => ({ product:i.desc, quantity:i.qty, unitCost:i.cost, gstRate:i.gstRate })),
    subtotal:sub, gstAmount:gstTotal, totalAmount:total
  };

  toast(`Sending PO ${poId}â¦`,'warn');
  fetch(API_URL, { method:"POST", mode:"no-cors", headers:{"Content-Type":"text/plain;charset=utf-8"}, body:JSON.stringify(payload) })
  .then(() => commitPurchase(payload))
  .catch(() => commitPurchase(payload));
}

function commitPurchase(payload) {
  purchasesArray.unshift({...payload, timestamp:new Date().toISOString()});
  localStorage.setItem("bs_purchases", JSON.stringify(purchasesArray));
  document.getElementById('poNumber').value = getNextId(purchasesArray, 'PO');
  renderPurchaseLists(); updateDashboard();
  toast(`Purchase ${payload.poNumber} saved!`,'success');
}

function clearPurchaseForm() {
  purLineItems = [{ desc:"Raw Material", qty:1, cost:0, gstRate:0.18 }];
  document.getElementById('supplierName').value='';
  renderPurchaseEditor();
  toast('Form cleared','warn');
}

// âââ RENDER PURCHASE LISTS ââââââââââââââââââââ
function renderPurchaseLists() {
  const makeItem = pur => `
    <div class="list-item" onclick="showPurchaseDetail('${pur.poNumber}')">
      <div><div class="list-item-title">${pur.poNumber}</div>
      <div class="list-item-sub">${pur.supplier} Â· ${dateLabel(pur.date)}</div></div>
      <div style="text-align:right">
        <div class="list-item-amount">${fmt(pur.totalAmount)}</div>
        <span class="badge badge-blue">Purchase</span>
      </div>
    </div>`;

  const recent = purchasesArray.slice(0,3);
  document.getElementById('recentPurchaseList').innerHTML = recent.length ? recent.map(makeItem).join('') : '<div class="empty-state"><i class="fas fa-truck"></i><p>No purchases yet</p></div>';
  document.getElementById('purchaseHistoryList').innerHTML = purchasesArray.length ? purchasesArray.map(makeItem).join('') : '<div class="empty-state"><i class="fas fa-truck"></i><p>No purchases saved yet</p></div>';
  document.getElementById('dashRecentPurchases').innerHTML = recent.length ? recent.map(makeItem).join('') : '<div class="empty-state"><i class="fas fa-truck"></i><p>No purchases yet</p></div>';
}

function filterPurchases() {
  const q = document.getElementById('purchaseSearch').value.toLowerCase();
  const filtered = purchasesArray.filter(p => p.poNumber.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q));
  document.getElementById('purchaseHistoryList').innerHTML = filtered.length
    ? filtered.map(pur => `<div class="list-item" onclick="showPurchaseDetail('${pur.poNumber}')"><div><div class="list-item-title">${pur.poNumber}</div><div class="list-item-sub">${pur.supplier} Â· ${dateLabel(pur.date)}</div></div><div style="text-align:right"><div class="list-item-amount">${fmt(pur.totalAmount)}</div></div></div>`).join('')
    : '<div class="empty-state"><i class="fas fa-search"></i><p>No results</p></div>';
}

function showPurchaseDetail(id) {
  const pur = purchasesArray.find(p => p.poNumber===id);
  if (!pur) return;
  document.getElementById('modalTitle').textContent = pur.poNumber + ' â ' + pur.supplier;
  document.getElementById('modalBody').innerHTML = `
    <div style="font-size:0.85rem;margin-bottom:12px;color:var(--ink2)"><strong>Date:</strong> ${dateLabel(pur.date)} | <strong>Supplier:</strong> ${pur.supplier}</div>
    <div class="items-table-wrap"><table class="items-table">
      <thead><tr><th>Product</th><th>Qty</th><th>Unit Cost</th><th>GST%</th><th>Total</th></tr></thead>
      <tbody>${(pur.items||[]).map(it=>`<tr><td>${it.product}</td><td>${it.quantity}</td><td>${fmt(it.unitCost)}</td><td>${((it.gstRate||0)*100).toFixed(0)}%</td><td>${fmt(it.quantity*it.unitCost)}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="totals-box" style="margin-top:12px">
      <div class="totals-row"><span>Subtotal</span><span>${fmt(pur.subtotal)}</span></div>
      <div class="totals-row"><span>GST</span><span>${fmt(pur.gstAmount)}</span></div>
      <div class="totals-row grand"><span>Total</span><span>${fmt(pur.totalAmount)}</span></div>
    </div>
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-info btn-sm" onclick="duplicatePurchase('${id}')"><i class="fas fa-copy"></i> Duplicate</button>
      <button class="btn btn-danger btn-sm" onclick="deletePurchase('${id}')"><i class="fas fa-trash"></i> Delete</button>
    </div>`;
  document.getElementById('detailModal').classList.add('open');
}

function duplicatePurchase(id) {
  const pur = purchasesArray.find(p => p.poNumber===id);
  if (!pur) return;
  const newId = getNextId(purchasesArray,'PO');
  const copy = { ...JSON.parse(JSON.stringify(pur)), poNumber:newId, date:today(), timestamp:new Date().toISOString() };
  purchasesArray.unshift(copy);
  localStorage.setItem("bs_purchases",JSON.stringify(purchasesArray));
  renderPurchaseLists(); updateDashboard(); closeModal();
  toast(`Duplicated as ${newId}`,'success');
}

function deletePurchase(id) {
  const snap = [...purchasesArray];
  purchasesArray = purchasesArray.filter(p => p.poNumber!==id);
  localStorage.setItem("bs_purchases",JSON.stringify(purchasesArray));
  closeModal(); renderPurchaseLists(); updateDashboard();
  toast('Purchase deleted','warn', () => {
    purchasesArray = snap; localStorage.setItem("bs_purchases",JSON.stringify(purchasesArray));
    renderPurchaseLists(); updateDashboard(); toast('Undo successful','success');
  });
}

// âââ PRINT INVOICE / PO âââââââââââââââââââââââ
function printCurrentInvoice() {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('print-target'));
  document.getElementById('invoicePane').classList.add('print-target');
  document.getElementById('invPrintHeader').style.display='block';
  window.print();
  setTimeout(() => { document.getElementById('invPrintHeader').style.display=''; }, 800);
}

function printCurrentPurchase() {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('print-target'));
  document.getElementById('purchasePane').classList.add('print-target');
  document.getElementById('purPrintHeader').style.display='block';
  window.print();
  setTimeout(() => { document.getElementById('purPrintHeader').style.display=''; }, 800);
}

// âââ EXPORT CSV âââââââââââââââââââââââââââââââ
function exportInvoiceCSV() {
  const header = 'Invoice ID,Date,Customer,Grand Total,GST,Status\n';
  const rows = invoicesArray.map(i => `${i.invoiceId},${i.date},${i.customerName},${i.grandTotal?.toFixed(2)},${i.gstAmount?.toFixed(2)},${i.status||'paid'}`).join('\n');
  downloadCSV(header+rows, 'invoices_'+today()+'.csv');
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type:'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  toast('CSV exported!','success');
}

// âââ INVENTORY ââââââââââââââââââââââââââââââââ
async function fetchInventoryAndReports() {
  try {
    const res = await fetch(API_URL + '?t=' + Date.now());
    const data = await res.json();
    if (data.products && data.products.length > 1) {
      inventoryStock = [];
      for (let i=1; i<data.products.length; i++) {
        const row = data.products[i];
        if (row && row[0]) inventoryStock.push({ id:row[0], name:row[1]||'Unknown', stock:parseFloat(row[7])||0, price:parseFloat(row[4])||0, gstRate:parseFloat(row[5])||0 });
      }
    }
    if (data.customers && data.customers.length > 1) {
      customersArray = [];
      const datalist = document.getElementById('customerList');
      datalist.innerHTML = '';
      for (let i=1; i<data.customers.length; i++) {
        const row = data.customers[i];
        if (row && row[1]) {
          customersArray.push({ id:row[0], name:row[1], email:row[2], address:row[3] });
          datalist.innerHTML += `<option value="${row[1]}">`;
        }
      }
    }
    document.getElementById('statusLed').className='led';
    document.getElementById('apiStatusLabel').textContent='Google Sheets Live';
    document.getElementById('apiLastSync').textContent='Synced '+new Date().toLocaleTimeString('en-IN');
    renderInventoryTable(); renderProductGrid(); updateDashboard(); renderCustomerGrid();
  } catch(e) {
    console.warn('API error:',e);
    document.getElementById('statusLed').className='led error';
    document.getElementById('apiStatusLabel').textContent='Offline Mode';
    document.getElementById('apiLastSync').textContent='Could not connect';
    fallbackStock();
  }
}

function fallbackStock() {
  if (!inventoryStock.length) {
    inventoryStock = [
      { id:'P001', name:'Sample Product A', stock:45, price:1200, gstRate:0.18 },
      { id:'P002', name:'Sample Product B', stock:8,  price:850,  gstRate:0.12 },
      { id:'P003', name:'Sample Product C', stock:120,price:350,  gstRate:0.05 },
      { id:'P004', name:'Sample Product D', stock:3,  price:4500, gstRate:0.28 },
    ];
  }
  renderInventoryTable(); renderProductGrid(); updateDashboard();
}

function renderInventoryTable() {
  const tbody = document.getElementById('inventoryTableBody');
  if (!inventoryStock.length) { tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--ink3)">No stock data</td></tr>'; return; }
  let totalValue=0, lowCount=0;
  tbody.innerHTML = inventoryStock.map(p => {
    const val = p.stock*p.price; totalValue+=val;
    const isLow = p.stock <= LOW_STOCK_THRESHOLD, isCrit = p.stock===0;
    if (isLow) lowCount++;
    const pct = Math.min(100,(p.stock/100)*100);
    const barClass = isCrit?'critical':isLow?'low':'';
    const badge = isCrit?'<span class="badge badge-red">Out of Stock</span>':isLow?'<span class="badge badge-gold">Low Stock</span>':'<span class="badge badge-green">In Stock</span>';
    return `<tr>
      <td style="font-family:monospace;font-size:0.8rem;color:var(--ink3)">${p.id}</td>
      <td style="font-weight:600">${p.name}</td>
      <td style="font-family:'Syne',sans-serif;font-weight:700;font-size:1rem">${p.stock}</td>
      <td><div class="stock-bar-wrap"><div class="stock-bar ${barClass}" style="width:${pct}%"></div></div></td>
      <td>${fmt(p.price)}</td>
      <td>${((p.gstRate||0)*100).toFixed(0)}%</td>
      <td style="font-weight:600;color:var(--accent)">${fmt(val)}</td>
      <td>${badge}</td>
    </tr>`;
  }).join('');
  document.getElementById('invTotalProducts').textContent = inventoryStock.length;
  document.getElementById('invTotalValue').textContent = fmt(totalValue);
  document.getElementById('invLowStockCount').textContent = lowCount;
  document.getElementById('dashLowStock').textContent = lowCount;
  // Low stock banner in topbar
  const banner = document.getElementById('lowStockBanner');
  if (lowCount > 0) { banner.style.display='flex'; document.getElementById('lowStockBannerText').textContent=lowCount+' low stock item'+(lowCount>1?'s':''); }
  else { banner.style.display='none'; }
}

function filterInventory() {
  const q = document.getElementById('inventorySearch').value.toLowerCase();
  const filtered = inventoryStock.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  const tbody = document.getElementById('inventoryTableBody');
  if (!filtered.length) { tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--ink3)">No results</td></tr>'; return; }
  tbody.innerHTML = filtered.map(p => {
    const val=p.stock*p.price, isLow=p.stock<=LOW_STOCK_THRESHOLD, isCrit=p.stock===0;
    const pct=Math.min(100,(p.stock/100)*100), barClass=isCrit?'critical':isLow?'low':'';
    const badge=isCrit?'<span class="badge badge-red">Out of Stock</span>':isLow?'<span class="badge badge-gold">Low Stock</span>':'<span class="badge badge-green">In Stock</span>';
    return `<tr><td style="font-family:monospace;font-size:0.8rem;color:var(--ink3)">${p.id}</td><td style="font-weight:600">${p.name}</td><td style="font-family:'Syne',sans-serif;font-weight:700">${p.stock}</td><td><div class="stock-bar-wrap"><div class="stock-bar ${barClass}" style="width:${pct}%"></div></div></td><td>${fmt(p.price)}</td><td>${((p.gstRate||0)*100).toFixed(0)}%</td><td style="font-weight:600;color:var(--accent)">${fmt(val)}</td><td>${badge}</td></tr>`;
  }).join('');
}

function refreshInventory() {
  document.getElementById('inventoryTableBody').innerHTML='<tr><td colspan="8" style="text-align:center;padding:30px"><div class="skeleton skel-line wide" style="margin:0 auto 8px"></div><div class="skeleton skel-line med" style="margin:0 auto"></div></td></tr>';
  fetchInventoryAndReports();
}

function exportInventoryCSV() {
  const header='Product ID,Name,Stock,Price,GST %,Stock Value\n';
  const rows=inventoryStock.map(p=>`${p.id},${p.name},${p.stock},${p.price},${((p.gstRate||0)*100).toFixed(0)}%,${(p.stock*p.price).toFixed(2)}`).join('\n');
  downloadCSV(header+rows,'inventory_'+today()+'.csv');
}

// âââ PRODUCTS âââââââââââââââââââââââââââââââââ
function renderProductGrid() {
  const grid=document.getElementById('productGrid');
  const q=(document.getElementById('productSearch')?.value||'').toLowerCase();
  const filtered=inventoryStock.filter(p=>p.name.toLowerCase().includes(q)||p.id.toLowerCase().includes(q));
  if (!filtered.length) { grid.innerHTML='<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-tags"></i><p>No products found</p></div>'; return; }
  grid.innerHTML=filtered.map(p=>`
    <div class="product-card">
      <div class="product-card-id">${p.id}</div>
      <div class="product-card-name">${p.name}</div>
      <div class="product-card-price">${fmt(p.price)}</div>
      <div class="product-card-stock">Stock: ${p.stock} Â· GST ${((p.gstRate||0)*100).toFixed(0)}%</div>
      ${p.stock<=LOW_STOCK_THRESHOLD?'<span class="badge badge-gold" style="margin-top:8px;display:inline-block">Low Stock</span>':''}
    </div>`).join('');
}
function filterProducts() { renderProductGrid(); }

function openAddProduct() {
  document.getElementById('modalTitle').textContent='Add New Product';
  document.getElementById('modalBody').innerHTML=`
    <div class="form-group"><label class="form-label">Product ID</label><input type="text" class="form-control" id="npId" placeholder="P005"></div>
    <div class="form-group"><label class="form-label">Product Name</label><input type="text" class="form-control" id="npName" placeholder="Product name"></div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Unit Price (â¹)</label><input type="number" class="form-control" id="npPrice" placeholder="0.00"></div>
      <div class="form-group"><label class="form-label">Initial Stock</label><input type="number" class="form-control" id="npStock" placeholder="0"></div>
    </div>
    <div class="form-group"><label class="form-label">GST Rate</label>
      <select class="form-control" id="npGst">
        <option value="0">0% â Exempt</option><option value="0.05">5%</option><option value="0.12">12%</option><option value="0.18" selected>18%</option><option value="0.28">28%</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Reorder Threshold</label><input type="number" class="form-control" id="npThresh" value="10"></div>
    <div style="margin-top:16px"><button class="btn btn-primary" onclick="addProductLocal()"><i class="fas fa-plus"></i> Add Product</button></div>`;
  document.getElementById('detailModal').classList.add('open');
}

function addProductLocal() {
  const id=document.getElementById('npId').value.trim();
  const name=document.getElementById('npName').value.trim();
  const price=parseFloat(document.getElementById('npPrice').value)||0;
  const stock=parseFloat(document.getElementById('npStock').value)||0;
  const gstRate=parseFloat(document.getElementById('npGst').value)||0;
  if (!id||!name) { toast('Enter ID and name','error'); return; }
  if (inventoryStock.find(p=>p.id===id)) { toast('Product ID exists','error'); return; }
  inventoryStock.push({ id, name, stock, price, gstRate });
  closeModal(); renderProductGrid(); renderInventoryTable(); updateDashboard();
  toast(`Product ${name} added`,'success');
}

// âââ CUSTOMERS ââââââââââââââââââââââââââââââââ
function renderCustomerGrid() {
  const grid=document.getElementById('customerGrid');
  const q=(document.getElementById('customerSearch')?.value||'').toLowerCase();
  const filtered=customersArray.filter(c=>c.name.toLowerCase().includes(q)||(c.email||'').toLowerCase().includes(q));
  if (!filtered.length) { grid.innerHTML='<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-users"></i><p>No customers yet</p></div>'; return; }
  grid.innerHTML=filtered.map(c=>`
    <div class="customer-card">
      <div class="customer-name"><i class="fas fa-user-circle" style="color:var(--accent2);margin-right:6px"></i>${c.name}</div>
      ${c.email?`<div class="customer-detail"><i class="fas fa-envelope" style="margin-right:4px"></i>${c.email}</div>`:''}
      ${c.address?`<div class="customer-detail"><i class="fas fa-map-marker-alt" style="margin-right:4px"></i>${c.address}</div>`:''}
      <div style="margin-top:8px;font-size:0.78rem;color:var(--accent2);font-weight:600">${invoicesArray.filter(i=>i.customerName===c.name).length} invoice(s)</div>
    </div>`).join('');
}
function filterCustomers() { renderCustomerGrid(); }

function openAddCustomer() {
  document.getElementById('modalTitle').textContent='Add Customer';
  document.getElementById('modalBody').innerHTML=`
    <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-control" id="ncName" placeholder="Customer name"></div>
    <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="ncEmail" placeholder="email@example.com"></div>
    <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" id="ncAddr" placeholder="Address..."></textarea></div>
    <div style="margin-top:16px"><button class="btn btn-primary" onclick="addCustomerLocal()"><i class="fas fa-user-plus"></i> Add Customer</button></div>`;
  document.getElementById('detailModal').classList.add('open');
}

function addCustomerLocal() {
  const name=document.getElementById('ncName').value.trim();
  if (!name) { toast('Enter a name','error'); return; }
  const c = { id:'C'+Date.now(), name, email:document.getElementById('ncEmail').value.trim(), address:document.getElementById('ncAddr').value.trim() };
  customersArray.push(c);
  const dl=document.getElementById('customerList');
  dl.innerHTML+=`<option value="${c.name}">`;
  closeModal(); renderCustomerGrid(); toast(`${name} added`,'success');
}

// âââ DASHBOARD UPDATE âââââââââââââââââââââââââ
function updateDashboard() {
  const totalRevenue = invoicesArray.reduce((s,i)=>s+(i.grandTotal||0),0);
  const totalPurchases = purchasesArray.reduce((s,p)=>s+(p.totalAmount||0),0);
  document.getElementById('dashTotalRevenue').textContent = fmt(totalRevenue);
  document.getElementById('dashTotalPurchases').textContent = fmt(totalPurchases);
  document.getElementById('dashInvCount').textContent = invoicesArray.length;
  generateTopProducts();
}

function generateTopProducts() {
  const sales={};
  invoicesArray.forEach(inv=>(inv.items||[]).forEach(it=>{ sales[it.description]=(sales[it.description]||0)+(it.quantity||0); }));
  const sorted=Object.entries(sales).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const html=sorted.length?sorted.map(([name,qty],i)=>`
    <div class="list-item">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:28px;height:28px;background:var(--accent-light);color:var(--accent2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem">${i+1}</div>
        <div class="list-item-title">${name}</div>
      </div>
      <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.9rem">${qty} units</div>
    </div>`).join(''):'<div class="empty-state"><i class="fas fa-chart-bar"></i><p>No sales data yet</p></div>';
  document.getElementById('dashTopProducts').innerHTML=html;
  document.getElementById('reportTopSellingList').innerHTML=html;
}

// âââ REPORT DATE RANGE ââââââââââââââââââââââââ
function setReportRange(type, btn) {
  const now=new Date(), y=now.getFullYear(), m=now.getMonth(), d=now.getDate();
  document.querySelectorAll('.date-filter-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (type==='week') { const s=new Date(y,m,d-now.getDay()); reportRange={from:s.toISOString().slice(0,10), to:today()}; }
  else if (type==='month') { reportRange={from:new Date(y,m,1).toISOString().slice(0,10), to:today()}; }
  else if (type==='quarter') { const qm=Math.floor(m/3)*3; reportRange={from:new Date(y,qm,1).toISOString().slice(0,10), to:today()}; }
  else if (type==='all') { reportRange={from:null, to:null}; }
  else if (type==='custom') {
    reportRange={ from:document.getElementById('reportFrom').value, to:document.getElementById('reportTo').value };
    document.querySelectorAll('.date-filter-btn').forEach(b=>b.classList.remove('active'));
  }
  buildReports();
}

function filterByRange(arr, amtKey) {
  if (!reportRange.from && !reportRange.to) return arr;
  return arr.filter(item=>{
    const d=item.date||item.timestamp?.slice(0,10);
    if (!d) return true;
    if (reportRange.from && d < reportRange.from) return false;
    if (reportRange.to && d > reportRange.to) return false;
    return true;
  });
}

// âââ REPORTS ââââââââââââââââââââââââââââââââââ
function buildReports() {
  generateTopProducts();
  const filtInv = filterByRange(invoicesArray, 'grandTotal');
  const filtPur = filterByRange(purchasesArray, 'totalAmount');

  const totalRevenue = filtInv.reduce((s,i)=>s+(i.grandTotal||0),0);
  const totalPurchases = filtPur.reduce((s,p)=>s+(p.totalAmount||0),0);
  const gstCollected = filtInv.reduce((s,i)=>s+(i.gstAmount||0),0);
  const gstPaid = filtPur.reduce((s,p)=>s+(p.gstAmount||0),0);

  document.getElementById('repNetProfit').textContent = fmt(totalRevenue-totalPurchases);
  document.getElementById('repGSTCollected').textContent = fmt(gstCollected);
  document.getElementById('repGSTPaid').textContent = fmt(gstPaid);
  document.getElementById('repGSTNet').textContent = fmt(gstCollected-gstPaid);

  // GST Summary
  const cgstColl=gstCollected/2, sgstColl=gstCollected/2, cgstPaid=gstPaid/2, sgstPaid=gstPaid/2;
  document.getElementById('gCGSTColl').textContent=fmt(cgstColl);
  document.getElementById('gCGSTPaid').textContent=fmt(cgstPaid);
  document.getElementById('gCGSTNet').textContent=fmt(cgstColl-cgstPaid);
  document.getElementById('gSGSTColl').textContent=fmt(sgstColl);
  document.getElementById('gSGSTPaid').textContent=fmt(sgstPaid);
  document.getElementById('gSGSTNet').textContent=fmt(sgstColl-sgstPaid);
  document.getElementById('gTotalColl').textContent=fmt(gstCollected);
  document.getElementById('gTotalPaid').textContent=fmt(gstPaid);
  document.getElementById('gTotalNet').textContent=fmt(gstCollected-gstPaid);

  // GST rate breakdown
  const rateMap={};
  filtInv.forEach(inv=>(inv.items||[]).forEach(it=>{
    const r=((it.gstRate||0)*100).toFixed(0)+'%';
    rateMap[r]=(rateMap[r]||0)+(it.quantity*it.unitPrice*(it.gstRate||0));
  }));
  document.getElementById('gstRateBreakdown').innerHTML=`
    <p style="font-size:0.8rem;color:var(--ink3);margin-bottom:12px">GST collected by rate slab:</p>
    ${Object.entries(rateMap).map(([r,v])=>`<div style="display:flex;justify-content:space-between;font-size:0.875rem;padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-weight:600">${r}</span><span style="color:var(--accent)">${fmt(v)}</span></div>`).join('') || '<p style="color:var(--ink3);font-size:0.85rem">No GST data</p>'}`;

  // Group by month
  function groupByMonth(arr, amtKey) {
    const m={};
    arr.forEach(item=>{
      const d=item.date||item.timestamp?.slice(0,10);
      if (!d) return;
      const key=new Date(d).toLocaleString('en-IN',{month:'short',year:'numeric'});
      m[key]=(m[key]||0)+(item[amtKey]||0);
    });
    return m;
  }
  const invByMonth=groupByMonth(filtInv,'grandTotal'), purByMonth=groupByMonth(filtPur,'totalAmount');
  const allMonths=[...new Set([...Object.keys(invByMonth),...Object.keys(purByMonth)])];
  if (!allMonths.length) { allMonths.push('No Data'); }
  const salesData=allMonths.map(m=>invByMonth[m]||0);
  const purData=allMonths.map(m=>purByMonth[m]||0);
  const profitData=allMonths.map(m=>(invByMonth[m]||0)-(purByMonth[m]||0));

  if (chartSales) chartSales.destroy();
  chartSales=new Chart(document.getElementById('reportSalesChart').getContext('2d'),{
    type:'bar',
    data:{ labels:allMonths, datasets:[
      { label:'Sales (â¹)', data:salesData, backgroundColor:'#1a4a3a', borderRadius:6 },
      { label:'Purchases (â¹)', data:purData, backgroundColor:'#c8933a', borderRadius:6 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top'}},
      scales:{ y:{ticks:{callback:v=>'â¹'+v.toLocaleString('en-IN')}, grid:{color:'rgba(0,0,0,0.05)'}}, x:{grid:{display:false}} } }
  });

  if (chartProfit) chartProfit.destroy();
  chartProfit=new Chart(document.getElementById('reportProfitChart').getContext('2d'),{
    type:'line',
    data:{ labels:allMonths, datasets:[
      { label:'Net Profit (â¹)', data:profitData, borderColor:'#2d7a62', backgroundColor:'rgba(45,122,98,0.1)', fill:true, tension:0.4, pointBackgroundColor:'#2d7a62', borderWidth:2 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top'}},
      scales:{ y:{ticks:{callback:v=>'â¹'+v.toLocaleString('en-IN')}, grid:{color:'rgba(0,0,0,0.05)'}}, x:{grid:{display:false}} } }
  });

  if (chartPie) chartPie.destroy();
  const totalInv=inventoryStock.reduce((s,p)=>s+p.stock*p.price,0);
  chartPie=new Chart(document.getElementById('reportPieChart').getContext('2d'),{
    type:'doughnut',
    data:{ labels:['Revenue','Purchases','Stock Value'], datasets:[{ data:[totalRevenue||1,totalPurchases||0.5,totalInv||0.5], backgroundColor:['#1a4a3a','#c8933a','#2d7a62'], borderWidth:0, hoverOffset:8 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom'}, tooltip:{callbacks:{label:ctx=>` ${fmt(ctx.parsed)}`}} }, cutout:'65%' }
  });
}

// âââ GLOBAL SEARCH ââââââââââââââââââââââââââââ
function doGlobalSearch() {
  const q=document.getElementById('globalSearchInput').value.trim().toLowerCase();
  const drop=document.getElementById('globalSearchDrop');
  if (!q) { drop.classList.remove('open'); return; }
  const results=[];
  invoicesArray.filter(i=>i.invoiceId.toLowerCase().includes(q)||i.customerName.toLowerCase().includes(q)).slice(0,3).forEach(i=>
    results.push({ label:`${i.invoiceId} â ${i.customerName}`, tag:'Invoice', action:()=>{ switchTab('invoice'); showInvoiceDetail(i.invoiceId); } }));
  purchasesArray.filter(p=>p.poNumber.toLowerCase().includes(q)||p.supplier.toLowerCase().includes(q)).slice(0,3).forEach(p=>
    results.push({ label:`${p.poNumber} â ${p.supplier}`, tag:'Purchase', action:()=>{ switchTab('purchase'); showPurchaseDetail(p.poNumber); } }));
  inventoryStock.filter(p=>p.name.toLowerCase().includes(q)||p.id.toLowerCase().includes(q)).slice(0,3).forEach(p=>
    results.push({ label:`${p.name} (${p.id})`, tag:'Product', action:()=>{ switchTab('products'); } }));
  customersArray.filter(c=>c.name.toLowerCase().includes(q)).slice(0,2).forEach(c=>
    results.push({ label:c.name, tag:'Customer', action:()=>{ switchTab('customers'); } }));

  if (!results.length) { drop.innerHTML='<div class="sr-item" style="color:var(--ink3)">No results found</div>'; drop.classList.add('open'); return; }
  drop.innerHTML=results.map((r,i)=>`<div class="sr-item" data-idx="${i}"><div class="sr-item-tag">${r.tag}</div>${r.label}</div>`).join('');
  drop.classList.add('open');
  drop.querySelectorAll('.sr-item[data-idx]').forEach(el=>{
    el.addEventListener('click',()=>{ results[+el.dataset.idx].action(); drop.classList.remove('open'); document.getElementById('globalSearchInput').value=''; });
  });
}
document.addEventListener('click', e=>{ if (!e.target.closest('.global-search-wrap')) document.getElementById('globalSearchDrop').classList.remove('open'); });

// âââ KEYBOARD SHORTCUTS âââââââââââââââââââââââ
document.addEventListener('keydown', e => {
  if (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT') return;
  const hint=document.getElementById('kbHint');
  if ((e.ctrlKey||e.metaKey) && e.key==='n') { e.preventDefault(); switchTab('invoice'); hint.textContent='âN â New Invoice'; hint.style.display='block'; setTimeout(()=>hint.style.display='none',1500); }
  if ((e.ctrlKey||e.metaKey) && e.key==='p') { e.preventDefault(); switchTab('purchase'); hint.textContent='âP â New Purchase'; hint.style.display='block'; setTimeout(()=>hint.style.display='none',1500); }
  if ((e.ctrlKey||e.metaKey) && e.key==='s') { e.preventDefault(); const active=document.querySelector('.tab-pane.active'); if (active?.id==='invoicePane') saveInvoice(); else if (active?.id==='purchasePane') savePurchase(); }
  if (e.key==='Escape') closeModal();
  if (e.key==='/' && !e.ctrlKey) { e.preventDefault(); document.getElementById('globalSearchInput').focus(); }
});

// âââ MODAL ââââââââââââââââââââââââââââââââââââ
function closeModal() { document.getElementById('detailModal').classList.remove('open'); }
document.getElementById('detailModal').addEventListener('click', function(e){ if(e.target===this) closeModal(); });

// âââ EVENT BINDINGS âââââââââââââââââââââââââââ
document.getElementById('customerName').addEventListener('input', e => {
  const match=customersArray.find(c=>c.name.toLowerCase()===e.target.value.trim().toLowerCase());
  if (match) {
    document.getElementById('customerEmail').value=match.email||'';
    document.getElementById('billingAddr').value=match.address||'';
    toast(`Loaded details for ${match.name}`,'success');
  }
});
document.getElementById('addInvoiceItemBtn').addEventListener('click',()=>{ invLineItems.push({desc:"New Item",qty:1,price:0,gstRate:0.18}); renderInvoiceEditor(); });
document.getElementById('saveInvoiceBtn').addEventListener('click', saveInvoice);
document.getElementById('clearInvoiceFormBtn').addEventListener('click', clearInvoiceForm);
document.getElementById('addPurchaseItemBtn').addEventListener('click',()=>{ purLineItems.push({desc:"New Product",qty:1,cost:0,gstRate:0.18}); renderPurchaseEditor(); });
document.getElementById('savePurchaseBtn').addEventListener('click', savePurchase);
document.getElementById('refreshInvoiceHistoryBtn').addEventListener('click',()=>{ renderInvoiceLists(); toast('Invoices refreshed'); });
document.getElementById('refreshPurchaseHistoryBtn').addEventListener('click',()=>{ renderPurchaseLists(); toast('Purchases refreshed'); });
document.getElementById('refreshInventoryBtn').addEventListener('click', refreshInventory);
document.getElementById('mobileMenuBtn').addEventListener('click',()=>{ document.getElementById('sidebar').classList.toggle('open'); });

// âââ INIT âââââââââââââââââââââââââââââââââââââ
function init() {
  loadTheme();
  setupDates();
  loadSettings();
  invoicesArray = JSON.parse(localStorage.getItem("bs_invoices")||'[]');
  purchasesArray = JSON.parse(localStorage.getItem("bs_purchases")||'[]');
  renderInvoiceEditor();
  renderPurchaseEditor();
  renderInvoiceLists();
  renderPurchaseLists();
  updateDashboard();
  initTabs();
  fetchInventoryAndReports();
  document.getElementById('invNumber').value = getNextId(invoicesArray,'INV');
  document.getElementById('poNumber').value = getNextId(purchasesArray,'PO');
  // init report range
  setReportRange('all', document.querySelector('.date-filter-btn'));
}
init();