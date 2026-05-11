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

  // auto-learn new products — fix: stock starts at qty purchased, not negative
  purLineItems.forEach(it => {
    const existing = inventoryStock.find(p => p.name.toLowerCase() === it.desc.toLowerCase());
    if (existing) {
      existing.stock = (existing.stock || 0) + it.qty; // update stock on existing product
    } else {
      inventoryStock.push({
        id: 'P-' + Date.now().toString().slice(-5),
        name: it.desc,
        costPrice: it.cost,
        sellPrice: it.cost * 1.5,
        gstRate: it.gstRate,
        stock: it.qty   // fix: was -it.qty before
      });
    }
  });

  // auto-learn new supplier — fix: case-insensitive match
  const supplierName = document.getElementById('supplierName').value.trim();
  if (!suppliersArray.find(s => s.name.toLowerCase() === supplierName.toLowerCase())) {
    suppliersArray.push({ id: 'SUPP-' + Date.now().toString().slice(-5), name: supplierName, phone: '', address: '', paymentTerms: '' });
  }
  updateDatalists();

  toast(`Sending PO ${poId}…`, 'warn');
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
    .then(() => commitPurchase(payload))
    .catch(() => commitPurchase(payload));
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
  
  toast('Form cleared', 'warn');
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
function printSavedPurchase(id) {
  loadEditPurchase(id); // 1. Loads the data
  
  setTimeout(() => {
    printCurrentPurchase(); // 2. Opens Print Window (Pauses the app here)
    
    // 3. THIS RUNS THE EXACT SECOND THE PRINT WINDOW CLOSES:
    setTimeout(() => {
      clearPurchaseForm(true); // Wipes the editor clean
      toast('Print session finished. Form reset for new purchase.', 'info');
      
      // Optional: If you want it to jump back to the History tab automatically, uncomment this line:
      // document.querySelector('.sec-tab[data-stab="purchaseHistory"]').click();
      
    }, 1000); // Waits 1 second for the print CSS to safely reset
    
  }, 400); 
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

  toast(`Loaded ${id} as a copy. You can now edit items before saving.`, 'info');
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
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('print-target'));
  const purPane   = document.getElementById('purchasePane');
  const printArea = document.getElementById('purchasePrintArea');
  purPane.classList.add('print-target');

  const template = bizProfile.printTemplate || 'tpl-standard';
  printArea.classList.add(template);

  // Read the new Paper Size property
  const paperSize = bizProfile.printSize || 'A4';

  let styleTag = document.getElementById('printPageStyle');
  if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = 'printPageStyle'; document.head.appendChild(styleTag); }
  
  // Inject A4 or A5 to the printer!
  styleTag.innerHTML = template === 'tpl-landscape' ? `@page{size:${paperSize} landscape}` : `@page{size:${paperSize}}`;

  const hdr = document.getElementById('purPrintHeader');
  if (hdr) hdr.style.display = 'block';
  updatePrintHeaders();
  window.print();
  setTimeout(() => {
    if (hdr) hdr.style.display = '';
    printArea.classList.remove(template);
  }, 800);
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

  toast(`Editing ${id}. Stock will recalculate when saved.`, 'info');
}
