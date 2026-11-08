/**
 * AETHERBUILDER - GOOGLE SHEETS LIVE SYNC & PARSING ENGINE
 * Normalizes Google Sheets URLs, fetches public CSV exports, and maps column headers.
 */

/**
 * Normalizes any Google Sheets URL (pubhtml, edit link, preview link) to a direct CSV export endpoint.
 * @param {string} url
 * @returns {string}
 */
export function normalizeGoogleSheetUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim();

  // If already a direct CSV download link
  if (clean.includes('/pub?output=csv') || clean.includes('/export?format=csv')) {
    return clean;
  }

  // Handle published web page (/pubhtml)
  if (clean.includes('/pubhtml')) {
    return clean.replace('/pubhtml', '/pub?output=csv');
  }

  // Handle /pub with existing query params
  if (clean.includes('/pub?') && !clean.includes('output=csv')) {
    return clean + '&output=csv';
  }

  // Handle raw /pub without query
  if (clean.endsWith('/pub')) {
    return clean + '?output=csv';
  }

  // Handle regular edit or preview URLs: /spreadsheets/d/{docId}/edit...
  const docMatch = clean.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (docMatch && docMatch[1]) {
    const docId = docMatch[1];
    const gidMatch = clean.match(/gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '0';
    return `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gid}`;
  }

  return clean;
}

/**
 * Robust RFC-compliant CSV Parser that handles quotes, linebreaks, and commas within cells.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const p = [[]];
  let row = p[0];
  let inQuotes = false;
  let entry = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        entry += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(entry);
      entry = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      row.push(entry);
      entry = '';
      row = [];
      p.push(row);
    } else {
      entry += c;
    }
  }
  if (entry.length > 0 || row.length > 0) {
    row.push(entry);
  }
  return p.filter((r) => r.length > 0 && r.some((c) => c && c.trim().length > 0));
}

/**
 * Fetches and parses Lecturer / Speaker profiles from a Google Sheet CSV URL.
 * Automatically maps fuzzy header names (e.g. Speaker/Name, Photo/Image, Topics/Specialization, Summary/Bio).
 * @param {string} url
 * @returns {Promise<Array<{ name: string, photoUrl: string, topics: string, summary: string }>>}
 */
export async function fetchGoogleSheetLecturers(url) {
  const csvUrl = normalizeGoogleSheetUrl(url);
  if (!csvUrl) throw new Error('Invalid or empty Google Sheet URL');

  const res = await fetch(csvUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch sheet (HTTP ${res.status}). Ensure the sheet is public.`);
  }

  const csvText = await res.text();
  if (!csvText || csvText.includes('<!DOCTYPE html>')) {
    throw new Error('Google Sheet returned an HTML login or error page instead of CSV. Please check that sharing is set to "Anyone with the link can view".');
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error('Sheet appears to be empty or has no data rows below the header.');
  }

  const headers = rows[0].map((h) => (h || '').toLowerCase().trim());
  const findCol = (terms) => headers.findIndex((h) => terms.some((t) => h.includes(t)));

  const nameIdx = findCol(['name', 'lecturer', 'speaker', 'faculty', 'presenter', 'instructor', 'fullname', 'person', 'lawyer']);
  const photoIdx = findCol(['photo', 'image', 'picture', 'avatar', 'img', 'headshot', 'pic', 'url']);
  const topicsIdx = findCol(['topic', 'topics', 'specialization', 'specializations', 'subject', 'subjects', 'area', 'fields', 'expertise']);
  const summaryIdx = findCol(['summary', 'bio', 'biography', 'profile', 'description', 'about', 'credentials', 'details']);

  const items = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || !c.trim())) continue;

    // Use name column or first non-empty column
    const nameVal = nameIdx >= 0 ? (row[nameIdx] || '').trim() : (row[0] || '').trim();
    if (!nameVal) continue;

    items.push({
      name: nameVal,
      photoUrl: photoIdx >= 0 ? (row[photoIdx] || '').trim() : '',
      topics: topicsIdx >= 0 ? (row[topicsIdx] || '').trim() : '',
      summary: summaryIdx >= 0 ? (row[summaryIdx] || '').trim() : ''
    });
  }

  return items;
}

/**
 * Fetches and parses Seminar / Lecture Schedule rows from a Google Sheet CSV URL.
 * @param {string} url
 * @returns {Promise<Array<{ day: string, time: string, topic: string, lecturer: string, subjectArea: string }>>}
 */
export async function fetchGoogleSheetSchedule(url) {
  const csvUrl = normalizeGoogleSheetUrl(url);
  if (!csvUrl) throw new Error('Invalid or empty Google Sheet URL');

  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const csvText = await res.text();
  if (!csvText || csvText.includes('<!DOCTYPE html>')) throw new Error('Invalid CSV');

  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error('Empty sheet');

  const headers = rows[0].map((h) => (h || '').toLowerCase().trim());
  const findCol = (terms) => headers.findIndex((h) => terms.some((t) => h.includes(t)));

  const dayIdx = findCol(['day', 'date']);
  const timeIdx = findCol(['time', 'hour', 'schedule']);
  const topicIdx = findCol(['topic', 'title', 'subject', 'session']);
  const lecturerIdx = findCol(['lecturer', 'speaker', 'faculty', 'presenter']);
  const areaIdx = findCol(['area', 'mcle', 'units', 'credit', 'category']);

  const items = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || !c.trim())) continue;
    items.push({
      day: dayIdx >= 0 ? (row[dayIdx] || '').trim() : '',
      time: timeIdx >= 0 ? (row[timeIdx] || '').trim() : '',
      topic: topicIdx >= 0 ? (row[topicIdx] || '').trim() : (row[0] || '').trim(),
      lecturer: lecturerIdx >= 0 ? (row[lecturerIdx] || '').trim() : (row[1] || '').trim(),
      subjectArea: areaIdx >= 0 ? (row[areaIdx] || '').trim() : (row[2] || '').trim()
    });
  }
  return items;
}

/**
 * Ready-to-deploy Google Apps Script code for Registration Form Webhook sync.
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * =========================================================================
 * AETHERBUILDER - REGISTRATION FORM GOOGLE SHEETS WEBHOOK (APPS SCRIPT)
 * =========================================================================
 * Automatically logs website registrations into your Google Sheet in real time.
 * Handles custom form fields, uploaded file links, and dynamic columns.
 *
 * HOW TO INSTALL IN 3 EASY STEPS:
 * 1. Open your Google Sheet > Click "Extensions" > "Apps Script".
 * 2. Delete any code in the editor, paste this entire script, and click Save (💾).
 * 3. Click "Deploy" > "New deployment":
 *    - Click ⚙️ next to "Select type" > Choose "Web app".
 *    - Description: "Registration Form Webhook"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (IMPORTANT! Allows your website to post)
 *    - Click "Deploy" > Authorize Access > Copy the "Web app URL".
 * 4. Paste that Web app URL into the "Google Sheets Webhook URL" field in the builder!
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait up to 10s to prevent concurrent write collisions

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var raw = e && e.postData ? e.postData.contents : '{}';
    var data = {};
    try {
      data = JSON.parse(raw);
    } catch (parseErr) {
      data = (e && e.parameter) ? e.parameter : {};
    }

    // Helper: test if key should be ignored (system metadata, auxiliary files, honeypots)
    function shouldIgnore(key) {
      var k = String(key || '').toLowerCase();
      if (k === '_hp' || k === 'website_hp' || k === 'extra' || k === '_extra') return true;
      if (k === 'type' || k === 'page' || k === 'message') return true;
      if (k.indexOf('_b64') !== -1 || k.indexOf('_filename') !== -1 || k.indexOf('_url') !== -1) return true;
      return false;
    }

    // Ensure first row has headers
    var lastRow = sheet.getLastRow();
    var lastCol = Math.max(sheet.getLastColumn(), 1);

    // If sheet is completely blank, initialize clean headers dynamically from submitted form fields
    if (lastRow === 0) {
      var initialHeaders = ['Timestamp'];
      for (var k in data) {
        if (k.toLowerCase() === 'timestamp' || shouldIgnore(k)) continue;
        var label = k.replace(/_/g, ' ').replace(/\\b\\w/g, function(l){ return l.toUpperCase(); });
        initialHeaders.push(label);
      }
      sheet.appendRow(initialHeaders);
      sheet.getRange(1, 1, 1, initialHeaders.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
      lastRow = 1;
      lastCol = initialHeaders.length;
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Helper: normalize header/key for fuzzy matching (e.g. "Full_Name" == "Full Name" == "fullname")
    function clean(str) {
      return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    // Add a formatted timestamp if not provided
    if (!data.timestamp && !data.Timestamp) {
      data.Timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+8', 'yyyy-MM-dd HH:mm:ss');
    }

    // Map each existing header to payload data
    var newRow = [];
    var mappedKeys = {};

    headers.forEach(function(header) {
      var hClean = clean(header);
      var matchedVal = '';

      for (var k in data) {
        if (clean(k) === hClean) {
          // If this header matches an ignored column (like Type, Page, Message) that exists in an older sheet, leave blank
          if (shouldIgnore(k) && hClean !== 'timestamp') {
            matchedVal = '';
          } else {
            matchedVal = data[k];
          }
          mappedKeys[k] = true;
          break;
        }
      }
      newRow.push(matchedVal !== undefined && matchedVal !== null ? matchedVal : '');
    });

    // Check if there are any extra custom fields not yet in headers
    for (var key in data) {
      if (shouldIgnore(key)) continue;
      if (!mappedKeys[key]) {
        // Add new column header dynamically
        var nextCol = sheet.getLastColumn() + 1;
        var headerLabel = key.replace(/_/g, ' ').replace(/\\b\\w/g, function(l){ return l.toUpperCase(); });
        sheet.getRange(1, nextCol).setValue(headerLabel).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
        headers.push(headerLabel);
        newRow.push(data[key] !== undefined && data[key] !== null ? data[key] : '');
      }
    }

    sheet.appendRow(newRow);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      row: sheet.getLastRow(),
      message: 'Registration logged successfully'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput("AetherBuilder Webhook endpoint is LIVE and ready for POST requests.");
}`;

/**
 * Displays an interactive modal with the Google Apps Script code and setup instructions.
 */
export function showAppsScriptModal() {
  const existing = document.getElementById('appscript-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'appscript-modal';
  modal.className = 'modal-overlay animate-fade-in';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';

  modal.innerHTML = `
    <div style="background:#0f172a;border:1px solid rgba(16,185,129,0.35);border-radius:14px;max-width:760px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 25px 60px rgba(0,0,0,0.7);overflow:hidden;font-family:'Plus Jakarta Sans',sans-serif;">
      <!-- Header -->
      <div style="padding:16px 22px;background:rgba(16,185,129,0.1);border-bottom:1px solid rgba(16,185,129,0.2);display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.4rem;">📊</span>
          <div>
            <h3 style="margin:0;font-size:1.1rem;font-weight:700;color:#f8fafc;">Google Sheets Webhook Setup & Apps Script</h3>
            <div style="font-size:0.75rem;color:#94a3b8;margin-top:2px;">Automatically sync every registration form submission into your Google Sheet in real time</div>
          </div>
        </div>
        <button id="btn-close-appscript-modal" style="background:transparent;border:none;color:#94a3b8;font-size:1.4rem;cursor:pointer;padding:4px 8px;line-height:1;">✕</button>
      </div>

      <!-- Scrollable Body -->
      <div style="padding:20px 22px;overflow-y:auto;display:flex;flex-direction:column;gap:16px;color:#cbd5e1;font-size:0.85rem;line-height:1.55;">
        <!-- Quick 4-Step Guide -->
        <div style="background:rgba(30,41,59,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 16px;">
          <div style="font-weight:700;color:#6ee7b7;font-size:0.92rem;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <span>🚀</span> 4-Step Quick Setup Guide
          </div>
          <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:0.82rem;">
            <li>Open your Google Sheet and click <strong>Extensions</strong> &gt; <strong>Apps Script</strong>.</li>
            <li>Delete any code in the editor, paste the script below, and click <strong>Save (💾)</strong>.</li>
            <li>Click <strong>Deploy</strong> &gt; <strong>New deployment</strong>:
              <ul style="margin:4px 0;padding-left:18px;">
                <li>Click ⚙️ (Select type) &gt; Choose <strong>Web app</strong>.</li>
                <li>Execute as: <strong>Me</strong>.</li>
                <li>Who has access: <strong>Anyone</strong> (<em>CRITICAL: allows your website to submit entries</em>).</li>
              </ul>
            </li>
            <li>Click <strong>Deploy</strong> &gt; Authorize access &gt; Copy the <strong>Web app URL</strong> and paste it into the <strong>Google Sheets Webhook URL</strong> field!</li>
          </ol>
        </div>

        <!-- Code Block -->
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-weight:700;font-size:0.8rem;color:#f8fafc;">Apps Script Code (Code.gs):</span>
            <button id="btn-copy-appscript-code" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:6px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;font-size:0.78rem;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,0.4);transition:transform 0.15s ease;">
              <span>📋</span> Copy Code
            </button>
          </div>
          <pre style="margin:0;padding:14px;background:#030712;border:1px solid rgba(255,255,255,0.1);border-radius:8px;overflow-x:auto;font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:#e2e8f0;line-height:1.45;max-height:280px;"><code id="appscript-code-text"></code></pre>
        </div>

        <div style="font-size:0.76rem;color:#94a3b8;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:8px;padding:10px 14px;">
          ✨ <strong>Smart Column Auto-Mapping:</strong> This script dynamically matches existing column headers in your Google Sheet (e.g. <code>Full Name</code>, <code>Roll No.</code>, <code>Schedule</code>, <code>Mobile No.</code>, <code>Email</code>, <code>LBC Mailing Address</code>) regardless of capitalization. If new form fields are added in the future, it automatically creates new columns without failing!
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:12px 22px;background:rgba(15,23,42,0.9);border-top:1px solid rgba(255,255,255,0.08);display:flex;justify-content:flex-end;gap:10px;">
        <button id="btn-done-appscript-modal" style="padding:7px 18px;border-radius:6px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:0.82rem;font-weight:600;cursor:pointer;">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const codeEl = modal.querySelector('#appscript-code-text');
  if (codeEl) codeEl.textContent = GOOGLE_APPS_SCRIPT_TEMPLATE;

  const copyBtn = modal.querySelector('#btn-copy-appscript-code');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE).then(() => {
      copyBtn.innerHTML = '<span>✓</span> Copied!';
      copyBtn.style.background = '#059669';
      setTimeout(() => {
        copyBtn.innerHTML = '<span>📋</span> Copy Code';
        copyBtn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
      }, 2500);
    });
  });

  const closeModal = () => modal.remove();
  modal.querySelector('#btn-close-appscript-modal').addEventListener('click', closeModal);
  modal.querySelector('#btn-done-appscript-modal').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

// Expose on window for runtime and inline access
if (typeof window !== 'undefined') {
  window.fetchLecturersFromSheet = fetchGoogleSheetLecturers;
  window.fetchScheduleFromSheet = fetchGoogleSheetSchedule;
  window.normalizeGoogleSheetUrl = normalizeGoogleSheetUrl;
  window.parseCsv = parseCsv;
  window.showAppsScriptModal = showAppsScriptModal;
  window.GOOGLE_APPS_SCRIPT_TEMPLATE = GOOGLE_APPS_SCRIPT_TEMPLATE;
}

