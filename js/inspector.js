/**
 * AETHERBUILDER - ELEMENT INSPECTOR PANEL
 * Generates dynamic controls for Content, Style, and Advanced tabs with two-way binding.
 */

import { state } from './state.js';
import { WIDGET_REGISTRY } from './widgets.js';
import { fetchGoogleSheetLecturers, fetchGoogleSheetSchedule, showAppsScriptModal } from './sheets.js';

export class InspectorPanel {
  constructor(containerEl) {
    this.container = containerEl;
    this.currentTab = 'content';
    this.init();
  }

  init() {
    state.subscribe((_, action) => {
      // Re-render inspector if selection changed, or if element deleted/added
      if (['selection', 'delete', 'loadTemplate', 'clear', 'undo', 'redo'].includes(action)) {
        this.render();
      }
    });
  }

  render() {
    const activeEl = state.getActiveElement();
    if (!activeEl) {
      this.container.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-dim);">
          <div style="font-size: 2.2rem; margin-bottom: 12px; opacity: 0.6;">🎯</div>
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-muted); margin-bottom: 6px;">No Element Selected</div>
          <p style="font-size: 0.82rem; line-height: 1.5;">Click any section or widget on the canvas to inspect and edit its properties.</p>
        </div>
      `;
      return;
    }

    const widgetDef = WIDGET_REGISTRY[activeEl.widgetType];
    if (!widgetDef) return;

    this.container.innerHTML = `
      <div class="inspector-panel animate-fade-in">
        <!-- Inspector Header -->
        <div class="inspector-header">
          <div class="inspector-element-badge">
            <span>${widgetDef.icon || '🧩'}</span>
            <span>${widgetDef.name}</span>
          </div>
          <div class="inspector-actions">
            <button class="tool-icon-btn" id="insp-move-up" title="Move Up">↑</button>
            <button class="tool-icon-btn" id="insp-move-down" title="Move Down">↓</button>
            <button class="tool-icon-btn" id="insp-duplicate" title="Duplicate">❐</button>
            <button class="tool-icon-btn" id="insp-delete" title="Delete" style="color: var(--danger);">🗑</button>
          </div>
        </div>

        <!-- Inspector Tabs (Sticky Header) -->
        <div class="inspector-tabs-wrap">
          <div class="inspector-tabs">
            <button class="inspector-tab-btn ${this.currentTab === 'content' ? 'active' : ''}" data-tab="content">Content</button>
            <button class="inspector-tab-btn ${this.currentTab === 'style' ? 'active' : ''}" data-tab="style">Style</button>
            <button class="inspector-tab-btn ${this.currentTab === 'advanced' ? 'active' : ''}" data-tab="advanced">Advanced</button>
          </div>
        </div>

        <!-- Inspector Form Body -->
        <div class="inspector-form" id="inspector-fields-container">
          <!-- Dynamic Controls Rendered Below -->
        </div>
      </div>
    `;

    // Bind header actions
    this.container.querySelector('#insp-move-up').addEventListener('click', () => state.moveElement(activeEl.id, 'up'));
    this.container.querySelector('#insp-move-down').addEventListener('click', () => state.moveElement(activeEl.id, 'down'));
    this.container.querySelector('#insp-duplicate').addEventListener('click', () => state.duplicateElement(activeEl.id));
    this.container.querySelector('#insp-delete').addEventListener('click', () => {
      if (confirm('Delete this element?')) {
        state.deleteElement(activeEl.id);
      }
    });

    // Bind Tab Switching
    const tabBtns = this.container.querySelectorAll('.inspector-tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.currentTab = btn.getAttribute('data-tab');
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderFields(activeEl, widgetDef);

        // Reset scroll position to top when switching tabs
        const scrollParent = this.container.closest('.sidebar-content-area');
        if (scrollParent) {
          scrollParent.scrollTop = 0;
        }
      });
    });

    this.renderFields(activeEl, widgetDef);

    // Measure and set sticky tabs height for subsequent sticky elements (.repeater-search-bar)
    const updateStickyTabsOffset = () => {
      const tabsWrap = this.container.querySelector('.inspector-tabs-wrap');
      if (tabsWrap) {
        const h = tabsWrap.offsetHeight || 55;
        this.container.style.setProperty('--insp-tabs-h', `${h}px`);
      }
    };
    updateStickyTabsOffset();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(updateStickyTabsOffset);
    }
  }

  renderFields(activeEl, widgetDef) {
    const fieldsContainer = this.container.querySelector('#inspector-fields-container');
    if (!fieldsContainer) return;
    fieldsContainer.innerHTML = '';

    const schema = widgetDef.schema || {};

    if (this.currentTab === 'content') {
      const contentFields = schema.content || [];
      if (contentFields.length === 0) {
        fieldsContainer.innerHTML = `<div style="color: var(--text-dim); font-size: 0.85rem;">No content options for this widget.</div>`;
        return;
      }
      contentFields.forEach((field) => {
        fieldsContainer.appendChild(this.createControlElement(activeEl, field));
      });
    } else if (this.currentTab === 'style') {
      const widgetStyleFields = schema.style || [];
      if (widgetStyleFields.length > 0) {
        const header = document.createElement('div');
        header.style.cssText = 'font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: #cbd5e1; margin-bottom: 12px; letter-spacing: 0.05em;';
        header.textContent = 'Widget Styles';
        fieldsContainer.appendChild(header);
        widgetStyleFields.forEach((field) => {
          fieldsContainer.appendChild(this.createControlElement(activeEl, field));
        });
      }

      // Universal Spacing & Layout for ALL widgets
      const spacingHeader = document.createElement('div');
      spacingHeader.style.cssText = 'margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--primary-light); margin-bottom: 8px; letter-spacing: 0.05em;';
      spacingHeader.innerHTML = '📐 Section Spacing & Layout';
      fieldsContainer.appendChild(spacingHeader);

      const presetBar = document.createElement('div');
      presetBar.style.cssText = 'display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap;';
      const presets = [
        { label: '⚡ Fit Content', pt: '0px', pb: '0px', fit: true },
        { label: 'Compact', pt: '16px', pb: '16px', fit: false },
        { label: 'Default', pt: '48px', pb: '48px', fit: false },
        { label: 'Spacious', pt: '80px', pb: '80px', fit: false }
      ];
      presets.forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = p.label;
        btn.style.cssText = 'font-size: 0.73rem; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-main); cursor: pointer; transition: all 0.2s;';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          activeEl.props.fitContentHeight = p.fit;
          activeEl.props.paddingTop = p.pt;
          activeEl.props.paddingBottom = p.pb;
          state.saveDraft();
          state.notify('propUpdate');
          this.render();
        });
        presetBar.appendChild(btn);
      });
      fieldsContainer.appendChild(presetBar);

      const existingKeys = new Set(widgetStyleFields.map(f => f.key));
      const universalFields = [
        { key: 'fitContentHeight', label: '⚡ Fit to Content Height (Zero Extra Spacing)', type: 'toggle', default: false },
        { key: 'paddingTop', label: 'Padding Top', type: 'text', default: '48px' },
        { key: 'paddingBottom', label: 'Padding Bottom', type: 'text', default: '48px' },
        { key: 'paddingX', label: 'Horizontal Padding', type: 'text', default: '24px' },
        { key: 'bgColor', label: 'Section Background Color', type: 'color', default: 'transparent' },
        { key: 'bgGradient', label: '🎨 Section Background Gradient (overrides color)', type: 'text', default: '' },
        { key: 'fullWidth', label: 'Full Width Canvas', type: 'toggle', default: false }
      ].filter(f => !existingKeys.has(f.key));

      universalFields.forEach((field) => {
        fieldsContainer.appendChild(this.createControlElement(activeEl, field));
      });
    } else if (this.currentTab === 'advanced') {
      // Custom widget advanced properties (e.g. EmailJS credentials, custom endpoints)
      const widgetAdvFields = schema.advanced || [];
      if (widgetAdvFields.length > 0) {
        const widgetAdvHeader = document.createElement('div');
        widgetAdvHeader.style.cssText = 'font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--primary-light, #a5b4fc); margin-bottom: 12px; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;';
        widgetAdvHeader.innerHTML = '<span>⚡</span> Widget Advanced Settings';
        fieldsContainer.appendChild(widgetAdvHeader);

        widgetAdvFields.forEach((field) => {
          fieldsContainer.appendChild(this.createControlElement(activeEl, field));
        });

        const divider = document.createElement('div');
        divider.style.cssText = 'margin: 18px 0 14px; border-top: 1px solid var(--border-subtle);';
        fieldsContainer.appendChild(divider);
      }

      // Section header
      const advHeader = document.createElement('div');
      advHeader.style.cssText = 'font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: #cbd5e1; margin-bottom: 12px; letter-spacing: 0.05em;';
      advHeader.textContent = 'Section Settings';
      fieldsContainer.appendChild(advHeader);

      const advFields = [
        { key: 'customClass', label: 'Custom CSS Class', type: 'text' },
        { key: 'zIndex', label: 'Z-Index Layer', type: 'number' },
        { key: 'hideMobile', label: '📱 Hide on Mobile', type: 'toggle' }
      ];
      advFields.forEach((field) => {
        fieldsContainer.appendChild(this.createControlElement(activeEl, field));
      });

      // Entrance Animation section
      const animHeader = document.createElement('div');
      animHeader.style.cssText = 'margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--primary-light); margin-bottom: 8px; letter-spacing: 0.05em;';
      animHeader.innerHTML = '✨ Scroll-Reveal Animation';
      fieldsContainer.appendChild(animHeader);

      const animNote = document.createElement('p');
      animNote.style.cssText = 'font-size: 0.78rem; color: var(--text-dim); margin: 0 0 10px; line-height: 1.5;';
      animNote.textContent = 'Sections animate in when they scroll into view on the live site.';
      fieldsContainer.appendChild(animNote);

      const animFields = [
        { key: 'entryAnimation', label: '🎬 Animation Type', type: 'select', options: [
            { label: 'None (disabled)', value: 'none' },
            { label: '✦ Fade In', value: 'fade-in' },
            { label: '↑ Fade Up', value: 'fade-up' },
            { label: '↓ Fade Down', value: 'fade-down' },
            { label: '← Fade From Left', value: 'fade-left' },
            { label: '→ Fade From Right', value: 'fade-right' },
            { label: '⊙ Zoom In', value: 'zoom-in' },
            { label: '⬛ Flip Up', value: 'flip-up' }
          ], default: 'none'
        },
        { key: 'animationDelay', label: '⏱ Delay (ms, e.g. 100)', type: 'number', default: 0 }
      ];
      animFields.forEach((field) => {
        fieldsContainer.appendChild(this.createControlElement(activeEl, field));
      });
    }
  }

  createControlElement(activeEl, field) {
    const group = document.createElement('div');
    group.className = 'prop-group';

    const currentValue = activeEl.props[field.key] !== undefined ? activeEl.props[field.key] : (field.default ?? '');

    const label = document.createElement('label');
    label.className = 'prop-label';
    label.textContent = field.label || field.key;
    group.appendChild(label);

    switch (field.type) {
      case 'text': {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue || '';
        if (field.key === 'googleSheetUrl') {
          input.placeholder = 'https://docs.google.com/spreadsheets/d/...';
        }
        if (field.key === 'bgGradient') {
          input.placeholder = 'e.g. linear-gradient(135deg, #1a0533 0%, #0f1729 100%)';
        }
        input.addEventListener('input', (e) => {
          activeEl.props[field.key] = e.target.value;
          state.saveDraft();
          state.notify('propUpdate');
        });
        group.appendChild(input);

        // Gradient hint
        if (field.key === 'bgGradient') {
          const hint = document.createElement('div');
          hint.style.cssText = 'font-size: 0.73rem; color: var(--text-dim); margin-top: 4px; line-height: 1.4;';
          hint.innerHTML = '💡 CSS gradient syntax. Examples:<br><code style="font-size:0.7rem;opacity:0.75;">linear-gradient(135deg, #6366f1, #0ea5e9)</code><br><code style="font-size:0.7rem;opacity:0.75;">radial-gradient(circle at top, #1e1b4b, #000)</code>';
          group.appendChild(hint);
        }

        // One-Click Google Sheets Sync & Import for lecturer_gallery & seminar_schedule
        if (field.key === 'googleSheetUrl' && (activeEl.widgetType === 'lecturer_gallery' || activeEl.widgetType === 'seminar_schedule')) {
          const syncCard = document.createElement('div');
          syncCard.className = 'sheet-sync-control-card';

          const isLecturer = activeEl.widgetType === 'lecturer_gallery';
          const targetProp = isLecturer ? 'lecturers' : 'items';
          const noun = isLecturer ? 'Speakers' : 'Schedule Rows';

          syncCard.innerHTML = `
            <div class="sheet-sync-tip">
              <span>💡</span>
              <div>
                <strong>Google Sheets Live Sync Guide:</strong>
                <p>1. Open your Google Sheet &gt; Click <strong>Share</strong> &gt; Set General access to <strong>"Anyone with the link can view"</strong>.</p>
                <p>2. Paste your Google Sheet share or published link above.</p>
                <p>3. Supported column headers: <code>Name</code>, <code>Photo</code>, <code>Topics</code>, <code>Summary / Bio</code>.</p>
              </div>
            </div>
            <div class="sheet-sync-actions">
              <button type="button" class="sheet-sync-btn">
                <span>🔄</span> Fetch & Update ${noun} from Sheet Now
              </button>
              <div class="sheet-sync-msg" style="display:none;"></div>
            </div>
          `;

          const syncBtn = syncCard.querySelector('.sheet-sync-btn');
          const msgEl = syncCard.querySelector('.sheet-sync-msg');

          syncBtn.addEventListener('click', async () => {
            const url = (activeEl.props.googleSheetUrl || '').trim();
            if (!url) {
              msgEl.style.display = 'block';
              msgEl.className = 'sheet-sync-msg error';
              msgEl.textContent = '⚠️ Please enter a Google Sheets link above first.';
              return;
            }

            syncBtn.disabled = true;
            syncBtn.innerHTML = `<span>⏳</span> Connecting & Fetching...`;
            msgEl.style.display = 'block';
            msgEl.className = 'sheet-sync-msg info';
            msgEl.textContent = 'Contacting Google Sheet CSV endpoint...';

            try {
              let fetched = [];
              if (isLecturer) {
                fetched = await fetchGoogleSheetLecturers(url);
              } else {
                fetched = await fetchGoogleSheetSchedule(url);
              }

              if (!fetched || fetched.length === 0) {
                throw new Error('No valid rows found in sheet. Check header column names.');
              }

              // Update widget props
              activeEl.props[targetProp] = fetched;
              state.saveDraft();
              state.notify('propUpdate');

              msgEl.className = 'sheet-sync-msg success';
              msgEl.innerHTML = `✅ <strong>Successfully loaded ${fetched.length} ${noun.toLowerCase()}!</strong>`;
              syncBtn.disabled = false;
              syncBtn.innerHTML = `<span>🔄</span> Fetch & Update ${noun} from Sheet Now`;

              // Re-render inspector after short delay so admin sees the new items in repeater with search box!
              setTimeout(() => {
                this.render();
              }, 700);
            } catch (err) {
              console.error('Manual sheet sync failed:', err);
              msgEl.className = 'sheet-sync-msg error';
              msgEl.innerHTML = `❌ <strong>Sync Failed:</strong> ${err.message || 'Could not fetch CSV.'}`;
              syncBtn.disabled = false;
              syncBtn.innerHTML = `<span>🔄</span> Retry Fetching ${noun}`;
            }
          });

          group.appendChild(syncCard);
        }

        // ── Catalog Bridge: Import Live Products for addon_culinary_grid
        if (field.key === 'items' && activeEl.addonId === 'addon_culinary_grid') {
          const catCard = document.createElement('div');
          catCard.className = 'sheet-sync-control-card';
          catCard.innerHTML = `
            <div class="sheet-sync-tip">
              <span>🍰</span>
              <div>
                <strong>Messenger Bot Catalog Bridge:</strong>
                <p>Click the button below to import your live product listing from the Messenger Bot catalog directly into this grid. Products are mapped automatically — name, price, image, and category tag.</p>
                <p style="margin-top:4px;color:var(--text-dim);font-size:0.78rem;">💡 Tip: Enable <strong>Live Sync from Bot Catalog</strong> above to skip manual import and auto-update on page load.</p>
              </div>
            </div>
            <div class="sheet-sync-actions">
              <button type="button" class="sheet-sync-btn" id="btn-import-catalog-products">
                <span>🔄</span> Import Live Products from Catalog
              </button>
              <div class="sheet-sync-msg" style="display:none;"></div>
            </div>
          `;

          const catBtn = catCard.querySelector('#btn-import-catalog-products');
          const catMsg = catCard.querySelector('.sheet-sync-msg');

          catBtn.addEventListener('click', async () => {
            catBtn.disabled = true;
            catBtn.innerHTML = `<span>⏳</span> Fetching from catalog...`;
            catMsg.style.display = 'block';
            catMsg.className = 'sheet-sync-msg info';
            catMsg.textContent = 'Connecting to Messenger Bot product catalog...';
            try {
              const res = await fetch('api.php?action=get_catalog_products', { cache: 'no-store' });
              if (!res.ok) throw new Error(`Server returned ${res.status}`);
              const data = await res.json();
              if (!data.success || !Array.isArray(data.products) || data.products.length === 0) {
                throw new Error('No active products found in catalog. Add products in the Bot Dashboard first.');
              }
              const currMap = { 'PHP': '₱', 'USD': '$' };
              const mapped = data.products.map(p => ({
                name:     p.name || '',
                price:    (currMap[p.currency] || (p.currency + ' ')) + parseFloat(p.price || 0).toFixed(2),
                imageUrl: p.image_url || '',
                tag:      p.category || '',
                link:     ''
              }));
              activeEl.props.items = mapped;
              state.saveDraft();
              state.notify('propUpdate');
              catMsg.className = 'sheet-sync-msg success';
              catMsg.innerHTML = `✅ <strong>Imported ${mapped.length} product(s) from catalog!</strong> Edit individual items above to customise.`;
              catBtn.disabled = false;
              catBtn.innerHTML = `<span>🔄</span> Re-import from Catalog`;
              setTimeout(() => { this.render(); }, 700);
            } catch (err) {
              console.error('Catalog import failed:', err);
              catMsg.className = 'sheet-sync-msg error';
              catMsg.innerHTML = `❌ <strong>Import Failed:</strong> ${err.message || 'Could not reach catalog API.'}`;
              catBtn.disabled = false;
              catBtn.innerHTML = `<span>🔄</span> Retry Import`;
            }
          });

          group.appendChild(catCard);
        }

        // Google Apps Script Webhook Guide & Cheat-Sheet for registration_form
        if (field.key === 'googleSheetUrl' && activeEl.widgetType === 'registration_form') {
          const webhookCard = document.createElement('div');
          webhookCard.className = 'sheet-sync-control-card';
          webhookCard.innerHTML = `
            <div class="sheet-sync-tip">
              <span>📊</span>
              <div>
                <strong>Google Sheets Live Webhook Sync:</strong>
                <p>1. Open your Google Sheet &gt; <strong>Extensions</strong> &gt; <strong>Apps Script</strong>.</p>
                <p>2. Paste our Apps Script webhook code &gt; Click <strong>Deploy as Web app</strong> (Access: <em>Anyone</em>).</p>
                <p>3. Paste the generated <code>https://script.google.com/macros/s/.../exec</code> URL above.</p>
              </div>
            </div>
            <div class="sheet-sync-actions">
              <button type="button" class="sheet-sync-btn" id="btn-view-appscript-guide">
                <span>📋</span> View & Copy Google Apps Script Code
              </button>
            </div>
          `;

          webhookCard.querySelector('#btn-view-appscript-guide').addEventListener('click', () => {
            showAppsScriptModal();
          });

          group.appendChild(webhookCard);
        }
        break;
      }

      case 'textarea': {
        const textarea = document.createElement('textarea');
        textarea.rows = field.rows || 3;
        textarea.value = currentValue || '';
        textarea.addEventListener('input', (e) => {
          activeEl.props[field.key] = e.target.value;
          state.saveDraft();
          state.notify('propUpdate');
        });
        group.appendChild(textarea);
        break;
      }

      case 'code': {
        const codeArea = document.createElement('textarea');
        codeArea.rows = field.rows || 8;
        codeArea.value = currentValue || '';
        codeArea.spellcheck = false;
        codeArea.autocomplete = 'off';
        codeArea.autocorrect = 'off';
        codeArea.autocapitalize = 'off';
        Object.assign(codeArea.style, {
          fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
          fontSize: '0.78rem',
          lineHeight: '1.5',
          background: 'rgba(5, 8, 18, 0.9)',
          color: '#a5f3fc',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '6px',
          padding: '10px',
          resize: 'vertical',
          tabSize: '2',
          width: '100%',
          boxSizing: 'border-box'
        });
        // Allow Tab key to insert spaces
        codeArea.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const start = codeArea.selectionStart;
            const end = codeArea.selectionEnd;
            codeArea.value = codeArea.value.substring(0, start) + '  ' + codeArea.value.substring(end);
            codeArea.selectionStart = codeArea.selectionEnd = start + 2;
          }
        });
        codeArea.addEventListener('input', (e) => {
          activeEl.props[field.key] = e.target.value;
          state.saveDraft();
          state.notify('propUpdate');
        });
        group.appendChild(codeArea);
        break;
      }

      case 'number': {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = currentValue ?? 0;
        input.addEventListener('input', (e) => {
          activeEl.props[field.key] = parseFloat(e.target.value) || 0;
          state.saveDraft();
          state.notify('propUpdate');
        });
        group.appendChild(input);
        break;
      }

      case 'select': {
        const select = document.createElement('select');
        (field.options || []).forEach((opt) => {
          const optEl = document.createElement('option');
          const val = typeof opt === 'string' ? opt : opt.value;
          const text = typeof opt === 'string' ? opt : opt.label;
          optEl.value = val;
          optEl.textContent = text;
          if (val === currentValue) optEl.selected = true;
          select.appendChild(optEl);
        });
        select.addEventListener('change', (e) => {
          activeEl.props[field.key] = e.target.value;
          state.saveDraft();
          state.notify('propUpdate');
        });
        group.appendChild(select);
        break;
      }

      case 'page-link': {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.gap = '6px';

        const select = document.createElement('select');
        select.style.fontSize = '0.82rem';
        select.style.padding = '6px 8px';

        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- Select Page or Custom URL --';
        select.appendChild(defaultOpt);

        const pages = state.pages || [];
        pages.forEach((p) => {
          const opt = document.createElement('option');
          const targetUrl = p.slug === 'index' ? 'index.html' : `?page=${p.slug}`;
          opt.value = targetUrl;
          opt.textContent = `📄 ${p.title} (${p.slug === 'index' ? 'Home' : `?page=${p.slug}`})`;
          if (currentValue === targetUrl) opt.selected = true;
          select.appendChild(opt);
        });

        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = '✏️ Custom URL / Anchor (#...)';
        if (currentValue && !pages.some(p => (p.slug === 'index' ? 'index.html' : `?page=${p.slug}`) === currentValue)) {
          customOpt.selected = true;
        }
        select.appendChild(customOpt);

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue || '';
        input.placeholder = 'e.g. ?page=about or #features or https://...';
        input.style.fontSize = '0.82rem';

        select.addEventListener('change', (e) => {
          if (e.target.value !== 'custom' && e.target.value !== '') {
            input.value = e.target.value;
            activeEl.props[field.key] = e.target.value;
            state.saveDraft();
            state.notify('propUpdate');
          }
        });

        input.addEventListener('input', (e) => {
          activeEl.props[field.key] = e.target.value;
          state.saveDraft();
          state.notify('propUpdate');
        });

        wrapper.appendChild(select);
        wrapper.appendChild(input);
        group.appendChild(wrapper);
        break;
      }

      case 'toggle': {
        const toggleWrapper = document.createElement('label');
        toggleWrapper.style.display = 'flex';
        toggleWrapper.style.alignItems = 'center';
        toggleWrapper.style.gap = '10px';
        toggleWrapper.style.cursor = 'pointer';

        const isChecked = currentValue !== undefined ? Boolean(currentValue) : (field.default !== false);
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isChecked;
        checkbox.addEventListener('change', (e) => {
          activeEl.props[field.key] = e.target.checked;
          state.saveDraft();
          state.notify('propUpdate');
        });

        const span = document.createElement('span');
        span.style.fontSize = '0.85rem';
        span.style.color = 'var(--text-muted)';
        span.textContent = isChecked ? 'Enabled' : 'Disabled';

        checkbox.addEventListener('change', () => {
          span.textContent = checkbox.checked ? 'Enabled' : 'Disabled';
        });

        toggleWrapper.appendChild(checkbox);
        toggleWrapper.appendChild(span);
        group.appendChild(toggleWrapper);
        break;
      }

      case 'color': {
        const row = document.createElement('div');
        row.className = 'prop-color-row';
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'prop-color-input';
        colorInput.value = currentValue.startsWith('#') ? currentValue : '#6366f1';

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = currentValue || '';
        textInput.style.flex = '1';

        colorInput.addEventListener('input', (e) => {
          textInput.value = e.target.value;
          activeEl.props[field.key] = e.target.value;
          state.saveDraft();
          state.notify('propUpdate');
        });

        textInput.addEventListener('input', (e) => {
          activeEl.props[field.key] = e.target.value;
          state.saveDraft();
          state.notify('propUpdate');
        });

        row.appendChild(colorInput);
        row.appendChild(textInput);
        group.appendChild(row);
        break;
      }

      case 'image-picker': {
        const pickerWrapper = document.createElement('div');
        pickerWrapper.className = 'prop-image-picker';

        const previewBox = document.createElement('div');
        previewBox.className = 'prop-image-preview';
        const currentUrl = currentValue || '';
        if (currentUrl) {
          previewBox.style.backgroundImage = `url('${currentUrl}')`;
          previewBox.classList.add('has-image');
        } else {
          previewBox.innerHTML = '<span>No image selected</span>';
        }

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.value = currentUrl;
        urlInput.placeholder = 'Paste URL or pick from library...';
        urlInput.addEventListener('input', (e) => {
          activeEl.props[field.key] = e.target.value;
          if (field.key === 'logoImageUrl' && e.target.value) {
            activeEl.props['logoType'] = 'image';
          }
          previewBox.style.backgroundImage = e.target.value ? `url('${e.target.value}')` : '';
          previewBox.classList.toggle('has-image', !!e.target.value);
          if (!e.target.value) previewBox.innerHTML = '<span>No image selected</span>';
          else previewBox.innerHTML = '';
          state.saveDraft();
          state.notify('propUpdate');
        });

        const pickBtn = document.createElement('button');
        pickBtn.className = 'prop-pick-btn';
        pickBtn.innerHTML = '🖼️ Media Library';
        pickBtn.addEventListener('click', () => {
          if (typeof window.openMediaLibrary === 'function') {
            window.openMediaLibrary((selectedUrl) => {
              urlInput.value = selectedUrl;
              activeEl.props[field.key] = selectedUrl;
              if (field.key === 'logoImageUrl') {
                activeEl.props['logoType'] = 'image';
              }
              previewBox.style.backgroundImage = `url('${selectedUrl}')`;
              previewBox.classList.add('has-image');
              previewBox.innerHTML = '';
              state.saveDraft();
              state.notify('propUpdate');
            });
          }
        });

        pickerWrapper.appendChild(previewBox);
        pickerWrapper.appendChild(urlInput);
        pickerWrapper.appendChild(pickBtn);
        group.appendChild(pickerWrapper);
        break;
      }

      case 'form-builder': {
        const fb = this.createFormBuilderControl(activeEl, field);
        group.appendChild(fb);
        break;
      }

      case 'repeater': {
        const repeaterBox = this.createRepeaterControl(activeEl, field);
        group.appendChild(repeaterBox);
        break;
      }
    }

    return group;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  GOOGLE FORMS-STYLE REGISTRATION FORM BUILDER
  // ─────────────────────────────────────────────────────────────────────────
  createFormBuilderControl(activeEl, field) {
    const FIELD_TYPE_META = {
      text:         { icon: '✏️',  label: 'Short Text' },
      email:        { icon: '📧',  label: 'Email' },
      tel:          { icon: '📞',  label: 'Phone' },
      number:       { icon: '🔢',  label: 'Number' },
      textarea:     { icon: '📄',  label: 'Long Text' },
      select:       { icon: '⬇️',  label: 'Dropdown' },
      image_option: { icon: '🖼️',  label: 'Image Options' },
      checkbox:     { icon: '☑️',  label: 'Checkbox' },
      file:         { icon: '📎',  label: 'File Upload' },
      date:         { icon: '📅',  label: 'Date' },
      caption:      { icon: '💬',  label: 'Caption / Text' },
      hidden:       { icon: '👁️',  label: 'Hidden Field' }
    };

    const save = () => {
      state.saveDraft();
      state.notify('propUpdate');
    };

    const rerender = () => this.render();

    let fields = activeEl.props[field.key];
    if (!Array.isArray(fields)) {
      fields = [];
      activeEl.props[field.key] = fields;
    }

    const wrap = document.createElement('div');
    wrap.className = 'fb-wrap';

    // ── helper: rebuild the entire field list cards ───────────────────────
    const buildFieldList = () => {
      const list = wrap.querySelector('.fb-field-list');
      if (!list) return;
      list.innerHTML = '';

      fields.forEach((f, idx) => {
        const meta = FIELD_TYPE_META[f.type] || { icon: '🔧', label: f.type };

        const card = document.createElement('div');
        card.className = 'fb-card';
        card.setAttribute('data-fb-idx', idx);

        // ── Card Header ──────────────────────────────────────────────
        const hdr = document.createElement('div');
        hdr.className = 'fb-card-header';
        hdr.innerHTML = `
          <div class="fb-card-left">
            <span class="fb-card-icon">${meta.icon}</span>
            <div class="fb-card-meta">
              <span class="fb-card-label">${f.label || '(untitled field)'}</span>
              <span class="fb-card-type">${meta.label}${f.required ? ' · Required' : ''}${f.width === 'half' ? ' · Half' : ''}</span>
            </div>
          </div>
          <div class="fb-card-actions">
            <button type="button" class="fb-btn-ico fb-move-up" title="Move up" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="fb-btn-ico fb-move-down" title="Move down" ${idx === fields.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="fb-btn-ico fb-expand" title="Edit">✎</button>
            <button type="button" class="fb-btn-ico fb-delete" title="Delete" style="color:#f87171">✕</button>
          </div>
        `;

        // ── Card Body (collapsed by default) ─────────────────────────
        const body = document.createElement('div');
        body.className = 'fb-card-body';

        // Helper: update only this card's header text without rebuilding the whole list
        const updateCardHeader = () => {
          const labelSpan = card.querySelector('.fb-card-label');
          const typeSpan  = card.querySelector('.fb-card-type');
          const iconSpan  = card.querySelector('.fb-card-icon');
          const curMeta   = FIELD_TYPE_META[f.type] || { icon: '🔧', label: f.type };
          if (labelSpan) labelSpan.textContent = f.label || '(untitled field)';
          if (typeSpan)  typeSpan.textContent  = `${curMeta.label}${f.required ? ' · Required' : ''}${f.width === 'half' ? ' · Half' : ''}`;
          if (iconSpan)  iconSpan.textContent  = curMeta.icon;
        };

        // Build body controls
        const idInp = this._fbText(f, 'id', 'e.g. full_name', save);
        const onLabelChange = () => {
          updateCardHeader();
          // If ID is missing or was auto-generated (field_...), auto-derive a clean ID from the label
          if (!f.id || /^field_\d+$/i.test(f.id)) {
            const cleanId = (f.label || '').trim().replace(/[^a-zA-Z0-9_]/g, '_');
            if (cleanId) {
              f.id = cleanId;
              idInp.value = cleanId;
              save();
            }
          }
        };
        body.appendChild(this._fbRow('Label / Question', this._fbText(f, 'label', 'e.g. Full Name', save, onLabelChange)));
        body.appendChild(this._fbRow('Field ID (no spaces)', idInp));

        // Type selector – rebuilding body is necessary when type changes
        const typeSelect = document.createElement('select');
        typeSelect.className = 'fb-select';
        Object.entries(FIELD_TYPE_META).forEach(([val, m]) => {
          const o = document.createElement('option');
          o.value = val;
          o.textContent = `${m.icon} ${m.label}`;
          if (f.type === val) o.selected = true;
          typeSelect.appendChild(o);
        });
        typeSelect.addEventListener('change', e => {
          f.type = e.target.value;
          save();
          // Rebuild list but keep this card open
          buildFieldList();
          const newCard = wrap.querySelector(`.fb-field-list [data-fb-idx="${idx}"]`);
          if (newCard) newCard.classList.add('fb-open');
        });
        body.appendChild(this._fbRow('Field Type', typeSelect));

        // Width toggle – update in-place, no rebuild needed
        const widthWrap = document.createElement('div');
        widthWrap.style.cssText = 'display:flex;gap:6px;';
        ['full', 'half'].forEach(w => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = w === 'full' ? '⬛ Full Width' : '▪ Half Width';
          btn.className = 'fb-width-btn' + (f.width === w || (!f.width && w === 'full') ? ' active' : '');
          btn.addEventListener('click', () => {
            f.width = w;
            save();
            // Update active state in-place
            widthWrap.querySelectorAll('.fb-width-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateCardHeader();
          });
          widthWrap.appendChild(btn);
        });
        body.appendChild(this._fbRow('Column Width', widthWrap));

        // Required toggle – update header in-place
        body.appendChild(this._fbRow('Required', this._fbToggle(f, 'required', save, updateCardHeader)));

        // Type-specific controls
        const typ = f.type || 'text';

        if (['text','email','tel','number','date','textarea'].includes(typ)) {
          body.appendChild(this._fbRow('Placeholder Text', this._fbText(f, 'placeholder', 'Hint shown inside field...', save)));
        }

        if (typ === 'select') {
          body.appendChild(this._fbRow('Options (one per line)', this._fbTextarea(f, 'options', 'Option A\nOption B\nOption C', save)));
        }

        if (typ === 'image_option') {
          // Special image options manager
          body.appendChild(this._fbImageOptionsManager(f, save, buildFieldList));
        }

        if (typ === 'file') {
          body.appendChild(this._fbRow('Max File Size (MB)', this._fbNumber(f, 'maxFileSizeMB', '5', save)));
        }

        if (typ === 'caption') {
          body.appendChild(this._fbRow('Display Text / Caption', this._fbTextarea(f, 'captionText', 'Enter text to display...', save)));
          const styleSelect = document.createElement('select');
          styleSelect.className = 'fb-select';
          [['text','Normal Text'],['heading','Section Heading'],['info','Info Box (Blue)'],['warning','Warning Box (Amber)'],['success','Success Box (Green)']].forEach(([v,l]) => {
            const o = document.createElement('option');
            o.value = v; o.textContent = l;
            if ((f.captionStyle || 'text') === v) o.selected = true;
            styleSelect.appendChild(o);
          });
          styleSelect.addEventListener('change', e => { f.captionStyle = e.target.value; save(); });
          body.appendChild(this._fbRow('Box Style', styleSelect));
        }

        card.appendChild(hdr);
        card.appendChild(body);
        list.appendChild(card);

        // ── Toggle collapse ──────────────────────────────────────────
        hdr.querySelector('.fb-expand').addEventListener('click', e => {
          e.stopPropagation();
          card.classList.toggle('fb-open');
        });
        hdr.querySelector('.fb-card-left').addEventListener('click', () => {
          card.classList.toggle('fb-open');
        });

        // ── Move ─────────────────────────────────────────────────────
        hdr.querySelector('.fb-move-up').addEventListener('click', e => {
          e.stopPropagation();
          if (idx === 0) return;
          [fields[idx - 1], fields[idx]] = [fields[idx], fields[idx - 1]];
          save(); buildFieldList();
        });
        hdr.querySelector('.fb-move-down').addEventListener('click', e => {
          e.stopPropagation();
          if (idx >= fields.length - 1) return;
          [fields[idx], fields[idx + 1]] = [fields[idx + 1], fields[idx]];
          save(); buildFieldList();
        });

        // ── Delete ───────────────────────────────────────────────────
        hdr.querySelector('.fb-delete').addEventListener('click', e => {
          e.stopPropagation();
          fields.splice(idx, 1);
          save(); buildFieldList();
        });
      });

      if (fields.length === 0) {
        list.innerHTML = `<div class="fb-empty">📋 No fields yet. Add your first field below.</div>`;
      }
    };

    // ── Field list ────────────────────────────────────────────────────────
    const fieldList = document.createElement('div');
    fieldList.className = 'fb-field-list';
    wrap.appendChild(fieldList);

    // ── Add-Field Footer ─────────────────────────────────────────────────
    const addArea = document.createElement('div');
    addArea.className = 'fb-add-area';
    addArea.innerHTML = `
      <div class="fb-add-label">➕ Add field</div>
      <div class="fb-type-chips"></div>
    `;
    const chipContainer = addArea.querySelector('.fb-type-chips');
    Object.entries(FIELD_TYPE_META).forEach(([type, meta]) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'fb-type-chip';
      chip.innerHTML = `<span>${meta.icon}</span> ${meta.label}`;
      chip.addEventListener('click', () => {
        const newField = {
          id: `field_${Date.now()}`,
          label: meta.label,
          type,
          placeholder: '',
          required: false,
          width: 'full',
          options: type === 'select' ? 'Option A\nOption B' : '',
          captionText: type === 'caption' ? 'Enter your caption here.' : ''
        };
        fields.push(newField);
        save();
        buildFieldList();
        // auto-open the new card
        setTimeout(() => {
          const cards = wrap.querySelectorAll('.fb-card');
          if (cards.length) {
            cards[cards.length - 1].classList.add('fb-open');
            cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 50);
      });
      chipContainer.appendChild(chip);
    });
    wrap.appendChild(addArea);

    buildFieldList();
    return wrap;
  }

  // ── Form Builder Helper Inputs ───────────────────────────────────────────
  _fbRow(labelText, control) {
    const row = document.createElement('div');
    row.className = 'fb-row';
    const lbl = document.createElement('span');
    lbl.className = 'fb-row-label';
    lbl.textContent = labelText;
    row.appendChild(lbl);
    row.appendChild(control);
    return row;
  }

  _fbText(obj, key, ph, save, onChange) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'fb-input';
    inp.value = obj[key] || '';
    inp.placeholder = ph || '';
    inp.addEventListener('input', e => {
      obj[key] = e.target.value;
      save();
      if (onChange) onChange();
    });
    return inp;
  }

  _fbTextarea(obj, key, ph, save) {
    const ta = document.createElement('textarea');
    ta.className = 'fb-input fb-textarea';
    ta.rows = 3;
    ta.value = obj[key] || '';
    ta.placeholder = ph || '';
    ta.addEventListener('input', e => { obj[key] = e.target.value; save(); });
    return ta;
  }

  _fbNumber(obj, key, ph, save) {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'fb-input';
    inp.value = obj[key] !== undefined ? obj[key] : '';
    inp.placeholder = ph || '';
    inp.addEventListener('input', e => { obj[key] = parseFloat(e.target.value) || 0; save(); });
    return inp;
  }

  _fbToggle(obj, key, save, onChange) {
    const wrap = document.createElement('label');
    wrap.className = 'fb-toggle-wrap';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !!obj[key];
    const track = document.createElement('span');
    track.className = 'fb-toggle-track';
    const txt = document.createElement('span');
    txt.className = 'fb-toggle-txt';
    txt.textContent = chk.checked ? 'Yes' : 'No';
    chk.addEventListener('change', e => {
      obj[key] = e.target.checked;
      txt.textContent = e.target.checked ? 'Yes' : 'No';
      save();
      if (onChange) onChange();
    });
    wrap.appendChild(chk);
    wrap.appendChild(track);
    wrap.appendChild(txt);
    return wrap;
  }

  // ── Image Options Manager: per-option label + media-library image picker ──
  _fbImageOptionsManager(f, save, rebuild) {
    if (!Array.isArray(f._imgOptions)) {
      // Parse existing options string "Label|URL" into structured array
      f._imgOptions = (f.options || '').split(/\r?\n/).map(line => {
        const [l, u] = line.split('|').map(s => s.trim());
        return { label: l || '', url: u || '' };
      }).filter(o => o.label || o.url);
      if (f._imgOptions.length === 0) f._imgOptions = [{ label: '', url: '' }];
    }

    const syncOptions = () => {
      f.options = f._imgOptions.map((o, idx) => {
        const lbl = (o.label || '').trim();
        const url = (o.url || '').trim();
        if (!lbl && url) {
          const inferred = url.split('/').pop().replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ') || `Option ${idx + 1}`;
          return `${inferred}|${url}`;
        }
        return url ? `${lbl}|${url}` : lbl;
      }).filter(Boolean).join('\n');
      save();
    };

    const section = document.createElement('div');
    section.className = 'fb-imgopt-section';

    const header = document.createElement('div');
    header.className = 'fb-row-label';
    header.textContent = 'Image Options';
    section.appendChild(header);

    const optList = document.createElement('div');
    optList.className = 'fb-imgopt-list';

    const renderOptList = () => {
      optList.innerHTML = '';
      f._imgOptions.forEach((opt, i) => {
        const row = document.createElement('div');
        row.className = 'fb-imgopt-row';

        // Preview thumb
        const thumb = document.createElement('div');
        thumb.className = 'fb-imgopt-thumb';
        if (opt.url) {
          thumb.style.backgroundImage = `url('${opt.url}')`;
          thumb.classList.add('has-img');
        } else {
          thumb.innerHTML = '🖼️';
        }

        // Label input
        const labelInp = document.createElement('input');
        labelInp.type = 'text';
        labelInp.className = 'fb-input fb-imgopt-label-inp';
        labelInp.value = opt.label;
        labelInp.placeholder = `Option ${i + 1} label`;
        labelInp.addEventListener('input', e => {
          opt.label = e.target.value;
          syncOptions();
        });

        // Pick image button
        const pickBtn = document.createElement('button');
        pickBtn.type = 'button';
        pickBtn.className = 'fb-imgopt-pick';
        pickBtn.title = opt.url ? 'Change image' : 'Pick image from library';
        pickBtn.innerHTML = opt.url ? '🔄' : '🖼️';
        pickBtn.addEventListener('click', () => {
          if (typeof window.openMediaLibrary === 'function') {
            window.openMediaLibrary(url => {
              opt.url = url;
              if (!opt.label) {
                opt.label = url.split('/').pop().replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ') || `Option ${i + 1}`;
              }
              syncOptions();
              renderOptList();
            });
          }
        });

        // Clear image button
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'fb-imgopt-clear';
        clearBtn.title = 'Remove image';
        clearBtn.textContent = '✕';
        clearBtn.style.display = opt.url ? 'inline-flex' : 'none';
        clearBtn.addEventListener('click', () => {
          opt.url = '';
          syncOptions();
          renderOptList();
        });

        // Delete option row
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'fb-imgopt-del';
        delBtn.title = 'Delete option';
        delBtn.textContent = '🗑';
        delBtn.addEventListener('click', () => {
          f._imgOptions.splice(i, 1);
          syncOptions();
          renderOptList();
        });

        row.appendChild(thumb);
        row.appendChild(labelInp);
        row.appendChild(pickBtn);
        row.appendChild(clearBtn);
        row.appendChild(delBtn);
        optList.appendChild(row);
      });
    };

    // ── Image Shape selector ───────────────────────────────────────
    const shapeRow = document.createElement('div');
    shapeRow.className = 'fb-row';
    shapeRow.style.cssText = 'margin-top:8px;';
    shapeRow.innerHTML = `<span class="fb-row-label" style="min-width:110px;">Image Shape</span>`;
    const shapeSelect = document.createElement('select');
    shapeSelect.className = 'fb-select';
    [['fit','Fit / Natural (Max Image Priority)'],['landscape','Landscape (16:9)'],['banner','Banner / Card (3:1)'],['wide','Wide (4:3)'],['square','Square (1:1)'],['portrait','Portrait (3:4)']].forEach(([v,l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      if ((f.imageShape || (f.listLayout === 'vertical' ? 'fit' : 'square')) === v) o.selected = true;
      shapeSelect.appendChild(o);
    });
    shapeSelect.addEventListener('change', e => { f.imageShape = e.target.value; save(); });
    shapeRow.appendChild(shapeSelect);
    section.appendChild(shapeRow);

    // ── List Layout selector ────────────────────────────────────────
    const layoutRow = document.createElement('div');
    layoutRow.className = 'fb-row';
    layoutRow.style.cssText = 'margin-top:6px;';
    layoutRow.innerHTML = `<span class="fb-row-label" style="min-width:110px;">List Layout</span>`;
    const layoutSelect = document.createElement('select');
    layoutSelect.className = 'fb-select';
    [['horizontal','Horizontal (cards side by side)'],['vertical','Vertical (stacked rows)']].forEach(([v,l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      if ((f.listLayout || 'horizontal') === v) o.selected = true;
      layoutSelect.appendChild(o);
    });
    layoutSelect.addEventListener('change', e => { f.listLayout = e.target.value; save(); });
    layoutRow.appendChild(layoutSelect);
    section.appendChild(layoutRow);

    renderOptList();
    section.appendChild(optList);

    const addOptBtn = document.createElement('button');
    addOptBtn.type = 'button';
    addOptBtn.className = 'fb-imgopt-add';
    addOptBtn.innerHTML = '+ Add Option';
    addOptBtn.addEventListener('click', () => {
      f._imgOptions.push({ label: '', url: '' });
      syncOptions();
      renderOptList();
    });
    section.appendChild(addOptBtn);

    return section;
  }

  // Repeater controls for dynamic arrays (e.g. slides, gallery images, counter stats, lecturers)
  createRepeaterControl(activeEl, field) {
    const container = document.createElement('div');
    container.className = 'repeater-container';

    let items = activeEl.props[field.key];
    if (!Array.isArray(items)) {
      items = [];
      activeEl.props[field.key] = items;
    }

    // ── Safe normalization: converts legacy strings to objects, ensures children array ──
    items.forEach((item, idx) => {
      if (typeof item === 'string') {
        items[idx] = { label: item, url: '#', link: '#', children: [] };
      } else if (item && typeof item === 'object') {
        if (!item.url && item.link) item.url = item.link;
        if (!item.link && item.url) item.link = item.url;
        if (!Array.isArray(item.children)) item.children = [];
      }
    });

    const rawNoun = field.label ? field.label.replace(/^[^ws]+/, '').trim() : 'Items';

    // Sticky Search & Filter Header
    const searchBar = document.createElement('div');
    searchBar.className = 'repeater-search-bar';

    const searchWrap = document.createElement('div');
    searchWrap.className = 'repeater-search-input-wrap';

    const searchIcon = document.createElement('span');
    searchIcon.className = 'repeater-search-icon';
    searchIcon.textContent = '🔍';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'repeater-search-input';
    searchInput.placeholder = `Filter ${rawNoun.toLowerCase()}...`;

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'repeater-search-clear';
    clearBtn.textContent = '✕';
    clearBtn.title = 'Clear filter';
    clearBtn.style.display = 'none';

    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(searchInput);
    searchWrap.appendChild(clearBtn);

    const metaRow = document.createElement('div');
    metaRow.className = 'repeater-search-meta';

    const countPill = document.createElement('span');
    countPill.className = 'repeater-search-count';
    countPill.textContent = `${items.length} ${rawNoun.toLowerCase()}`;

    const toggleCollapseBtn = document.createElement('button');
    toggleCollapseBtn.type = 'button';
    toggleCollapseBtn.className = 'repeater-toggle-all-btn';
    toggleCollapseBtn.textContent = '↕ Collapse All';

    metaRow.appendChild(countPill);
    metaRow.appendChild(toggleCollapseBtn);

    searchBar.appendChild(searchWrap);
    searchBar.appendChild(metaRow);
    container.appendChild(searchBar);

    if (items.length === 0) {
      searchBar.style.display = 'none';
    }

    const itemsWrapper = document.createElement('div');
    itemsWrapper.className = 'repeater-items-wrapper';
    container.appendChild(itemsWrapper);

    const emptySearchMsg = document.createElement('div');
    emptySearchMsg.className = 'repeater-search-empty';
    emptySearchMsg.style.display = 'none';
    emptySearchMsg.textContent = `No matching ${rawNoun.toLowerCase()}.`;
    container.appendChild(emptySearchMsg);

    // Resolved field definitions for each row
    let resolvedFields = field.fields;
    if (!resolvedFields || resolvedFields.length === 0) {
      resolvedFields = [
        { key: 'label', label: 'Link Label', type: 'text' },
        { key: 'url', label: 'Target Page / URL', type: 'page-link' },
        { key: 'children', label: 'Dropdown Submenu Items', type: 'repeater' }
      ];
    }

    items.forEach((item, idx) => {
      try {
        const itemCard = document.createElement('div');
        itemCard.className = 'repeater-item';
        itemCard.setAttribute('data-repeater-idx', idx);

        const itemHeader = document.createElement('div');
        itemHeader.className = 'repeater-item-header';
        itemHeader.style.cursor = 'pointer';

        const initialTitle = `#${idx + 1} ${item.label || item.name || item.title || item.topic || 'Item'}`;
        itemHeader.innerHTML = `
          <div class="repeater-item-header-title">
            <span class="repeater-chevron">▾</span>
            <span class="repeater-title-text">${initialTitle}</span>
          </div>
          <div class="repeater-item-header-actions">
            <button type="button" class="repeater-remove-btn" title="Remove Item">✕</button>
          </div>
        `;

        itemHeader.addEventListener('click', (e) => {
          if (e.target.closest('.repeater-remove-btn')) return;
          const isCollapsed = itemCard.classList.toggle('is-collapsed');
          const chev = itemCard.querySelector('.repeater-chevron');
          if (chev) chev.textContent = isCollapsed ? '▸' : '▾';
        });

        itemHeader.querySelector('.repeater-remove-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          items.splice(idx, 1);
          state.saveDraft();
          state.notify('propUpdate');
          this.render();
        });

        itemCard.appendChild(itemHeader);

        const itemBody = document.createElement('div');
        itemBody.className = 'repeater-item-body';

        const updateHeader = () => {
          const titleSpan = itemCard.querySelector('.repeater-title-text');
          if (titleSpan) {
            titleSpan.textContent = `#${idx + 1} ${item.label || item.name || item.title || item.topic || 'Item'}`;
          }
        };

        resolvedFields.forEach((subField) => {
          const subGroup = document.createElement('div');
          subGroup.style.display = 'flex';
          subGroup.style.flexDirection = 'column';
          subGroup.style.gap = '4px';

          const subLabel = document.createElement('span');
          subLabel.style.fontSize = '0.75rem';
          subLabel.style.color = 'var(--text-dim)';
          subLabel.textContent = subField.label || subField.key;
          subGroup.appendChild(subLabel);

          // ── NESTED SUBMENU BUILDER (Repeater inside Repeater) ──
          if (subField.type === 'repeater' || subField.key === 'children' || subField.key === 'subItems') {
            const nestedKey = subField.key;
            if (!Array.isArray(item[nestedKey])) item[nestedKey] = [];
            const nestedItems = item[nestedKey];

            const nestedWrap = document.createElement('div');
            nestedWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:6px 0;';

            const renderNestedItems = () => {
              nestedWrap.innerHTML = '';

              if (nestedItems.length === 0) {
                const emptyHint = document.createElement('div');
                emptyHint.style.cssText = 'font-size:0.72rem;color:var(--text-dim);font-style:italic;padding:2px 0;';
                emptyHint.textContent = 'No submenu items yet.';
                nestedWrap.appendChild(emptyHint);
              }

              nestedItems.forEach((sub, si) => {
                if (typeof sub === 'string') {
                  nestedItems[si] = { label: sub, url: '#', link: '#' };
                  sub = nestedItems[si];
                }

                const row = document.createElement('div');
                row.style.cssText = 'display:flex;flex-direction:column;gap:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:6px 8px;';

                const rowHeader = document.createElement('div');
                rowHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';

                const rowIdx = document.createElement('span');
                rowIdx.style.cssText = 'font-size:0.7rem;font-weight:700;color:var(--primary-light,#a5b4fc);';
                rowIdx.textContent = `↳ Sub-item #${si + 1}`;

                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.textContent = '✕ Remove';
                delBtn.style.cssText = 'background:transparent;border:none;color:#ef4444;cursor:pointer;font-size:0.7rem;padding:2px 4px;';
                delBtn.addEventListener('click', () => {
                  nestedItems.splice(si, 1);
                  state.saveDraft();
                  state.notify('propUpdate');
                  renderNestedItems();
                });

                rowHeader.appendChild(rowIdx);
                rowHeader.appendChild(delBtn);
                row.appendChild(rowHeader);

                // Label Input
                const labelIn = document.createElement('input');
                labelIn.type = 'text';
                labelIn.value = sub.label || '';
                labelIn.placeholder = 'Submenu Label (e.g. About Us)';
                labelIn.style.cssText = 'font-size:0.78rem;padding:4px 8px;border-radius:4px;background:var(--bg-deep,#0d1525);border:1px solid var(--border-subtle,rgba(255,255,255,0.1));color:var(--text-main,#fff);';
                labelIn.addEventListener('input', (e) => {
                  sub.label = e.target.value;
                  state.saveDraft();
                  state.notify('propUpdate');
                });
                row.appendChild(labelIn);

                // Page Selector Dropdown + Target URL Input
                const urlRow = document.createElement('div');
                urlRow.style.cssText = 'display:flex;gap:4px;align-items:center;';

                const pageSel = document.createElement('select');
                pageSel.style.cssText = 'font-size:0.75rem;padding:4px 6px;border-radius:4px;background:var(--bg-deep,#0d1525);border:1px solid var(--border-subtle,rgba(255,255,255,0.1));color:var(--text-main,#fff);flex:1;max-width:140px;';
                const dOpt = document.createElement('option');
                dOpt.value = '';
                dOpt.textContent = '📄 Select Page...';
                pageSel.appendChild(dOpt);

                (state.pages || []).forEach((p) => {
                  const o = document.createElement('option');
                  const tUrl = p.slug === 'index' ? 'index.html' : `?page=${p.slug}`;
                  o.value = tUrl;
                  o.textContent = `📄 ${p.title}`;
                  if ((sub.url || sub.link) === tUrl) o.selected = true;
                  pageSel.appendChild(o);
                });

                const urlIn = document.createElement('input');
                urlIn.type = 'text';
                urlIn.value = sub.url || sub.link || '';
                urlIn.placeholder = 'URL or #anchor';
                urlIn.style.cssText = 'font-size:0.75rem;padding:4px 6px;border-radius:4px;background:var(--bg-deep,#0d1525);border:1px solid var(--border-subtle,rgba(255,255,255,0.1));color:var(--text-main,#fff);flex:1;';

                pageSel.addEventListener('change', (e) => {
                  if (e.target.value) {
                    urlIn.value = e.target.value;
                    sub.url = e.target.value;
                    sub.link = e.target.value;
                    state.saveDraft();
                    state.notify('propUpdate');
                  }
                });

                urlIn.addEventListener('input', (e) => {
                  sub.url = e.target.value;
                  sub.link = e.target.value;
                  state.saveDraft();
                  state.notify('propUpdate');
                });

                urlRow.appendChild(pageSel);
                urlRow.appendChild(urlIn);
                row.appendChild(urlRow);

                nestedWrap.appendChild(row);
              });

              const addSubBtn = document.createElement('button');
              addSubBtn.type = 'button';
              addSubBtn.textContent = '+ Add Submenu Item';
              addSubBtn.style.cssText = 'font-size:0.74rem;font-weight:600;padding:5px 10px;border-radius:6px;background:rgba(99,102,241,0.15);border:1px dashed rgba(99,102,241,0.5);color:#c7d2fe;cursor:pointer;text-align:center;transition:all 0.15s ease;margin-top:2px;';
              addSubBtn.addEventListener('click', () => {
                nestedItems.push({ label: 'New Sublink', url: '#', link: '#' });
                state.saveDraft();
                state.notify('propUpdate');
                renderNestedItems();
              });
              nestedWrap.appendChild(addSubBtn);
            };

            renderNestedItems();
            subGroup.appendChild(nestedWrap);

          // ── PAGE LINK SELECTOR (Main Items) ──
          } else if (subField.type === 'page-link' || subField.key === 'url' || subField.key === 'link') {
            const linkWrapper = document.createElement('div');
            linkWrapper.style.display = 'flex';
            linkWrapper.style.flexDirection = 'column';
            linkWrapper.style.gap = '4px';

            const pageSelect = document.createElement('select');
            pageSelect.style.fontSize = '0.78rem';
            pageSelect.style.padding = '4px 6px';

            const defOpt = document.createElement('option');
            defOpt.value = '';
            defOpt.textContent = '📄 Select Created Page...';
            pageSelect.appendChild(defOpt);

            (state.pages || []).forEach((p) => {
              const opt = document.createElement('option');
              const targetUrl = p.slug === 'index' ? 'index.html' : `?page=${p.slug}`;
              opt.value = targetUrl;
              opt.textContent = `📄 ${p.title} (${p.slug === 'index' ? 'Home' : `?page=${p.slug}`})`;
              if ((item[subField.key] || item.url || item.link) === targetUrl) opt.selected = true;
              pageSelect.appendChild(opt);
            });

            const subInput = document.createElement('input');
            subInput.type = 'text';
            subInput.value = item[subField.key] !== undefined ? item[subField.key] : (item.url || item.link || '');
            subInput.placeholder = 'URL, #anchor or ?page=slug...';
            subInput.style.fontSize = '0.8rem';
            subInput.style.padding = '5px 8px';

            pageSelect.addEventListener('change', (e) => {
              if (e.target.value) {
                subInput.value = e.target.value;
                item[subField.key] = e.target.value;
                item.url = e.target.value;
                item.link = e.target.value;
                state.saveDraft();
                state.notify('propUpdate');
              }
            });

            subInput.addEventListener('input', (e) => {
              item[subField.key] = e.target.value;
              item.url = e.target.value;
              item.link = e.target.value;
              state.saveDraft();
              state.notify('propUpdate');
            });

            linkWrapper.appendChild(pageSelect);
            linkWrapper.appendChild(subInput);
            subGroup.appendChild(linkWrapper);

          // ── IMAGE PICKER ──
          } else if (subField.type === 'image-picker') {
            const miniWrapper = document.createElement('div');
            miniWrapper.style.display = 'flex';
            miniWrapper.style.gap = '6px';
            miniWrapper.style.alignItems = 'center';

            const miniInput = document.createElement('input');
            miniInput.type = 'text';
            miniInput.value = item[subField.key] !== undefined ? item[subField.key] : '';
            miniInput.placeholder = 'URL or pick...';
            miniInput.style.fontSize = '0.8rem';
            miniInput.style.padding = '5px 8px';
            miniInput.style.flex = '1';
            miniInput.addEventListener('input', (e) => {
              item[subField.key] = e.target.value;
              state.saveDraft();
              state.notify('propUpdate');
            });

            const miniBtn = document.createElement('button');
            miniBtn.type = 'button';
            miniBtn.textContent = '🖼️';
            miniBtn.title = 'Open Media Library';
            miniBtn.style.cssText = 'padding:4px 8px;font-size:0.9rem;border-radius:6px;background:var(--bg-elevated);border:1px solid var(--border-subtle);cursor:pointer;color:var(--text-main);';
            miniBtn.addEventListener('click', () => {
              if (typeof window.openMediaLibrary === 'function') {
                window.openMediaLibrary((url) => {
                  miniInput.value = url;
                  item[subField.key] = url;
                  state.saveDraft();
                  state.notify('propUpdate');
                });
              }
            });

            miniWrapper.appendChild(miniInput);
            miniWrapper.appendChild(miniBtn);
            subGroup.appendChild(miniWrapper);

          // ── SELECT DROPDOWN ──
          } else if (subField.type === 'select') {
            const subSelect = document.createElement('select');
            subSelect.style.fontSize = '0.82rem';
            subSelect.style.padding = '6px 8px';
            (subField.options || []).forEach(opt => {
              const optEl = document.createElement('option');
              const val = typeof opt === 'string' ? opt : opt.value;
              const lbl = typeof opt === 'string' ? opt : opt.label;
              optEl.value = val;
              optEl.textContent = lbl;
              if (String(item[subField.key]) === String(val)) optEl.selected = true;
              subSelect.appendChild(optEl);
            });
            subSelect.addEventListener('change', (e) => {
              item[subField.key] = e.target.value;
              updateHeader();
              state.saveDraft();
              state.notify('propUpdate');
            });
            subGroup.appendChild(subSelect);

          // ── TOGGLE ──
          } else if (subField.type === 'toggle' || subField.type === 'checkbox') {
            const lbl = document.createElement('label');
            lbl.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--text-main);cursor:pointer;';
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = !!item[subField.key];
            const span = document.createElement('span');
            span.textContent = item[subField.key] ? 'Enabled' : 'Disabled';
            chk.addEventListener('change', (e) => {
              item[subField.key] = e.target.checked;
              span.textContent = e.target.checked ? 'Enabled' : 'Disabled';
              state.saveDraft();
              state.notify('propUpdate');
            });
            lbl.appendChild(chk);
            lbl.appendChild(span);
            subGroup.appendChild(lbl);

          // ── DEFAULT TEXT / NUMBER ──
          } else {
            const isNum = subField.type === 'number';
            const subInput = document.createElement(subField.type === 'textarea' ? 'textarea' : 'input');
            if (subField.type === 'textarea') subInput.rows = 2;
            if (isNum) subInput.type = 'number';
            subInput.value = item[subField.key] !== undefined ? item[subField.key] : '';
            subInput.placeholder = subField.label || subField.key;
            subInput.style.fontSize = '0.82rem';
            subInput.style.padding = '6px 8px';

            subInput.addEventListener('input', (e) => {
              item[subField.key] = isNum ? (parseFloat(e.target.value) || 0) : e.target.value;
              updateHeader();
              state.saveDraft();
              state.notify('propUpdate');
            });

            subGroup.appendChild(subInput);
          }

          itemBody.appendChild(subGroup);
        });

        itemCard.appendChild(itemBody);
        itemsWrapper.appendChild(itemCard);
      } catch (itemErr) {
        console.warn('[Inspector] Error rendering repeater item:', itemErr);
      }
    });

    // Realtime search filter
    const doFilter = () => {
      const q = searchInput.value.toLowerCase().trim();
      clearBtn.style.display = q ? 'block' : 'none';
      let visibleCount = 0;

      itemsWrapper.querySelectorAll('.repeater-item').forEach((card) => {
        const cardIdx = parseInt(card.getAttribute('data-repeater-idx'), 10);
        const curItem = items[cardIdx];
        if (!curItem) return;

        let matched = !q;
        if (q) {
          matched = Object.values(curItem).some((val) =>
            typeof val === 'string' && val.toLowerCase().includes(q)
          );
        }

        if (matched) {
          card.style.display = 'flex';
          visibleCount++;
          if (q) {
            card.classList.remove('is-collapsed');
            const chev = card.querySelector('.repeater-chevron');
            if (chev) chev.textContent = '▾';
          }
        } else {
          card.style.display = 'none';
        }
      });

      emptySearchMsg.style.display = (visibleCount === 0 && items.length > 0) ? 'block' : 'none';
      countPill.textContent = q ? `Showing ${visibleCount} of ${items.length}` : `${items.length} ${rawNoun.toLowerCase()}`;
    };

    searchInput.addEventListener('input', doFilter);
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      doFilter();
      searchInput.focus();
    });

    let allCollapsed = false;
    toggleCollapseBtn.addEventListener('click', () => {
      allCollapsed = !allCollapsed;
      itemsWrapper.querySelectorAll('.repeater-item').forEach((card) => {
        card.classList.toggle('is-collapsed', allCollapsed);
        const chev = card.querySelector('.repeater-chevron');
        if (chev) chev.textContent = allCollapsed ? '▸' : '▾';
      });
      toggleCollapseBtn.textContent = allCollapsed ? '↕ Expand All' : '↕ Collapse All';
    });

    // Add Item Button (Always visible!)
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'repeater-add-btn';
    addBtn.innerHTML = `<span>+ Add ${field.addLabel || (field.label ? field.label.replace(/ & Dropdowns$/, '').replace(/s$/, '') : 'Item')}</span>`;
    addBtn.addEventListener('click', () => {
      const newItem = {
        label: 'New Link',
        url: '#',
        link: '#',
        children: []
      };
      items.push(newItem);
      state.saveDraft();
      state.notify('propUpdate');
      this.render();
    });

    container.appendChild(addBtn);
    return container;
  }
}
