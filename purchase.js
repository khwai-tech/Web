// ─── PURCHASE EDITOR (FULLY REPAIRED + DISCOUNT FEATURE) ─────────────────────

App.appliedSupplierAdvanceAmount = 0;

// ─── SHARED TOTALS HELPER (single source of truth, mirrors _computeInvoiceTotals) ───
function _computePurchaseTotals() {
  let sub = 0, gstTotal = 0, grand = 0;
  const currentGstType = typeof purGstType !== 'undefined' ? purGstType : 'Exclusive';
  purLineItems.forEach(it => {
    const r = calcGST(it.qty * it.cost, it.gstRate, currentGstType);
    sub      += r.subtotalPart;
    gstTotal += r.gst;
    grand    += r.total;
  });
  // FIX: Read discount the same way invoice.js does
  const discVal = parseFloat(document.getElementById('purDiscountVal')?.value) || 0;
  const discount = (typeof purDiscType !== 'undefined' && purDiscType === 'pct')
    ? grand * (discVal / 100)
    : Math.min(discVal, grand);
  grand -= discount;
  return { sub, gstTotal, grand, discount };
}

function renderPurchaseEditor() {
  const body = document.getElementById('purchaseItemsBody');
  if (!body) return;

  // ─── Remember cursor focus ───
  const activeId = document.activeElement ? document.activeElement.id : null;

  if (purLineItems.length > 0 && purLineItems[0].hsn === undefined) {
    purLineItems.forEach(i => i.hsn = '');
  }

  const currentGstType = typeof purGstType !== 'undefined' ? purGstType : 'Exclusive';

  body.innerHTML = purLineItems.map((it, i) => {
    const { gst, total } = typeof calcGST === 'function'
      ? calcGST(it.qty * it.cost, it.gstRate, currentGstType)
      : { gst: 0, total: it.qty * it.cost };

    return `<tr>
      <td><input id="pur_inp_${i}_desc" class="item-input pur-field form-control" data-i="${i}" data-f="desc" value="${esc(it.desc)}" placeholder="Add Item" list="productList"></td>
      <td><input id="pur_inp_${i}_hsn" class="item-input pur-field form-control" data-i="${i}" data-f="hsn" value="${esc(it.hsn || '')}" placeholder="HSN" style="width:80px; font-size:0.8rem"></td>
      <td><input id="pur_inp_${i}_qty" class="item-input pur-field form-control" data-i="${i}" data-f="qty" type="number" value="${it.qty}" min="0.01" step="0.01" style="width:70px"></td>
      <td><input id="pur_inp_${i}_cost" class="item-input pur-field form-control" data-i="${i}" data-f="cost" type="number" value="${it.cost}" min="0" step="0.01" style="width:100px"></td>
      <td class="no-print">
        <select id="pur_inp_${i}_gst" class="gst-select-inline pur-gst-select" data-i="${i}">
          <option value="0"    ${it.gstRate === 0    ? 'selected' : ''}>0%</option>
          <option value="0.05" ${it.gstRate === 0.05 ? 'selected' : ''}>5%</option>
          <option value="0.12" ${it.gstRate === 0.12 ? 'selected' : ''}>12%</option>
          <option value="0.18" ${it.gstRate === 0.18 ? 'selected' : ''}>18%</option>
          <option value="0.28" ${it.gstRate === 0.28 ? 'selected' : ''}>28%</option>
        </select>
      </td>
      <td style="color:var(--gold);font-weight:500; vertical-align:middle; text-align:right;">₹${fmt(gst)}</td>
      <td style="font-weight:600;color:var(--accent); vertical-align:middle; text-align:right;">₹${fmt(total)}</td>
      <td class="no-print" style="vertical-align:middle; text-align:center;"><button id="pur_btn_${i}_del" class="btn-icon rem-pur-item" data-i="${i}" title="Remove item" style="color:var(--danger)"><i class="fas fa-trash-alt"></i></button></td>
    </tr>`;
  }).join('');

  // Text & Number field listeners
  body.querySelectorAll('.pur-field').forEach(inp => {
    inp.addEventListener('change', () => {
      const i = +inp.dataset.i, f = inp.dataset.f;
      if (!purLineItems[i]) return;
      if (f === 'qty' || f === 'cost') {
        purLineItems[i][f] = parseFloat(inp.value) || 0;
      } else {
        purLineItems[i][f] = inp.value;
        // Enhanced auto-fill: match by name OR product ID
        if (f === 'desc' && typeof inventoryStock !== 'undefined') {
          const searchVal = inp.value.trim().toLowerCase();
          const match = inventoryStock.find(p =>
            (p.name && p.name.toLowerCase() === searchVal) ||
            (p.id   && p.id.toLowerCase()   === searchVal)
          );
          if (match) {
            purLineItems[i].cost    = parseFloat(match.costPrice || match.cost_price || match.price || 0);
            purLineItems[i].gstRate = parseFloat(match.gstRate   || match.gst_rate  || 0);
            purLineItems[i].hsn     = match.hsn || '';
          }
        }
      }
      renderPurchaseEditor();
    });
  });

  // GST dropdown listeners
  body.querySelectorAll('.pur-gst-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const i = +sel.dataset.i;
      if (purLineItems[i]) { purLineItems[i].gstRate = parseFloat(sel.value); renderPurchaseEditor(); }
    });
  });

  // Delete row listeners
  body.querySelectorAll('.rem-pur-item').forEach(btn => {
    btn.addEventListener('click', () => { purLineItems.splice(+btn.dataset.i, 1); renderPurchaseEditor(); });
  });

  calcPurchaseTotals();

  // ─── Restore cursor focus ───
  if (activeId) {
    const elToFocus = document.getElementById(activeId);
    if (elToFocus) elToFocus.focus();
  }
}

function calcPurchaseTotals() {
  if (typeof window.App === 'undefined') window.App = {};

  const { sub, gstTotal, grand, discount } = _computePurchaseTotals();

  // Subtotal
  const subEl = document.getElementById('purSubtotalVal');
  if (subEl) subEl.textContent = `₹${fmt(sub)}`;

  // Discount display
  const discEl = document.getElementById('purDiscountDisplay');
  if (discEl) discEl.textContent = `– ₹${fmt(discount)}`;

  // Net payable after advance
  const appliedAdvance = window.App.appliedSupplierAdvanceAmount || 0;
  const netPayable = Math.max(0, grand - appliedAdvance);
  const totalEl = document.getElementById('purchaseTotalSpan');
  if (totalEl) totalEl.textContent = `₹${fmt(netPayable)}`;

  // ─── GST type detection (intra/inter) ───
  const myGstin = (typeof bizProfile !== 'undefined' && bizProfile.gstin)
  ? String(bizProfile.gstin).trim() : '';

  const myStateCode = myGstin.length >= 2
  ? myGstin.substring(0, 2)
  : (typeof bizProfile !== 'undefined' && bizProfile.state ? String(bizProfile.state).trim() : '');

  let supplierGstin = document.getElementById('supplierGstin')?.value.trim().toUpperCase() || '';
  if (!supplierGstin) {
    const supplierName = document.getElementById('supplierName')?.value.trim() || '';
    const matchedSupplier = typeof suppliersArray !== 'undefined'
      ? suppliersArray.find(s => s.name.toLowerCase() === supplierName.toLowerCase())
      : null;
    supplierGstin = matchedSupplier ? (matchedSupplier.gstin || '') : '';
  }

  const supplierStateCode = supplierGstin.substring(0, 2);
  let calculatedSupplyType = 'intra';
  if (supplierStateCode && myStateCode && supplierStateCode !== myStateCode) {
    calculatedSupplyType = 'inter';
  }
  App.currentPurchaseSupplyType = calculatedSupplyType;

  const supplySelect = document.getElementById('purSupplyTypeSelect');
  if (supplySelect && supplierStateCode && myStateCode) supplySelect.value = calculatedSupplyType;

  const taxLabel = document.getElementById('purTaxLabel');
  const taxVal   = document.getElementById('purTaxVal');
  const gstLabel = typeof purGstType !== 'undefined' ? purGstType : 'Exclusive';

  if (taxLabel && taxVal) {
    if (calculatedSupplyType === 'intra') {
      const splitTax = gstTotal / 2;
      taxLabel.innerHTML = `CGST (${gstLabel})<br>SGST (${gstLabel})`;
      taxVal.innerHTML   = `₹${fmt(splitTax)}<br>₹${fmt(splitTax)}`;
    } else {
      taxLabel.innerHTML = `IGST (${gstLabel})`;
      taxVal.innerHTML   = `₹${fmt(gstTotal)}`;
    }
  }
}

function setPurGstType(type) {
  purGstType = type;
  document.getElementById('purGstExcBtn')?.classList.toggle('active', type === 'Exclusive');
  document.getElementById('purGstIncBtn')?.classList.toggle('active', type === 'Inclusive');
  renderPurchaseEditor();
}

// ─── DISCOUNT TYPE TOGGLE (mirrors invoice.js setDiscType) ───
let purDiscType = 'flat';

function setPurDiscType(type) {
  purDiscType = type;
  document.getElementById('purDiscFlat')?.classList.toggle('active', type === 'flat');
  document.getElementById('purDiscPct')?.classList.toggle('active',  type === 'pct');
  calcPurchaseTotals();
}

function togglePurPaymentOption() {
  const status = document.getElementById('purStatusSelect')?.value;
  const amtGroup = document.getElementById('purAmountPaidGroup');
  if (amtGroup) amtGroup.style.display = (status === 'partial') ? 'block' : 'none';
}

// ─── DYNAMIC SUPPLIER ADVANCE CHECK STRIP ───
function checkSupplierAdvance() {
  const name = document.getElementById('supplierName')?.value.trim();
  let banner = document.getElementById('supplierAdvanceBanner');

  if (!name) {
    if (banner) banner.style.display = 'none';
    // FIX: Reset only the purchase advance, not the invoice advance
    App.appliedSupplierAdvanceAmount = 0;
    calcPurchaseTotals();
    return;
  }

  const s = typeof suppliersArray !== 'undefined'
    ? suppliersArray.find(x => x.name.toLowerCase() === name.toLowerCase())
    : null;

  if (s && parseFloat(s.advanceBalance || 0) > 0) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'supplierAdvanceBanner';
      banner.style.cssText = 'background:var(--gold-light); color:var(--gold); padding:10px 14px; border-radius:var(--r-sm); margin-top:6px; font-size:0.85rem; font-weight:600; display:flex; justify-content:space-between; align-items:center; border:1px solid var(--gold); grid-column:1/-1;';
      document.getElementById('supplierName').parentNode.appendChild(banner);
    }
    const isApplied = App.appliedSupplierAdvanceAmount > 0;
    banner.style.display = 'flex';
    banner.innerHTML = `
      <span><i class="fas fa-info-circle"></i> Vendor has <strong>₹${fmt(s.advanceBalance)}</strong> Advance Remittance float.</span>
      <button class="btn btn-sm" style="background:var(--gold); color:#fff; padding:2px 10px; font-size:0.75rem;" onclick="applySupplierAdvanceCredit(${s.advanceBalance})">
        ${isApplied ? 'Credit Applied ✓' : 'Deduct From Advance'}
      </button>
    `;
  } else {
    if (banner) banner.style.display = 'none';
    // FIX: Only reset supplier advance, not invoice advance
    App.appliedSupplierAdvanceAmount = 0;
    calcPurchaseTotals();
  }
}

// FIX: Use _computePurchaseTotals() instead of re-computing inline
function applySupplierAdvanceCredit(availableBalance) {
  const { grand } = _computePurchaseTotals();
  const applyAmount = Math.min(availableBalance, grand);
  App.appliedSupplierAdvanceAmount = applyAmount;
  toast(`Subtracted ₹${fmt(applyAmount)} from vendor advance balance pool.`, 'success');
  calcPurchaseTotals();
  checkSupplierAdvance();
}

// ─── SAVE PURCHASE ───
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

  // FIX: Use shared helper for consistent totals (includes discount)
  const { sub, gstTotal, grand, discount } = _computePurchaseTotals();

  const statusSelect = document.getElementById('purStatusSelect');
  let status = statusSelect ? statusSelect.value : 'unpaid';
  let amountPaid = 0;

  const appliedAdvance = App.appliedSupplierAdvanceAmount || 0;

  if (status === 'paid') {
    amountPaid = grand;
  } else if (status === 'partial') {
    // FIX: Start with manual partial payment, then add advance on top (don't overwrite)
    amountPaid = parseFloat(document.getElementById('purAmountPaid')?.value) || 0;
    if (appliedAdvance > 0) amountPaid = Math.min(grand, amountPaid + appliedAdvance);
    if (amountPaid >= grand) { status = 'paid';   if (statusSelect) statusSelect.value = 'paid'; }
    else if (amountPaid <= 0) { status = 'unpaid'; if (statusSelect) statusSelect.value = 'unpaid'; }
  } else {
    // unpaid — advance still reduces what's owed
    if (appliedAdvance > 0) {
      amountPaid = Math.min(grand, appliedAdvance);
      status = amountPaid >= grand ? 'paid' : 'partial';
    } else {
      amountPaid = 0;
    }
  }

  const supplierGstin = document.getElementById('supplierGstin')
    ? document.getElementById('supplierGstin').value.trim().toUpperCase() : '';

  const payload = {
    poNumber:      poId,
    store_id:      currentStoreId,
    date:          document.getElementById('purchaseDate').value,
    supplier:      document.getElementById('supplierName').value,
    supplierGstin: supplierGstin,
    gstType:       purGstType,
    supplyType:    App.currentPurchaseSupplyType || 'intra',
    discount:      discount,
    items:         purLineItems.map(i => ({
                     product:  i.desc,
                     hsn:      i.hsn || '',
                     quantity: parseFloat(i.qty),
                     unitCost: parseFloat(i.cost),
                     gstRate:  i.gstRate
                   })),
    subtotal:    sub,
    gstAmount:   gstTotal,
    totalAmount: grand,
    status:      status,
    amountPaid:  amountPaid
  };

  App.isSaving = true;
  const saveBtn = document.getElementById('savePurchaseBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

  // Deduct supplier advance balance from DB
  if (appliedAdvance > 0) {
    const s = suppliersArray.find(x => x.name.toLowerCase() === payload.supplier.toLowerCase());
    if (s) {
      s.advanceBalance = Math.max(0, (s.advanceBalance || 0) - appliedAdvance);
      await supabase.from('suppliers').update({ advanceBalance: s.advanceBalance }).eq('id', s.id).eq('store_id', currentStoreId);
    }
  }

  // FIX: Reverse old stock before re-applying (edit flow)
  if (isEditing) {
    const oldPur = purchasesArray.find(p => p.poNumber === poId);
    if (oldPur) {
      for (let oldIt of (oldPur.items || [])) {
        const existing = inventoryStock.find(p =>
          p.name.toLowerCase() === (oldIt.product || oldIt.desc || '').toLowerCase()
        );
        if (existing) {
          existing.stock = (existing.stock || 0) - parseFloat(oldIt.quantity || 0);
          await supabase.from('inventory').update({ stock: existing.stock }).eq('id', existing.id).eq('store_id', currentStoreId);
        }
      }
    }
    purchasesArray = purchasesArray.filter(p => p.poNumber !== poId);
    App.editingPurchaseId = null;
  }

  // Calculate sell price multiplier once
  const sMargin = (typeof bizProfile !== 'undefined' && bizProfile.sellingMargin)
    ? parseFloat(bizProfile.sellingMargin) : 40;
  const sellMultiplier = (100 + sMargin) / 100;

  for (let it of purLineItems) {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === it.desc.toLowerCase());
    if (existing) {
      existing.stock     = (existing.stock || 0) + parseFloat(it.qty || 0);
      existing.costPrice = parseFloat(it.cost || 0);
      existing.cost_price = existing.costPrice;
      await supabase.from('inventory').update({
        stock:      existing.stock,
        cost_price: existing.cost_price
      }).eq('id', existing.id).eq('store_id', currentStoreId);
    } else {
      const safeId      = getNextId('product') || ('PROD-' + Date.now().toString().slice(-6));
      const costPrice   = parseFloat(it.cost || 0);
      const dynamicSell = costPrice * sellMultiplier;
      const newProd = {
        id: safeId, store_id: currentStoreId,
        name: it.desc, hsn: it.hsn || '',
        sell_price: dynamicSell, cost_price: costPrice,
        gst_rate: parseFloat(it.gstRate || 0),
        stock: parseFloat(it.qty || 0),
        type: 'Goods', status: 'Active', category: 'General', unit: 'PCS', barcode: ''
      };
      inventoryStock.push(newProd);
      await supabase.from('inventory').insert([newProd]);
    }
  }

  // Auto-create supplier if new
  const supplierName = document.getElementById('supplierName').value.trim();
  if (typeof suppliersArray !== 'undefined' &&
      !suppliersArray.find(s => s.name.toLowerCase() === supplierName.toLowerCase())) {
    const newSupp = {
      id: 'SUPP-' + Date.now().toString().slice(-5),
      store_id: currentStoreId, name: supplierName,
      phone: '', address: '', payment_terms: '',
      gstin: supplierGstin, advanceBalance: 0
    };
    suppliersArray.push(newSupp);
    await supabase.from('suppliers').insert([newSupp]);
  }

  purchasesArray.unshift({ ...payload, created_at: new Date().toISOString() });
  if (typeof syncUI === 'function') syncUI();
  else { renderPurchaseLists(); if (typeof updateDatalists === 'function') updateDatalists(); }

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
    } else if (App.postSaveAction === 'print') {
      const printHtml = typeof buildPurchaseHTML === 'function'
        ? buildPurchaseHTML(bizProfile.printTemplate || 'tpl-standard', false, payload) : '';
      const printWin = window.open('', '_blank');
      if (printWin && printHtml) { printWin.document.write(printHtml); printWin.document.close(); }
      App.editingPurchaseId = payload.poNumber;
      const tEdit = document.getElementById('tabEditPurchase');
      if (tEdit) { tEdit.style.display = 'inline-flex'; tEdit.textContent = `Editing: ${poId}`; }
      toast(`Purchase Order ${poId} saved & printing...`, 'success');
    } else if (App.postSaveAction === 'save') {
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

  ['supplierName', 'supplierGstin'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });

  // Discount reset
  const purDiscVal = document.getElementById('purDiscountVal');
  if (purDiscVal) purDiscVal.value = '';
  purDiscType = 'flat';
  document.getElementById('purDiscFlat')?.classList.add('active');
  document.getElementById('purDiscPct')?.classList.remove('active');

  App.editingPurchaseId          = null;
  // FIX: Only reset the supplier advance — do NOT touch App.appliedAdvanceAmount (invoice)
  App.appliedSupplierAdvanceAmount = 0;
  App.currentPurchaseSupplyType   = 'intra';

  const banner = document.getElementById('supplierAdvanceBanner');
  if (banner) banner.style.display = 'none';

  const supplySelect = document.getElementById('purSupplyTypeSelect');
  if (supplySelect) supplySelect.value = 'intra';

  const statusSelect = document.getElementById('purStatusSelect');
  if (statusSelect) statusSelect.value = 'unpaid';

  const amtInput = document.getElementById('purAmountPaid');
  if (amtInput) amtInput.value = '';
  togglePurPaymentOption();

  const poNum = document.getElementById('poNumber');
  if (poNum) {
    const nextId = getNextId('purchase');
    poNum.value            = nextId || '';
    poNum.readOnly         = false;
    poNum.style.backgroundColor = '';
  }

  const purDate = document.getElementById('purchaseDate');
  if (purDate) purDate.value = today();

  renderPurchaseEditor();

  const formTitle = document.getElementById('purchaseFormTitle');
  if (formTitle) formTitle.innerHTML = `<i class="fas fa-plus-circle"></i> Create New Purchase Order`;
}

function renderPurchaseLists() {
  const recent = purchasesArray.slice(0, 4);
  const emptyHTML = '<div class="empty-state"><i class="fas fa-truck"></i><p>No purchases yet</p></div>';
  const makeItem = pur => `
    <div class="list-item" onclick="showPurchaseDetail('${esc(pur.poNumber)}')">
      <div>
        <div class="list-item-title">${esc(pur.poNumber)}</div>
        <div class="list-item-sub">${esc(pur.supplier)} · ${typeof dateLabel === 'function' ? dateLabel(pur.date) : pur.date}</div>
      </div>
      <div style="text-align:right">
        <div class="list-item-amount">${fmt(pur.totalAmount)}</div>
        ${typeof getStatusBadge === 'function' ? getStatusBadge(pur.status || 'unpaid') : `<span class="badge">${pur.status}</span>`}
      </div>
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
  const due  = Math.max(0, (pur.totalAmount || 0) - paid);
  const isInter = (pur.supplyType === 'inter');
  const gstTypeForCalc = pur.gstType || 'Exclusive';

  document.getElementById('modalTitle').textContent = `${pur.poNumber} — ${pur.supplier}`;
  document.getElementById('modalBody').innerHTML = `
    <div style="font-size:0.85rem;margin-bottom:12px;color:var(--ink2)">
      <strong>Date:</strong> ${dateLabel(pur.date)} &nbsp;|&nbsp;
      <strong>Supplier:</strong> ${esc(pur.supplier)} &nbsp;|&nbsp;
      <strong>GSTIN:</strong> ${esc(pur.supplierGstin || 'N/A')} &nbsp;|&nbsp;
      <strong>Supply Type:</strong> ${isInter
        ? '<span style="color:var(--gold);font-weight:600">Inter-state (IGST)</span>'
        : 'Intra-state (CGST+SGST)'}
    </div>
    <div class="items-table-wrap">
      <table class="items-table">
        <thead><tr><th>Product</th><th>HSN</th><th>Qty</th><th>Unit Cost</th><th>GST%</th><th>Total</th></tr></thead>
        <tbody>
          ${(pur.items || []).map(it => {
            const qty   = parseFloat(it.quantity || it.qty || 0);
            const cost  = parseFloat(it.unitCost  || it.cost  || 0);
            const rate  = parseFloat(it.gstRate   || 0);
            // FIX: Use calcGST for correct inclusive/exclusive total display
            const { total } = calcGST(qty * cost, rate, gstTypeForCalc);
            return `<tr>
              <td>${esc(it.product || it.desc)}</td>
              <td>${esc(it.hsn || '')}</td>
              <td>${qty}</td>
              <td>${fmt(cost)}</td>
              <td>${(rate * 100).toFixed(0)}%</td>
              <td>${fmt(total)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="totals-box" style="margin-top:12px">
      <div class="totals-row"><span>Subtotal (Base)</span><span>₹${fmt(pur.subtotal)}</span></div>
      ${isInter
        ? `<div class="totals-row"><span>IGST Total</span><span>₹${fmt(pur.gstAmount)}</span></div>`
        : `<div class="totals-row"><span>CGST</span><span>₹${fmt(pur.gstAmount / 2)}</span></div>
           <div class="totals-row"><span>SGST</span><span>₹${fmt(pur.gstAmount / 2)}</span></div>`
      }
      ${pur.discount ? `<div class="totals-row discount-row"><span>Discount</span><span>– ₹${fmt(pur.discount)}</span></div>` : ''}
      <div class="totals-row"><span>Total Amount</span><span>₹${fmt(pur.totalAmount)}</span></div>
      <div class="totals-row" style="color:var(--accent2)"><span>Amount Disbursed</span><span>₹${fmt(paid)}</span></div>
      <div class="totals-row grand"><span>Remaining Debt</span>
        <span style="color:${due > 0 ? 'var(--danger)' : 'var(--ink)'}">₹${fmt(due)}</span>
      </div>
    </div>
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      ${due > 0
        ? `<button class="btn btn-primary btn-sm" onclick="recordPurchasePayment('${esc(id)}')"><i class="fas fa-wallet"></i> Record Remittance</button>`
        : `<span class="badge badge-green"><i class="fas fa-check-circle"></i> Fully Cleared</span>`}
      <button class="btn btn-secondary btn-sm" onclick="loadEditPurchase('${esc(id)}')"><i class="fas fa-edit"></i> Edit</button>
      <button class="btn btn-gold btn-sm"      onclick="printSavedPurchase('${esc(id)}')"><i class="fas fa-print"></i> Print</button>
      <button class="btn btn-info btn-sm"      onclick="duplicatePurchase('${esc(id)}')"><i class="fas fa-copy"></i> Duplicate</button>
      <button class="btn btn-danger btn-sm"    onclick="deletePurchase('${esc(id)}')"><i class="fas fa-trash"></i> Delete</button>
    </div>`;
  document.getElementById('detailModal').classList.add('open');
}

function recordPurchasePayment(id) {
  const pur = purchasesArray.find(p => p.poNumber === id);
  if (!pur) return;
  const currentPaid = pur.amountPaid || 0;
  const balanceDue  = Math.max(0, (pur.totalAmount || 0) - currentPaid);

  document.getElementById('modalTitle').innerHTML = `<i class="fas fa-wallet" style="color:var(--gold)"></i> Record Outflow Remittance`;
  document.getElementById('modalBody').innerHTML = `
    <div style="background:var(--surface2); padding:12px; border-radius:var(--r-sm); border:1px solid var(--border); margin-bottom:16px; font-size:0.85rem;">
      <strong>PO Number:</strong> ${esc(pur.poNumber)} &nbsp;|&nbsp; <strong>Supplier:</strong> ${esc(pur.supplier)}<br>
      <strong>Total Order Amount:</strong> ₹${fmt(pur.totalAmount)} &nbsp;|&nbsp;
      <span style="color:var(--danger)"><strong>Remaining Debt:</strong> ₹${fmt(balanceDue)}</span>
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
    <div class="form-group"><label class="form-label">Amount Paid Out (₹)</label>
      <input type="number" class="form-control" id="purPmtAmount" placeholder="0.00" min="0.01" step="0.01" value="${balanceDue.toFixed(2)}">
    </div>
    <div class="form-group"><label class="form-label">Bank Reference / UTR Number</label>
      <input type="text" class="form-control" id="purPmtNotes" placeholder="UTR tracking codes...">
    </div>
    <div style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="showPurchaseDetail('${esc(id)}')"><i class="fas fa-arrow-left"></i> Back to Detail</button>
      <button class="btn btn-primary" style="background:var(--gold); border-color:var(--gold);" id="confirmPurPmtBtn" onclick="submitPurchasePaymentForm('${esc(id)}')">
        <i class="fas fa-check-circle"></i> Save Remittance Record
      </button>
    </div>`;
}

async function submitPurchasePaymentForm(id) {
  const pur = purchasesArray.find(p => p.poNumber === id);
  if (!pur) return;
  const currentPaid = pur.amountPaid || 0;
  const balanceDue  = (pur.totalAmount || 0) - currentPaid;
  const amtVal = parseFloat(document.getElementById('purPmtAmount').value) || 0;
  if (amtVal <= 0) { toast('Remittance values must be greater than zero.', 'error'); return; }
  if (amtVal > balanceDue) { toast('Remittance cannot exceed remaining debt.', 'error'); return; }

  const btn = document.getElementById('confirmPurPmtBtn');
  setButtonLoading(btn, true, 'Saving...');

  const newAmountPaid = currentPaid + amtVal;
  const newStatus = newAmountPaid >= pur.totalAmount ? 'paid' : 'partial';

  // FIX: Update Supabase first, then mutate local array by reference (safe pattern)
  const { error } = await supabase.from('purchases')
    .update({ amountPaid: newAmountPaid, status: newStatus })
    .eq('poNumber', id).eq('store_id', currentStoreId);

  setButtonLoading(btn, false, 'Save Remittance Record');

  if (error) {
    toast('Cloud sync failure.', 'error');
  } else {
    // FIX: Update local array safely via index (same pattern as invoice.js fix)
    const idx = purchasesArray.findIndex(p => p.poNumber === id);
    if (idx > -1) {
      purchasesArray[idx].amountPaid = newAmountPaid;
      purchasesArray[idx].status     = newStatus;
    }
    toast('Vendor remittance recorded successfully!', 'success');
    if (typeof syncUI === 'function') syncUI(); else renderPurchaseLists();
    showPurchaseDetail(id);
  }
}

function printSavedPurchase(id) {
  const pur = purchasesArray.find(p => String(p.poNumber) === String(id));
  if (!pur) return;
  const printHtml = typeof buildPurchaseHTML === 'function'
    ? buildPurchaseHTML(bizProfile.printTemplate || 'tpl-standard', false, pur) : '';
  const printWin = window.open('', '_blank');
  if (printWin) { printWin.document.write(printHtml); printWin.document.close(); }
  closeModal();
}

function duplicatePurchase(id) {
  const pur = purchasesArray.find(p => p.poNumber === id);
  if (!pur) return;
  App.editingPurchaseId = null;
  const nextId = getNextId('purchase');
  document.getElementById('poNumber').value = nextId || '';
  document.getElementById('poNumber').readOnly = false;
  document.getElementById('poNumber').style.backgroundColor = '';
  document.getElementById('purchaseDate').value = today();
  document.getElementById('supplierName').value = pur.supplier;
  document.getElementById('supplierGstin').value = pur.supplierGstin || '';

  // Restore discount value only (type is session-only, not saved)
  const purDiscValEl = document.getElementById('purDiscountVal');
  if (purDiscValEl) purDiscValEl.value = pur.discount || 0;

  if (typeof setPurGstType === 'function') setPurGstType(pur.gstType || 'Exclusive');

  purLineItems.length = 0;
  (pur.items || []).forEach(it => {
    purLineItems.push({ desc: it.product || it.desc, hsn: it.hsn || '', qty: it.quantity, cost: it.unitCost || it.cost, gstRate: it.gstRate });
  });

  renderPurchaseEditor(); closeModal(); switchTab('purchase');
  toast(`Loaded ${esc(id)} as a copy.`, 'success');
}

async function deletePurchase(id) {
  if (!confirm(`Permanently delete ${id}? Inventory counts will adjust backwards automatically.`)) return;

  const purToDelete = purchasesArray.find(p => p.poNumber === id);
  if (!purToDelete) return;

  for (let oldIt of (purToDelete.items || [])) {
    const itemName = (oldIt.product || oldIt.desc || '').toLowerCase();
    const existing = inventoryStock.find(p =>
      (oldIt.itemId && p.id === oldIt.itemId) ||
      (p.name && p.name.toLowerCase() === itemName)
    );
    if (existing) {
      existing.stock = (existing.stock || 0) - parseFloat(oldIt.quantity || oldIt.qty || 0);
      const { error: invErr } = await supabase.from('inventory')
        .update({ stock: existing.stock })
        .eq('id', existing.id).eq('store_id', currentStoreId);
      if (invErr) console.error(`Failed to adjust stock for ${existing.name}:`, invErr);
    }
  }

  purchasesArray = purchasesArray.filter(p => p.poNumber !== id);

  const { error: delErr } = await supabase.from('purchases')
    .delete().eq('poNumber', id).eq('store_id', currentStoreId);

  if (delErr) {
    console.error('Failed to delete PO from DB:', delErr);
    toast('Error deleting PO from database.', 'error');
    return;
  }

  closeModal();
  if (typeof syncUI === 'function') syncUI();
  else {
    if (typeof renderPurchaseLists === 'function') renderPurchaseLists();
    if (typeof updateDashboard === 'function') updateDashboard();
  }
  toast('Purchase order purged and inventory adjusted backwards.', 'success');
}

function loadEditPurchase(id) {
  const pur = purchasesArray.find(p => p.poNumber === id);
  if (!pur) return;
  App.editingPurchaseId = id;

  document.getElementById('poNumber').value = pur.poNumber;
  document.getElementById('poNumber').readOnly = true;
  document.getElementById('poNumber').style.backgroundColor = 'var(--surface2)';

  let dStr = '';
  try {
    if (pur.date) {
      const d = new Date(pur.date);
      if (!isNaN(d)) dStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }
  } catch(e) {}
  document.getElementById('purchaseDate').value = dStr || today();
  document.getElementById('supplierName').value  = pur.supplier;
  document.getElementById('supplierGstin').value = pur.supplierGstin || '';

  // Restore discount value only (type is session-only, not saved)
  const purDiscValEl = document.getElementById('purDiscountVal');
  if (purDiscValEl) purDiscValEl.value = pur.discount || 0;

  if (typeof setPurGstType === 'function') setPurGstType(pur.gstType || 'Exclusive');

  const statusSelectEdit = document.getElementById('purStatusSelect');
  if (statusSelectEdit) statusSelectEdit.value = pur.status || 'unpaid';

  const supplySelect = document.getElementById('purSupplyTypeSelect');
  if (supplySelect) supplySelect.value = pur.supplyType || 'intra';
  App.currentPurchaseSupplyType = pur.supplyType || 'intra';

  const amtInputEdit = document.getElementById('purAmountPaid');
  if (amtInputEdit) amtInputEdit.value = pur.status === 'partial' ? (pur.amountPaid || 0) : '';
  togglePurPaymentOption();

  purLineItems.length = 0;
  (pur.items || []).forEach(it => {
    purLineItems.push({ desc: it.product || it.desc, hsn: it.hsn || '', qty: it.quantity, cost: it.unitCost || it.cost, gstRate: it.gstRate });
  });

  renderPurchaseEditor(); closeModal(); switchTab('purchase'); checkSupplierAdvance();

  const tabNew  = document.getElementById('tabNewPurchase');
  const tabEdit = document.getElementById('tabEditPurchase');
  if (tabNew)  tabNew.style.display  = 'none';
  if (tabEdit) { tabEdit.style.display = 'inline-block'; tabEdit.click(); }

  const formTitle = document.getElementById('purchaseFormTitle');
  if (formTitle) formTitle.innerHTML = `<i class="fas fa-edit" style="color:var(--gold)"></i> Editing Purchase Order ${id}`;
}

function openNewPurchaseForm() {
  if (typeof clearPurchaseForm === 'function') clearPurchaseForm(true);
  purLineItems = [];
  purLineItems.push({ desc: '', hsn: '', qty: 1, cost: 0, gstRate: 0 });

  const tabNew  = document.getElementById('tabNewPurchase');
  const tabEdit = document.getElementById('tabEditPurchase');
  if (tabEdit) tabEdit.style.display = 'none';
  if (tabNew)  { tabNew.style.display = 'inline-block'; tabNew.click(); }

  renderPurchaseEditor();
}

function cancelPurchase() {
  if (confirm('Are you sure you want to close this purchase order? Any unsaved changes will be lost.')) {
    clearPurchaseForm(true);
    closePurchaseEditor();
  }
}

function closePurchaseEditor() {
  const tNew  = document.getElementById('tabNewPurchase');
  const tEdit = document.getElementById('tabEditPurchase');
  if (tNew)  tNew.style.display  = 'none';
  if (tEdit) tEdit.style.display = 'none';
  const historyPane = document.getElementById('purchaseHistory');
  const newPane     = document.getElementById('purchaseNew');
  if (historyPane) historyPane.style.display = 'block';
  if (newPane)     newPane.style.display     = 'none';
  document.querySelectorAll('#purchaseTabsBar .sec-tab').forEach(b => b.classList.remove('active'));
  const historyTabBtn = document.querySelector('#purchaseTabsBar .sec-tab[data-stab="purchaseHistory"]');
  if (historyTabBtn) historyTabBtn.classList.add('active');
  localStorage.setItem('bs_active_stab_purchasePane', 'purchaseHistory');
}

function processPurchase(action) {
  App.postSaveAction = action;
  savePurchase();
}

// ─── VIEW MODE ───
let purchaseViewMode = localStorage.getItem('bs_purchase_view_mode') || 'list';

function setPurchaseViewMode(mode) {
  purchaseViewMode = mode;
  localStorage.setItem('bs_purchase_view_mode', mode);
  document.getElementById('purViewListBtn')?.classList.toggle('active', mode === 'list');
  document.getElementById('purViewTableBtn')?.classList.toggle('active', mode === 'table');
  document.getElementById('purViewGridBtn')?.classList.toggle('active', mode === 'grid');
  filterPurchases();
}

// ─── FILTER ENGINE (with key normalization parity to invoice.js) ───
function filterPurchases() {
  const q      = (document.getElementById('purchaseSearch')?.value || '').toLowerCase();
  const sort   = document.getElementById('purchaseSortSelect')?.value || 'date-desc';
  const status = document.getElementById('purActiveFilter')?.value || 'all';

  // FIX: Normalize keys the same way filterInvoices does — handles lowercase Supabase columns
  const normalize = p => ({
    poNumber:    p.poNumber    || p.ponumber    || '',
    date:        p.date        || '',
    supplier:    p.supplier    || '',
    totalAmount: parseFloat(p.totalAmount || p.totalamount || 0),
    status:      p.status      || 'unpaid',
    amountPaid:  parseFloat(p.amountPaid  || p.amountpaid  || 0),
    supplyType:  p.supplyType  || p.supplytype  || 'intra',
    gstType:     p.gstType     || p.gsttype     || 'Exclusive',
    supplierGstin: p.supplierGstin || p.suppliergstin || '',
    discount:    parseFloat(p.discount || 0),
    gstAmount:   parseFloat(p.gstAmount || p.gstamount || 0),
    subtotal:    parseFloat(p.subtotal  || 0),
    items:       p.items || []
  });

  let filtered = purchasesArray.map(normalize).filter(p => {
    const matchesSearch =
      p.poNumber.toLowerCase().includes(q) ||
      p.supplier.toLowerCase().includes(q) ||
      p.date.includes(q) ||
      String(p.totalAmount).includes(q);
    const matchesStatus = status === 'all' || p.status === status;
    return matchesSearch && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sort === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (sort === 'date-asc')  return new Date(a.date) - new Date(b.date);
    if (sort === 'amt-desc')  return b.totalAmount - a.totalAmount;
    if (sort === 'amt-asc')   return a.totalAmount - b.totalAmount;
    return 0;
  });

  const hist = document.getElementById('purchaseHistoryList');
  if (!hist) return;

  if (!filtered.length) {
    hist.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No results found</p></div>';
    return;
  }

  if (purchaseViewMode === 'table') {
    hist.innerHTML = `
      <div class="table-responsive" style="background:var(--surface); border-radius:var(--r-md); border:1px solid var(--border); margin-top:12px; overflow-x:auto;">
        <table class="items-table" style="margin:0; width:100%">
          <thead>
            <tr>
              <th>PO Number</th><th>Date</th><th>Supplier / Vendor</th>
              <th style="text-align:right">Discount</th>
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
                <td style="text-align:right; color:var(--danger);">${pur.discount ? '– ₹' + fmt(pur.discount) : '—'}</td>
                <td style="text-align:right; font-weight:600;">₹${fmt(pur.totalAmount)}</td>
                <td style="text-align:center;">${getStatusBadge(pur.status)}</td>
              </tr>`).join('')}
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
              ${getStatusBadge(pur.status)}
            </div>
            <div>
              <div style="font-weight:600; font-size:0.9rem; margin-bottom:2px;">${esc(pur.supplier)}</div>
              <div style="font-size:0.75rem; color:var(--ink3);"><i class="fas fa-calendar-alt"></i> ${dateLabel(pur.date)}</div>
            </div>
            ${pur.discount ? `<div style="font-size:0.8rem; color:var(--danger);">Discount: – ₹${fmt(pur.discount)}</div>` : ''}
            <div style="margin-top:auto; padding-top:10px; border-top:1px dashed var(--border); display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.75rem; color:var(--ink3);">Order Total</span>
              <span style="font-weight:700; font-size:1rem; color:var(--ink);">₹${fmt(pur.totalAmount)}</span>
            </div>
          </div>`).join('')}
      </div>`;
  } else {
    hist.innerHTML = filtered.map(pur => `
      <div class="list-item" onclick="showPurchaseDetail('${esc(pur.poNumber)}')">
        <div>
          <div class="list-item-title">${esc(pur.poNumber)}</div>
          <div class="list-item-sub">${esc(pur.supplier)} · ${dateLabel(pur.date)}</div>
        </div>
        <div style="text-align:right">
          <div class="list-item-amount">₹${fmt(pur.totalAmount)}</div>
          ${getStatusBadge(pur.status)}
        </div>
      </div>`).join('');
  }
}

// ─── STATUS FILTER ───
function setPurFilter(status, btn) {
  document.querySelectorAll('#purchaseHistory .filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const inputFilter = document.getElementById('purActiveFilter');
  if (inputFilter) inputFilter.value = status;
  filterPurchases();
}

function setPurchaseSupplyType(type) {
  App.currentPurchaseSupplyType = type;
  calcPurchaseTotals();
}

// ─── WIRE UP ADD ITEM BUTTON ───
document.addEventListener('DOMContentLoaded', () => {
  const addPurBtn = document.getElementById('addPurchaseItemBtn');
  if (addPurBtn) {
    addPurBtn.addEventListener('click', (e) => {
      e.preventDefault();
      purLineItems.push({ desc: '', hsn: '', qty: 1, cost: 0, gstRate: 0 });
      renderPurchaseEditor();
    });
  }
});

// ─── AUTO-FILL SUPPLIER GSTIN ───
document.addEventListener('DOMContentLoaded', () => {
  const supplierNameInput = document.getElementById('supplierName');
  if (supplierNameInput) {
    supplierNameInput.addEventListener('input', (e) => {
      const searchVal = e.target.value.trim().toLowerCase();
      const match = typeof suppliersArray !== 'undefined'
        ? suppliersArray.find(s => s.name.toLowerCase() === searchVal) : null;
      const gstinBox = document.getElementById('supplierGstin');
      if (gstinBox && match && match.gstin) {
        gstinBox.value = match.gstin;
        if (typeof calcPurchaseTotals === 'function') calcPurchaseTotals();
      }
    });
  }
});

// ─── INITIALISE ON LOAD ───
// FIX: Combined into one setTimeout to avoid duplicate event listeners
setTimeout(() => {
  // Restore saved view mode
  const savedMode = localStorage.getItem('bs_purchase_view_mode');
  if (savedMode) setPurchaseViewMode(savedMode);

  // Wire supplier name listeners (ONCE each — no duplicates)
  const sName = document.getElementById('supplierName');
  if (sName) {
    sName.addEventListener('input',  checkSupplierAdvance);
    sName.addEventListener('change', checkSupplierAdvance);
    sName.addEventListener('input',  calcPurchaseTotals);
    sName.addEventListener('change', calcPurchaseTotals);
  }

  // Wire supplier GSTIN listeners
  const sGstin = document.getElementById('supplierGstin');
  if (sGstin) {
    sGstin.addEventListener('input',  calcPurchaseTotals);
    sGstin.addEventListener('change', calcPurchaseTotals);
  }

  // Wire discount listeners
  const purDiscValInput = document.getElementById('purDiscountVal');
  if (purDiscValInput) {
    purDiscValInput.addEventListener('input',  calcPurchaseTotals);
    purDiscValInput.addEventListener('change', calcPurchaseTotals);
  }

  // Wire supply type select
  document.getElementById('purSupplyTypeSelect')?.addEventListener('change', calcPurchaseTotals);
}, 700);