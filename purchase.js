// ─── PURCHASE EDITOR (Upgraded with HSN) ─────────
function renderPurchaseEditor() {
  const body = document.getElementById('purchaseItemsBody');
  
  if (purLineItems.length > 0 && purLineItems[0].hsn === undefined) {
    purLineItems.forEach(i => i.hsn = '');
  }

  body.innerHTML = purLineItems.map((it, i) => {
    const { gst, subtotalPart, total } = calcGST(it.qty * it.cost, it.gstRate, purGstType);
    return `<tr>
      <td><input class="item-input pur-field" data-i="${i}" data-f="desc" value="${esc(it.desc)}" placeholder="Add Item" list="productList"></td>
      <td><input class="item-input pur-field" data-i="${i}" data-f="hsn" value="${esc(it.hsn || '')}" placeholder="HSN" style="width:80px; font-size:0.8rem"></td>
      <td><input class="item-input pur-field" data-i="${i}" data-f="qty"  type="number" value="${it.qty}"  min="0.01" step="0.01" style="width:60px"></td>
      <td><input class="item-input pur-field" data-i="${i}" data-f="cost" type="number" value="${it.cost}" min="0" step="0.01" style="width:90px"></td>
      <td class="no-print">
        <select class="gst-select-inline pur-gst-select" data-i="${i}">
          <option value="0"    ${it.gstRate === 0    ? 'selected' : ''}>0%</option>
          <option value="0.05" ${it.gstRate === 0.05 ? 'selected' : ''}>5%</option>
          <option value="0.12" ${it.gstRate === 0.12 ? 'selected' : ''}>12%</option>
          <option value="0.18" ${it.gstRate === 0.18 ? 'selected' : ''}>18%</option>
          <option value="0.28" ${it.gstRate === 0.28 ? 'selected' : ''}>28%</option>
        </select>
      </td>
      <td style="color:var(--gold);font-weight:500">${fmt(gst)}</td>
      <td style="font-weight:600;color:var(--accent)">${fmt(total)}</td>
      <td class="no-print"><button class="btn-icon rem-pur-item" data-i="${i}" title="Remove item"><i class="fas fa-trash-alt"></i></button></td>
    </tr>`;
  }).join('');

  body.querySelectorAll('.pur-field').forEach(inp => {
    inp.addEventListener('change', () => {
      const i = +inp.dataset.i, f = inp.dataset.f;
      if (!purLineItems[i]) return;
      if (f === 'qty' || f === 'cost') {
        purLineItems[i][f] = parseFloat(inp.value) || 0;
      } else {
        purLineItems[i][f] = inp.value;
        const match = inventoryStock.find(p => p.name.toLowerCase() === inp.value.toLowerCase());
        if (match && f === 'desc') {
          purLineItems[i].cost    = match.costPrice || 0;
          purLineItems[i].gstRate = match.gstRate   || 0;
          purLineItems[i].hsn     = match.hsn       || '';
        }
      }
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
    btn.addEventListener('click', () => { purLineItems.splice(+btn.dataset.i, 1); renderPurchaseEditor(); });
  });

  calcPurchaseTotals();
}

function calcPurchaseTotals() {
  let sub = 0, gstTotal = 0, total = 0;
  purLineItems.forEach(it => {
    const r = calcGST(it.qty * it.cost, it.gstRate, purGstType);
    sub      += r.subtotalPart;
    gstTotal += r.gst;
    total    += r.total;
  });
  document.getElementById('purSubtotalVal').textContent    = fmt(sub);
  document.getElementById('purTaxVal').textContent         = fmt(gstTotal);
  document.getElementById('purTaxLabel').textContent       = `GST Total — ${purGstType}`;
  document.getElementById('purchaseTotalSpan').textContent = fmt(total);
}

function setPurGstType(type) {
  purGstType = type;
  document.getElementById('purGstExcBtn').classList.toggle('active', type === 'Exclusive');
  document.getElementById('purGstIncBtn').classList.toggle('active', type === 'Inclusive');
  renderPurchaseEditor();
}

// ─── SAVE PURCHASE ────────────────────────────
async function savePurchase() {
  if (App.isSaving) return;

  const poId = document.getElementById('poNumber').value.trim();
  if (!poId) { toast('Enter a PO number', 'error'); return; }

  const isEditing = App.editingPurchaseId === poId;
  if (typeof isPoIdDuplicate === 'function' && isPoIdDuplicate(poId) && !isEditing) { 
    toast(`PO ${poId} already exists`, 'error'); return; 
  }

  if (!document.getElementById('supplierName').value.trim()) { toast('Enter a supplier name', 'error'); return; }
  if (!purLineItems.length) { toast('Add at least one item', 'error'); return; }
  if (purLineItems.some(i => !i.desc.trim() || i.desc.trim().toLowerCase() === 'add item')) { toast('Please enter a product name for all items', 'error'); return; }

  let sub = 0, gstTotal = 0, total = 0;
  purLineItems.forEach(it => {
    const r = calcGST(it.qty * it.cost, it.gstRate, purGstType);
    sub += r.subtotalPart; gstTotal += r.gst; total += r.total;
  });

  // 1. Build the Supabase Payload
  const payload = {
    poNumber: poId,
    store_id: currentStoreId, // <-- CRUCIAL FOR MULTI-STORE
    date: document.getElementById('purchaseDate').value,
    supplier: document.getElementById('supplierName').value,
    gstType: purGstType,
    items: purLineItems.map(i => ({ product: i.desc, hsn: i.hsn, quantity: parseFloat(i.qty), unitCost: parseFloat(i.cost), gstRate: i.gstRate })),
    subtotal: sub, gstAmount: gstTotal, totalAmount: total
  };

  App.isSaving = true;
  const saveBtn = document.getElementById('savePurchaseBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

  // 1. Reverse old stock if editing an existing PO
  if (isEditing) {
    const oldPur = purchasesArray.find(p => p.poNumber === poId);
    if (oldPur) {
      oldPur.items.forEach(oldIt => {
        const existing = inventoryStock.find(p => p.name.toLowerCase() === oldIt.product.toLowerCase());
        if (existing) existing.stock = (existing.stock || 0) - parseFloat(oldIt.quantity); 
      });
    }
    const idx = purchasesArray.findIndex(p => p.poNumber === poId);
    if (idx > -1) purchasesArray.splice(idx, 1);
    App.editingPurchaseId = null;
  }

  // 2. Auto-save new supplier quietly to Supabase
  const supplierName = document.getElementById('supplierName').value.trim();
  if (supplierName && !suppliersArray.find(s => s.name.toLowerCase() === supplierName.toLowerCase())) {
    const newSupp = { id: 'SUPP-' + Date.now().toString().slice(-5), store_id: currentStoreId, name: supplierName, phone: '', address: '', paymentTerms: '', gstin: '' };
    suppliersArray.push(newSupp);
    const dbSupp = { id: newSupp.id, store_id: currentStoreId, name: supplierName, phone: '', address: '', payment_terms: '', gstin: '' };
    supabase.from('suppliers').insert([dbSupp]).then(); 
  }
  
  // 3. Add new stock, update Cost Price & prepare Supabase payload
  const inventoryUpdates = [];
  const inventoryInserts = [];

  purLineItems.forEach(it => {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === it.desc.toLowerCase());
    if (existing) { 
      existing.stock = (existing.stock || 0) + parseFloat(it.qty); 
      existing.costPrice = parseFloat(it.cost); // Automatically updates Cost Price!
      inventoryUpdates.push({
        id: existing.id, store_id: currentStoreId, name: existing.name, type: existing.type || 'Goods', 
        barcode: existing.barcode || '', status: existing.status || 'Active', category: existing.category || '', 
        hsn: existing.hsn || '', unit: existing.unit || '', sell_price: existing.sellPrice, 
        cost_price: existing.costPrice, gst_rate: existing.gstRate, stock: existing.stock
      });
    } 
    else {
      const newId = getNextId('product'); // <--- Fixed Random ID
      const newProd = { id: newId, store_id: currentStoreId, name: it.desc, hsn: it.hsn, sellPrice: it.cost * 1.5, costPrice: it.cost, gstRate: it.gstRate, stock: parseFloat(it.qty), type: 'Goods', status: 'Active', category: '', unit: 'PCS', barcode: '' }; // <--- Blank Category
      inventoryStock.push(newProd);
      inventoryInserts.push({
        id: newId, store_id: currentStoreId, name: it.desc, hsn: it.hsn || '', sell_price: it.cost * 1.5, cost_price: it.cost, gst_rate: it.gstRate, stock: parseFloat(it.qty), type: 'Goods', status: 'Active', category: '', unit: 'PCS', barcode: ''
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
  if (typeof renderSupplierGrid === 'function') renderSupplierGrid();
  
  // 2. Update UI instantly
  purchasesArray.unshift({ ...payload, created_at: new Date().toISOString() });
  if (typeof renderPurchaseLists === 'function') renderPurchaseLists();
  if (typeof updateDashboard === 'function') updateDashboard();

  // 3. Push to Supabase Cloud
  let dbError;
  if (isEditing) {
    const { error } = await supabase.from('purchases').update(payload).eq('poNumber', poId).eq('store_id', currentStoreId);
    dbError = error;
  } else {
    const { error } = await supabase.from('purchases').insert([payload]);
    dbError = error;
  }
  
  App.isSaving = false;
  if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Purchase'; }

  if (dbError) {
    console.error("Supabase Save Error:", dbError);
    toast('Cloud save failed.', 'error');
  } else {
    if (App.postSaveAction === 'close') {
      clearPurchaseForm(true);
      if (typeof closePurchaseEditor === 'function') closePurchaseEditor();
      toast(`Purchase ${poId} saved successfully!`, 'success');
    } 
    else if (App.postSaveAction === 'print') {
      const printHtml = buildPurchaseHTML(bizProfile.printTemplate || 'tpl-standard', false, payload);
      const printWin = window.open('', '_blank');
      if (printWin) { printWin.document.write(printHtml); printWin.document.close(); }
      App.editingPurchaseId = payload.poNumber; 
      const tEdit = document.getElementById('tabEditPurchase');
      if (tEdit) tEdit.style.display = 'inline-flex';
      toast(`Purchase ${poId} saved & printing...`, 'success');
      App.isDirty = false;
    } 
    else if (App.postSaveAction === 'save') {
      App.editingPurchaseId = payload.poNumber;
      const tEdit = document.getElementById('tabEditPurchase');
      if (tEdit) tEdit.style.display = 'inline-flex';
      toast(`Purchase ${poId} saved!`, 'success');
      App.isDirty = false;
    }
  }
}

function clearPurchaseForm(force = false) {
  if (!force && purLineItems.some(i => i.desc.trim())) { if (!confirm('Clear all line items and supplier details?')) return; }
  purLineItems.length = 0; purLineItems.push({ desc: '', hsn: '', qty: 1, cost: 0, gstRate: 0.18 });
  const suppName = document.getElementById('supplierName');
  if (suppName) suppName.value = '';
  App.editingPurchaseId = null; 
  const poNum = document.getElementById('poNumber');
  if (poNum) { poNum.value = getNextId('purchase'); poNum.readOnly = false; poNum.style.backgroundColor = ''; }
  const purDate = document.getElementById('purchaseDate');
  if (purDate) purDate.value = today(); 
  renderPurchaseEditor(); 
  const tabNew = document.querySelector('.sec-tab[data-stab="purchaseNew"]');
  const tabEdit = document.getElementById('tabEditPurchase');
  if (tabNew && tabEdit) { tabEdit.style.display = 'none'; tabNew.style.display = 'inline-block'; tabNew.click(); }
  if (!force) toast('Form cleared', 'warn');
  App.isDirty = false; 
}

function renderPurchaseLists() {
  const recent = purchasesArray.slice(0, 4);
  const emptyHTML = '<div class="empty-state"><i class="fas fa-truck"></i><p>No purchases yet</p></div>';
  const makeItem = pur => `
    <div class="list-item" onclick="showPurchaseDetail('${esc(pur.poNumber)}')">
      <div><div class="list-item-title">${esc(pur.poNumber)}</div><div class="list-item-sub">${esc(pur.supplier)} · ${dateLabel(pur.date)}</div></div>
      <div style="text-align:right"><div class="list-item-amount">${fmt(pur.totalAmount)}</div><span class="badge badge-blue">Purchase</span></div>
    </div>`;
  ['recentPurchaseList', 'dashRecentPurchases'].forEach(id => {
    const el = document.getElementById(id); 
    if (el) el.innerHTML = recent.length ? recent.map(makeItem).join('') : emptyHTML;
  });
  filterPurchases();
}

function filterPurchases() {
  const q = (document.getElementById('purchaseSearch')?.value || '').toLowerCase();
  const sort = document.getElementById('purchaseSortSelect')?.value || 'date-desc';
  let filtered = purchasesArray.filter(p => p.poNumber.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q) || (p.date || '').includes(q) || String(p.totalAmount || '').includes(q));
  filtered.sort((a, b) => {
    if (sort === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (sort === 'date-asc')  return new Date(a.date) - new Date(b.date);
    if (sort === 'amt-desc')  return (b.totalAmount || 0) - (a.totalAmount || 0);
    if (sort === 'amt-asc')   return (a.totalAmount || 0) - (b.totalAmount || 0);
    return 0;
  });
  const hist = document.getElementById('purchaseHistoryList');
  if (hist) {
    hist.innerHTML = filtered.length
      ? filtered.map(pur => `<div class="list-item" onclick="showPurchaseDetail('${esc(pur.poNumber)}')"><div><div class="list-item-title">${esc(pur.poNumber)}</div><div class="list-item-sub">${esc(pur.supplier)} · ${dateLabel(pur.date)}</div></div><div style="text-align:right"><div class="list-item-amount">${fmt(pur.totalAmount)}</div><span class="badge badge-blue">Purchase</span></div></div>`).join('')
      : '<div class="empty-state"><i class="fas fa-search"></i><p>No results found</p></div>';
  }
}

function showPurchaseDetail(id) {
  const pur = purchasesArray.find(p => p.poNumber === id);
  if (!pur) return;
  document.getElementById('modalTitle').textContent = `${pur.poNumber} — ${pur.supplier}`;
  document.getElementById('modalBody').innerHTML = `
    <div style="font-size:0.85rem;margin-bottom:12px;color:var(--ink2)">
      <strong>Date:</strong> ${dateLabel(pur.date)} &nbsp;|&nbsp; <strong>Supplier:</strong> ${esc(pur.supplier)}
    </div>
    <div class="items-table-wrap">
      <table class="items-table">
        <thead><tr><th>Product</th><th>HSN</th><th>Qty</th><th>Unit Cost</th><th>GST%</th><th>Total</th></tr></thead>
        <tbody>
          ${(pur.items || []).map(it => `<tr><td>${esc(it.product)}</td><td>${esc(it.hsn||'')}</td><td>${it.quantity}</td><td>${fmt(it.unitCost)}</td><td>${((it.gstRate || 0) * 100).toFixed(0)}%</td><td>${fmt(it.quantity * it.unitCost)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="totals-box" style="margin-top:12px">
      <div class="totals-row"><span>Subtotal</span><span>${fmt(pur.subtotal)}</span></div>
      <div class="totals-row"><span>GST</span><span>${fmt(pur.gstAmount)}</span></div>
      <div class="totals-row grand"><span>Total</span><span>${fmt(pur.totalAmount)}</span></div>
    </div>
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" onclick="loadEditPurchase('${esc(id)}')"><i class="fas fa-edit"></i> Edit</button>
      <button class="btn btn-gold btn-sm"    onclick="printSavedPurchase('${esc(id)}')"><i class="fas fa-print"></i> Print</button>
      <button class="btn btn-info btn-sm"    onclick="duplicatePurchase('${esc(id)}')"><i class="fas fa-copy"></i> Duplicate</button>
      <button class="btn btn-danger btn-sm"  onclick="deletePurchase('${esc(id)}')"><i class="fas fa-trash"></i> Delete</button>
    </div>`;
  document.getElementById('detailModal').classList.add('open');
}

function printSavedPurchase(id) {
  const pur = purchasesArray.find(p => String(p.poNumber) === String(id));
  if (!pur) return;
  const printHtml = buildPurchaseHTML(bizProfile.printTemplate || 'tpl-standard', false, pur);
  const printWin = window.open('', '_blank');
  if (printWin) { printWin.document.write(printHtml); printWin.document.close(); }
  if (typeof closeModal === 'function') closeModal(); 
}

function duplicatePurchase(id) {
  const pur = purchasesArray.find(p => p.poNumber === id);
  if (!pur) return;
  App.editingPurchaseId = null; 
  document.getElementById('poNumber').value = getNextId('purchase');
  document.getElementById('poNumber').readOnly = false;
  document.getElementById('poNumber').style.backgroundColor = '';
  document.getElementById('purchaseDate').value = today();
  document.getElementById('supplierName').value = pur.supplier;
  if (typeof setPurGstType === 'function') setPurGstType(pur.gstType || 'Exclusive');

  purLineItems.length = 0;
  (pur.items || []).forEach(it => {
    purLineItems.push({ desc: it.product, hsn: it.hsn || '', qty: it.quantity, cost: it.unitCost, gstRate: it.gstRate });
  });

  renderPurchaseEditor(); closeModal(); switchTab('purchase');
  const tabNew = document.querySelector('.sec-tab[data-stab="purchaseNew"]');
  if (tabNew) tabNew.click();
  toast(`Loaded ${id} as a copy.`, 'success');
}

// ─── SUPABASE SYNC: DELETE PURCHASE ───────────────────────────
async function deletePurchase(id) {
  const purToDelete = purchasesArray.find(p => p.poNumber === id);
  if (!purToDelete) return;
  
  purToDelete.items.forEach(oldIt => {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === oldIt.product.toLowerCase());
    if (existing) existing.stock = (existing.stock || 0) - oldIt.quantity;
  });
  
  const idx = purchasesArray.findIndex(p => p.poNumber === id);
  if (idx > -1) purchasesArray.splice(idx, 1);
  
  closeModal(); renderPurchaseLists(); updateDashboard(); renderInventoryTable();
  
  toast('Deleting from cloud...', 'warn');
  const { error } = await supabase.from('purchases').delete().eq('poNumber', id).eq('store_id', currentStoreId);
  if (error) toast('Delete failed', 'error');
  else toast('Purchase permanently deleted', 'success');
}

App.postSaveAction = 'close';
function processPurchase(action) { App.postSaveAction = action; savePurchase(); }

function closePurchaseEditor() {
  const tNew = document.getElementById('tabNewPurchase');
  const tEdit = document.getElementById('tabEditPurchase');
  if (tNew) tNew.style.display = 'none';
  if (tEdit) tEdit.style.display = 'none';
  const targetTab = document.querySelector('.sec-tab[data-stab="purchaseRecent"]') || document.querySelector('.sec-tab[data-stab="purchaseHistory"]');
  if (targetTab) targetTab.click();
}

function cancelPurchase() {
  const isCompletelyEmpty = document.getElementById('supplierName')?.value.trim() === '' && !purLineItems.some(i => (i.desc || '').trim() !== '');
  if (!isCompletelyEmpty && App.isDirty) { if (!confirm("⚠️ WARNING: Any unsaved changes will be lost. Are you sure you want to close?")) { return; } }
  clearPurchaseForm(true);
  if (typeof closePurchaseEditor === 'function') closePurchaseEditor();
}

function printCurrentPurchase() {
  const template = bizProfile.printTemplate || 'tpl-standard';
  const html = buildPurchaseHTML(template, false);
  const printWin = window.open('', '_blank');
  if (!printWin) { toast("Please allow pop-ups to print the PO.", "error"); return; }
  printWin.document.open(); printWin.document.write(html); printWin.document.close();
}

function loadEditPurchase(id) {
  const pur = purchasesArray.find(p => p.poNumber === id);
  if (!pur) return;
  App.editingPurchaseId = id;
  document.getElementById('poNumber').value = pur.poNumber;
  document.getElementById('poNumber').readOnly = true;
  document.getElementById('poNumber').style.backgroundColor = 'var(--surface2)';
  let dStr = "";
  try { if (pur.date) { const d = new Date(pur.date); if (!isNaN(d)) dStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 10); } } catch(e){}
  document.getElementById('purchaseDate').value = dStr || today();
  document.getElementById('supplierName').value = pur.supplier;
  if (typeof setPurGstType === 'function') setPurGstType(pur.gstType || 'Exclusive');

  purLineItems.length = 0;
  (pur.items || []).forEach(it => {
    purLineItems.push({ desc: it.product, hsn: it.hsn || '', qty: it.quantity, cost: it.unitCost, gstRate: it.gstRate });
  });

  renderPurchaseEditor(); closeModal(); switchTab('purchase');
  const tabNew = document.querySelector('.sec-tab[data-stab="purchaseNew"]');
  if (tabNew) tabNew.click(); 
  toast(`Editing ${id}. Stock will recalculate when saved.`, 'success');
}



function openNewPurchaseForm() {
  if (typeof clearPurchaseForm === 'function') clearPurchaseForm(true);
  const histTab = document.querySelector('.sec-tab[data-stab="purchaseHistory"]');
  if (histTab) histTab.classList.remove('active');
  const tabNew = document.getElementById('tabNewPurchase');
  if (tabNew) { tabNew.style.display = 'inline-block'; tabNew.click(); }
}
