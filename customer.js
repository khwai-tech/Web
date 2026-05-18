// ─── CUSTOMERS DIRECTORY ─────────────────────────────
function renderCustomerGrid() {
  const grid = document.getElementById('customerGrid');
  if (!grid) return;
  const q = (document.getElementById('customerSearch')?.value || '').toLowerCase();
  const sortMode = document.getElementById('customerSort')?.value || 'recent';

  const invSummary = {};
  invoicesArray.forEach(i => {
    const key = (i.customerName || '').toLowerCase();
    if (!invSummary[key]) invSummary[key] = { count: 0, total: 0 };
    invSummary[key].count++; invSummary[key].total += (i.grandTotal || 0);
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
      const sumA = invSummary[(a.name||'').toLowerCase()]?.total || 0;
      const sumB = invSummary[(b.name||'').toLowerCase()]?.total || 0;
      return sumB - sumA;
    }
    return 0; // 'recent'
  });

  if (!filtered.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-users"></i><p>No customers found</p></div>'; return; }

  grid.innerHTML = filtered.map(c => {
    const summ = invSummary[(c.name||'').toLowerCase()] || { count: 0, total: 0 };
    return `<div class="customer-card">
      <div class="card-body-left">
        <div style="width: 100%;">
          <div class="customer-name" style="cursor:pointer" onclick="openCustomerLedger('${esc(c.id)}')"><i class="fas fa-user-circle" style="color:var(--accent2);margin-right:6px"></i>${esc(c.name)}</div>
          ${c.phone ? `<div class="customer-detail"><i class="fas fa-phone" style="margin-right:6px; color:var(--ink3)"></i>${esc(c.phone)}</div>` : ''}
          ${c.email ? `<div class="customer-detail"><i class="fas fa-envelope" style="margin-right:6px; color:var(--ink3)"></i>${esc(c.email)}</div>` : ''}
          
          <div class="extra-details">
            ${c.gstin ? `<div class="customer-detail"><i class="fas fa-id-card" style="margin-right:6px; color:var(--ink3)"></i><strong>GSTIN:</strong> ${esc(c.gstin)}</div>` : ''}
            ${c.address ? `<div class="customer-detail" style="margin-top:6px;"><i class="fas fa-map-marker-alt" style="margin-right:6px; color:var(--ink3)"></i>${esc(c.address)}</div>` : ''}
          </div>
        </div>
      </div>
      <div class="card-body-right" style="border-top:1px solid var(--border); padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
        <div style="cursor:pointer" onclick="openCustomerLedger('${esc(c.id)}')">
          <div style="font-size:0.75rem;color:var(--ink2);">Total Billed</div>
          <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:1.1rem;color:var(--accent)">${fmt(summ.total)}</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="openEditCustomer('${esc(c.id)}')"><i class="fas fa-pen"></i> Edit</button>
      </div>
    </div>`;
  }).join('');
}

function filterCustomers() { renderCustomerGrid(); }

function openAddCustomer() {
  document.getElementById('modalTitle').textContent = 'Add Customer';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-control" id="ncName" placeholder="Customer name"></div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="ncEmail" placeholder="email@example.com"></div>
      <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" id="ncPhone" placeholder="+91 00000 00000"></div>
    </div>
    <div class="form-group"><label class="form-label">GSTIN (Optional)</label><input type="text" class="form-control" id="ncGstin" placeholder="22AAAAA0000A1Z5" style="text-transform:uppercase"></div>
    <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" id="ncAddr" placeholder="Address..."></textarea></div>
    <div style="margin-top:16px"><button class="btn btn-primary" onclick="addCustomerLocal()"><i class="fas fa-user-plus"></i> Add Customer</button></div>`;
  document.getElementById('detailModal').classList.add('open');
}

async function addCustomerLocal() {
  const name = document.getElementById('ncName').value.trim();
  if (!name) { toast('Enter a name', 'error'); return; }
  
  const c = { 
    id: 'CUST-' + Date.now().toString().slice(-6), 
    store_id: currentStoreId,
    name: name, 
    email: document.getElementById('ncEmail').value.trim(), 
    phone: document.getElementById('ncPhone').value.trim(), 
    gstin: document.getElementById('ncGstin').value.trim().toUpperCase(), 
    address: document.getElementById('ncAddr').value.trim() 
    
  };
  
  // Update screen instantly
  customersArray.push(c); 
  updateDatalists(); 
  closeModal(); 
  renderCustomerGrid();
  
  toast(`Syncing ${name} to Supabase...`, 'warn');
  
  // (Inside customer.js) ...
  
  // Find the button (Make sure your Add Customer HTML button has id="saveCustomerBtn")
  const btn = document.getElementById('saveCustomerBtn');
  setButtonLoading(btn, true); // Starts the spinning animation
  
  // Push to Supabase database
  const { error } = await supabase.from('customers').insert([c]);
  
  setButtonLoading(btn, false, '<i class="fas fa-user-plus"></i> Add Customer'); // Stops the spinner
  
  if (error) {
    console.error("Supabase Error:", error);
    toast('Failed to save to cloud.', 'error');
  } else {
    toast('Customer saved permanently!', 'success');
  }
}


function openEditCustomer(id) {
  const c = customersArray.find(x => String(x.id) === String(id));
  if (!c) return;
  document.getElementById('modalTitle').textContent = 'Edit Customer';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-control" id="ecName" value="${esc(c.name)}"></div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="ecEmail" value="${esc(c.email||'')}"></div>
      <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" id="ecPhone" value="${esc(c.phone||'')}"></div>
    </div>
    <div class="form-group"><label class="form-label">GSTIN</label><input type="text" class="form-control" id="ecGstin" value="${esc(c.gstin||'')}" style="text-transform:uppercase"></div>
    <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" id="ecAddr">${esc(c.address||'')}</textarea></div>
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" onclick="saveEditCustomer('${esc(id)}')"><i class="fas fa-save"></i> Save Changes</button><button class="btn btn-danger btn-sm" onclick="deleteCustomer('${esc(id)}')"><i class="fas fa-trash"></i> Delete</button></div>`;
  document.getElementById('detailModal').classList.add('open');
}

async function saveEditCustomer(id) {
  const c = customersArray.find(x => String(x.id) === String(id));
  if (!c) return;
  
  const name = document.getElementById('ecName').value.trim();
  if (!name) { toast('Name cannot be empty', 'error'); return; }
  
  const oldName = c.name;
  c.name = name; 
  c.email = document.getElementById('ecEmail').value.trim(); 
  c.phone = document.getElementById('ecPhone').value.trim(); 
  c.gstin = document.getElementById('ecGstin').value.trim().toUpperCase(); 
  c.address = document.getElementById('ecAddr').value.trim();
  
  if (oldName.toLowerCase() !== name.toLowerCase()) { 
    invoicesArray.forEach(i => { 
      if (i.customerName.toLowerCase() === oldName.toLowerCase()) {
        i.customerName = name;
        supabase.from('invoices').update({ customerName: name }).eq('invoiceId', i.invoiceId).eq('store_id', currentStoreId).then();
      }
    }); 
  }
  
  updateDatalists(); closeModal(); renderCustomerGrid();
  
  toast('Updating cloud...', 'info');
  const dbPayload = { name: c.name, email: c.email, phone: c.phone, gstin: c.gstin, address: c.address };
  const { error } = await supabase.from('customers').update(dbPayload).eq('id', id).eq('store_id', currentStoreId);
  
  if (error) toast('Cloud update failed.', 'error');
  else toast(`${name} updated successfully`, 'success');
}

async function deleteCustomer(id) {
  const idx = customersArray.findIndex(x => String(x.id) === String(id));
  if (idx === -1) return;
  if (!confirm(`Delete ${customersArray[idx].name}? Their invoice history will remain.`)) return;
  
  const [removed] = customersArray.splice(idx, 1); 
  updateDatalists(); closeModal(); renderCustomerGrid();
  
  toast('Deleting from cloud...', 'warn');
  const { error } = await supabase.from('customers').delete().eq('id', id).eq('store_id', currentStoreId);
  
  if (error) toast('Delete failed.', 'error');
  else toast(`${removed.name} deleted permanently`, 'success');
}

