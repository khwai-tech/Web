// ══════════════════════════════════════════════════════════════
//        CUSTOMERS MODULE (SUB-TAB ACCOUNT STATEMENT ENG)
// ══════════════════════════════════════════════════════════════

function renderCustomerGrid() {
  const container = document.getElementById('customerGrid');
  if (!container) return;
  
  const q = (document.getElementById('customerSearch')?.value || '').toLowerCase();
  const sortMode = document.getElementById('customerSort')?.value || 'recent';
  const viewType = localStorage.getItem('bs_view_customer') || 'grid';

  const invSummary = {};
  invoicesArray.forEach(i => {
    if (i.status === 'draft') return;
    const key = (i.customerName || '').toLowerCase();
    if (!invSummary[key]) invSummary[key] = { billed: 0, paid: 0 };
    invSummary[key].billed += (i.grandTotal || 0);
    invSummary[key].paid += (i.amountPaid || 0);
  });

  let filtered = customersArray.filter(c => 
    (c.name || '').toLowerCase().includes(q) || 
    (c.email || '').toLowerCase().includes(q) ||
    (c.phone || '').includes(q)
  );

  filtered.sort((a, b) => {
    if (sortMode === 'nameAsc') return a.name.localeCompare(b.name);
    if (sortMode === 'nameDesc') return b.name.localeCompare(a.name);
    if (sortMode === 'billedDesc') {
      const sumA = invSummary[(a.name || '').toLowerCase()]?.billed || 0;
      const sumB = invSummary[(b.name || '').toLowerCase()]?.billed || 0;
      return sumB - sumA;
    }
    return 0; 
  });

  container.className = `view-container view-${viewType}`;

  if (!filtered.length) { 
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-users"></i><p>No customers found</p></div>'; 
    return; 
  }

  if (viewType === 'table') {
    container.innerHTML = `
      <table class="invoice-table" style="width:100%">
        <thead>
          <tr>
            <th>Customer Name</th>
            <th>Email Address</th>
            <th>Phone Number</th>
            <th style="text-align:right">Total Billed</th>
            <th style="text-align:right">Outstanding</th>
            <th style="text-align:right">Advance Bal.</th>
            <th style="text-align:center; width:150px">Statement</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(c => {
            const summ = invSummary[(c.name || '').toLowerCase()] || { billed: 0, paid: 0 };
            const outstanding = Math.max(0, summ.billed - summ.paid);
            const advBal = c.advanceBalance || 0;
            return `
              <tr>
                <td style="font-weight:600; color:var(--ink); cursor:pointer;" onclick="openCustomerLedger('${esc(c.id)}')"><i class="fas fa-user-circle" style="color:var(--accent2); margin-right:6px"></i>${esc(c.name)}</td>
                <td>${esc(c.email) || '-'}</td>
                <td>${esc(c.phone) || '-'}</td>
                <td style="text-align:right; font-weight:600">₹${fmt(summ.billed)}</td>
                <td style="text-align:right; font-weight:700; color:${outstanding > 0 ? 'var(--danger)' : 'var(--accent2)'}">₹${fmt(outstanding)}</td>
                <td style="text-align:right; font-weight:600; color:var(--info)">₹${fmt(advBal)}</td>
                <td style="text-align:center;">
                  <button class="btn btn-secondary btn-sm" style="padding:4px 8px;" onclick="openCustomerLedger('${esc(c.id)}')"><i class="fas fa-eye"></i> Open Ledger</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } else {
    container.innerHTML = filtered.map(c => {
      const summ = invSummary[(c.name || '').toLowerCase()] || { billed: 0, paid: 0 };
      const outstanding = Math.max(0, summ.billed - summ.paid);
      const advBal = c.advanceBalance || 0;
      return `
        <div class="contact-card" style="cursor:pointer;" onclick="openCustomerLedger('${esc(c.id)}')">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%; gap:12px;">
            <div>
              <div style="font-weight:700; color:var(--ink); font-size:1.05rem; margin-bottom:4px;">${esc(c.name)}</div>
              <div style="font-size:0.825rem; color:var(--ink2); display:flex; flex-direction:column; gap:2px;">
                ${c.phone ? `<span><i class="fas fa-phone" style="width:16px; color:var(--ink3)"></i>${esc(c.phone)}</span>` : ''}
                ${c.email ? `<span><i class="fas fa-envelope" style="width:16px; color:var(--ink3)"></i>${esc(c.email)}</span>` : ''}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.7rem; text-transform:uppercase; color:var(--ink3); font-weight:600;">Net Balance Due</div>
              <div style="font-size:1.1rem; font-weight:800; color:${outstanding > 0 ? 'var(--danger)' : 'var(--accent2)'}">₹${fmt(outstanding)}</div>
              ${advBal > 0 ? `<div style="font-size:0.75rem; color:var(--info); font-weight:700; margin-top:2px;">Advance: ₹${fmt(advBal)}</div>` : ''}
            </div>
          </div>
          <div style="border-top:1px solid var(--border); padding-top:10px; margin-top:4px; display:flex; justify-content:space-between; align-items:center; width:100%;">
            <span style="font-size:0.7rem; color:var(--ink3)">Click to view statement tab</span>
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openEditCustomer('${esc(c.id)}')"><i class="fas fa-pen"></i> Edit</button>
          </div>
        </div>
      `;
    }).join('');
  }
}

function filterCustomers() { renderCustomerGrid(); }

// ─── LEDGER TAB CONTROLLER ACTIONS ───
function openCustomerLedger(id) {
  const c = customersArray.find(x => String(x.id) === String(id));
  if (!c) return;

  const ledgerEntries = [];
  const clientInvoices = invoicesArray.filter(i => (i.customerName || '').toLowerCase() === c.name.toLowerCase() && i.status !== 'draft');
  
  let totalBilled = 0, totalPaid = 0;
  clientInvoices.forEach(i => {
    totalBilled += parseFloat(i.grandTotal || 0);
    totalPaid += parseFloat(i.amountPaid || 0);

    ledgerEntries.push({ date: i.date || today(), type: 'Sales Invoice', ref: i.invoiceId, billed: parseFloat(i.grandTotal || 0), paid: 0 });
    if (parseFloat(i.amountPaid || 0) > 0) {
      ledgerEntries.push({ date: i.date || today(), type: 'Payment Receipt', ref: i.invoiceId, billed: 0, paid: parseFloat(i.amountPaid || 0) });
    }
  });

  if (parseFloat(c.advanceBalance || 0) > 0) {
    ledgerEntries.push({ date: today(), type: 'Advance Credit Deposit', ref: 'ADV-BAL', billed: 0, paid: parseFloat(c.advanceBalance || 0) });
  }

  ledgerEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
  const netOutstanding = Math.max(0, totalBilled - totalPaid);
  let runningBalance = 0;

  // Render directly into the sub-tab panel container rather than modal popups
  document.getElementById('customerLedgerContent').innerHTML = `
    <div style="background:var(--surface2); padding:16px; border-radius:var(--r-md); border:1px solid var(--border); margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
      <div>
        <h3 style="margin:0; color:var(--ink); font-size:1.2rem;">${esc(c.name)}</h3>
        <p style="margin:4px 0 0; font-size:0.8rem; color:var(--ink2);"><i class="fas fa-phone"></i> ${esc(c.phone || 'N/A')} &nbsp;|&nbsp; <i class="fas fa-envelope"></i> ${esc(c.email || 'N/A')}</p>
      </div>
      <div style="display:flex; gap:16px; text-align:right;">
        <div><div style="font-size:0.7rem; color:var(--ink3); text-transform:uppercase; font-weight:600;">Total Invoiced</div><div style="font-size:1.1rem; font-weight:700;">₹${fmt(totalBilled)}</div></div>
        <div><div style="font-size:0.7rem; color:var(--ink3); text-transform:uppercase; font-weight:600; color:var(--danger)">Net Due</div><div style="font-size:1.1rem; font-weight:800; color:var(--danger)">₹${fmt(netOutstanding)}</div></div>
        <div><div style="font-size:0.7rem; color:var(--ink3); text-transform:uppercase; font-weight:600; color:var(--info)">Advance Bal.</div><div style="font-size:1.1rem; font-weight:800; color:var(--info)">₹${fmt(c.advanceBalance || 0)}</div></div>
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <h4 style="margin:0; font-size:0.95rem; color:var(--ink);"><i class="fas fa-list-alt"></i> Running Balance Statement Record</h4>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="closeCustomerLedger()"><i class="fas fa-arrow-left"></i> Back to Directory</button>
        <button class="btn btn-primary btn-sm" onclick="openCustomerPaymentForm('${esc(id)}')"><i class="fas fa-hand-holding-usd"></i> Record Payment / Advance</button>
      </div>
    </div>

    <div class="items-table-wrap" style="border:1px solid var(--border); border-radius:var(--r-sm)">
      <table class="items-table" style="width:100%; font-size:0.85rem;">
        <thead>
          <tr>
            <th>Date</th>
            <th>Transaction Type</th>
            <th>Ref ID</th>
            <th style="text-align:right">Debit (Billed)</th>
            <th style="text-align:right">Credit (Paid)</th>
            <th style="text-align:right">Running Balance</th>
          </tr>
        </thead>
        <tbody>
          ${ledgerEntries.length ? ledgerEntries.map(e => {
            if (e.type === 'Sales Invoice') runningBalance += e.billed;
            else runningBalance -= e.paid;
            return `
              <tr style="background:${e.billed > 0 ? 'transparent' : 'var(--accent-light)'}">
                <td>${dateLabel(e.date)}</td>
                <td style="font-weight:600; color:${e.billed > 0 ? 'var(--ink)' : 'var(--accent2)'}">${esc(e.type)}</td>
                <td style="font-family:monospace; font-weight:600;">${esc(e.ref)}</td>
                <td style="text-align:right; font-weight:600;">${e.billed > 0 ? '₹' + fmt(e.billed) : '-'}</td>
                <td style="text-align:right; font-weight:600; color:var(--accent2);">${e.paid > 0 ? '₹' + fmt(e.paid) : '-'}</td>
                <td style="text-align:right; font-weight:700; color:${runningBalance > 0 ? 'var(--danger)' : 'var(--accent2)'}">₹${fmt(Math.max(0, runningBalance))}</td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--ink3)">No transaction history logged.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  // Toggle tab selector targets
  const tab = document.getElementById('tabCustomerLedger');
  const dirPane = document.getElementById('customerDirectory');
  const ledPane = document.getElementById('customerLedger');
  
  if (tab) {
    tab.style.display = 'inline-block';
    tab.textContent = `Ledger: ${c.name}`;
    tab.click();
  }
  if (dirPane) dirPane.style.display = 'none';
  if (ledPane) ledPane.style.display = 'block';
}

function closeCustomerLedger() {
  const tab = document.getElementById('tabCustomerLedger');
  if (tab) tab.style.display = 'none';
  
  const dirPane = document.getElementById('customerDirectory');
  const ledPane = document.getElementById('customerLedger');
  if (dirPane) dirPane.style.display = 'block';
  if (ledPane) ledPane.style.display = 'none';
  
  document.querySelectorAll('#customerTabsBar .sec-tab').forEach(b => b.classList.remove('active'));
  const dirBtn = document.querySelector('#customerTabsBar .sec-tab[data-stab="customerDirectory"]');
  if (dirBtn) dirBtn.classList.add('active');
}

// ─── INTERACTIVE MODAL PAYMENT ENTRY OVERRIDES ───
function openCustomerPaymentForm(id) {
  const c = customersArray.find(x => String(x.id) === String(id));
  if (!c) return;

  const clientInvoices = invoicesArray.filter(i => (i.customerName || '').toLowerCase() === c.name.toLowerCase() && i.status !== 'paid' && i.status !== 'draft');
  let totalOutstanding = 0;
  clientInvoices.forEach(i => totalOutstanding += ((i.grandTotal || 0) - (i.amountPaid || 0)));

  document.getElementById('modalTitle').innerHTML = `<i class="fas fa-money-check-alt" style="color:var(--accent)"></i> Record Ledger Receipt Entry`;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label class="form-label">Payment Allocation Mode</label>
      <select class="form-control" id="pmtType" onchange="togglePmtInvoiceSelection(this)">
        ${totalOutstanding > 0 ? `<option value="fifo">Clear Outstanding Balance (FIFO Allocation)</option>` : ''}
        <option value="advance">Pure Advance Payment (Adds to Credit Float)</option>
        ${clientInvoices.map(i => `<option value="single:${esc(i.invoiceId)}">Invoice Settlement: ${esc(i.invoiceId)} (Due: ₹${fmt((i.grandTotal||0)-(i.amountPaid||0))})</option>`).join('')}
      </select>
    </div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Transaction Date</label><input type="date" class="form-control" id="pmtDate" value="${today()}"></div>
      <div class="form-group">
        <label class="form-label">Payment Mode</label>
        <select class="form-control" id="pmtMode"><option value="Cash">Cash Inflow</option><option value="Bank Transfer">Bank Wire</option><option value="UPI">UPI Payment</option></select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Receipt Amount Value (INR)</label>
      <input type="number" class="form-control" id="pmtAmount" placeholder="0.00" min="0.01" step="0.01" value="${totalOutstanding > 0 ? totalOutstanding.toFixed(2) : ''}">
    </div>
    <div style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Cancel</button>
      <button class="btn btn-primary" id="processPmtBtn" onclick="submitCustomerPaymentTransaction('${esc(id)}')"><i class="fas fa-check-circle"></i> Complete Entry</button>
    </div>
  `;
  document.getElementById('detailModal').classList.add('open');
}

function togglePmtInvoiceSelection(selectElement) {
  const val = selectElement.value; const idInput = document.getElementById('pmtAmount'); if (!idInput) return;
  if (val.startsWith('single:')) {
    const invId = val.split(':')[1]; const inv = invoicesArray.find(i => i.invoiceId === invId);
    if (inv) idInput.value = ((inv.grandTotal || 0) - (inv.amountPaid || 0)).toFixed(2);
  }
}

async function submitCustomerPaymentTransaction(customerId) {
  const c = customersArray.find(x => x.id === customerId); if (!c) return;
  const type = document.getElementById('pmtType').value;
  const amtVal = parseFloat(document.getElementById('pmtAmount').value) || 0;
  if (amtVal <= 0) { toast('Please input a receipt value exceeding zero.', 'error'); return; }

  const btn = document.getElementById('processPmtBtn'); setButtonLoading(btn, true, 'Processing...');
  let remaining = amtVal;

  if (type === 'advance') {
    c.advanceBalance = (c.advanceBalance || 0) + amtVal;
    await supabase.from('customers').update({ advanceBalance: c.advanceBalance }).eq('id', customerId).eq('store_id', currentStoreId);
  } else if (type === 'fifo') {
    let unpaid = invoicesArray.filter(i => (i.customerName || '').toLowerCase() === c.name.toLowerCase() && i.status !== 'paid' && i.status !== 'draft');
    unpaid.sort((a, b) => new Date(a.date) - new Date(b.date));
    for (let inv of unpaid) {
      if (remaining <= 0) break; let due = (inv.grandTotal || 0) - (inv.amountPaid || 0); let apply = Math.min(remaining, due);
      inv.amountPaid = (inv.amountPaid || 0) + apply; remaining -= apply; inv.status = inv.amountPaid >= inv.grandTotal ? 'paid' : 'partial';
      await supabase.from('invoices').update({ amountPaid: inv.amountPaid, status: inv.status }).eq('invoiceId', inv.invoiceId).eq('store_id', currentStoreId);
    }
  } else if (type.startsWith('single:')) {
    const invId = type.split(':')[1]; const inv = invoicesArray.find(i => i.invoiceId === invId);
    if (inv) {
      let due = (inv.grandTotal || 0) - (inv.amountPaid || 0);
      if (amtVal > due) { toast('Value overflow constraints.', 'error'); setButtonLoading(btn, false, 'Retry'); return; }
      inv.amountPaid = (inv.amountPaid || 0) + amtVal; inv.status = inv.amountPaid >= inv.grandTotal ? 'paid' : 'partial';
      await supabase.from('invoices').update({ amountPaid: inv.amountPaid, status: inv.status }).eq('invoiceId', invId).eq('store_id', currentStoreId);
    }
  }

  closeModal(); toast('Payment ledger synchronized!', 'success');
  if (typeof syncUI === 'function') syncUI(); else renderCustomerGrid();
  openCustomerLedger(customerId);
}

// ─── PROFILE BASICS ───
function openAddCustomer() {
  document.getElementById('modalTitle').textContent = 'Add New Customer';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-control" id="ncName" placeholder="Customer name"></div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="ncEmail" placeholder="email@example.com"></div>
      <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" id="ncPhone" placeholder="+91 00000 00000"></div>
    </div>
    <div class="form-group"><label class="form-label">GSTIN (Optional)</label><input type="text" class="form-control" id="ncGstin" placeholder="22AAAAA0000A1Z5" style="text-transform:uppercase"></div>
    <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" id="ncAddr" placeholder="Address..."></textarea></div>
    <div style="margin-top:16px"><button class="btn btn-primary" id="saveCustomerBtn" onclick="addCustomerLocal()"><i class="fas fa-user-plus"></i> Add Customer</button></div>`;
  document.getElementById('detailModal').classList.add('open');
}
async function addCustomerLocal() {
  const name = document.getElementById('ncName').value.trim(); if (!name) { toast('Enter a name', 'error'); return; }
  const btn = document.getElementById('saveCustomerBtn'); setButtonLoading(btn, true, 'Saving...');
  const c = { id: 'CUST-' + Date.now().toString().slice(-6), store_id: currentStoreId, name: name, email: document.getElementById('ncEmail').value.trim(), phone: document.getElementById('ncPhone').value.trim(), gstin: document.getElementById('ncGstin').value.trim().toUpperCase(), address: document.getElementById('ncAddr').value.trim(), advanceBalance: 0 };
  customersArray.push(c); closeModal(); if (typeof syncUI === 'function') syncUI(); else renderCustomerGrid();
  await supabase.from('customers').insert([c]); toast('Profile registered.', 'success');
}
function openEditCustomer(id) {
  const c = customersArray.find(x => String(x.id) === String(id)); if (!c) return;
  document.getElementById('modalTitle').textContent = 'Edit Customer';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-control" id="ecName" value="${esc(c.name)}"></div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="ecEmail" value="${esc(c.email || '')}"></div>
      <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" id="ecPhone" value="${esc(c.phone || '')}"></div>
    </div>
    <div class="form-group"><label class="form-label">GSTIN</label><input type="text" class="form-control" id="ecGstin" value="${esc(c.gstin || '')}" style="text-transform:uppercase"></div>
    <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" id="ecAddr">${esc(c.address || '')}</textarea></div>
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-primary" id="editCustomerSaveBtn" onclick="saveEditCustomer('${esc(id)}')"><i class="fas fa-save"></i> Save Changes</button>
      <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${esc(id)}')"><i class="fas fa-trash"></i> Delete</button>
    </div>`;
  document.getElementById('detailModal').classList.add('open');
}
async function saveEditCustomer(id) {
  const c = customersArray.find(x => String(x.id) === String(id)); if (!c) return;
  const name = document.getElementById('ecName').value.trim(); if (!name) { toast('Name cannot be empty', 'error'); return; }
  const btn = document.getElementById('editCustomerSaveBtn'); setButtonLoading(btn, true, 'Saving...');
  const oldName = c.name; c.name = name; c.email = document.getElementById('ecEmail').value.trim(); c.phone = document.getElementById('ecPhone').value.trim(); c.gstin = document.getElementById('ecGstin').value.trim().toUpperCase(); c.address = document.getElementById('ecAddr').value.trim();
  if (oldName.toLowerCase() !== name.toLowerCase()) { invoicesArray.forEach(i => { if (i.customerName.toLowerCase() === oldName.toLowerCase()) { i.customerName = name; supabase.from('invoices').update({ customerName: name }).eq('invoiceId', i.invoiceId).eq('store_id', currentStoreId).then(); } }); }
  closeModal(); if (typeof syncUI === 'function') syncUI(); else renderCustomerGrid();
  await supabase.from('customers').update({ name: c.name, email: c.email, phone: c.phone, gstin: c.gstin, address: c.address }).eq('id', id).eq('store_id', currentStoreId);
  toast('Profile data saved.', 'success');
}
async function deleteCustomer(id) {
  const idx = customersArray.findIndex(x => String(x.id) === String(id)); if (idx === -1) return;
  if (!confirm(`Delete ${customersArray[idx].name}?`)) return;
  customersArray.splice(idx, 1); closeModal(); if (typeof syncUI === 'function') syncUI(); else renderCustomerGrid();
  await supabase.from('customers').delete().eq('id', id).eq('store_id', currentStoreId);
  toast('Customer removed.', 'success');
}