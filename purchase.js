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
function savePurchase() {
  if (App.isSaving) return;

  const poId = document.getElementById('poNumber').value.trim();
  if (!poId) { toast('Enter a PO number', 'error'); return; }

  const isEditing = App.editingPurchaseId === poId;
  
  if (typeof isPoIdDuplicate === 'function' && isPoIdDuplicate(poId) && !isEditing) { 
    toast(`PO ${poId} already exists — use a different number`, 'error'); return; 
  }

  if (!document.getElementById('supplierName').value.trim()) { toast('Enter a supplier name', 'error'); return; }
  if (!purLineItems.length) { toast('Add at least one item', 'error'); return; }
  if (purLineItems.some(i => !i.desc.trim() || i.desc.trim().toLowerCase() === 'add item')) { toast('Please enter a product name for all items', 'error'); return; }

  let sub = 0, gstTotal = 0, total = 0;
  purLineItems.forEach(it => {
    const r = calcGST(it.qty * it.cost, it.gstRate, purGstType);
    sub += r.subtotalPart; gstTotal += r.gst; total += r.total;
  });

  const payload = {
    action: isEditing ? "editPurchase" : "savePurchase",
    poNumber: poId,
    date:     document.getElementById('purchaseDate').value,
    supplier: document.getElementById('supplierName').value,
    gstType:  purGstType,
    items:    purLineItems.map(i => ({ product: i.desc, hsn: i.hsn, quantity: i.qty, unitCost: i.cost, gstRate: i.gstRate })),
    subtotal: sub, gstAmount: gstTotal, totalAmount: total
  };

  App.isSaving = true;
  const saveBtn = document.getElementById('savePurchaseBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

  if (isEditing) {
    const oldPur = purchasesArray.find(p => p.poNumber === poId);
    if (oldPur) {
      oldPur.items.forEach(oldIt => {
        const existing = inventoryStock.find(p => p.name.toLowerCase() === oldIt.product.toLowerCase());
        if (existing) existing.stock = (existing.stock || 0) - oldIt.quantity; 
      });
    }
    const idx = purchasesArray.findIndex(p => p.poNumber === poId);
    if (idx > -1) purchasesArray.splice(idx, 1);
    App.editingPurchaseId = null;
  }

  const supplierName = document.getElementById('supplierName').value.trim();
  if (!suppliersArray.find(s => s.name.toLowerCase() === supplierName.toLowerCase())) {
    suppliersArray.push({ id: 'SUPP-' + Date.now().toString().slice(-5), name: supplierName, phone: '', address: '', paymentTerms: '' });
  }
  
  if (typeof updateDatalists === 'function') updateDatalists();
  if (typeof renderInventoryTable === 'function') renderInventoryTable();
  
  purchasesArray.unshift({ ...payload, timestamp: new Date().toISOString() });
  localStorage.setItem("bs_purchases", JSON.stringify(purchasesArray));
  
  if (typeof renderPurchaseLists === 'function') renderPurchaseLists();
  if (typeof updateDashboard === 'function') updateDashboard();
  
  App.isSaving = false;
  if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Purchase'; }

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

  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
    .catch(err => console.error("Background sync failed", err));
}

function clearPurchaseForm(force = false) {
  if (!force && purLineItems.some(i => i.desc.trim())) { if (!confirm('Clear all line items and supplier details?')) return; }
  purLineItems.length = 0; purLineItems.push({ desc: '', hsn: '', qty: 1, cost: 0, gstRate: 0.18 });
  const suppName = document.getElementById('supplierName');
  if (suppName) suppName.value = '';
  App.editingPurchaseId = null; 
  const poNum = document.getElementById('poNumber');
  if (poNum) { poNum.value = getNextId(purchasesArray, 'PO'); poNum.readOnly = false; poNum.style.backgroundColor = ''; }
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
  document.getElementById('poNumber').value = getNextId(purchasesArray, 'PO');
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

function deletePurchase(id) {
  const purToDelete = purchasesArray.find(p => p.poNumber === id);
  if (!purToDelete) return;
  purToDelete.items.forEach(oldIt => {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === oldIt.product.toLowerCase());
    if (existing) existing.stock = (existing.stock || 0) - oldIt.quantity;
  });
  const snap = JSON.parse(JSON.stringify(purchasesArray));
  purchasesArray.length = 0; purchasesArray.push(...snap.filter(p => p.poNumber !== id));
  localStorage.setItem("bs_purchases", JSON.stringify(purchasesArray));
  closeModal(); renderPurchaseLists(); updateDashboard(); renderInventoryTable();
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "deletePurchase", poNumber: id }) }).then(() => toast('Purchase permanently deleted', 'success'));
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

// ─── BUILD PURCHASE HTML (Upgraded with HSN) ──
function buildPurchaseHTML(templateName, isSample, purData = null) {
  let data;
  if (purData) {
    data = {
      bizName: bizProfile.name, bizAddr: bizProfile.address, bizContact: bizProfile.phone, bizGst: bizProfile.gstin,
      poNo: purData.poNumber, poDate: purData.date, supplierName: purData.supplier, gstType: purData.gstType || 'Exclusive',
      items: (purData.items || []).map(i => ({ desc: i.product, hsn: i.hsn || '', qty: i.quantity, price: i.unitCost, gstRate: i.gstRate }))
    };
  } else {
    data = {
      bizName: bizProfile.name, bizAddr: bizProfile.address, bizContact: bizProfile.phone, bizGst: bizProfile.gstin,
      poNo: document.getElementById('poNumber').value || 'DRAFT', poDate: document.getElementById('purchaseDate').value || today(),
      supplierName: document.getElementById('supplierName').value || 'Supplier', gstType: typeof purGstType !== 'undefined' ? purGstType : 'Exclusive',
      items: purLineItems.map(i => ({ desc: i.desc, hsn: i.hsn || '', qty: i.qty, price: i.cost, gstRate: i.gstRate }))
    };
  }

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

  const paperSize = bizProfile.printSize || 'auto';
  const isA5 = paperSize === 'A5'; 
  const pWidth = isA5 ? '148mm' : '800px';
  const lWidth = isA5 ? '210mm' : '1050px';
  const pad = isA5 ? '20px' : '40px';

  const pageRule = paperSize === 'auto' ? '@page { margin: 0.5cm; }' : `@page { size: ${paperSize}; margin: 0.5cm; }`;
  const landscapePageRule = paperSize === 'auto' ? '@page { size: landscape; margin: 0.5cm; }' : `@page { size: ${paperSize} landscape; margin: 0.5cm; }`;

  let tplCSS = "";
  if (templateName === "tpl-minimal") {
    tplCSS = `${pageRule} .invoice-paper { max-width:${pWidth}; margin:0 auto; background:white; padding:${pad}; border: 1px solid #eee; } .inv-header { border-bottom: 1px solid #ddd !important; padding-bottom: 20px; } th { background: transparent !important; border-bottom: 2px solid #333 !important; color: #333 !important; } .totals { border-top: 2px solid #333 !important; } h1 { color: #555 !important; }`;
  } else if (templateName === "tpl-bold") {
    tplCSS = `${pageRule} .invoice-paper { max-width:${pWidth}; margin:0 auto; background:linear-gradient(to bottom, #ffffff, #fdf8f6); padding:${pad}; border-radius:16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border-top: 8px solid #c2410c; } .inv-header { border-bottom: none !important; } h1 { color: #c2410c !important; } th { background: #c2410c !important; color: white !important; border: none !important; } .totals { background: #fff7ed; padding: 20px; border-radius: 12px; border: none !important; }`;
  } else if (templateName === "tpl-landscape") {
    tplCSS = `${landscapePageRule} .invoice-paper { max-width: ${lWidth}; margin:0 auto; background:white; padding:${pad}; border: 1px solid #ddd; border-top: 6px solid #1a4a3a; } .inv-header { border-bottom:3px solid #1a4a3a !important; display: flex; align-items: center; } h1 { color: #1a4a3a !important; } th { background: #1a4a3a !important; color: white !important; }`;
  } else {
    tplCSS = `${pageRule} .invoice-paper { max-width:${pWidth}; margin:0 auto; background:white; padding:${pad}; border:1px solid #eee; border-top: 6px solid #1e4a6e; } .inv-header { border-bottom: 3px solid #1e4a6e !important; } h1 { color: #1e4a6e !important; } th { background: #f1f5f9 !important; color: #1e4a6e !important; }`;
  }

  return `<!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"><title>Purchase Order - ${data.poNo}</title>
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
        <h2 style="font-size:1.6em; color:#0f172a; margin-bottom:4px; font-weight:800;">${esc(data.bizName)}</h2>
        <div style="font-size:0.8em; color:#475569; line-height:1.5;">${esc(data.bizAddr).replace(/\n/g,'<br>')}</div>
        <div style="font-size:0.8em; color:#475569; margin-top:4px;">GSTIN: ${esc(data.bizGst)}</div>
      </div>
      <div style="text-align:right;">
        <h1 style="color:#0f172a; letter-spacing:0.05em; font-size:2em">PURCHASE ORDER</h1>
        <div style="font-size:0.85em; color:#64748b; margin-top:4px;">${data.gstType === 'Exclusive' ? 'GST Exclusive' : 'GST Inclusive'}</div>
      </div>
    </div>
    <div style="display:flex; justify-content:space-between; margin:12px 0; flex-wrap:wrap; background:#f8fafc; padding:16px; border-radius:12px; border:1px solid #e2e8f0; font-size:0.9em;">
      <span><strong>PO No:</strong> ${esc(data.poNo)}</span>
      <span><strong>Date:</strong> ${data.poDate}</span>
    </div>
    <div style="margin:20px 0;">
      <h4 style="font-size:0.85em; color:#64748b; text-transform:uppercase; margin-bottom:8px; letter-spacing:0.05em;">Supplier</h4>
      <div style="font-weight:700; font-size:1.1em; color:#0f172a;">${esc(data.supplierName)}</div>
    </div>
    <table>
      <thead><tr><th style="text-align:center">#</th><th>Description</th><th>HSN/SAC</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Cost</th><th style="text-align:right">Taxable</th><th style="text-align:center">GST%</th><th style="text-align:right">GST Amt</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <div class="totals">
      <div style="color:#475569; margin-bottom:6px; font-size:0.9em;">Total Taxable: ${fmt(sub)}</div>
      <div style="color:#475569; margin-bottom:6px; font-size:0.9em;">Total GST: ${fmt(gstTotal)}</div>
      <div style="font-size:1.4em; font-weight:800; color:#0f172a; margin-top:12px;">Grand Total: ${fmt(grand)}</div>
    </div>
    <div style="display:flex; justify-content:space-between; margin-top:30px; font-size:0.8em; border-top:1px solid #e2e8f0; padding-top:16px;">
      <div style="width:60%"></div>
      <div style="width:35%; text-align:right; display:flex; flex-direction:column; justify-content:flex-end;">
        <div style="border-bottom:1px solid #0f172a; margin-bottom:4px; height:40px;"></div>
        <strong style="color:#0f172a;">Authorised Signatory</strong>
        <div style="color:#475569; margin-top:2px;">For ${esc(data.bizName)}</div>
      </div>
    </div>
    <div class="footer">Generated by BillingSuite Pro</div>
  </div>
  <script>window.onload=function(){setTimeout(()=>{window.print();window.close();},500);};</script>
  </body>
  </html>`;
}

function openNewPurchaseForm() {
  if (typeof clearPurchaseForm === 'function') clearPurchaseForm(true);
  const histTab = document.querySelector('.sec-tab[data-stab="purchaseHistory"]');
  if (histTab) histTab.classList.remove('active');
  const tabNew = document.getElementById('tabNewPurchase');
  if (tabNew) { tabNew.style.display = 'inline-block'; tabNew.click(); }
}
