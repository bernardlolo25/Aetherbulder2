/**
 * AETHERBUILDER - CANVAS & VISUAL INTERACTION ENGINE
 * Handles WYSIWYG rendering, selection, section tools, inline editing, and runtime widget behaviors.
 */

import { state } from './state.js';

// Admin token helper (server-side session)
function _getAdminToken() { return sessionStorage.getItem('aether_admin_token') || ''; }
import { WIDGET_REGISTRY, initCountdownTimers } from './widgets.js';
import { normalizeGoogleSheetUrl, parseCsv, fetchGoogleSheetLecturers } from './sheets.js';
import { showRegistrationReceiptModal } from './receipt.js';

export class BuilderCanvas {
  constructor(viewportEl, isPublicMode = false) {
    this.viewport = viewportEl;
    this.isPublicMode = isPublicMode;
    this.activeLightboxIndex = 0;
    this.currentLightboxImages = [];

    this.init();
  }

  init() {
    if (!this.isPublicMode) {
      this.initInlineRichTextToolbar();
      state.subscribe((_, action) => {
        // Render canvas on changes
        if (action !== 'viewport') {
          this.render();
        }
        this.updateViewportClass();
      });
    }

    this.render();
    this.updateViewportClass();
  }

  applyCanvasBackground(targetEl, activeBg, forceScrollAttachment = false) {
    if (!targetEl) return;
    if (activeBg && activeBg.enabled && activeBg.imageUrl) {
      const op = activeBg.overlayOpacity !== undefined ? (Number(activeBg.overlayOpacity) / 100) : 0.5;
      const bgGrad = `linear-gradient(rgba(0,0,0,${op}), rgba(0,0,0,${op})), url('${activeBg.imageUrl}')`;
      const bgSize = activeBg.size || 'cover';
      const bgPos = activeBg.position || 'center center';
      const bgRepeat = activeBg.repeat || 'no-repeat';
      const bgAttachment = (forceScrollAttachment || !this.isPublicMode) ? 'scroll' : (activeBg.attachment || 'fixed');

      targetEl.style.backgroundImage = bgGrad;
      targetEl.style.backgroundSize = bgSize;
      targetEl.style.backgroundPosition = bgPos;
      targetEl.style.backgroundAttachment = bgAttachment;
      targetEl.style.backgroundRepeat = bgRepeat;
      targetEl.style.backgroundColor = 'transparent';
    } else {
      targetEl.style.backgroundImage = '';
      targetEl.style.backgroundSize = '';
      targetEl.style.backgroundPosition = '';
      targetEl.style.backgroundAttachment = '';
      targetEl.style.backgroundRepeat = '';
      targetEl.style.backgroundColor = '';
    }
  }

  updateViewportClass() {
    if (this.isPublicMode) return;
    this.viewport.className = `builder-canvas-viewport mode-${state.viewportMode}`;
  }

  render() {
    const params = new URLSearchParams(window.location.search);
    const currentSlug = params.get('page') || 'index';
    const sections = this.isPublicMode
      ? (state._publicSections && state._publicSections.length > 0 ? state._publicSections : state.getPublicSections(currentSlug))
      : state.sections;

    // Resolve Global / Page Background Image (Live on Canvas)
    const ps = state.currentPage?.pageSettings || this.pageSettings || {};
    const pageBg = ps.pageBg;
    const globalBg = (state.siteSettings && state.siteSettings.globalBg) || (state._publicSiteSettings && state._publicSiteSettings.globalBg);
    const activeBg = (pageBg && pageBg.enabled && pageBg.imageUrl)
      ? pageBg
      : ((globalBg && globalBg.enabled && globalBg.imageUrl) ? globalBg : null);

    if (!sections || sections.length === 0) {
      this.viewport.innerHTML = `
        <div class="canvas-frame">
          <div class="add-section-zone animate-fade-in" style="margin: 120px auto;">
            <button class="add-section-btn" id="canvas-empty-add-btn">+</button>
            <div class="add-section-text">Your page is currently blank. Click to add your first section or widget!</div>
          </div>
        </div>
      `;
      const emptyFrame = this.viewport.querySelector('.canvas-frame');
      this.applyCanvasBackground(emptyFrame, activeBg);
      if (!this.isPublicMode && this.viewport) {
        this.applyCanvasBackground(this.viewport, activeBg, true);
      }
      if (!this.isPublicMode) {
        const emptyZone = this.viewport.querySelector('.add-section-zone');
        if (emptyZone) {
          emptyZone.querySelector('#canvas-empty-add-btn')?.addEventListener('click', () => {
            this.showAddSectionModal(0);
          });
          emptyZone.addEventListener('dragover', (e) => {
            if (!window._draggedWidgetType) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            emptyZone.classList.add('is-drop-active');
          });
          emptyZone.addEventListener('dragleave', () => {
            emptyZone.classList.remove('is-drop-active');
          });
          emptyZone.addEventListener('drop', (e) => {
            const widgetType = window._draggedWidgetType || e.dataTransfer.getData('application/x-widget-type');
            if (widgetType) {
              e.preventDefault();
              e.stopPropagation();
              emptyZone.classList.remove('is-drop-active');
              state.addSection(widgetType, 0);
              const name = WIDGET_REGISTRY[widgetType]?.name || widgetType;
              this.showToast(`Added ${name} to page`, 'success');
              window._draggedWidgetType = null;
            }
          });
        }
      }
      return;
    }

    // Build Canvas Frame
    const isTransparentHeader = !!(state.currentPage?.pageSettings?.transparentHeader || this.pageSettings?.transparentHeader);
    const frame = document.createElement('div');
    frame.className = `canvas-frame ${isTransparentHeader ? 'has-transparent-header' : ''}`;

    // Apply Global / Page Background Image (Live on Canvas and Editor Viewport)
    this.applyCanvasBackground(frame, activeBg);
    if (!this.isPublicMode && this.viewport) {
      this.applyCanvasBackground(this.viewport, activeBg, true);
    }

    sections.forEach((sec, idx) => {
      const widgetDef = WIDGET_REGISTRY[sec.widgetType];
      if (!widgetDef) return;

      const secWrapper = document.createElement('div');
      secWrapper.className = `canvas-section-wrapper widget-type-${sec.widgetType} ${!this.isPublicMode && state.activeElementId === sec.id ? 'builder-element-active' : ''}`;
      secWrapper.setAttribute('data-section-id', sec.id);

      // Apply Spacing & Custom Styles
      const props = sec.props || {};
      const formatUnit = (val) => {
        if (val === undefined || val === null || val === '') return null;
        const str = String(val).trim();
        return /^[0-9.-]+$/.test(str) ? `${str}px` : str;
      };

      const isStickySec = (props.stickyHeader === true || props.stickyHeader === 'true' ||
                           props.isSticky === true || props.isSticky === 'true' ||
                           props.position === 'sticky-top' ||
                           (sec.widgetType === 'navbar' && props.isSticky));
      if (isStickySec) {
        secWrapper.classList.add('is-sticky-section');
        secWrapper.style.setProperty('position', 'sticky', 'important');
        secWrapper.style.setProperty('top', '0px', 'important');
        secWrapper.style.setProperty('z-index', this.isPublicMode ? '9999' : '60', 'important');
        secWrapper.style.setProperty('padding', '0px', 'important');
        secWrapper.style.setProperty('margin', '0px', 'important');
      }

      if (sec.widgetType === 'navbar') {
        secWrapper.style.setProperty('padding', '0px', 'important');
        secWrapper.style.setProperty('margin', '0px', 'important');
        secWrapper.style.setProperty('min-height', 'auto', 'important');
        secWrapper.style.setProperty('background', 'transparent', 'important');
        secWrapper.style.setProperty('background-color', 'transparent', 'important');
      } else {
        if (props.fitContentHeight) {
          secWrapper.style.setProperty('padding-top', '0px', 'important');
          secWrapper.style.setProperty('padding-bottom', '0px', 'important');
          secWrapper.style.setProperty('min-height', 'auto', 'important');
          secWrapper.classList.add('fit-content-height');
        } else {
          const pt = formatUnit(props.paddingTop);
          const pb = formatUnit(props.paddingBottom);
          if (pt !== null) secWrapper.style.paddingTop = pt;
          if (pb !== null) secWrapper.style.paddingBottom = pb;
        }

        const px = formatUnit(props.paddingX);
        if (px !== null) {
          secWrapper.style.paddingLeft = px;
          secWrapper.style.paddingRight = px;
        }

        if (props.bgColor && props.bgColor !== 'transparent') {
          secWrapper.style.backgroundColor = props.bgColor;
        }

        // Section background gradient (public + builder preview)
        if (props.bgGradient) {
          secWrapper.style.background = props.bgGradient;
        }
      }

      // Scroll-reveal entrance animation (public mode only)
      const anim = props.entryAnimation;
      if (anim && anim !== 'none' && anim !== 'None' && this.isPublicMode) {
        secWrapper.setAttribute('data-reveal', anim);
        const delay = props.animationDelay ? parseFloat(props.animationDelay) : 0;
        if (delay > 0) secWrapper.style.setProperty('--reveal-delay', `${delay}ms`);
      }

      // Custom CSS class
      if (props.customClass) {
        props.customClass.split(' ').filter(Boolean).forEach(c => secWrapper.classList.add(c));
      }

      // Hide on mobile
      if (props.hideMobile) {
        secWrapper.classList.add('hide-on-mobile');
      }

      // Section Handle Bar & Drag-to-Reorder (Only in Builder Mode)
      if (!this.isPublicMode) {
        const handleBar = document.createElement('div');
        handleBar.className = 'section-handle-bar';
        handleBar.innerHTML = `
          <div class="section-drag-handle" draggable="true" title="Drag to reorder section">⠿</div>
          <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">${widgetDef.name}</span>
          <button class="section-handle-btn btn-up" title="Move Up">↑</button>
          <button class="section-handle-btn btn-down" title="Move Down">↓</button>
          <button class="section-handle-btn btn-add" title="Add Section Above">+</button>
          <button class="section-handle-btn btn-dup" title="Duplicate">❐</button>
          <button class="section-handle-btn btn-del" title="Delete" style="color: #fca5a5;">✕</button>
        `;

        const dragHandle = handleBar.querySelector('.section-drag-handle');
        dragHandle.addEventListener('dragstart', (e) => {
          e.stopPropagation();
          e.dataTransfer.setData('text/plain', sec.id);
          e.dataTransfer.setData('application/x-section-id', sec.id);
          e.dataTransfer.effectAllowed = 'move';
          window._draggedSectionId = sec.id;
          window._draggedWidgetType = null;
          secWrapper.classList.add('is-section-dragging');
          document.body.classList.add('builder-is-dragging');
        });

        dragHandle.addEventListener('dragend', (e) => {
          e.stopPropagation();
          secWrapper.classList.remove('is-section-dragging');
          document.body.classList.remove('builder-is-dragging');
          window._draggedSectionId = null;
          document.querySelectorAll('.drop-target-top, .drop-target-bottom, .is-drop-active').forEach(el => {
            el.classList.remove('drop-target-top', 'drop-target-bottom', 'is-drop-active');
          });
        });

        handleBar.querySelector('.btn-up').addEventListener('click', (e) => {
          e.stopPropagation();
          state.moveElement(sec.id, 'up');
        });
        handleBar.querySelector('.btn-down').addEventListener('click', (e) => {
          e.stopPropagation();
          state.moveElement(sec.id, 'down');
        });
        handleBar.querySelector('.btn-add').addEventListener('click', (e) => {
          e.stopPropagation();
          const rawIdx = state.rawSections.findIndex(s => s.id === sec.id);
          const insertIndex = rawIdx !== -1 ? rawIdx : 0;
          this.showAddSectionModal(insertIndex, sec.id);
        });
        handleBar.querySelector('.btn-dup').addEventListener('click', (e) => {
          e.stopPropagation();
          state.duplicateElement(sec.id);
        });
        handleBar.querySelector('.btn-del').addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('Delete this section?')) {
            state.deleteElement(sec.id);
          }
        });

        secWrapper.appendChild(handleBar);

        // Dragover & Drop on this section (from sidebar or reorder)
        secWrapper.addEventListener('dragover', (e) => {
          if (!window._draggedWidgetType && !window._draggedSectionId) return;
          if (window._draggedSectionId === sec.id) return; // Don't drop on self

          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = window._draggedWidgetType ? 'copy' : 'move';

          const rect = secWrapper.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const isTop = e.clientY < midY;

          if (isTop) {
            secWrapper.classList.add('drop-target-top');
            secWrapper.classList.remove('drop-target-bottom');
          } else {
            secWrapper.classList.add('drop-target-bottom');
            secWrapper.classList.remove('drop-target-top');
          }
        });

        secWrapper.addEventListener('dragleave', (e) => {
          if (!secWrapper.contains(e.relatedTarget)) {
            secWrapper.classList.remove('drop-target-top', 'drop-target-bottom');
          }
        });

        secWrapper.addEventListener('drop', (e) => {
          if (!window._draggedWidgetType && !window._draggedSectionId) return;
          e.preventDefault();
          e.stopPropagation();

          const isTop = secWrapper.classList.contains('drop-target-top');
          secWrapper.classList.remove('drop-target-top', 'drop-target-bottom');

          const widgetType = window._draggedWidgetType || e.dataTransfer.getData('application/x-widget-type');
          const sectionId = window._draggedSectionId || e.dataTransfer.getData('application/x-section-id');

          if (widgetType) {
            const rawIdx = state.rawSections.findIndex(s => s.id === sec.id);
            const baseIdx = rawIdx !== -1 ? rawIdx : 0;
            const insertIndex = isTop ? baseIdx : baseIdx + 1;
            state.addSection(widgetType, insertIndex);
            const widgetName = WIDGET_REGISTRY[widgetType]?.name || widgetType;
            this.showToast(`Inserted ${widgetName}`, 'success');
            window._draggedWidgetType = null;
            return;
          }

          if (sectionId && sectionId !== sec.id) {
            const raw = state.rawSections;
            const fromIdx = raw.findIndex(s => s.id === sectionId);
            const targetRawIdx = raw.findIndex(s => s.id === sec.id);
            if (fromIdx !== -1 && targetRawIdx !== -1) {
              let toIdx = isTop ? targetRawIdx : targetRawIdx + 1;
              if (fromIdx < toIdx) toIdx--;
              if (fromIdx !== toIdx) {
                state.reorderSections(fromIdx, toIdx);
                const movedName = WIDGET_REGISTRY[raw[toIdx]?.widgetType]?.name || 'Section';
                this.showToast(`Moved ${movedName}`, 'info');
              }
            }
            window._draggedSectionId = null;
          }
        });
      }

      // Render Widget Content
      const contentEl = document.createElement('div');
      contentEl.className = 'canvas-section-content';
      if (props.fullWidth || isStickySec) {
        contentEl.style.maxWidth = '100%';
        contentEl.style.width = '100%';
      }
      try {
        contentEl.innerHTML = widgetDef.render(sec.props, { isPublicMode: this.isPublicMode });
      } catch (err) {
        console.error(`Error rendering widget "${sec.widgetType}" (${sec.id}):`, err);
        contentEl.innerHTML = `<div style="padding: 24px; color: #f87171; background: rgba(239,68,68,0.1); border: 1px dashed rgba(239,68,68,0.4); border-radius: 8px; font-family: monospace; font-size: 0.85rem;">⚠️ Failed to render widget "${sec.widgetType}": ${err.message}</div>`;
      }

      // Stamp data attributes for addon widgets (used by custom JS mounts)
      if (widgetDef.isAddon && widgetDef.addonId) {
        contentEl.setAttribute('data-addon-id', widgetDef.addonId);
        try {
          contentEl.setAttribute('data-addon-props', JSON.stringify(sec.props || {}));
        } catch {}
      }

      // Call custom JS mount lifecycle hook (addon widgets only)
      if (typeof widgetDef.mount === 'function') {
        try {
          widgetDef.mount(contentEl, sec.props || {});
        } catch (err) {
          console.warn(`[AetherBuilder] mount() error for addon "${sec.widgetType}":`, err);
        }
      }

      // Selection & Inline Editing (Builder Mode)
      if (!this.isPublicMode) {
        secWrapper.addEventListener('click', (e) => {
          e.stopPropagation();
          state.setActiveElement(sec.id);
        });

        // Double click inline text editing with floating rich-text toolbar
        contentEl.addEventListener('dblclick', (e) => {
          const target = e.target.closest('h1, h2, h3, h4, p, span, a, button, .wb-counter-label');
          if (target && !target.isContentEditable) {
            target.contentEditable = 'true';
            target.focus();
            target.style.outline = '2px dashed var(--primary, #6366f1)';
            target.style.borderRadius = '4px';

            const originalHTML = target.innerHTML;

            const onBlur = () => {
              target.contentEditable = 'false';
              target.style.outline = 'none';
              target.removeEventListener('blur', onBlur);

              const newHTML = target.innerHTML.trim();
              if (newHTML !== originalHTML) {
                this.syncInlineEditToProps(sec, target, newHTML, originalHTML);
              }
            };
            target.addEventListener('blur', onBlur);
          }
        });
      }

      secWrapper.appendChild(contentEl);
      frame.appendChild(secWrapper);
    });

    // Add Section Bottom Zone (Builder Mode)
    if (!this.isPublicMode) {
      const bottomZone = document.createElement('div');
      bottomZone.className = 'add-section-zone';
      bottomZone.innerHTML = `
        <button class="add-section-btn" title="Add Section">+</button>
        <div class="add-section-text">Add New Section or Drop Here</div>
      `;
      bottomZone.querySelector('.add-section-btn').addEventListener('click', () => {
        this.showAddSectionModal(state.rawSections.length);
      });

      bottomZone.addEventListener('dragover', (e) => {
        if (!window._draggedWidgetType && !window._draggedSectionId) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = window._draggedWidgetType ? 'copy' : 'move';
        bottomZone.classList.add('is-drop-active');
      });
      bottomZone.addEventListener('dragleave', (e) => {
        if (!bottomZone.contains(e.relatedTarget)) {
          bottomZone.classList.remove('is-drop-active');
        }
      });
      bottomZone.addEventListener('drop', (e) => {
        if (!window._draggedWidgetType && !window._draggedSectionId) return;
        e.preventDefault();
        e.stopPropagation();
        bottomZone.classList.remove('is-drop-active');

        const widgetType = window._draggedWidgetType || e.dataTransfer.getData('application/x-widget-type');
        const sectionId = window._draggedSectionId || e.dataTransfer.getData('application/x-section-id');

        if (widgetType) {
          state.addSection(widgetType);
          const widgetName = WIDGET_REGISTRY[widgetType]?.name || widgetType;
          this.showToast(`Added ${widgetName} to bottom`, 'success');
          window._draggedWidgetType = null;
        } else if (sectionId) {
          const raw = state.rawSections;
          const fromIdx = raw.findIndex(s => s.id === sectionId);
          if (fromIdx !== -1 && fromIdx !== raw.length - 1) {
            state.reorderSections(fromIdx, raw.length - 1);
            const movedName = WIDGET_REGISTRY[raw[raw.length - 1]?.widgetType]?.name || 'Section';
            this.showToast(`Moved ${movedName} to bottom`, 'info');
          }
          window._draggedSectionId = null;
        }
      });

      frame.appendChild(bottomZone);
    }

    this.viewport.innerHTML = '';
    this.viewport.appendChild(frame);

    // Initialize Interactive Runtime Behaviors
    this.initRuntimeBehaviors(frame);
  }

  // Initialize interactive widgets (Counters, Sliders, Gallery Lightbox, Accordion, Contact, Floating Nav, Mobile Nav, Seminar Schedule, Payment Options, Lecturer Gallery)
  initRuntimeBehaviors(container) {
    this.initFloatingNav(container);
    this.initMobileNavs(container);
    this.initScrollReveal(container);
    this.initCounters(container);
    this.initSliders(container);
    this.initGalleries(container);
    this.initAccordions(container);
    this.initContactForms(container);
    this.initRegistrationForms(container);
    this.initSeminarSchedules(container);
    this.initPaymentOptions(container);
    this.initLecturerGalleries(container);
    initCountdownTimers();
  }

  // Synchronize inline text edits on the canvas back to widget props and state history
  syncInlineEditToProps(sec, target, newHTML, originalHTML) {
    if (!sec || !sec.props) return;
    const props = { ...sec.props };
    let updatedKey = null;

    const tag = target.tagName ? target.tagName.toLowerCase() : '';
    const cls = target.className || '';

    if (tag === 'h1' || cls.includes('title') || cls.includes('heading')) {
      if ('title' in props) updatedKey = 'title';
      else if ('heading' in props) updatedKey = 'heading';
    } else if (tag === 'h2' || tag === 'h3' || cls.includes('subtitle')) {
      if ('subtitle' in props) updatedKey = 'subtitle';
      else if ('subheading' in props) updatedKey = 'subheading';
    } else if (tag === 'p' || cls.includes('desc') || cls.includes('content') || cls.includes('text')) {
      if ('description' in props) updatedKey = 'description';
      else if ('content' in props) updatedKey = 'content';
      else if ('text' in props) updatedKey = 'text';
    } else if (tag === 'button' || cls.includes('btn') || tag === 'a') {
      if ('buttonText' in props) updatedKey = 'buttonText';
      else if ('ctaText' in props) updatedKey = 'ctaText';
      else if ('linkText' in props) updatedKey = 'linkText';
    }

    // Fallback: match by original text in string props
    if (!updatedKey) {
      const origClean = (originalHTML || '').replace(/<[^>]*>/g, '').trim();
      for (const [k, v] of Object.entries(props)) {
        if (typeof v === 'string') {
          const vClean = v.replace(/<[^>]*>/g, '').trim();
          if (vClean === origClean || (origClean.length > 5 && (vClean.includes(origClean) || origClean.includes(vClean)))) {
            updatedKey = k;
            break;
          }
        }
      }
    }

    if (updatedKey) {
      state.updateElementProps(sec.id, { [updatedKey]: newHTML }, true);
      this.showToast('Text updated & saved!', 'success');
    }
  }

  // Floating Rich-Text Mini-Toolbar on canvas text selection
  initInlineRichTextToolbar() {
    if (this.isPublicMode) return;
    if (document.getElementById('canvas-inline-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'canvas-inline-toolbar';
    toolbar.className = 'canvas-inline-toolbar hidden';
    toolbar.innerHTML = `
      <button class="inline-toolbar-btn" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>
      <button class="inline-toolbar-btn" data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
      <button class="inline-toolbar-btn" data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>
      <div class="inline-toolbar-separator"></div>
      <button class="inline-toolbar-btn" data-cmd="link" title="Insert Link">🔗</button>
      <label class="inline-toolbar-btn" title="Text Color" style="position:relative;cursor:pointer;margin:0;">
        <span style="color:#f59e0b;font-size:0.95rem;">●</span>
        <input type="color" id="inline-color-picker" style="opacity:0;position:absolute;inset:0;width:100%;height:100%;cursor:pointer;">
      </label>
      <button class="inline-toolbar-btn" data-cmd="clean" title="Clear Formatting">🧹</button>
      <div id="inline-link-popover" class="inline-link-popover" style="display:none;">
        <input type="url" class="inline-link-input" placeholder="https://..." />
        <button class="inline-toolbar-btn active" id="btn-apply-link" title="Apply Link">✓</button>
        <button class="inline-toolbar-btn" id="btn-cancel-link" title="Cancel">✕</button>
      </div>
    `;
    document.body.appendChild(toolbar);

    let savedRange = null;

    const updateToolbarPosition = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        toolbar.classList.add('hidden');
        const pop = toolbar.querySelector('#inline-link-popover');
        if (pop) pop.style.display = 'none';
        return;
      }
      const anchorNode = sel.anchorNode;
      const editableParent = anchorNode?.nodeType === 1 ? anchorNode.closest('[contenteditable="true"]') : anchorNode?.parentElement?.closest('[contenteditable="true"]');
      if (!editableParent || !this.viewport.contains(editableParent)) {
        toolbar.classList.add('hidden');
        const pop = toolbar.querySelector('#inline-link-popover');
        if (pop) pop.style.display = 'none';
        return;
      }

      const range = sel.getRangeAt(0);
      savedRange = range.cloneRange();
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        toolbar.classList.add('hidden');
        return;
      }

      toolbar.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;
      toolbar.style.top = `${rect.top + window.scrollY}px`;
      toolbar.classList.remove('hidden');

      try {
        toolbar.querySelector('[data-cmd="bold"]')?.classList.toggle('active', document.queryCommandState('bold'));
        toolbar.querySelector('[data-cmd="italic"]')?.classList.toggle('active', document.queryCommandState('italic'));
        toolbar.querySelector('[data-cmd="underline"]')?.classList.toggle('active', document.queryCommandState('underline'));
      } catch (e) {}
    };

    document.addEventListener('selectionchange', () => {
      requestAnimationFrame(updateToolbarPosition);
    });

    toolbar.addEventListener('mousedown', (e) => {
      if (!e.target.closest('#inline-link-popover') && !e.target.closest('#inline-color-picker')) {
        e.preventDefault();
      }
    });

    toolbar.querySelectorAll('.inline-toolbar-btn[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline') {
          document.execCommand(cmd, false, null);
          updateToolbarPosition();
        } else if (cmd === 'clean') {
          document.execCommand('removeFormat', false, null);
          updateToolbarPosition();
        } else if (cmd === 'link') {
          const popover = toolbar.querySelector('#inline-link-popover');
          popover.style.display = popover.style.display === 'none' ? 'flex' : 'none';
          if (popover.style.display === 'flex') {
            const input = popover.querySelector('.inline-link-input');
            input.value = '';
            input.focus();
          }
        }
      });
    });

    const colorInput = toolbar.querySelector('#inline-color-picker');
    colorInput?.addEventListener('input', (e) => {
      if (savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
      document.execCommand('foreColor', false, e.target.value);
    });

    toolbar.querySelector('#btn-apply-link')?.addEventListener('click', () => {
      const input = toolbar.querySelector('.inline-link-input');
      const url = input.value.trim();
      if (savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
      if (url) {
        document.execCommand('createLink', false, url);
      }
      toolbar.querySelector('#inline-link-popover').style.display = 'none';
    });

    toolbar.querySelector('#btn-cancel-link')?.addEventListener('click', () => {
      toolbar.querySelector('#inline-link-popover').style.display = 'none';
    });
  }

  // Scroll-Reveal Entrance Animations (IntersectionObserver-powered)
  initScrollReveal(container) {
    const revealEls = container.querySelectorAll('[data-reveal]');
    if (!revealEls.length || !('IntersectionObserver' in window)) {
      // Fallback: just show all immediately
      revealEls.forEach(el => el.classList.add('revealed'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Small stagger based on position among siblings
          const siblings = Array.from(entry.target.parentElement?.querySelectorAll('[data-reveal]') || []);
          const idx = siblings.indexOf(entry.target);
          const baseDelay = parseFloat(getComputedStyle(entry.target).getPropertyValue('--reveal-delay')) || 0;
          const stagger = idx * 60; // 60ms between consecutive reveals
          setTimeout(() => {
            entry.target.classList.add('revealed');
          }, baseDelay + stagger);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(el => observer.observe(el));
  }

  // Mobile Navigation Drawer Toggle & Interactions
  initMobileNavs(container) {
    const navbars = container.querySelectorAll('.wb-navbar');
    navbars.forEach((navbar) => {
      const toggleBtn = navbar.querySelector('.wb-nav-toggle');
      const mobileMenu = navbar.querySelector('.wb-nav-mobile-menu');
      if (!toggleBtn || !mobileMenu) return;

      const toggleIcon = toggleBtn.querySelector('.wb-nav-toggle-icon') || toggleBtn;

      const setOpen = (open) => {
        if (open) {
          navbar.classList.add('is-open');
          toggleBtn.setAttribute('aria-expanded', 'true');
          mobileMenu.setAttribute('aria-hidden', 'false');
          toggleIcon.textContent = '✕';
        } else {
          navbar.classList.remove('is-open');
          toggleBtn.setAttribute('aria-expanded', 'false');
          mobileMenu.setAttribute('aria-hidden', 'true');
          toggleIcon.textContent = '☰';
        }
      };

      // Toggle click
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const isOpen = navbar.classList.contains('is-open');
        setOpen(!isOpen);
      });

      // Close when clicking any nav link inside mobile menu
      mobileMenu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
          setOpen(false);
        });
      });

      // Close when clicking outside navbar
      const handleOutsideClick = (e) => {
        if (!navbar.contains(e.target) && navbar.classList.contains('is-open')) {
          setOpen(false);
        }
      };
      document.addEventListener('click', handleOutsideClick);

      // Close on Escape key
      const handleKey = (e) => {
        if (e.key === 'Escape' && navbar.classList.contains('is-open')) {
          setOpen(false);
        }
      };
      document.addEventListener('keydown', handleKey);

      // Dynamic Self-Healing Auto-Overflow Protection:
      // If links + brand + CTA ever exceed row width on any screen size, auto-collapse into mobile drawer
      const checkNavOverflow = () => {
        const row = navbar.querySelector('.wb-nav-row, .wb-nav-institutional-row, .wb-nav-bottombar-inner');
        if (!row) return;
        navbar.classList.remove('is-overflow-collapsed');
        if (row.scrollWidth > row.clientWidth + 2) {
          navbar.classList.add('is-overflow-collapsed');
        }
      };

      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
          requestAnimationFrame(checkNavOverflow);
        });
        ro.observe(navbar);
      }
      window.addEventListener('resize', checkNavOverflow);
      setTimeout(checkNavOverflow, 50);
    });
  }

  // Floating Navbar Scroll Feedback
  initFloatingNav(container) {
    const navbar = container.querySelector('.wb-navbar.is-floating, .wb-navbar.is-sticky');
    if (!navbar) return;

    // ── EDITOR SAFETY: force the navbar back into normal flow so it never
    //    escapes the canvas preview into the admin UI chrome. ──────────────
    if (!this.isPublicMode) {
      navbar.style.setProperty('position', 'relative', 'important');
      navbar.style.setProperty('top',      'auto',     'important');
      navbar.style.setProperty('left',     'auto',     'important');
      navbar.style.setProperty('transform','none',     'important');
      navbar.style.setProperty('width',    '100%',     'important');
      navbar.style.setProperty('z-index',  '1',        'important');
    }

    const scrollTarget = this.isPublicMode ? window : this.viewport;

    const handleScroll = () => {
      const scrollTop = this.isPublicMode ? (window.pageYOffset || document.documentElement.scrollTop) : this.viewport.scrollTop;
      if (scrollTop > 24) {
        navbar.classList.add('is-scrolled');
      } else {
        navbar.classList.remove('is-scrolled');
      }
    };

    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  // Counter Number Count-Up Animation
  initCounters(container) {
    const counterCards = container.querySelectorAll('.wb-counter-card');
    if (counterCards.length === 0) return;

    const runCount = (card) => {
      const numEl = card.querySelector('.counter-number');
      if (!numEl) return;
      const target = parseFloat(card.getAttribute('data-target')) || 0;
      const decimals = parseInt(card.getAttribute('data-decimals'), 10) || 0;
      const duration = 1800; // ms
      const startTime = performance.now();

      numEl.classList.add('counting');

      const update = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing: easeOutExpo
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = ease * target;

        numEl.textContent = current.toFixed(decimals);

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          numEl.textContent = target.toFixed(decimals);
          numEl.classList.remove('counting');
        }
      };

      requestAnimationFrame(update);
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runCount(entry.target);
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.25 });

      counterCards.forEach((c) => observer.observe(c));
    } else {
      counterCards.forEach(runCount);
    }
  }

  // Carousel / Slider Widget
  initSliders(container) {
    const sliders = container.querySelectorAll('.wb-slider-container');
    sliders.forEach((slider) => {
      const track = slider.querySelector('.wb-slider-track');
      const slides = slider.querySelectorAll('.wb-slide');
      const dots = slider.querySelectorAll('.wb-slider-dot');
      const prevBtn = slider.querySelector('.wb-slider-btn.prev');
      const nextBtn = slider.querySelector('.wb-slider-btn.next');

      if (!track || slides.length === 0) return;

      let currentIndex = 0;
      const count = slides.length;
      const autoPlay = slider.getAttribute('data-autoplay') === 'true';
      const intervalTime = parseInt(slider.getAttribute('data-interval'), 10) || 4500;
      let timer = null;

      const goTo = (index) => {
        currentIndex = (index + count) % count;
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
        dots.forEach((d, i) => d.classList.toggle('active', i === currentIndex));
      };

      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          goTo(currentIndex - 1);
          resetAutoPlay();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          goTo(currentIndex + 1);
          resetAutoPlay();
        });
      }

      dots.forEach((dot) => {
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetSlide = parseInt(dot.getAttribute('data-slide'), 10) || 0;
          goTo(targetSlide);
          resetAutoPlay();
        });
      });

      const startAutoPlay = () => {
        if (autoPlay && !timer) {
          timer = setInterval(() => goTo(currentIndex + 1), intervalTime);
        }
      };

      const stopAutoPlay = () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      };

      const resetAutoPlay = () => {
        stopAutoPlay();
        startAutoPlay();
      };

      slider.addEventListener('mouseenter', stopAutoPlay);
      slider.addEventListener('mouseleave', startAutoPlay);

      startAutoPlay();
    });
  }

  // Gallery Filters & Interactive Lightbox
  initGalleries(container) {
    const galleries = container.querySelectorAll('.wb-gallery-wrapper');
    galleries.forEach((gallery) => {
      const filterBtns = gallery.querySelectorAll('.wb-gallery-filter-btn');
      const items = gallery.querySelectorAll('.wb-gallery-item');

      // Category Filtering
      filterBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const filter = btn.getAttribute('data-filter');
          filterBtns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');

          items.forEach((item) => {
            const cat = item.getAttribute('data-category');
            if (filter === 'all' || cat === filter) {
              item.style.display = 'block';
              item.classList.add('animate-scale-in');
            } else {
              item.style.display = 'none';
            }
          });
        });
      });

      // Lightbox Click
      items.forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const allImgs = Array.from(items)
            .filter((it) => it.style.display !== 'none')
            .map((it) => ({
              url: it.querySelector('img').src,
              title: it.querySelector('.wb-gallery-title')?.textContent || '',
              tag: it.querySelector('.wb-gallery-tag')?.textContent || ''
            }));

          const itemImgUrl = item.querySelector('img').src;
          const idx = allImgs.findIndex((img) => img.url === itemImgUrl);

          this.openLightbox(allImgs, idx !== -1 ? idx : 0);
        });
      });
    });
  }

  // Lightbox Modal
  openLightbox(images, startIndex = 0) {
    this.currentLightboxImages = images;
    this.activeLightboxIndex = startIndex;

    let modal = document.getElementById('wb-lightbox-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'wb-lightbox-modal';
      modal.className = 'wb-lightbox lightbox-modal';
      modal.innerHTML = `
        <button class="wb-lightbox-close" title="Close">✕</button>
        <button class="wb-lightbox-prev" title="Previous">❮</button>
        <button class="wb-lightbox-next" title="Next">❯</button>
        <div class="wb-lightbox-content">
          <img class="wb-lightbox-img" src="" alt="" />
          <div class="wb-lightbox-caption"></div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('.wb-lightbox-close').addEventListener('click', () => modal.remove());
      modal.querySelector('.wb-lightbox-prev').addEventListener('click', () => this.stepLightbox(-1));
      modal.querySelector('.wb-lightbox-next').addEventListener('click', () => this.stepLightbox(1));

      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });

      window.addEventListener('keydown', (e) => {
        if (document.getElementById('wb-lightbox-modal')) {
          if (e.key === 'Escape') modal.remove();
          if (e.key === 'ArrowLeft') this.stepLightbox(-1);
          if (e.key === 'ArrowRight') this.stepLightbox(1);
        }
      });
    }

    this.updateLightboxContent();
  }

  stepLightbox(dir) {
    const total = this.currentLightboxImages.length;
    this.activeLightboxIndex = (this.activeLightboxIndex + dir + total) % total;
    this.updateLightboxContent();
  }

  updateLightboxContent() {
    const modal = document.getElementById('wb-lightbox-modal');
    if (!modal || !this.currentLightboxImages[this.activeLightboxIndex]) return;

    const imgData = this.currentLightboxImages[this.activeLightboxIndex];
    const imgEl = modal.querySelector('.wb-lightbox-img');
    const capEl = modal.querySelector('.wb-lightbox-caption');

    imgEl.src = imgData.url;
    capEl.innerHTML = `${imgData.title} <span style="font-size: 0.85rem; color: var(--primary-light); font-weight: normal;">• ${imgData.tag}</span>`;
  }

  // FAQ Accordion
  initAccordions(container) {
    const items = container.querySelectorAll('.wb-faq-item');
    items.forEach((item) => {
      const q = item.querySelector('.wb-faq-question');
      if (q) {
        q.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = item.classList.contains('open');
          // Optional accordion behavior: close others
          items.forEach((other) => other.classList.remove('open'));
          if (!isOpen) item.classList.add('open');
        });
      }
    });
  }

  // Contact Form Submission
  initContactForms(container) {
    const forms = container.querySelectorAll('.wb-contact-form');
    forms.forEach((form) => {
      if (form._wbContactInitialized) return;
      form._wbContactInitialized = true;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const submitBtn = form.querySelector('button[type="submit"]');
        const origText = submitBtn ? submitBtn.innerHTML : '';
        const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';

        if (submitBtn) {
          submitBtn.innerHTML = `<span>Sending...</span> <span class="animate-spin">⚙️</span>`;
          submitBtn.disabled = true;
        }

        const nameInput = form.querySelector('input[name="name"]');
        const emailInput = form.querySelector('input[name="email"]');
        const msgInput = form.querySelector('textarea[name="message"]');

        const payload = {
          type: 'contact',
          name: nameInput ? nameInput.value.trim() : 'Website Visitor',
          email: emailInput ? emailInput.value.trim() : '',
          message: msgInput ? msgInput.value.trim() : '',
          page: window.location.search || 'home'
        };

        try {
          await fetch(apiBase + '?action=submit_form', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json',
          'X-Admin-Token': _getAdminToken(), },
            body: JSON.stringify(payload)
          });
        } catch (err) {
          console.warn('Contact form submit warning:', err);
        }

        if (submitBtn) {
          submitBtn.innerHTML = `<span>✓ Sent Successfully!</span>`;
          submitBtn.style.background = 'var(--success)';
        }
        form.reset();
        this.showToast('Your message has been dispatched to the team!', 'success');

        if (window.app && typeof window.app.checkNotifications === 'function') {
          window.app.checkNotifications();
        }

        setTimeout(() => {
          if (submitBtn) {
            submitBtn.innerHTML = origText;
            submitBtn.style.background = '';
            submitBtn.disabled = false;
          }
        }, 3500);
      });
    });
  }

  // Dynamic Registration Form Handler (with file upload & submissions sync)
  initRegistrationForms(container) {
    const forms = container.querySelectorAll('.wb-reg-form');
    forms.forEach((form) => {
      if (form._wbRegInitialized) return;
      form._wbRegInitialized = true;

      // Real-time file size check on change
      form.querySelectorAll('.wb-reg-file-input').forEach((fileInput) => {
        fileInput.addEventListener('change', () => {
          const file = fileInput.files && fileInput.files[0];
          const box = fileInput.closest('.wb-reg-file-box');
          const errEl = box ? box.querySelector('.wb-reg-file-error') : null;
          const maxMB = parseFloat(fileInput.getAttribute('data-max-size-mb')) || 5;

          if (file) {
            const sizeMB = file.size / (1024 * 1024);
            if (maxMB > 0 && sizeMB > maxMB) {
              fileInput.value = ''; // Reset invalid file
              if (errEl) {
                errEl.textContent = `⚠️ File "${file.name}" (${sizeMB.toFixed(1)} MB) exceeds the ${maxMB} MB limit. Please select a smaller file.`;
                errEl.style.display = 'block';
              }
            } else {
              if (errEl) {
                errEl.textContent = '';
                errEl.style.display = 'none';
              }
            }
          }
        });
      }); // end .wb-reg-file-input forEach

      // Interactive image option cards: clicking card checks radio and highlights selected card
      form.querySelectorAll('.wb-reg-img-option').forEach((optLabel) => {
        const radio = optLabel.querySelector('.wb-reg-img-radio');
        if (!radio) return;

        const updateSelection = () => {
          const groupName = radio.name;
          const allInGroup = form.querySelectorAll(`input[name="${groupName}"]`);
          allInGroup.forEach((r) => {
            const parent = r.closest('.wb-reg-img-option');
            if (parent) {
              if (r.checked) {
                parent.classList.add('is-selected');
              } else {
                parent.classList.remove('is-selected');
              }
            }
          });
        };

        if (radio.checked) optLabel.classList.add('is-selected');
        radio.addEventListener('change', updateSelection);
        optLabel.addEventListener('click', (e) => {
          if (e.target !== radio) {
            radio.checked = true;
            updateSelection();
          }
        });
      });

      // Form submission handler
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const widget = form.closest('.wb-registration-widget');
        const statusEl = form.querySelector('.wb-reg-status');
        const submitBtn = form.querySelector('.wb-reg-submit-btn');
        const successMsg = form.getAttribute('data-success-msg') || 'Registration submitted!';
        const gsheetUrl = widget ? widget.getAttribute('data-gsheet-url') : '';
        const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';

        // Pre-flight check: validate all file inputs
        const fileInputs = form.querySelectorAll('.wb-reg-file-input');
        let fileValidationError = null;
        for (let fi = 0; fi < fileInputs.length; fi++) {
          const finp = fileInputs[fi];
          const f = finp.files && finp.files[0];
          if (f) {
            const maxMB = parseFloat(finp.getAttribute('data-max-size-mb')) || 5;
            const szMB = f.size / (1024 * 1024);
            if (maxMB > 0 && szMB > maxMB) {
              fileValidationError = `File "${f.name}" (${szMB.toFixed(1)} MB) exceeds the ${maxMB} MB size limit.`;
              break;
            }
          }
        }
        if (fileValidationError) {
          if (statusEl) {
            statusEl.textContent = '⚠️ ' + fileValidationError;
            statusEl.className = 'wb-reg-status is-error';
            statusEl.style.display = 'block';
          }
          return;
        }

        const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.6';
          submitBtn.innerHTML = `<span>⏳ Submitting...</span>`;
        }
        if (statusEl) {
          statusEl.style.display = 'none';
          statusEl.className = 'wb-reg-status';
        }

        // Build payload & upload files to server media storage so real URLs are generated
        const payload = {
          type: 'registration',
          page: window.location.search || '?page=registration-form'
        };
        const elements = form.elements;
        const fileUploadPromises = [];

        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          if (!el.name || el.name === '_hp') continue;

          if (el.type === 'file') {
            if (el.files && el.files[0]) {
              const file = el.files[0];
              const fieldName = el.name;
              fileUploadPromises.push(
                (async () => {
                  try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const upRes = await fetch(apiBase + '?action=upload', {
                      method: 'POST',
                      body: formData
                    });
                    const upData = await upRes.json();
                    if (upData && upData.success && upData.url) {
                      const fileLink = window.location.origin + '/' + upData.url.replace(/^\//, '');
                      payload[fieldName] = fileLink;
                      payload[fieldName + '_filename'] = file.name;
                      payload[fieldName + '_url'] = fileLink;
                    } else {
                      payload[fieldName] = file.name + ' (Uploaded)';
                    }
                  } catch (err) {
                    console.warn('File upload to media error:', err);
                    payload[fieldName] = file.name;
                  }
                })()
              );
            } else {
              payload[el.name] = '';
            }
          } else if (el.type === 'checkbox') {
            payload[el.name] = el.checked ? 'Yes' : 'No';
          } else if (el.type === 'radio') {
            if (payload[el.name] === undefined) {
              payload[el.name] = '';
            }
            if (el.checked) {
              payload[el.name] = el.value;
            }
          } else if (el.type !== 'submit') {
            payload[el.name] = el.value;
          }
        }

        // Wait for all file uploads to finish
        if (fileUploadPromises.length > 0) {
          if (statusEl) {
            statusEl.textContent = '⏳ Uploading files & submitting...';
            statusEl.className = 'wb-reg-status';
            statusEl.style.display = 'block';
          }
          await Promise.all(fileUploadPromises);
        }

        // Honeypot check
        const hpVal = form.querySelector('input[name="_hp"]')?.value;
        if (hpVal) {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; submitBtn.innerHTML = origBtnHtml; }
          return;
        }

        // Extract primary name, email, phone
        const keys = Object.keys(payload);
        const nameKey = keys.find(k => /^(full_?name|name)$/i.test(k)) || keys.find(k => /name/i.test(k) && !/_filename|_url/i.test(k));
        const emailKey = keys.find(k => /^email$/i.test(k)) || keys.find(k => /email/i.test(k));
        const phoneKey = keys.find(k => /^(phone|mobile|tel|contact)$/i.test(k)) || keys.find(k => /(phone|mobile)/i.test(k));

        payload.name = (nameKey && payload[nameKey]) ? payload[nameKey] : (payload.name || 'Registrant');
        payload.email = (emailKey && payload[emailKey]) ? payload[emailKey] : (payload.email || '');
        payload.phone = (phoneKey && payload[phoneKey]) ? payload[phoneKey] : (payload.phone || '');

        // Build human-friendly message summary from all fields for admin notifications
        const summaryLines = [];
        for (const [k, v] of Object.entries(payload)) {
          if (['type', 'page', 'name', '_hp', 'message'].includes(k) || k.endsWith('_b64')) continue;
          if (v && typeof v === 'string') {
            const cleanKey = k.replace(/^field_\d+_?/, '').replace(/_/g, ' ');
            summaryLines.push(`${cleanKey}: ${v}`);
          }
        }
        payload.message = summaryLines.join('\n');
        payload.extra = { ...payload };

        // 1. Save to local submissions store via API
        try {
          const localRes = await fetch(apiBase + '?action=submit_form', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json',
          'X-Admin-Token': _getAdminToken(), },
            body: JSON.stringify(payload)
          });
          const localData = await localRes.json();
          if (!localData.success) throw new Error(localData.message || localData.error || 'Server error');
        } catch (err) {
          console.error('Submission failed:', err);
          if (statusEl) {
            statusEl.textContent = '⚠️ Submission failed: ' + err.message + '. Please try again.';
            statusEl.className = 'wb-reg-status is-error';
            statusEl.style.display = 'block';
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.innerHTML = origBtnHtml;
          }
          return;
        }

        // 2. Mirror to Google Sheets if configured (with clean non-redundant columns)
        if (gsheetUrl && gsheetUrl.includes('script.google.com')) {
          try {
            const excludeSummary = widget ? widget.getAttribute('data-gsheet-exclude-summary') !== 'false' : true;
            const excludeMeta = widget ? widget.getAttribute('data-gsheet-exclude-meta') !== 'false' : true;
            const excludeHidden = widget ? widget.getAttribute('data-gsheet-exclude-hidden') !== 'false' : true;

            // Find hidden inputs if excludeHidden is active
            const hiddenNames = new Set();
            if (excludeHidden) {
              form.querySelectorAll('input[type="hidden"]').forEach((h) => {
                if (h.name) hiddenNames.add(h.name);
              });
            }

            // Build map of field names to human labels (so auto IDs like field_1792... map to clean column names)
            const labelMap = {};
            form.querySelectorAll('.wb-reg-field').forEach((fld) => {
              const inp = fld.querySelector('input,select,textarea');
              const lbl = fld.querySelector('.wb-reg-label');
              if (inp && inp.name && lbl) {
                const cleanLbl = lbl.textContent.replace(/\s*\*.*$/, '').trim().replace(/[^a-zA-Z0-9_]/g, '_');
                if (cleanLbl) labelMap[inp.name] = cleanLbl;
              }
            });

            const sheetPayload = {};
            Object.keys(payload).forEach((k) => {
              // Always exclude internal system helpers
              if (k === '_hp' || k === 'website_hp' || k === 'extra' || k.endsWith('_b64')) return;

              // Exclude redundant file auxiliary keys (*_filename, *_url) since the field itself contains the link!
              if (k.endsWith('_filename') || k.endsWith('_url')) return;

              // Exclude system metadata if enabled
              if (excludeMeta && (k === 'type' || k === 'page')) return;

              // Exclude summary / message column if enabled
              if (excludeSummary && k === 'message') return;

              // Exclude hidden fields if enabled
              if (excludeHidden && hiddenNames.has(k)) return;

              // Exclude duplicate generic fields if specific user fields exist
              if (k === 'name' && (payload.FullName || payload.fullName || payload.full_name || payload.Full_Name)) return;
              if (k === 'email' && (payload.Email || payload.email_address || payload.Email_Address)) return;
              if (k === 'phone' && (payload.Phone || payload.mobile || payload.Mobile || payload.Mobile_No || payload.Mobile_No_)) return;

              const finalKey = (k.startsWith('field_') && labelMap[k]) ? labelMap[k] : k;
              sheetPayload[finalKey] = payload[k];
            });

            fetch(gsheetUrl, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify(sheetPayload)
            }).catch(() => {});
          } catch (ignored) {}
        }

        // 3. Show success & reset form
        form.querySelectorAll('input:not([type=hidden]),select,textarea').forEach((inp) => {
          inp.value = '';
          if (inp.type === 'checkbox' || inp.type === 'radio') inp.checked = false;
        });
        if (statusEl) {
          statusEl.textContent = successMsg;
          statusEl.className = 'wb-reg-status is-success';
          statusEl.style.display = 'block';
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.innerHTML = `<span>✓ Submitted Successfully!</span>`;
          setTimeout(() => {
            submitBtn.innerHTML = origBtnHtml;
          }, 4000);
        }

        if (this.showToast) {
          this.showToast('🎉 ' + successMsg, 'success');
        }

        // Show card-style receipt with details that can be downloaded as an image
        const formTitle = (widget ? widget.querySelector('.wb-reg-title')?.textContent : '') || 'Official Registration E-Receipt';
        showRegistrationReceiptModal(payload, { form, title: formTitle });

        // If in Admin Studio, update notifications badge in real time
        if (window.app && typeof window.app.checkNotifications === 'function') {
          window.app.checkNotifications();
        }
      });
    });
  }

  // Add Section Modal Picker
  showAddSectionModal(insertAtIndex, beforeSectionId = null) {
    let existing = document.getElementById('add-section-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'add-section-modal';
    modal.className = 'modal-overlay animate-fade-in';

    const entries = Object.entries(WIDGET_REGISTRY);
    const totalCount = entries.length;
    const addonCount = entries.filter(([_, w]) => w.isAddon).length;
    const coreCount = totalCount - addonCount;

    const widgetsHtml = entries
      .map(([type, w]) => {
        const isAddon = !!w.isAddon;
        const cat = w.category || (isAddon ? 'addons' : 'general');
        const desc = w.description || '';
        const name = w.name || type;
        return `
          <div class="widget-card add-widget-card ${isAddon ? 'is-addon-widget' : ''}" 
               data-widget="${type}"
               data-name="${name.toLowerCase()}"
               data-category="${cat.toLowerCase()}"
               data-desc="${desc.toLowerCase()}"
               data-is-addon="${isAddon ? '1' : '0'}"
               title="${name}: ${desc}">
            <div class="widget-card-icon">${w.icon || '🧩'}</div>
            <div class="widget-card-name" style="display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap;">
              <span>${name}</span>
              ${isAddon ? '<span style="font-size:0.62rem;background:rgba(99,102,241,0.22);color:#a5b4fc;padding:1px 5px;border-radius:4px;font-weight:700;">Add-on</span>' : ''}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px; line-height: 1.35;">${desc}</div>
          </div>
        `;
      })
      .join('');

    modal.innerHTML = `
      <div class="modal-box modal-wide animate-scale-in">
        <div class="modal-header">
          <div class="modal-title">
            <span>➕</span> Add Element to Canvas
          </div>
          <button class="tool-icon-btn" id="close-add-modal" title="Close (Esc)">✕</button>
        </div>
        <div class="modal-body add-section-modal-body" style="padding:16px 20px 20px;display:flex;flex-direction:column;gap:12px;min-height:0;max-height:calc(90vh - 80px);overflow:hidden;">
          <!-- Search & Filter Controls -->
          <div class="add-section-toolbar" style="display:flex;flex-direction:column;gap:10px;background:rgba(15,23,42,0.75);border:1px solid rgba(51,65,85,0.7);border-radius:10px;padding:12px 14px;flex-shrink:0;">
            <div class="add-section-search-row" style="display:flex;align-items:center;gap:12px;">
              <div class="add-section-search-wrap" style="position:relative;flex:1;display:flex;align-items:center;">
                <span style="position:absolute;left:12px;font-size:0.95rem;pointer-events:none;opacity:0.7;">🔍</span>
                <input 
                  type="text" 
                  id="add-section-search-input" 
                  class="add-section-search-input" 
                  placeholder="Search widgets & add-ons by name or keyword (e.g. contact, hero, chat, pricing)..." 
                  autocomplete="off" 
                  spellcheck="false"
                  style="width:100%;padding:9px 34px 9px 36px;background:rgba(30,41,59,0.85);border:1px solid rgba(51,65,85,0.7);border-radius:7px;color:#fff;font-size:0.88rem;font-family:inherit;outline:none;box-sizing:border-box;"
                />
                <button type="button" id="add-section-search-clear" class="add-section-search-clear" style="display:none;position:absolute;right:8px;width:22px;height:22px;border-radius:50%;border:none;background:rgba(255,255,255,0.15);color:#fff;font-size:0.75rem;cursor:pointer;align-items:center;justify-content:center;" title="Clear search">✕</button>
              </div>
              <span id="add-section-status-badge" class="add-section-status-badge" style="font-size:0.75rem;font-weight:600;color:rgba(148,163,184,0.9);background:rgba(255,255,255,0.06);padding:6px 12px;border-radius:20px;white-space:nowrap;border:1px solid rgba(255,255,255,0.08);flex-shrink:0;">${totalCount} items</span>
            </div>
            <div class="add-section-filter-pills" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <button type="button" class="add-section-pill active" data-filter="all" style="border:1px solid rgba(99,102,241,1);background:rgba(99,102,241,1);color:#fff;font-size:0.78rem;font-weight:600;padding:5px 12px;border-radius:20px;cursor:pointer;">All (${totalCount})</button>
              <button type="button" class="add-section-pill" data-filter="addons" style="border:1px solid rgba(51,65,85,0.7);background:rgba(30,41,59,0.6);color:rgba(148,163,184,0.9);font-size:0.78rem;font-weight:600;padding:5px 12px;border-radius:20px;cursor:pointer;">🧩 Add-ons (${addonCount})</button>
              <button type="button" class="add-section-pill" data-filter="core" style="border:1px solid rgba(51,65,85,0.7);background:rgba(30,41,59,0.6);color:rgba(148,163,184,0.9);font-size:0.78rem;font-weight:600;padding:5px 12px;border-radius:20px;cursor:pointer;">⚡ Core Widgets (${coreCount})</button>
            </div>
          </div>

          <!-- Grid of Elements -->
          <div id="add-section-grid" class="add-section-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;max-height:460px;overflow-y:auto;padding:4px;">
            ${widgetsHtml}
            <div id="add-section-empty" class="add-section-empty" style="display:none;grid-column:1/-1;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:42px 16px;background:rgba(15,23,42,0.4);border:1px dashed rgba(51,65,85,0.7);border-radius:10px;">
              <div style="font-size:2.2rem;margin-bottom:8px;">🔍</div>
              <div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:4px;">No elements match "<span id="add-section-empty-term"></span>"</div>
              <div style="font-size:0.8rem;color:rgba(148,163,184,0.7);margin-bottom:14px;">Try searching with another keyword like <em>contact</em>, <em>hero</em>, <em>chat</em>, or <em>slider</em>.</div>
              <button type="button" class="btn btn-sm btn-secondary" id="add-section-reset-btn" style="padding:6px 16px;border-radius:6px;border:1px solid rgba(51,65,85,0.7);background:rgba(30,41,59,0.8);color:#fff;cursor:pointer;font-size:0.82rem;">Reset Search</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Elements & Filter Logic
    const searchInput = modal.querySelector('#add-section-search-input');
    const clearBtn = modal.querySelector('#add-section-search-clear');
    const statusBadge = modal.querySelector('#add-section-status-badge');
    const filterPills = modal.querySelectorAll('.add-section-pill');
    const cards = modal.querySelectorAll('.add-widget-card');
    const emptyState = modal.querySelector('#add-section-empty');
    const emptyTerm = modal.querySelector('#add-section-empty-term');
    const resetBtn = modal.querySelector('#add-section-reset-btn');

    let activeFilter = 'all';

    const filterElements = () => {
      const query = (searchInput.value || '').trim().toLowerCase();
      clearBtn.style.display = query ? 'flex' : 'none';

      let visibleCount = 0;
      const visibleCards = [];

      cards.forEach((card) => {
        const isAddon = card.getAttribute('data-is-addon') === '1';
        const name = card.getAttribute('data-name') || '';
        const cat = card.getAttribute('data-category') || '';
        const desc = card.getAttribute('data-desc') || '';
        const widgetType = card.getAttribute('data-widget') || '';

        // Category/tab filter
        let matchesTab = true;
        if (activeFilter === 'addons' && !isAddon) matchesTab = false;
        if (activeFilter === 'core' && isAddon) matchesTab = false;

        // Query search
        let matchesQuery = true;
        if (query) {
          const haystack = `${name} ${cat} ${desc} ${widgetType} ${isAddon ? 'addon add-on plugin' : 'core widget'}`;
          matchesQuery = haystack.includes(query);
        }

        if (matchesTab && matchesQuery) {
          card.style.display = '';
          visibleCount++;
          visibleCards.push(card);
        } else {
          card.style.display = 'none';
        }
      });

      // Update badge
      if (query) {
        statusBadge.textContent = `${visibleCount} found`;
        statusBadge.classList.add('has-filter');
      } else if (activeFilter === 'addons') {
        statusBadge.textContent = `${visibleCount} add-ons`;
        statusBadge.classList.remove('has-filter');
      } else if (activeFilter === 'core') {
        statusBadge.textContent = `${visibleCount} core widgets`;
        statusBadge.classList.remove('has-filter');
      } else {
        statusBadge.textContent = `${visibleCount} items`;
        statusBadge.classList.remove('has-filter');
      }

      // Empty state
      if (visibleCount === 0) {
        emptyState.style.display = 'flex';
        if (emptyTerm) emptyTerm.textContent = query || activeFilter;
      } else {
        emptyState.style.display = 'none';
      }

      return visibleCards;
    };

    searchInput.addEventListener('input', filterElements);

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchInput.focus();
      filterElements();
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        searchInput.value = '';
        activeFilter = 'all';
        filterPills.forEach((p) => {
          const isAll = p.getAttribute('data-filter') === 'all';
          p.classList.toggle('active', isAll);
          p.style.background = isAll ? 'rgba(99,102,241,1)' : 'rgba(30,41,59,0.6)';
          p.style.color = isAll ? '#fff' : 'rgba(148,163,184,0.9)';
          p.style.borderColor = isAll ? 'rgba(99,102,241,1)' : 'rgba(51,65,85,0.7)';
        });
        searchInput.focus();
        filterElements();
      });
    }

    filterPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        filterPills.forEach((p) => {
          p.classList.remove('active');
          p.style.background = 'rgba(30,41,59,0.6)';
          p.style.color = 'rgba(148,163,184,0.9)';
          p.style.borderColor = 'rgba(51,65,85,0.7)';
        });
        pill.classList.add('active');
        pill.style.background = 'rgba(99,102,241,1)';
        pill.style.color = '#fff';
        pill.style.borderColor = 'rgba(99,102,241,1)';
        activeFilter = pill.getAttribute('data-filter') || 'all';
        filterElements();
      });
    });

    // Enter key selects first visible card
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const visibleCards = filterElements();
        if (visibleCards.length > 0) {
          visibleCards[0].click();
        }
      }
    });

    // Keyboard and modal closing
    const closeModal = () => {
      modal.remove();
      document.removeEventListener('keydown', onKeydown);
    };

    const onKeydown = (e) => {
      if (e.key === 'Escape') {
        if (searchInput.value) {
          searchInput.value = '';
          filterElements();
        } else {
          closeModal();
        }
      }
    };
    document.addEventListener('keydown', onKeydown);

    modal.querySelector('#close-add-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const type = card.getAttribute('data-widget');
        state.addSection(type, insertAtIndex, beforeSectionId);
        closeModal();
        this.showToast(`Added ${WIDGET_REGISTRY[type]?.name || type} to page`, 'success');
      });
    });

    // Auto-focus search input with short timeout for smooth rendering
    setTimeout(() => {
      try {
        searchInput.focus();
      } catch (err) {}
    }, 60);
  }

  showToast(message, type = 'info') {
    let container = document.getElementById('wb-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'wb-toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `wb-toast toast-${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Seminar Schedule Displayer Interactive Slider & Google Sheets Sync
  initSeminarSchedules(container) {
    const scheduleWidgets = container.querySelectorAll('.wb-schedule-widget');
    scheduleWidgets.forEach((widget) => {
      this.setupScheduleSlider(widget);

      // Live Google Sheets Sync
      const dataSource = widget.getAttribute('data-source');
      const sheetUrl = widget.getAttribute('data-sheet-url');
      if (dataSource === 'google_sheets' && sheetUrl) {
        this.fetchGoogleSheetData(widget, sheetUrl);
      }
    });
  }

  // Payment Options Copy-to-Clipboard
  initPaymentOptions(container) {
    const copyBtns = container.querySelectorAll('.wb-pay-copy-btn');
    copyBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = btn.getAttribute('data-copy') || '';
        if (!text) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => {
            this._flashCopied(btn);
          }).catch(() => {
            this._fallbackCopy(text, btn);
          });
        } else {
          this._fallbackCopy(text, btn);
        }
      });
    });
  }

  _flashCopied(btn) {
    const copyText = btn.querySelector('.copy-text');
    const origLabel = copyText ? copyText.textContent : 'Copy';
    btn.classList.add('copied');
    if (copyText) copyText.textContent = 'Copied!';
    this.showToast('Account number copied to clipboard!', 'success');
    setTimeout(() => {
      btn.classList.remove('copied');
      if (copyText) copyText.textContent = origLabel;
    }, 2200);
  }

  _fallbackCopy(text, btn) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      ta.remove();
      this._flashCopied(btn);
    } catch (err) {
      this.showToast('Could not copy. Please copy manually.', 'error');
    }
  }

  setupScheduleSlider(widget) {
    const track = widget.querySelector('.wb-schedule-slider-track');
    const slides = widget.querySelectorAll('.wb-schedule-slide');
    const prevBtn = widget.querySelector('.wb-schedule-nav-btn.prev');
    const nextBtn = widget.querySelector('.wb-schedule-nav-btn.next');
    const dots = widget.querySelectorAll('.wb-schedule-dot');
    const pageInfo = widget.querySelector('.wb-schedule-page-info');
    const dayTabs = widget.querySelectorAll('.wb-schedule-day-tab');

    if (!track || slides.length === 0) return;

    let currentIndex = 0;
    const count = slides.length;
    const autoPlay = widget.getAttribute('data-autoplay') === 'true';
    const intervalTime = parseInt(widget.getAttribute('data-interval'), 10) || 5000;
    let timer = null;

    const updateUI = () => {
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === currentIndex));
      if (prevBtn) prevBtn.disabled = currentIndex === 0;
      if (nextBtn) nextBtn.disabled = currentIndex >= count - 1;
      if (pageInfo) {
        pageInfo.textContent = `Page ${currentIndex + 1} of ${count}`;
      }
      const currentSlide = slides[currentIndex];
      const currentDay = currentSlide?.getAttribute('data-day');
      if (currentDay && dayTabs.length > 0) {
        dayTabs.forEach((tab) => {
          tab.classList.toggle('active', tab.getAttribute('data-day') === currentDay);
        });
      }
    };

    const goTo = (index) => {
      currentIndex = Math.max(0, Math.min(index, count - 1));
      updateUI();
    };

    if (prevBtn) {
      prevBtn.onclick = (e) => {
        e.stopPropagation();
        goTo(currentIndex - 1);
        resetAutoPlay();
      };
    }

    if (nextBtn) {
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        goTo(currentIndex + 1);
        resetAutoPlay();
      };
    }

    dots.forEach((dot) => {
      dot.onclick = (e) => {
        e.stopPropagation();
        const target = parseInt(dot.getAttribute('data-slide'), 10) || 0;
        goTo(target);
        resetAutoPlay();
      };
    });

    dayTabs.forEach((tab) => {
      tab.onclick = (e) => {
        e.stopPropagation();
        const targetDay = tab.getAttribute('data-day');
        if (!targetDay || targetDay === 'all') {
          goTo(0);
          dayTabs.forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');
        } else {
          for (let i = 0; i < slides.length; i++) {
            if (slides[i].getAttribute('data-day') === targetDay) {
              goTo(i);
              break;
            }
          }
        }
        resetAutoPlay();
      };
    });

    const startAutoPlay = () => {
      if (!autoPlay || count <= 1) return;
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        currentIndex = (currentIndex + 1) % count;
        updateUI();
      }, intervalTime);
    };

    const resetAutoPlay = () => {
      if (timer) clearInterval(timer);
      startAutoPlay();
    };

    widget.onmouseenter = () => { if (timer) clearInterval(timer); };
    widget.onmouseleave = () => resetAutoPlay();

    updateUI();
    startAutoPlay();
  }

  async fetchGoogleSheetData(widget, sheetUrl) {
    try {
      let csvUrl = sheetUrl.trim();
      if (csvUrl.includes('/pubhtml')) {
        csvUrl = csvUrl.replace('/pubhtml', '/pub?output=csv');
      } else if (csvUrl.includes('/pub?') && !csvUrl.includes('output=csv')) {
        csvUrl += '&output=csv';
      } else {
        const match = csvUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1] && !csvUrl.includes('/export?')) {
          const docId = match[1];
          const gidMatch = csvUrl.match(/gid=([0-9]+)/);
          const gid = gidMatch ? gidMatch[1] : '0';
          csvUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gid}`;
        }
      }

      const res = await fetch(csvUrl);
      if (!res.ok) return;
      const csvText = await res.text();
      if (!csvText || csvText.includes('<!DOCTYPE html>')) return;

      const rows = this.parseCsv(csvText);
      if (rows.length < 2) return;

      const headers = rows[0].map((h) => h.toLowerCase().trim());
      const findCol = (terms) => headers.findIndex((h) => terms.some((t) => h.includes(t)));

      const dayIdx = findCol(['day', 'date']);
      const timeIdx = findCol(['time', 'hour', 'schedule']);
      const topicIdx = findCol(['topic', 'title', 'subject', 'session']);
      const lecturerIdx = findCol(['lecturer', 'speaker', 'faculty', 'presenter']);
      const areaIdx = findCol(['area', 'mcle', 'units', 'credit', 'category']);

      const items = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every((c) => !c.trim())) continue;
        items.push({
          day: dayIdx >= 0 ? (row[dayIdx] || '').trim() : '',
          time: timeIdx >= 0 ? (row[timeIdx] || '').trim() : '',
          topic: topicIdx >= 0 ? (row[topicIdx] || '').trim() : (row[0] || '').trim(),
          lecturer: lecturerIdx >= 0 ? (row[lecturerIdx] || '').trim() : (row[1] || '').trim(),
          subjectArea: areaIdx >= 0 ? (row[areaIdx] || '').trim() : (row[2] || '').trim()
        });
      }

      if (items.length > 0) {
        const badge = widget.querySelector('.wb-schedule-sync-badge');
        if (badge) {
          badge.innerHTML = `<span>🟢</span> Synced (${items.length} sessions)`;
        }
        const rowsPerSlide = parseInt(widget.getAttribute('data-rows-per-slide'), 10) || 4;
        this.rebuildScheduleSlides(widget, items, rowsPerSlide);
      }
    } catch (err) {
      console.warn('Google Sheets sync skipped:', err);
    }
  }

  parseCsv(text) {
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
    return p.filter((r) => r.length > 0 && r.some((c) => c.trim().length > 0));
  }

  rebuildScheduleSlides(widget, items, rowsPerSlide) {
    const track = widget.querySelector('.wb-schedule-slider-track');
    const dotsContainer = widget.querySelector('.wb-schedule-dots');
    const pageInfo = widget.querySelector('.wb-schedule-page-info');
    if (!track) return;

    // Read column widths from widget data attributes (set during render)
    const wTime = widget.getAttribute('data-col-w-time') || '20';
    const wTopic = widget.getAttribute('data-col-w-topic') || '35';
    const wLecturer = widget.getAttribute('data-col-w-lecturer') || '25';
    const wSubject = widget.getAttribute('data-col-w-subject') || '20';
    const aTime = widget.getAttribute('data-col-a-time') || 'left';
    const aTopic = widget.getAttribute('data-col-a-topic') || 'left';
    const aLecturer = widget.getAttribute('data-col-a-lecturer') || 'left';
    const aSubject = widget.getAttribute('data-col-a-subject') || 'left';

    const slides = [];
    for (let i = 0; i < items.length; i += rowsPerSlide) {
      slides.push(items.slice(i, i + rowsPerSlide));
    }
    if (slides.length === 0) slides.push([]);

    const slidesHtml = slides.map((slideRows, idx) => {
      const slideDay = slideRows[0]?.day || '';
      let lastDay = slideDay;
      const rowsHtml = slideRows.map((r, rIdx) => {
        let dayDividerHtml = '';
        if (rIdx > 0 && r.day && r.day !== lastDay) {
          lastDay = r.day;
          dayDividerHtml = `
            <tr class="wb-schedule-day-divider-row">
              <td colspan="4" style="background: rgba(99, 102, 241, 0.15); padding: 8px 18px; font-weight: 700; color: #a5b4fc; border-left: 3px solid var(--primary, #6366f1);">
                📅 ${r.day}
              </td>
            </tr>
          `;
        }
        return `
          ${dayDividerHtml}
          <tr>
            <td style="width: ${wTime}%; text-align: ${aTime};"><span class="wb-schedule-time-badge">🕒 ${r.time || 'TBA'}</span></td>
            <td style="width: ${wTopic}%; text-align: ${aTopic};"><span class="wb-schedule-topic">${r.topic || 'Session Topic'}</span></td>
            <td style="width: ${wLecturer}%; text-align: ${aLecturer};"><span class="wb-schedule-lecturer">👨 ${r.lecturer || 'Speaker'}</span></td>
            <td style="width: ${wSubject}%; text-align: ${aSubject};"><span class="wb-schedule-subject">${r.subjectArea || 'General'}</span></td>
          </tr>
        `;
      }).join('');

      return `
        <div class="wb-schedule-slide ${idx === 0 ? 'active' : ''}" data-slide-index="${idx}" data-day="${slideDay}">
          ${slideDay ? `<div class="wb-schedule-day-header">📅 ${slideDay}</div>` : ''}
          <div class="wb-schedule-table-wrap">
            <table class="wb-schedule-table">
              <thead>
                <tr>
                  <th style="width: ${wTime}%;">Time</th>
                  <th style="width: ${wTopic}%;">Topic / Session</th>
                  <th style="width: ${wLecturer}%;">Lecturer / Speaker</th>
                  <th style="width: ${wSubject}%;">MCLE Subject Area</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    track.innerHTML = slidesHtml;

    if (dotsContainer) {
      dotsContainer.innerHTML = slides.map((_, i) => `<span class="wb-schedule-dot ${i === 0 ? 'active' : ''}" data-slide="${i}"></span>`).join('');
    }
    if (pageInfo) {
      pageInfo.textContent = `Page 1 of ${slides.length} (${items.length} sessions)`;
    }

    this.setupScheduleSlider(widget);
  }

  // Lecturer Gallery Interactive Controls & Master-Detail Profile Modal
  initLecturerGalleries(container) {
    const widgets = container.querySelectorAll('.wb-lg-section');
    widgets.forEach((widget) => {
      // 1. Live Google Sheets Sync
      const dataSource = widget.getAttribute('data-data-source');
      const sheetUrl = widget.getAttribute('data-sheet-url');
      if (dataSource === 'google_sheets' && sheetUrl) {
        this.fetchGoogleSheetLecturers(widget, sheetUrl);
      }

      this.setupLecturerGalleryWidget(widget);
    });
  }

  async fetchGoogleSheetLecturers(widget, sheetUrl) {
    try {
      const items = await fetchGoogleSheetLecturers(sheetUrl);
      if (!items || items.length === 0) return;

      const badge = widget.querySelector('.wb-lg-sync-badge');
      if (badge) {
        badge.innerHTML = `<span>🟢</span> Synced from Google Sheets (${items.length} speakers)`;
      }

      this.rebuildLecturerGalleryContent(widget, items);
    } catch (err) {
      console.warn('Google Sheets lecturer sync skipped:', err);
    }
  }

  renderLecturerCardHtml(l, idx, uid, cardStyle = 'modern') {
    const photo = l.photoUrl
      ? `<img src="${l.photoUrl}" alt="${l.name || ''}" loading="lazy" />`
      : `<div class="wb-lg-avatar-placeholder">${(l.name || '?').charAt(0).toUpperCase()}</div>`;
    const topicTags = (l.topics || '').split(',').filter(t => t.trim()).map(t =>
      `<span class="wb-lg-topic-tag">${t.trim()}</span>`
    ).join('');
    const shortSummary = (l.summary || '').length > 100
      ? (l.summary || '').slice(0, 100) + '...'
      : (l.summary || '');

    return `
      <div class="wb-lg-card wb-lg-card--${cardStyle}" data-lg-idx="${idx}" data-lg-uid="${uid}">
        <div class="wb-lg-card-photo">${photo}</div>
        <div class="wb-lg-card-body">
          <div class="wb-lg-card-name">${l.name || 'Unnamed'}</div>
          <div class="wb-lg-card-topics">${topicTags || '<span class="wb-lg-topic-tag">General</span>'}</div>
          <div class="wb-lg-card-summary">${shortSummary || 'No summary provided.'}</div>
        </div>
        <div class="wb-lg-card-footer">
          <button class="wb-lg-view-btn" data-lg-idx="${idx}" data-lg-uid="${uid}">View Profile →</button>
        </div>
      </div>
    `;
  }

  rebuildLecturerGalleryContent(widget, items) {
    const uid = widget.getAttribute('data-lg-uid') || ('lg-' + Math.random().toString(36).slice(2, 8));
    widget.setAttribute('data-lecturers', encodeURIComponent(JSON.stringify(items)));

    // 1. Grid Mode
    const grid = widget.querySelector('.wb-lg-grid');
    if (grid) {
      grid.innerHTML = items.map((l, i) => this.renderLecturerCardHtml(l, i, uid)).join('');
    }

    // 2. List Mode
    const list = widget.querySelector('.wb-lg-list');
    if (list) {
      list.innerHTML = items.map((l, i) => {
        const photo = l.photoUrl
          ? `<img src="${l.photoUrl}" alt="${l.name || ''}" />`
          : `<div class="wb-lg-avatar-placeholder wb-lg-avatar-sm">${(l.name || '?').charAt(0).toUpperCase()}</div>`;
        const topicTags = (l.topics || '').split(',').filter(t => t.trim()).map(t =>
          `<span class="wb-lg-topic-tag wb-lg-topic-sm">${t.trim()}</span>`
        ).join('');
        return `
          <div class="wb-lg-list-row" data-lg-idx="${i}" data-lg-uid="${uid}"
               data-search-name="${(l.name || '').toLowerCase()}"
               data-search-topics="${(l.topics || '').toLowerCase()}">
            <div class="wb-lg-list-photo">${photo}</div>
            <div class="wb-lg-list-info">
              <div class="wb-lg-list-name">${l.name || 'Unnamed'}</div>
              <div class="wb-lg-list-topics">${topicTags}</div>
            </div>
            <button class="wb-lg-view-btn wb-lg-view-sm" data-lg-idx="${i}" data-lg-uid="${uid}">View Profile →</button>
          </div>
        `;
      }).join('');
    }

    // 3. Slider Mode
    const sliderWrap = widget.querySelector('.wb-lg-slider-wrap');
    const track = widget.querySelector('.wb-lg-slider-track');
    const dotsWrap = widget.querySelector('.wb-lg-slider-dots');
    if (track && sliderWrap) {
      const spv = parseInt(track.getAttribute('data-spv'), 10) || 3;
      const slideWidth = 100 / spv;
      track.setAttribute('data-total', items.length);
      track.style.width = `${(items.length / spv) * 100}%`;
      track.style.transform = 'translateX(0)';
      track.innerHTML = items.map((l, i) =>
        `<div class="wb-lg-slide" style="min-width:${slideWidth}%;max-width:${slideWidth}%;">${this.renderLecturerCardHtml(l, i, uid)}</div>`
      ).join('');

      if (dotsWrap) {
        const totalSlides = Math.ceil(items.length / spv);
        dotsWrap.innerHTML = Array.from({ length: totalSlides }, (_, i) =>
          `<span class="wb-lg-dot${i === 0 ? ' active' : ''}" data-slide="${i}" data-lg-uid="${uid}"></span>`
        ).join('');
      }
    }

    // 4. Initial placeholder mode replacement
    const placeholder = widget.querySelector('.wb-lg-loading-placeholder') || widget.querySelector('.wb-lg-empty');
    if (placeholder && !grid && !list && !sliderWrap) {
      const newGrid = document.createElement('div');
      newGrid.className = 'wb-lg-grid wb-lg-grid--3';
      newGrid.innerHTML = items.map((l, i) => this.renderLecturerCardHtml(l, i, uid)).join('');
      placeholder.replaceWith(newGrid);
    }

    // Re-bind click and interactive behaviors
    this.setupLecturerGalleryWidget(widget);
  }

  setupLecturerGalleryWidget(widget) {
    // 1. Retrieve lecturers dataset
    let lecturers = [];
    const dataAttr = widget.getAttribute('data-lecturers');
    if (dataAttr) {
      try {
        lecturers = JSON.parse(decodeURIComponent(dataAttr));
      } catch (e) {
        try { lecturers = JSON.parse(dataAttr); } catch (e2) {}
      }
    }
    if (!Array.isArray(lecturers) || lecturers.length === 0) return;

    // 2. Slider Mode Navigation & Autoplay
    const track = widget.querySelector('.wb-lg-slider-track');
    const prevBtn = widget.querySelector('.wb-lg-slider-prev');
    const nextBtn = widget.querySelector('.wb-lg-slider-next');
    const dots = widget.querySelectorAll('.wb-lg-dot');
    if (track) {
      const spv = parseInt(track.getAttribute('data-spv'), 10) || 3;
      const totalSlides = Math.ceil(lecturers.length / spv);
      let currentSlide = 0;

      const goToSlide = (idx) => {
        if (idx < 0) idx = totalSlides - 1;
        if (idx >= totalSlides) idx = 0;
        currentSlide = idx;
        track.style.transform = `translateX(-${idx * (100 / totalSlides)}%)`;
        dots.forEach((d, i) => d.classList.toggle('active', i === idx));
      };

      if (prevBtn) {
        prevBtn.onclick = (e) => {
          e.stopPropagation();
          goToSlide(currentSlide - 1);
        };
      }
      if (nextBtn) {
        nextBtn.onclick = (e) => {
          e.stopPropagation();
          goToSlide(currentSlide + 1);
        };
      }
      dots.forEach((dot) => {
        dot.onclick = (e) => {
          e.stopPropagation();
          const slideIdx = parseInt(dot.getAttribute('data-slide'), 10) || 0;
          goToSlide(slideIdx);
        };
      });

      const isAutoPlay = widget.getAttribute('data-autoplay') === 'true';
      const autoSpeed = (parseInt(widget.getAttribute('data-autoplay-speed'), 10) || 4) * 1000;
      if (isAutoPlay && totalSlides > 1) {
        let timer = setInterval(() => goToSlide(currentSlide + 1), autoSpeed);
        widget.onmouseenter = () => { if (timer) clearInterval(timer); };
        widget.onmouseleave = () => {
          if (timer) clearInterval(timer);
          timer = setInterval(() => goToSlide(currentSlide + 1), autoSpeed);
        };
      }
    }

    // 3. List Mode Live Search Filter
    const searchInput = widget.querySelector('.wb-lg-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => {
        e.stopPropagation();
        const q = searchInput.value.toLowerCase().trim();
        widget.querySelectorAll('.wb-lg-list-row').forEach((row) => {
          const name = (row.getAttribute('data-search-name') || '').toLowerCase();
          const topics = (row.getAttribute('data-search-topics') || '').toLowerCase();
          row.style.display = (!q || name.includes(q) || topics.includes(q)) ? 'flex' : 'none';
        });
      };
    }

    // 4. Click to View Profile Master-Detail Modal
    const modalListPos = widget.getAttribute('data-modal-list-pos') || 'left';
    const openModal = (initialIdx) => {
      this.openLecturerMasterDetailModal(lecturers, initialIdx, modalListPos);
    };

    widget.querySelectorAll('.wb-lg-view-btn').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-lg-idx'), 10) || 0;
        openModal(idx);
      };
    });

    widget.querySelectorAll('.wb-lg-card').forEach((card) => {
      card.onclick = (e) => {
        if (e.target.closest('.wb-lg-view-btn')) return;
        const idx = parseInt(card.getAttribute('data-lg-idx'), 10) || 0;
        openModal(idx);
      };
    });

    widget.querySelectorAll('.wb-lg-list-row').forEach((row) => {
      row.onclick = (e) => {
        if (e.target.closest('.wb-lg-view-btn')) return;
        const idx = parseInt(row.getAttribute('data-lg-idx'), 10) || 0;
        openModal(idx);
      };
    });
  }

  // Master-Detail Speaker Profile Modal (Left/Right Sidebar List with Search + Big Card with Fixed Bottom Controls)
  openLecturerMasterDetailModal(lecturers, initialIdx = 0, modalListPos = 'left') {
    const existing = document.getElementById('wb-lecturer-master-modal');
    if (existing) existing.remove();

    let activeIndex = Math.max(0, Math.min(initialIdx, lecturers.length - 1));

    const modal = document.createElement('div');
    modal.id = 'wb-lecturer-master-modal';
    modal.className = 'wb-lg-modal-overlay';

    modal.innerHTML = `
      <div class="wb-lg-modal wb-lg-modal--master-detail wb-lg-modal--list-${modalListPos}">
        <button class="wb-lg-modal-close" title="Close (Esc)">✕</button>
        
        <!-- Modal Top Bar -->
        <div class="wb-lg-modal-header">
          <div class="wb-lg-modal-header-title">
            <span class="wb-lg-modal-header-icon">🎓</span>
            <div>
              <h3>Lecturer & Speaker Directory</h3>
              <p class="wb-lg-modal-header-subtitle">Browse profiles, topics, and bios</p>
            </div>
          </div>
          <div class="wb-lg-modal-badge">${lecturers.length} Speakers</div>
        </div>

        <!-- Master-Detail Body -->
        <div class="wb-lg-modal-split">
          <!-- Sidebar (Searchbox + Clickable List) -->
          <div class="wb-lg-modal-sidebar">
            <div class="wb-lg-sidebar-search-box">
              <span class="wb-lg-sidebar-search-icon">🔍</span>
              <input type="text" class="wb-lg-sidebar-search-input" placeholder="Search name or topic..." />
            </div>
            <div class="wb-lg-sidebar-list"></div>
          </div>

          <!-- Detail View (Big Profile Card with Pinned Bottom Nav) -->
          <div class="wb-lg-modal-detail"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const closeBtn = modal.querySelector('.wb-lg-modal-close');
    const sidebarList = modal.querySelector('.wb-lg-sidebar-list');
    const searchInput = modal.querySelector('.wb-lg-sidebar-search-input');
    const detailPane = modal.querySelector('.wb-lg-modal-detail');

    const closeModal = () => {
      modal.classList.add('wb-lg-modal-closing');
      setTimeout(() => {
        modal.remove();
        document.body.style.overflow = '';
      }, 200);
      document.removeEventListener('keydown', handleKeyDown);
    };

    closeBtn.onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeModal();
      if (document.activeElement !== searchInput) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          switchSpeaker((activeIndex - 1 + lecturers.length) % lecturers.length);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          switchSpeaker((activeIndex + 1) % lecturers.length);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Render sidebar items
    const renderSidebarList = (filterQuery = '') => {
      const q = filterQuery.toLowerCase().trim();
      let matches = 0;

      const itemsHtml = lecturers.map((l, idx) => {
        const name = l.name || 'Unnamed';
        const topics = l.topics || '';
        const isMatch = !q || name.toLowerCase().includes(q) || topics.toLowerCase().includes(q);
        if (isMatch) matches++;

        const photo = l.photoUrl
          ? `<img src="${l.photoUrl}" alt="${name}" />`
          : `<div class="wb-lg-avatar-placeholder wb-lg-avatar-xs">${name.charAt(0).toUpperCase()}</div>`;

        const topicBadges = topics.split(',').filter(t => t.trim()).slice(0, 2).map(t =>
          `<span class="wb-lg-sidebar-topic-pill">${t.trim()}</span>`
        ).join('');

        return `
          <div class="wb-lg-sidebar-item ${idx === activeIndex ? 'is-active' : ''} ${!isMatch ? 'is-hidden' : ''}" 
               data-idx="${idx}">
            <div class="wb-lg-sidebar-avatar">${photo}</div>
            <div class="wb-lg-sidebar-info">
              <div class="wb-lg-sidebar-name">${name}</div>
              <div class="wb-lg-sidebar-topics">${topicBadges || '<span class="wb-lg-sidebar-topic-pill">Speaker</span>'}</div>
            </div>
            <span class="wb-lg-sidebar-arrow">›</span>
          </div>
        `;
      }).join('');

      sidebarList.innerHTML = itemsHtml || `
        <div class="wb-lg-sidebar-empty">
          <p>No lecturers match "${filterQuery}"</p>
        </div>
      `;

      sidebarList.querySelectorAll('.wb-lg-sidebar-item:not(.is-hidden)').forEach((item) => {
        item.onclick = (e) => {
          e.stopPropagation();
          const idx = parseInt(item.getAttribute('data-idx'), 10);
          switchSpeaker(idx);
        };
      });
    };

    // Render right detail big card with PINNED bottom navigation bar
    const renderDetailPane = (idx) => {
      const l = lecturers[idx] || {};
      const name = l.name || 'Unnamed';
      const topics = l.topics || '';
      const summary = l.summary || 'No summary or biography provided for this lecturer.';

      const photoHtml = l.photoUrl
        ? `<div class="wb-lg-detail-photo-frame"><img src="${l.photoUrl}" alt="${name}" class="wb-lg-detail-img" /></div>`
        : `<div class="wb-lg-detail-photo-frame wb-lg-detail-photo-empty"><div class="wb-lg-avatar-placeholder wb-lg-avatar-xl">${name.charAt(0).toUpperCase()}</div></div>`;

      const topicBadges = topics.split(',').filter(t => t.trim()).map(t =>
        `<span class="wb-lg-topic-tag wb-lg-topic-md">${t.trim()}</span>`
      ).join('') || '<span class="wb-lg-topic-tag wb-lg-topic-md">General</span>';

      detailPane.innerHTML = `
        <div class="wb-lg-detail-scroll-area">
          <div class="wb-lg-detail-card-top">
            <div class="wb-lg-detail-photo-col">
              ${photoHtml}
            </div>
            <div class="wb-lg-detail-info-col">
              <div class="wb-lg-detail-badge">Featured Speaker</div>
              <h2 class="wb-lg-detail-name">${name}</h2>
              <div class="wb-lg-detail-topics">${topicBadges}</div>
            </div>
          </div>

          <div class="wb-lg-detail-body">
            <div class="wb-lg-detail-section-title">
              <span>📖</span> Profile & Background Summary
            </div>
            <div class="wb-lg-detail-summary-text">
              ${summary.replace(/\n/g, '<br />')}
            </div>
          </div>
        </div>

        <!-- Fixed Bottom Navigation Bar -->
        <div class="wb-lg-detail-footer">
          <button class="wb-lg-detail-nav-btn wb-lg-detail-prev" title="Previous Speaker">
            ← Previous
          </button>
          <div class="wb-lg-detail-page-indicator">
            ${idx + 1} of ${lecturers.length}
          </div>
          <button class="wb-lg-detail-nav-btn wb-lg-detail-next" title="Next Speaker">
            Next →
          </button>
        </div>
      `;

      const prevBtn = detailPane.querySelector('.wb-lg-detail-prev');
      const nextBtn = detailPane.querySelector('.wb-lg-detail-next');
      if (prevBtn) {
        prevBtn.onclick = (e) => {
          e.stopPropagation();
          switchSpeaker((activeIndex - 1 + lecturers.length) % lecturers.length);
        };
      }
      if (nextBtn) {
        nextBtn.onclick = (e) => {
          e.stopPropagation();
          switchSpeaker((activeIndex + 1) % lecturers.length);
        };
      }
    };

    const switchSpeaker = (newIdx) => {
      activeIndex = newIdx;
      sidebarList.querySelectorAll('.wb-lg-sidebar-item').forEach((item) => {
        const itemIdx = parseInt(item.getAttribute('data-idx'), 10);
        item.classList.toggle('is-active', itemIdx === activeIndex);
        if (itemIdx === activeIndex) {
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
      renderDetailPane(activeIndex);
    };

    searchInput.oninput = (e) => {
      renderSidebarList(e.target.value);
    };

    renderSidebarList('');
    renderDetailPane(activeIndex);

    setTimeout(() => {
      const activeEl = sidebarList.querySelector('.wb-lg-sidebar-item.is-active');
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }, 50);
  }
}
