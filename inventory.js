// ─── FETCH INVENTORY & REPORTS ────────────────
async function fetchInventoryAndReports() {
  try {
    const res  = await fetch(API_URL + '?action=getAll&t=' + Date.now());
    const data = await res.json();

    // 1. Fetch Products
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
            stock:     parseFloat(row[8]) || 0  // <--- Reads from Column I
          });
        }
      }
    }

    // 2. Fetch Customers
    if (data.customers && data.customers.length > 1) {
      customersArray.length = 0;
      for (let i = 1; i < data.customers.length; i++) {
        const row = data.customers[i];
        if (row && row[1]) customersArray.push({ id: row[0], name: row[1], email: row[2], address: row[3] });
      }
    }

    // 3. Fetch Suppliers
    if (data.suppliers && data.suppliers.length > 1) {
      suppliersArray.length = 0;
      for (let i = 1; i < data.suppliers.length; i++) {
        const row = data.suppliers[i];
        if (row && row[1]) suppliersArray.push({ id: row[0], name: row[1], phone: row[2] || '', address: row[3] || '', paymentTerms: row[4] || '' });
      }
    }

    // 4. Fetch Invoices (CRITICAL FIX - THIS WAS MISSING!)
    if (data.invoices && data.invoiceItems) {
      invoicesArray.length = 0; // Clear local memory
      const newInvoices = data.invoices.slice(1).map(row => {
        const invId = row[0];
        const items = data.invoiceItems.slice(1).filter(ir => ir[0] === invId).map(ir => ({
          description: ir[1], quantity: parseFloat(ir[2]), unitPrice: parseFloat(ir[3]), gstRate: parseFloat(ir[8])
        }));
        return { 
          invoiceId: invId, customerName: row[1], customerEmail: row[2], billingAddress: row[3], 
          date: row[4], gstType: row[5], subtotal: parseFloat(row[6]), gstAmount: parseFloat(row[7]), 
          discount: parseFloat(row[8]) || 0,        
          grandTotal: parseFloat(row[9]) || 0,      
          supplyType: row[10] || 'intra',           
          status: row[11] || 'paid',                
          items: items 
        };
      });
      invoicesArray.push(...newInvoices);
      localStorage.setItem("bs_invoices", JSON.stringify(invoicesArray));
      
      const invInput = document.getElementById('invNumber');
      if(invInput) invInput.value = getNextId(invoicesArray, 'INV');
    }

    // 5. Fetch Purchases (CRITICAL FIX - THIS WAS MISSING!)
    if (data.purchases && data.purchaseItems) {
      purchasesArray.length = 0; // Clear local memory
      const newPurchases = data.purchases.slice(1).map(row => {
        const poId = row[0];
        const items = data.purchaseItems.slice(1).filter(ir => ir[0] === poId).map(ir => ({
          product: ir[1], quantity: parseFloat(ir[2]), unitCost: parseFloat(ir[3]), gstRate: parseFloat(ir[8])
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

    // Update UI Status
    document.getElementById('statusLed').className    = 'led';
    document.getElementById('apiStatusLabel').textContent = 'Google Sheets Live';
    document.getElementById('apiLastSync').textContent    = 'Synced ' + new Date().toLocaleTimeString('en-IN');

    // Re-render everything
    updateDatalists();
    renderInventoryTable();
    renderProductGrid();
    renderCustomerGrid();
    renderSupplierGrid();
    renderInvoiceLists();   // Added this!
    renderPurchaseLists();  // Added this!
    updateDashboard();

  } catch(e) {
    console.warn('API unavailable, using local data:', e.message);
    document.getElementById('statusLed').className    = 'led error';
    document.getElementById('apiStatusLabel').textContent = 'Offline Mode';
    document.getElementById('apiLastSync').textContent    = 'Could not connect';
    fallbackStock();
  }
}

// fix: fallbackStock uses sellPrice/costPrice — matches the rest of the code
function fallbackStock() {
  if (!inventoryStock.length) {
    inventoryStock.push(
      { id: 'P001', name: 'Sample Product A', stock: 45,  costPrice: 800,  sellPrice: 1200, gstRate: 0.18 },
      { id: 'P002', name: 'Sample Product B', stock: 8,   costPrice: 500,  sellPrice: 850,  gstRate: 0.12 },
      { id: 'P003', name: 'Sample Product C', stock: 120, costPrice: 200,  sellPrice: 350,  gstRate: 0.05 },
      { id: 'P004', name: 'Sample Product D', stock: 3,   costPrice: 2800, sellPrice: 4500, gstRate: 0.28 }
    );
  }
  renderInventoryTable();
  renderProductGrid();
  updateDashboard();
}

// fix: stock bar denominator is max stock, not hardcoded 100
function renderInventoryTable(data) {
  const source = data || inventoryStock;
  const tbody   = document.getElementById('inventoryTableBody');
  if (!source.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--ink3)">No stock data. Add products or sync from Google Sheets.</td></tr>';
    return;
  }

  // fix: stock bar — relative to max stock in catalog, not fixed 100
  const maxStock = Math.max(...source.map(p => p.stock || 0), 1);
  let totalValue = 0, lowCount = 0;

  tbody.innerHTML = source.map(p => {
    // fix: use sellPrice for stock value, not the undefined p.price
    const val    = (p.stock || 0) * (p.sellPrice || p.costPrice || 0);
    totalValue  += val;
    const isLow  = (p.stock || 0) <= LOW_STOCK_THRESHOLD;
    const isCrit = (p.stock || 0) === 0;
    if (isLow) lowCount++;
    const pct      = Math.round(((p.stock || 0) / maxStock) * 100);
    const barClass = isCrit ? 'critical' : isLow ? 'low' : '';
    const badge    = isCrit
      ? '<span class="badge badge-red">Out of Stock</span>'
      : isLow ? '<span class="badge badge-gold">Low Stock</span>'
      : '<span class="badge badge-green">In Stock</span>';

    // fix: margin% from actual fields
    const margin = p.sellPrice && p.costPrice
      ? (((p.sellPrice - p.costPrice) / p.sellPrice) * 100).toFixed(0) + '%'
      : '—';

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

  // KPI boxes
  const kpiTotal = document.getElementById('invTotalProducts');   if (kpiTotal) kpiTotal.textContent = source.length;
  const kpiVal   = document.getElementById('invTotalValue');       if (kpiVal)   kpiVal.textContent   = fmt(totalValue);
  const kpiLow   = document.getElementById('invLowStockCount');    if (kpiLow)   kpiLow.textContent   = lowCount;
  const dashLow  = document.getElementById('dashLowStock');        if (dashLow)  dashLow.textContent  = lowCount;

  // Low stock banner in topbar
  const banner = document.getElementById('lowStockBanner');
  if (banner) {
    banner.style.display = lowCount > 0 ? 'flex' : 'none';
    const bannerText = document.getElementById('lowStockBannerText');
    if (bannerText) bannerText.textContent = `${lowCount} low stock item${lowCount > 1 ? 's' : ''}`;
  }
}

function filterInventory() {
  const q = document.getElementById('inventorySearch').value.toLowerCase();
  const filtered = inventoryStock.filter(p =>
    (p.name || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q)
  );
  renderInventoryTable(filtered);
}

function refreshInventory() {
  const tbody = document.getElementById('inventoryTableBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px">
    <div class="skeleton skel-line wide" style="margin:0 auto 8px"></div>
    <div class="skeleton skel-line med"  style="margin:0 auto"></div>
  </td></tr>`;
  fetchInventoryAndReports();
}

function exportInventoryCSV() {
  const header = 'Product ID,Name,Stock,Sell Price,Cost Price,GST %,Stock Value,Margin %\n';
  const rows   = inventoryStock.map(p => {
    const val    = (p.stock || 0) * (p.sellPrice || 0);
    const margin = p.sellPrice && p.costPrice ? (((p.sellPrice - p.costPrice) / p.sellPrice) * 100).toFixed(1) + '%' : '';
    return `${esc(p.id)},"${esc(p.name)}",${p.stock || 0},${p.sellPrice || 0},${p.costPrice || 0},${((p.gstRate || 0) * 100).toFixed(0)}%,${val.toFixed(2)},${margin}`;
  }).join('\n');
  downloadCSV(header + rows, 'inventory_' + today() + '.csv');
}

// ─── PRODUCTS ─────────────────────────────────
function renderProductGrid(data) {
  const grid   = document.getElementById('productGrid');
  const q      = (document.getElementById('productSearch')?.value || '').toLowerCase();
  const source = (data || inventoryStock).filter(p => !q || (p.name || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q));

  if (!source.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-tags"></i><p>No products found</p></div>';
    return;
  }

  if (productViewMode === 'list') {
    grid.className = 'product-list';
    grid.innerHTML = source.map(p => {
      const margin = p.sellPrice && p.costPrice ? (((p.sellPrice - p.costPrice) / p.sellPrice) * 100).toFixed(0) + '%' : '—';
      return `<div class="product-card" style="cursor:pointer" onclick="openEditProduct('${esc(p.id)}')">
        <span class="product-card-id">${esc(p.id)}</span>
        <span class="product-card-name">${esc(p.name)}</span>
        <span class="product-card-price">${fmt(p.sellPrice || 0)}</span>
        <span class="product-card-stock">Cost: ${fmt(p.costPrice || 0)} · Stock: ${p.stock || 0} · Margin: ${margin}</span>
        ${(p.stock || 0) <= LOW_STOCK_THRESHOLD ? '<span class="badge badge-gold" style="display:inline-block">Low Stock</span>' : ''}
      </div>`;
    }).join('');
  } else {
    grid.className = 'product-grid';
    grid.innerHTML = source.map(p => {
      const margin = p.sellPrice && p.costPrice ? (((p.sellPrice - p.costPrice) / p.sellPrice) * 100).toFixed(0) : null;
      const marginColor = margin !== null && parseInt(margin) < 20 ? 'var(--gold)' : 'var(--accent2)';
      return `<div class="product-card" style="cursor:pointer" onclick="openEditProduct('${esc(p.id)}')">
        <div class="product-card-id">${esc(p.id)}</div>
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

function toggleProductView() {
  productViewMode = productViewMode === 'grid' ? 'list' : 'grid';
  renderProductGrid();
}

// ─── ADD PRODUCT MODAL ───
function openAddProduct() {
  document.getElementById('modalTitle').textContent = 'Add New Product';
  document.getElementById('modalBody').innerHTML = `
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Product ID</label><input type="text" class="form-control" id="npId" placeholder="P005"></div>
      <div class="form-group"><label class="form-label">Product Name</label><input type="text" class="form-control" id="npName" placeholder="Product name"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Category</label><input type="text" class="form-control" id="npCat" placeholder="e.g. Electronics"></div>
      <div class="form-group"><label class="form-label">Unit Type</label><input type="text" class="form-control" id="npUnit" placeholder="e.g. Kg, Pcs"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Sell Price (₹)</label><input type="number" class="form-control" id="npSellPrice" placeholder="0.00" oninput="calcPreviewMargin()"></div>
      <div class="form-group"><label class="form-label">Cost Price (₹)</label><input type="number" class="form-control" id="npCostPrice" placeholder="0.00" oninput="calcPreviewMargin()"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Initial Stock</label><input type="number" class="form-control" id="npStock" placeholder="0" step="0.01"></div>
      <div class="form-group"><label class="form-label">GST Rate</label>
        <select class="form-control" id="npGst">
          <option value="0">0% — Exempt</option><option value="0.05">5%</option>
          <option value="0.12">12%</option><option value="0.18" selected>18%</option><option value="0.28">28%</option>
        </select>
      </div>
    </div>
    <div id="marginPreview" style="font-size:0.85rem;color:var(--ink2);margin-bottom:14px"></div>
    <button class="btn btn-primary" onclick="addProductLocal()"><i class="fas fa-plus"></i> Add Product</button>`;
  document.getElementById('detailModal').classList.add('open');
}

// ─── PROFIT MARGIN CALCULATORS ────────────────
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

function addProductLocal() {
  const id        = document.getElementById('npId').value.trim();
  const name      = document.getElementById('npName').value.trim();
  const category  = document.getElementById('npCat').value.trim();
  const unit      = document.getElementById('npUnit').value.trim();
  const sellPrice = parseFloat(document.getElementById('npSellPrice').value) || 0;
  const costPrice = parseFloat(document.getElementById('npCostPrice').value) || 0;
  const stock     = parseFloat(document.getElementById('npStock').value)     || 0;
  const gstRate   = parseFloat(document.getElementById('npGst').value)       || 0;
  
  if (!id || !name) { toast('Enter Product ID and Name', 'error'); return; }
  if (inventoryStock.find(p => p.id === id)) { toast('Product ID already exists', 'error'); return; }
  
  inventoryStock.push({ id, name, category, unit, sellPrice, costPrice, gstRate, stock });
  closeModal(); renderProductGrid(); renderInventoryTable(); updateDashboard(); updateDatalists();
  
  toast('Syncing to database...', 'warn');
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "addProduct", id, name, category, unit, costPrice, sellPrice, stock, gstRate }) })
    .then(() => toast(`${name} added!`, 'success'));
}

function openEditProduct(id) {
  const p = inventoryStock.find(x => x.id === id);
  if (!p) return;
  document.getElementById('modalTitle').textContent = 'Edit Product — ' + p.name;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label class="form-label">Product Name</label><input type="text" class="form-control" id="epName" value="${esc(p.name)}"></div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Category</label><input type="text" class="form-control" id="epCat" value="${esc(p.category || '')}"></div>
      <div class="form-group"><label class="form-label">Unit Type</label><input type="text" class="form-control" id="epUnit" value="${esc(p.unit || '')}"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Sell Price (₹)</label><input type="number" class="form-control" id="epSellPrice" value="${p.sellPrice || 0}" oninput="calcPreviewMarginEdit()"></div>
      <div class="form-group"><label class="form-label">Cost Price (₹)</label><input type="number" class="form-control" id="epCostPrice" value="${p.costPrice || 0}" oninput="calcPreviewMarginEdit()"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Stock (units)</label><input type="number" class="form-control" id="epStock" value="${p.stock || 0}" step="0.01"></div>
      <div class="form-group"><label class="form-label">GST Rate</label>
        <select class="form-control" id="epGst">
          <option value="0" ${p.gstRate===0?'selected':''}>0%</option><option value="0.05" ${p.gstRate===0.05?'selected':''}>5%</option>
          <option value="0.12" ${p.gstRate===0.12?'selected':''}>12%</option><option value="0.18" ${p.gstRate===0.18?'selected':''}>18%</option>
          <option value="0.28" ${p.gstRate===0.28?'selected':''}>28%</option>
        </select>
      </div>
    </div>
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

function saveEditProduct(id) {
  const p = inventoryStock.find(x => x.id === id);
  if (!p) return;
  p.name      = document.getElementById('epName').value.trim()           || p.name;
  p.category  = document.getElementById('epCat').value.trim()            || '';
  p.unit      = document.getElementById('epUnit').value.trim()           || '';
  p.stock     = parseFloat(document.getElementById('epStock').value)     || 0;
  p.sellPrice = parseFloat(document.getElementById('epSellPrice').value) || 0;
  p.costPrice = parseFloat(document.getElementById('epCostPrice').value) || 0;
  p.gstRate   = parseFloat(document.getElementById('epGst').value)       || 0;
  
  closeModal(); renderProductGrid(); renderInventoryTable(); updateDatalists();
  
  const payload = { action: "editProduct", id, name: p.name, category: p.category, unit: p.unit, costPrice: p.costPrice, sellPrice: p.sellPrice, stock: p.stock, gstRate: p.gstRate };
  toast('Syncing changes to database...', 'warn');
  fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
    .then(() => toast('Product updated successfully!', 'success'));
}

function deleteProduct(id) {
  const idx = inventoryStock.findIndex(x => x.id === id);
  if (idx === -1) return;
  const [removed] = inventoryStock.splice(idx, 1);
  closeModal();
  renderProductGrid();
  renderInventoryTable();
  updateDatalists();
  toast(`${removed.name} deleted`, 'warn', () => {
    inventoryStock.splice(idx, 0, removed);
    renderProductGrid(); renderInventoryTable(); updateDatalists();
    toast('Undo successful', 'success');
  });
}

// ─── CUSTOMERS ────────────────────────────────
function renderCustomerGrid() {
  const grid = document.getElementById('customerGrid');
  if (!grid) return;
  const q        = (document.getElementById('customerSearch')?.value || '').toLowerCase();
  const filtered = customersArray.filter(c =>
    (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
  );
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-users"></i><p>No customers yet</p></div>';
    return;
  }
  grid.innerHTML = filtered.map(c => {
    // fix: case-insensitive invoice count
    const invCount = invoicesArray.filter(i => i.customerName.toLowerCase() === c.name.toLowerCase()).length;
    const total    = invoicesArray.filter(i => i.customerName.toLowerCase() === c.name.toLowerCase()).reduce((s, i) => s + (i.grandTotal || 0), 0);
    return `<div class="customer-card" onclick="openCustomerLedger('${esc(c.id)}')">
      <div class="customer-name"><i class="fas fa-user-circle" style="color:var(--accent2);margin-right:6px"></i>${esc(c.name)}</div>
      ${c.email   ? `<div class="customer-detail"><i class="fas fa-envelope" style="margin-right:4px"></i>${esc(c.email)}</div>`          : ''}
      ${c.address ? `<div class="customer-detail"><i class="fas fa-map-marker-alt" style="margin-right:4px"></i>${esc(c.address)}</div>` : ''}
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:0.78rem;color:var(--accent2);font-weight:600">${invCount} invoice${invCount !== 1 ? 's' : ''}</span>
        <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.9rem;color:var(--accent)">${fmt(total)}</span>
      </div>
    </div>`;
  }).join('');
}

function filterCustomers() { renderCustomerGrid(); }

function openAddCustomer() {
  document.getElementById('modalTitle').textContent = 'Add Customer';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-control" id="ncName" placeholder="Customer name"></div>
    <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="ncEmail" placeholder="email@example.com"></div>
    <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" id="ncPhone" placeholder="+91 00000 00000"></div>
    <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" id="ncAddr" placeholder="Address..."></textarea></div>
    <div style="margin-top:16px"><button class="btn btn-primary" onclick="addCustomerLocal()"><i class="fas fa-user-plus"></i> Add Customer</button></div>`;
  document.getElementById('detailModal').classList.add('open');
}

function addCustomerLocal() {
  const name = document.getElementById('ncName').value.trim();
  if (!name) { toast('Enter a name', 'error'); return; }
  const c = { id: 'CUST-' + Date.now().toString().slice(-6), name, email: document.getElementById('ncEmail').value.trim(), phone: document.getElementById('ncPhone').value.trim(), address: document.getElementById('ncAddr').value.trim() };
  customersArray.push(c);
  updateDatalists();
  closeModal();
  renderCustomerGrid();
  toast(`${name} added`, 'success');
}

// Customer ledger view
function openCustomerLedger(id) {
  const c = customersArray.find(x => x.id === id);
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
    ${c.email   ? `<div style="font-size:0.85rem;color:var(--ink2);margin-bottom:4px"><i class="fas fa-envelope" style="margin-right:6px"></i>${esc(c.email)}</div>`          : ''}
    ${c.phone   ? `<div style="font-size:0.85rem;color:var(--ink2);margin-bottom:4px"><i class="fas fa-phone"   style="margin-right:6px"></i>${esc(c.phone)}</div>`           : ''}
    ${c.address ? `<div style="font-size:0.85rem;color:var(--ink2);margin-bottom:12px"><i class="fas fa-map-marker-alt" style="margin-right:6px"></i>${esc(c.address)}</div>` : ''}
    <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px;color:var(--ink)">Invoice History</div>
    ${invs.length ? invs.map(i => `
      <div class="list-item" onclick="closeModal();showInvoiceDetail('${esc(i.invoiceId)}')">
        <div><div class="list-item-title">${esc(i.invoiceId)}</div><div class="list-item-sub">${dateLabel(i.date)}</div></div>
        <div style="text-align:right"><div class="list-item-amount">${fmt(i.grandTotal)}</div>${getStatusBadge(i)}</div>
      </div>`).join('') : '<div class="empty-state"><i class="fas fa-file"></i><p>No invoices for this customer</p></div>'}`;
  document.getElementById('detailModal').classList.add('open');
}

// ─── SUPPLIERS ────────────────────────────────
function renderSupplierGrid() {
  const grid = document.getElementById('supplierGrid');
  if (!grid) return;
  const q        = (document.getElementById('supplierSearch')?.value || '').toLowerCase();
  const filtered = suppliersArray.filter(s => (s.name || '').toLowerCase().includes(q));
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-building"></i><p>No suppliers yet</p></div>';
    return;
  }
  grid.innerHTML = filtered.map(s => {
    const purCount = purchasesArray.filter(p => p.supplier.toLowerCase() === s.name.toLowerCase()).length;
    const total    = purchasesArray.filter(p => p.supplier.toLowerCase() === s.name.toLowerCase()).reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    return `<div class="customer-card">
      <div class="customer-name"><i class="fas fa-building" style="color:var(--accent2);margin-right:6px"></i>${esc(s.name)}</div>
      ${s.phone        ? `<div class="customer-detail"><i class="fas fa-phone" style="margin-right:4px"></i>${esc(s.phone)}</div>` : ''}
      ${s.address      ? `<div class="customer-detail"><i class="fas fa-map-marker-alt" style="margin-right:4px"></i>${esc(s.address)}</div>` : ''}
      ${s.paymentTerms ? `<div class="customer-detail"><i class="fas fa-clock" style="margin-right:4px"></i>${esc(s.paymentTerms)}</div>` : ''}
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:0.78rem;color:var(--info);font-weight:600">${purCount} purchase${purCount !== 1 ? 's' : ''}</span>
        <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.9rem;color:var(--gold)">${fmt(total)}</span>
      </div>
    </div>`;
  }).join('');
}

function filterSuppliers() { renderSupplierGrid(); }

function openAddSupplier() {
  document.getElementById('modalTitle').textContent = 'Add Supplier';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label class="form-label">Supplier Name</label><input type="text" class="form-control" id="nsName" placeholder="Supplier / vendor name"></div>
    <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" id="nsPhone" placeholder="+91 00000 00000"></div>
    <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" id="nsAddr" placeholder="Address..."></textarea></div>
    <div class="form-group"><label class="form-label">Payment Terms</label><input type="text" class="form-control" id="nsPay" placeholder="e.g. Net 30, Advance, COD"></div>
    <div style="margin-top:16px"><button class="btn btn-primary" onclick="addSupplierLocal()"><i class="fas fa-plus"></i> Add Supplier</button></div>`;
  document.getElementById('detailModal').classList.add('open');
}

function addSupplierLocal() {
  const name = document.getElementById('nsName').value.trim();
  if (!name) { toast('Enter a supplier name', 'error'); return; }
  suppliersArray.push({ id: 'SUPP-' + Date.now().toString().slice(-6), name, phone: document.getElementById('nsPhone').value.trim(), address: document.getElementById('nsAddr').value.trim(), paymentTerms: document.getElementById('nsPay').value.trim() });
  updateDatalists();
  closeModal();
  renderSupplierGrid();
  toast(`${name} added`, 'success');
}

// ─── DATALISTS ────────────────────────────────
function updateDatalists() {
  const custDl = document.getElementById('customerList');
  const suppDl = document.getElementById('supplierList');
  const prodDl = document.getElementById('productList');
  if (custDl) custDl.innerHTML = customersArray.map(c  => `<option value="${esc(c.name)}">`).join('');
  if (suppDl) suppDl.innerHTML = suppliersArray.map(s  => `<option value="${esc(s.name)}">`).join('');
  if (prodDl) prodDl.innerHTML = inventoryStock.map(p  => `<option value="${esc(p.name)}">`).join('');
}
