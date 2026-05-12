// ─── INVOICE EDITOR (item-level GST) ──────────
function renderInvoiceEditor() {
  const body = document.getElementById('invoiceItemsBody');
  body.innerHTML = invLineItems.map((it, i) => {
    const { gst: gstAmt, total } = calcGST(it.qty * it.price, it.gstRate, invGstType);
    return `<tr>
      <td><input class="item-input inv-field" data-i="${i}" data-f="desc" value="${esc(it.desc)}" placeholder="Add item…" list="productList"></td>
      <td><input class="item-input inv-field" data-i="${i}" data-f="qty" type="number" value="${it.qty}" min="0.01" step="0.01" style="width:60px"></td>
      <td><input class="item-input inv-field" data-i="${i}" data-f="price" type="number" value="${it.price}" min="0" step="0.01" style="width:90px"></td>
      <td class="no-print">
        <select class="gst-select-inline inv-gst-select" data-i="${i}">
          <option value="0"    ${it.gstRate === 0    ? 'selected' : ''}>0%</option>
          <option value="0.05" ${it.gstRate === 0.05 ? 'selected' : ''}>5%</option>
          <option value="0.12" ${it.gstRate === 0.12 ? 'selected' : ''}>12%</option>
          <option value="0.18" ${it.gstRate === 0.18 ? 'selected' : ''}>18%</option>
          <option value="0.28" ${it.gstRate === 0.28 ? 'selected' : ''}>28%</option>
        </select>
      </td>
      <td style="color:var(--gold);font-weight:500">${fmt(gstAmt)}</td>
      <td style="font-weight:600;color:var(--accent)">${fmt(total)}</td>
      <td class="no-print"><button class="btn-icon rem-inv-item" data-i="${i}" title="Remove item"><i class="fas fa-trash-alt"></i></button></td>
    </tr>`;
  }).join('');

  body.querySelectorAll('.inv-field').forEach(inp => {
    inp.addEventListener('change', () => {
      const i = +inp.dataset.i, f = inp.dataset.f;
      if (!invLineItems[i]) return;
      if (f === 'qty' || f === 'price') {
        invLineItems[i][f] = parseFloat(inp.value) || 0;
      } else {
        invLineItems[i][f] = inp.value;
        const match = inventoryStock.find(p => p.name.toLowerCase() === inp.value.toLowerCase());
        if (match) {
          invLineItems[i].price   = match.sellPrice || match.price || 0;
          invLineItems[i].gstRate = match.gstRate   || 0;
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

// ─── SHARED TOTALS COMPUTATION ─────────────────
// fix: single function used by both calcInvoiceTotals() and saveInvoice()
// so the displayed value always matches the saved value — no double-calculation drift
function _computeInvoiceTotals() {
  let sub = 0, gstTotal = 0, grand = 0;
  invLineItems.forEach(it => {
    const { gst, subtotalPart, total } = calcGST(it.qty * it.price, it.gstRate, invGstType);
    sub += subtotalPart; gstTotal += gst; grand += total;
  });
  const discVal  = parseFloat(document.getElementById('invDiscountVal').value) || 0;
  const discount = invDiscType === 'flat' ? Math.min(discVal, grand) : grand * (discVal / 100);
  grand -= discount;
  return { sub, gstTotal, grand, discount };
}

function calcInvoiceTotals() {
  const { sub, gstTotal, grand, discount } = _computeInvoiceTotals();
  document.getElementById('subtotalVal').textContent     = fmt(sub);
  document.getElementById('taxVal').textContent          = fmt(gstTotal);
  document.getElementById('taxLabel').textContent        = `GST Total — ${invGstType}`;
  document.getElementById('discountDisplay').textContent = `– ${fmt(discount)}`;
  document.getElementById('grandTotalVal').textContent   = fmt(grand);
}

function setGstType(type) {
  invGstType = type;
  document.getElementById('gstExcBtn').classList.toggle('active', type === 'Exclusive');
  document.getElementById('gstIncBtn').classList.toggle('active', type === 'Inclusive');
  renderInvoiceEditor();
}

function setDiscType(type) {
  invDiscType = type;
  document.getElementById('discFlat').classList.toggle('active', type === 'flat');
  document.getElementById('discPct').classList.toggle('active',  type === 'pct');
  calcInvoiceTotals();
}

// ─── SAVE INVOICE ─────────────────────────────
function saveInvoice() {
  if (App.isSaving) return;
 
  // Flush latest screen values before saving
  document.querySelectorAll('.inv-field').forEach(inp => {
    const i = +inp.dataset.i, f = inp.dataset.f;
    if (!invLineItems[i]) return;
    if (f === 'qty' || f === 'price') invLineItems[i][f] = parseFloat(inp.value) || 0;
    else invLineItems[i][f] = inp.value;
  });
  document.querySelectorAll('.inv-gst-select').forEach(sel => {
    const i = +sel.dataset.i;
    if (invLineItems[i]) invLineItems[i].gstRate = parseFloat(sel.value) || 0;
  });
 
  const invId = document.getElementById('invNumber').value.trim();
  if (!invId) { toast('Enter an invoice number', 'error'); return; }
 
  const isEditing = App.editingInvoiceId === invId;
  if (isInvoiceIdDuplicate(invId) && !isEditing) {
    toast(`Invoice ${invId} already exists — use a different number`, 'error'); return;
  }
  if (!document.getElementById('customerName').value.trim()) { toast('Enter a customer name', 'error'); return; }
  if (!invLineItems.length) { toast('Add at least one line item', 'error'); return; }
  if (invLineItems.some(i => !i.desc.trim())) { toast('Enter a product name for all items', 'error'); return; }
 
  // fix: use shared compute function — displayed value === saved value
  const { sub, gstTotal, grand, discount } = _computeInvoiceTotals();
 
  const statusSelect = document.getElementById('invStatusSelect');
  const status = statusSelect ? statusSelect.value : 'unpaid';
 
  const payload = {
    action: isEditing ? "editInvoice" : "saveInvoice",
    invoiceId: invId,
    date:           document.getElementById('invDate').value,
    customerName:   document.getElementById('customerName').value,
    customerEmail:  document.getElementById('customerEmail').value,
    billingAddress: document.getElementById('billingAddr').value,
    gstType: invGstType,
    supplyType: bizProfile.supplyType || 'intra',
    items: invLineItems.map(i => ({
      description: i.desc,
      quantity: parseFloat(i.qty),   // fix: always number, never string
      unitPrice: parseFloat(i.price),
      gstRate: i.gstRate
    })),
    subtotal: sub, gstAmount: gstTotal, discount, grandTotal: grand, status
  };
 
  App.isSaving = true;
  const saveBtn = document.getElementById('saveInvoiceBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }
 
  // Auto-learn new customer
  const customerName = document.getElementById('customerName').value.trim();
  if (customerName && !customersArray.find(c => c.name.toLowerCase() === customerName.toLowerCase())) {
    customersArray.push({ id: 'CUST-' + Date.now().toString().slice(-5), name: customerName, email: payload.customerEmail, address: payload.billingAddress });
  }
 
  // Revert old stock if editing
  if (isEditing) {
    const oldInv = invoicesArray.find(i => i.invoiceId === invId);
    if (oldInv) {
      (oldInv.items || []).forEach(oldIt => {
        const existing = inventoryStock.find(p => p.name.toLowerCase() === oldIt.description.toLowerCase());
        if (existing) existing.stock = (existing.stock || 0) + parseFloat(oldIt.quantity); // fix: parseFloat
      });
    }
    invoicesArray = invoicesArray.filter(i => i.invoiceId !== invId);
    App.editingInvoiceId = null;
  }
 
  // Deduct new stock
  invLineItems.forEach(it => {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === it.desc.toLowerCase());
    if (existing) {
      existing.stock = (existing.stock || 0) - it.qty;
    } else {
      // fix: new auto-learned products get stock: 0, not stock: -qty
      inventoryStock.push({
        id: 'P-' + Date.now().toString().slice(-5),
        name: it.desc,
        sellPrice: it.price,
        costPrice: it.price * 0.7,
        gstRate: it.gstRate,
        stock: 0
      });
    }
  });
 
  if (typeof updateDatalists === 'function') updateDatalists();
  if (typeof renderInventoryTable === 'function') renderInventoryTable();
 
  const finish = (local) => {
    invoicesArray.unshift({ ...payload, timestamp: new Date().toISOString() });
    localStorage.setItem("bs_invoices", JSON.stringify(invoicesArray));
    renderInvoiceLists(); updateDashboard();
    App.isSaving = false;
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Invoice'; }
    clearInvoiceForm(true);
 
    // fix: build toast DOM manually so the <a> tag is not escaped by esc()
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const td = document.createElement('div');
    td.className = 'toast success';
 
    const icon = document.createElement('i');
    icon.className = 'fas fa-check-circle';
    td.appendChild(icon);
 
    const msg = document.createTextNode(` Invoice ${invId} saved${local ? ' locally' : ''}! `);
    td.appendChild(msg);
 
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = 'View';
    link.style.cssText = 'color:#fff;text-decoration:underline;margin-left:4px;font-weight:700';
    link.addEventListener('click', e => { e.preventDefault(); showInvoiceDetail(invId); td.remove(); });
    td.appendChild(link);
 
    document.body.appendChild(td);
    setTimeout(() => td.remove(), 5000);
  };
 
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
    .then(() => finish(false))
    .catch(() => finish(true));
}

// ─── CLEAR INVOICE FORM ────────────────────────
function clearInvoiceForm(force = false) {
  if (!force && invLineItems.some(i => i.desc.trim())) {
    if (!confirm('Clear all line items and customer details?')) return;
  }
  invLineItems.length = 0;
  invLineItems.push({ desc: '', qty: 1, price: 0, gstRate: 0.18 });
  ['customerName','customerEmail','billingAddr','invDiscountVal'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });

  const statusSelect = document.getElementById('invStatusSelect');
  if (statusSelect) statusSelect.value = 'unpaid';

  // fix: reset editingInvoiceStatus to 'unpaid' (was incorrectly 'paid')
  App.editingInvoiceId     = null;
  App.editingInvoiceStatus = 'unpaid';

  const invNum = document.getElementById('invNumber');
  if (invNum) { invNum.value = getNextId(invoicesArray, 'INV'); invNum.readOnly = false; invNum.style.backgroundColor = ''; }
  const invDate = document.getElementById('invDate');
  if (invDate) invDate.value = today();

  renderInvoiceEditor();

  const formTitle = document.getElementById('invoiceFormTitle');
  if (formTitle) formTitle.innerHTML = `<i class="fas fa-plus-circle"></i> New Invoice`;

  if (!force) toast('Form cleared', 'warn');
}

// ─── RENDER INVOICE LISTS ─────────────────────
function renderInvoiceLists() {
  const makeItem = inv => `
    <div class="list-item" onclick="showInvoiceDetail('${esc(inv.invoiceId)}')">
      <div>
        <div class="list-item-title">${esc(inv.invoiceId)}</div>
        <div class="list-item-sub">${esc(inv.customerName)} · ${dateLabel(inv.date)}</div>
      </div>
      <div style="text-align:right">
        <div class="list-item-amount">${fmt(inv.grandTotal)}</div>
        ${getStatusBadge(inv)}
      </div>
    </div>`;

  const recent = invoicesArray.slice(0, 4);
  const emptyHTML = () => `<div class="empty-state"><i class="fas fa-file-invoice-dollar"></i><p>No invoices yet</p></div>`;
  ['recentInvoiceList','dashRecentInvoices'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = recent.length ? recent.map(makeItem).join('') : emptyHTML();
  });
  const hist = document.getElementById('invoiceHistoryList');
  if (hist) hist.innerHTML = invoicesArray.length
    ? invoicesArray.map(makeItem).join('')
    : '<div class="empty-state"><i class="fas fa-archive"></i><p>No invoices saved</p></div>';

  _updateInvoiceQuickStats();
}

// ─── INVOICE QUICK STATS ──────────────────────
function _updateInvoiceQuickStats() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const thisMonth = invoicesArray.filter(i => {
    if (!i.date) return false;
    const d = new Date(i.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  const unpaid = invoicesArray.filter(i => i.status === 'unpaid' || i.status === 'overdue');
  const mc = document.getElementById('invMonthCount');  if (mc) mc.textContent = thisMonth.length;
  const uc = document.getElementById('invUnpaidCount'); if (uc) uc.textContent = unpaid.length;

  const rl = document.getElementById('invoiceRecentList');
  if (rl) rl.innerHTML = invoicesArray.length
    ? invoicesArray.slice(0, 8).map(inv => `
        <div class="list-item" onclick="showInvoiceDetail('${esc(inv.invoiceId)}')">
          <div><div class="list-item-title">${esc(inv.invoiceId)}</div><div class="list-item-sub">${esc(inv.customerName)} · ${dateLabel(inv.date)}</div></div>
          <div style="text-align:right"><div class="list-item-amount">${fmt(inv.grandTotal)}</div>${getStatusBadge(inv)}</div>
        </div>`).join('')
    : '<div class="empty-state"><i class="fas fa-file-invoice"></i><p>No invoices yet</p></div>';
}

function filterInvoices() {
  const q = document.getElementById('invoiceSearch').value.toLowerCase();
  const filtered = invoicesArray.filter(i =>
    i.invoiceId.toLowerCase().includes(q) ||
    i.customerName.toLowerCase().includes(q) ||
    (i.customerEmail || '').toLowerCase().includes(q) ||
    String(i.grandTotal || '').includes(q) ||
    (i.date || '').includes(q)
  );
  const hist = document.getElementById('invoiceHistoryList');
  if (hist) hist.innerHTML = filtered.length
    ? filtered.map(inv => `<div class="list-item" onclick="showInvoiceDetail('${esc(inv.invoiceId)}')"><div><div class="list-item-title">${esc(inv.invoiceId)}</div><div class="list-item-sub">${esc(inv.customerName)} · ${dateLabel(inv.date)}</div></div><div style="text-align:right"><div class="list-item-amount">${fmt(inv.grandTotal)}</div>${getStatusBadge(inv)}</div></div>`).join('')
    : '<div class="empty-state"><i class="fas fa-search"></i><p>No results</p></div>';
}

// ─── SHOW INVOICE DETAIL ──────────────────────
function showInvoiceDetail(id) {
  const inv = invoicesArray.find(i => i.invoiceId === id);
  if (!inv) return;
  document.getElementById('modalTitle').textContent = `${inv.invoiceId} — ${inv.customerName}`;
  document.getElementById('modalBody').innerHTML = `
    <div style="font-size:0.85rem;margin-bottom:12px;color:var(--ink2)">
      <strong>Date:</strong> ${dateLabel(inv.date)} &nbsp;|&nbsp;
      <strong>Customer:</strong> ${esc(inv.customerName)} &nbsp;|&nbsp;
      <strong>GST:</strong> ${esc(inv.gstType || '')} &nbsp;|&nbsp;
      <strong>Supply:</strong> ${inv.supplyType === 'inter' ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'}
    </div>
    <div class="items-table-wrap">
      <table class="items-table">
        <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>GST%</th><th>Total</th></tr></thead>
        <tbody>
          ${(inv.items || []).map(it => {
            // fix: show true per-item total including GST, not just base price
            const { total } = calcGST(parseFloat(it.quantity) * parseFloat(it.unitPrice), it.gstRate || 0, inv.gstType || 'Exclusive');
            return `<tr>
              <td>${esc(it.description)}</td>
              <td>${parseFloat(it.quantity)}</td>
              <td>${fmt(it.unitPrice)}</td>
              <td>${((it.gstRate || 0) * 100).toFixed(0)}%</td>
              <td>${fmt(total)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="totals-box" style="margin-top:12px">
      <div class="totals-row"><span>Subtotal</span><span>${fmt(inv.subtotal)}</span></div>
      <div class="totals-row"><span>GST</span><span>${fmt(inv.gstAmount)}</span></div>
      ${inv.discount ? `<div class="totals-row discount-row"><span>Discount</span><span>– ${fmt(inv.discount)}</span></div>` : ''}
      <div class="totals-row grand"><span>Grand Total</span><span>${fmt(inv.grandTotal)}</span></div>
    </div>
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <select class="form-control" id="invStatusSel" style="max-width:160px">
        <option value="paid"    ${inv.status === 'paid'    ? 'selected' : ''}>Paid</option>
        <option value="unpaid"  ${inv.status === 'unpaid'  ? 'selected' : ''}>Unpaid</option>
        <option value="draft"   ${inv.status === 'draft'   ? 'selected' : ''}>Draft</option>
        <option value="overdue" ${inv.status === 'overdue' ? 'selected' : ''}>Overdue</option>
      </select>
      <button class="btn btn-secondary btn-sm" onclick="updateInvStatus('${esc(id)}')"><i class="fas fa-tag"></i> Update Status</button>
      <button class="btn btn-primary btn-sm"   onclick="loadEditInvoice('${esc(id)}')"><i class="fas fa-edit"></i> Edit</button>
      <button class="btn btn-gold btn-sm"      onclick="printSavedInvoice('${esc(id)}')"><i class="fas fa-print"></i> Print</button>
      <button class="btn btn-info btn-sm"      onclick="duplicateInvoice('${esc(id)}')"><i class="fas fa-copy"></i> Duplicate</button>
      <button class="btn btn-danger btn-sm"    onclick="deleteInvoice('${esc(id)}')"><i class="fas fa-trash"></i> Delete</button>
    </div>`;
  document.getElementById('detailModal').classList.add('open');
}

function printSavedInvoice(id) {
  loadEditInvoice(id);
  setTimeout(() => {
    printCurrentInvoice();
    setTimeout(() => { clearInvoiceForm(true); }, 1000);
  }, 400);
}

function updateInvStatus(id) {
  const inv = invoicesArray.find(i => i.invoiceId === id);
  if (inv) {
    inv.status = document.getElementById('invStatusSel').value;
    localStorage.setItem("bs_invoices", JSON.stringify(invoicesArray));
    renderInvoiceLists();
    toast('Syncing status…', 'warn');
    fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "updateInvoiceStatus", invoiceId: id, status: inv.status }) })
      .then(() => toast('Status saved', 'success'));
  }
}

function duplicateInvoice(id) {
  const inv = invoicesArray.find(i => i.invoiceId === id);
  if (!inv) return;
  App.editingInvoiceId     = null;
  App.editingInvoiceStatus = 'unpaid';

  document.getElementById('invNumber').value = getNextId(invoicesArray, 'INV');
  document.getElementById('invNumber').readOnly = false;
  document.getElementById('invNumber').style.backgroundColor = '';
  document.getElementById('invDate').value         = today();
  document.getElementById('customerName').value    = inv.customerName;
  document.getElementById('customerEmail').value   = inv.customerEmail || '';
  document.getElementById('billingAddr').value     = inv.billingAddress || '';
  document.getElementById('invDiscountVal').value  = inv.discount || 0;
  setGstType(inv.gstType || 'Exclusive');

  invLineItems.length = 0;
  (inv.items || []).forEach(it => {
    invLineItems.push({ desc: it.description, qty: parseFloat(it.quantity), price: parseFloat(it.unitPrice), gstRate: it.gstRate });
  });

  renderInvoiceEditor();
  closeModal();
  switchTab('invoice');

  const formTitle = document.getElementById('invoiceFormTitle');
  if (formTitle) formTitle.innerHTML = `<i class="fas fa-copy"></i> New Invoice (Copy of ${esc(id)})`;

  // fix: use 'success' instead of 'info' — toast type 'info' has no CSS rule
  toast(`Loaded ${id} as a copy. Edit and save as a new invoice.`, 'success');
}

function deleteInvoice(id) {
  if (!confirm(`Permanently delete ${id}?`)) return;
  const invToDelete = invoicesArray.find(i => i.invoiceId === id);
  if (!invToDelete) return;

  (invToDelete.items || []).forEach(oldIt => {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === oldIt.description.toLowerCase());
    if (existing) existing.stock = (existing.stock || 0) + parseFloat(oldIt.quantity); // fix: parseFloat
  });

  invoicesArray = invoicesArray.filter(i => i.invoiceId !== id);
  localStorage.setItem("bs_invoices", JSON.stringify(invoicesArray));
  closeModal(); renderInvoiceLists(); updateDashboard();
  if (typeof renderInventoryTable === 'function') renderInventoryTable();

  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "deleteInvoice", invoiceId: id }) })
    .then(() => toast('Invoice deleted', 'warn'));
}

// ─── LOAD EDIT INVOICE ────────────────────────
function loadEditInvoice(id) {
  const inv = invoicesArray.find(i => i.invoiceId === id);
  if (!inv) return;
  
  App.editingInvoiceId = id;
  App.editingInvoiceStatus = inv.status || 'unpaid';
  
  document.getElementById('invNumber').value = inv.invoiceId;
  document.getElementById('invNumber').readOnly = true;
  document.getElementById('invNumber').style.backgroundColor = 'var(--surface2)';
  
  // ─── DATE STRIPPING FIX ───
  let dStr = "";
  try {
    if (inv.date) {
      const d = new Date(inv.date);
      if (!isNaN(d)) dStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
    }
  } catch(e) {}
  document.getElementById('invDate').value = dStr || today();

  document.getElementById('customerName').value = inv.customerName;
  document.getElementById('customerEmail').value = inv.customerEmail || '';
  document.getElementById('billingAddr').value = inv.billingAddress || '';
  document.getElementById('invDiscountVal').value = inv.discount || 0;
  setGstType(inv.gstType || 'Exclusive');

  // 👇 ADD THESE 3 LINES 👇
  const statusSelect = document.getElementById('invStatusSelect');
  if (statusSelect) {
    statusSelect.value = inv.status || 'unpaid';
  }

  invLineItems.length = 0;
  (inv.items || []).forEach(it => {
    invLineItems.push({ desc: it.description, qty: it.quantity, price: it.unitPrice, gstRate: it.gstRate });
  });

  renderInvoiceEditor();
  closeModal();
  switchTab('invoice'); 
  
  const tabNew = document.getElementById('tabNewInvoice');
  const tabEdit = document.getElementById('tabEditInvoice');
  if (tabNew && tabEdit) {
    tabNew.style.display = 'none';
    tabEdit.style.display = 'inline-block';
    tabEdit.textContent = `Editing: ${id}`;
    tabEdit.click();
  }
  
  const formTitle = document.getElementById('invoiceFormTitle');
  if (formTitle) formTitle.innerHTML = `<i class="fas fa-edit" style="color:var(--gold)"></i> Editing Invoice ${id}`;

  toast(`Editing ${id}. Stock will recalculate when saved.`, 'info');
}

// ─── EXPORT CSV ───────────────────────────────
function exportInvoiceCSV() {
  const header = 'Invoice ID,Date,Customer,Subtotal,GST,Discount,Grand Total,Status\n';
  const rows = invoicesArray.map(i =>
    `${i.invoiceId},${i.date},"${i.customerName}",${(i.subtotal||0).toFixed(2)},${(i.gstAmount||0).toFixed(2)},${(i.discount||0).toFixed(2)},${(i.grandTotal||0).toFixed(2)},${i.status||'unpaid'}`
  ).join('\n');
  downloadCSV(header + rows, 'invoices_' + today() + '.csv');
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  toast('CSV exported!', 'success');
}

// ─── PRINT ────────────────────────────────────
function printCurrentInvoice() {
  const data = {
    bizName:    bizProfile.name    || '',
    bizAddr:    bizProfile.address || '',
    bizGst:     bizProfile.gstin   || '',
    bizPan:     bizProfile.pan     || '',
    bizContact: bizProfile.phone   || bizProfile.email || '',
    bankName:   bizProfile.bankName  || '',
    bankAcc:    bizProfile.bankAcc   || '',
    bankIFSC:   bizProfile.bankIFSC  || '',
    terms:      bizProfile.terms     || '',
    invNo:      document.getElementById('invNumber').value,
    invDate:    document.getElementById('invDate').value,
    clientName: document.getElementById('customerName').value,
    clientEmail:document.getElementById('customerEmail').value,
    clientAddr: document.getElementById('billingAddr').value,
    gstType:    invGstType,
    supplyType: bizProfile.supplyType || 'intra',
    items:      invLineItems.map(i => ({ description: i.desc, quantity: parseFloat(i.qty), unitPrice: parseFloat(i.price), gstRate: i.gstRate })),
    discount:   parseFloat(document.getElementById('invDiscountVal').value) || 0,
  };
  const html = buildInvoiceHTML(data, bizProfile.printTemplate || 'tpl-standard', false);
  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
}

function printSavedInvoiceById(id) {
  const inv = invoicesArray.find(i => i.invoiceId === id);
  if (!inv) return;
  const data = {
    bizName:    bizProfile.name    || '',
    bizAddr:    bizProfile.address || '',
    bizGst:     bizProfile.gstin   || '',
    bizPan:     bizProfile.pan     || '',
    bizContact: bizProfile.phone   || bizProfile.email || '',
    bankName:   bizProfile.bankName  || '',
    bankAcc:    bizProfile.bankAcc   || '',
    bankIFSC:   bizProfile.bankIFSC  || '',
    terms:      bizProfile.terms     || '',
    invNo:      inv.invoiceId,
    invDate:    inv.date,
    clientName: inv.customerName,
    clientEmail:inv.customerEmail || '',
    clientAddr: inv.billingAddress || '',
    gstType:    inv.gstType || 'Exclusive',
    supplyType: inv.supplyType || 'intra',
    items:      inv.items || [],
    discount:   inv.discount || 0,
  };
  const html = buildInvoiceHTML(data, bizProfile.printTemplate || 'tpl-standard', false);
  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
}

function showSamplePreview(templateName) {
  const sampleData = {
    bizName: bizProfile.name || 'BillingSuite Pro',
    bizAddr: bizProfile.address || '123 Business Street, Mumbai, MH 400001',
    bizGst:  bizProfile.gstin || '22AAAAA0000A1Z5',
    bizPan:  bizProfile.pan || 'ABCDE1234F',
    bizContact: bizProfile.phone || '+91 98765 43210',
    bankName: bizProfile.bankName || 'HDFC Bank',
    bankAcc:  bizProfile.bankAcc  || '50100123456789',
    bankIFSC: bizProfile.bankIFSC || 'HDFC0001234',
    terms:    bizProfile.terms || '1. Goods once sold will not be taken back.\n2. Payment due within 30 days.',
    invNo: 'INV-2026-001',
    invDate: today(),
    clientName: 'Sample Customer Pvt. Ltd.',
    clientEmail: 'buyer@example.com',
    clientAddr: '456 Client Avenue, Delhi 110001',
    gstType: 'Exclusive',
    supplyType: 'intra',
    items: [
      { description: 'Product A — Premium Widget', quantity: 2, unitPrice: 5000, gstRate: 0.18 },
      { description: 'Service B — Installation', quantity: 1, unitPrice: 2500, gstRate: 0.18 },
      { description: 'Product C — Spare Parts',  quantity: 5, unitPrice: 800,  gstRate: 0.12 },
    ],
    discount: 500,
  };
  const html = buildInvoiceHTML(sampleData, templateName, true);
  const modal = document.getElementById('sampleModal');
  const content = document.getElementById('sampleContent');
  if (!modal || !content) return;
  content.innerHTML = `<iframe srcdoc="${html.replace(/"/g, '&quot;')}" style="width:100%;height:100%;border:none;flex:1"></iframe>`;
  modal.classList.add('open');
}

function closeSampleModal() {
  const modal = document.getElementById('sampleModal');
  if (modal) modal.classList.remove('open');
  const content = document.getElementById('sampleContent');
  if (content) content.innerHTML = '';
}

// ─── BUILD INVOICE HTML (shared for print + preview) ──
function buildInvoiceHTML(data, templateName, isSample) {
  let sub = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
  const itemsRows = (data.items || []).map(it => {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(it.unitPrice) || 0;
    const rate = it.gstRate || 0;
    const base = qty * price;
    const { gst, subtotalPart, total } = calcGST(base, rate, data.gstType);
    sub += subtotalPart;
    if (data.supplyType === 'intra') { cgstTotal += gst / 2; sgstTotal += gst / 2; }
    else { igstTotal += gst; }
    const half = gst / 2;
    return `<tr>
      <td>${esc(it.description)}</td>
      <td style="text-align:center">${qty}</td>
      <td style="text-align:right">₹${price.toFixed(2)}</td>
      <td style="text-align:right">₹${subtotalPart.toFixed(2)}</td>
      <td style="text-align:right">${data.supplyType==='intra' ? '₹'+half.toFixed(2) : '₹'+gst.toFixed(2)}</td>
      <td style="text-align:right">${data.supplyType==='intra' ? '₹'+half.toFixed(2) : '—'}</td>
      <td style="text-align:right;font-weight:600">₹${total.toFixed(2)}</td>
    </tr>`;
  }).join('');

  const totalGST   = data.supplyType === 'intra' ? cgstTotal + sgstTotal : igstTotal;
  const discountVal = data.discount || 0;
  const grand = sub + totalGST - discountVal;

  const taxBreakdownText = data.supplyType === 'intra'
    ? `<div style="margin-bottom:6px;"><strong>CGST:</strong> ₹${cgstTotal.toFixed(2)} &nbsp;|&nbsp; <strong>SGST:</strong> ₹${sgstTotal.toFixed(2)}</div>`
    : `<div style="margin-bottom:6px;"><strong>IGST:</strong> ₹${igstTotal.toFixed(2)}</div>`;

  const paperSize = bizProfile.printSize || 'auto';
  const isA5 = paperSize === 'A5';
  const pWidth = isA5 ? '550px' : '800px';
  const lWidth = isA5 ? '750px' : '1050px';
  const pad   = isA5 ? '20px' : '40px';
  const pageRule = paperSize === 'auto'
    ? '@page { margin: 0.5cm; }'
    : `@page { size: ${paperSize}; margin: 0.5cm; }`;
  const landscapeRule = paperSize === 'auto'
    ? '@page { size: landscape; margin: 0.5cm; }'
    : `@page { size: ${paperSize} landscape; margin: 0.5cm; }`;

  let tplCSS = '';
  if (templateName === 'tpl-minimal') {
    tplCSS = `${pageRule} .invoice-paper{max-width:${pWidth};margin:0 auto;background:white;padding:${pad};border:1px solid #eee;} .inv-header{border-bottom:1px solid #ddd!important;padding-bottom:20px;} th{background:transparent!important;border-bottom:2px solid #333!important;color:#333!important;} .totals{border-top:2px solid #333!important;}`;
  } else if (templateName === 'tpl-bold') {
    tplCSS = `${pageRule} .invoice-paper{max-width:${pWidth};margin:0 auto;background:linear-gradient(to bottom,#ffffff,#fdf8f6);padding:${pad};border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.1);border-top:8px solid #c2410c;} h1{color:#c2410c!important;} th{background:#c2410c!important;color:white!important;border:none!important;} .totals{background:#fff7ed;padding:20px;border-radius:12px;border:none!important;}`;
  } else if (templateName === 'tpl-landscape') {
    tplCSS = `${landscapeRule} .invoice-paper{max-width:${lWidth};margin:0 auto;background:white;padding:${pad};border:1px solid #ddd;border-top:6px solid #1a4a3a;} th{background:#1a4a3a!important;color:white!important;} h1{color:#1a4a3a!important;}`;
  } else {
    tplCSS = `${pageRule} .invoice-paper{max-width:${pWidth};margin:0 auto;background:white;padding:${pad};border:1px solid #eee;border-top:6px solid #1e4a6e;} .inv-header{border-bottom:3px solid #1e4a6e!important;} h1{color:#1e4a6e!important;} th{background:#f1f5f9!important;color:#1e4a6e!important;}`;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice - ${esc(data.invNo)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:#f0f2f5;font-family:'Inter',sans-serif;padding:20px;color:#1a2c3e;font-size:${isA5?'0.85rem':'1rem'};}
    table{width:100%;border-collapse:collapse;margin:18px 0;}
    th,td{padding:${isA5?'8px 4px':'12px 8px'};text-align:left;border-bottom:1px solid #e2e8f0;font-size:${isA5?'0.75rem':'0.85rem'};}
    th{background:#f1f5f9;color:#475569;text-transform:uppercase;font-size:${isA5?'0.65rem':'0.75rem'};letter-spacing:0.05em;}
    .totals{text-align:right;margin-top:20px;border-top:1px dashed #cbd5e1;padding-top:16px;}
    .footer{margin-top:25px;font-size:0.75rem;text-align:center;color:#64748b;}
    @media print{body{background:white;padding:0;font-size:${isA5?'0.85rem':'12pt'};} .invoice-paper{width:100%!important;max-width:100%!important;box-shadow:none!important;border:none!important;padding:0!important;margin:0!important;}}
    ${tplCSS}
  </style></head><body>
  <div class="invoice-paper">
    <div class="inv-header" style="display:flex;justify-content:space-between;flex-wrap:wrap;padding-bottom:20px;margin-bottom:20px;">
      <div>
        <h2 style="font-size:${isA5?'1.3rem':'1.6rem'};color:#0f172a;margin-bottom:4px;font-weight:800;">${esc(data.bizName)}</h2>
        <div style="font-size:0.8rem;color:#475569;line-height:1.5;">${esc(data.bizAddr).replace(/\n/g,'<br>')}</div>
        <div style="font-size:0.8rem;color:#475569;margin-top:4px;">GSTIN: ${esc(data.bizGst)}${data.bizPan?' | PAN: '+esc(data.bizPan):''} | ${esc(data.bizContact)}</div>
      </div>
      <div style="text-align:right;">
        <h1 style="color:#0f172a;letter-spacing:0.05em;font-size:${isA5?'1.5rem':'2rem'}">TAX INVOICE</h1>
        <div style="font-size:0.85rem;color:#64748b;margin-top:4px;">${data.gstType === 'Inclusive' ? 'GST Inclusive' : 'GST Exclusive'}</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;margin:12px 0;flex-wrap:wrap;background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0;">
      <span><strong>Invoice No:</strong> ${esc(data.invNo)}</span>
      <span><strong>Date:</strong> ${data.invDate}</span>
      <span><strong>Supply:</strong> ${data.supplyType==='intra'?'Intra-state':'Inter-state'}</span>
    </div>
    <div style="margin:20px 0;">
      <h4 style="font-size:0.85rem;color:#64748b;text-transform:uppercase;margin-bottom:8px;letter-spacing:0.05em;">Billed To</h4>
      <div style="font-weight:700;font-size:1.1rem;color:#0f172a;">${esc(data.clientName)}</div>
      ${data.clientEmail?`<div style="font-size:0.85rem;color:#475569;margin-top:2px;">${esc(data.clientEmail)}</div>`:''}
      <div style="font-size:0.85rem;color:#475569;margin-top:2px;line-height:1.5;">${esc(data.clientAddr).replace(/\n/g,'<br>')}</div>
    </div>
    <table>
      <thead><tr>
        <th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th>
        <th style="text-align:right">Taxable</th>
        <th style="text-align:right">${data.supplyType==='intra'?'CGST':'IGST'}</th>
        <th style="text-align:right">${data.supplyType==='intra'?'SGST':'—'}</th>
        <th style="text-align:right">Total</th>
      </tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <div class="totals">
      <div style="color:#475569;margin-bottom:6px;">Total Taxable: ₹${sub.toFixed(2)}</div>
      ${discountVal>0?`<div style="color:#c2410c;margin-bottom:6px;">Discount: – ₹${discountVal.toFixed(2)}</div>`:''}
      ${taxBreakdownText}
      <div style="font-size:${isA5?'1.2rem':'1.5rem'};font-weight:800;color:#0f172a;margin-top:12px;">Grand Total: ₹${grand.toFixed(2)}</div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:30px;font-size:0.8rem;border-top:1px solid #e2e8f0;padding-top:16px;">
      <div style="width:60%">
        ${data.bankName?`<strong style="color:#0f172a;display:block;margin-bottom:4px;">Bank Details:</strong>Bank: ${esc(data.bankName)}<br>A/C No: ${esc(data.bankAcc)}<br>IFSC: ${esc(data.bankIFSC)}`:''}
        ${data.terms?`<strong style="color:#0f172a;display:block;margin-top:12px;margin-bottom:4px;">Terms & Conditions:</strong><div style="color:#475569;white-space:pre-wrap;">${esc(data.terms)}</div>`:''}
      </div>
      <div style="width:35%;text-align:right;display:flex;flex-direction:column;justify-content:flex-end;">
        <div style="border-bottom:1px solid #0f172a;margin-bottom:4px;height:40px;"></div>
        <strong style="color:#0f172a;">Authorised Signatory</strong>
        <div style="color:#475569;margin-top:2px;">For ${esc(data.bizName)}</div>
      </div>
    </div>
    <div class="footer">GST compliant invoice • Generated by BillingSuite Pro</div>
  </div>
  <script>window.onload=function(){if(${!isSample}){setTimeout(()=>{window.print();window.close();},500);}}<\/script>
  </body></html>`;
}
