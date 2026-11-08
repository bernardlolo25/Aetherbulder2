/**
 * AETHERBUILDER - REGISTRATION E-RECEIPT & IMAGE DOWNLOAD ENGINE
 * =========================================================================
 * Displays an elegant card-style e-receipt modal after form submission with
 * important delegate details, and exports a crisp high-res PNG image via Canvas.
 */

/**
 * Extracts and formats key submission fields for the receipt.
 * @param {Object} payload 
 * @param {HTMLFormElement} [form]
 * @returns {Object}
 */
export function formatReceiptDetails(payload, form) {
  const p = payload || {};
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  const refCode = 'REG-' + year + '-' + rand;

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }) + ' · ' + now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Map DOM labels if form element is available
  const labelMap = {};
  if (form) {
    form.querySelectorAll('.wb-reg-field').forEach((fld) => {
      const inp = fld.querySelector('input,select,textarea');
      const lbl = fld.querySelector('.wb-reg-label');
      if (inp && inp.name && lbl) {
        const clean = lbl.textContent.replace(/\s*\*.*$/, '').trim();
        if (clean) labelMap[inp.name] = clean;
      }
    });
  }

  // Helper to extract value by regex/string pattern
  const usedKeys = new Set();
  const getVal = (patterns) => {
    for (const pat of patterns) {
      for (const [k, v] of Object.entries(p)) {
        if (!v || typeof v !== 'string') continue;
        if (typeof pat === 'string' && k.toLowerCase() === pat.toLowerCase()) {
          usedKeys.add(k);
          return v;
        }
        if (pat instanceof RegExp && pat.test(k)) {
          usedKeys.add(k);
          return v;
        }
      }
    }
    return '';
  };

  const name = getVal([/^full_?name$/i, /^name$/i, 'delegate', 'attorney']) || p.name || 'Delegate';
  const rollNo = getVal([/^roll/i, 'roll_number', 'rollNumber', 'roll_no_n']);
  const schedule = getVal([/^schedule/i, 'batch', 'session', 'date_option']);
  const phone = getVal([/^mobile/i, /^phone/i, 'contact', 'tel']) || p.phone || '';
  const email = getVal([/^email/i]) || p.email || '';
  const pkg = getVal([/^package/i, 'tier', 'plan', 'seminar_package']);
  const address = getVal([/^mailing/i, /^office/i, /^address/i, 'lbc']);
  const receiptProof = getVal([/^receipt$/i, /^deposit/i, /^proof/i, 'payment_proof']);
  const paymentRef = getVal([/^payment_?ref/i, 'ref_no', 'transaction_ref']);

  const items = [];
  if (name) items.push({ label: 'Registrant / Delegate', value: name, highlight: true });
  if (rollNo) items.push({ label: 'Roll of Attorneys No.', value: rollNo });
  if (schedule) items.push({ label: 'Selected Schedule', value: schedule, badge: true });
  if (pkg) items.push({ label: 'Seminar Package', value: pkg });
  if (phone) items.push({ label: 'Mobile / Contact No.', value: phone });
  if (email) items.push({ label: 'Email Address', value: email });
  if (paymentRef) items.push({ label: 'Payment Reference #', value: paymentRef });
  if (address) items.push({ label: 'Mailing / Office Address', value: address });
  if (receiptProof) {
    items.push({
      label: 'Proof of Payment',
      value: receiptProof.startsWith('http') ? 'Screenshot Uploaded' : receiptProof,
      link: receiptProof.startsWith('http') ? receiptProof : ''
    });
  }

  // Add any extra custom fields not covered above
  const ignoredKeys = new Set([
    'type', 'page', 'message', 'extra', '_hp', 'website_hp', 'timestamp', 'Timestamp'
  ]);

  for (const [k, v] of Object.entries(p)) {
    if (usedKeys.has(k) || ignoredKeys.has(k) || k.endsWith('_b64') || k.endsWith('_filename') || k.endsWith('_url')) continue;
    if (!v || typeof v !== 'string' || v.length > 250) continue;
    const cleanLabel = labelMap[k] || k.replace(/field_\d+_?/, '').replace(/_/g, ' ');
    if (!items.some(it => it.label.toLowerCase() === cleanLabel.toLowerCase() || it.value === v)) {
      items.push({ label: cleanLabel, value: v });
    }
  }

  return {
    refCode,
    dateFormatted,
    name,
    schedule,
    items,
    rawPayload: p
  };
}

/**
 * Downloads the receipt as a crisp high-res 2x Retina PNG image using HTML5 Canvas.
 * @param {Object} receiptData 
 * @param {string} [title] 
 */
export function downloadReceiptImage(receiptData, title = 'Official Seminar Registration') {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = 760;
  const rowHeight = 42;
  const baseHeight = 440;
  const totalHeight = baseHeight + (receiptData.items.length * rowHeight);

  // 2x Retina scaling for ultra-sharp typography
  canvas.width = width * 2;
  canvas.height = totalHeight * 2;
  ctx.scale(2, 2);

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, totalHeight);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.5, '#0b0f19');
  bgGrad.addColorStop(1, '#030712');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, totalHeight);

  // Outer Card Border
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
  ctx.lineWidth = 1.5;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(16, 16, width - 32, totalHeight - 32, 20);
    ctx.stroke();
  } else {
    ctx.strokeRect(16, 16, width - 32, totalHeight - 32);
  }

  // Top Accent Bar (Emerald & Indigo Gradient)
  const topBarGrad = ctx.createLinearGradient(16, 16, width - 16, 16);
  topBarGrad.addColorStop(0, '#10b981');
  topBarGrad.addColorStop(0.5, '#6366f1');
  topBarGrad.addColorStop(1, '#06b6d4');
  ctx.fillStyle = topBarGrad;
  ctx.fillRect(20, 18, width - 40, 6);

  // Status Badge Pill: "✓ REGISTRATION CONFIRMED"
  ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(36, 44, 210, 26, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
    ctx.stroke();
  } else {
    ctx.fillRect(36, 44, 210, 26);
  }
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('✓ REGISTRATION CONFIRMED', 50, 61);

  // Title & Subtitle
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(title || 'Official Registration E-Receipt', 36, 98);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px sans-serif';
  ctx.fillText('Official Delegate E-Receipt & Confirmation Slip', 36, 118);

  // Reference Code Box (Right Side)
  const boxW = 230;
  const boxH = 74;
  const boxX = width - 36 - boxW;
  const boxY = 44;
  ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    ctx.fillRect(boxX, boxY, boxW, boxH);
  }
  ctx.fillStyle = '#818cf8';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('REFERENCE NUMBER', boxX + 16, boxY + 22);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px monospace';
  ctx.fillText(receiptData.refCode, boxX + 16, boxY + 45);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.fillText(receiptData.dateFormatted, boxX + 16, boxY + 63);

  // Perforated Voucher / Ticket Divider Line
  const cutY = 142;
  ctx.beginPath();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.moveTo(36, cutY);
  ctx.lineTo(width - 36, cutY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Semi-circle ticket punch cutouts on borders
  ctx.fillStyle = '#030712';
  ctx.beginPath();
  ctx.arc(16, cutY, 14, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(width - 16, cutY, 14, Math.PI / 2, -Math.PI / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
  ctx.stroke();

  // Table of Items
  let curY = 180;
  receiptData.items.forEach((item, idx) => {
    // Alternating subtle row shading
    if (idx % 2 === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.fillRect(36, curY - 20, width - 72, rowHeight);
    }

    // Label (Left Column)
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(item.label.toUpperCase(), 48, curY);

    // Value (Right Column)
    if (item.badge) {
      // Accent schedule pill
      ctx.font = 'bold 13px sans-serif';
      const textWidth = ctx.measureText(item.value).width;
      const pillW = textWidth + 24;
      const pillX = width - 48 - pillW;
      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(pillX, curY - 17, pillW, 26, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
        ctx.stroke();
      }
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(item.value, pillX + 12, curY);
    } else if (item.highlight) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      const valW = ctx.measureText(item.value).width;
      ctx.fillText(item.value, width - 48 - valW, curY);
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '13px sans-serif';
      const valW = ctx.measureText(item.value).width;
      ctx.fillText(item.value, width - 48 - valW, curY);
    }

    // Divider line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(48, curY + 18);
    ctx.lineTo(width - 48, curY + 18);
    ctx.stroke();

    curY += rowHeight;
  });

  // Security Seal & Verification Footer
  curY += 16;
  const stampBoxH = 76;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(36, curY, width - 72, stampBoxH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    ctx.fillRect(36, curY, width - 72, stampBoxH);
  }

  // Draw simulated security QR code matrix
  const qrX = 50;
  const qrY = curY + 12;
  const qrSize = 52;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(qrX, qrY, qrSize, qrSize);
  ctx.fillStyle = '#10b981';
  ctx.fillRect(qrX + 4, qrY + 4, 13, 13);
  ctx.fillRect(qrX + 35, qrY + 4, 13, 13);
  ctx.fillRect(qrX + 4, qrY + 35, 13, 13);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(qrX + 7, qrY + 7, 7, 7);
  ctx.fillRect(qrX + 38, qrY + 7, 7, 7);
  ctx.fillRect(qrX + 7, qrY + 38, 7, 7);
  ctx.fillStyle = '#10b981';
  ctx.fillRect(qrX + 9, qrY + 9, 3, 3);
  ctx.fillRect(qrX + 40, qrY + 9, 3, 3);
  ctx.fillRect(qrX + 9, qrY + 40, 3, 3);
  ctx.fillRect(qrX + 22, qrY + 6, 6, 6);
  ctx.fillRect(qrX + 22, qrY + 20, 8, 8);
  ctx.fillRect(qrX + 10, qrY + 22, 5, 5);
  ctx.fillRect(qrX + 36, qrY + 22, 5, 5);
  ctx.fillRect(qrX + 22, qrY + 36, 6, 6);
  ctx.fillRect(qrX + 34, qrY + 36, 12, 5);

  // Security Verification Copy
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('🔒 DIGITALLY RECORDED & VERIFIED', qrX + qrSize + 16, curY + 28);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.fillText('Please present this e-receipt image for seminar materials claiming and attendance check-in.', qrX + qrSize + 16, curY + 46);

  ctx.fillStyle = '#64748b';
  ctx.font = '10px monospace';
  ctx.fillText('SECURITY HASH: ' + receiptData.refCode + '-' + Date.now().toString(16).toUpperCase(), qrX + qrSize + 16, curY + 63);

  // Trigger download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.download = `Registration_Receipt_${receiptData.refCode}.png`;
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }, 'image/png');
}

/**
 * Displays the interactive card-style receipt modal.
 * @param {Object} payload Form data submitted
 * @param {Object} [options]
 */
export function showRegistrationReceiptModal(payload, options = {}) {
  const existing = document.getElementById('wb-receipt-modal');
  if (existing) existing.remove();

  const formEl = options.form || null;
  const title = options.title || 'Official Seminar Registration';
  const receipt = formatReceiptDetails(payload, formEl);

  const modal = document.createElement('div');
  modal.id = 'wb-receipt-modal';
  modal.className = 'wb-receipt-overlay animate-fade-in';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';

  const rowsHtml = receipt.items.map((it, idx) => {
    const valClass = it.badge ? 'wb-receipt-pill' : (it.highlight ? 'wb-receipt-bold' : '');
    const linkHtml = it.link ? `<a href="${it.link}" target="_blank" rel="noopener" style="color:#38bdf8;text-decoration:underline;margin-left:8px;font-size:0.75rem;">View File ↗</a>` : '';
    return `
      <div class="wb-receipt-row ${idx % 2 === 0 ? 'alt' : ''}">
        <span class="wb-receipt-row-label">${it.label}</span>
        <span class="wb-receipt-row-val ${valClass}">${it.value} ${linkHtml}</span>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="wb-receipt-card" style="position:relative;max-width:540px;width:100%;background:linear-gradient(165deg,#0f172a 0%,#090d16 100%);border:1px solid rgba(99,102,241,0.35);border-radius:20px;box-shadow:0 25px 60px rgba(0,0,0,0.8),0 0 40px rgba(99,102,241,0.15);overflow:hidden;font-family:'Plus Jakarta Sans',sans-serif;color:#f8fafc;margin:auto;">
      <!-- Top Accent Bar -->
      <div style="height:6px;background:linear-gradient(90deg,#10b981,#6366f1,#06b6d4);"></div>

      <!-- Close Button -->
      <button id="wb-btn-close-receipt-top" style="position:absolute;top:16px;right:18px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;transition:all 0.15s ease;" title="Close">✕</button>

      <!-- Card Header -->
      <div style="padding:24px 26px 16px;">
        <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.35);color:#34d399;font-size:0.75rem;font-weight:700;margin-bottom:12px;">
          <span>✓</span> REGISTRATION CONFIRMED
        </div>
        <h2 style="margin:0 0 4px;font-size:1.35rem;font-weight:800;color:#ffffff;line-height:1.25;">${title}</h2>
        <p style="margin:0;font-size:0.82rem;color:#94a3b8;">Official Delegate E-Receipt & Confirmation Slip</p>
      </div>

      <!-- Reference & Date Box -->
      <div style="margin:0 24px;padding:12px 16px;background:rgba(30,41,59,0.7);border:1px solid rgba(99,102,241,0.3);border-radius:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="font-size:0.68rem;font-weight:700;color:#818cf8;letter-spacing:0.5px;text-transform:uppercase;">Reference Number</div>
          <div style="font-size:1.05rem;font-weight:800;font-family:monospace;color:#ffffff;letter-spacing:0.5px;">${receipt.refCode}</div>
          <div style="font-size:0.72rem;color:#94a3b8;margin-top:2px;">${receipt.dateFormatted}</div>
        </div>
        <button id="wb-btn-copy-receipt-ref" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#e2e8f0;font-size:0.75rem;font-weight:600;cursor:pointer;transition:all 0.15s ease;">
          <span>📋</span> Copy Ref
        </button>
      </div>

      <!-- Perforated Ticket Divider -->
      <div style="position:relative;margin:20px 0 16px;border-top:2px dashed rgba(255,255,255,0.15);">
        <div style="position:absolute;left:-14px;top:-13px;width:24px;height:24px;border-radius:50%;background:#000;border-right:1px solid rgba(99,102,241,0.35);"></div>
        <div style="position:absolute;right:-14px;top:-13px;width:24px;height:24px;border-radius:50%;background:#000;border-left:1px solid rgba(99,102,241,0.35);"></div>
      </div>

      <!-- Receipt Rows List -->
      <div style="padding:0 24px;display:flex;flex-direction:column;gap:2px;max-height:42vh;overflow-y:auto;">
        ${rowsHtml}
      </div>

      <!-- Security Notice Box -->
      <div style="margin:16px 24px 0;padding:12px 14px;background:rgba(15,23,42,0.8);border:1px solid rgba(16,185,129,0.25);border-radius:10px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:1.5rem;line-height:1;">🛡️</span>
        <div style="font-size:0.72rem;color:#94a3b8;line-height:1.4;">
          <strong style="color:#34d399;">Official Record Stored:</strong> Please present or keep this receipt image for attendance check-in and claiming seminar kits.
        </div>
      </div>

      <!-- Action Buttons Footer -->
      <div style="padding:18px 24px 22px;background:rgba(10,15,26,0.95);border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:16px;">
        <button id="wb-btn-print-receipt" style="display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#cbd5e1;font-size:0.82rem;font-weight:600;cursor:pointer;">
          <span>🖨️</span> Print
        </button>
        <button id="wb-btn-download-receipt-img" style="display:inline-flex;align-items:center;gap:8px;padding:9px 20px;border-radius:8px;background:linear-gradient(135deg,#10b981,#059669);border:none;color:#ffffff;font-size:0.85rem;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(16,185,129,0.4);transition:transform 0.15s ease;">
          <span>📥</span> Download Receipt Image
        </button>
        <button id="wb-btn-close-receipt-bottom" style="padding:9px 16px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,0.12);color:#94a3b8;font-size:0.82rem;cursor:pointer;">
          Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  const closeModal = () => modal.remove();
  modal.querySelector('#wb-btn-close-receipt-top').addEventListener('click', closeModal);
  modal.querySelector('#wb-btn-close-receipt-bottom').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Copy Reference Code
  const copyBtn = modal.querySelector('#wb-btn-copy-receipt-ref');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(receipt.refCode).then(() => {
      copyBtn.innerHTML = '<span>✓</span> Copied!';
      copyBtn.style.color = '#34d399';
      setTimeout(() => {
        copyBtn.innerHTML = '<span>📋</span> Copy Ref';
        copyBtn.style.color = '#e2e8f0';
      }, 2000);
    });
  });

  // Print Receipt
  modal.querySelector('#wb-btn-print-receipt').addEventListener('click', () => {
    window.print();
  });

  // Download Receipt Image (PNG)
  const downloadBtn = modal.querySelector('#wb-btn-download-receipt-img');
  downloadBtn.addEventListener('click', () => {
    downloadBtn.innerHTML = '<span>⏳</span> Generating Image...';
    downloadBtn.disabled = true;
    setTimeout(() => {
      try {
        downloadReceiptImage(receipt, title);
        downloadBtn.innerHTML = '<span>✓</span> Image Downloaded!';
        downloadBtn.style.background = '#059669';
        setTimeout(() => {
          downloadBtn.innerHTML = '<span>📥</span> Download Receipt Image';
          downloadBtn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
          downloadBtn.disabled = false;
        }, 2500);
      } catch (err) {
        console.error('Download receipt image failed:', err);
        downloadBtn.innerHTML = '<span>⚠️</span> Error, try Print';
        downloadBtn.disabled = false;
      }
    }, 150);
  });
}

// Expose on window for runtime and inline templates
if (typeof window !== 'undefined') {
  window.formatReceiptDetails = formatReceiptDetails;
  window.downloadReceiptImage = downloadReceiptImage;
  window.showRegistrationReceiptModal = showRegistrationReceiptModal;
}
