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

// ─── CLOUD SYNC: SAVE INVOICE ────────────────────────────
// ─── SUPABASE SYNC: SAVE INVOICE ────────────────────────────
async function saveInvoice() {
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
 
  // 1. Build the Supabase Payload
  const payload = {
    invoiceId: invId,
    store_id: currentStoreId, // <-- CRUCIAL FOR MULTI-STORE ISOLATION
    date: document.getElementById('invDate').value,
    customerName: document.getElementById('customerName').value,
    customerEmail: document.getElementById('customerEmail').value,
    billingAddress: document.getElementById('billingAddr').value,
    gstType: invGstType,
    supplyType: App.currentInvoiceSupplyType || 'intra',
    items: invLineItems.map(i => ({ description: i.desc, hsn: i.hsn, quantity: parseFloat(i.qty), unitPrice: parseFloat(i.price), gstRate: i.gstRate })),
    subtotal: sub, gstAmount: gstTotal, discount: discount, grandTotal: grand, status: status
  };
 
  App.isSaving = true;
  const saveBtn = document.getElementById('saveInvoiceBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }
 
  // 1. Auto-save new customer quietly to Supabase
  const customerName = document.getElementById('customerName').value.trim();
  const customerGstin = document.getElementById('customerGstin') ? document.getElementById('customerGstin').value.trim().toUpperCase() : '';
  if (customerName && !customersArray.find(c => c.name.toLowerCase() === customerName.toLowerCase())) {
    const newCust = { id: 'CUST-' + Date.now().toString().slice(-5), store_id: currentStoreId, name: customerName, email: payload.customerEmail || '', phone: '', gstin: customerGstin, address: payload.billingAddress || '' };
    customersArray.push(newCust);
    const dbCust = { id: newCust.id, store_id: currentStoreId, name: customerName, email: payload.customerEmail || '', phone: '', gstin: customerGstin, address: payload.billingAddress || '' };
    supabase.from('customers').insert([dbCust]).then(); 
  }
 
  // 2. Reverse old stock if editing an existing invoice
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
 
  // 3. Deduct new stock & Auto-Create new products in Supabase!
  const inventoryUpdates = [];
  const inventoryInserts = [];
  
  invLineItems.forEach(it => {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === it.desc.toLowerCase());
    if (existing) { 
      existing.stock = (existing.stock || 0) - parseFloat(it.qty); 
      inventoryUpdates.push({
        id: existing.id, store_id: currentStoreId, name: existing.name, type: existing.type || 'Goods', 
        barcode: existing.barcode || '', status: existing.status || 'Active', category: existing.category || '', 
        hsn: existing.hsn || '', unit: existing.unit || '', sell_price: existing.sellPrice, 
        cost_price: existing.costPrice, gst_rate: existing.gstRate, stock: existing.stock
      });
    } 
    else {
      const newId = getNextId('product'); // <--- Fixed Random ID
      const newProd = { id: newId, store_id: currentStoreId, name: it.desc, hsn: it.hsn, sellPrice: it.price, costPrice: it.price * 0.7, gstRate: it.gstRate, stock: -parseFloat(it.qty), type: 'Goods', status: 'Active', category: '', unit: 'PCS', barcode: '' }; // <--- Blank Category
      inventoryStock.push(newProd);
      inventoryInserts.push({
        id: newId, store_id: currentStoreId, name: it.desc, hsn: it.hsn || '', sell_price: it.price, cost_price: it.price * 0.7, gst_rate: it.gstRate, stock: -parseFloat(it.qty), type: 'Goods', status: 'Active', category: '', unit: 'PCS', barcode: ''
      });
    }
  });
  
  // 4. Fire Supabase background syncs for stock
  if (inventoryUpdates.length > 0) {
    inventoryUpdates.forEach(u => supabase.from('inventory').update(u).eq('id', u.id).eq('store_id', currentStoreId).then());
  }
  if (inventoryInserts.length > 0) {
    supabase.from('inventory').insert(inventoryInserts).then();
  }
 
  if (typeof renderProductGrid === 'function') renderProductGrid();
  if (typeof renderCustomerGrid === 'function') renderCustomerGrid();
 
  // 2. Update UI instantly
  invoicesArray.unshift({ ...payload, created_at: new Date().toISOString() });
  renderInvoiceLists(); 
  if (typeof updateDashboard === 'function') updateDashboard();
  
  // 3. Push to Supabase Cloud
  let dbError;
  if (isEditing) {
    const { error } = await supabase.from('invoices').update(payload).eq('invoiceId', invId).eq('store_id', currentStoreId);
    dbError = error;
  } else {
    const { error } = await supabase.from('invoices').insert([payload]);
    dbError = error;
  }

  App.isSaving = false;
  if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Invoice'; }

  if (dbError) {
    console.error("Supabase Save Error:", dbError);
    toast('Cloud save failed.', 'error');
  } else {
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
      toast(`Invoice ${invId} saved!`, 'success');
    }
  }
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
  if (invNum) { invNum.value = getNextId('invoice'); invNum.readOnly = false; invNum.style.backgroundColor = ''; }
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

// ─── SUPABASE SYNC: UPDATE STATUS ───────────────────────────
async function updateInvStatus(id) {
  const inv = invoicesArray.find(i => i.invoiceId === id);
  if (inv) {
    inv.status = document.getElementById('invStatusSel').value;
    renderInvoiceLists();
    toast('Syncing status to cloud...', 'warn');
    
    const { error } = await supabase.from('invoices').update({ status: inv.status }).eq('invoiceId', id).eq('store_id', currentStoreId);
    if (error) toast('Cloud save failed.', 'error');
    else toast('Status saved successfully', 'success');
  }
}

function duplicateInvoice(id) {
  const inv = invoicesArray.find(i => i.invoiceId === id);
  if (!inv) return;
  App.editingInvoiceId = null; App.editingInvoiceStatus = 'unpaid';
  document.getElementById('invNumber').value = getNextId('invoice');
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

// ─── SUPABASE SYNC: DELETE INVOICE ───────────────────────────
async function deleteInvoice(id) {
  if (!confirm(`Permanently delete ${id}?`)) return;
  const invToDelete = invoicesArray.find(i => i.invoiceId === id);
  if (!invToDelete) return;
  
  (invToDelete.items || []).forEach(oldIt => {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === oldIt.description.toLowerCase());
    if (existing) existing.stock = (existing.stock || 0) + parseFloat(oldIt.quantity);
  });
  
  const idx = invoicesArray.findIndex(i => i.invoiceId === id);
  if (idx > -1) invoicesArray.splice(idx, 1);
  
  closeModal(); renderInvoiceLists(); updateDashboard();
  if (typeof renderInventoryTable === 'function') renderInventoryTable();
  
  toast('Deleting from cloud...', 'warn');
  const { error } = await supabase.from('invoices').delete().eq('invoiceId', id).eq('store_id', currentStoreId);
  if (error) toast('Delete failed.', 'error');
  else toast('Invoice deleted', 'success');
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

