// ─── SUPPLIERS DIRECTORY ─────────────────────────────
function renderSupplierGrid() {
  const grid = document.getElementById('supplierGrid');
  if (!grid) return;
  const q = (document.getElementById('supplierSearch')?.value || '').toLowerCase();
  const sortMode = document.getElementById('supplierSort')?.value || 'recent';

  const purSummary = {};
  purchasesArray.forEach(p => {
    const key = (p.supplier || '').toLowerCase();
    if (!purSummary[key]) purSummary[key] = { count: 0, total: 0 };
    purSummary[key].count++; purSummary[key].total += (p.totalAmount || 0);
  });

  let filtered = suppliersArray.filter(s => (s.name || '').toLowerCase().includes(q) || (s.phone || '').includes(q));

  filtered.sort((a, b) => {
    if (sortMode === 'nameAsc') return a.name.localeCompare(b.name);
    if (sortMode === 'nameDesc') return b.name.localeCompare(a.name);
    if (sortMode === 'purchasedDesc') {
      const sumA = purSummary[(a.name||'').toLowerCase()]?.total || 0;
      const sumB = purSummary[(b.name||'').toLowerCase()]?.total || 0;
      return sumB - sumA;
    }
    return 0; // 'recent'
  });

  if (!filtered.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-building"></i><p>No suppliers found</p></div>'; return; }

  grid.innerHTML = filtered.map(s => {
    const summ = purSummary[(s.name||'').toLowerCase()] || { count: 0, total: 0 };
    return `<div class="customer-card">
      <div class="card-body-left">
        <div style="width: 100%;">
          <div class="customer-name"><i class="fas fa-building" style="color:var(--gold);margin-right:6px"></i>${esc(s.name)}</div>
          ${s.phone ? `<div class="customer-detail"><i class="fas fa-phone" style="margin-right:6px; color:var(--ink3)"></i>${esc(s.phone)}</div>` : ''}
          ${s.paymentTerms ? `<div class="customer-detail"><i class="fas fa-clock" style="margin-right:6px; color:var(--ink3)"></i>${esc(s.paymentTerms)}</div>` : ''}
          
          <div class="extra-details">
            ${s.gstin ? `<div class="customer-detail"><i class="fas fa-id-card" style="margin-right:6px; color:var(--ink3)"></i><strong>GSTIN:</strong> ${esc(s.gstin)}</div>` : ''}
            ${s.address ? `<div class="customer-detail" style="margin-top:6px;"><i class="fas fa-map-marker-alt" style="margin-right:6px; color:var(--ink3)"></i>${esc(s.address)}</div>` : ''}
          </div>
        </div>
      </div>
      <div class="card-body-right" style="border-top:1px solid var(--border); padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.75rem;color:var(--ink2);">Total Spend</div>
          <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:1.1rem;color:var(--gold)">${fmt(summ.total)}</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="openEditSupplier('${esc(s.id)}')"><i class="fas fa-pen"></i> Edit</button>
      </div>
    </div>`;
  }).join('');
}

function filterSuppliers() { renderSupplierGrid(); }

function openAddSupplier() {
  document.getElementById('modalTitle').textContent = 'Add Supplier';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label class="form-label">Supplier Name</label><input type="text" class="form-control" id="nsName" placeholder="Supplier / vendor name"></div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" id="nsPhone" placeholder="+91 00000 00000"></div>
      <div class="form-group"><label class="form-label">Payment Terms</label><input type="text" class="form-control" id="nsPay" placeholder="e.g. Net 30"></div>
    </div>
    <div class="form-group"><label class="form-label">GSTIN (Optional)</label><input type="text" class="form-control" id="nsGstin" placeholder="22AAAAA0000A1Z5" style="text-transform:uppercase"></div>
    <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" id="nsAddr" placeholder="Address..."></textarea></div>
    <div style="margin-top:16px"><button class="btn btn-primary" onclick="addSupplierLocal()"><i class="fas fa-plus"></i> Add Supplier</button></div>`;
  document.getElementById('detailModal').classList.add('open');
}

// ══════════════════════════════════════════════
//        SUPABASE SYNC: SUPPLIERS
// ══════════════════════════════════════════════
async function addSupplierLocal() {
  const name = document.getElementById('nsName').value.trim();
  if (!name) { toast('Enter a supplier name', 'error'); return; }
  
  const id = 'SUPP-' + Date.now().toString().slice(-6);
  const phone = document.getElementById('nsPhone').value.trim();
  const gstin = document.getElementById('nsGstin').value.trim().toUpperCase();
  const address = document.getElementById('nsAddr').value.trim();
  const paymentTerms = document.getElementById('nsPay').value.trim();

  suppliersArray.push({ id, name, phone, gstin, address, paymentTerms });
  updateDatalists(); closeModal(); renderSupplierGrid();
  
  toast(`Saving ${name} to cloud...`, 'info');
  const dbPayload = { id, store_id: currentStoreId, name, phone, gstin, address, payment_terms: paymentTerms };
  const { error } = await supabase.from('suppliers').insert([dbPayload]);
  
  if (error) toast('Cloud save failed.', 'error');
  else toast('Supplier saved permanently!', 'success');
}

function openEditSupplier(id) {
  const s = suppliersArray.find(x => x.id === id);
  if (!s) return;
  document.getElementById('modalTitle').textContent = 'Edit Supplier';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label class="form-label">Supplier Name</label><input type="text" class="form-control" id="esName" value="${esc(s.name)}"></div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" id="esPhone" value="${esc(s.phone||'')}"></div>
      <div class="form-group"><label class="form-label">Payment Terms</label><input type="text" class="form-control" id="esPay" value="${esc(s.paymentTerms||'')}"></div>
    </div>
    <div class="form-group"><label class="form-label">GSTIN</label><input type="text" class="form-control" id="esGstin" value="${esc(s.gstin||'')}" style="text-transform:uppercase"></div>
    <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" id="esAddr">${esc(s.address||'')}</textarea></div>
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" onclick="saveEditSupplier('${esc(id)}')"><i class="fas fa-save"></i> Save Changes</button><button class="btn btn-danger btn-sm" onclick="deleteSupplier('${esc(id)}')"><i class="fas fa-trash"></i> Delete</button></div>`;
  document.getElementById('detailModal').classList.add('open');
}


async function saveEditSupplier(id) {
  const s = suppliersArray.find(x => x.id === id);
  if (!s) return;
  
  const name = document.getElementById('esName').value.trim();
  if (!name) { toast('Name cannot be empty', 'error'); return; }
  
  const oldName = s.name;
  s.name = name; 
  s.phone = document.getElementById('esPhone').value.trim(); 
  s.gstin = document.getElementById('esGstin').value.trim().toUpperCase(); 
  s.address = document.getElementById('esAddr').value.trim(); 
  s.paymentTerms = document.getElementById('esPay').value.trim();
  
  if (oldName.toLowerCase() !== name.toLowerCase()) { 
    purchasesArray.forEach(p => { 
      if ((p.supplier||'').toLowerCase() === oldName.toLowerCase()) {
        p.supplier = name; 
        supabase.from('purchases').update({ supplier: name }).eq('poNumber', p.poNumber).eq('store_id', currentStoreId).then();
      }
    }); 
  }
  
  updateDatalists(); closeModal(); renderSupplierGrid();
  
  toast(`Updating cloud...`, 'info');
  const dbPayload = { name: s.name, phone: s.phone, gstin: s.gstin, address: s.address, payment_terms: s.paymentTerms };
  const { error } = await supabase.from('suppliers').update(dbPayload).eq('id', id).eq('store_id', currentStoreId);
  
  if (error) toast('Cloud update failed.', 'error');
  else toast(`${name} updated successfully`, 'success');
}

async function deleteSupplier(id) {
  const idx = suppliersArray.findIndex(x => x.id === id);
  if (idx === -1) return;
  if (!confirm(`Delete ${suppliersArray[idx].name}? Their purchase history will remain.`)) return;
  
  suppliersArray.splice(idx, 1); 
  updateDatalists(); closeModal(); renderSupplierGrid();
  
  toast(`Deleting from cloud...`, 'warn');
  const { error } = await supabase.from('suppliers').delete().eq('id', id).eq('store_id', currentStoreId);
  if (error) toast('Delete failed.', 'error');
  else toast(`Supplier deleted permanently`, 'success');
}