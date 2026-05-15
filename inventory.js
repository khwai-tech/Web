// ─── FETCH INVENTORY & REPORTS ────────────────
async function fetchInventoryAndReports() {
  try {
    const res  = await fetch(API_URL + '?action=getAll&t=' + Date.now());
    const data = await res.json();

    // ─── CATCH AND APPLY BUSINESS SETTINGS FROM CLOUD ───
    if (data.settings && Object.keys(data.settings).length > 0) {
      // 1. Merge cloud settings into live memory
      Object.assign(bizProfile, data.settings);
      
      // 2. Save to local storage so the app remembers it
      localStorage.setItem('bs_settings', JSON.stringify(bizProfile));
      
      // 3. If there are logos/signatures, trigger them to show up
      if (typeof loadSettingsPreviews === 'function') loadSettingsPreviews();
    }

    if (data.products && data.products.length > 1) {
      inventoryStock.length = 0;
      for (let i = 1; i < data.products.length; i++) {
        const row = data.products[i];
        if (row && row[0]) {
          inventoryStock.push({
            id:        row[0],
            name:      row[1] || 'Unknown',
            category:  row[2] || '', 
            unit:      row[3] || '', 
            costPrice: parseFloat(row[4]) || 0,
            sellPrice: parseFloat(row[5]) || 0,
            gstRate:   parseFloat(row[6]) || 0,
            gstType:   row[7] || 'Exclusive',
            stock:     parseFloat(row[8]) || 0,
            hsn:       row[9] || '' // HSN Code
          });
        }
      }
    }

    if (data.customers && data.customers.length > 1) {
      customersArray.length = 0;
      for (let i = 1; i < data.customers.length; i++) {
        const row = data.customers[i];
        if (row && row[1]) customersArray.push({ id: row[0], name: row[1], email: row[2], address: row[3], gstin: row[5] });
      }
    }

    if (data.suppliers && data.suppliers.length > 1) {
      suppliersArray.length = 0;
      for (let i = 1; i < data.suppliers.length; i++) {
        const row = data.suppliers[i];
        if (row && row[1]) suppliersArray.push({ id: row[0], name: row[1], phone: row[2] || '', address: row[3] || '', paymentTerms: row[4] || '', gstin: row[5] });
      }
    }

    if (data.invoices && data.invoiceItems) {
      invoicesArray.length = 0; 
      const newInvoices = data.invoices.slice(1).map(row => {
        const invId = row[0];
        const items = data.invoiceItems.slice(1).filter(ir => ir[0] === invId).map(ir => ({
          description: ir[1], quantity: parseFloat(ir[2]), unitPrice: parseFloat(ir[3]), gstRate: parseFloat(ir[8]), hsn: ir[9] || ''
        }));
        return { 
          invoiceId: invId, customerName: row[1], customerEmail: row[2], billingAddress: row[3], 
          date: row[4], gstType: row[5], subtotal: parseFloat(row[6]), gstAmount: parseFloat(row[7]), 
          discount: parseFloat(row[8]) || 0, grandTotal: parseFloat(row[9]) || 0, supplyType: row[10] || 'intra', status: row[11] || 'paid', items: items 
        };
      });
      invoicesArray.push(...newInvoices);
      localStorage.setItem("bs_invoices", JSON.stringify(invoicesArray));
      const invInput = document.getElementById('invNumber');
      if(invInput) invInput.value = getNextId(invoicesArray, 'INV');
    }

    if (data.purchases && data.purchaseItems) {
      purchasesArray.length = 0; 
      const newPurchases = data.purchases.slice(1).map(row => {
        const poId = row[0];
        const items = data.purchaseItems.slice(1).filter(ir => ir[0] === poId).map(ir => ({
          product: ir[1], quantity: parseFloat(ir[2]), unitCost: parseFloat(ir[3]), gstRate: parseFloat(ir[8]), hsn: ir[9] || ''
        }));
        return { 
          poNumber: poId, supplier: row[1], date: row[2], gstType: row[3], 
          subtotal: parseFloat(row[4]), gstAmount: parseFloat(row[5]), totalAmount: parseFloat(row[6]), items: items 
        };
      });
      purchasesArray.push(...newPurchases);
      localStorage.setItem("bs_purchases", JSON.stringify(purchasesArray));
      const poInput = document.getElementById('poNumber');
      if(poInput) poInput.value = getNextId(purchasesArray, 'PO');
    }

    document.getElementById('statusLed').className = 'led';
    document.getElementById('apiStatusLabel').textContent = 'Google Sheets Live';
    document.getElementById('apiLastSync').textContent = 'Synced ' + new Date().toLocaleTimeString('en-IN');

    updateDatalists(); renderInventoryTable(); renderProductGrid(); renderCustomerGrid();
    renderSupplierGrid(); renderInvoiceLists(); renderPurchaseLists(); updateDashboard();

  } catch(e) {
    console.warn('API unavailable, using local data:', e.message);
    document.getElementById('statusLed').className = 'led error';
    document.getElementById('apiStatusLabel').textContent = 'Offline Mode';
    document.getElementById('apiLastSync').textContent = 'Could not connect';
    fallbackStock();
  }
}

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
      <div class="form-group"><label class="form-label">Item ID</label><input type="text" class="form-control" id="npId" placeholder="ITM-001"></div>
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

// ─── 2. UPGRADED SAVE LOCAL FUNCTION ───
function addProductLocal() {
  const id        = document.getElementById('npId').value.trim();
  const name      = document.getElementById('npName').value.trim();
  const type      = document.getElementById('npType').value;
  const barcode   = document.getElementById('npBarcode').value.trim();
  const status    = document.getElementById('npStatus').value;
  const category  = document.getElementById('npCat').value.trim();
  const hsn       = document.getElementById('npHsn').value.trim();
  const unit      = document.getElementById('npUnit').value.trim();
  const sellPrice = parseFloat(document.getElementById('npSellPrice').value) || 0;
  const costPrice = parseFloat(document.getElementById('npCostPrice').value) || 0;
  const stock     = type === 'Service' ? 0 : (parseFloat(document.getElementById('npStock').value) || 0); // Services have 0 stock
  const gstRate   = parseFloat(document.getElementById('npGst').value) || 0;
  
  if (!id || !name) { toast('Enter Item ID and Name', 'error'); return; }
  if (inventoryStock.find(p => p.id === id)) { toast('Item ID already exists', 'error'); return; }
  
  inventoryStock.push({ id, name, type, barcode, status, category, hsn, unit, sellPrice, costPrice, gstRate, stock });
  closeModal(); renderProductGrid(); renderInventoryTable(); updateDashboard(); updateDatalists();
  
  toast('Syncing to database...', 'warn');
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, 
    body: JSON.stringify({ action: "addProduct", id, name, type, barcode, status, category, hsn, unit, costPrice, sellPrice, stock, gstRate }) 
  }).then(() => toast(`${name} added!`, 'success'));
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

// ─── 4. UPGRADED SAVE EDIT FUNCTION ───
function saveEditProduct(id) {
  const p = inventoryStock.find(x => x.id === id);
  if (!p) return;
  p.name      = document.getElementById('epName').value.trim()           || p.name;
  p.type      = document.getElementById('epType').value;
  p.barcode   = document.getElementById('epBarcode').value.trim()        || '';
  p.status    = document.getElementById('epStatus').value;
  p.category  = document.getElementById('epCat').value.trim()            || '';
  p.hsn       = document.getElementById('epHsn').value.trim()            || '';
  p.unit      = document.getElementById('epUnit').value.trim()           || '';
  p.sellPrice = parseFloat(document.getElementById('epSellPrice').value) || 0;
  p.costPrice = parseFloat(document.getElementById('epCostPrice').value) || 0;
  p.gstRate   = parseFloat(document.getElementById('epGst').value)       || 0;
  p.stock     = p.type === 'Service' ? 0 : (parseFloat(document.getElementById('epStock').value) || 0); // Force 0 if Service
  
  closeModal(); renderProductGrid(); renderInventoryTable(); updateDatalists();
  
  const payload = { action: "editProduct", id, name: p.name, type: p.type, barcode: p.barcode, status: p.status, category: p.category, hsn: p.hsn, unit: p.unit, costPrice: p.costPrice, sellPrice: p.sellPrice, stock: p.stock, gstRate: p.gstRate };
  toast('Syncing changes to database...', 'warn');
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
    .then(() => toast('Item updated successfully!', 'success'));
}

function deleteProduct(id) {
  const idx = inventoryStock.findIndex(x => x.id === id);
  if (idx === -1) return;
  const [removed] = inventoryStock.splice(idx, 1);
  closeModal(); renderProductGrid(); renderInventoryTable(); updateDatalists();
  toast(`${removed.name} deleted`, 'warn', () => {
    inventoryStock.splice(idx, 0, removed);
    renderProductGrid(); renderInventoryTable(); updateDatalists();
    toast('Undo successful', 'success');
  });
}

// ─── CUSTOMERS & SUPPLIERS DIRECTORIES (Unchanged) ───────────────
function renderCustomerGrid() {
  const grid = document.getElementById('customerGrid');
  if (!grid) return;
  const q = (document.getElementById('customerSearch')?.value || '').toLowerCase();
  const filtered = customersArray.filter(c => (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q));
  if (!filtered.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-users"></i><p>No customers yet</p></div>'; return; }
  const invSummary = {};
  invoicesArray.forEach(i => {
    const key = (i.customerName || '').toLowerCase();
    if (!invSummary[key]) invSummary[key] = { count: 0, total: 0 };
    invSummary[key].count++; invSummary[key].total += (i.grandTotal || 0);
  });
  grid.innerHTML = filtered.map(c => {
    const summ = invSummary[(c.name||'').toLowerCase()] || { count: 0, total: 0 };
    return `<div class="customer-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div class="customer-name" style="cursor:pointer" onclick="openCustomerLedger('${esc(c.id)}')"><i class="fas fa-user-circle" style="color:var(--accent2);margin-right:6px"></i>${esc(c.name)}</div>
        <button class="btn-icon info" style="width:28px;height:28px;font-size:0.75rem;flex-shrink:0" onclick="openEditCustomer('${esc(c.id)}')" title="Edit customer"><i class="fas fa-pen"></i></button>
      </div>
      ${c.email ? `<div class="customer-detail"><i class="fas fa-envelope" style="margin-right:4px"></i>${esc(c.email)}</div>` : ''}
      ${c.phone ? `<div class="customer-detail"><i class="fas fa-phone" style="margin-right:4px"></i>${esc(c.phone)}</div>` : ''}
      ${c.address ? `<div class="customer-detail"><i class="fas fa-map-marker-alt" style="margin-right:4px"></i>${esc(c.address)}</div>` : ''}
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="openCustomerLedger('${esc(c.id)}')">
        <span style="font-size:0.78rem;color:var(--accent2);font-weight:600">${summ.count} invoice${summ.count!==1?'s':''}</span>
        <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.9rem;color:var(--accent)">${fmt(summ.total)}</span>
      </div></div>`;
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

function addCustomerLocal() {
  const name = document.getElementById('ncName').value.trim();
  if (!name) { toast('Enter a name', 'error'); return; }
  const c = { id: 'CUST-' + Date.now().toString().slice(-6), name, email: document.getElementById('ncEmail').value.trim(), phone: document.getElementById('ncPhone').value.trim(), gstin: document.getElementById('ncGstin').value.trim().toUpperCase(), address: document.getElementById('ncAddr').value.trim() };
  customersArray.push(c); updateDatalists(); closeModal(); renderCustomerGrid();
  toast(`Syncing ${name} to database...`, 'warn');
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "saveCustomer", ...c }) }).then(() => toast('Customer saved permanently!', 'success'));
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

function saveEditCustomer(id) {
  const c = customersArray.find(x => String(x.id) === String(id));
  if (!c) return;
  const name = document.getElementById('ecName').value.trim();
  if (!name) { toast('Name cannot be empty', 'error'); return; }
  const oldName = c.name;
  c.name = name; c.email = document.getElementById('ecEmail').value.trim(); c.phone = document.getElementById('ecPhone').value.trim(); c.gstin = document.getElementById('ecGstin').value.trim().toUpperCase(); c.address = document.getElementById('ecAddr').value.trim();
  if (oldName.toLowerCase() !== name.toLowerCase()) { invoicesArray.forEach(i => { if (i.customerName.toLowerCase() === oldName.toLowerCase()) i.customerName = name; }); localStorage.setItem('bs_invoices', JSON.stringify(invoicesArray)); }
  updateDatalists(); closeModal(); renderCustomerGrid();
  toast('Syncing changes to database...', 'warn');
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "editCustomer", ...c }) }).then(() => toast(`${name} updated successfully`, 'success'));
}

function deleteCustomer(id) {
  const idx = customersArray.findIndex(x => String(x.id) === String(id));
  if (idx === -1) return;
  if (!confirm(`Delete ${customersArray[idx].name}? Their invoice history will remain.`)) return;
  const [removed] = customersArray.splice(idx, 1); updateDatalists(); closeModal(); renderCustomerGrid();
  toast('Deleting from database...', 'warn');
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "deleteCustomer", id: String(id) }) }).then(() => toast(`${removed.name} deleted permanently`, 'success'));
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

function renderSupplierGrid() {
  const grid = document.getElementById('supplierGrid');
  if (!grid) return;
  const q = (document.getElementById('supplierSearch')?.value || '').toLowerCase();
  const filtered = suppliersArray.filter(s => (s.name || '').toLowerCase().includes(q));
  if (!filtered.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-building"></i><p>No suppliers yet</p></div>'; return; }
  const purSummary = {};
  purchasesArray.forEach(p => {
    const key = (p.supplier || '').toLowerCase();
    if (!purSummary[key]) purSummary[key] = { count: 0, total: 0 };
    purSummary[key].count++; purSummary[key].total += (p.totalAmount || 0);
  });
  grid.innerHTML = filtered.map(s => {
    const summ = purSummary[(s.name||'').toLowerCase()] || { count: 0, total: 0 };
    return `<div class="customer-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div class="customer-name"><i class="fas fa-building" style="color:var(--accent2);margin-right:6px"></i>${esc(s.name)}</div>
        <button class="btn-icon info" style="width:28px;height:28px;font-size:0.75rem;flex-shrink:0" onclick="openEditSupplier('${esc(s.id)}')" title="Edit supplier"><i class="fas fa-pen"></i></button>
      </div>
      ${s.phone ? `<div class="customer-detail"><i class="fas fa-phone" style="margin-right:4px"></i>${esc(s.phone)}</div>` : ''}
      ${s.address ? `<div class="customer-detail"><i class="fas fa-map-marker-alt" style="margin-right:4px"></i>${esc(s.address)}</div>` : ''}
      ${s.paymentTerms ? `<div class="customer-detail"><i class="fas fa-clock" style="margin-right:4px"></i>${esc(s.paymentTerms)}</div>` : ''}
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:0.78rem;color:var(--info);font-weight:600">${summ.count} purchase${summ.count!==1?'s':''}</span>
        <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.9rem;color:var(--gold)">${fmt(summ.total)}</span>
      </div></div>`;
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

function addSupplierLocal() {
  const name = document.getElementById('nsName').value.trim();
  if (!name) { toast('Enter a supplier name', 'error'); return; }
  const s = { id: 'SUPP-' + Date.now().toString().slice(-6), name, phone: document.getElementById('nsPhone').value.trim(), gstin: document.getElementById('nsGstin').value.trim().toUpperCase(), address: document.getElementById('nsAddr').value.trim(), paymentTerms: document.getElementById('nsPay').value.trim() };
  suppliersArray.push(s); updateDatalists(); closeModal(); renderSupplierGrid();
  toast(`Syncing ${name} to database...`, 'warn');
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "saveSupplier", ...s }) }).then(() => toast('Supplier saved permanently!', 'success'));
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

function saveEditSupplier(id) {
  const s = suppliersArray.find(x => x.id === id);
  if (!s) return;
  const name = document.getElementById('esName').value.trim();
  if (!name) { toast('Name cannot be empty', 'error'); return; }
  const oldName = s.name;
  s.name = name; s.phone = document.getElementById('esPhone').value.trim(); s.gstin = document.getElementById('esGstin').value.trim().toUpperCase(); s.address = document.getElementById('esAddr').value.trim(); s.paymentTerms = document.getElementById('esPay').value.trim();
  if (oldName.toLowerCase() !== name.toLowerCase()) { purchasesArray.forEach(p => { if ((p.supplier||'').toLowerCase() === oldName.toLowerCase()) p.supplier = name; }); localStorage.setItem('bs_purchases', JSON.stringify(purchasesArray)); }
  updateDatalists(); closeModal(); renderSupplierGrid();
  toast(`Syncing changes to database...`, 'warn');
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "editSupplier", ...s }) }).then(() => toast(`${name} updated successfully`, 'success'));
}

function deleteSupplier(id) {
  const idx = suppliersArray.findIndex(x => x.id === id);
  if (idx === -1) return;
  if (!confirm(`Delete ${suppliersArray[idx].name}? Their purchase history will remain.`)) return;
  const [removed] = suppliersArray.splice(idx, 1); updateDatalists(); closeModal(); renderSupplierGrid();
  toast(`Deleting from database...`, 'warn');
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "deleteSupplier", id: id }) }).then(() => toast(`${removed.name} deleted permanently`, 'success'));
}

function updateDatalists() {
  const custDl = document.getElementById('customerList');
  const suppDl = document.getElementById('supplierList');
  const prodDl = document.getElementById('productList');
  if (custDl) custDl.innerHTML = customersArray.map(c => `<option value="${esc(c.name)}">`).join('');
  if (suppDl) suppDl.innerHTML = suppliersArray.map(s => `<option value="${esc(s.name)}">`).join('');
  if (prodDl) prodDl.innerHTML = inventoryStock.map(p => `<option value="${esc(p.name)}">`).join('');
}
