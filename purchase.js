// ─── PURCHASE EDITOR (item-level GST) ─────────
function renderPurchaseEditor() {
  const body = document.getElementById('purchaseItemsBody');
  body.innerHTML = purLineItems.map((it, i) => {
    // fix: use shared calcGST helper
    const { gst, subtotalPart, total } = calcGST(it.qty * it.cost, it.gstRate, purGstType);
    return `<tr>
      <td><input class="item-input pur-field" data-i="${i}" data-f="desc" value="${esc(it.desc)}" placeholder="Add Item" list="productList"></td>
      <td><input class="item-input pur-field" data-i="${i}" data-f="qty"  type="number" value="${it.qty}"  min="0.01" step="0.01" style="width:60px"></td>
      <td><input class="item-input pur-field" data-i="${i}" data-f="cost" type="number" value="${it.cost}" min="0"    step="0.01" style="width:90px"></td>
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

  // fix: use 'change' not 'input' — avoids full re-render on every keystroke
  body.querySelectorAll('.pur-field').forEach(inp => {
    inp.addEventListener('change', () => {
      const i = +inp.dataset.i, f = inp.dataset.f;
      if (!purLineItems[i]) return;
      if (f === 'qty' || f === 'cost') {
        purLineItems[i][f] = parseFloat(inp.value) || 0;
      } else {
        purLineItems[i][f] = inp.value;
        // auto-fill COST PRICE and gst from product catalog
        const match = inventoryStock.find(p => p.name.toLowerCase() === inp.value.toLowerCase());
        if (match) {
          purLineItems[i].cost    = match.costPrice || 0;
          purLineItems[i].gstRate = match.gstRate   || 0;
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

// fix: uses shared calcGST helper
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
  // fix: prevent double-click duplicate saves
  if (App.isSaving) return;

  // 👇 ADD THESE TWO MISSING LINES 👇
  const poId = document.getElementById('poNumber').value.trim();
  if (!poId) { toast('Enter a PO number', 'error'); return; }

  const isEditing = App.editingPurchaseId === poId;
  if (isPoIdDuplicate(poId) && !isEditing) { toast(`PO ${poId} already exists — use a different number`, 'error'); return; }

  if (!document.getElementById('supplierName').value.trim()) { toast('Enter a supplier name', 'error'); return; }
  if (!purLineItems.length) { toast('Add at least one item', 'error'); return; }

  const hasEmptyDesc = purLineItems.some(i => !i.desc.trim() || i.desc.trim().toLowerCase() === 'add item');
  if (hasEmptyDesc) { toast('Please enter a product name for all items', 'error'); return; }

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
    items:    purLineItems.map(i => ({ product: i.desc, quantity: i.qty, unitCost: i.cost, gstRate: i.gstRate })),
    subtotal: sub, gstAmount: gstTotal, totalAmount: total
  };

  // fix: disable button while saving
  App.isSaving = true;
  const saveBtn = document.getElementById('savePurchaseBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

  if (isEditing) {
    const oldPur = purchasesArray.find(p => p.poNumber === poId);
    if (oldPur) {
      oldPur.items.forEach(oldIt => {
        const existing = inventoryStock.find(p => p.name.toLowerCase() === oldIt.product.toLowerCase());
        if (existing) existing.stock = (existing.stock || 0) - oldIt.quantity; // Subtract local stock back
      });
    }
    purchasesArray = purchasesArray.filter(p => p.poNumber !== poId); // Remove old version
    App.editingPurchaseId = null;
  }

  // auto-learn new supplier — fix: case-insensitive match
  const supplierName = document.getElementById('supplierName').value.trim();
  if (!suppliersArray.find(s => s.name.toLowerCase() === supplierName.toLowerCase())) {
    suppliersArray.push({ id: 'SUPP-' + Date.now().toString().slice(-5), name: supplierName, phone: '', address: '', paymentTerms: '' });
  }
  
  if (typeof updateDatalists === 'function') updateDatalists();
  if (typeof renderInventoryTable === 'function') renderInventoryTable();

  // 👇 NEW FINISHING SEQUENCE 👇
  const finish = (local) => {
    purchasesArray.unshift({ ...payload, timestamp: new Date().toISOString() });
    localStorage.setItem("bs_purchases", JSON.stringify(purchasesArray));
    
    if (typeof renderPurchaseLists === 'function') renderPurchaseLists();
    if (typeof updateDashboard === 'function') updateDashboard();
    
    toast(`Purchase ${poId} saved${local ? ' locally' : ''}!`, 'success');
    
    App.isSaving = false;
    const saveBtn = document.getElementById('savePurchaseBtn');
    if (saveBtn) { 
      saveBtn.disabled = false; 
      saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Purchase'; 
    }
    
    // Automatically reset the form and tabs after saving
    if (typeof clearPurchaseForm === 'function') clearPurchaseForm(true);
  };

  toast(`Sending PO ${poId}…`, 'warn');
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
    .then(() => finish(false))
    .catch(() => finish(true));
}

function commitPurchase(payload) {
  purchasesArray.unshift({ ...payload, timestamp: new Date().toISOString() });
  localStorage.setItem("bs_purchases", JSON.stringify(purchasesArray));
  renderPurchaseLists(); updateDashboard(); renderInventoryTable();
  toast(`Purchase ${payload.poNumber} saved!`, 'success');
  
  App.isSaving = false;
  const saveBtn = document.getElementById('savePurchaseBtn');
  if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Purchase'; }

  // Automatically wipe the screen after a successful save!
  clearPurchaseForm(true); 
}

// fix: asks for confirmation before wiping form, matches clearInvoiceForm behaviour
function clearPurchaseForm(force = false) {
  if (!force && purLineItems.some(i => i.desc.trim())) { if (!confirm('Clear all line items and supplier details?')) return; }
  
  // Wipe Items and Supplier
  purLineItems.length = 0; purLineItems.push({ desc: '', qty: 1, cost: 0, gstRate: 0.18 });
  document.getElementById('supplierName').value = '';
  
  // Clear edit memory
  App.editingPurchaseId = null; 
  
  // Generate new PO, unlock the box, and set date to TODAY
  document.getElementById('poNumber').value = getNextId(purchasesArray, 'PO');
  document.getElementById('poNumber').readOnly = false;
  document.getElementById('poNumber').style.backgroundColor = '';
  document.getElementById('purchaseDate').value = today(); // <--- FIXES THE DATE
  
  renderPurchaseEditor(); 
  
  // Revert the Tab UI from "Edit" back to "New"
  const tabNew = document.querySelector('.sec-tab[data-stab="purchaseNew"]');
  const tabEdit = document.getElementById('tabEditPurchase');
  if (tabNew && tabEdit) {
    tabEdit.style.display = 'none';
    tabNew.style.display = 'inline-block';
    tabNew.click();
  }
  
  if (!force) toast('Form cleared', 'warn');
}

// ─── RENDER PURCHASE LISTS ────────────────────
function renderPurchaseLists() {
  const makeItem = pur => `
    <div class="list-item" onclick="showPurchaseDetail('${esc(pur.poNumber)}')">
      <div>
        <div class="list-item-title">${esc(pur.poNumber)}</div>
        <div class="list-item-sub">${esc(pur.supplier)} · ${dateLabel(pur.date)}</div>
      </div>
      <div style="text-align:right">
        <div class="list-item-amount">${fmt(pur.totalAmount)}</div>
        <span class="badge badge-blue">Purchase</span>
      </div>
    </div>`;

  const recent = purchasesArray.slice(0, 4);
  const emptyHTML = '<div class="empty-state"><i class="fas fa-truck"></i><p>No purchases yet</p></div>';
  ['recentPurchaseList','dashRecentPurchases'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = recent.length ? recent.map(makeItem).join('') : emptyHTML;
  });
  const hist = document.getElementById('purchaseHistoryList');
  if (hist) hist.innerHTML = purchasesArray.length ? purchasesArray.map(makeItem).join('') : '<div class="empty-state"><i class="fas fa-truck"></i><p>No purchases saved yet</p></div>';
}

function filterPurchases() {
  const q = document.getElementById('purchaseSearch').value.toLowerCase();
  const filtered = purchasesArray.filter(p =>
    p.poNumber.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q)
  );
  const hist = document.getElementById('purchaseHistoryList');
  if (hist) hist.innerHTML = filtered.length
    ? filtered.map(pur => `<div class="list-item" onclick="showPurchaseDetail('${esc(pur.poNumber)}')"><div><div class="list-item-title">${esc(pur.poNumber)}</div><div class="list-item-sub">${esc(pur.supplier)} · ${dateLabel(pur.date)}</div></div><div style="text-align:right"><div class="list-item-amount">${fmt(pur.totalAmount)}</div></div></div>`).join('')
    : '<div class="empty-state"><i class="fas fa-search"></i><p>No results</p></div>';
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
        <thead><tr><th>Product</th><th>Qty</th><th>Unit Cost</th><th>GST%</th><th>Total</th></tr></thead>
        <tbody>
          ${(pur.items || []).map(it => `<tr><td>${esc(it.product)}</td><td>${it.quantity}</td><td>${fmt(it.unitCost)}</td><td>${((it.gstRate || 0) * 100).toFixed(0)}%</td><td>${fmt(it.quantity * it.unitCost)}</td></tr>`).join('')}
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

// Helper to auto-load, print, and clean up the purchase
// Background Print loader for Purchases
function printSavedPurchase(id) {
  const pur = purchasesArray.find(p => p.poNumber === id);
  if (!pur) return;
  const template = bizProfile.printTemplate || 'tpl-standard';
  
  // Directly builds the HTML from history data without touching the form!
  const html = buildPurchaseHTML(template, false, pur); 
  
  const printWin = window.open('', '_blank');
  if (!printWin) { toast("Please allow pop-ups to print.", "error"); return; }
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}

function duplicatePurchase(id) {
  const pur = purchasesArray.find(p => p.poNumber === id);
  if (!pur) return;

  // Clear memory to save as new
  App.editingPurchaseId = null; 

  document.getElementById('poNumber').value = getNextId(purchasesArray, 'PO');
  document.getElementById('poNumber').readOnly = false;
  document.getElementById('poNumber').style.backgroundColor = '';

  document.getElementById('purchaseDate').value = today();
  document.getElementById('supplierName').value = pur.supplier;

  if (typeof setPurGstType === 'function') setPurGstType(pur.gstType || 'Exclusive');

  purLineItems.length = 0;
  (pur.items || []).forEach(it => {
    purLineItems.push({ desc: it.product, qty: it.quantity, cost: it.unitCost, gstRate: it.gstRate });
  });

  renderPurchaseEditor();
  closeModal();
  switchTab('purchase');

  const tabNew = document.querySelector('.sec-tab[data-stab="purchaseNew"]');
  if (tabNew) tabNew.click();

  toast(`Loaded ${id} as a copy. You can now edit items before saving.`, 'success');
}

function deletePurchase(id) {
  const purToDelete = purchasesArray.find(p => p.poNumber === id);
  if (!purToDelete) return;
  // Restore local stock instantly (subtracting the purchase)
  purToDelete.items.forEach(oldIt => {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === oldIt.product.toLowerCase());
    if (existing) existing.stock = (existing.stock || 0) - oldIt.quantity;
  });

  const snap = JSON.parse(JSON.stringify(purchasesArray));
  purchasesArray.length = 0; purchasesArray.push(...snap.filter(p => p.poNumber !== id));
  localStorage.setItem("bs_purchases", JSON.stringify(purchasesArray));
  closeModal(); renderPurchaseLists(); updateDashboard(); renderInventoryTable();
  
  toast('Deleting from database...', 'warn');
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "deletePurchase", poNumber: id }) })
    .then(() => toast('Purchase permanently deleted', 'success'));
}

// ─── PRINT PURCHASE ───────────────────────────
function printCurrentPurchase() {
  const template = bizProfile.printTemplate || 'tpl-standard';
  const html = buildPurchaseHTML(template, false);

  const printWin = window.open('', '_blank');
  if (!printWin) { toast("Please allow pop-ups to print the PO.", "error"); return; }
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}

function loadEditPurchase(id) {
  const pur = purchasesArray.find(p => p.poNumber === id);
  if (!pur) return;

  App.editingPurchaseId = id;

  document.getElementById('poNumber').value = pur.poNumber;
  document.getElementById('poNumber').readOnly = true;
  document.getElementById('poNumber').style.backgroundColor = 'var(--surface2)';

  // ─── DATE STRIPPING FIX ───
  let dStr = "";
  try {
    if (pur.date) {
      const d = new Date(pur.date);
      if (!isNaN(d)) dStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
    }
  } catch(e){}
  document.getElementById('purchaseDate').value = dStr || today();

  document.getElementById('supplierName').value = pur.supplier;
  if (typeof setPurGstType === 'function') setPurGstType(pur.gstType || 'Exclusive');

  purLineItems.length = 0;
  (pur.items || []).forEach(it => {
    purLineItems.push({ desc: it.product, qty: it.quantity, cost: it.unitCost, gstRate: it.gstRate });
  });

  renderPurchaseEditor();
  closeModal();
  switchTab('purchase');

  const tabNew = document.querySelector('.sec-tab[data-stab="purchaseNew"]');
  if (tabNew) tabNew.click(); 

  toast(`Editing ${id}. Stock will recalculate when saved.`, 'success');
}

function buildPurchaseHTML(templateName, isSample, purData = null) {
  let data;
  if (purData) {
    // Reads directly from background history
    data = {
      bizName: bizProfile.name,
      bizAddr: bizProfile.address,
      bizContact: bizProfile.phone,
      bizGst: bizProfile.gstin,
      poNo: purData.poNumber,
      poDate: purData.date,
      supplierName: purData.supplier,
      gstType: purData.gstType || 'Exclusive',
      items: (purData.items || []).map(i => ({ desc: i.product, qty: i.quantity, price: i.unitCost, gstRate: i.gstRate }))
    };
  } else {
    // Reads from the active screen
    data = {
      bizName: bizProfile.name,
      bizAddr: bizProfile.address,
      bizContact: bizProfile.phone,
      bizGst: bizProfile.gstin,
      poNo: document.getElementById('poNumber').value || 'DRAFT',
      poDate: document.getElementById('purchaseDate').value || today(),
      supplierName: document.getElementById('supplierName').value || 'Supplier',
      gstType: typeof purGstType !== 'undefined' ? purGstType : 'Exclusive',
      items: purLineItems.map(i => ({ desc: i.desc, qty: i.qty, price: i.cost, gstRate: i.gstRate }))
    };
  }

  let sub = 0, gstTotal = 0, grand = 0;
  let itemsRows = "";

  data.items.forEach(it => {
    if (!it.desc || it.desc.trim().toLowerCase() === 'add item') return; // Skip empty rows
    const { gst, subtotalPart, total } = calcGST(it.qty * it.price, it.gstRate, data.gstType);
    sub += subtotalPart;
    gstTotal += gst;
    grand += total;

    itemsRows += `<tr>
      <td>${esc(it.desc)}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">₹${it.price.toFixed(2)}</td>
      <td style="text-align:right">₹${subtotalPart.toFixed(2)}</td>
      <td style="text-align:center">${(it.gstRate * 100).toFixed(0)}%</td>
      <td style="text-align:right">₹${gst.toFixed(2)}</td>
      <td style="text-align:right">₹${total.toFixed(2)}</td>
    </tr>`;
  });

  // ─── DYNAMIC SCALING & AUTO-FIT ───
  const paperSize = bizProfile.printSize || 'auto';
  const isA5 = paperSize === 'A5'; 
  
  const pWidth = isA5 ? '550px' : '800px';
  const lWidth = isA5 ? '750px' : '1050px';
  const pad = isA5 ? '20px' : '40px';

  const pageRule = paperSize === 'auto' ? '@page { margin: 0.5cm; }' : `@page { size: ${paperSize}; margin: 0.5cm; }`;
  const landscapePageRule = paperSize === 'auto' ? '@page { size: landscape; margin: 0.5cm; }' : `@page { size: ${paperSize} landscape; margin: 0.5cm; }`;

  let tplCSS = "";
  if (templateName === "tpl-minimal") {
    tplCSS = `
      ${pageRule}
      .invoice-paper { max-width:${pWidth}; margin:0 auto; background:white; padding:${pad}; border: 1px solid #eee; } 
      .inv-header { border-bottom: 1px solid #ddd !important; padding-bottom: 20px; }
      th { background: transparent !important; border-bottom: 2px solid #333 !important; color: #333 !important; }
      .totals { border-top: 2px solid #333 !important; }
      h1 { color: #555 !important; }
    `;
  } else if (templateName === "tpl-bold") {
    tplCSS = `
      ${pageRule}
      .invoice-paper { max-width:${pWidth}; margin:0 auto; background:linear-gradient(to bottom, #ffffff, #fdf8f6); padding:${pad}; border-radius:16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border-top: 8px solid #c2410c; } 
      .inv-header { border-bottom: none !important; }
      h1 { color: #c2410c !important; }
      th { background: #c2410c !important; color: white !important; border: none !important; }
      .totals { background: #fff7ed; padding: 20px; border-radius: 12px; border: none !important; }
    `;
  } else if (templateName === "tpl-landscape") {
    tplCSS = `
      ${landscapePageRule}
      .invoice-paper { max-width: ${lWidth}; margin:0 auto; background:white; padding:${pad}; border: 1px solid #ddd; border-top: 6px solid #1a4a3a; } 
      .inv-header { border-bottom:3px solid #1a4a3a !important; display: flex; align-items: center; }
      h1 { color: #1a4a3a !important; }
      th { background: #1a4a3a !important; color: white !important; }
    `;
  } else {
    tplCSS = `
      ${pageRule}
      .invoice-paper { max-width:${pWidth}; margin:0 auto; background:white; padding:${pad}; border:1px solid #eee; border-top: 6px solid #1e4a6e; } 
      .inv-header { border-bottom: 3px solid #1e4a6e !important; }
      h1 { color: #1e4a6e !important; }
      th { background: #f1f5f9 !important; color: #1e4a6e !important; }
    `;
  }

  const printCSS = `
    @media print { 
      body { background:white; padding:0; font-size: ${isA5 ? '0.85rem' : '12pt'}; } 
      .invoice-paper { width: 100% !important; max-width: 100% !important; box-shadow:none !important; border:none !important; padding:0 !important; margin:0 !important; } 
    }
  `;

  const priceModeLabel = data.gstType === 'Exclusive' ? 'GST Exclusive' : 'GST Inclusive';

  return `<!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"><title>Purchase Order - ${data.poNo}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:#f0f2f5; font-family:'Inter',sans-serif; padding:20px; color:#1a2c3e; font-size: ${isA5 ? '0.85rem' : '1rem'};}
    table{width:100%; border-collapse:collapse; margin:18px 0;}
    th,td{padding:${isA5 ? '8px 4px' : '12px 8px'}; text-align:left; border-bottom:1px solid #e2e8f0; font-size:${isA5 ? '0.75rem' : '0.85rem'};}
    th{background:#f1f5f9; color:#475569; text-transform:uppercase; font-size:${isA5 ? '0.65rem' : '0.75rem'}; letter-spacing:0.05em;}
    .totals{text-align:right; margin-top:20px; border-top:1px dashed #cbd5e1; padding-top:16px;}
    .footer{margin-top:25px; font-size:0.75rem; text-align:center; color:#64748b;}
    ${tplCSS}
    ${printCSS}
  </style>
  </head>
  <body>
  <div class="invoice-paper">
    <div class="inv-header" style="display:flex; justify-content:space-between; flex-wrap:wrap; padding-bottom:20px; margin-bottom:20px;">
      <div>
        <h2 style="font-size:${isA5 ? '1.3rem' : '1.6rem'}; color:#0f172a; margin-bottom:4px; font-weight:800;">${esc(data.bizName)}</h2>
        <div style="font-size:${isA5 ? '0.7rem' : '0.8rem'}; color:#475569; line-height:1.5;">${esc(data.bizAddr).replace(/\n/g,'<br>')}</div>
        <div style="font-size:${isA5 ? '0.7rem' : '0.8rem'}; color:#475569; margin-top:4px;">GSTIN: ${esc(data.bizGst)}</div>
      </div>
      <div style="text-align:right;">
        <h1 style="color:#0f172a; letter-spacing:0.05em; font-size:${isA5 ? '1.5rem' : '2rem'}">PURCHASE ORDER</h1>
        <div style="font-size:0.85rem; color:#64748b; margin-top:4px;">${priceModeLabel}</div>
      </div>
    </div>
    <div style="display:flex; justify-content:space-between; margin:12px 0; flex-wrap:wrap; background:#f8fafc; padding:16px; border-radius:12px; border:1px solid #e2e8f0;">
      <span><strong>PO No:</strong> ${esc(data.poNo)}</span>
      <span><strong>Date:</strong> ${data.poDate}</span>
    </div>
    <div style="margin:20px 0;">
      <h4 style="font-size:0.85rem; color:#64748b; text-transform:uppercase; margin-bottom:8px; letter-spacing:0.05em;">Supplier</h4>
      <div style="font-weight:700; font-size:1.1rem; color:#0f172a;">${esc(data.supplierName)}</div>
    </div>
    <table>
      <thead><tr>
        <th>Description</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Unit Cost</th>
        <th style="text-align:right">Taxable</th>
        <th style="text-align:center">GST%</th>
        <th style="text-align:right">GST Amt</th>
        <th style="text-align:right">Total</th>
      </tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <div class="totals">
      <div style="color:#475569; margin-bottom:6px;">Total Taxable: ₹${sub.toFixed(2)}</div>
      <div style="color:#475569; margin-bottom:6px;">Total GST: ₹${gstTotal.toFixed(2)}</div>
      <div style="font-size:${isA5 ? '1.2rem' : '1.5rem'}; font-weight:800; color:#0f172a; margin-top:12px;">Grand Total: ₹${grand.toFixed(2)}</div>
    </div>
    
    <div style="display:flex; justify-content:space-between; margin-top:30px; font-size:${isA5 ? '0.7rem' : '0.8rem'}; border-top:1px solid #e2e8f0; padding-top:16px;">
      <div style="width:60%"></div>
      <div style="width:35%; text-align:right; display:flex; flex-direction:column; justify-content:flex-end;">
        <div style="border-bottom:1px solid #0f172a; margin-bottom:4px; height:40px;"></div>
        <strong style="color:#0f172a;">Authorised Signatory</strong>
        <div style="color:#475569; margin-top:2px;">For ${esc(data.bizName)}</div>
      </div>
    </div>
    <div class="footer">Generated by BillingSuite Pro</div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(() => { window.print(); window.close(); }, 500);
    };
  </script>
  </body>
  </html>`;
}
