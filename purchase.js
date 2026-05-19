// ─── PURCHASE EDITOR (UPGRADED WITH VENDOR ADVANCE ALLOCATION & OUTFLOW TRACKING) ─────────

App.appliedSupplierAdvanceAmount = 0;

function renderPurchaseEditor() {
  const body = document.getElementById('purchaseItemsBody');
  if (!body) return;
  
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

  document.getElementById('purSubtotalVal').textContent = fmt(sub);
  
  const appliedAdvance = App.appliedSupplierAdvanceAmount || 0;
  const netPayable = Math.max(0, total - appliedAdvance);
  document.getElementById('purchaseTotalSpan').textContent = fmt(netPayable);

  // AUTOMATED GST LOGIC: Look up the active supplier profile to find their GSTIN prefix
  const myStateCode = (bizProfile && bizProfile.state) ? String(bizProfile.state).trim() : '';
  const supplierName = document.getElementById('supplierName')?.value.trim() || '';
  
  const matchedSupplier = suppliersArray.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
  const suppGstin = matchedSupplier ? (matchedSupplier.gstin || '') : '';
  const suppStateCode = suppGstin.substring(0, 2);

  let calculatedSupplyType = 'intra';
  if (suppStateCode && myStateCode && suppStateCode !== myStateCode) {
    calculatedSupplyType = 'inter';
  }

  // Cache to global payload state for Supabase schema saves
  App.currentPurchaseSupplyType = calculatedSupplyType;

  // Render the breakdown on screen dynamically
  const taxLabel = document.getElementById('purTaxLabel');
  const taxVal = document.getElementById('purTaxVal');
  
  if (taxLabel && taxVal) {
    if (calculatedSupplyType === 'intra') {
      const splitTax = gstTotal / 2;
      taxLabel.innerHTML = `CGST (${purGstType})<br>SGST (${purGstType})`;
      taxVal.innerHTML = `₹${fmt(splitTax)}<br>₹${fmt(splitTax)}`;
    } else {
      taxLabel.innerHTML = `IGST (${purGstType})`;
      taxVal.innerHTML = `₹${fmt(gstTotal)}`;
    }
  }
}

function setPurGstType(type) {
  purGstType = type;
  document.getElementById('purGstExcBtn').classList.toggle('active', type === 'Exclusive');
  document.getElementById('purGstIncBtn').classList.toggle('active', type === 'Inclusive');
  renderPurchaseEditor();
}

function togglePurPaymentOption() {
  const status = document.getElementById('purStatusSelect').value;
  const amtGroup = document.getElementById('purAmountPaidGroup');
  if (amtGroup) {
    amtGroup.style.display = (status === 'partial') ? 'block' : 'none';
  }
}

// ─── DYNAMIC SUPPLIER ADVANCE CHECK STRIP ───
function checkSupplierAdvance() {
  const name = document.getElementById('supplierName')?.value.trim();
  let banner = document.getElementById('supplierAdvanceBanner');
  
  if (!name) {
    if (banner) banner.style.display = 'none';
    App.appliedSupplierAdvanceAmount = 0;
    return;
  }
  
  const s = suppliersArray.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (s && parseFloat(s.advanceBalance || 0) > 0) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'supplierAdvanceBanner';
      banner.style.cssText = "background:var(--gold-light); color:var(--gold); padding:10px 14px; border-radius:var(--r-sm); margin-top:6px; font-size:0.85rem; font-weight:600; display:flex; justify-content:space-between; align-items:center; border:1px solid var(--gold); grid-column:1/-1;";
      document.getElementById('supplierName').parentNode.appendChild(banner);
    }
    
    const isApplied = App.appliedSupplierAdvanceAmount > 0;
    banner.style.display = 'flex';
    banner.innerHTML = `
      <span><i class="fas fa-info-circle"></i> Vendor profile contains <strong>₹${fmt(s.advanceBalance)}</strong> Advance Remittance float.</span>
      <button class="btn btn-sm" style="background:var(--gold); color:#fff; padding:2px 10px; font-size:0.75rem;" onclick="applySupplierAdvanceCredit(${s.advanceBalance})">
        ${isApplied ? 'Credit Applied ✓' : 'Deduct From Advance'}
      </button>
    `;
  } else {
    if (banner) banner.style.display = 'none';
    App.appliedSupplierAdvanceAmount = 0;
  }
}

function applySupplierAdvanceCredit(availableBalance) {
  let sub = 0, gstTotal = 0, total = 0;
  purLineItems.forEach(it => {
    const r = calcGST(it.qty * it.cost, it.gstRate, purGstType);
    sub += r.subtotalPart; gstTotal += r.gst; total += r.total;
  });
  const applyAmount = Math.min(availableBalance, total);
  App.appliedSupplierAdvanceAmount = applyAmount;
  toast(`Subtracted ₹${fmt(applyAmount)} from vendor advance balance pool.`, 'success');
  calcPurchaseTotals();
  checkSupplierAdvance();
}

// ─── SAVE PURCHASE MATRIX ───
async function savePurchase() {
  if (App.isSaving) return;

  const poId = document.getElementById('poNumber').value.trim();
  if (!poId) { toast('Enter a PO number', 'error'); return; }

  const isEditing = App.editingPurchaseId === poId;
  if (typeof isPoIdDuplicate === 'function' && isPoIdDuplicate(poId) && !isEditing) { 
    toast(`PO ${poId} already exists — use a different number`, 'error'); return; 
  }

  if (!document.getElementById('supplierName').value.trim()) { toast('Enter a supplier name', 'error'); return; }
  if (!purLineItems.length) { toast('Add at least one item', 'error'); return; }
  if (purLineItems.some(i => !i.desc || !i.desc.trim() || i.desc.trim().toLowerCase() === 'add item')) { 
    toast('Please enter a product name for all items', 'error'); return; 
  }

  let sub = 0, gstTotal = 0, total = 0;
  purLineItems.forEach(it => {
    const r = calcGST(it.qty * it.cost, it.gstRate, purGstType);
    sub      += r.subtotalPart;
    gstTotal += r.gst;
    total    += r.total;
  });

  const statusSelect = document.getElementById('purStatusSelect');
  let status = statusSelect ? statusSelect.value : 'unpaid';
  let amountPaid = 0;

  if (status === 'paid') {
    amountPaid = total; 
  } else if (status === 'partial') {
    amountPaid = parseFloat(document.getElementById('purAmountPaid').value) || 0;
    if (amountPaid >= total) {
      status = 'paid';
      if (statusSelect) statusSelect.value = 'paid';
    } else if (amountPaid <= 0) {
      status = 'unpaid';
      if (statusSelect) statusSelect.value = 'unpaid';
    }
  } else {
    amountPaid = 0; 
  }

  const appliedAdvance = App.appliedSupplierAdvanceAmount || 0;
  if (appliedAdvance > 0 && status !== 'paid') {
    amountPaid += appliedAdvance;
    status = amountPaid >= total ? 'paid' : 'partial';
  }

  const payload = {
    poNumber: poId,
    store_id: currentStoreId,
    date: document.getElementById('purchaseDate').value,
    supplier: document.getElementById('supplierName').value,
    gstType: purGstType,
    supplyType: App.currentPurchaseSupplyType || 'intra',
    items: purLineItems.map(i => ({ product: i.desc, hsn: i.hsn || '', quantity: parseFloat(i.qty), unitCost: parseFloat(i.cost), gstRate: i.gstRate })),
    subtotal: sub, gstAmount: gstTotal, totalAmount: total, status: status, amountPaid: amountPaid
  };

  App.isSaving = true;
  const saveBtn = document.getElementById('savePurchaseBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

  if (appliedAdvance > 0) {
    const s = suppliersArray.find(x => x.name.toLowerCase() === payload.supplier.toLowerCase());
    if (s) {
      s.advanceBalance = Math.max(0, (s.advanceBalance || 0) - appliedAdvance);
      await supabase.from('suppliers').update({ advanceBalance: s.advanceBalance }).eq('id', s.id).eq('store_id', currentStoreId);
    }
  }

  if (isEditing) {
    const oldPur = purchasesArray.find(p => p.poNumber === poId);
    if (oldPur) {
      (oldPur.items || []).forEach(oldIt => {
        const existing = inventoryStock.find(p => p.name.toLowerCase() === (oldIt.product || oldIt.desc || '').toLowerCase());
        if (existing) existing.stock = (existing.stock || 0) - oldIt.quantity; 
      });
    }
    purchasesArray = purchasesArray.filter(p => p.poNumber !== poId);
    App.editingPurchaseId = null;
  }

  // FIX 1: Adjust local array counts AND push/update the data directly into Supabase products table
  for (let it of purLineItems) {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === it.desc.toLowerCase());
    if (existing) { 
      existing.stock = (existing.stock || 0) + parseFloat(it.qty);
      existing.costPrice = parseFloat(it.cost);
      await supabase.from('products').update({ stock: existing.stock, costPrice: existing.costPrice }).eq('id', existing.id).eq('store_id', currentStoreId);
    } else {
      const newProd = { id: getNextId('product'), store_id: currentStoreId, name: it.desc, hsn: it.hsn || '', sellPrice: it.cost * 1.4, costPrice: it.cost, gstRate: it.gstRate, stock: parseFloat(it.qty), type: 'Goods', status: 'Active', category: 'General', unit: 'PCS', barcode: '' };
      inventoryStock.push(newProd);
      await supabase.from('products').insert([newProd]);
    }
  }

  // FIX 2: Restored snake_case column mapping syntax ('payment_terms') so new vendors save successfully
  const supplierName = document.getElementById('supplierName').value.trim();
  if (!suppliersArray.find(s => s.name.toLowerCase() === supplierName.toLowerCase())) {
    const newSupp = { id: 'SUPP-' + Date.now().toString().slice(-5), store_id: currentStoreId, name: supplierName, phone: '', address: '', payment_terms: '', gstin: '', advanceBalance: 0 };
    suppliersArray.push(newSupp);
    await supabase.from('suppliers').insert([newSupp]); 
  }
  
  purchasesArray.unshift({ ...payload, created_at: new Date().toISOString() });
  if (typeof syncUI === 'function') syncUI(); else { renderPurchaseLists(); updateDatalists(); }

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
    toast('Cloud save execution failed.', 'error');
  } else {
    App.appliedSupplierAdvanceAmount = 0;
    if (App.postSaveAction === 'close') {
      clearPurchaseForm(true);
      if (typeof closePurchaseEditor === 'function') closePurchaseEditor();
      toast(`Purchase Order ${poId} verified and saved!`, 'success');
    } 
    else if (App.postSaveAction === 'print') {
      const printHtml = buildPurchaseHTML(bizProfile.printTemplate || 'tpl-standard', false, payload);
      const printWin = window.open('', '_blank');
      if (printWin) { printWin.document.write(printHtml); printWin.document.close(); }
      App.editingPurchaseId = payload.poNumber;
      const tEdit = document.getElementById('tabEditPurchase');
      if (tEdit) { tEdit.style.display = 'inline-flex'; tEdit.textContent = `Editing: ${poId}`; }
      toast(`Purchase Order ${poId} saved & printing...`, 'success');
    }
    else if (App.postSaveAction === 'save') {
      App.editingPurchaseId = payload.poNumber;
      const tEdit = document.getElementById('tabEditPurchase');
      if (tEdit) { tEdit.style.display = 'inline-flex'; tEdit.textContent = `Editing: ${poId}`; }
      document.getElementById('poNumber').readOnly = true;
      document.getElementById('poNumber').style.backgroundColor = 'var(--surface2)';
      toast(`Purchase Order ${poId} saved!`, 'success');
    }
  }
}

function clearPurchaseForm(force = false) {
  if (!force && purLineItems.some(i => i.desc && i.desc.trim())) { 
    if (!confirm('Clear all active line items and supplier details?')) return; 
  }
  
  purLineItems.length = 0; 
  purLineItems.push({ desc: '', hsn: '', qty: 1, cost: 0, gstRate: 0.18 });
  
  const suppName = document.getElementById('supplierName');
  if (suppName) suppName.value = '';
  
  App.editingPurchaseId = null; 
  App.appliedSupplierAdvanceAmount = 0;

  const banner = document.getElementById('supplierAdvanceBanner');
  if (banner) banner.style.display = 'none';

  const statusSelect = document.getElementById('purStatusSelect');
  if (statusSelect) statusSelect.value = 'unpaid';

  const amtInput = document.getElementById('purAmountPaid');
  if (amtInput) amtInput.value = '';
  togglePurPaymentOption();

  const poNum = document.getElementById('poNumber');
  if (poNum) { 
    poNum.value = getNextId('purchase'); 
    poNum.readOnly = false; 
    poNum.style.backgroundColor = ''; 
  }
  
  const purDate = document.getElementById('purchaseDate');
  if (purDate) purDate.value = today(); 
  
  renderPurchaseEditor(); 
}

function renderPurchaseLists() {
  const recent = purchasesArray.slice(0, 4);
  const emptyHTML = '<div class="empty-state"><i class="fas fa-truck"></i><p>No purchases yet</p></div>';
  const makeItem = pur => `
    <div class="list-item" onclick="showPurchaseDetail('${esc(pur.poNumber)}')">
      <div><div class="list-item-title">${esc(pur.poNumber)}</div><div class="list-item-sub">${esc(pur.supplier)} · ${dateLabel(pur.date)}</div></div>
      <div style="text-align:right"><div class="list-item-amount">${fmt(pur.totalAmount)}</div>${getStatusBadge(pur.status || 'unpaid')}</div>
    </div>`;
  ['recentPurchaseList', 'dashRecentPurchases'].forEach(id => {
    const el = document.getElementById(id); 
    if (el) el.innerHTML = recent.length ? recent.map(makeItem).join('') : emptyHTML;
  });
  filterPurchases();
}

function showPurchaseDetail(id) {
  const pur = purchasesArray.find(p => p.poNumber === id);
  if (!pur) return;
  const paid = pur.amountPaid || 0;
  const due = Math.max(0, (pur.totalAmount || 0) - paid);
  const isInter = (pur.supplyType === 'inter');

  document.getElementById('modalTitle').textContent = `${pur.poNumber} — ${pur.supplier}`;
  document.getElementById('modalBody').innerHTML = `
    <div style="font-size:0.85rem;margin-bottom:12px;color:var(--ink2)">
      <strong>Date:</strong> ${dateLabel(pur.date)} &nbsp;|&nbsp; <strong>Supplier:</strong> ${esc(pur.supplier)} &nbsp;|&nbsp; <strong>Supply Type:</strong> ${isInter ? '<span style="color:var(--gold);font-weight:600">Inter-state (IGST)</span>' : 'Intra-state (CGST+SGST)'}
    </div>
    <div class="items-table-wrap">
      <table class="items-table">
        <thead><tr><th>Product</th><th>HSN</th><th>Qty</th><th>Unit Cost</th><th>GST%</th><th>Total</th></tr></thead>
        <tbody>
          ${(pur.items || []).map(it => `<tr><td>${esc(it.product || it.desc)}</td><td>${esc(it.hsn||'')}</td><td>${it.quantity}</td><td>${fmt(it.unitCost || it.cost)}</td><td>${((it.gstRate || 0) * 100).toFixed(0)}%</td><td>${fmt(it.quantity * (it.unitCost || it.cost))}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="totals-box" style="margin-top:12px">
      <div class="totals-row"><span>Subtotal (Base)</span><span>${fmt(pur.subtotal)}</span></div>
      
      ${isInter ? `
        <div class="totals-row"><span>IGST Total</span><span>${fmt(pur.gstAmount)}</span></div>
      ` : `
        <div class="totals-row"><span>CGST (50%)</span><span>₹${fmt(pur.gstAmount / 2)}</span></div>
        <div class="totals-row"><span>SGST (50%)</span><span>₹${fmt(pur.gstAmount / 2)}</span></div>
      `}
      
      <div class="totals-row"><span>Total Amount</span><span>${fmt(pur.totalAmount)}</span></div>
      <div class="totals-row" style="color:var(--accent2)"><span>Amount Disbursed</span><span>${fmt(paid)}</span></div>
      <div class="totals-row grand"><span>Remaining Debt</span><span style="color:${due > 0 ? 'var(--danger)' : 'var(--ink)'}">${fmt(due)}</span></div>
    </div>
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      ${due > 0 ? `<button class="btn btn-primary btn-sm" onclick="recordPurchasePayment('${esc(id)}')"><i class="fas fa-wallet"></i> Record Remittance</button>` : `<span class="badge badge-green"><i class="fas fa-check-circle"></i> Fully Cleared</span>`}
      <button class="btn btn-secondary btn-sm" onclick="loadEditPurchase('${esc(id)}')"><i class="fas fa-edit"></i> Edit</button>
      <button class="btn btn-gold btn-sm"    onclick="printSavedPurchase('${esc(id)}')"><i class="fas fa-print"></i> Print</button>
      <button class="btn btn-info btn-sm"    onclick="duplicatePurchase('${esc(id)}')"><i class="fas fa-copy"></i> Duplicate</button>
      <button class="btn btn-danger btn-sm"  onclick="deletePurchase('${esc(id)}')"><i class="fas fa-trash"></i> Delete</button>
    </div>`;
  document.getElementById('detailModal').classList.add('open');
}

function recordPurchasePayment(id) {
  const pur = purchasesArray.find(p => p.poNumber === id);
  if (!pur) return;
  const currentPaid = pur.amountPaid || 0;
  const balanceDue = Math.max(0, (pur.totalAmount || 0) - currentPaid);

  document.getElementById('modalTitle').innerHTML = `<i class="fas fa-wallet" style="color:var(--gold)"></i> Record Outflow Remittance`;
  document.getElementById('modalBody').innerHTML = `
    <div style="background:var(--surface2); padding:12px; border-radius:var(--r-sm); border:1px solid var(--border); margin-bottom:16px; font-size:0.85rem;">
      <strong>PO Number:</strong> ${esc(pur.poNumber)} &nbsp;|&nbsp; <strong>Supplier:</strong> ${esc(pur.supplier)}<br>
      <strong>Total Order Amount:</strong> ₹${fmt(pur.totalAmount)} &nbsp;|&nbsp; <span style="color:var(--danger)"><strong>Remaining Debt:</strong> ₹${fmt(balanceDue)}</span>
    </div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Disbursement Date</label><input type="date" class="form-control" id="purPmtDate" value="${today()}"></div>
      <div class="form-group">
        <label class="form-label">Disbursement Mode</label>
        <select class="form-control" id="purPmtMode">
          <option value="Bank Transfer">Direct Corporate Bank Transfer</option>
          <option value="Cash">Cash Liquidity Withdrawal</option>
          <option value="UPI">Business UPI Account</option>
          <option value="Cheque">Issued Account Payee Cheque</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Amount Paid Out (₹)</label><input type="number" class="form-control" id="purPmtAmount" placeholder="0.00" min="0.01" step="0.01" value="${balanceDue.toFixed(2)}"></div>
    <div class="form-group"><label class="form-label">Bank Reference String / UTR Number</label><input type="text" class="form-control" id="purPmtNotes" placeholder="UTR tracking codes..."></div>
    <div style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="showPurchaseDetail('${esc(id)}')"><i class="fas fa-arrow-left"></i> Back to Detail</button>
      <button class="btn btn-primary" style="background:var(--gold); border-color:var(--gold);" id="confirmPurPmtBtn" onclick="submitPurchasePaymentForm('${esc(id)}')"><i class="fas fa-check-circle"></i> Save Remittance Record</button>
    </div>
  `;
}

async function submitPurchasePaymentForm(id) {
  const pur = purchasesArray.find(p => p.poNumber === id);
  if (!pur) return;
  const currentPaid = pur.amountPaid || 0;
  const balanceDue = (pur.totalAmount || 0) - currentPaid;
  const amtVal = parseFloat(document.getElementById('purPmtAmount').value) || 0;
  if (amtVal <= 0) { toast('Remittance values must scale over zero parameters.', 'error'); return; }
  if (amtVal > balanceDue) { toast('Remittance outflow values cannot exceed remaining debt volumes.', 'error'); return; }

  const btn = document.getElementById('confirmPurPmtBtn');
  setButtonLoading(btn, true, 'Saving...');
  pur.amountPaid = currentPaid + amtVal;
  pur.status = pur.amountPaid >= pur.totalAmount ? 'paid' : 'partial';

  const { error } = await supabase.from('purchases').update({ amountPaid: pur.amountPaid, status: pur.status }).eq('poNumber', id).eq('store_id', currentStoreId);
  setButtonLoading(btn, false, 'Save Remittance Record');
  if (error) { toast('Cloud sync failure.', 'error'); } else { toast('Vendor remittance recorded successfully!', 'success'); if (typeof syncUI === 'function') syncUI(); else renderPurchaseLists(); showPurchaseDetail(id); }
}

function printSavedPurchase(id) {
  const pur = purchasesArray.find(p => String(p.poNumber) === String(id));
  if (!pur) return;
  const printHtml = buildPurchaseHTML(bizProfile.printTemplate || 'tpl-standard', false, pur);
  const printWin = window.open('', '_blank');
  if (printWin) { printWin.document.write(printHtml); printWin.document.close(); }
  closeModal(); 
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
    purLineItems.push({ desc: it.product || it.desc, hsn: it.hsn || '', qty: it.quantity, cost: it.unitCost || it.cost, gstRate: it.gstRate });
  });

  renderPurchaseEditor(); closeModal(); switchTab('purchase');
  toast(`Loaded ${id} as a copy.`, 'success');
}

async function deletePurchase(id) {
  if (!confirm(`Permanently delete ${id}? Inventory logs will adjust backwards automatically.`)) return;
  const purToDelete = purchasesArray.find(p => p.poNumber === id);
  if (!purToDelete) return;
  purToDelete.items.forEach(oldIt => {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === (oldIt.product || oldIt.desc || '').toLowerCase());
    if (existing) existing.stock = (existing.stock || 0) - oldIt.quantity;
  });
  const idx = purchasesArray.findIndex(p => p.poNumber === id);
  if (idx > -1) purchasesArray.splice(idx, 1);
  closeModal(); if (typeof syncUI === 'function') syncUI(); else { renderPurchaseLists(); updateDashboard(); }
  await supabase.from('purchases').delete().eq('poNumber', id).eq('store_id', currentStoreId);
  toast('Purchase order purged.', 'success');
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

  const statusSelectEdit = document.getElementById('purStatusSelect');
  if (statusSelectEdit) statusSelectEdit.value = pur.status || 'unpaid';
  const amtInputEdit = document.getElementById('purAmountPaid');
  if (amtInputEdit) amtInputEdit.value = pur.status === 'partial' ? (pur.amountPaid || 0) : '';
  togglePurPaymentOption();

  purLineItems.length = 0;
  (pur.items || []).forEach(it => {
    purLineItems.push({ desc: it.product || it.desc, hsn: it.hsn || '', qty: it.quantity, cost: it.unitCost || it.cost, gstRate: it.gstRate });
  });

  renderPurchaseEditor(); closeModal(); switchTab('purchase'); checkSupplierAdvance();
  const tabNew = document.getElementById('tabNewPurchase');
  const tabEdit = document.getElementById('tabEditPurchase');
  if (tabNew) tabNew.style.display = 'none';
  if (tabEdit) { tabEdit.style.display = 'inline-block'; tabEdit.click(); }
  const formTitle = document.getElementById('purchaseFormTitle');
  if (formTitle) formTitle.innerHTML = `<i class="fas fa-edit" style="color:var(--gold)"></i> Editing Purchase Order ${id}`;
}

function openNewPurchaseForm() {
  clearPurchaseForm(true);
  const tabNew = document.getElementById('tabNewPurchase');
  const tabEdit = document.getElementById('tabEditPurchase');
  if (tabEdit) tabEdit.style.display = 'none';
  if (tabNew) { tabNew.style.display = 'inline-block'; tabNew.click(); }
}

function cancelPurchase() {
  if (confirm("Are you sure you want to close this purchase order? Any unsaved changes will be lost.")) {
    clearPurchaseForm(true);
    closePurchaseEditor();
  }
}

function closePurchaseEditor() {
  const tNew = document.getElementById('tabNewPurchase');
  const tEdit = document.getElementById('tabEditPurchase');
  if (tNew) tNew.style.display = 'none';
  if (tEdit) tEdit.style.display = 'none';
  const historyPane = document.getElementById('purchaseHistory');
  const newPane = document.getElementById('purchaseNew');
  if (historyPane) historyPane.style.display = 'block';
  if (newPane) newPane.style.display = 'none';
  document.querySelectorAll('#purchaseTabsBar .sec-tab').forEach(b => b.classList.remove('active'));
  const historyTabBtn = document.querySelector('#purchaseTabsBar .sec-tab[data-stab="purchaseHistory"]');
  if (historyTabBtn) historyTabBtn.classList.add('active');
  localStorage.setItem('bs_active_stab_purchasePane', 'purchaseHistory');
}

function processPurchase(action) {
  App.postSaveAction = action; 
  savePurchase();
}

// ─── TYPE OF VIEW STATE MANAGEMENT FOR PROCUREMENT PURCHASES ───
let purchaseViewMode = localStorage.getItem('bs_purchase_view_mode') || 'list';

function setPurchaseViewMode(mode) {
  purchaseViewMode = mode;
  localStorage.setItem('bs_purchase_view_mode', mode);
  
  document.getElementById('purViewListBtn')?.classList.toggle('active', mode === 'list');
  document.getElementById('purViewTableBtn')?.classList.toggle('active', mode === 'table');
  document.getElementById('purViewGridBtn')?.classList.toggle('active', mode === 'grid');
  
  filterPurchases();
}

// ─── RE-ENGINEERED RECORD STREAM FILTER ENGINE INCORPORATING SORT RULES ───
function filterPurchases() {
  const q = (document.getElementById('purchaseSearch')?.value || '').toLowerCase();
  const sort = document.getElementById('purchaseSortSelect')?.value || 'date-desc';
  
  // READ THE ACTIVE STATUS FILTER VALUE
  const status = document.getElementById('purActiveFilter')?.value || 'all';
  
  let filtered = purchasesArray.filter(p => {
    const matchesSearch = (p.poNumber || '').toLowerCase().includes(q) || 
                          (p.supplier || '').toLowerCase().includes(q) || 
                          (p.date || '').includes(q) || 
                          String(p.totalAmount || '').includes(q);
                          
    // MATCH DOCUMENT STATUS VALUES EXACTLY
    const matchesStatus = (status === 'all') || ((p.status || 'unpaid') === status);
    
    return matchesSearch && matchesStatus;
  });

  // INTEGRATED SORTING CONTROLLER LAYER
  filtered.sort((a, b) => {
    if (sort === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (sort === 'date-asc')  return new Date(a.date) - new Date(b.date);
    if (sort === 'amt-desc')  return (b.totalAmount || 0) - (a.totalAmount || 0);
    if (sort === 'amt-asc')   return (a.totalAmount || 0) - (b.totalAmount || 0);
    return 0;
  });

  const hist = document.getElementById('purchaseHistoryList');
  if (!hist) return;

  if (!filtered.length) {
    hist.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No results found</p></div>';
    return;
  }

  // RENDER SELECTION LAYOUT MODES CONTEXTUALLY
  if (purchaseViewMode === 'table') {
    hist.innerHTML = `
      <div class="table-responsive" style="background:var(--surface); border-radius:var(--r-md); border:1px solid var(--border); margin-top:12px; overflow-x:auto;">
        <table class="items-table" style="margin:0; width:100%">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Date</th>
              <th>Supplier / Vendor</th>
              <th style="text-align:right">Total Cost</th>
              <th style="text-align:center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(pur => `
              <tr onclick="showPurchaseDetail('${esc(pur.poNumber)}')" style="cursor:pointer;">
                <td style="font-weight:700; color:var(--accent);">${esc(pur.poNumber)}</td>
                <td>${dateLabel(pur.date)}</td>
                <td style="font-weight:500;">${esc(pur.supplier)}</td>
                <td style="text-align:right; font-weight:600;">${fmt(pur.totalAmount || pur.total)}</td>
                <td style="text-align:center;">${getStatusBadge(pur.status || 'unpaid')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } else if (purchaseViewMode === 'grid') {
    hist.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:16px; margin-top:12px;">
        ${filtered.map(pur => `
          <div class="card" onclick="showPurchaseDetail('${esc(pur.poNumber)}')" style="cursor:pointer; padding:16px; display:flex; flex-direction:column; gap:12px; border:1px solid var(--border); background:var(--surface2); margin:0;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:800; color:var(--accent); font-size:1rem;">${esc(pur.poNumber)}</span>
              ${getStatusBadge(pur.status || 'unpaid')}
            </div>
            <div>
              <div style="font-weight:600; font-size:0.9rem; margin-bottom:2px;">${esc(pur.supplier)}</div>
              <div style="font-size:0.75rem; color:var(--ink3);"><i class="fas fa-calendar-alt"></i> ${dateLabel(pur.date)}</div>
            </div>
            <div style="margin-top:auto; padding-top:10px; border-top:1px dashed var(--border); display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.75rem; color:var(--ink3);">Order Valuation</span>
              <span style="font-weight:700; font-size:1rem; color:var(--ink);">${fmt(pur.totalAmount || pur.total)}</span>
            </div>
          </div>
        `).join('')}
      </div>`;
  } else {
    hist.innerHTML = filtered.map(pur => `
      <div class="list-item" onclick="showPurchaseDetail('${esc(pur.poNumber)}')">
        <div>
          <div class="list-item-title">${esc(pur.poNumber)}</div>
          <div class="list-item-sub">${esc(pur.supplier)} · ${dateLabel(pur.date)}</div>
        </div>
        <div style="text-align:right">
          <div class="list-item-amount">${fmt(pur.totalAmount || pur.total)}</div>
          ${getStatusBadge(pur.status || 'unpaid')}
        </div>
      </div>
    `).join('');
  }
}

// Append this configuration to the initialization thread near the bottom of purchase.js
setTimeout(() => {
  if (localStorage.getItem('bs_purchase_view_mode')) {
    setPurchaseViewMode(localStorage.getItem('bs_purchase_view_mode'));
  }
  
  document.getElementById('supplierName')?.addEventListener('input', calcPurchaseTotals);
  document.getElementById('supplierName')?.addEventListener('change', calcPurchaseTotals);
}, 750);

// Added responsive event listeners to re-compute calculation matrixes on live updates
setTimeout(() => {
  document.getElementById('supplierName')?.addEventListener('input', checkSupplierAdvance);
  document.getElementById('supplierName')?.addEventListener('change', checkSupplierAdvance);
  
  document.getElementById('supplierName')?.addEventListener('input', calcPurchaseTotals);
  document.getElementById('supplierName')?.addEventListener('change', calcPurchaseTotals);
}, 600);

// ─── STATUS FILTER STATE MANAGER FOR PURCHASES ───
function setPurFilter(status, btn) {
  // Clear active styling from all sibling purchase filter chips
  document.querySelectorAll('#purchaseHistory .filter-chip').forEach(b => b.classList.remove('active'));
  
  // Apply active styling to the clicked button chip
  btn.classList.add('active');
  
  // Save the selected status filter to the hidden element input field
  const inputFilter = document.getElementById('purActiveFilter');
  if (inputFilter) inputFilter.value = status;
  
  // Re-run the filter loop to update view presentation matrices
  filterPurchases();
}