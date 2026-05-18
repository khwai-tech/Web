function fallbackStock() {
  if (!inventoryStock.length) {
    inventoryStock.push(
      { id: 'P001', name: 'Sample Product A', category: 'Electronics', stock: 45, costPrice: 800, sellPrice: 1200, gstRate: 0.18, hsn: '8517' },
      { id: 'P002', name: 'Sample Product B', category: 'Accessories', stock: 8, costPrice: 500, sellPrice: 850, gstRate: 0.12, hsn: '8518' }
    );
  }
  renderInventoryTable(); renderProductGrid(); updateDashboard();
}

function renderInventoryTable(data) {
  const source = data || inventoryStock;
  const tbody = document.getElementById('inventoryTableBody');
  if (!source.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--ink3)">No stock data. Add products or sync from Google Sheets.</td></tr>';
    return;
  }

  const maxStock = Math.max(...source.map(p => p.stock || 0), 1);
  let totalValue = 0, lowCount = 0;

  tbody.innerHTML = source.map(p => {
    const val = (p.stock || 0) * (p.sellPrice || p.costPrice || 0);
    totalValue += val;
    const isLow = (p.stock || 0) <= LOW_STOCK_THRESHOLD;
    const isCrit = (p.stock || 0) === 0;
    if (isLow) lowCount++;
    const pct = Math.round(((p.stock || 0) / maxStock) * 100);
    const barClass = isCrit ? 'critical' : isLow ? 'low' : '';
    const badge = isCrit ? '<span class="badge badge-red">Out of Stock</span>' : isLow ? '<span class="badge badge-gold">Low Stock</span>' : '<span class="badge badge-green">In Stock</span>';
    const margin = p.sellPrice && p.costPrice ? (((p.sellPrice - p.costPrice) / p.sellPrice) * 100).toFixed(0) + '%' : '—';

    return `<tr>
      <td style="font-family:monospace;font-size:0.8rem;color:var(--ink3)">${esc(p.id)}</td>
      <td style="font-weight:600">${esc(p.name)}</td>
      <td style="font-family:'Syne',sans-serif;font-weight:700;font-size:1rem">${p.stock || 0}</td>
      <td><div class="stock-bar-wrap"><div class="stock-bar ${barClass}" style="width:${pct}%"></div></div></td>
      <td>${fmt(p.sellPrice || 0)}</td>
      <td>${fmt(p.costPrice || 0)}</td>
      <td>${((p.gstRate || 0) * 100).toFixed(0)}%</td>
      <td style="font-weight:600;color:var(--accent)">${fmt(val)}</td>
      <td><span style="font-size:0.8rem;font-weight:600;color:${parseFloat(margin) < 20 ? 'var(--gold)' : 'var(--accent2)'}">${margin}</span></td>
      <td>${badge}</td>
    </tr>`;
  }).join('');

  const kpiTotal = document.getElementById('invTotalProducts'); if (kpiTotal) kpiTotal.textContent = source.length;
  const kpiVal = document.getElementById('invTotalValue'); if (kpiVal) kpiVal.textContent = fmt(totalValue);
  const kpiLow = document.getElementById('invLowStockCount'); if (kpiLow) kpiLow.textContent = lowCount;
  const dashLow = document.getElementById('dashLowStock'); if (dashLow) dashLow.textContent = lowCount;
  const banner = document.getElementById('lowStockBanner');
  if (banner) {
    banner.style.display = lowCount > 0 ? 'flex' : 'none';
    const bannerText = document.getElementById('lowStockBannerText');
    if (bannerText) bannerText.textContent = `${lowCount} low stock item${lowCount > 1 ? 's' : ''}`;
  }
}

function filterInventory() {
  const q = document.getElementById('inventorySearch').value.toLowerCase();
  const filtered = inventoryStock.filter(p => (p.name || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q));
  renderInventoryTable(filtered);
}

function refreshInventory() {
  const tbody = document.getElementById('inventoryTableBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:30px"><div class="skeleton skel-line wide" style="margin:0 auto 8px"></div><div class="skeleton skel-line med" style="margin:0 auto"></div></td></tr>`;
  fetchInventoryAndReports();
}

function exportInventoryCSV() {
  const header = 'Product ID,Name,HSN,Stock,Sell Price,Cost Price,GST %,Stock Value,Margin %\n';
  const rows = inventoryStock.map(p => {
    const val = (p.stock || 0) * (p.sellPrice || 0);
    const margin = p.sellPrice && p.costPrice ? (((p.sellPrice - p.costPrice) / p.sellPrice) * 100).toFixed(1) + '%' : '';
    return `${esc(p.id)},"${esc(p.name)}","${esc(p.hsn||'')}",${p.stock || 0},${p.sellPrice || 0},${p.costPrice || 0},${((p.gstRate || 0) * 100).toFixed(0)}%,${val.toFixed(2)},${margin}`;
  }).join('\n');
  downloadCSV(header + rows, 'inventory_' + today() + '.csv');
}

// ─── DYNAMIC CATEGORY FILTER ───────────────────
function populateCategoryFilter() {
  const filter = document.getElementById('productCategoryFilter');
  if (!filter) return;
  const cats = [...new Set(inventoryStock.map(p => p.category).filter(c => c && c.trim() !== ''))].sort();
  const currentVal = filter.value;
  filter.innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (cats.includes(currentVal)) filter.value = currentVal;
}

// ─── HELPER: HIDE STOCK FOR SERVICES ───
function toggleItemType(prefix) {
  const type = document.getElementById(prefix + 'pType').value;
  const stockGroup = document.getElementById(prefix + 'StockGroup');
  if (stockGroup) {
    stockGroup.style.display = type === 'Service' ? 'none' : 'block';
  }
}

// ─── PRODUCTS GRID ─────────────────────────────────
function renderProductGrid(data) {
  const grid = document.getElementById('productGrid');
  const q = (document.getElementById('productSearch')?.value || '').toLowerCase();
  const catFilter = document.getElementById('productCategoryFilter')?.value || 'all';

  populateCategoryFilter();

  const source = (data || inventoryStock).filter(p => {
    const matchesSearch = !q || (p.name || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q) || (p.hsn || '').toLowerCase().includes(q);
    const matchesCat = (catFilter === 'all') || (p.category === catFilter);
    return matchesSearch && matchesCat;
  });

  if (!source.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-tags"></i><p>No products found</p></div>';
    return;
  }

  if (productViewMode === 'list') {
    grid.className = 'product-list';
    grid.innerHTML = source.map(p => {
      const margin = p.sellPrice && p.costPrice ? (((p.sellPrice - p.costPrice) / p.sellPrice) * 100).toFixed(0) + '%' : '—';
      const catBadge = p.category ? `<span class="badge badge-gray" style="margin-left:8px; font-size:0.65rem;">${esc(p.category)}</span>` : '';
      return `<div class="product-card" style="cursor:pointer" onclick="openEditProduct('${esc(p.id)}')">
        <span class="product-card-id">${esc(p.id)}</span>
        <span class="product-card-name">${esc(p.name)} ${catBadge}</span>
        <span class="product-card-price">${fmt(p.sellPrice || 0)}</span>
        <span class="product-card-stock">Cost: ${fmt(p.costPrice || 0)} · Stock: ${p.stock || 0} · Margin: ${margin}</span>
      </div>`;
    }).join('');
  } else {
    grid.className = 'product-grid';
    grid.innerHTML = source.map(p => {
      const margin = p.sellPrice && p.costPrice ? (((p.sellPrice - p.costPrice) / p.sellPrice) * 100).toFixed(0) : null;
      const marginColor = margin !== null && parseInt(margin) < 20 ? 'var(--gold)' : 'var(--accent2)';
      const catBadge = p.category ? `<span class="badge badge-gray" style="font-size:0.65rem;">${esc(p.category)}</span>` : '';
      return `<div class="product-card" style="cursor:pointer" onclick="openEditProduct('${esc(p.id)}')">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <div class="product-card-id">${esc(p.id)} ${p.hsn ? `<span style="color:var(--ink3); font-weight:normal;">(HSN: ${p.hsn})</span>` : ''}</div>
          ${catBadge}
        </div>
        <div class="product-card-name">${esc(p.name)}</div>
        <div class="product-card-price">${fmt(p.sellPrice || 0)}</div>
        <div class="product-card-stock">Cost: ${fmt(p.costPrice || 0)} · GST ${((p.gstRate || 0) * 100).toFixed(0)}%</div>
        <div class="product-card-stock">Stock: ${p.stock || 0} ${margin !== null ? `· <span style="color:${marginColor};font-weight:600">Margin: ${margin}%</span>` : ''}</div>
        ${(p.stock || 0) <= LOW_STOCK_THRESHOLD ? '<span class="badge badge-gold" style="margin-top:8px;display:inline-block">Low Stock</span>' : ''}
      </div>`;
    }).join('');
  }
}

function filterProducts() { renderProductGrid(); }
function toggleProductView() { productViewMode = productViewMode === 'grid' ? 'list' : 'grid'; renderProductGrid(); }

// ─── ADD PRODUCT MODAL ───
// ─── 1. UPGRADED ADD PRODUCT MODAL ───
function openAddProduct() {
  document.getElementById('modalTitle').textContent = 'Add New Item';
  document.getElementById('modalBody').innerHTML = `
    <div class="grid-3">
      <div class="form-group"><label class="form-label">Item Type</label><select class="form-control" id="npType" onchange="toggleItemType('n')"><option value="Goods">Goods</option><option value="Service">Service</option></select></div>
      <div class="form-group"><label class="form-label">Item ID</label><input type="text" class="form-control" id="npId" value="${getNextId('product')}"></div>
      <div class="form-group"><label class="form-label">Barcode / EAN</label><input type="text" class="form-control" id="npBarcode" placeholder="Scan or type..."></div>
    </div>
    <div class="form-group"><label class="form-label">Item Name</label><input type="text" class="form-control" id="npName" placeholder="Enter product or service name"></div>
    <div class="grid-3">
      <div class="form-group"><label class="form-label">Category</label><input type="text" class="form-control" id="npCat" placeholder="e.g. Electronics" list="categoryList"></div>
      <div class="form-group"><label class="form-label">HSN/SAC Code</label><input type="text" class="form-control" id="npHsn" placeholder="e.g. 8517"></div>
      <div class="form-group"><label class="form-label">Unit Type</label><input type="text" class="form-control" id="npUnit" placeholder="e.g. PCS, KGS" list="unitList" style="text-transform:uppercase;"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Sell Price (₹)</label><input type="number" class="form-control" id="npSellPrice" placeholder="0.00" oninput="calcPreviewMargin()"></div>
      <div class="form-group"><label class="form-label">Cost Price (₹)</label><input type="number" class="form-control" id="npCostPrice" placeholder="0.00" oninput="calcPreviewMargin()"></div>
    </div>
    <div class="grid-3">
      <div class="form-group" id="nStockGroup"><label class="form-label">Initial Stock</label><input type="number" class="form-control" id="npStock" placeholder="0" step="0.01"></div>
      <div class="form-group"><label class="form-label">GST Rate</label>
        <select class="form-control" id="npGst">
          <option value="0">0% — Exempt</option><option value="0.05">5%</option>
          <option value="0.12">12%</option><option value="0.18" selected>18%</option><option value="0.28">28%</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Status</label><select class="form-control" id="npStatus"><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
    </div>
    <datalist id="categoryList">${[...new Set(inventoryStock.map(p => p.category).filter(c=>c))].map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
    <datalist id="unitList">${[...new Set(inventoryStock.map(p => p.unit).filter(u=>u))].map(u=>`<option value="${esc(u)}">`).join('')}</datalist>
    <div id="marginPreview" style="font-size:0.85rem;color:var(--ink2);margin-bottom:14px"></div>
    <button class="btn btn-primary" onclick="addProductLocal()"><i class="fas fa-plus"></i> Add Item</button>`;
  document.getElementById('detailModal').classList.add('open');
}

function calcPreviewMargin() {
  const cost = parseFloat(document.getElementById('npCostPrice').value) || 0;
  const sell = parseFloat(document.getElementById('npSellPrice').value) || 0;
  const preview = document.getElementById('marginPreview');
  if (!preview) return;
  if (cost > 0 && sell > 0) {
    const margin = ((sell - cost) / sell) * 100;
    const profit = sell - cost;
    preview.innerHTML = `Profit: <strong>₹${profit.toFixed(2)}</strong> (${margin.toFixed(1)}% margin)`;
    preview.style.color = profit >= 0 ? 'var(--accent2)' : 'var(--danger)';
  } else { preview.innerHTML = ''; }
}


// ─── 3. UPGRADED EDIT PRODUCT MODAL ───
function openEditProduct(id) {
  const p = inventoryStock.find(x => x.id === id);
  if (!p) return;
  document.getElementById('modalTitle').textContent = 'Edit Item — ' + p.name;
  document.getElementById('modalBody').innerHTML = `
    <div class="grid-3">
      <div class="form-group"><label class="form-label">Item Type</label><select class="form-control" id="epType" onchange="toggleItemType('e')"><option value="Goods" ${p.type==='Goods'?'selected':''}>Goods</option><option value="Service" ${p.type==='Service'?'selected':''}>Service</option></select></div>
      <div class="form-group"><label class="form-label">Barcode / EAN</label><input type="text" class="form-control" id="epBarcode" value="${esc(p.barcode || '')}"></div>
      <div class="form-group"><label class="form-label">Status</label><select class="form-control" id="epStatus"><option value="Active" ${p.status==='Active'?'selected':''}>Active</option><option value="Inactive" ${p.status==='Inactive'?'selected':''}>Inactive</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Item Name</label><input type="text" class="form-control" id="epName" value="${esc(p.name)}"></div>
    <div class="grid-3">
      <div class="form-group"><label class="form-label">Category</label><input type="text" class="form-control" id="epCat" value="${esc(p.category || '')}" list="categoryList"></div>
      <div class="form-group"><label class="form-label">HSN/SAC Code</label><input type="text" class="form-control" id="epHsn" value="${esc(p.hsn || '')}"></div>
      <div class="form-group"><label class="form-label">Unit Type</label><input type="text" class="form-control" id="epUnit" value="${esc(p.unit || '')}" list="unitList" style="text-transform:uppercase;"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Sell Price (₹)</label><input type="number" class="form-control" id="epSellPrice" value="${p.sellPrice || 0}" oninput="calcPreviewMarginEdit()"></div>
      <div class="form-group"><label class="form-label">Cost Price (₹)</label><input type="number" class="form-control" id="epCostPrice" value="${p.costPrice || 0}" oninput="calcPreviewMarginEdit()"></div>
    </div>
    <div class="grid-2">
      <div class="form-group" id="eStockGroup" style="display:${p.type==='Service'?'none':'block'}"><label class="form-label">Stock (units)</label><input type="number" class="form-control" id="epStock" value="${p.stock || 0}" step="0.01"></div>
      <div class="form-group"><label class="form-label">GST Rate</label>
        <select class="form-control" id="epGst">
          <option value="0" ${p.gstRate===0?'selected':''}>0%</option><option value="0.05" ${p.gstRate===0.05?'selected':''}>5%</option>
          <option value="0.12" ${p.gstRate===0.12?'selected':''}>12%</option><option value="0.18" ${p.gstRate===0.18?'selected':''}>18%</option>
          <option value="0.28" ${p.gstRate===0.28?'selected':''}>28%</option>
        </select>
      </div>
    </div>
    <datalist id="categoryList">${[...new Set(inventoryStock.map(p => p.category).filter(c=>c))].map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
    <datalist id="unitList">${[...new Set(inventoryStock.map(p => p.unit).filter(u=>u))].map(u=>`<option value="${esc(u)}">`).join('')}</datalist>
    <div id="marginPreviewEdit" style="font-size:0.85rem;color:var(--ink2);margin-bottom:14px"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="saveEditProduct('${esc(id)}')"><i class="fas fa-save"></i> Save Changes</button>
      <button class="btn btn-danger btn-sm" onclick="deleteProduct('${esc(id)}')"><i class="fas fa-trash"></i> Delete</button>
    </div>`;
  document.getElementById('detailModal').classList.add('open');
  calcPreviewMarginEdit();
}

function calcPreviewMarginEdit() {
  const cost = parseFloat(document.getElementById('epCostPrice').value) || 0;
  const sell = parseFloat(document.getElementById('epSellPrice').value) || 0;
  const preview = document.getElementById('marginPreviewEdit');
  if (!preview) return;
  if (cost > 0 && sell > 0) {
    const margin = ((sell - cost) / sell) * 100;
    const profit = sell - cost;
    preview.innerHTML = `Profit: <strong>₹${profit.toFixed(2)}</strong> (${margin.toFixed(1)}% margin)`;
    preview.style.color = profit >= 0 ? 'var(--accent2)' : 'var(--danger)';
  } else { preview.innerHTML = ''; }
}

// ══════════════════════════════════════════════
//        SUPABASE SYNC: PRODUCTS & INVENTORY
// ══════════════════════════════════════════════
async function addProductLocal() {
  const id = document.getElementById('npId').value.trim();
  const name = document.getElementById('npName').value.trim();
  const type = document.getElementById('npType').value;
  const barcode = document.getElementById('npBarcode').value.trim();
  const status = document.getElementById('npStatus').value;
  const category = document.getElementById('npCat').value.trim();
  const hsn = document.getElementById('npHsn').value.trim();
  const unit = document.getElementById('npUnit').value.trim();
  const sellPrice = parseFloat(document.getElementById('npSellPrice').value) || 0;
  const costPrice = parseFloat(document.getElementById('npCostPrice').value) || 0;
  const stock = type === 'Service' ? 0 : (parseFloat(document.getElementById('npStock').value) || 0);
  const gstRate = parseFloat(document.getElementById('npGst').value) || 0;
  
  if (!id || !name) { toast('Enter Item ID and Name', 'error'); return; }
  if (inventoryStock.find(p => p.id === id)) { toast('Item ID already exists', 'error'); return; }
  
  // 1. Update UI Instantly
  inventoryStock.push({ id, name, type, barcode, status, category, hsn, unit, sellPrice, costPrice, gstRate, stock });
  closeModal(); renderProductGrid(); renderInventoryTable(); updateDatalists();
  
  // 2. Format for SQL (map camelCase to snake_case) and push
  toast('Saving product to cloud...', 'info');
  const dbPayload = { 
    id: id, store_id: currentStoreId, name: name, type: type, barcode: barcode, 
    status: status, category: category, hsn: hsn, unit: unit, 
    sell_price: sellPrice, cost_price: costPrice, gst_rate: gstRate, stock: stock 
  };
  
  const { error } = await supabase.from('inventory').insert([dbPayload]);
  if (error) toast('Cloud save failed.', 'error');
  else toast(`${name} added successfully!`, 'success');
}

async function saveEditProduct(id) {
  const p = inventoryStock.find(x => x.id === id);
  if (!p) return;
  
  p.name = document.getElementById('epName').value.trim() || p.name;
  p.type = document.getElementById('epType').value;
  p.barcode = document.getElementById('epBarcode').value.trim() || '';
  p.status = document.getElementById('epStatus').value;
  p.category = document.getElementById('epCat').value.trim() || '';
  p.hsn = document.getElementById('epHsn').value.trim() || '';
  p.unit = document.getElementById('epUnit').value.trim() || '';
  p.sellPrice = parseFloat(document.getElementById('epSellPrice').value) || 0;
  p.costPrice = parseFloat(document.getElementById('epCostPrice').value) || 0;
  p.gstRate = parseFloat(document.getElementById('epGst').value) || 0;
  p.stock = p.type === 'Service' ? 0 : (parseFloat(document.getElementById('epStock').value) || 0);
  
  closeModal(); renderProductGrid(); renderInventoryTable(); updateDatalists();
  
  toast('Updating cloud...', 'info');
  const dbPayload = { 
    name: p.name, type: p.type, barcode: p.barcode, status: p.status, 
    category: p.category, hsn: p.hsn, unit: p.unit, 
    sell_price: p.sellPrice, cost_price: p.costPrice, gst_rate: p.gstRate, stock: p.stock 
  };
  
  const { error } = await supabase.from('inventory').update(dbPayload).eq('id', id).eq('store_id', currentStoreId);
  if (error) toast('Cloud update failed.', 'error');
  else toast('Item updated successfully!', 'success');
}

async function deleteProduct(id) {
  const idx = inventoryStock.findIndex(x => x.id === id);
  if (idx === -1) return;
  if(!confirm(`Permanently delete ${inventoryStock[idx].name}?`)) return;
  
  inventoryStock.splice(idx, 1);
  closeModal(); renderProductGrid(); renderInventoryTable(); updateDatalists();
  
  toast('Deleting from cloud...', 'warn');
  const { error } = await supabase.from('inventory').delete().eq('id', id).eq('store_id', currentStoreId);
  if (error) toast('Delete failed.', 'error');
  else toast('Product deleted permanently.', 'success');
}

function openCustomerLedger(id) {
  const c = customersArray.find(x => String(x.id) === String(id));
  if (!c) return;
  const invs = invoicesArray.filter(i => i.customerName.toLowerCase() === c.name.toLowerCase());
  const total = invs.reduce((s, i) => s + (i.grandTotal || 0), 0);
  const outstanding = invs.filter(i => i.status === 'unpaid' || i.status === 'overdue').reduce((s, i) => s + (i.grandTotal || 0), 0);
  document.getElementById('modalTitle').textContent = 'Customer Ledger — ' + c.name;
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
      <div class="kpi-box" style="flex:1;min-width:120px"><div class="kpi-label">Total Billed</div><div class="kpi-value">${fmt(total)}</div></div>
      <div class="kpi-box" style="flex:1;min-width:120px"><div class="kpi-label">Outstanding</div><div class="kpi-value" style="color:var(--danger)">${fmt(outstanding)}</div></div>
      <div class="kpi-box" style="flex:1;min-width:120px"><div class="kpi-label">Invoices</div><div class="kpi-value">${invs.length}</div></div>
    </div>
    ${c.email ? `<div style="font-size:0.85rem;color:var(--ink2);margin-bottom:4px"><i class="fas fa-envelope" style="margin-right:6px"></i>${esc(c.email)}</div>` : ''}
    ${c.phone ? `<div style="font-size:0.85rem;color:var(--ink2);margin-bottom:4px"><i class="fas fa-phone" style="margin-right:6px"></i>${esc(c.phone)}</div>` : ''}
    ${c.address ? `<div style="font-size:0.85rem;color:var(--ink2);margin-bottom:12px"><i class="fas fa-map-marker-alt" style="margin-right:6px"></i>${esc(c.address)}</div>` : ''}
    <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px;color:var(--ink)">Invoice History</div>
    ${invs.length ? invs.map(i => `<div class="list-item" onclick="closeModal();showInvoiceDetail('${esc(i.invoiceId)}')"><div><div class="list-item-title">${esc(i.invoiceId)}</div><div class="list-item-sub">${dateLabel(i.date)}</div></div><div style="text-align:right"><div class="list-item-amount">${fmt(i.grandTotal)}</div>${getStatusBadge(i)}</div></div>`).join('') : '<div class="empty-state"><i class="fas fa-file"></i><p>No invoices for this customer</p></div>'}`;
  document.getElementById('detailModal').classList.add('open');
}

function updateDatalists() {
  const custDl = document.getElementById('customerList');
  const suppDl = document.getElementById('supplierList');
  const prodDl = document.getElementById('productList');
  if (custDl) custDl.innerHTML = customersArray.map(c => `<option value="${esc(c.name)}">`).join('');
  if (suppDl) suppDl.innerHTML = suppliersArray.map(s => `<option value="${esc(s.name)}">`).join('');
  if (prodDl) prodDl.innerHTML = inventoryStock.map(p => `<option value="${esc(p.name)}">`).join('');
}
