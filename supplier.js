// ══════════════════════════════════════════════════════════════
//        SUPPLIERS MODULE (SUB-TAB ACCOUNT STATEMENT ENG)
// ══════════════════════════════════════════════════════════════

function renderSupplierGrid() {
  const container = document.getElementById('supplierGrid');
  if (!container) return;
  
  const q = (document.getElementById('supplierSearch')?.value || '').toLowerCase();
  const sortMode = document.getElementById('supplierSort')?.value || 'recent';
  const viewType = localStorage.getItem('bs_view_supplier') || 'grid';

  const purSummary = {};
  purchasesArray.forEach(p => {
    const key = (p.supplier || '').toLowerCase();
    if (!purSummary[key]) purSummary[key] = { spend: 0, paid: 0 };
    purSummary[key].spend += (p.totalAmount || 0);
    purSummary[key].paid += (p.amountPaid || 0);
  });

  let filtered = suppliersArray.filter(s => 
    (s.name || '').toLowerCase().includes(q) || 
    (s.phone || '').includes(q)
  );

  filtered.sort((a, b) => {
    if (sortMode === 'nameAsc') return a.name.localeCompare(b.name);
    if (sortMode === 'nameDesc') return b.name.localeCompare(a.name);
    if (sortMode === 'purchasedDesc') {
      const sumA = purSummary[(a.name || '').toLowerCase()]?.spend || 0;
      const sumB = purSummary[(b.name || '').toLowerCase()]?.spend || 0;
      return sumB - sumA;
    }
    return 0; 
  });

  container.className = `view-container view-${viewType}`;

  if (!filtered.length) { 
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-building"></i><p>No suppliers found</p></div>'; 
    return; 
  }

  if (viewType === 'table') {
    container.innerHTML = `
      <table class="invoice-table" style="width:100%">
        <thead>
          <tr>
            <th>Supplier Name</th>
            <th>Payment Terms</th>
            <th>Phone Number</th>
            <th style="text-align:right">Total Purchases</th>
            <th style="text-align:right">Balance Payable</th>
            <th style="text-align:right">Advance Credit</th>
            <th style="text-align:center; width:150px">Statement</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(s => {
            const summ = purSummary[(s.name || '').toLowerCase()] || { spend: 0, paid: 0 };
            const balancePayable = Math.max(0, summ.spend - summ.paid);
            const advCredit = s.advanceBalance || 0;
            return `
              <tr>
                <td style="font-weight:600; color:var(--ink); cursor:pointer;" onclick="openSupplierLedger('${esc(s.id)}')"><i class="fas fa-building" style="color:var(--gold); margin-right:6px"></i>${esc(s.name)}</td>
                <td>${esc(s.paymentTerms) || '-'}</td>
                <td>${esc(s.phone) || '-'}</td>
                <td style="text-align:right; font-weight:600">₹${fmt(summ.spend)}</td>
                <td style="text-align:right; font-weight:700; color:${balancePayable > 0 ? 'var(--danger)' : 'var(--accent2)'}">₹${fmt(balancePayable)}</td>
                <td style="text-align:right; font-weight:600; color:var(--info)">₹${fmt(advCredit)}</td>
                <td style="text-align:center;">
                  <button class="btn btn-secondary btn-sm" style="padding:4px 8px;" onclick="openSupplierLedger('${esc(s.id)}')"><i class="fas fa-eye"></i> Open Ledger</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } else {
    container.innerHTML = filtered.map(s => {
      const summ = purSummary[(s.name || '').toLowerCase()] || { spend: 0, paid: 0 };
      const balancePayable = Math.max(0, summ.spend - summ.paid);
      const advCredit = s.advanceBalance || 0;
      return `
        <div class="contact-card" style="cursor:pointer;" onclick="openSupplierLedger('${esc(s.id)}')">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%; gap:12px;">
            <div>
              <div style="font-weight:700; color:var(--ink); font-size:1.05rem; margin-bottom:4px;">${esc(s.name)}</div>
              <div style="font-size:0.825rem; color:var(--ink2); display:flex; flex-direction:column; gap:2px;">
                ${s.phone ? `<span><i class="fas fa-phone" style="width:16px; color:var(--ink3)"></i>${esc(s.phone)}</span>` : ''}
                ${s.paymentTerms ? `<span><i class="fas fa-clock" style="width:16px; color:var(--ink3)"></i>Terms: ${esc(s.paymentTerms)}</span>` : ''}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.7rem; text-transform:uppercase; color:var(--ink3); font-weight:600;">Owed To Supplier</div>
              <div style="font-size:1.1rem; font-weight:800; color:${balancePayable > 0 ? 'var(--danger)' : 'var(--accent2)'}">₹${fmt(balancePayable)}</div>
              ${advCredit > 0 ? `<div style="font-size:0.75rem; color:var(--info); font-weight:700; margin-top:2px;">Advance Credit: ₹${fmt(advCredit)}</div>` : ''}
            </div>
          </div>
          <div style="border-top:1px solid var(--border); padding-top:10px; margin-top:4px; display:flex; justify-content:space-between; align-items:center; width:100%;">
            <span style="font-size:0.7rem; color:var(--ink3)">Click to view statement tab</span>
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openEditSupplier('${esc(s.id)}')"><i class="fas fa-pen"></i> Edit</button>
          </div>
        </div>
      `;
    }).join('');
  }
}

function filterSuppliers() { renderSupplierGrid(); }

// ─── LEDGER TAB CONTROLLER ACTIONS ───
function openSupplierLedger(id) {
  const s = suppliersArray.find(x => String(x.id) === String(id));
  if (!s) return;

  const ledgerEntries = [];
  const vendorPurchases = purchasesArray.filter(p => (p.supplier || '').toLowerCase() === s.name.toLowerCase());
  
  let totalSpend = 0, totalPaid = 0;
  vendorPurchases.forEach(p => {
    totalSpend += parseFloat(p.totalAmount || 0);
    totalPaid += parseFloat(p.amountPaid || 0);

    ledgerEntries.push({ date: p.date || today(), type: 'Purchase Order', ref: p.poNumber, billed: parseFloat(p.totalAmount || 0), paid: 0 });
    if (parseFloat(p.amountPaid || 0) > 0) {
      ledgerEntries.push({ date: p.date || today(), type: 'Payment Disbursed', ref: p.poNumber, billed: 0, paid: parseFloat(p.amountPaid || 0) });
    }
  });

  if (parseFloat(s.advanceBalance || 0) > 0) {
    ledgerEntries.push({ date: today(), type: 'Advance Paid Deposit', ref: 'ADV-PAY', billed: 0, paid: parseFloat(s.advanceBalance || 0) });
  }

  ledgerEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
  const netOwed = Math.max(0, totalSpend - totalPaid);
  let runningBalance = 0;

  // Render directly into the sub-tab panel container
  document.getElementById('supplierLedgerContent').innerHTML = `
    <div style="background:var(--surface2); padding:16px; border-radius:var(--r-md); border:1px solid var(--border); margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
      <div>
        <h3 style="margin:0; color:var(--ink); font-size:1.2rem;">${esc(s.name)}</h3>
        <p style="margin:4px 0 0; font-size:0.8rem; color:var(--ink2);"><i class="fas fa-phone"></i> ${esc(s.phone || 'N/A')} &nbsp;|&nbsp; <i class="fas fa-clock"></i> Terms: ${esc(s.paymentTerms || 'Due on Receipt')}</p>
      </div>
      <div style="display:flex; gap:16px; text-align:right;">
        <div><div style="font-size:0.7rem; color:var(--ink3); text-transform:uppercase; font-weight:600;">Total Procured</div><div style="font-size:1.1rem; font-weight:700;">₹${fmt(totalSpend)}</div></div>
        <div><div style="font-size:0.7rem; color:var(--ink3); text-transform:uppercase; font-weight:600; color:var(--danger)">Net Owed</div><div style="font-size:1.1rem; font-weight:800; color:var(--danger)">₹${fmt(netOwed)}</div></div>
        <div><div style="font-size:0.7rem; color:var(--ink3); text-transform:uppercase; font-weight:600; color:var(--info)">Our Advance</div><div style="font-size:1.1rem; font-weight:800; color:var(--info)">₹${fmt(s.advanceBalance || 0)}</div></div>
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <h4 style="margin:0; font-size:0.95rem; color:var(--ink);"><i class="fas fa-list-alt"></i> Running Balance Statement Record</h4>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="closeSupplierLedger()"><i class="fas fa-arrow-left"></i> Back to Directory</button>
        <button class="btn btn-primary btn-sm" style="background:var(--gold); border-color:var(--gold);" onclick="openSupplierPaymentForm('${esc(id)}')"><i class="fas fa-plus-circle"></i> Issue Disbursement / Advance</button>
      </div>
    </div>

    <div class="items-table-wrap" style="border:1px solid var(--border); border-radius:var(--r-sm)">
      <table class="items-table" style="width:100%; font-size:0.85rem;">
        <thead>
          <tr>
            <th>Date</th>
            <th>Transaction Type</th>
            <th>Ref ID</th>
            <th style="text-align:right">Liability (Procured)</th>
            <th style="text-align:right">Disbursed (Paid)</th>
            <th style="text-align:right">Running Balance</th>
          </tr>
        </thead>
        <tbody>
          ${ledgerEntries.length ? ledgerEntries.map(e => {
            if (e.type === 'Purchase Order') runningBalance += e.billed;
            else runningBalance -= e.paid;
            return `
              <tr style="background:${e.billed > 0 ? 'transparent' : 'var(--gold-light)'}">
                <td>${dateLabel(e.date)}</td>
                <td style="font-weight:600; color:${e.billed > 0 ? 'var(--ink)' : 'var(--gold)'}">${esc(e.type)}</td>
                <td style="font-family:monospace; font-weight:600;">${esc(e.ref)}</td>
                <td style="text-align:right; font-weight:600;">${e.billed > 0 ? '₹' + fmt(e.billed) : '-'}</td>
                <td style="text-align:right; font-weight:600; color:var(--gold);">${e.paid > 0 ? '₹' + fmt(e.paid) : '-'}</td>
                <td style="text-align:right; font-weight:700; color:${runningBalance > 0 ? 'var(--danger)' : 'var(--accent2)'}">₹${fmt(Math.max(0, runningBalance))}</td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--ink3)">No transaction history logged.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  // Toggle tab selectors
  const tab = document.getElementById('tabSupplierLedger');
  const dirPane = document.getElementById('supplierDirectory');
  const ledPane = document.getElementById('supplierLedger');
  
  if (tab) {
    tab.style.display = 'inline-block';
    tab.textContent = `Ledger: ${s.name}`;
    tab.click();
  }
  if (dirPane) dirPane.style.display = 'none';
  if (ledPane) ledPane.style.display = 'block';
}

function closeSupplierLedger() {
  const tab = document.getElementById('tabSupplierLedger');
  if (tab) tab.style.display = 'none';
  
  const dirPane = document.getElementById('supplierDirectory');
  const ledPane = document.getElementById('supplierLedger');
  if (dirPane) dirPane.style.display = 'block';
  if (ledPane) ledPane.style.display = 'none';
  
  document.querySelectorAll('#supplierTabsBar .sec-tab').forEach(b => b.classList.remove('active'));
  const dirBtn = document.querySelector('#supplierTabsBar .sec-tab[data-stab="supplierDirectory"]');
  if (dirBtn) dirBtn.classList.add('active');
}

// ─── INTERACTIVE MODAL REMITTANCE ENTRY OVERRIDES ───
function openSupplierPaymentForm(id) {
  const s = suppliersArray.find(x => String(x.id) === String(id));
  if (!s) return;

  const vendorPurchases = purchasesArray.filter(p => (p.supplier || '').toLowerCase() === s.name.toLowerCase() && p.status !== 'paid');
  let totalPayable = 0;
  vendorPurchases.forEach(p => totalPayable += ((p.totalAmount || 0) - (p.amountPaid || 0)));

  document.getElementById('modalTitle').innerHTML = `<i class="fas fa-money-check-alt" style="color:var(--gold)"></i> Issue Remittance Discharged Entry`;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label class="form-label">Payment Category</label>
      <select class="form-control" id="suppPmtType" onchange="toggleSuppPmtInvoiceSelection(this)">
        ${totalPayable > 0 ? `<option value="fifo">Clear Outstanding Balance (FIFO Allocation)</option>` : ''}
        <option value="advance">Advance Supplier Credit (Pre-payment Float)</option>
        ${vendorPurchases.map(p => `<option value="single:${esc(p.poNumber)}">Target Specific PO: ${esc(p.poNumber)} (Owed: ₹${fmt((p.totalAmount||0)-(p.amountPaid||0))})</option>`).join('')}
      </select>
    </div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Disbursement Date</label><input type="date" class="form-control" id="suppPmtDate" value="${today()}"></div>
      <div class="form-group">
        <label class="form-label">Funding Mode</label>
        <select class="form-control" id="suppPmtMode"><option value="Bank Transfer">Bank Transfer</option><option value="Cash">Cash Account</option><option value="UPI">UPI Digital</option></select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Disbursement Amount (₹)</label>
      <input type="number" class="form-control" id="suppPmtAmount" placeholder="0.00" min="0.01" step="0.01" value="${totalPayable > 0 ? totalPayable.toFixed(2) : ''}">
    </div>
    <div style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Cancel</button>
      <button class="btn btn-primary" style="background:var(--gold); border-color:var(--gold);" id="suppProcessPmtBtn" onclick="submitSupplierPaymentTransaction('${esc(id)}')"><i class="fas fa-check-circle"></i> Commit Outflow</button>
    </div>
  `;
  document.getElementById('detailModal').classList.add('open');
}

function toggleSuppPmtInvoiceSelection(selectElement) {
  const val = selectElement.value; const idInput = document.getElementById('suppPmtAmount'); if (!idInput) return;
  if (val.startsWith('single:')) {
    const poId = val.split(':')[1]; const pur = purchasesArray.find(p => p.poNumber === poId);
    if (pur) idInput.value = ((pur.totalAmount || 0) - (pur.amountPaid || 0)).toFixed(2);
  }
}

async function submitSupplierPaymentTransaction(suppId) {
  const s = suppliersArray.find(x => x.id === suppId); if (!s) return;
  const type = document.getElementById('suppPmtType').value;
  const amtVal = parseFloat(document.getElementById('suppPmtAmount').value) || 0;
  if (amtVal <= 0) { toast('Remittance values must exceed zero.', 'error'); return; }

  const btn = document.getElementById('suppProcessPmtBtn'); setButtonLoading(btn, true, 'Syncing...');
  let remaining = amtVal;

  if (type === 'advance') {
    s.advanceBalance = (s.advanceBalance || 0) + amtVal;
    await supabase.from('suppliers').update({ advanceBalance: s.advanceBalance }).eq('id', suppId).eq('store_id', currentStoreId);
  } else if (type === 'fifo') {
    let unpaid = purchasesArray.filter(p => (p.supplier || '').toLowerCase() === s.name.toLowerCase() && p.status !== 'paid');
    unpaid.sort((a, b) => new Date(a.date) - new Date(b.date));
    for (let pur of unpaid) {
      if (remaining <= 0) break; let due = (pur.totalAmount || 0) - (pur.amountPaid || 0); let apply = Math.min(remaining, due);
      pur.amountPaid = (pur.amountPaid || 0) + apply; remaining -= apply; pur.status = pur.amountPaid >= pur.totalAmount ? 'paid' : 'partial';
      await supabase.from('purchases').update({ amountPaid: pur.amountPaid, status: pur.status }).eq('poNumber', pur.poNumber).eq('store_id', currentStoreId);
    }
  } else if (type.startsWith('single:')) {
    const poId = type.split(':')[1]; const pur = purchasesArray.find(p => p.poNumber === poId);
    if (pur) {
      let due = (pur.totalAmount || 0) - (pur.amountPaid || 0);
      if (amtVal > due) { toast('Remittance value overflow detected.', 'error'); setButtonLoading(btn, false, 'Retry'); return; }
      pur.amountPaid = (pur.amountPaid || 0) + amtVal; pur.status = pur.amountPaid >= pur.totalAmount ? 'paid' : 'partial';
      await supabase.from('purchases').update({ amountPaid: pur.amountPaid, status: pur.status }).eq('poNumber', poId).eq('store_id', currentStoreId);
    }
  }

  closeModal(); toast('Supplier ledger updated successfully!', 'success');
  if (typeof syncUI === 'function') syncUI(); else renderSupplierGrid();
  openSupplierLedger(suppId);
}

// ─── PROFILE BASICS ───
function openAddSupplier() {
  document.getElementById('modalTitle').textContent = 'Add Supplier Profile';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label class="form-label">Supplier Name</label><input type="text" class="form-control" id="nsName" placeholder="Supplier name"></div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" id="nsPhone" placeholder="+91 00000 00000"></div>
      <div class="form-group"><label class="form-label">Payment Terms</label><input type="text" class="form-control" id="nsPay" placeholder="e.g. Net 30"></div>
    </div>
    <div class="form-group"><label class="form-label">GSTIN (Optional)</label><input type="text" class="form-control" id="nsGstin" placeholder="22AAAAA0000A1Z5" style="text-transform:uppercase"></div>
    <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" id="nsAddr" placeholder="Address..."></textarea></div>
    <div style="margin-top:16px"><button class="btn btn-primary" id="saveSupplierBtn" onclick="addSupplierLocal()"><i class="fas fa-plus"></i> Add Supplier</button></div>`;
  document.getElementById('detailModal').classList.add('open');
}
async function addSupplierLocal() {
  const name = document.getElementById('nsName').value.trim(); if (!name) { toast('Enter a supplier name', 'error'); return; }
  const btn = document.getElementById('saveSupplierBtn'); setButtonLoading(btn, true, 'Saving...');
  const id = 'SUPP-' + Date.now().toString().slice(-6); const phone = document.getElementById('nsPhone').value.trim(); const gstin = document.getElementById('nsGstin').value.trim().toUpperCase(); const address = document.getElementById('nsAddr').value.trim(); const paymentTerms = document.getElementById('nsPay').value.trim();
  suppliersArray.push({ id, name, phone, gstin, address, paymentTerms, advanceBalance: 0 });
  closeModal(); if (typeof syncUI === 'function') syncUI(); else renderSupplierGrid();
  await supabase.from('suppliers').insert([{ id, store_id: currentStoreId, name, phone, gstin, address, payment_terms: paymentTerms, advanceBalance: 0 }]);
  toast('Vendor created securely.', 'success');
}
function openEditSupplier(id) {
  const s = suppliersArray.find(x => x.id === id); if (!s) return;
  document.getElementById('modalTitle').textContent = 'Edit Supplier Data';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label class="form-label">Supplier Name</label><input type="text" class="form-control" id="esName" value="${esc(s.name)}"></div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" id="esPhone" value="${esc(s.phone||'')}"></div>
      <div class="form-group"><label class="form-label">Payment Terms</label><input type="text" class="form-control" id="esPay" value="${esc(s.paymentTerms||'')}"></div>
    </div>
    <div class="form-group"><label class="form-label">GSTIN</label><input type="text" class="form-control" id="esGstin" value="${esc(s.gstin||'')}" style="text-transform:uppercase"></div>
    <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" id="esAddr">${esc(s.address||'')}</textarea></div>
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-primary" id="editSupplierSaveBtn" onclick="saveEditSupplier('${esc(id)}')"><i class="fas fa-save"></i> Save Changes</button>
      <button class="btn btn-danger btn-sm" onclick="deleteSupplier('${esc(id)}')"><i class="fas fa-trash"></i> Delete</button>
    </div>`;
  document.getElementById('detailModal').classList.add('open');
}
async function saveEditSupplier(id) {
  const s = suppliersArray.find(x => x.id === id); if (!s) return;
  const name = document.getElementById('esName').value.trim(); if (!name) { toast('Name cannot be empty', 'error'); return; }
  const btn = document.getElementById('editSupplierSaveBtn'); setButtonLoading(btn, true, 'Updating...');
  const oldName = s.name; s.name = name; s.phone = document.getElementById('esPhone').value.trim(); s.gstin = document.getElementById('esGstin').value.trim().toUpperCase(); s.address = document.getElementById('esAddr').value.trim(); s.paymentTerms = document.getElementById('esPay').value.trim();
  if (oldName.toLowerCase() !== name.toLowerCase()) { purchasesArray.forEach(p => { if ((p.supplier||'').toLowerCase() === oldName.toLowerCase()) { p.supplier = name; supabase.from('purchases').update({ supplier: name }).eq('poNumber', p.poNumber).eq('store_id', currentStoreId).then(); } }); }
  closeModal(); if (typeof syncUI === 'function') syncUI(); else renderSupplierGrid();
  await supabase.from('suppliers').update({ name: s.name, phone: s.phone, gstin: s.gstin, address: s.address, payment_terms: s.paymentTerms }).eq('id', id).eq('store_id', currentStoreId);
  toast('Changes saved successfully.', 'success');
}
async function deleteSupplier(id) {
  const idx = suppliersArray.findIndex(x => x.id === id); if (idx === -1) return;
  if (!confirm(`DeleteSupplier ${suppliersArray[idx].name}?`)) return;
  suppliersArray.splice(idx, 1); closeModal(); if (typeof syncUI === 'function') syncUI(); else renderSupplierGrid();
  await supabase.from('suppliers').delete().eq('id', id).eq('store_id', currentStoreId);
  toast('Supplier removed.', 'success');
}