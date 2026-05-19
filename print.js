// ─── MASTER BUILD INVOICE HTML ENGINE ───
function buildInvoiceHTML(invData, templateName, isSample) {
  const form = invData || {};
  const getLive = (id) => document.getElementById(id) ? document.getElementById(id).value : '';

  // Get dynamic state codes for POS printing
  const myStateCode = bizProfile.state || '';
  const custGSTIN = form.customerGstin || document.getElementById('customerGstin')?.value || '';
  const custStateCode = custGSTIN.substring(0, 2);

  // Safely define POS name based on state codes
  let placeOfSupplyStr = "";
  if (typeof GST_STATE_CODES !== 'undefined') {
    if (custStateCode && GST_STATE_CODES[custStateCode]) {
      placeOfSupplyStr = `${GST_STATE_CODES[custStateCode]} (${custStateCode})`;
    } else if (myStateCode && GST_STATE_CODES[myStateCode]) {
      placeOfSupplyStr = `${GST_STATE_CODES[myStateCode]} (${myStateCode})`; 
    }
  }

  // Map Data Context
  const data = {
    bizName: bizProfile.name || '',
    bizAddr: bizProfile.address || '',
    bizContact: bizProfile.phone || '',
    bizGst: bizProfile.gstin || '',
    bizPan: bizProfile.pan || '', 
    bankName: bizProfile.bankName || '',
    bankHolder: bizProfile.bankHolder || '', // <-- ADD THIS LINE!
    bankAcc: bizProfile.bankAcc || '',
    bankIFSC: bizProfile.bankIFSC || '',
    bankBranch: bizProfile.bankBranch || '',
    logo: bizProfile.logo || '',           
    signature: bizProfile.signature || '', 
    
    invNo: form.invoiceId || form.invNo || getLive('invNumber') || 'DRAFT',
    invDate: form.date || form.invDate || getLive('invDate') || today(),
    dueDate: form.dueDate || getLive('dueDate') || addDays(today(), 15),
    customerName: form.customerName || form.clientName || getLive('customerName') || 'Customer',
    customerEmail: form.customerEmail || form.clientEmail || getLive('customerEmail') || '',
    customerPhone: form.customerPhone || getLive('customerPhone') || '',
    billingAddress: form.billingAddress || form.clientAddr || getLive('billingAddr') || '',
    placeOfSupply: placeOfSupplyStr,
    
    gstType: form.gstType || (typeof invGstType !== 'undefined' ? invGstType : 'Exclusive'),
    supplyType: form.supplyType || (typeof App !== 'undefined' ? App.currentInvoiceSupplyType : 'intra') || 'intra',
    
    savedDiscount: form.discount !== undefined ? parseFloat(form.discount) : undefined,
    liveDiscVal: parseFloat(getLive('invDiscountVal')) || 0,
    liveDiscType: typeof invDiscType !== 'undefined' ? invDiscType : 'flat',
    
    paidAmount: parseFloat(form.paidAmount) || 0,
    paymentStatus: form.paymentStatus || 'pending',
    notes: form.notes || '',
    terms: form.terms || bizProfile.terms || 'Thank you for your business!'
  };

  let rawItems = (form.items && form.items.length > 0) ? form.items : (typeof invLineItems !== 'undefined' ? invLineItems : []);
  data.items = rawItems.map(i => ({
    desc: i.description || i.desc || '',
    hsn: i.hsn || '',
    qty: parseFloat(i.quantity || i.qty) || 0,
    price: parseFloat(i.unitPrice || i.price) || 0,
    gstRate: parseFloat(i.gstRate) || 0
  })).filter(it => it.desc && it.desc.trim().toLowerCase() !== 'add item');

  // 1. LIVE PREVIEW ENGINE: Read checkboxes directly
  const getOpt = (id, key) => {
    const el = document.getElementById(id);
    if (el) return el.checked;
    if (bizProfile && bizProfile.printOptions && bizProfile.printOptions[key] !== undefined) return bizProfile.printOptions[key];
    return true;
  };
  
  const opts = {
    showLogo:        getOpt('ptShowLogo', 'showLogo'),
    showBizAddr:     getOpt('ptShowBizAddr', 'showBizAddr'),
    showBizGst:      getOpt('ptShowBizGst', 'showBizGst'),
    showBizPan:      getOpt('ptShowBizPan', 'showBizPan'),
    showTaxLabel:    getOpt('ptShowTaxLabel', 'showTaxLabel'),
    showHsn:         getOpt('ptShowHsn', 'showHsn'),
    showTax:         getOpt('ptShowTax', 'showTax'),
    showPos:         getOpt('ptShowPos', 'showPos'),
    showBank:        getOpt('ptShowBank', 'showBank'),
    showTerms:       getOpt('ptShowTerms', 'showTerms'),
    showSig:         getOpt('ptShowSig', 'showSig'),
    showGstSummary:  getOpt('ptShowGstSummary', 'showGstSummary')  // NEW OPTION for GST Summary
  };

  // CALCULATIONS
  let sub = 0, gstTotal = 0, grand = 0;
  let gstByRate = new Map();
  
  data.items.forEach((it) => {
    const { gst, subtotalPart, total } = calcGST(it.qty * it.price, it.gstRate, data.gstType);
    sub += subtotalPart;
    gstTotal += gst;
    grand += total;

    const rateKey = it.gstRate;
    if (!gstByRate.has(rateKey)) {
      gstByRate.set(rateKey, { taxable: 0, gst: 0, cgst: 0, sgst: 0, igst: 0 });
    }
    const gstData = gstByRate.get(rateKey);
    gstData.taxable += subtotalPart;
    gstData.gst += gst;
    if (data.supplyType === 'inter') {
      gstData.igst += gst;
    } else {
      gstData.cgst += gst / 2;
      gstData.sgst += gst / 2;
    }
  });

  // DISCOUNT
  let finalDiscount = 0;
  if (data.savedDiscount !== undefined) finalDiscount = data.savedDiscount;
  else if (data.liveDiscVal > 0) finalDiscount = data.liveDiscType === 'pct' ? (grand * (data.liveDiscVal / 100)) : Math.min(data.liveDiscVal, grand);
  grand -= finalDiscount;
  
  const roundOff = Math.round(grand) - grand;
  grand = Math.round(grand);
  const dueAmount = grand - data.paidAmount;
  const isFullyPaid = dueAmount <= 0;

  // PAPER SIZE CONFIGURATION
  const paperSize = bizProfile.printSize || 'A4';
  const isA5 = paperSize === 'A5';
  const isThermal = templateName === 'tpl-thermal';
  const isLandscape = templateName === 'tpl-landscape';
  
  // ITEMS PER PAGE (Portrait: 12 items, Landscape: 6 items - adjusted for better fit)
  const MAX_ITEMS_PER_PAGE = isLandscape ? 6 : 12;
  
  // PAGE SPLITTING ENGINE
  const pages = [];
  for (let i = 0; i < data.items.length; i += MAX_ITEMS_PER_PAGE) {
    pages.push(data.items.slice(i, i + MAX_ITEMS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);
  
  const totalPages = pages.length;

  // BUILD ITEM ROWS FOR EACH PAGE
  function buildItemRowsForPage(pageItems, startSerial) {
    let rows = "";
    
    pageItems.forEach((it, idx) => {
      const serial = startSerial + idx;
      const { gst, subtotalPart, total } = calcGST(it.qty * it.price, it.gstRate, data.gstType);
      
      if (isThermal) {
        // Authentic Indian Retail POS Format (2 rows per item, no squished columns)
        rows += `
        <tr class="item-row">
          <td colspan="4" style="padding: 4px 2px 0 2px; text-align:left; font-weight:700; font-size:9.5pt; border:none !important;">${esc(it.desc)}</td>
        </tr>
        <tr class="item-row">
          <td colspan="2" style="padding: 0 2px 6px 2px; text-align:left; font-size:8.5pt; border-bottom: 1px dashed #ccc !important; color: #333;">
            ${opts.showHsn && it.hsn ? `HSN:${esc(it.hsn)} | ` : ''}${formatNumber(it.qty)} x ${fmt(it.price)}
          </td>
          <td colspan="2" style="padding: 0 2px 6px 2px; text-align:right; font-size:9.5pt; font-weight:700; border-bottom: 1px dashed #ccc !important;">
            ${fmt(total)}
          </td>
        </tr>`;
      } else {
        // Standard A4/A5 Row Format
        rows += `<tr class="item-row">
          <td class="col-sno" style="text-align:center; padding: 6px 4px;">${serial}</td>
          <td class="col-desc" style="padding: 6px 4px;">${esc(it.desc)}</td>
          ${opts.showHsn ? `<td class="col-hsn" style="padding: 6px 4px;">${esc(it.hsn) || '-'}</td>` : ''}
          <td class="col-qty" style="text-align:center; padding: 6px 4px;">${formatNumber(it.qty)}</td>
          <td class="col-price" style="text-align:right; padding: 6px 4px;">${fmt(it.price)}</td>
          <td class="col-taxable" style="text-align:right; padding: 6px 4px;">${fmt(subtotalPart)}</td>
          ${opts.showTax ? `<td class="col-gst-pct" style="text-align:center; padding: 6px 4px;">${(it.gstRate * 100).toFixed(0)}%</td><td class="col-gst-amt" style="text-align:right; padding: 6px 4px;">${fmt(gst)}</td>` : ''}
          <td class="col-total" style="text-align:right; padding: 6px 4px; font-weight:600;">${fmt(total)}</td>
        </tr>`;
      }
    });
    
    return rows;
  }

  // TABLE HEADERS
  const tableHeaders = `
    <th style="text-align:center; padding: 8px 4px; background: #f1f5f9; width:5%">#</th>
    <th style="padding: 8px 4px; background: #f1f5f9; width:${opts.showTax ? '30%' : '40%'}">Description</th>
    ${opts.showHsn ? `<th style="padding: 8px 4px; background: #f1f5f9; width:10%">HSN/SAC</th>` : ''}
    <th style="text-align:center; padding: 8px 4px; background: #f1f5f9; width:7%">Qty</th>
    <th style="text-align:right; padding: 8px 4px; background: #f1f5f9; width:12%">Price</th>
    <th style="text-align:right; padding: 8px 4px; background: #f1f5f9; width:12%">Taxable</th>
    ${opts.showTax ? `<th style="text-align:center; padding: 8px 4px; background: #f1f5f9; width:7%">GST%</th><th style="text-align:right; padding: 8px 4px; background: #f1f5f9; width:12%">GST Amt</th>` : ''}
    <th style="text-align:right; padding: 8px 4px; background: #f1f5f9; width:${opts.showTax ? '12%' : '14%'}">Total</th>
  `;

  // AMOUNT IN WORDS
  const amountInWords = numberToWords(grand);

  // GST SUMMARY (Conditional - Issue 1)
  let gstSummaryHTML = "";
  if (opts.showGstSummary && gstByRate.size > 0 && !isThermal) {
    gstSummaryHTML = `
      <div class="gst-summary-box">
        <div class="section-title" style="margin-bottom: 8px;">GST Summary</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 8pt;">
          <thead>
            <tr><th style="text-align:left; padding: 4px;">Rate</th><th style="text-align:right; padding: 4px;">Taxable</th><th style="text-align:right; padding: 4px;">CGST</th><th style="text-align:right; padding: 4px;">SGST</th>${data.supplyType === 'inter' ? '<th style="text-align:right; padding: 4px;">IGST</th>' : ''}<th style="text-align:right; padding: 4px;">Total Tax</th></tr>
          </thead>
          <tbody>`;
    for (const [rate, values] of gstByRate) {
      gstSummaryHTML += `<tr>
        <td style="padding: 3px 4px;">${(rate * 100).toFixed(0)}%</td>
        <td style="text-align:right; padding: 3px 4px;">${fmt(values.taxable)}</td>
        ${data.supplyType === 'inter' ? `
          <td style="text-align:right; padding: 3px 4px;">-</td><td style="text-align:right; padding: 3px 4px;">-</td>
          <td style="text-align:right; padding: 3px 4px;">${fmt(values.igst)}</td>
        ` : `
          <td style="text-align:right; padding: 3px 4px;">${fmt(values.cgst)}</td>
          <td style="text-align:right; padding: 3px 4px;">${fmt(values.sgst)}</td>
        `}
        <td style="text-align:right; padding: 3px 4px; font-weight:600;">${fmt(values.gst)}</td>
      </tr>`;
    }
    gstSummaryHTML += `</tbody></table></div>`;
  }

  // TOTALS SECTION
  const totalsHTML = `
    <div class="totals-card">
      <div class="totals-row"><span>Subtotal:</span><span>${fmt(sub)}</span></div>
      ${finalDiscount > 0 ? `<div class="totals-row discount-row"><span>Discount:</span><span>- ${fmt(finalDiscount)}</span></div>` : ''}
      ${data.supplyType === 'inter' ? 
        `<div class="totals-row"><span>Total IGST:</span><span>${fmt(gstTotal)}</span></div>` :
        `<div class="totals-row"><span>Total CGST:</span><span>${fmt(gstTotal / 2)}</span></div>
         <div class="totals-row"><span>Total SGST:</span><span>${fmt(gstTotal / 2)}</span></div>`
      }
      ${roundOff !== 0 ? `<div class="totals-row roundoff-row"><span>Round Off:</span><span>${roundOff > 0 ? '+' : ''}${fmt(Math.abs(roundOff))}</span></div>` : ''}
      <div class="totals-row grand-total"><span>Grand Total:</span><span>${fmt(grand)}</span></div>
      ${data.paidAmount > 0 ? `
        <div class="totals-row paid-row"><span>Amount Paid:</span><span>${fmt(data.paidAmount)}</span></div>
        <div class="totals-row due-row ${dueAmount > 0 ? 'due-amount' : 'paid-full'}"><span>${dueAmount > 0 ? 'Balance Due:' : 'Fully Paid:'}</span><span>${dueAmount > 0 ? fmt(dueAmount) : '✓'}</span></div>
      ` : ''}
    </div>
  `;

  // AMOUNT IN WORDS SECTION (Issue 3 - Up section)
  const amountWordsHTML = `
    <div class="amount-words">
      <strong>Amount in Words:</strong> ${amountInWords} Rupees Only
    </div>
  `;

  /// BANK DETAILS
  const bankHTML = (opts.showBank && (data.bankName || data.bankAcc)) ? `
    <div class="bank-details-box">
      <div class="section-title" style="margin-bottom: 8px;">Bank Details</div>
      ${data.bankHolder ? `<div><strong>A/c Name:</strong> ${esc(data.bankHolder)}</div>` : ''}
      <div><strong>Bank:</strong> ${esc(data.bankName)}</div>
      <div><strong>A/c No:</strong> ${esc(data.bankAcc)}</div>
      <div><strong>IFSC:</strong> ${esc(data.bankIFSC)}</div>
      ${data.bankBranch ? `<div><strong>Branch:</strong> ${esc(data.bankBranch)}</div>` : ''}
    </div>` : '';

  // TERMS & CONDITIONS (Issue 3 - Down section)
  const termsHTML = opts.showTerms ? `
    <div class="terms-box">
      <strong>Terms & Conditions:</strong><br>
      <span>${esc(data.terms).replace(/\n/g, '<br>')}</span>
    </div>` : '';

  const sigHTML = opts.showSig ? `
    <div class="signature-box">
      ${data.signature ? `<img src="${data.signature}" style="max-height: 50px; display: block; margin-left: auto;">` : `<div style="border-bottom: 1px solid #0f172a; width: 200px; margin-left: auto; height: 40px;"></div>`}
      <div><strong>Authorised Signatory</strong></div>
      <div>For ${esc(data.bizName)}</div>
    </div>` : '';

  const logoHTML = (opts.showLogo && data.logo) ? `<img src="${data.logo}" style="max-height: 60px; margin-bottom: 8px; display: block;">` : '';

  // PAPER CONFIGURATION
  let printableWidth = '210mm';
  let printablePadding = '20px';
  let paperMargin = '10mm';
  
  if (isThermal) {
    printableWidth = '80mm';
    printablePadding = '2mm';
    paperMargin = '1mm';
  } else if (isA5) {
    printableWidth = '148mm';
    printablePadding = '10px';
    paperMargin = '8mm';
  } else if (isLandscape) {
    printableWidth = '277mm';
    printablePadding = '12px';
    paperMargin = '10mm';
  }
  
  // PAGE RULE
  let pageRule = '';
  if (isThermal) {
    pageRule = `@page { margin: ${paperMargin}; size: 80mm auto; }`;
  } else if (isLandscape) {
    pageRule = `@page { size: A4 landscape; margin: ${paperMargin}; }`;
  } else if (isA5) {
    pageRule = `@page { size: A5; margin: ${paperMargin}; }`;
  } else {
    pageRule = `@page { size: A4; margin: ${paperMargin}; }`;
  }

  // TEMPLATE CSS
  const templateCSS = (() => {
    switch (templateName) {
      case 'tpl-minimal':
        return `.invoice-paper { border: 1px solid #ddd; box-shadow: none; }
                .inv-header { border-bottom-color: #333; }
                .invoice-table th { background: transparent; color: #333; border-bottom: 2px solid #333; }
                .totals-card { background: white; border: 1px solid #ddd; }`;
      case 'tpl-bold':
        return `.invoice-paper { border-top: 5px solid #c2410c; }
                .invoice-table th { background: #c2410c; color: white; }
                .totals-card { border-left: 3px solid #c2410c; }`;
      case 'tpl-classic':
        return `body { font-family: 'Times New Roman', serif; }
                .invoice-table, .invoice-table th, .invoice-table td { border: 1px solid #000; }
                .invoice-table th { background: #fff; color: #000; }`;
      case 'tpl-modern':
        return `body { background: #f7fafc !important; }
                .invoice-paper { border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: none; }
                .invoice-table { border-collapse: separate; border-spacing: 0 8px; }
                .invoice-table th { background: transparent !important; color: #a0aec0 !important; text-transform: uppercase; letter-spacing: 0.1em; border: none !important; }
                .invoice-table td { background: #f8fafc; border: none !important; }
                .inv-header { border-bottom: 1px solid #edf2f7 !important; }`;
      case 'tpl-letterhead':
        return `body { font-family: 'Georgia', serif !important; }
                .invoice-paper { border: none; box-shadow: none; }
                .inv-header { text-align: center !important; border-bottom: 3px double #000 !important; }
                .header-left, .header-right { text-align: center; width: 100%; }
                .invoice-table { border-top: 1px solid #000; border-bottom: 2px solid #000; }
                .invoice-table th { background: white !important; color: #000 !important; border-bottom: 1px solid #000 !important; font-style: italic; font-weight: normal; }`;
      case 'tpl-compact':
        return `body { font-family: 'Arial', sans-serif !important; font-size: 8.5pt !important; }
                .invoice-paper { border: 1px solid #000; padding: 15px !important; }
                .inv-header { border-bottom: 1px solid #000 !important; padding-bottom: 5px; margin-bottom: 5px; }
                .invoice-table th, .invoice-table td { padding: 2px 4px !important; font-size: 0.9em !important; }
                .three-column-row { margin: 10px 0; gap: 8px; }
                .bank-col, .gst-col, .total-col { padding: 6px; }`;
      case 'tpl-landscape':
        return `.invoice-paper { border: 1px solid #ccc; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                .inv-header { border-bottom: 2px solid #e2e8f0 !important; }
                .invoice-table th { background: #f8fafc !important; }`;
      default:
        return `.invoice-paper { border-top: 4px solid #1e4a6e; }
                .invoice-table th { background: #f1f5f9; color: #1e4a6e; }`;
    }
  })();
  // BUILD ALL PAGES
  let allPagesHTML = "";
  let globalSerial = 1;
  
  pages.forEach((pageItems, pageIndex) => {
    const isLast = pageIndex === totalPages - 1;
    const pageNum = pageIndex + 1;
    const pageBreakClass = !isThermal && !isLast ? 'page-break' : '';
    const thermalClass = isThermal ? 'thermal-mode' : '';
    
    const pageItemsRows = buildItemRowsForPage(pageItems, globalSerial);
    globalSerial += pageItems.length;
    
    allPagesHTML += `
      <div class="invoice-paper ${thermalClass} ${pageBreakClass}">
        <div class="page-number">Page ${pageNum} of ${totalPages}</div>
        
        <div class="inv-header ${pageIndex === 0 ? 'full-header' : 'compact-header'}">
          <div class="header-left">
            ${pageIndex === 0 ? logoHTML : ''}
            <h2>${esc(data.bizName)}</h2>
            ${opts.showBizAddr ? `<div class="meta-line">${esc(data.bizAddr).replace(/\n/g, '<br>')}</div>` : ''}
            <div class="contact-line">
              ${data.bizContact ? `<span> ${esc(data.bizContact)}</span>` : ''}
              ${data.customerEmail ? `<span>✉️ ${esc(data.customerEmail)}</span>` : ''}
            </div>
            <div class="gst-line">
              ${opts.showBizGst && data.bizGst ? `<span><strong>GSTIN:</strong> ${esc(data.bizGst)}</span>` : ''}
              ${opts.showBizPan && data.bizPan ? `<span><strong>PAN:</strong> ${esc(data.bizPan)}</span>` : ''}
            </div>
          </div>
          <div class="header-right">
            <h1>INVOICE</h1>
            ${opts.showTaxLabel && !isThermal ? `<div class="meta-line">${data.gstType} of GST</div>` : ''}
          </div>
        </div>
        
        <div class="customer-block">
          <div class="customer-info">
            <div class="customer-section">
              <div class="section-title">Billed To</div>
              <div class="customer-name">${esc(data.customerName)}</div>
              ${pageIndex === 0 ? `<div class="customer-address">${esc(data.billingAddress).replace(/\n/g, '<br>')}</div>` : ''}
              ${data.customerGstin ? `<div class="customer-gst"><strong>GSTIN:</strong> ${esc(data.customerGstin)}</div>` : ''}
              ${data.customerEmail && pageIndex === 0 ? `<div class="customer-email">${esc(data.customerEmail)}</div>` : ''}
            </div>
            <div class="invoice-meta">
              <div class="meta-line"><strong>Invoice No:</strong> ${esc(data.invNo)}</div>
              <div class="meta-line"><strong>Date:</strong> ${dateLabel(data.invDate)}</div>
              <div class="meta-line"><strong>Due Date:</strong> ${dateLabel(data.dueDate)}</div>
              ${opts.showPos && data.placeOfSupply ? `<div class="meta-line"><strong>Place of Supply:</strong> ${data.placeOfSupply}</div>` : ''}
            </div>
          </div>
        </div>
        
        <div class="table-wrapper">
          <table class="invoice-table">
            <thead><tr>${tableHeaders}</tr></thead>
            <tbody>${pageItemsRows}</tbody>
          </table>
        </div>
        
        ${isLast ? `
          
          
          <!-- THREE COLUMN LAYOUT: Bank Details | GST Summary | Total Amount on SAME ROW -->
          <div class="three-column-row">
            <div class="three-col bank-col">
              ${bankHTML}
            </div>
            <div class="three-col gst-col">
              ${opts.showGstSummary ? gstSummaryHTML : ''}
            </div>
            <div class="three-col total-col">
              ${totalsHTML}
            </div>
          </div>
          
           <!-- Terms, Amount in Words, Signature - SAME ROW for Landscape -->
          <div class="terms-amount-signature-row">
            <div class="amount-in-words-col">
              ${amountWordsHTML}
            </div>
            <div class="terms-col">
              ${termsHTML}
            </div>
            <div class="signature-col">
              ${sigHTML}
            </div>
          </div>
        ` : ''}
        
        <div class="print-footer">Thank You, Visit Again!</div>
      </div>
    `;
  });

  // NO PRINT WARNING - Direct print
  const autoPrintScript = isSample ? '' : `<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };</script>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice - ${esc(data.invNo)}</title>
<style>
  ${pageRule}
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    background: #f0f2f5;
    font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
    color: #1a2c3e;
    padding: 20px;
    font-size: 10pt;
    line-height: 1.4;
  }
  
  .invoice-paper {
    width: 100%;
    max-width: ${printableWidth};
    margin: 0 auto 24px;
    background: white;
    padding: ${printablePadding};
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    position: relative;
  }
  
  .invoice-paper:last-child { margin-bottom: 0; }
  .page-break { page-break-after: always; break-after: page; }
  
  /* Page Number */
  .page-number {
    text-align: right;
    font-size: 9pt;
    color: #64748b;
    padding: 0 0 6px 0;
    margin-bottom: 10px;
    border-bottom: 1px solid #e2e8f0;
  }
  
  /* Header */
  .inv-header {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 20px;
    padding-bottom: 12px;
    margin-bottom: 12px;
    border-bottom: 3px solid #1e4a6e;
  }
  
  .compact-header { border-bottom-width: 2px; padding-bottom: 8px; margin-bottom: 10px; }
  .header-left { flex: 1; }
  .header-right { text-align: right; }
  
  h1 { font-size: 18pt; font-weight: 800; color: #1e4a6e; margin-bottom: 4px; }
  h2 { font-size: 14pt; font-weight: 700; color: #0c4a6e; margin-bottom: 4px; }
  
  .meta-line { color: #475569; font-size: 8pt; margin-top: 2px; }
  .contact-line, .gst-line { display: flex; gap: 16px; flex-wrap: wrap; font-size: 8pt; margin-top: 4px; }
  
  /* Customer Block */
  .customer-block {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 12px;
    margin-bottom: 14px;
  }
  
  .customer-info { display: flex; flex-wrap: wrap; gap: 16px; }
  .customer-section { flex: 1 1 200px; }
  .section-title { font-weight: 700; color: #1e4a6e; margin-bottom: 6px; font-size: 9pt; text-transform: uppercase; }
  .customer-name { font-weight: 700; font-size: 10pt; margin-bottom: 4px; }
  .customer-address, .customer-gst, .customer-email { font-size: 8pt; color: #475569; margin-top: 2px; }
  
  .invoice-meta {
    flex: 0 1 220px;
    border-left: 2px solid #e2e8f0;
    padding-left: 14px;
  }
  .invoice-meta .meta-line { margin-top: 4px; }
  
  /* Table */
  .table-wrapper { overflow-x: auto; margin: 12px 0; }
  .invoice-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    table-layout: fixed;
  }
  .invoice-table th {
    padding: 8px 4px;
    font-weight: 700;
    border-bottom: 2px solid #cbd5e1;
  }
  .invoice-table td {
    padding: 6px 4px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }
  .invoice-table thead { display: table-header-group; }
  .invoice-table tr { break-inside: avoid; page-break-inside: avoid; }
  
  /* Amount in Words */
  .amount-words {
    margin: 12px 0;
    padding: 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    font-size: 9pt;
  }
  
    /* ============================================
     THREE COLUMN LAYOUT - Bank (Small), GST (Large), Total (Medium)
  ============================================ */
  .three-column-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin: 20px 0;
    align-items: stretch;
  }
  
  /* Bank Details - SMALLER width */
  .bank-col {
    flex: 0.7;
    min-width: 160px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 12px;
  }
  
  /* GST Summary - LARGER width */
  .gst-col {
    flex: 1.5;
    min-width: 250px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 12px;
  }
  
  /* Total Amount - MEDIUM width */
  .total-col {
    flex: 0.8;
    min-width: 200px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 12px;
  }
  
  /* Bank Details inside column */
  .bank-col div {
    font-size: 8pt;
    margin-top: 4px;
  }
  
  .bank-col strong {
    font-size: 9pt;
  }
  
  /* GST Summary inside column */
  .gst-col table {
    width: 100%;
    font-size: 7.5pt;
    border-collapse: collapse;
  }
  
  .gst-col th, .gst-col td {
    padding: 3px 2px;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }
  
  .gst-col th {
    font-weight: 600;
  }
  
  /* Totals Card inside column */
  .total-col .totals-card {
    background: transparent;
    padding: 0;
    border: none;
  }
  
  .total-col .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 8.5pt;
    border-bottom: 1px dashed #e2e8f0;
  }
  
  .total-col .totals-row:last-child {
    border-bottom: none;
  }
  
  .total-col .grand-total {
    font-size: 10pt !important;
    font-weight: 700;
    color: #1e4a6e;
    border-top: 2px solid #1e4a6e;
    padding-top: 6px;
    margin-top: 4px;
  }
  
  .discount-row { color: #10b981; }
  .due-amount { color: #ef4444; }
  .paid-full { color: #10b981; }
  
    /* ============================================
     TERMS, AMOUNT IN WORDS, SIGNATURE - SAME ROW FOR LANDSCAPE
  ============================================ */
  .terms-amount-signature-row {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    margin: 16px 0 12px 0;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
  }
  
  .amount-in-words-col {
    flex: 2;
    min-width: 180px;
  }
  
  .amount-in-words-col .amount-words {
    margin: 0;
    padding: 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    font-size: 9pt;
  }
  
  .terms-col {
    flex: 2;
    min-width: 180px;
  }
  
  .terms-box {
    font-size: 8pt;
    color: #475569;
  }
  
  .signature-col {
    flex: 1;
    text-align: right;
    min-width: 150px;
  }
  
  .signature-box {
    text-align: right;
  }
  
  .signature-box div {
    margin-top: 4px;
  }
  
  /* Landscape specific - all three in same row */
  @media print and (orientation: portrait) {
    .terms-amount-signature-row {
      display: flex;
      flex-direction: row;
      align-items: center;
    }
  }
  
  /* Portrait - stack vertically */
  @media print and (orientation: landscape) {
    .terms-amount-signature-row {
      flex-direction: column;
    }
  }
  
  /* Footer */
  .print-footer {
    margin-top: 12px;
    text-align: center;
    font-size: 7pt;
    color: #64748b;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
  }
  
    /* ============================================
     THERMAL MODE - PROFESSIONAL POS FORMAT (Retail Style)
  ============================================ */
  .thermal-mode {
    max-width: 80mm !important;
    padding: 2mm !important;
    box-shadow: none !important;
    border: none !important;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
  }

  .thermal-mode * {
    color: black !important;
    background: white !important;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
  }

  /* Clean Center Header */
  .thermal-mode .inv-header {
    display: block !important;
    text-align: center !important;
    border-bottom: 1px dashed black !important;
    padding-bottom: 8px !important;
    margin-bottom: 8px !important;
  }
  .thermal-mode .header-left, .thermal-mode .header-right { width: 100% !important; text-align: center !important; }
  .thermal-mode h1 { font-size: 11pt !important; font-weight: bold !important; margin-top: 4px !important; }
  .thermal-mode h2 { font-size: 14pt !important; font-weight: bold !important; margin-bottom: 2px !important; text-transform: uppercase; }
  .thermal-mode .meta-line, .thermal-mode .contact-line, .thermal-mode .gst-line { font-size: 8pt !important; }

  /* Compact Customer Info */
  .thermal-mode .customer-block { border: none !important; padding: 0 !important; background: transparent !important; margin-bottom: 8px !important; }
  .thermal-mode .section-title { display: none !important; }
  .thermal-mode .customer-name { font-size: 9.5pt !important; font-weight: bold !important; margin-bottom: 2px !important; }
  .thermal-mode .customer-address, .thermal-mode .customer-gst { font-size: 8pt !important; }
  .thermal-mode .invoice-meta { border: none !important; padding: 0 !important; margin-top: 4px !important; display: flex !important; flex-wrap: wrap !important; justify-content: space-between !important; font-size: 8pt !important; }
  .thermal-mode .invoice-meta .meta-line { width: 48% !important; margin: 1px 0 !important; }

  /* Retail Style Table (No Headers) */
  .thermal-mode .invoice-table thead { display: none !important; }
  .thermal-mode .invoice-table { border-bottom: 1px dashed black !important; margin-bottom: 8px !important; }

  /* Hide Unnecessary Elements (Bank, Amount in Words, Signatures) */
  .thermal-mode .bank-col,
  .thermal-mode .amount-words,
  .thermal-mode .terms-amount-signature-row,
  .thermal-mode .page-number { display: none !important; }

  /* Totals & GST Summary */
  .thermal-mode .three-column-row { display: block !important; margin: 0 !important; }
  .thermal-mode .three-col { width: 100% !important; padding: 0 !important; border: none !important; }

  .thermal-mode .gst-col table { font-size: 7.5pt !important; margin-bottom: 8px !important; border-bottom: 1px dashed black !important; padding-bottom: 4px !important; }
  .thermal-mode .gst-col th { border: none !important; font-weight: bold !important; }

  .thermal-mode .total-col .totals-row { font-size: 9.5pt !important; padding: 2px 0 !important; border: none !important; }
  .thermal-mode .total-col .grand-total { font-size: 13pt !important; font-weight: bold !important; border-top: 1px dashed black !important; border-bottom: 1px dashed black !important; padding: 6px 0 !important; margin-top: 4px !important; }

  /* Footer override */
  .thermal-mode .print-footer { font-size: 10pt !important; text-align: center !important; font-weight: bold !important; border: none !important; margin-top: 12px !important; }
  
  /* ============================================
     TEMPLATE VARIATIONS
  ============================================ */
  ${templateCSS}
  
  /* ============================================
     PRINT MEDIA
  ============================================ */
  @media print {
    body { background: white; padding: 0; margin: 0; }
    .invoice-paper {
      box-shadow: none;
      border: none;
      margin: 0;
      padding: 0;
      page-break-after: avoid;
    }
    .page-break { page-break-after: always; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .invoice-table th { background: #e0e0e0 !important; }
    .invoice-table thead { display: table-header-group; }
    .invoice-table tr { break-inside: avoid; }
    .thermal-mode .invoice-paper { padding: 0; }
    .thermal-mode .invoice-table th { background: white !important; }
  }
</style>
</head>
<body>
${allPagesHTML}
${autoPrintScript}
</body>
</html>`;
}

// Helper Functions

function addDays(dateStr, days) {
  const date = dateStr ? new Date(dateStr) : new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function formatNumber(num) {
  if (Number.isInteger(num)) return num.toString();
  return num.toFixed(2).replace(/\.?0+$/, '');
}

function showSamplePreview(templateName) {
  const sampleData = {
    bizName: bizProfile.name || 'BillingSuite Pro',
    bizAddr: bizProfile.address || '123 Business Street, Mumbai, MH 400001',
    bizGst:  bizProfile.gstin || '27AAAAA0000A1Z5', 
    bizPan:  bizProfile.pan || 'ABCDE1234F',
    bizContact: bizProfile.phone || '+91 98765 43210',
    bankName: bizProfile.bankName || 'HDFC Bank',
    bankAcc:  bizProfile.bankAcc  || '50100123456789',
    bankIFSC: bizProfile.bankIFSC || 'HDFC0001234',
    terms:    bizProfile.terms || '1. Goods once sold will not be taken back.\n2. Payment due within 30 days.',
    invNo: 'INV-2026-001',
    invDate: today(),
    
    // Updated to match your buildInvoiceHTML variables exactly
    customerName: 'Sample Customer Pvt. Ltd.',
    customerGstin: '07BBBBB1111B1Z2', // Tests IGST (07 = Delhi)
    billingAddress: '456 Client Avenue, New Delhi 110001',
    
    gstType: 'Exclusive',
    supplyType: 'inter', // Force inter-state to prove IGST breakdown works
    items: [
      { description: 'Product A — Premium Widget', hsn: '8517', quantity: 2, unitPrice: 5000, gstRate: 0.18 },
      { description: 'Service B — Installation', hsn: '9987', quantity: 1, unitPrice: 2500, gstRate: 0.18 },
    ],
    discount: 500,
  };
  
  const html = buildInvoiceHTML(sampleData, templateName, true);
  const modal = document.getElementById('sampleModal');
  const content = document.getElementById('sampleContent');
  if (!modal || !content) return;
  
  // Added min-height so the preview window doesn't look cramped
  content.innerHTML = `<iframe srcdoc="${html.replace(/"/g, '&quot;')}" style="width:100%; height:100%; min-height: 600px; border:none; flex:1"></iframe>`;
  modal.classList.add('open');
}

function closeSampleModal() {
  const modal = document.getElementById('sampleModal');
  if (modal) modal.classList.remove('open');
  const content = document.getElementById('sampleContent');
  if (content) content.innerHTML = '';
}

// ─── BUILD PURCHASE HTML (Upgraded with HSN) ──
function buildPurchaseHTML(templateName, isSample, purData = null) {
  let data;
  if (purData) {
    data = {
      bizName: bizProfile.name, bizAddr: bizProfile.address, bizContact: bizProfile.phone, bizGst: bizProfile.gstin,
      poNo: purData.poNumber, poDate: purData.date, supplierName: purData.supplier, gstType: purData.gstType || 'Exclusive',
      items: (purData.items || []).map(i => ({ desc: i.product, hsn: i.hsn || '', qty: i.quantity, price: i.unitCost, gstRate: i.gstRate }))
    };
  } else {
    data = {
      bizName: bizProfile.name, bizAddr: bizProfile.address, bizContact: bizProfile.phone, bizGst: bizProfile.gstin,
      poNo: document.getElementById('poNumber').value || 'DRAFT', poDate: document.getElementById('purchaseDate').value || today(),
      supplierName: document.getElementById('supplierName').value || 'Supplier', gstType: typeof purGstType !== 'undefined' ? purGstType : 'Exclusive',
      items: purLineItems.map(i => ({ desc: i.desc, hsn: i.hsn || '', qty: i.qty, price: i.cost, gstRate: i.gstRate }))
    };
  }

  let sub = 0, gstTotal = 0, grand = 0;
  let itemsRows = "";

  data.items.forEach((it, index) => {
    if (!it.desc || it.desc.trim().toLowerCase() === 'add item') return; 
    const { gst, subtotalPart, total } = calcGST(it.qty * it.price, it.gstRate, data.gstType);
    sub += subtotalPart; gstTotal += gst; grand += total;

    itemsRows += `<tr>
      <td style="text-align:center">${index + 1}</td>
      <td>${esc(it.desc)}</td>
      <td>${esc(it.hsn)}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">${fmt(it.price)}</td>
      <td style="text-align:right">${fmt(subtotalPart)}</td>
      <td style="text-align:center">${(it.gstRate * 100).toFixed(0)}%</td>
      <td style="text-align:right">${fmt(gst)}</td>
      <td style="text-align:right">${fmt(total)}</td>
    </tr>`;
  });

  const paperSize = bizProfile.printSize || 'auto';
  const isA5 = paperSize === 'A5'; 
  const pWidth = isA5 ? '148mm' : '800px';
  const lWidth = isA5 ? '210mm' : '1050px';
  const pad = isA5 ? '20px' : '40px';

  const pageRule = paperSize === 'auto' ? '@page { margin: 0.5cm; }' : `@page { size: ${paperSize}; margin: 0.5cm; }`;
  const landscapePageRule = paperSize === 'auto' ? '@page { size: landscape; margin: 0.5cm; }' : `@page { size: ${paperSize} landscape; margin: 0.5cm; }`;

  let tplCSS = "";
  if (templateName === "tpl-minimal") {
    tplCSS = `${pageRule} .invoice-paper { max-width:${pWidth}; margin:0 auto; background:white; padding:${pad}; border: 1px solid #eee; } .inv-header { border-bottom: 1px solid #ddd !important; padding-bottom: 20px; } th { background: transparent !important; border-bottom: 2px solid #333 !important; color: #333 !important; } .totals { border-top: 2px solid #333 !important; } h1 { color: #555 !important; }`;
  } else if (templateName === "tpl-bold") {
    tplCSS = `${pageRule} .invoice-paper { max-width:${pWidth}; margin:0 auto; background:linear-gradient(to bottom, #ffffff, #fdf8f6); padding:${pad}; border-radius:16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border-top: 8px solid #c2410c; } .inv-header { border-bottom: none !important; } h1 { color: #c2410c !important; } th { background: #c2410c !important; color: white !important; border: none !important; } .totals { background: #fff7ed; padding: 20px; border-radius: 12px; border: none !important; }`;
  } else if (templateName === "tpl-landscape") {
    tplCSS = `${landscapePageRule} .invoice-paper { max-width: ${lWidth}; margin:0 auto; background:white; padding:${pad}; border: 1px solid #ddd; border-top: 6px solid #1a4a3a; } .inv-header { border-bottom:3px solid #1a4a3a !important; display: flex; align-items: center; } h1 { color: #1a4a3a !important; } th { background: #1a4a3a !important; color: white !important; }`;
  } else {
    tplCSS = `${pageRule} .invoice-paper { max-width:${pWidth}; margin:0 auto; background:white; padding:${pad}; border:1px solid #eee; border-top: 6px solid #1e4a6e; } .inv-header { border-bottom: 3px solid #1e4a6e !important; } h1 { color: #1e4a6e !important; } th { background: #f1f5f9 !important; color: #1e4a6e !important; }`;
  }

  return `<!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"><title>Purchase Order - ${data.poNo}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:#f0f2f5; font-family:'Inter',sans-serif; padding:20px; color:#1a2c3e; font-size: ${isA5 ? '10pt' : '14pt'};}
    table{width:100%; border-collapse:collapse; margin:18px 0;}
    th,td{padding:${isA5 ? '8px 4px' : '12px 8px'}; text-align:left; border-bottom:1px solid #e2e8f0; font-size:0.85em;}
    th{background:#f1f5f9; color:#475569; text-transform:uppercase; font-size:0.75em; letter-spacing:0.05em;}
    .totals{text-align:right; margin-top:20px; border-top:1px dashed #cbd5e1; padding-top:16px;}
    .footer{margin-top:25px; font-size:0.75em; text-align:center; color:#64748b;}
    @media print { body { background:white; padding:0; font-size: ${isA5 ? '8.5pt' : '11pt'}; } .invoice-paper { width: 100% !important; max-width: 100% !important; box-shadow:none !important; border:none !important; padding:0 !important; margin:0 !important; } }
    ${tplCSS}
  </style>
  </head>
  <body>
  <div class="invoice-paper">
    <div class="inv-header" style="display:flex; justify-content:space-between; flex-wrap:wrap; padding-bottom:20px; margin-bottom:20px;">
      <div>
        <h2 style="font-size:1.6em; color:#0f172a; margin-bottom:4px; font-weight:800;">${esc(data.bizName)}</h2>
        <div style="font-size:0.8em; color:#475569; line-height:1.5;">${esc(data.bizAddr).replace(/\n/g,'<br>')}</div>
        <div style="font-size:0.8em; color:#475569; margin-top:4px;">GSTIN: ${esc(data.bizGst)}</div>
      </div>
      <div style="text-align:right;">
        <h1 style="color:#0f172a; letter-spacing:0.05em; font-size:2em">PURCHASE ORDER</h1>
        <div style="font-size:0.85em; color:#64748b; margin-top:4px;">${data.gstType === 'Exclusive' ? 'GST Exclusive' : 'GST Inclusive'}</div>
      </div>
    </div>
    <div style="display:flex; justify-content:space-between; margin:12px 0; flex-wrap:wrap; background:#f8fafc; padding:16px; border-radius:12px; border:1px solid #e2e8f0; font-size:0.9em;">
      <span><strong>PO No:</strong> ${esc(data.poNo)}</span>
      <span><strong>Date:</strong> ${data.poDate}</span>
    </div>
    <div style="margin:20px 0;">
      <h4 style="font-size:0.85em; color:#64748b; text-transform:uppercase; margin-bottom:8px; letter-spacing:0.05em;">Supplier</h4>
      <div style="font-weight:700; font-size:1.1em; color:#0f172a;">${esc(data.supplierName)}</div>
    </div>
    <table>
      <thead><tr><th style="text-align:center">#</th><th>Description</th><th>HSN/SAC</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Cost</th><th style="text-align:right">Taxable</th><th style="text-align:center">GST%</th><th style="text-align:right">GST Amt</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <div class="totals">
      <div style="color:#475569; margin-bottom:6px; font-size:0.9em;">Total Taxable: ${fmt(sub)}</div>
      <div style="color:#475569; margin-bottom:6px; font-size:0.9em;">Total GST: ${fmt(gstTotal)}</div>
      <div style="font-size:1.4em; font-weight:800; color:#0f172a; margin-top:12px;">Grand Total: ${fmt(grand)}</div>
    </div>
    <div style="display:flex; justify-content:space-between; margin-top:30px; font-size:0.8em; border-top:1px solid #e2e8f0; padding-top:16px;">
      <div style="width:60%"></div>
      <div style="width:35%; text-align:right; display:flex; flex-direction:column; justify-content:flex-end;">
        <div style="border-bottom:1px solid #0f172a; margin-bottom:4px; height:40px;"></div>
        <strong style="color:#0f172a;">Authorised Signatory</strong>
        <div style="color:#475569; margin-top:2px;">For ${esc(data.bizName)}</div>
      </div>
    </div>
    <div class="footer">Generated by BillingSuite Pro</div>
  </div>
  <script>window.onload=function(){setTimeout(()=>{window.print();window.close();},500);};</script>
  </body>
  </html>`;
}

function numberToWords(num) {
  if (!num || num === 0) return "Zero";
  
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  function inWords(n) {
    let str = "";
    if (n > 9999999) { str += inWords(Math.floor(n / 10000000)) + " Crore "; n %= 10000000; }
    if (n > 99999)   { str += inWords(Math.floor(n / 100000)) + " Lakh "; n %= 100000; }
    if (n > 999)     { str += inWords(Math.floor(n / 1000)) + " Thousand "; n %= 1000; }
    if (n > 99)      { str += inWords(Math.floor(n / 100)) + " Hundred "; n %= 100; }
    if (n > 19)      { str += tens[Math.floor(n / 10)] + " "; n %= 10; }
    if (n > 0)       { str += ones[n] + " "; }
    return str.trim();
  }
  
  // Handle decimals (Paisa)
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);
  
  let result = inWords(integerPart);
  if (decimalPart > 0) {
    result += " and " + inWords(decimalPart) + " Paisa";
  }
  
  return result;
}
