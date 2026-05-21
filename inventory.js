// ══════════════════════════════════════════════════════════════
//        INVENTORY & PRODUCTS MODULE (UNIFIED 3-VIEW ENGINE)
// ══════════════════════════════════════════════════════════════

function fallbackStock() {
  if (!inventoryStock.length) {
    inventoryStock.push(
      { id: 'ITM-001', name: 'Sample Product A', category: 'Electronics', stock: 45, costPrice: 800, sellPrice: 1200, gstRate: 0.18, hsn: '8517', type: 'Goods', status: 'Active', unit: 'PCS', barcode: '' },
      { id: 'ITM-002', name: 'Sample Product B', category: 'Accessories', stock: 8, costPrice: 500, sellPrice: 850, gstRate: 0.12, hsn: '8518', type: 'Goods', status: 'Active', unit: 'PCS', barcode: '' }
    );
  }
  syncUI();
}

function renderInventoryTable(data) { renderProductGrid(data); }

function renderProductGrid(data) {
  const container = document.getElementById('productGrid');
  if (!container) return;

  const q = (document.getElementById('productSearch')?.value || '').toLowerCase();
  const catFilter = document.getElementById('productCategoryFilter')?.value || 'all';
  const viewType = localStorage.getItem('bs_view_product') || 'grid';

  populateCategoryFilter();

  let filtered = (data || inventoryStock).filter(p => {
    const matchesSearch = !q || (p.name || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q) || (p.hsn || '').toLowerCase().includes(q);
    const matchesCat = (catFilter === 'all') || (p.category === catFilter);
    return matchesSearch && matchesCat;
  });

  // ─── SEPARATED KPI LOGIC CALL ───
  if (typeof updateInventoryKPIs === 'function') {
    updateInventoryKPIs();
  }

  if (!filtered.length) {
    container.className = `view-container view-${viewType}`;
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-tags"></i><p>No products match your criteria.</p></div>';
    return;
  }

  container.className = `view-container view-${viewType}`;

  if (viewType === 'table') {
    container.innerHTML = `
      <table class="invoice-table" style="width:100%">
        <thead>
          <tr>
            <th>Item ID</th>
            <th>Product Name</th>
            <th>Category</th>
            <th>HSN/SAC</th>
            <th style="text-align:right">Sell Price</th>
            <th style="text-align:right">Cost Price</th>
            <th style="text-align:center">GST</th>
            <th style="text-align:right">Valuation</th>
            <th style="text-align:center; width:90px">Available</th>
            <th style="text-align:center; width:120px">Status</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(p => {
            const stockVal = (p.stock || 0) * (p.sellPrice || 0);
            const isLow = (p.stock || 0) <= LOW_STOCK_THRESHOLD;
            const badge = (p.stock || 0) === 0 ? '<span class="badge badge-red">Out of Stock</span>' : isLow ? '<span class="badge badge-gold">Low Stock</span>' : '<span class="badge badge-green">In Stock</span>';
            return `
              <tr onclick="openEditProduct('${esc(p.id)}')" style="cursor:pointer">
                <td style="font-family:monospace; color:var(--ink3)">${esc(p.id)}</td>
                <td style="font-weight:600; color:var(--ink)">${esc(p.name)}</td>
                <td><span class="badge badge-gray">${esc(p.category) || 'General'}</span></td>
                <td style="font-family:monospace; color:var(--ink2)">${esc(p.hsn) || '-'}</td>
                <td style="text-align:right; font-weight:600">₹${fmt(p.sellPrice)}</td>
                <td style="text-align:right; color:var(--ink2)">₹${fmt(p.costPrice)}</td>
                <td style="text-align:center">${((p.gstRate || 0) * 100).toFixed(0)}%</td>
                <td style="text-align:right; font-weight:600">₹${fmt(stockVal)}</td>
                <td style="text-align:center; font-weight:700; color:${isLow ? 'var(--danger)' : 'var(--ink)'}">${p.stock || 0}</td>
                <td style="text-align:center">${badge}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } else {
    container.innerHTML = filtered.map(p => {
      const margin = p.sellPrice && p.costPrice ? (((p.sellPrice - p.costPrice) / p.sellPrice) * 100).toFixed(0) : null;
      const isLow = (p.stock || 0) <= LOW_STOCK_THRESHOLD;
      return `
        <div class="contact-card" onclick="openEditProduct('${esc(p.id)}')" style="cursor:pointer; background:var(--surface); border:1px solid var(--border); border-radius:var(--r-md); padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%; gap:12px;">
            <div style="flex:1">
              <div style="font-family:monospace; font-size:0.75rem; color:var(--ink3); font-weight:600; margin-bottom:4px;">${esc(p.id)} ${p.hsn ? `(HSN: ${p.hsn})` : ''}</div>
              <div style="font-weight:700; color:var(--ink); font-size:1.05rem; margin-bottom:6px;">${esc(p.name)}</div>
              <div style="font-size:0.8rem; color:var(--ink2);">Cost: ₹${fmt(p.costPrice)} · GST ${((p.gstRate || 0) * 100).toFixed(0)}%</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.7rem; text-transform:uppercase; color:var(--ink3); font-weight:600;">Selling Price</div>
              <div style="font-size:1.1rem; font-weight:800; color:var(--accent)">₹${fmt(p.sellPrice)}</div>
              ${margin !== null ? `<div style="font-size:0.7rem; color:var(--accent2); font-weight:600; margin-top:2px;">Margin: ${margin}%</div>` : ''}
            </div>
          </div>
          <div style="border-top:1px solid var(--border); padding-top:10px; margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
            <span class="badge badge-gray">${esc(p.category) || 'General'}</span>
            <span style="font-size:0.8rem; font-weight:700; color:${isLow ? 'var(--danger)' : 'var(--ink2)'}">Stock: ${p.stock || 0}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

function filterInventory() { renderProductGrid(); }
function toggleProductView() { renderProductGrid(); }

function refreshInventory() { loadSupabaseData(); }

function exportInventoryCSV() {
  const header = 'Product ID,Name,Category,HSN,Stock,Sell Price,Cost Price,GST %,Stock Value\n';
  const rows = inventoryStock.map(p => `${p.id},"${p.name}","${p.category||''}",${p.hsn||''},${p.stock||0},${p.sellPrice||0},${p.costPrice||0},${((p.gstRate||0)*100).toFixed(0)}%,${((p.stock||0)*(p.sellPrice||0)).toFixed(2)}`).join('\n');
  downloadCSV(header + rows, 'inventory_' + today() + '.csv');
}

function populateCategoryFilter() {
  const filter = document.getElementById('productCategoryFilter');
  if (!filter) return;
  const cats = [...new Set(inventoryStock.map(p => p.category).filter(c => c && c.trim() !== ''))].sort();
  const currentVal = filter.value;
  filter.innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (cats.includes(currentVal)) filter.value = currentVal;
}

function toggleItemType(prefix) {
  const type = document.getElementById(prefix + 'pType').value;
  const stockGroup = document.getElementById(prefix + 'StockGroup');
  if (stockGroup) stockGroup.style.display = type === 'Service' ? 'none' : 'block';
}

function openAddProduct() {
  document.getElementById('modalTitle').textContent = 'Add New Item';
  document.getElementById('modalBody').innerHTML = `
    <div class="grid-3">
      <div class="form-group"><label class="form-label">Item Type</label><select class="form-control" id="npType" onchange="toggleItemType('n')"><option value="Goods">Goods</option><option value="Service">Service</option></select></div>
      <div class="form-group"><label class="form-label">Item ID</label><input type="text" class="form-control" id="npId" value="${getNextId('product')}"></div>
      <div class="form-group"><label class="form-label">Barcode / EAN</label><input type="text" class="form-control" id="npBarcode" placeholder="Scan or type..."></div>
    </div>
    <div class="form-group"><label class="form-label">Item Name</label><input type="text" class="form-control" id="npName" placeholder="Enter product name"></div>
    <div class="grid-3">
      <div class="form-group"><label class="form-label">Category</label><input type="text" class="form-control" id="npCat" placeholder="Electronics" list="categoryList"></div>
      <div class="form-group"><label class="form-label">HSN/SAC Code</label><input type="text" class="form-control" id="npHsn" placeholder="8517"></div>
      <div class="form-group"><label class="form-label">Unit Type</label><input type="text" class="form-control" id="npUnit" placeholder="PCS" list="unitList" style="text-transform:uppercase;"></div>
    </div>
    <div class="grid-3">
      <div class="form-group"><label class="form-label">Cost Price (₹)</label><input type="number" class="form-control" id="npCostPrice" placeholder="0.00"></div>
      <div class="form-group"><label class="form-label">Sell Price (₹)</label><input type="number" class="form-control" id="npSellPrice" placeholder="0.00"></div>

  <div class="form-group"><label class="form-label">Margin(%) / Profit(₹)</label>

  <input type="text" class="form-control" id="npMargin" placeholder="10% or 50"></div>
    </div>
    <div class="grid-3">
      <div class="form-group" id="nStockGroup"><label class="form-label">Initial Stock</label><input type="number" class="form-control" id="npStock" placeholder="0" step="0.01"></div>
      <div class="form-group"><label class="form-label">GST Rate</label>
        <select class="form-control" id="npGst">
          <option value="0">0%</option><option value="0.05">5%</option><option value="0.12">12%</option><option value="0.18" selected>18%</option><option value="0.28">28%</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Status</label><select class="form-control" id="npStatus"><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
    </div>
    <div id="marginPreview" style="font-size:0.85rem;color:var(--ink2);margin-bottom:14px"></div>
    <button class="btn btn-primary" id="saveProductBtn" onclick="addProductLocal()"><i class="fas fa-plus"></i> Add Item</button>`;
  document.getElementById('detailModal').classList.add('open');

  setupSmartMarginCalculator();
}

function calcPreviewMargin() {
  const cost = parseFloat(document.getElementById('npCostPrice').value) || 0;
  const sell = parseFloat(document.getElementById('npSellPrice').value) || 0;
  const preview = document.getElementById('marginPreview');
  if (!preview) return;
  if (cost > 0 && sell > 0) {
    const margin = ((sell - cost) / sell) * 100;
    preview.innerHTML = `Profit Margin: <strong>${margin.toFixed(1)}%</strong>`;
    preview.style.color = margin >= 0 ? 'var(--accent2)' : 'var(--danger)';
  } else { preview.innerHTML = ''; }
}

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
      <div class="form-group"><label class="form-label">Category</label><input type="text" class="form-control" id="epCat" value="${esc(p.category || '')}"></div>
      <div class="form-group"><label class="form-label">HSN/SAC Code</label><input type="text" class="form-control" id="epHsn" value="${esc(p.hsn || '')}"></div>
      <div class="form-group"><label class="form-label">Unit Type</label><input type="text" class="form-control" id="epUnit" value="${esc(p.unit || '')}" style="text-transform:uppercase;"></div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">Sell Price (₹)</label><input type="number" class="form-control" id="epSellPrice" value="${p.sellPrice || 0}"></div>
      <div class="form-group"><label class="form-label">Cost Price (₹)</label><input type="number" class="form-control" id="epCostPrice" value="${p.costPrice || 0}"></div>
    </div>
    <div class="grid-2">
      <div class="form-group" id="eStockGroup" style="display:${p.type==='Service'?'none':'block'}"><label class="form-label">Stock Count</label><input type="number" class="form-control" id="epStock" value="${p.stock || 0}" step="0.01"></div>
      <div class="form-group"><label class="form-label">GST Rate</label>
        <select class="form-control" id="epGst">
          <option value="0" ${p.gstRate===0?'selected':''}>0%</option><option value="0.05" ${p.gstRate===0.05?'selected':''}>5%</option><option value="0.12" ${p.gstRate===0.12?'selected':''}>12%</option><option value="0.18" ${p.gstRate===0.18?'selected':''}>18%</option><option value="0.28" ${p.gstRate===0.28?'selected':''}>28%</option>
        </select>
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
      <button class="btn btn-primary" id="editProductSaveBtn" onclick="saveEditProduct('${esc(id)}')"><i class="fas fa-save"></i> Save Changes</button>
      <button class="btn btn-danger btn-sm" onclick="deleteProduct('${esc(id)}')"><i class="fas fa-trash"></i> Delete</button>
    </div>`;
  document.getElementById('detailModal').classList.add('open');
}

async function addProductLocal() {
  const id = document.getElementById('npId').value.trim();
  const name = document.getElementById('npName').value.trim();
  if (!id || !name) { toast('Enter Item ID and Name', 'error'); return; }
  
  const btn = document.getElementById('saveProductBtn');
  if (typeof setButtonLoading === 'function') setButtonLoading(btn, true, 'Saving...');

  // 1. Create the payload with BOTH formats so it perfectly matches a freshly loaded item!
  const p = { 
    id, 
    store_id: currentStoreId, // Ensure the store_id is attached locally too
    name, 
    type: document.getElementById('npType').value, 
    barcode: document.getElementById('npBarcode').value.trim(), 
    status: document.getElementById('npStatus').value, 
    category: document.getElementById('npCat').value.trim(), 
    hsn: document.getElementById('npHsn').value.trim(), 
    unit: document.getElementById('npUnit').value.trim(), 
    
    // UI bindings
    sellPrice: parseFloat(document.getElementById('npSellPrice').value) || 0, 
    costPrice: parseFloat(document.getElementById('npCostPrice').value) || 0, 
    gstRate: parseFloat(document.getElementById('npGst').value) || 0, 
    
    // Database bindings (Prevents crashing in purchase.js before a refresh)
    sell_price: parseFloat(document.getElementById('npSellPrice').value) || 0, 
    cost_price: parseFloat(document.getElementById('npCostPrice').value) || 0, 
    gst_rate: parseFloat(document.getElementById('npGst').value) || 0, 
    
    stock: parseFloat(document.getElementById('npStock').value) || 0 
  };
  
  // 2. WAIT for the database to confirm it actually saved FIRST
  const { error } = await supabase.from('inventory').insert([{ 
      id: p.id, store_id: p.store_id, name: p.name, type: p.type, barcode: p.barcode, 
      status: p.status, category: p.category, hsn: p.hsn, unit: p.unit, 
      sell_price: p.sell_price, cost_price: p.cost_price, gst_rate: p.gst_rate, stock: p.stock 
  }]);

  // 3. Reset the button state
  if (typeof setButtonLoading === 'function') setButtonLoading(btn, false, 'Add Item');

  // 4. Handle success or failure safely
  if (error) {
      console.error("Insert error:", error);
      toast('Cloud save failed. Item not added.', 'error');
  } else {
      // ONLY update the UI if the database successfully accepted the row
      inventoryStock.push(p);
      closeModal();
      if (typeof syncUI === 'function') syncUI();
      toast('Product catalog updated!', 'success');
  }
}

async function saveEditProduct(id) {
  const p = inventoryStock.find(x => x.id === id);
  if (!p) return;
  const btn = document.getElementById('editProductSaveBtn');
  setButtonLoading(btn, true, 'Saving...');

  p.name = document.getElementById('epName').value.trim();
  p.type = document.getElementById('epType').value;
  p.barcode = document.getElementById('epBarcode').value.trim();
  p.status = document.getElementById('epStatus').value;
  p.category = document.getElementById('epCat').value.trim();
  p.hsn = document.getElementById('epHsn').value.trim();
  p.unit = document.getElementById('epUnit').value.trim();
  p.sellPrice = parseFloat(document.getElementById('epSellPrice').value) || 0;
  p.costPrice = parseFloat(document.getElementById('epCostPrice').value) || 0;
  p.gstRate = parseFloat(document.getElementById('epGst').value) || 0;
  p.stock = p.type === 'Service' ? 0 : (parseFloat(document.getElementById('epStock').value) || 0);

  closeModal();
  syncUI();

  const { error } = await supabase.from('inventory').update({ name: p.name, type: p.type, barcode: p.barcode, status: p.status, category: p.category, hsn: p.hsn, unit: p.unit, sell_price: p.sellPrice, cost_price: p.costPrice, gst_rate: p.gstRate, stock: p.stock }).eq('id', id).eq('store_id', currentStoreId);
  setButtonLoading(btn, false, 'Save Changes');
  if (error) toast('Cloud save failed.', 'error'); else toast('Catalog synchronized!', 'success');
}

async function deleteProduct(id) {
  const idx = inventoryStock.findIndex(x => x.id === id);
  if (idx === -1) return;
  if(!confirm(`Delete ${inventoryStock[idx].name}?`)) return;
  inventoryStock.splice(idx, 1);
  closeModal();
  syncUI();
  await supabase.from('inventory').delete().eq('id', id).eq('store_id', currentStoreId);
  toast('Product deleted permanently.', 'success');
}

function updateDatalists() {
  const custDl = document.getElementById('customerList');
  const suppDl = document.getElementById('supplierList');
  const prodDl = document.getElementById('productList');
  if (custDl) custDl.innerHTML = customersArray.map(c => `<option value="${esc(c.name)}">`).join('');
  if (suppDl) suppDl.innerHTML = suppliersArray.map(s => `<option value="${esc(s.name)}">`).join('');
  if (prodDl) prodDl.innerHTML = inventoryStock.map(p => `<option value="${esc(p.name)}">`).join('');
}

function updateInventoryKPIs() {
  let totalCostValue = 0;
  let totalSellValue = 0;
  let lowCount = 0;

  inventoryStock.forEach(p => {
    // Safely parse the quantity
    const qty = parseFloat(p.stock || 0);
    
    // Safely look for both snake_case (database) and camelCase (UI) formats
    const cost = parseFloat(p.cost_price || p.costPrice || 0);
    const sell = parseFloat(p.sell_price || p.sellPrice || 0);
    
    // We only calculate valuation for actual items in the warehouse (qty > 0)
    // This prevents negative stock (overselling) from skewing your asset value
    if (qty > 0) {
      totalCostValue += (qty * cost);
      totalSellValue += (qty * sell);
    }

    // Check low stock threshold
    if (qty <= LOW_STOCK_THRESHOLD) lowCount++;
  });

  // Helper function to format as Indian Rupees cleanly
  const formatCurrency = (val) => '₹ ' + val.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });

  // 1. Update Total Products count
  const kpiTotal = document.getElementById('invTotalProducts'); 
  if (kpiTotal) kpiTotal.textContent = inventoryStock.length;
  
  // 2. Update Total COST Value
  const kpiCost = document.getElementById('kpiTotalCostValue'); 
  if (kpiCost) kpiCost.textContent = formatCurrency(totalCostValue);
  
  // 3. Update Total SELLING Value
  const kpiSell = document.getElementById('kpiTotalSellValue'); 
  if (kpiSell) kpiSell.textContent = formatCurrency(totalSellValue);
  
  // 4. Update Low Stock Counters
  const kpiLow = document.getElementById('invLowStockCount'); 
  if (kpiLow) kpiLow.textContent = lowCount;
  
  const dashLow = document.getElementById('dashLowStock'); 
  if (dashLow) dashLow.textContent = lowCount;
  
  // 5. Update Low Stock Banner display
  const banner = document.getElementById('lowStockBanner');
  if (banner) {
    banner.style.display = lowCount > 0 ? 'flex' : 'none';
    const bannerText = document.getElementById('lowStockBannerText');
    if (bannerText) bannerText.textContent = `${lowCount} low stock item${lowCount > 1 ? 's' : ''}`;
  }
}

// ─────────────────────────────────────────────
// SMART SINGLE INPUT MARGIN SYSTEM
// 50   => ₹50 profit
// 10%  => 10 percent margin
// ─────────────────────────────────────────────

function setupSmartMarginCalculator() {

  const cpInput = document.getElementById('npCostPrice');
  const spInput = document.getElementById('npSellPrice');
  const marginInput = document.getElementById('npMargin');
  const preview = document.getElementById('marginPreview');

  if (!cpInput || !spInput || !marginInput) return;

  let lock = false;

  // ─────────────────────────────
  // Calculate Sell Price
  // ─────────────────────────────
  function calculateSellPrice() {

    if (lock) return;

    lock = true;

    const cp = parseFloat(cpInput.value) || 0;

    let marginRaw = marginInput.value.trim();

    if (!marginRaw || cp <= 0) {

      lock = false;
      return;
    }

    let sp = cp;

    // Percent Mode
    if (marginRaw.includes('%')) {

      let percent = parseFloat(
        marginRaw.replace('%', '')
      ) || 0;

      sp = cp + (cp * percent / 100);

    }

    // Rupee Mode
    else {

      let profitRs = parseFloat(marginRaw) || 0;

      sp = cp + profitRs;
    }

    spInput.value = sp.toFixed(2);

    updatePreview();

    lock = false;
  }

  // ─────────────────────────────
  // Reverse Calculation
  // ─────────────────────────────
  function calculateFromSellPrice() {

    if (lock) return;

    lock = true;

    const cp = parseFloat(cpInput.value) || 0;
    const sp = parseFloat(spInput.value) || 0;

    if (cp <= 0 || sp <= 0) {

      lock = false;
      return;
    }

    const profitRs = sp - cp;
    const marginPercent = ((profitRs / cp) * 100);

    // Preserve existing mode
    if (marginInput.value.includes('%')) {

      marginInput.value =
        marginPercent.toFixed(2) + '%';

    } else {

      marginInput.value =
        profitRs.toFixed(2);
    }

    updatePreview();

    lock = false;
  }

  // ─────────────────────────────
  // Preview
  // ─────────────────────────────
  function updatePreview() {

    const cp = parseFloat(cpInput.value) || 0;
    const sp = parseFloat(spInput.value) || 0;

    if (cp <= 0 || sp <= 0) {

      preview.innerHTML = '';

      return;
    }

    const profitRs = sp - cp;
    const marginPercent =
      ((profitRs / cp) * 100);

    preview.innerHTML = `
      Profit ₹${profitRs.toFixed(2)}
      &nbsp;•&nbsp;
      Margin ${marginPercent.toFixed(2)}%
    `;

    // Loss warning
    if (sp < cp) {

      preview.innerHTML += `
        <span style="color:#ff4d4f;font-weight:600;">
          &nbsp;• LOSS
        </span>
      `;
    }
  }

  // ─────────────────────────────
  // Events
  // ─────────────────────────────

  cpInput.addEventListener(
    'input',
    calculateSellPrice
  );

  marginInput.addEventListener(
    'input',
    calculateSellPrice
  );

  spInput.addEventListener(
    'input',
    calculateFromSellPrice
  );

  // Initial
  updatePreview();
}
