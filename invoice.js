// ─── INVOICE EDITOR (Upgraded with HSN/SAC) ──────────
function renderInvoiceEditor() {
  const body = document.getElementById('invoiceItemsBody');
  
  // Make sure default item has HSN property
  if (invLineItems.length > 0 && invLineItems[0].hsn === undefined) {
    invLineItems.forEach(i => i.hsn = '');
  }

  body.innerHTML = invLineItems.map((it, i) => {
    const { gst: gstAmt, total } = calcGST(it.qty * it.price, it.gstRate, invGstType);
    return `<tr>
      <td><input class="item-input inv-field" data-i="${i}" data-f="desc" value="${esc(it.desc)}" placeholder="Add item…" list="productList"></td>
      <td><input class="item-input inv-field" data-i="${i}" data-f="hsn" value="${esc(it.hsn || '')}" placeholder="HSN" style="width:80px; font-size:0.8rem"></td>
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
        if (match && f === 'desc') {
          invLineItems[i].price   = match.sellPrice || match.price || 0;
          invLineItems[i].gstRate = match.gstRate   || 0;
          invLineItems[i].hsn     = match.hsn       || '';
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
  document.getElementById('subtotalVal').textContent = fmt(sub);
  document.getElementById('taxVal').textContent = fmt(gstTotal);
  const supply = App.currentInvoiceSupplyType || 'intra';
  const taxTypeStr = supply === 'inter' ? 'IGST' : 'CGST/SGST';
  document.getElementById('taxLabel').textContent = `${taxTypeStr} (${invGstType})`;
  document.getElementById('discountDisplay').textContent = `– ${fmt(discount)}`;
  document.getElementById('grandTotalVal').textContent = fmt(grand);
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

function saveInvoice() {
  if (App.isSaving) return;
 
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
  if (isInvoiceIdDuplicate(invId) && !isEditing) { toast(`Invoice ${invId} already exists`, 'error'); return; }
  if (!document.getElementById('customerName').value.trim()) { toast('Enter a customer name', 'error'); return; }
  if (!invLineItems.length) { toast('Add at least one line item', 'error'); return; }
  if (invLineItems.some(i => !i.desc.trim())) { toast('Enter a product name for all items', 'error'); return; }
 
  const { sub, gstTotal, grand, discount } = _computeInvoiceTotals();
  const statusSelect = document.getElementById('invStatusSelect');
  const status = statusSelect ? statusSelect.value : 'unpaid';
 
  const payload = {
    action: isEditing ? "editInvoice" : "saveInvoice",
    invoiceId: invId,
    date: document.getElementById('invDate').value,
    customerName: document.getElementById('customerName').value,
    customerEmail: document.getElementById('customerEmail').value,
    billingAddress: document.getElementById('billingAddr').value,
    gstType: invGstType,
    supplyType: App.currentInvoiceSupplyType || 'intra',
    items: invLineItems.map(i => ({ description: i.desc, hsn: i.hsn, quantity: parseFloat(i.qty), unitPrice: parseFloat(i.price), gstRate: i.gstRate })),
    subtotal: sub, gstAmount: gstTotal, discount, grandTotal: grand, status
  };
 
  App.isSaving = true;
  const saveBtn = document.getElementById('saveInvoiceBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }
 
  const customerName = document.getElementById('customerName').value.trim();
  const customerGstin = document.getElementById('customerGstin') ? document.getElementById('customerGstin').value.trim().toUpperCase() : '';
  
  if (customerName && !customersArray.find(c => c.name.toLowerCase() === customerName.toLowerCase())) {
    const newCust = { id: 'CUST-' + Date.now().toString().slice(-5), name: customerName, email: payload.customerEmail || '', phone: '', gstin: customerGstin, address: payload.billingAddress || '' };
    customersArray.push(newCust);
    fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "saveCustomer", ...newCust }) });
  }
 
  if (isEditing) {
    const oldInv = invoicesArray.find(i => i.invoiceId === invId);
    if (oldInv) {
      (oldInv.items || []).forEach(oldIt => {
        const existing = inventoryStock.find(p => p.name.toLowerCase() === oldIt.description.toLowerCase());
        if (existing) existing.stock = (existing.stock || 0) + parseFloat(oldIt.quantity);
      });
    }
    invoicesArray = invoicesArray.filter(i => i.invoiceId !== invId);
    App.editingInvoiceId = null;
  }
 
  invLineItems.forEach(it => {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === it.desc.toLowerCase());
    if (existing) { existing.stock = (existing.stock || 0) - it.qty; } 
    else {
      inventoryStock.push({ id: 'P-' + Date.now().toString().slice(-5), name: it.desc, hsn: it.hsn, sellPrice: it.price, costPrice: it.price * 0.7, gstRate: it.gstRate, stock: 0 });
    }
  });
 
  if (typeof updateDatalists === 'function') updateDatalists();
  if (typeof renderInventoryTable === 'function') renderInventoryTable();
 
  invoicesArray.unshift({ ...payload, timestamp: new Date().toISOString() });
  localStorage.setItem("bs_invoices", JSON.stringify(invoicesArray));
  renderInvoiceLists(); 
  if (typeof updateDashboard === 'function') updateDashboard();
  
  App.isSaving = false;
  if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Invoice'; }

  if (App.postSaveAction === 'close') {
    clearInvoiceForm(true);
    if (typeof closeInvoiceEditor === 'function') closeInvoiceEditor();
    toast(`Invoice ${invId} saved successfully!`, 'success');
  } 
  else if (App.postSaveAction === 'print') {
    const printHtml = buildInvoiceHTML(payload, bizProfile.printTemplate || 'tpl-standard', false);
    const printWin = window.open('', '_blank');
    if (printWin) { printWin.document.write(printHtml); printWin.document.close(); }
    App.editingInvoiceId = payload.invoiceId; 
    const tEdit = document.getElementById('tabEditInvoice');
    if (tEdit) tEdit.style.display = 'inline-flex';
    toast(`Invoice ${invId} saved & printing...`, 'success');
    App.isDirty = false;
  }
  else if (App.postSaveAction === 'save') {
    App.editingInvoiceId = payload.invoiceId; 
    const tEdit = document.getElementById('tabEditInvoice');
    if (tEdit) tEdit.style.display = 'inline-flex';
    toast(`Invoice ${invId} saved! You can continue editing.`, 'success');
  }

  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
    .catch(err => console.error("Background sync failed", err));
}

function clearInvoiceForm(force = false) {
  if (!force && invLineItems.some(i => i.desc.trim())) {
    if (!confirm('Clear all line items and customer details?')) return;
  }
  invLineItems.length = 0;
  invLineItems.push({ desc: '', hsn: '', qty: 1, price: 0, gstRate: 0.18 });
  ['customerName','customerEmail','customerGstin','billingAddr','invDiscountVal'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });

  const statusSelect = document.getElementById('invStatusSelect');
  if (statusSelect) statusSelect.value = 'unpaid';

  App.editingInvoiceId = null;
  App.editingInvoiceStatus = 'unpaid';
  App.currentInvoiceSupplyType = 'intra';

  const invNum = document.getElementById('invNumber');
  if (invNum) { invNum.value = getNextId(invoicesArray, 'INV'); invNum.readOnly = false; invNum.style.backgroundColor = ''; }
  const invDate = document.getElementById('invDate');
  if (invDate) invDate.value = today();

  renderInvoiceEditor();

  const formTitle = document.getElementById('invoiceFormTitle');
  if (formTitle) formTitle.innerHTML = `<i class="fas fa-plus-circle"></i> Create New Invoice`;

  if (!force) toast('Form cleared', 'warn');
}

function setInvFilter(status, btn) {
  document.querySelectorAll('#invoiceHistory .filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('invActiveFilter').value = status;
  filterInvoices();
}

function filterInvoices() {
  const q = (document.getElementById('invoiceSearch')?.value || '').toLowerCase();
  const status = document.getElementById('invActiveFilter')?.value || 'all';
  const sort = document.getElementById('invoiceSortSelect')?.value || 'date-desc';

  let filtered = invoicesArray.filter(i => {
    const matchesSearch = i.invoiceId.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q) || (i.customerEmail || '').toLowerCase().includes(q) || String(i.grandTotal || '').includes(q) || (i.date || '').includes(q);
    const matchesStatus = (status === 'all') || (i.status === status);
    return matchesSearch && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sort === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (sort === 'date-asc')  return new Date(a.date) - new Date(b.date);
    if (sort === 'amt-desc')  return b.grandTotal - a.grandTotal;
    if (sort === 'amt-asc')   return a.grandTotal - b.grandTotal;
    return 0;
  });

  const hist = document.getElementById('invoiceHistoryList');
  if (hist) hist.innerHTML = filtered.length ? filtered.map(inv => `<div class="list-item" onclick="showInvoiceDetail('${esc(inv.invoiceId)}')"><div><div class="list-item-title">${esc(inv.invoiceId)}</div><div class="list-item-sub">${esc(inv.customerName)} · ${dateLabel(inv.date)}</div></div><div style="text-align:right"><div class="list-item-amount">${fmt(inv.grandTotal)}</div>${getStatusBadge(inv)}</div></div>`).join('') : '<div class="empty-state"><i class="fas fa-search"></i><p>No results found</p></div>';
}

function renderInvoiceLists() {
  const makeItem = inv => `<div class="list-item" onclick="showInvoiceDetail('${esc(inv.invoiceId)}')"><div><div class="list-item-title">${esc(inv.invoiceId)}</div><div class="list-item-sub">${esc(inv.customerName)} · ${dateLabel(inv.date)}</div></div><div style="text-align:right"><div class="list-item-amount">${fmt(inv.grandTotal)}</div>${getStatusBadge(inv)}</div></div>`;
  const recent = invoicesArray.slice(0, 4);
  const emptyHTML = () => `<div class="empty-state"><i class="fas fa-file-invoice-dollar"></i><p>No invoices yet</p></div>`;
  ['recentInvoiceList','dashRecentInvoices'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = recent.length ? recent.map(makeItem).join('') : emptyHTML();
  });
  filterInvoices();
  _updateInvoiceQuickStats();
}

function _updateInvoiceQuickStats() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const thisMonth = invoicesArray.filter(i => { if (!i.date) return false; const d = new Date(i.date); return d.getFullYear() === y && d.getMonth() === m; });
  const unpaid = invoicesArray.filter(i => i.status === 'unpaid' || i.status === 'overdue');
  const mc = document.getElementById('invMonthCount');  if (mc) mc.textContent = thisMonth.length;
  const uc = document.getElementById('invUnpaidCount'); if (uc) uc.textContent = unpaid.length;
  const rl = document.getElementById('invoiceRecentList');
  if (rl) rl.innerHTML = invoicesArray.length ? invoicesArray.slice(0, 8).map(inv => `<div class="list-item" onclick="showInvoiceDetail('${esc(inv.invoiceId)}')"><div><div class="list-item-title">${esc(inv.invoiceId)}</div><div class="list-item-sub">${esc(inv.customerName)} · ${dateLabel(inv.date)}</div></div><div style="text-align:right"><div class="list-item-amount">${fmt(inv.grandTotal)}</div>${getStatusBadge(inv)}</div></div>`).join('') : '<div class="empty-state"><i class="fas fa-file-invoice"></i><p>No invoices yet</p></div>';
}

function showInvoiceDetail(id) {
  const inv = invoicesArray.find(i => i.invoiceId === id);
  if (!inv) return;
  document.getElementById('modalTitle').textContent = `${inv.invoiceId} — ${inv.customerName}`;
  document.getElementById('modalBody').innerHTML = `
    <div style="font-size:0.85rem;margin-bottom:12px;color:var(--ink2)">
      <strong>Date:</strong> ${dateLabel(inv.date)} &nbsp;|&nbsp; <strong>Customer:</strong> ${esc(inv.customerName)} &nbsp;|&nbsp; <strong>GST:</strong> ${esc(inv.gstType || '')} &nbsp;|&nbsp; <strong>Supply:</strong> ${inv.supplyType === 'inter' ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'}
    </div>
    <div class="items-table-wrap">
      <table class="items-table">
        <thead><tr><th>Description</th><th>HSN</th><th>Qty</th><th>Price</th><th>GST%</th><th>Total</th></tr></thead>
        <tbody>
          ${(inv.items || []).map(it => {
            const { total } = calcGST(parseFloat(it.quantity) * parseFloat(it.unitPrice), it.gstRate || 0, inv.gstType || 'Exclusive');
            return `<tr><td>${esc(it.description)}</td><td>${esc(it.hsn || '')}</td><td>${parseFloat(it.quantity)}</td><td>${fmt(it.unitPrice)}</td><td>${((it.gstRate || 0) * 100).toFixed(0)}%</td><td>${fmt(total)}</td></tr>`;
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
  const inv = invoicesArray.find(i => String(i.invoiceId) === String(id));
  if (!inv) return;
  const printHtml = buildInvoiceHTML(inv, bizProfile.printTemplate || 'tpl-standard', false);
  const printWin = window.open('', '_blank');
  if (printWin) { printWin.document.write(printHtml); printWin.document.close(); }
  if (typeof closeModal === 'function') closeModal(); 
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
  App.editingInvoiceId = null; App.editingInvoiceStatus = 'unpaid';
  document.getElementById('invNumber').value = getNextId(invoicesArray, 'INV');
  document.getElementById('invNumber').readOnly = false;
  document.getElementById('invNumber').style.backgroundColor = '';
  document.getElementById('invDate').value = today();
  document.getElementById('customerName').value = inv.customerName;
  document.getElementById('customerEmail').value = inv.customerEmail || '';
  document.getElementById('billingAddr').value = inv.billingAddress || '';
  document.getElementById('invDiscountVal').value = inv.discount || 0;
  setGstType(inv.gstType || 'Exclusive');

  invLineItems.length = 0;
  (inv.items || []).forEach(it => {
    invLineItems.push({ desc: it.description, hsn: it.hsn || '', qty: parseFloat(it.quantity), price: parseFloat(it.unitPrice), gstRate: it.gstRate });
  });

  renderInvoiceEditor(); closeModal(); switchTab('invoice');
  const formTitle = document.getElementById('invoiceFormTitle');
  if (formTitle) formTitle.innerHTML = `<i class="fas fa-copy"></i> New Invoice (Copy of ${esc(id)})`;
  toast(`Loaded ${id} as a copy.`, 'success');
}

function deleteInvoice(id) {
  if (!confirm(`Permanently delete ${id}?`)) return;
  const invToDelete = invoicesArray.find(i => i.invoiceId === id);
  if (!invToDelete) return;
  (invToDelete.items || []).forEach(oldIt => {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === oldIt.description.toLowerCase());
    if (existing) existing.stock = (existing.stock || 0) + parseFloat(oldIt.quantity);
  });
  const idx = invoicesArray.findIndex(i => i.invoiceId === id);
  if (idx > -1) invoicesArray.splice(idx, 1);
  localStorage.setItem("bs_invoices", JSON.stringify(invoicesArray));
  closeModal(); renderInvoiceLists(); updateDashboard();
  if (typeof renderInventoryTable === 'function') renderInventoryTable();
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "deleteInvoice", invoiceId: id }) }).then(() => toast('Invoice deleted', 'warn'));
}

function loadEditInvoice(id) {
  const inv = invoicesArray.find(i => i.invoiceId === id);
  if (!inv) return;
  App.editingInvoiceId = id; App.editingInvoiceStatus = inv.status || 'unpaid';
  document.getElementById('invNumber').value = inv.invoiceId;
  document.getElementById('invNumber').readOnly = true;
  document.getElementById('invNumber').style.backgroundColor = 'var(--surface2)';
  
  let dStr = "";
  try { if (inv.date) { const d = new Date(inv.date); if (!isNaN(d)) dStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 10); } } catch(e) {}
  document.getElementById('invDate').value = dStr || today();
  document.getElementById('customerName').value = inv.customerName;
  document.getElementById('customerEmail').value = inv.customerEmail || '';
  document.getElementById('billingAddr').value = inv.billingAddress || '';
  document.getElementById('invDiscountVal').value = inv.discount || 0;
  setGstType(inv.gstType || 'Exclusive');

  const statusSelect = document.getElementById('invStatusSelect');
  if (statusSelect) { statusSelect.value = inv.status || 'unpaid'; }

  invLineItems.length = 0;
  (inv.items || []).forEach(it => {
    invLineItems.push({ desc: it.description, hsn: it.hsn || '', qty: it.quantity, price: it.unitPrice, gstRate: it.gstRate });
  });

  renderInvoiceEditor(); closeModal(); switchTab('invoice'); 
  const tabNew = document.getElementById('tabNewInvoice');
  const tabEdit = document.getElementById('tabEditInvoice');
  if (tabNew && tabEdit) { tabNew.style.display = 'none'; tabEdit.style.display = 'inline-block'; tabEdit.textContent = `Editing: ${id}`; tabEdit.click(); }
  const formTitle = document.getElementById('invoiceFormTitle');
  if (formTitle) formTitle.innerHTML = `<i class="fas fa-edit" style="color:var(--gold)"></i> Editing Invoice ${id}`;
  toast(`Editing ${id}.`, 'info');
}

function openNewInvoiceForm() {
  clearInvoiceForm(true);
  document.querySelector('.sec-tab[data-stab="invoiceHistory"]').classList.remove('active');
  const tabNew = document.getElementById('tabNewInvoice');
  if (tabNew) { tabNew.style.display = 'inline-block'; tabNew.click(); }
}

App.postSaveAction = 'close';
function processInvoice(action) { App.postSaveAction = action; saveInvoice(); }

function closeInvoiceEditor() {
  const tNew = document.getElementById('tabNewInvoice');
  const tEdit = document.getElementById('tabEditInvoice');
  if (tNew) tNew.style.display = 'none';
  if (tEdit) tEdit.style.display = 'none';
  const targetTab = document.querySelector('.sec-tab[data-stab="invoiceRecent"]') || document.querySelector('.sec-tab[data-stab="invoiceHistory"]');
  if (targetTab) targetTab.click();
}

function cancelInvoice() {
  const isCompletelyEmpty = document.getElementById('customerName')?.value.trim() === '' && !invLineItems.some(i => (i.desc || '').trim() !== '');
  if (!isCompletelyEmpty && App.isDirty) { if (!confirm("⚠️ WARNING: Any unsaved changes will be lost. Are you sure you want to close?")) { return; } }
  clearInvoiceForm(true);
  if (typeof closeInvoiceEditor === 'function') closeInvoiceEditor();
}

function exportInvoiceCSV() {
  const header = 'Invoice ID,Date,Customer,Subtotal,GST,Discount,Grand Total,Status\n';
  const rows = invoicesArray.map(i => `${i.invoiceId},${i.date},"${i.customerName}",${(i.subtotal||0).toFixed(2)},${(i.gstAmount||0).toFixed(2)},${(i.discount||0).toFixed(2)},${(i.grandTotal||0).toFixed(2)},${i.status||'unpaid'}`).join('\n');
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
      { description: 'Product A — Premium Widget', hsn: '8517', quantity: 2, unitPrice: 5000, gstRate: 0.18 },
      { description: 'Service B — Installation', hsn: '9987', quantity: 1, unitPrice: 2500, gstRate: 0.18 },
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

// ─── BUILD INVOICE HTML (Upgraded with HSN, POS, Bank Details) ──
function buildInvoiceHTML(invData, templateName, isSample) {
  const form = invData || {};
  const getLive = (id) => document.getElementById(id) ? document.getElementById(id).value : '';

  // Get dynamic state codes for POS printing
  const myStateCode = bizProfile.state || '';
  const custGSTIN = form.customerGstin || document.getElementById('customerGstin')?.value || '';
  const custStateCode = custGSTIN.substring(0, 2);

  // Safely define POS name based on state codes
  let placeOfSupplyStr = "";
  if (GST_STATE_CODES && custStateCode && GST_STATE_CODES[custStateCode]) {
    placeOfSupplyStr = `${GST_STATE_CODES[custStateCode]} (${custStateCode})`;
  } else if (GST_STATE_CODES && myStateCode && GST_STATE_CODES[myStateCode]) {
    placeOfSupplyStr = `${GST_STATE_CODES[myStateCode]} (${myStateCode})`; // Fallback to own state
  }

  const data = {
    bizName: bizProfile.name || '',
    bizAddr: bizProfile.address || '',
    bizContact: bizProfile.phone || '',
    bizGst: bizProfile.gstin || '',
    bankName: bizProfile.bankName || '',
    bankAcc: bizProfile.bankAcc || '',
    bankIFSC: bizProfile.bankIFSC || '',
    logo: bizProfile.logo || '',           
    signature: bizProfile.signature || '', 
    
    invNo: form.invoiceId || form.invNo || getLive('invNumber') || 'DRAFT',
    invDate: form.date || form.invDate || getLive('invDate') || today(),
    customerName: form.customerName || form.clientName || getLive('customerName') || 'Customer',
    customerEmail: form.customerEmail || form.clientEmail || getLive('customerEmail') || '',
    billingAddress: form.billingAddress || form.clientAddr || getLive('billingAddr') || '',
    placeOfSupply: placeOfSupplyStr,
    
    gstType: form.gstType || (typeof invGstType !== 'undefined' ? invGstType : 'Exclusive'),
    supplyType: form.supplyType || (typeof App !== 'undefined' ? App.currentInvoiceSupplyType : 'intra') || 'intra',
    
    savedDiscount: form.discount !== undefined ? parseFloat(form.discount) : undefined,
    liveDiscVal: parseFloat(getLive('invDiscountVal')) || 0,
    liveDiscType: typeof invDiscType !== 'undefined' ? invDiscType : 'flat'
  };

  let rawItems = (form.items && form.items.length > 0) ? form.items : (typeof invLineItems !== 'undefined' ? invLineItems : []);
  data.items = rawItems.map(i => ({
    desc: i.description || i.desc || '',
    hsn: i.hsn || '',
    qty: parseFloat(i.quantity || i.qty) || 0,
    price: parseFloat(i.unitPrice || i.price) || 0,
    gstRate: parseFloat(i.gstRate) || 0
  }));

  let sub = 0, gstTotal = 0, grand = 0;
  let itemsRows = "";

  data.items.forEach((it, index) => {
    if (!it.desc || it.desc.trim().toLowerCase() === 'add item') return; 
    const { gst, subtotalPart, total } = calcGST(it.qty * it.price, it.gstRate, data.gstType);
    sub += subtotalPart; gstTotal += gst; grand += total;

    itemsRows += `<tr>
      <td style="text-align:center">${index + 1}</td>
      <td>${esc(it.desc)}</td>
      <td>${esc(it.hsn)}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">${fmt(it.price)}</td>
      <td style="text-align:right">${fmt(subtotalPart)}</td>
      <td style="text-align:center">${(it.gstRate * 100).toFixed(0)}%</td>
      <td style="text-align:right">${fmt(gst)}</td>
      <td style="text-align:right">${fmt(total)}</td>
    </tr>`;
  });

  let finalDiscount = 0;
  if (data.savedDiscount !== undefined) finalDiscount = data.savedDiscount;
  else if (data.liveDiscVal > 0) finalDiscount = data.liveDiscType === 'pct' ? (grand * (data.liveDiscVal / 100)) : Math.min(data.liveDiscVal, grand);
  grand -= finalDiscount;

  let discountHTML = "";
  if (finalDiscount > 0) discountHTML = `<div style="color:#10b981; margin-bottom:6px; font-size:0.9em; font-weight:600;">Discount: – ${fmt(finalDiscount)}</div>`;

  let gstBreakdownHTML = "";
  if (data.supplyType === 'inter') {
    gstBreakdownHTML = `<div style="color:#475569; margin-bottom:6px; font-size:0.9em;">Total IGST: ${fmt(gstTotal)}</div>`;
  } else {
    gstBreakdownHTML = `<div style="color:#475569; margin-bottom:6px; font-size:0.9em;">Total CGST: ${fmt(gstTotal / 2)}</div>
                        <div style="color:#475569; margin-bottom:6px; font-size:0.9em;">Total SGST: ${fmt(gstTotal / 2)}</div>`;
  }

  const logoHTML = data.logo ? `<img src="${data.logo}" style="max-height:80px; margin-bottom:10px; display:block;">` : '';
  const sigHTML = data.signature ? `<img src="${data.signature}" style="max-height:60px; margin-bottom:4px; display:block; margin-left:auto;">` : `<div style="border-bottom:1px solid #0f172a; margin-bottom:4px; height:40px;"></div>`;
  
  let bankHTML = "";
  if (data.bankName || data.bankAcc) {
    bankHTML = `
      <div style="margin-top:18px; font-size:0.85em; color:#475569;">
        <strong style="color:#0f172a">Bank Details:</strong><br>
        Bank: ${esc(data.bankName)}<br>
        A/c No: ${esc(data.bankAcc)}<br>
        IFSC: ${esc(data.bankIFSC)}
      </div>`;
  }

  const paperSize = bizProfile.printSize || 'auto';
  const isA5 = paperSize === 'A5'; 
  const pWidth = isA5 ? '148mm' : '800px';
  const pad = isA5 ? '20px' : '40px';
  const pageRule = paperSize === 'auto' ? '@page { margin: 0.5cm; }' : `@page { size: ${paperSize}; margin: 0.5cm; }`;

  let tplCSS = `${pageRule} .invoice-paper { max-width:${pWidth}; margin:0 auto; background:white; padding:${pad}; border:1px solid #eee; border-top: 6px solid #1e4a6e; } .inv-header { border-bottom: 3px solid #1e4a6e !important; } h1 { color: #1e4a6e !important; } th { background: #f1f5f9 !important; color: #1e4a6e !important; }`;
  if (templateName === "tpl-minimal") tplCSS = `${pageRule} .invoice-paper { max-width:${pWidth}; margin:0 auto; background:white; padding:${pad}; border: 1px solid #eee; } .inv-header { border-bottom: 1px solid #ddd !important; padding-bottom: 20px; } th { background: transparent !important; border-bottom: 2px solid #333 !important; color: #333 !important; } .totals { border-top: 2px solid #333 !important; } h1 { color: #555 !important; }`;
  else if (templateName === "tpl-bold") tplCSS = `${pageRule} .invoice-paper { max-width:${pWidth}; margin:0 auto; background:linear-gradient(to bottom, #ffffff, #fdf8f6); padding:${pad}; border-radius:16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border-top: 8px solid #c2410c; } .inv-header { border-bottom: none !important; } h1 { color: #c2410c !important; } th { background: #c2410c !important; color: white !important; border: none !important; } .totals { background: #fff7ed; padding: 20px; border-radius: 12px; border: none !important; }`;

  const autoPrintScript = isSample ? '' : `<script>window.onload=function(){setTimeout(()=>{window.print();window.close();},500);};</script>`;

  return `<!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"><title>Invoice - ${esc(data.invNo)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:#f0f2f5; font-family:'Inter',sans-serif; padding:20px; color:#1a2c3e; font-size: ${isA5 ? '10pt' : '14pt'};}
    table{width:100%; border-collapse:collapse; margin:18px 0;}
    th,td{padding:${isA5 ? '8px 4px' : '12px 8px'}; text-align:left; border-bottom:1px solid #e2e8f0; font-size:0.85em;}
    th{background:#f1f5f9; color:#475569; text-transform:uppercase; font-size:0.75em; letter-spacing:0.05em;}
    .totals{text-align:right; margin-top:20px; border-top:1px dashed #cbd5e1; padding-top:16px;}
    .footer{margin-top:25px; font-size:0.75em; text-align:center; color:#64748b;}
    @media print { body { background:white; padding:0; font-size: ${isA5 ? '8.5pt' : '11pt'}; } .invoice-paper { width: 100% !important; max-width: 100% !important; box-shadow:none !important; border:none !important; padding:0 !important; margin:0 !important; } }
    ${tplCSS}
  </style>
  </head>
  <body>
  <div class="invoice-paper">
    <div class="inv-header" style="display:flex; justify-content:space-between; flex-wrap:wrap; padding-bottom:20px; margin-bottom:20px;">
      <div>
        ${logoHTML}
        <h2 style="font-size:1.6em; color:#0f172a; margin-bottom:4px; font-weight:800;">${esc(data.bizName)}</h2>
        <div style="font-size:0.8em; color:#475569; line-height:1.5;">${esc(data.bizAddr).replace(/\n/g,'<br>')}</div>
        <div style="font-size:0.8em; color:#475569; margin-top:4px;">GSTIN: ${esc(data.bizGst)}</div>
      </div>
      <div style="text-align:right;">
        <h1 style="color:#0f172a; letter-spacing:0.05em; font-size:2.2em">TAX INVOICE</h1>
        <div style="font-size:0.85em; color:#64748b; margin-top:4px;">${data.gstType === 'Exclusive' ? 'GST Exclusive' : 'GST Inclusive'}</div>
      </div>
    </div>
    
    <div style="display:flex; justify-content:space-between; margin:12px 0; flex-wrap:wrap; background:#f8fafc; padding:16px; border-radius:12px; border:1px solid #e2e8f0; font-size:0.9em;">
      <div style="width:50%">
        <h4 style="font-size:0.85em; color:#64748b; text-transform:uppercase; margin-bottom:4px; letter-spacing:0.05em;">Billed To</h4>
        <div style="font-weight:700; font-size:1.1em; color:#0f172a;">${esc(data.customerName)}</div>
        <div style="color:#475569; margin-top:2px;">${esc(data.billingAddress).replace(/\n/g,'<br>')}</div>
        ${data.placeOfSupply ? `<div style="color:#475569; margin-top:4px;"><strong>Place of Supply:</strong> ${data.placeOfSupply}</div>` : ''}
      </div>
      <div style="width:40%; text-align:right;">
        <div style="margin-bottom:8px;"><strong>Invoice No:</strong> ${esc(data.invNo)}</div>
        <div><strong>Date:</strong> ${dateLabel(data.invDate)}</div>
      </div>
    </div>
    
    <table>
      <thead><tr><th style="text-align:center">#</th><th>Description</th><th>HSN/SAC</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Taxable</th><th style="text-align:center">GST%</th><th style="text-align:right">GST Amt</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    
    <div class="totals">
      <div style="color:#475569; margin-bottom:6px; font-size:0.9em;">Total Taxable: ${fmt(sub)}</div>
      ${gstBreakdownHTML}
      ${discountHTML}
      <div style="font-size:1.4em; font-weight:800; color:#0f172a; margin-top:12px;">Grand Total: ${fmt(grand)}</div>
    </div>
    
    <div style="margin-top:18px; padding-top:12px; border-top:1px dashed #cbd5e1; font-size:0.9em; color:#0f172a;">
      <strong>Amount in Words:</strong><br>
      <span style="text-transform: capitalize;">${numberToWords(grand)} Rupees Only</span>
    </div>
    ${bankHTML}
    <div style="display:flex; justify-content:space-between; margin-top:20px; font-size:0.8em; border-top:1px solid #e2e8f0; padding-top:16px;">
      <div style="width:60%">
        <strong>Terms & Conditions:</strong><br>
        <span style="color:#64748b">${esc(bizProfile.terms).replace(/\n/g, '<br>')}</span>
      </div>
      <div style="width:35%; text-align:right; display:flex; flex-direction:column; justify-content:flex-end;">
        ${sigHTML}
        <strong style="color:#0f172a;">Authorised Signatory</strong>
        <div style="color:#475569; margin-top:2px;">For ${esc(data.bizName)}</div>
      </div>
    </div>
    <div class="footer">Generated by BillingSuite Pro</div>
  </div>
  ${autoPrintScript}
  </body>
  </html>`;
}
