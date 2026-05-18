// ══════════════════════════════════════════════
//        EXPENSES TRACKING ENGINE
// ══════════════════════════════════════════════

// Initialize state
if (typeof App.expensesArray === 'undefined') App.expensesArray = [];
let expensesArray = App.expensesArray;

function renderExpenses() {
  const tbody = document.getElementById('expenseTableBody');
  if (!tbody) return;
  
  const q = (document.getElementById('expenseSearch')?.value || '').toLowerCase();
  const cat = document.getElementById('expenseCategoryFilter')?.value || 'all';

  let filtered = expensesArray.filter(e => {
    const matchQ = (e.desc || '').toLowerCase().includes(q);
    const matchCat = cat === 'all' || e.category === cat;
    return matchQ && matchCat;
  });

  // Sort newest first
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--ink3);"><i class="fas fa-wallet fa-2x" style="opacity:0.5; margin-bottom:10px;"></i><br>No expenses found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(e => `
    <tr>
      <td>${dateLabel(e.date)}</td>
      <td><span class="filter-chip" style="background:var(--surface2); border:1px solid var(--border);">${esc(e.category)}</span></td>
      <td>${esc(e.desc)}</td>
      <td>${esc(e.mode)}</td>
      <td style="text-align: right; font-weight: 700; color: var(--danger);">₹ ${fmt(e.amount)}</td>
      <td style="text-align: right;">
        <button class="btn btn-icon" onclick="deleteExpense('${e.id}')" style="color:var(--danger);" title="Delete"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function openAddExpense() {
  const modal = document.getElementById('modalBody');
  modal.innerHTML = `
    <div style="padding: 20px;">
      <h3 style="margin-bottom:20px; color:var(--ink);"><i class="fas fa-wallet" style="color:var(--danger); margin-right:8px;"></i>Record Expense</h3>
      
      <div class="grid-2" style="gap:16px; margin-bottom:16px;">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" id="expDate" class="form-control" value="${today()}">
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select id="expCat" class="form-control">
            <option value="Salary">Salary</option>
            <option value="Rent">Rent</option>
            <option value="Utilities">Utilities</option>
            <option value="Marketing">Marketing</option>
            <option value="Logistics">Logistics</option>
            <option value="Office Supplies">Office Supplies</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:16px;">
        <label class="form-label">Description / Notes</label>
        <input type="text" id="expDesc" class="form-control" placeholder="e.g. Electricity bill for May">
      </div>

      <div class="grid-2" style="gap:16px; margin-bottom:24px;">
        <div class="form-group">
          <label class="form-label">Amount (₹)</label>
          <input type="number" id="expAmt" class="form-control" placeholder="0.00" step="0.01">
        </div>
        <div class="form-group">
          <label class="form-label">Payment Mode</label>
          <select id="expMode" class="form-control">
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="UPI">UPI</option>
            <option value="Credit Card">Credit Card</option>
          </select>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:12px; border-top:1px solid var(--border); padding-top:16px;">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="saveExpense()">Save Expense</button>
      </div>
    </div>
  `;
  
  // Show your modal container (Adjust ID if your modal overlay uses a different ID)
  document.querySelector('.modal-overlay').style.display = 'flex';
}

async function saveExpense() {
  const date = document.getElementById('expDate').value;
  const category = document.getElementById('expCat').value;
  const desc = document.getElementById('expDesc').value.trim();
  const amount = parseFloat(document.getElementById('expAmt').value) || 0;
  const mode = document.getElementById('expMode').value;

  if (!desc || amount <= 0) { toast('Please enter a valid description and amount.', 'error'); return; }

  const expenseData = {
    id: 'EXP-' + Date.now(),
    store_id: currentStoreId,
    date: date, 
    category: category, 
    desc_text: desc, // Maps to SQL
    amount: amount, 
    mode: mode
  };

  // Update UI Instantly
  expensesArray.push({ ...expenseData, desc: desc });
  closeModal(); renderExpenses();
  
  toast('Saving expense to cloud...', 'info');
  const { error } = await supabase.from('expenses').insert([expenseData]);
  
  if (error) toast('Failed to save expense.', 'error');
  else toast('Expense recorded successfully!', 'success');
}

async function deleteExpense(id) {
  if(!confirm('Are you sure you want to delete this expense?')) return;
  const idx = expensesArray.findIndex(e => e.id === id);
  if(idx > -1) {
    expensesArray.splice(idx, 1);
    renderExpenses();
    
    toast('Deleting from cloud...', 'warn');
    const { error } = await supabase.from('expenses').delete().eq('id', id).eq('store_id', currentStoreId);
    if (error) toast('Delete failed.', 'error');
    else toast('Expense deleted', 'success');
  }
}

// Ensure it loads on startup
setTimeout(() => {
  if (typeof renderExpenses === 'function') renderExpenses();
}, 200);