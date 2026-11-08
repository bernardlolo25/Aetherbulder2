/**
 * AETHERBUILDER - FREE TEMPLATE STORE & DEPENDENCY RESOLVER
 * ============================================================================
 * Manages the Free Template Store and auto-detects required add-on dependencies.
 * All templates in the Template Store are 100% FREE.
 *
 * Each template explicitly tracks and displays its required add-ons so that users
 * never get broken pages. 1-Click auto-install provides seamless rendering.
 */

import { state } from './state.js';
import { addonManager } from './addons.js';
import { addonStore } from './addon-store.js';
import { WIDGET_REGISTRY } from './widgets.js';
import { TEMPLATES } from './templates.js';

export class TemplateStore {
  constructor() {
    this.templates = [];
    this.isInitialized = false;
    this.activeFilter = 'all';
    this.searchQuery = '';
  }

  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Try loading from server data/templates.json
    let serverTemplates = null;
    try {
      const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';
      const res = await fetch(`${apiBase}?action=get_templates&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          serverTemplates = data;
        }
      }
    } catch {}

    // 2. Try localStorage cache
    if (!serverTemplates) {
      try {
        const raw = localStorage.getItem('aether_template_store');
        if (raw) serverTemplates = JSON.parse(raw);
      } catch {}
    }

    if (Array.isArray(serverTemplates) && serverTemplates.length > 0) {
      this.templates = serverTemplates;
    } else {
      // 3. Fallback: Seed from built-in templates
      this.templates = this.getSeedTemplates();
      this.save(true);
    }
  }

  getSeedTemplates() {
    return [
      {
        id: 'legal_conference_summit',
        name: 'MCLE National Convention & Summit',
        category: 'Legal & Summit',
        thumbnail: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80',
        description: 'Comprehensive legal conference portal featuring keynote banners, seminar syllabus store, delegate booking calendar, and real-time FAQ accordion.',
        price: 0,
        requiredAddons: [
          'addon_ecommerce_grid',
          'addon_interactive_faq_accordion',
          'addon_appointment_calendar'
        ],
        sections: [] // Populated when loaded or seeded
      },
      {
        id: 'ecommerce_law_store',
        name: 'Legal Bookstore & MCLE Modules Store',
        category: 'E-Commerce',
        thumbnail: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
        description: 'Clean, high-converting product storefront layout featuring shopping cart drawer, merchandise badges, and instant checkout trigger.',
        price: 0,
        requiredAddons: ['addon_ecommerce_grid'],
        sections: []
      },
      {
        id: 'admin_mcle_portal',
        name: 'Faculty Access & Argon2 Login Portal',
        category: 'Security & Portal',
        thumbnail: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
        description: 'Secure portal landing page integrated with WebAssembly Argon2id cryptographic password authentication.',
        price: 0,
        requiredAddons: ['addon_admin_login_gate'],
        sections: []
      },
      {
        id: 'legal_podcast_briefing',
        name: 'Legal Insights Audio & Lecture Bar',
        category: 'Media & Audio',
        thumbnail: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80',
        description: 'Broadcast lecture episodes and jurisprudence audio briefings with streaming player and speaker credentials.',
        price: 0,
        requiredAddons: ['addon_audio_podcast_player'],
        sections: []
      },
      {
        id: 'consultation_booking_hub',
        name: 'Consultation & Seminar Booking Hub',
        category: 'Booking & Schedule',
        thumbnail: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80',
        description: 'Interactive appointment calendar with slot picker, morning/afternoon schedules, and searchable FAQ accordions.',
        price: 0,
        requiredAddons: ['addon_appointment_calendar', 'addon_interactive_faq_accordion'],
        sections: []
      },
      {
        id: 'saas',
        name: 'SaaS Launchpad Pro',
        category: 'Startup & Tech',
        thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80',
        description: 'High-converting technology landing page with animated stats, feature carousel, and pricing table.',
        price: 0,
        requiredAddons: [],
        sections: (TEMPLATES.saas && TEMPLATES.saas.sections) ? TEMPLATES.saas.sections : []
      },
      {
        id: 'portfolio',
        name: 'Creative Studio & Portfolio',
        category: 'Portfolio',
        thumbnail: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=600&q=80',
        description: 'Sleek dark portfolio featuring visual gallery, interactive lightbox, and animated credentials.',
        price: 0,
        requiredAddons: [],
        sections: (TEMPLATES.portfolio && TEMPLATES.portfolio.sections) ? TEMPLATES.portfolio.sections : []
      }
    ];
  }

  /**
   * Scans an array of sections and automatically returns an array of unique addon IDs.
   */
  detectRequiredAddons(sections = []) {
    const required = new Set();
    sections.forEach(s => {
      const wType = s.widgetType || '';
      if (wType.startsWith('addon_')) {
        required.add(wType);
      } else {
        const wDef = WIDGET_REGISTRY[wType];
        if (wDef && wDef.isAddon && wDef.addonId) {
          required.add(wDef.addonId);
        }
      }
    });
    return Array.from(required);
  }

  /**
   * Resolves detailed info for each required addon (name, icon, installation status).
   */
  getRequiredAddonsDetails(addonIds = []) {
    const installedIds = (addonManager.addons || []).map(a => a.id);
    const catalog = addonStore.catalog || [];

    return addonIds.map(id => {
      const catalogItem = catalog.find(c => c.id === id);
      const isInstalled = installedIds.includes(id);
      return {
        id: id,
        name: catalogItem ? catalogItem.name : (id.replace(/^addon_/, '').replace(/_/g, ' ')),
        icon: catalogItem ? catalogItem.icon : '🧩',
        isInstalled: isInstalled,
        isFree: catalogItem ? catalogItem.price === 0 : true,
        priceLabel: catalogItem ? catalogItem.priceLabel : 'FREE',
        catalogItem: catalogItem
      };
    });
  }

  async save(syncServer = true) {
    try {
      localStorage.setItem('aether_template_store', JSON.stringify(this.templates));
    } catch {}

    if (syncServer) {
      try {
        const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';
        await fetch(`${apiBase}?action=save_templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.templates)
        });
      } catch {}
    }
  }

  addTemplate(tmpl) {
    if (!tmpl.id) tmpl.id = 'tmpl_' + Date.now();
    if (!tmpl.requiredAddons) tmpl.requiredAddons = this.detectRequiredAddons(tmpl.sections || []);
    tmpl.price = 0; // Guaranteed free
    this.templates.unshift(tmpl);
    this.save(true);
    return tmpl;
  }

  updateTemplate(id, updatedFields) {
    const idx = this.templates.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.templates[idx] = { ...this.templates[idx], ...updatedFields };
      if (updatedFields.sections) {
        this.templates[idx].requiredAddons = this.detectRequiredAddons(updatedFields.sections);
      }
      this.save(true);
      return this.templates[idx];
    }
    return null;
  }

  deleteTemplate(id) {
    this.templates = this.templates.filter(t => t.id !== id);
    this.save(true);
  }

  /**
   * Loads template sections into state with auto-installation of required add-ons.
   */
  async applyTemplate(templateId, options = {}) {
    let tmpl = this.templates.find(t => t.id === templateId);
    if (!tmpl && TEMPLATES[templateId]) {
      tmpl = TEMPLATES[templateId];
    }
    if (!tmpl) throw new Error('Template not found.');

    // Auto-install missing required add-ons if requested
    const requiredDetails = this.getRequiredAddonsDetails(tmpl.requiredAddons || []);
    const missing = requiredDetails.filter(d => !d.isInstalled);

    if (missing.length > 0 && options.autoInstall !== false) {
      for (const item of missing) {
        if (item.catalogItem) {
          try {
            addonManager.installAddon(item.catalogItem);
          } catch (e) {
            console.warn(`[TemplateStore] Auto-install failed for ${item.id}:`, e);
          }
        }
      }
    }

    // Apply sections to canvas/state
    if (tmpl.sections && tmpl.sections.length > 0) {
      state.loadSections(JSON.parse(JSON.stringify(tmpl.sections)));
    } else if (TEMPLATES[tmpl.id] && TEMPLATES[tmpl.id].sections) {
      state.loadSections(JSON.parse(JSON.stringify(TEMPLATES[tmpl.id].sections)));
    }

    if (window.aetherApp && window.aetherApp.canvas) {
      window.aetherApp.canvas.render();
      window.aetherApp.canvas.showToast(`✨ Template "${tmpl.name}" successfully loaded!`, 'success');
    }

    return { success: true, installedAddons: missing.map(m => m.name) };
  }

  /**
   * Opens the User-Facing Free Template Store Modal
   */
  openStoreModal(onLoadCallback) {
    let modal = document.getElementById('aether-template-store-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'aether-template-store-modal';
    modal.className = 'aether-modal-overlay';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 10001;
      background: rgba(4, 7, 16, 0.88); backdrop-filter: blur(14px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px; font-family: 'Inter', system-ui, sans-serif;
    `;

    modal.innerHTML = `
      <div class="template-store-modal-container" style="
        width: 100%; max-width: 1140px; height: min(88vh, 840px); min-height: 520px;
        background: #0b0f19; border: 1px solid rgba(255,255,255,0.12);
        border-radius: 18px; display: flex; flex-direction: column;
        box-shadow: 0 25px 60px -15px rgba(0,0,0,0.85), 0 0 35px rgba(16,185,129,0.18);
        overflow: hidden; animation: storeModalIn 0.22s ease-out; position: relative;
      ">
        <!-- 1. Header -->
        <div style="padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; background: rgba(15,23,42,0.6); flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg,#10b981,#059669); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; box-shadow: 0 8px 18px rgba(16,185,129,0.35); flex-shrink: 0;">📋</div>
            <div>
              <div style="display:flex;align-items:center;gap:8px;">
                <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #ffffff;">Free Template Store</h2>
                <span style="font-size: 0.68rem; font-weight: 800; background: rgba(16,185,129,0.2); color: #6ee7b7; padding: 2px 8px; border-radius: 10px; border: 1px solid rgba(16,185,129,0.4);">100% Free Library</span>
              </div>
              <p style="margin: 3px 0 0 0; font-size: 0.8rem; color: #94a3b8;">Pre-built full-page templates with automatic required add-on detection &amp; 1-click loading.</p>
            </div>
          </div>
          <button type="button" id="btn-close-template-modal" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); color: #ffffff; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1rem; transition: all 0.2s;" title="Close Library">✕</button>
        </div>

        <!-- 2. Categories & Search Toolbar -->
        <div style="padding: 12px 24px; background: rgba(15,23,42,0.4); border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; flex-shrink: 0;">
          <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="tmpl-category-tabs">
            <button type="button" class="store-filter-pill active" data-filter="all">All (${this.templates.length})</button>
            <button type="button" class="store-filter-pill" data-filter="Legal & Summit">⚖️ Legal &amp; Summit</button>
            <button type="button" class="store-filter-pill" data-filter="E-Commerce">🛍️ E-Commerce</button>
            <button type="button" class="store-filter-pill" data-filter="Booking & Schedule">📅 Booking</button>
            <button type="button" class="store-filter-pill" data-filter="Security & Portal">🛡️ Portals</button>
            <button type="button" class="store-filter-pill" data-filter="Media & Audio">🎙️ Media</button>
          </div>

          <div style="position: relative; min-width: 200px; max-width: 260px; flex: 1;">
            <span style="position: absolute; left: 11px; top: 8px; color: #94a3b8; font-size: 0.85rem; pointer-events: none;">🔍</span>
            <input type="text" id="tmpl-search-input" placeholder="Search templates..." style="width: 100%; padding: 7px 12px 7px 32px; background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; color: #ffffff; font-size: 0.8rem; outline: none;" />
          </div>
        </div>

        <!-- 3. Templates Grid -->
        <div id="tmpl-cards-container" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 22px 24px 32px 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 18px; align-content: start;">
          <!-- Dynamically populated -->
        </div>

        <!-- Bottom scroll soft shadow -->
        <div style="height: 16px; margin-top: -16px; background: linear-gradient(to bottom, transparent, rgba(15,23,42,0.92)); pointer-events: none; z-index: 4; flex-shrink: 0;"></div>

        <!-- 4. Footer Tip -->
        <div style="padding: 12px 24px; background: rgba(15,23,42,0.95); border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; font-size: 0.76rem; color: #94a3b8; flex-shrink: 0;">
          <div>💡 <strong>All Templates Free:</strong> Loading a template automatically verifies and prompts for any required add-ons.</div>
          <div style="color: #64748b; font-size: 0.72rem;">Scroll for more templates ↕</div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btn-close-template-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Category Tabs
    modal.querySelectorAll('.store-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.store-filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter;
        this.renderTemplateCards(modal, onLoadCallback);
      });
    });

    // Search
    const searchInput = modal.querySelector('#tmpl-search-input');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = (e.target.value || '').toLowerCase().trim();
      this.renderTemplateCards(modal, onLoadCallback);
    });

    this.renderTemplateCards(modal, onLoadCallback);
  }

  renderTemplateCards(modal, onLoadCallback) {
    const container = modal.querySelector('#tmpl-cards-container');
    if (!container) return;

    let items = this.templates.filter(item => {
      if (this.activeFilter !== 'all' && item.category !== this.activeFilter) return false;
      if (this.searchQuery) {
        const matchName = (item.name || '').toLowerCase().includes(this.searchQuery);
        const matchDesc = (item.description || '').toLowerCase().includes(this.searchQuery);
        const matchCat  = (item.category || '').toLowerCase().includes(this.searchQuery);
        return matchName || matchDesc || matchCat;
      }
      return true;
    });

    if (items.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #94a3b8;">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">🔍</div>
          <div style="font-size: 1.1rem; font-weight: 700; color: #ffffff; margin-bottom: 4px;">No Templates Found</div>
          <div>Try clearing your search terms or category filter.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => {
      const required = this.getRequiredAddonsDetails(item.requiredAddons || []);
      const missingCount = required.filter(r => !r.isInstalled).length;

      return `
        <div class="template-item-card" data-tmpl-id="${item.id}" style="
          background: rgba(19, 27, 46, 0.72); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; overflow: hidden; display: flex; flex-direction: column;
          justify-content: space-between; transition: all 0.25s ease; box-sizing: border-box;
        ">
          <!-- Card Image Thumbnail -->
          <div style="position: relative; height: 160px; background: #0f172a; overflow: hidden;">
            <img src="${item.thumbnail || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80'}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" />
            <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 6px;">
              <span style="font-size: 0.68rem; font-weight: 800; background: rgba(16,185,129,0.9); color: #fff; padding: 3px 8px; border-radius: 12px; text-transform: uppercase;">100% Free</span>
              <span style="font-size: 0.68rem; font-weight: 700; background: rgba(15,23,42,0.85); color: #cbd5e1; padding: 3px 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12);">${item.category}</span>
            </div>
          </div>

          <!-- Body Info -->
          <div style="padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px;">
            <div style="font-weight: 800; font-size: 1rem; color: #ffffff;">${item.name}</div>
            <div style="font-size: 0.78rem; color: #94a3b8; line-height: 1.45; min-height: 36px;">
              ${item.description || ''}
            </div>

            <!-- Required Add-ons Dependencies Box -->
            <div style="margin-top: 6px; padding: 10px; background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px;">
              <div style="font-size: 0.70rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #cbd5e1; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
                <span>Required Add-ons (${required.length}):</span>
                ${missingCount === 0 ? `<span style="color:#10b981;font-weight:700;">Ready ✓</span>` : `<span style="color:#f59e0b;font-weight:700;">${missingCount} to install</span>`}
              </div>
              ${required.length > 0 ? `
                <div style="display: flex; flex-direction: column; gap: 5px;">
                  ${required.map(r => `
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.72rem; padding: 4px 6px; border-radius: 5px; background: ${r.isInstalled ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'}; border: 1px solid ${r.isInstalled ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.25)'};">
                      <span style="display: flex; align-items: center; gap: 5px; color: #ffffff;">
                        <span>${r.icon}</span>
                        <span style="font-weight: 600;">${r.name}</span>
                      </span>
                      ${r.isInstalled ? `
                        <span style="color: #6ee7b7; font-weight: 700; font-size: 0.68rem;">Installed ✓</span>
                      ` : `
                        <button type="button" class="btn-quick-install-addon" data-addon-id="${r.id}" style="background: #6366f1; color: #fff; border: none; border-radius: 4px; padding: 2px 7px; font-size: 0.68rem; font-weight: 700; cursor: pointer;">
                          📥 Install
                        </button>
                      `}
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div style="font-size: 0.72rem; color: #64748b;">No external add-ons required. Uses core elements.</div>
              `}
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div style="padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; gap: 8px;">
            <button type="button" class="btn btn-sm btn-load-template" data-id="${item.id}" style="flex: 1; background: linear-gradient(135deg,#10b981,#059669); color: #ffffff; font-weight: 800; border: none; padding: 9px 12px; border-radius: 8px; font-size: 0.82rem; cursor: pointer; box-shadow: 0 4px 14px rgba(16,185,129,0.35);">
              🚀 Load Template
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach Action Handlers
    // 1. Quick Install Single Addon
    container.querySelectorAll('.btn-quick-install-addon').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const addonId = e.currentTarget.dataset.addonId;
        const catalogItem = (addonStore.catalog || []).find(c => c.id === addonId);
        if (catalogItem) {
          try {
            addonManager.installAddon(catalogItem);
            this.renderTemplateCards(modal, onLoadCallback);
            if (window.aetherApp && window.aetherApp.canvas) {
              window.aetherApp.canvas.showToast(`✅ Installed "${catalogItem.name}"`, 'success');
            }
          } catch (err) {
            alert('Failed to install add-on: ' + err.message);
          }
        }
      });
    });

    // 2. Load Template
    container.querySelectorAll('.btn-load-template').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const tmpl = this.templates.find(t => t.id === id);
        if (!tmpl) return;

        const required = this.getRequiredAddonsDetails(tmpl.requiredAddons || []);
        const missing = required.filter(r => !r.isInstalled);

        if (missing.length > 0) {
          const missingNames = missing.map(m => m.name).join(', ');
          const ok = confirm(`⚠️ Required Add-ons Notice:\n\n"${tmpl.name}" uses the following add-on(s) to render all its contents:\n- ${missingNames}\n\nWould you like AetherBuilder to automatically install the missing add-on(s) now so the page displays completely?`);
          if (ok) {
            btn.disabled = true;
            btn.textContent = 'Installing add-ons & loading...';
            await this.applyTemplate(id, { autoInstall: true });
            modal.remove();
            if (typeof onLoadCallback === 'function') onLoadCallback(tmpl);
            return;
          }
        }

        if (confirm(`Load "${tmpl.name}" into current canvas? (You can undo with Ctrl+Z)`)) {
          btn.disabled = true;
          btn.textContent = 'Loading...';
          await this.applyTemplate(id, { autoInstall: true });
          modal.remove();
          if (typeof onLoadCallback === 'function') onLoadCallback(tmpl);
        }
      });
    });
  }
}

export const templateStore = new TemplateStore();
