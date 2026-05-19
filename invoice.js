// ─── INVOICE EDITOR (UPGRADED WITH ADVANCE BALANCE ALLOCATION & PARTIAL TRACKING) ──────────

App.appliedAdvanceAmount = 0;

function renderInvoiceEditor() {
  const body = document.getElementById('invoiceItemsBody');
  if (!body) return;
  
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
  const discVal  = parseFloat(document.getElementById('invDiscountVal')?.value) || 0;
  const discount = invDiscType === 'flat' ? Math.min(discVal, grand) : grand * (discVal / 100);
  grand -= discount;
  return { sub, gstTotal, grand, discount };
}

function setInvoiceSupplyType(type) {
  App.currentInvoiceSupplyType = type;
  calcInvoiceTotals();
}

function calcInvoiceTotals() {
  const { sub, gstTotal, grand, discount } = _computeInvoiceTotals();
  
  document.getElementById('subtotalVal').textContent = fmt(sub);
  document.getElementById('discountDisplay').textContent = `– ${fmt(discount)}`;
  
  const appliedAdvance = App.appliedAdvanceAmount || 0;
  const netPayable = Math.max(0, grand - appliedAdvance);
  document.getElementById('grandTotalVal').textContent = fmt(netPayable);

  const supplySelect = document.getElementById('invSupplyTypeSelect');
  let calculatedSupplyType = supplySelect ? supplySelect.value : (App.currentInvoiceSupplyType || 'intra');

  const myStateCode = (bizProfile && bizProfile.state) ? String(bizProfile.state).trim() : '';
  const custGstinInput = document.getElementById('customerGstin')?.value.trim() || '';
  const custStateCode = custGstinInput.substring(0, 2);

  if (custStateCode && myStateCode && custStateCode.length === 2 && !isNaN(custStateCode)) {
    calculatedSupplyType = (custStateCode !== myStateCode) ? 'inter' : 'intra';
    if (supplySelect) supplySelect.value = calculatedSupplyType;
  }
  
  App.currentInvoiceSupplyType = calculatedSupplyType;

  const taxLabel = document.getElementById('taxLabel');
  const taxVal = document.getElementById('taxVal');
  
  if (taxLabel && taxVal) {
    if (calculatedSupplyType === 'intra') {
      const splitTax = gstTotal / 2;
      taxLabel.innerHTML = `CGST (${invGstType})<br>SGST (${invGstType})`;
      taxVal.innerHTML = `₹${fmt(splitTax)}<br>₹${fmt(splitTax)}`;
    } else {
      taxLabel.innerHTML = `IGST (${invGstType})`;
      taxVal.innerHTML = `₹${fmt(gstTotal)}`;
    }
  }
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

function checkCustomerAdvance() {
  const name = document.getElementById('customerName')?.value.trim();
  let banner = document.getElementById('customerAdvanceBanner');
  
  if (!name) {
    if (banner) banner.style.display = 'none';
    App.appliedAdvanceAmount = 0;
    return;
  }
  
  const c = customersArray.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (c && parseFloat(c.advanceBalance || 0) > 0) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'customerAdvanceBanner';
      banner.style.cssText = "background:var(--info-light); color:var(--info); padding:10px 14px; border-radius:var(--r-sm); margin-top:6px; font-size:0.85rem; font-weight:600; display:flex; justify-content:space-between; align-items:center; border:1px solid var(--info); grid-column: 1 / -1;";
      document.getElementById('customerName').parentNode.appendChild(banner);
    }
    
    const isApplied = App.appliedAdvanceAmount > 0;
    banner.style.display = 'flex';
    banner.innerHTML = `
      <span><i class="fas fa-info-circle"></i> Customer has <strong>₹${fmt(c.advanceBalance)}</strong> Advance Credit available.</span>
      <button class="btn btn-sm" style="background:var(--info); color:#fff; padding:2px 10px; font-size:0.75rem;" onclick="applyCustomerAdvanceCredit(${c.advanceBalance})">
        ${isApplied ? 'Credit Applied ✓' : 'Apply Advance Credit'}
      </button>
    `;
  } else {
    if (banner) banner.style.display = 'none';
    App.appliedAdvanceAmount = 0;
  }
}

function applyCustomerAdvanceCredit(availableBalance) {
  const { grand } = _computeInvoiceTotals();
  const applyAmount = Math.min(availableBalance, grand);
  App.appliedAdvanceAmount = applyAmount;
  toast(`Applied ₹${fmt(applyAmount)} from advance credit balance.`, 'success');
  calcInvoiceTotals();
  checkCustomerAdvance();
}

async function saveInvoice() {
  if (App.isSaving) return;
 
  const invId = document.getElementById('invNumber').value.trim();
  if (!invId) { toast('Enter an invoice number', 'error'); return; }
 
  const isEditing = App.editingInvoiceId === invId;
  if (isInvoiceIdDuplicate(invId) && !isEditing) { toast(`Invoice ${invId} already exists`, 'error'); return; }
  if (!document.getElementById('customerName').value.trim()) { toast('Enter a customer name', 'error'); return; }
  if (!invLineItems.length) { toast('Add at least one line item', 'error'); return; }
  if (invLineItems.some(i => !i.desc || !i.desc.trim())) { toast('Enter a product name for all items', 'error'); return; }
 
  const { sub, gstTotal, grand, discount } = _computeInvoiceTotals();
  const statusSelect = document.getElementById('invStatusSelect');
  let status = statusSelect ? statusSelect.value : 'unpaid';
 
  let amountPaid = 0;
  const appliedAdvance = App.appliedAdvanceAmount || 0;

  if (status === 'paid') {
    amountPaid = grand;
  } else if (appliedAdvance > 0) {
    amountPaid = appliedAdvance;
    status = amountPaid >= grand ? 'paid' : 'partial';
  }

  const customerGstin = document.getElementById('customerGstin') ? document.getElementById('customerGstin').value.trim().toUpperCase() : '';

  const payload = {
    invoiceId: invId,
    store_id: currentStoreId,
    date: document.getElementById('invDate').value,
    customerName: document.getElementById('customerName').value,
    customerEmail: document.getElementById('customerEmail').value,
    customerGstin: customerGstin, 
    billingAddress: document.getElementById('billingAddr').value,
    gstType: invGstType,
    supplyType: App.currentInvoiceSupplyType || 'intra',
    items: invLineItems.map(i => ({ description: i.desc, hsn: i.hsn || '', quantity: parseFloat(i.qty), unitPrice: parseFloat(i.price), gstRate: i.gstRate })),
    subtotal: sub, gstAmount: gstTotal, discount: discount, grandTotal: grand, status: status, amountPaid: amountPaid
  };
 
  App.isSaving = true;
  const saveBtn = document.getElementById('saveInvoiceBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }
 
  if (appliedAdvance > 0) {
    const c = customersArray.find(x => x.name.toLowerCase() === payload.customerName.toLowerCase());
    if (c) {
      c.advanceBalance = Math.max(0, (c.advanceBalance || 0) - appliedAdvance);
      await supabase.from('customers').update({ advanceBalance: c.advanceBalance }).eq('id', c.id).eq('store_id', currentStoreId);
    }
  }

  const customerName = document.getElementById('customerName').value.trim();
  if (customerName && !customersArray.find(c => c.name.toLowerCase() === customerName.toLowerCase())) {
    const newCust = { id: 'CUST-' + Date.now().toString().slice(-5), store_id: currentStoreId, name: customerName, email: payload.customerEmail || '', phone: '', gstin: customerGstin, address: payload.billingAddress || '', advanceBalance: 0 };
    customersArray.push(newCust);
    await supabase.from('customers').insert([newCust]); 
  }
 
  if (isEditing) {
    const oldInv = invoicesArray.find(i => i.invoiceId === invId);
    if (oldInv) {
      (oldInv.items || []).forEach(oldIt => {
        const existing = inventoryStock.find(p => p.name.toLowerCase() === (oldIt.description || oldIt.desc || '').toLowerCase());
        if (existing) existing.stock = (existing.stock || 0) + parseFloat(oldIt.quantity);
      });
    }
    invoicesArray = invoicesArray.filter(i => i.invoiceId !== invId);
    App.editingInvoiceId = null;
  }
 
  // FIX: Adjust stock inventories AND sync updates to Supabase products table
  for (let it of invLineItems) {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === it.desc.toLowerCase());
    if (existing) {
      existing.stock = (existing.stock || 0) - it.qty;
      await supabase.from('products').update({ stock: existing.stock }).eq('id', existing.id).eq('store_id', currentStoreId);
    } else {
      const newProd = { id: getNextId('product'), store_id: currentStoreId, name: it.desc, hsn: it.hsn || '', sellPrice: it.price, costPrice: it.price * 0.7, gstRate: it.gstRate, stock: -it.qty, type: 'Goods', status: 'Active', category: 'General', unit: 'PCS', barcode: '' };
      inventoryStock.push(newProd);
      await supabase.from('products').insert([newProd]);
    }
  }
 
  invoicesArray.unshift({ ...payload, created_at: new Date().toISOString() });
  if (typeof syncUI === 'function') syncUI(); else { renderInvoiceLists(); updateDatalists(); }
  
  let dbError;
  if (isEditing) {
    const { error } = await supabase.from('invoices').update(payload).eq('invoiceId', invId).eq('store_id', currentStoreId);
    dbError = error;
  } else {
    const { error } = await supabase.from('invoices').insert([payload]);
    dbError = error;
  }

  App.isSaving = false;
  if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save & Close'; }

  if (dbError) {
    toast('Cloud save failed.', 'error');
  } else {
    App.appliedAdvanceAmount = 0;
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
      if (tEdit) { tEdit.style.display = 'inline-flex'; tEdit.textContent = `Editing: ${invId}`; }
      toast(`Invoice ${invId} saved & printing...`, 'success');
    }
    else if (App.postSaveAction === 'save') {
      App.editingInvoiceId = payload.invoiceId;
      const tEdit = document.getElementById('tabEditInvoice');
      if (tEdit) { tEdit.style.display = 'inline-flex'; tEdit.textContent = `Editing: ${invId}`; }
      document.getElementById('invNumber').readOnly = true;
      document.getElementById('invNumber').style.backgroundColor = 'var(--surface2)';
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
  if (statusSelect) { statusSelect.value = 'unpaid'; } // FIX 1: Removed crashing cross-module function trigger

  App.editingInvoiceId = null;
  App.editingInvoiceStatus = 'unpaid';
  App.currentInvoiceSupplyType = 'intra';
  App.appliedAdvanceAmount = 0;

  const banner = document.getElementById('customerAdvanceBanner');
  if (banner) banner.style.display = 'none';

  const supplySelect = document.getElementById('invSupplyTypeSelect');
  if (supplySelect) supplySelect.value = 'intra';

  const invNum = document.getElementById('invNumber');
  if (invNum) { invNum.value = getNextId('invoice'); invNum.readOnly = false; invNum.style.backgroundColor = ''; }
  const invDate = document.getElementById('invDate');
  if (invDate) invDate.value = today();

  renderInvoiceEditor();
  const formTitle = document.getElementById('invoiceFormTitle');
  if (formTitle) formTitle.innerHTML = `<i class="fas fa-plus-circle"></i> Create New Invoice`;
}

function setInvFilter(status, btn) {
  document.querySelectorAll('#invoiceHistory .filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('invActiveFilter').value = status;
  filterInvoices();
}

// ─── RE-ENGINEERED RECORD STREAM FILTER ENGINE WITH LAYOUT STYLES ───
function filterInvoices() {
  const q = (document.getElementById('invoiceSearch')?.value || '').toLowerCase();
  const status = document.getElementById('invActiveFilter')?.value || 'all';
  const sort = document.getElementById('invoiceSortSelect')?.value || 'date-desc';

  let filtered = invoicesArray.map(normalizeInvoiceKeys).filter(i => {
    const matchesSearch = (i.invoiceId || '').toLowerCase().includes(q) || (i.customerName || '').toLowerCase().includes(q) || (i.customerEmail || '').toLowerCase().includes(q) || String(i.grandTotal || '').includes(q) || (i.date || '').includes(q);
    const matchesStatus = (status === 'all') || (i.status === status);
    return matchesSearch && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sort === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (sort === 'date-asc')  return new Date(a.date) - new Date(b.date);
    if (sort === 'amt-desc')  return (b.grandTotal || 0) - (a.grandTotal || 0);
    if (sort === 'amt-asc')   return (a.grandTotal || 0) - (b.grandTotal || 0);
    return 0;
  });

  const hist = document.getElementById('invoiceHistoryList');
  if (!hist) return;

  if (!filtered.length) {
    hist.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No results found</p></div>';
    return;
  }

  // Compile output layouts contextually based on selected configuration state
  if (invoiceViewMode === 'table') {
    hist.innerHTML = `
      <div class="table-responsive" style="background:var(--surface); border-radius:var(--r-md); border:1px solid var(--border); margin-top:12px;">
        <table class="items-table" style="margin:0; width:100%">
          <thead>
            <tr>
              <th>Invoice ID</th>
              <th>Date</th>
              <th>Customer Name</th>
              <th style="text-align:right">Grand Total</th>
              <th style="text-align:center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(inv => `
              <tr onclick="showInvoiceDetail('${esc(inv.invoiceId)}')" style="cursor:pointer;">
                <td style="font-weight:700; color:var(--accent);">${esc(inv.invoiceId)}</td>
                <td>${dateLabel(inv.date)}</td>
                <td style="font-weight:500;">${esc(inv.customerName)}</td>
                <td style="text-align:right; font-weight:600;">${fmt(inv.grandTotal)}</td>
                <td style="text-align:center;">${getStatusBadge(inv.status || 'unpaid')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } else if (invoiceViewMode === 'grid') {
    hist.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:16px; margin-top:12px;">
        ${filtered.map(inv => `
          <div class="card" onclick="showInvoiceDetail('${esc(inv.invoiceId)}')" style="cursor:pointer; padding:16px; display:flex; flex-direction:column; gap:10px; border:1px solid var(--border); background:var(--surface); transition: transform 0.2s;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:800; color:var(--accent); font-size:1.1rem;">${esc(inv.invoiceId)}</span>
              ${getStatusBadge(inv.status || 'unpaid')}
            </div>
            <div>
              <div style="font-weight:600; font-size:0.95rem; margin-bottom:2px;">${esc(inv.customerName)}</div>
              <div style="font-size:0.8rem; color:var(--ink2);"><i class="fas fa-calendar-alt"></i> ${dateLabel(inv.date)}</div>
            </div>
            <div style="margin-top:auto; padding-top:10px; border-top:1px dashed var(--border); display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.8rem; color:var(--ink2);">Grand Total</span>
              <span style="font-weight:700; font-size:1.1rem; color:var(--ink);">${fmt(inv.grandTotal)}</span>
            </div>
          </div>
        `).join('')}
      </div>`;
  } else {
    // Standard High-Density List View Format
    hist.innerHTML = filtered.map(inv => `
      <div class="list-item" onclick="showInvoiceDetail('${esc(inv.invoiceId)}')">
        <div>
          <div class="list-item-title">${esc(inv.invoiceId)}</div>
          <div class="list-item-sub">${esc(inv.customerName)} · ${dateLabel(inv.date)}</div>
        </div>
        <div style="text-align:right">
          <div class="list-item-amount">${fmt(inv.grandTotal)}</div>
          ${getStatusBadge(inv.status || 'unpaid')}
        </div>
      </div>
    `).join('');
  }
}

function renderInvoiceLists() {
  // FIX 2B: Corrected badge binding strings here too
  const makeItem = inv => `<div class="list-item" onclick="showInvoiceDetail('${esc(inv.invoiceId)}')"><div><div class="list-item-title">${esc(inv.invoiceId)}</div><div class="list-item-sub">${esc(inv.customerName)} · ${dateLabel(inv.date)}</div></div><div style="text-align:right"><div class="list-item-amount">${fmt(inv.grandTotal)}</div>${getStatusBadge(inv.status || 'unpaid')}</div></div>`;
  const normalized = invoicesArray.map(normalizeInvoiceKeys);
  const recent = normalized.slice(0, 4);
  const emptyHTML = () => `<div class="empty-state"><i class="fas fa-file-invoice-dollar"></i><p>No invoices yet</p></div>`;
  ['recentInvoiceList','dashRecentInvoices'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = recent.length ? recent.map(makeItem).join('') : emptyHTML();
  });
  filterInvoices();
  _updateInvoiceQuickStats();
}

function _updateInvoiceQuickStats() {
  const normalized = invoicesArray.map(normalizeInvoiceKeys);
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const thisMonth = normalized.filter(i => { if (!i.date) return false; const d = new Date(i.date); return d.getFullYear() === y && d.getMonth() === m; });
  const unpaid = normalized.filter(i => i.status === 'unpaid' || i.status === 'overdue' || i.status === 'partial');
  const mc = document.getElementById('invMonthCount');  if (mc) mc.textContent = thisMonth.length;
  const uc = document.getElementById('invUnpaidCount'); if (uc) uc.textContent = unpaid.length;
}

// AUTOMATED CASE RECONCILIATION LAYER: Safely maps column variants on load
function normalizeInvoiceKeys(inv) {
  if (!inv) return {};
  return {
    invoiceId: inv.invoiceId || inv.invoiceid || '',
    store_id: inv.store_id || inv.storeId || 'Store 1',
    date: inv.date || '',
    customerName: inv.customerName || inv.customername || '',
    customerEmail: inv.customerEmail || inv.customeremail || '',
    customerGstin: inv.customerGstin || inv.customergstin || '',
    billingAddress: inv.billingAddress || inv.billingaddress || '',
    gstType: inv.gstType || inv.gsttype || 'Exclusive',
    supplyType: inv.supplyType || inv.supplytype || 'intra',
    items: inv.items || [],
    subtotal: parseFloat(inv.subtotal || inv.grandTotal || 0),
    gstAmount: parseFloat(inv.gstAmount || inv.gstamount || 0),
    discount: parseFloat(inv.discount || 0),
    grandTotal: parseFloat(inv.grandTotal || inv.grandtotal || 0),
    status: inv.status || 'unpaid',
    amountPaid: parseFloat(inv.amountPaid || inv.amountpaid || 0)
  };
}

function showInvoiceDetail(id) {
  const rawInv = invoicesArray.find(i => (i.invoiceId || i.invoiceid) === id);
  if (!rawInv) return;
  const inv = normalizeInvoiceKeys(rawInv);
  const paid = inv.amountPaid || 0;
  const due = Math.max(0, (inv.grandTotal || 0) - paid);
  const isInter = (inv.supplyType === 'inter');

  document.getElementById('modalTitle').textContent = `${inv.invoiceId} — ${inv.customerName}`;
  document.getElementById('modalBody').innerHTML = `
    <div style="font-size:0.85rem;margin-bottom:12px;color:var(--ink2)">
      <strong>Date:</strong> ${dateLabel(inv.date)} &nbsp;|&nbsp; <strong>Customer:</strong> ${esc(inv.customerName)} &nbsp;|&nbsp; <strong>GSTIN:</strong> ${esc(inv.customerGstin || 'N/A')} &nbsp;|&nbsp; <strong>Supply Type:</strong> ${isInter ? '<span style="color:var(--gold);font-weight:600">Inter-state (IGST)</span>' : 'Intra-state (CGST+SGST)'}
    </div>
    <div class="items-table-wrap">
      <table class="items-table">
        <thead><tr><th>Description</th><th>HSN</th><th>Qty</th><th>Price</th><th>GST%</th><th>Total</th></tr></thead>
        <tbody>
          ${(inv.items || []).map(it => {
            const qty = parseFloat(it.quantity || it.qty || 0);
            const price = parseFloat(it.unitPrice || it.price || 0);
            const rate = parseFloat(it.gstRate || 0);
            const { total } = calcGST(qty * price, rate, inv.gstType);
            return `<tr><td>${esc(it.description || it.desc)}</td><td>${esc(it.hsn || '')}</td><td>${qty}</td><td>${fmt(price)}</td><td>${(rate * 100).toFixed(0)}%</td><td>${fmt(total)}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="totals-box" style="margin-top:12px">
      <div class="totals-row"><span>Subtotal</span><span>${fmt(inv.subtotal)}</span></div>
      
      ${isInter ? `
        <div class="totals-row"><span>IGST Total</span><span>${fmt(inv.gstAmount)}</span></div>
      ` : `
        <div class="totals-row"><span>CGST (50%)</span><span>₹${fmt(inv.gstAmount / 2)}</span></div>
        <div class="totals-row"><span>SGST (50%)</span><span>₹${fmt(inv.gstAmount / 2)}</span></div>
      `}
      
      ${inv.discount ? `<div class="totals-row discount-row"><span>Discount</span><span>– ${fmt(inv.discount)}</span></div>` : ''}
      <div class="totals-row"><span>Grand Total</span><span>${fmt(inv.grandTotal)}</span></div>
      <div class="totals-row" style="color:var(--accent2)"><span>Amount Paid</span><span>${fmt(paid)}</span></div>
      <div class="totals-row grand"><span>Balance Due</span><span style="color:${due > 0 ? 'var(--danger)' : 'var(--ink)'}">${fmt(due)}</span></div>
    </div>
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      ${due > 0 ? `<button class="btn btn-primary btn-sm" onclick="recordInvoicePayment('${esc(id)}')"><i class="fas fa-hand-holding-usd"></i> Record Payment</button>` : `<span class="badge badge-green"><i class="fas fa-check-circle"></i> Fully Paid</span>`}
      <button class="btn btn-secondary btn-sm"   onclick="loadEditInvoice('${esc(id)}')"><i class="fas fa-edit"></i> Edit</button>
      <button class="btn btn-gold btn-sm"      onclick="printSavedInvoice('${esc(id)}')"><i class="fas fa-print"></i> Print</button>
      <button class="btn btn-info btn-sm"      onclick="duplicateInvoice('${esc(id)}')"><i class="fas fa-copy"></i> Duplicate</button>
      <button class="btn btn-danger btn-sm"    onclick="deleteInvoice('${esc(id)}')"><i class="fas fa-trash"></i> Delete</button>
    </div>`;
  document.getElementById('detailModal').classList.add('open');
}

function recordInvoicePayment(id) {
  const rawInv = invoicesArray.find(i => (i.invoiceId || i.invoiceid) === id);
  if (!rawInv) return;
  const inv = normalizeInvoiceKeys(rawInv);
  const currentPaid = inv.amountPaid || 0;
  const balanceDue = Math.max(0, (inv.grandTotal || 0) - currentPaid);

  document.getElementById('modalTitle').innerHTML = `<i class="fas fa-hand-holding-usd" style="color:var(--accent)"></i> Record Invoice Payment`;
  document.getElementById('modalBody').innerHTML = `
    <div style="background:var(--surface2); padding:12px; border-radius:var(--r-sm); border:1px solid var(--border); margin-bottom:16px; font-size:0.85rem;">
      <strong>Invoice ID:</strong> ${esc(inv.invoiceId)} &nbsp;|&nbsp; <strong>Customer:</strong> ${esc(inv.customerName)}<br>
      <strong>Total Bill:</strong> ₹${fmt(inv.grandTotal)} &nbsp;|&nbsp; <span style="color:var(--danger)"><strong>Balance Due:</strong> ₹${fmt(balanceDue)}</span>
    </div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Payment Receipt Date</label><input type="date" class="form-control" id="invPmtDate" value="${today()}"></div>
      <div class="form-group">
        <label class="form-label">Payment Mode</label>
        <select class="form-control" id="invPmtMode">
          <option value="Cash">Cash Currency Inflow</option>
          <option value="Bank Transfer">Bank Wire (IMPS/NEFT)</option>
          <option value="UPI">UPI Digital Payment</option>
          <option value="Cheque">Commercial Cheque Clearing</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Amount Received (₹)</label><input type="number" class="form-control" id="invPmtAmount" placeholder="0.00" min="0.01" step="0.01" value="${balanceDue.toFixed(2)}"></div>
    <div class="form-group"><label class="form-label">Reference ID / Internal Notes</label><input type="text" class="form-control" id="invPmtNotes" placeholder="Txn ID..."></div>
    <div style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="showInvoiceDetail('${esc(id)}')"><i class="fas fa-arrow-left"></i> Back to Detail</button>
      <button class="btn btn-primary" id="confirmInvPmtBtn" onclick="submitInvoicePaymentForm('${esc(id)}')"><i class="fas fa-check-circle"></i> Complete Receipt Entry</button>
    </div>
  `;
}

async function submitInvoicePaymentForm(id) {
  const rawInv = invoicesArray.find(i => (i.invoiceId || i.invoiceid) === id);
  if (!rawInv) return;
  const inv = normalizeInvoiceKeys(rawInv);
  const currentPaid = inv.amountPaid || 0;
  const balanceDue = (inv.grandTotal || 0) - currentPaid;
  const amtVal = parseFloat(document.getElementById('invPmtAmount').value) || 0;
  if (amtVal <= 0) { toast('Please enter a collection value exceeding zero.', 'error'); return; }
  if (amtVal > balanceDue) { toast('Receipt values cannot overflow outstanding balances.', 'error'); return; }

  const btn = document.getElementById('confirmInvPmtBtn');
  setButtonLoading(btn, true, 'Saving...');
  const newAmountPaid = currentPaid + amtVal;
  const newStatus = newAmountPaid >= inv.grandTotal ? 'paid' : 'partial';

  const { error } = await supabase.from('invoices').update({ amountPaid: newAmountPaid, status: newStatus }).eq('invoiceId', id).eq('store_id', currentStoreId);
  setButtonLoading(btn, false, 'Complete Receipt Entry');
  if (error) { toast('Cloud sync failed.', 'error'); } else { 
    // Synchronize local indexes parameters securely
    const idx = invoicesArray.findIndex(i => (i.invoiceId || i.invoiceid) === id);
    if (idx > -1) { invoicesArray[idx].amountPaid = newAmountPaid; invoicesArray[idx].status = newStatus; }
    toast('Payment entry recorded!', 'success'); if (typeof syncUI === 'function') syncUI(); else renderInvoiceLists(); showInvoiceDetail(id); 
  }
}

function printSavedInvoice(id) {
  const rawInv = invoicesArray.find(i => (i.invoiceId || i.invoiceid) === id);
  if (!rawInv) return;
  const inv = normalizeInvoiceKeys(rawInv);
  const printHtml = buildInvoiceHTML(inv, bizProfile.printTemplate || 'tpl-standard', false);
  const printWin = window.open('', '_blank');
  if (printWin) { printWin.document.write(printHtml); printWin.document.close(); }
  closeModal(); 
}

function duplicateInvoice(id) {
  const rawInv = invoicesArray.find(i => (i.invoiceId || i.invoiceid) === id);
  if (!rawInv) return;
  const inv = normalizeInvoiceKeys(rawInv);
  App.editingInvoiceId = null; App.editingInvoiceStatus = 'unpaid';
  document.getElementById('invNumber').value = getNextId('invoice');
  document.getElementById('invNumber').readOnly = false;
  document.getElementById('invNumber').style.backgroundColor = '';
  document.getElementById('invDate').value = today();
  document.getElementById('customerName').value = inv.customerName;
  document.getElementById('customerEmail').value = inv.customerEmail || '';
  document.getElementById('customerGstin').value = inv.customerGstin || ''; 
  document.getElementById('billingAddr').value = inv.billingAddress || '';
  document.getElementById('invDiscountVal').value = inv.discount || 0;
  setGstType(inv.gstType || 'Exclusive');

  invLineItems.length = 0;
  (inv.items || []).forEach(it => {
    invLineItems.push({ desc: it.description || it.desc || '', hsn: it.hsn || '', qty: parseFloat(it.quantity || 0), price: parseFloat(it.unitPrice || it.price || 0), gstRate: it.gstRate });
  });

  renderInvoiceEditor(); closeModal(); switchTab('invoice');
  const formTitle = document.getElementById('invoiceFormTitle');
  if (formTitle) formTitle.innerHTML = `<i class="fas fa-copy"></i> New Invoice (Copy of ${esc(id)})`;
}

async function deleteInvoice(id) {
  if (!confirm(`Permanently delete ${id}? Inventory counts will reverse automatically.`)) return;
  const rawInv = invoicesArray.find(i => (i.invoiceId || i.invoiceid) === id);
  if (!rawInv) return;
  const invToDelete = normalizeInvoiceKeys(rawInv);
  (invToDelete.items || []).forEach(oldIt => {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === (oldIt.description || oldIt.desc || '').toLowerCase());
    if (existing) existing.stock = (existing.stock || 0) + parseFloat(oldIt.quantity);
  });
  
  invoicesArray = invoicesArray.filter(i => (i.invoiceId || i.invoiceid) !== id);
  closeModal(); if (typeof syncUI === 'function') syncUI(); else { renderInvoiceLists(); updateDashboard(); }
  await supabase.from('invoices').delete().eq('invoiceId', id).eq('store_id', currentStoreId);
  toast('Invoice row purged cleanly.', 'success');
}

function loadEditInvoice(id) {
  const rawInv = invoicesArray.find(i => (i.invoiceId || i.invoiceid) === id);
  if (!rawInv) return;
  const inv = normalizeInvoiceKeys(rawInv);
  App.editingInvoiceId = id; App.editingInvoiceStatus = inv.status || 'unpaid';
  document.getElementById('invNumber').value = inv.invoiceId;
  document.getElementById('invNumber').readOnly = true;
  document.getElementById('invNumber').style.backgroundColor = 'var(--surface2)';
  
  let dStr = "";
  try { if (inv.date) { const d = new Date(inv.date); if (!isNaN(d)) dStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 10); } } catch(e) {}
  document.getElementById('invDate').value = dStr || today();
  document.getElementById('customerName').value = inv.customerName;
  document.getElementById('customerEmail').value = inv.customerEmail || '';
  document.getElementById('customerGstin').value = inv.customerGstin || ''; 
  document.getElementById('billingAddr').value = inv.billingAddress || '';
  document.getElementById('invDiscountVal').value = inv.discount || 0;
  setGstType(inv.gstType || 'Exclusive');

  const statusSelect = document.getElementById('invStatusSelect');
  if (statusSelect) { statusSelect.value = inv.status || 'unpaid'; }

  const supplySelect = document.getElementById('invSupplyTypeSelect');
  if (supplySelect) { supplySelect.value = inv.supplyType || 'intra'; }
  App.currentInvoiceSupplyType = inv.supplyType || 'intra';

  invLineItems.length = 0;
  (inv.items || []).forEach(it => {
    invLineItems.push({ desc: it.description || it.desc || '', hsn: it.hsn || '', qty: it.quantity, price: it.unitPrice || it.price, gstRate: it.gstRate });
  });

  renderInvoiceEditor(); closeModal(); switchTab('invoice'); checkCustomerAdvance();
  const tabNew = document.getElementById('tabNewInvoice');
  const tabEdit = document.getElementById('tabEditInvoice');
  if (tabNew) tabNew.style.display = 'none';
  if (tabEdit) { tabEdit.style.display = 'inline-block'; tabEdit.textContent = `Editing: ${id}`; tabEdit.click(); }
  const formTitle = document.getElementById('invoiceFormTitle');
  if (formTitle) formTitle.innerHTML = `<i class="fas fa-edit" style="color:var(--gold)"></i> Editing Invoice ${id}`;
}

function openNewInvoiceForm() {
  clearInvoiceForm(true);
  const tabNew = document.getElementById('tabNewInvoice');
  const tabEdit = document.getElementById('tabEditInvoice');
  if (tabEdit) tabEdit.style.display = 'none';
  if (tabNew) { tabNew.style.display = 'inline-block'; tabNew.click(); }
}

function cancelInvoice() {
  if (confirm("Are you sure you want to close this invoice? Any unsaved changes will be lost.")) {
    clearInvoiceForm(true);
    closeInvoiceEditor();
  }
}

function closeInvoiceEditor() {
  const tNew = document.getElementById('tabNewInvoice');
  const tEdit = document.getElementById('tabEditInvoice');
  if (tNew) tNew.style.display = 'none';
  if (tEdit) tEdit.style.display = 'none';
  const historyPane = document.getElementById('invoiceHistory');
  const newPane = document.getElementById('invoiceNew');
  if (historyPane) historyPane.style.display = 'block';
  if (newPane) newPane.style.display = 'none';
  document.querySelectorAll('#invoiceTabsBar .sec-tab').forEach(b => b.classList.remove('active'));
  const historyTabBtn = document.querySelector('#invoiceTabsBar .sec-tab[data-stab="invoiceHistory"]');
  if (historyTabBtn) historyTabBtn.classList.add('active');
  localStorage.setItem('bs_active_stab_invoicePane', 'invoiceHistory');
}

function processInvoice(action) {
  App.postSaveAction = action; 
  saveInvoice();
}

// ─── TYPE OF VIEW STATE FOR INVOICE TAB ───
let invoiceViewMode = localStorage.getItem('bs_invoice_view_mode') || 'list';

function setInvoiceViewMode(mode) {
  invoiceViewMode = mode;
  localStorage.setItem('bs_invoice_view_mode', mode);
  
  // Update button active states
  document.getElementById('invViewListBtn')?.classList.toggle('active', mode === 'list');
  document.getElementById('invViewTableBtn')?.classList.toggle('active', mode === 'table');
  document.getElementById('invViewGridBtn')?.classList.toggle('active', mode === 'grid');
  
  filterInvoices(); // Re-run your existing filter function to refresh the layout
}

// Restore saved view on page load
setTimeout(() => {
  if (localStorage.getItem('bs_invoice_view_mode')) {
    setInvoiceViewMode(localStorage.getItem('bs_invoice_view_mode'));
  }
}, 750);

setTimeout(() => {
  document.getElementById('customerName')?.addEventListener('input', checkCustomerAdvance);
  document.getElementById('customerName')?.addEventListener('change', checkCustomerAdvance);
  
  document.getElementById('customerGstin')?.addEventListener('input', calcInvoiceTotals);
  document.getElementById('customerGstin')?.addEventListener('change', calcInvoiceTotals);
  document.getElementById('invSupplyTypeSelect')?.addEventListener('change', calcInvoiceTotals);
}, 600);