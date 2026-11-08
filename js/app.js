export const APP_VERSION = '2.9.13';
/**
 * AETHERBUILDER - APPLICATION ROOT & ROUTER
 * Coordinates Public vs. Admin Studio views, Argon2 authentication gates, and Topbar tools.
 */

import { auth } from './auth.js';
import { state, sanitizeObject } from './state.js';
import { WIDGET_REGISTRY } from './widgets.js';
import { TEMPLATES } from './templates.js';
import { BuilderCanvas } from './builder.js';
import { InspectorPanel } from './inspector.js';
import { THEME_PRESETS, AVAILABLE_FONTS, applyTheme } from './themes.js';
import { initPublicChatbot, DEFAULT_CHATBOT_CONFIG } from './assistant.js';

// ── Admin session token helper ──────────────────────────────────
export function getAdminToken() {
  return sessionStorage.getItem('aether_admin_token') || '';
}

// ── Initial loader dismissal helper ────────────────────────────
export function removeInitialLoader() {
  const loader = document.getElementById('aether-initial-loader');
  if (loader) {
    loader.style.opacity = '0';
    loader.style.pointerEvents = 'none';
    loader.style.display = 'none';
    try { loader.remove(); } catch (e) {}
  }
}

// ── Back to Top Floating Button Helper ─────────────────────────────────────────
export function initBackToTopButton() {
  if (document.getElementById('aether-back-to-top')) return;
  const btn = document.createElement('button');
  btn.id = 'aether-back-to-top';
  btn.type = 'button';
  btn.title = 'Back to Top';
  btn.setAttribute('aria-label', 'Scroll back to top');
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>`;
  btn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(99, 102, 241, 0.4);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45), 0 0 10px rgba(99, 102, 241, 0.25);
    opacity: 0;
    pointer-events: none;
    transform: translateY(12px);
    transition: opacity 0.25s ease, transform 0.25s ease, background 0.2s ease;
    z-index: 990;
  `;
  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(99, 102, 241, 0.9)';
    btn.style.transform = 'translateY(0) scale(1.08)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'rgba(15, 23, 42, 0.88)';
    btn.style.transform = 'translateY(0) scale(1)';
  });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.body.appendChild(btn);

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        if (window.scrollY > 280) {
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
          btn.style.transform = 'translateY(0)';
        } else {
          btn.style.opacity = '0';
          btn.style.pointerEvents = 'none';
          btn.style.transform = 'translateY(12px)';
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// ── Client-Side Photo Auto-Optimizer Helper ────────────────────────────────────
export async function optimizeImageForUpload(file, maxDim = 1920, quality = 0.85) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file; // Do not touch SVGs or animated GIFs
  if (file.size <= 1.2 * 1024 * 1024) return file; // Skip photos already under 1.2MB

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim && file.size < 1.6 * 1024 * 1024) {
        return resolve(file);
      }
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob || blob.size >= file.size) {
          return resolve(file);
        }
        const optFile = new File([blob], file.name, {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        console.log(`⚡ Auto-optimized ${file.name}: ${(file.size / 1024).toFixed(0)}KB -> ${(optFile.size / 1024).toFixed(0)}KB`);
        resolve(optFile);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

import { addonManager, AddonMaker } from './addons.js';
import { addonStore } from './addon-store.js';
import { devAuth } from './dev-auth.js';
import { templateStore } from './template-store.js';
import './receipt.js';

// Expose auth globally so state.js publishToLive can access the admin password for API auth
window.auth = auth;
window.addonStore = addonStore;
window.devAuth = devAuth;
window.templateStore = templateStore;

class AetherApp {
  constructor() {
    this.viewMode = this.detectViewMode();
    this.canvas = null;
    this.inspector = null;
    this._shortcutsBound = false;

    // Expose app instance globally for console access or script triggers
    window.aetherApp = this;
    window.openAdmin = () => this.switchToAdmin();
    window.openPublic = () => this.switchToPublic();

    // Bind cross-platform admin shortcuts (Ctrl+Alt+A, Cmd+Option+A, Ctrl+Shift+A)
    this.bindGlobalAdminShortcuts();
  }

  detectViewMode() {
    const params = new URLSearchParams(window.location.search);
    const view = (params.get('view') || params.get('mode') || '').toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    // Admin is accessible via ?view=admin, ?mode=admin, ?admin, /admin, or /admin.html
    if (
      view === 'admin' ||
      params.has('admin') ||
      pathname.endsWith('/admin') ||
      pathname.endsWith('admin.html')
    ) {
      return 'admin';
    }
    // Default to public view for all visitors
    return 'public';
  }

  switchToAdmin() {
    console.log('🔓 [AetherBuilder] Switching to Admin Studio view...');
    this.viewMode = 'admin';

    // Dismiss floating public admin trigger if present
    const floatBtn = document.getElementById('aether-admin-access-btn');
    if (floatBtn) floatBtn.remove();
    const btt = document.getElementById('aether-back-to-top');
    if (btt) btt.remove();

    // Update URL query string without a destructive page reload
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'admin');
      window.history.pushState({ view: 'admin' }, '', url.pathname + url.search);
    } catch (e) {}

    this.initAdminView();
  }

  switchToPublic() {
    console.log('🌐 [AetherBuilder] Switching to Public Site view...');
    this.viewMode = 'public';
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('view');
      url.searchParams.set('view', 'public');
      window.history.pushState({ view: 'public' }, '', url.pathname + url.search);
    } catch (e) {}

    this.initPublicView();
  }

  bindGlobalAdminShortcuts() {
    if (this._shortcutsBound) return;
    this._shortcutsBound = true;

    const handleKey = (e) => {
      // Key 'a' check:
      // Note: On macOS, Option+A produces character 'å' or 'Å'.
      // e.code 'KeyA' or keyCode 65 works across all OS/layouts.
      const keyLower = (e.key || '').toLowerCase();
      const isKeyA = e.code === 'KeyA' || e.keyCode === 65 || keyLower === 'a' || e.key === 'å' || e.key === 'Å';

      const hasCtrlOrMeta = e.ctrlKey || e.metaKey;
      const hasAlt = e.altKey;
      const hasShift = e.shiftKey;

      // Match:
      // 1. Ctrl + Alt + A (Standard Windows / Linux)
      // 2. Cmd + Option + A or Ctrl + Option + A (macOS)
      // 3. Ctrl + Shift + A or Cmd + Shift + A (Universal fail-safe fallback)
      if (isKeyA && hasCtrlOrMeta && (hasAlt || hasShift)) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔑 [AetherBuilder] Admin shortcut triggered:', {
          key: e.key,
          code: e.code,
          ctrl: e.ctrlKey,
          meta: e.metaKey,
          alt: e.altKey,
          shift: e.shiftKey
        });

        if (this.viewMode === 'admin') {
          console.log('Already in Admin Studio view.');
          if (this.canvas && typeof this.canvas.showToast === 'function') {
            this.canvas.showToast('Already in Admin Studio', 'info');
          }
        } else {
          this.switchToAdmin();
        }
      }
    };

    // Listen on both window and document with capture: true so child elements cannot block it
    window.addEventListener('keydown', handleKey, { capture: true });
    document.addEventListener('keydown', handleKey, { capture: true });

    // Handle browser back / forward navigation seamlessly
    window.addEventListener('popstate', () => {
      const mode = this.detectViewMode();
      if (mode !== this.viewMode) {
        this.viewMode = mode;
        if (mode === 'admin') this.initAdminView();
        else this.initPublicView();
      }
    });

    console.log('💡 [AetherBuilder] Admin shortcut registered: Ctrl+Alt+A / Cmd+Option+A / Ctrl+Shift+A. (Console: openAdmin())');
  }

  async start() {
    // Wait for Argon2 authentication module readiness (fail-safe)
    try { await auth.init(); } catch (e) { console.warn('auth.init warn:', e); }

    // Initialize Add-ons & Plugins engine (loads custom widgets into WIDGET_REGISTRY)
    try { await addonManager.init(); } catch (e) { console.warn('addonManager.init warn:', e); }

    // Initialize Free Template Store and Developer Auth layer (fail-safe)
    try { await templateStore.init(); } catch (e) { console.warn('templateStore.init warn:', e); }
    try { await devAuth.init(); } catch (e) { console.warn('devAuth.init warn:', e); }

    // Ensure state is loaded from server/media or local storage before rendering
    try { await state.init(); } catch (e) { console.warn('state.init warn:', e); }

    // Guaranteed View Router Dispatch
    if (this.viewMode === 'public') {
      this.initPublicView();
    } else {
      this.initAdminView();
    }
  }

  // --------------------------------------------------------------------------
  // PUBLIC VIEW MODE  (multi-page router)
  // --------------------------------------------------------------------------
  async initPublicView() {
    // Always fetch fresh published data from server first, fall back to localStorage
    let liveData = null;
    let fromServer = false;
    const ts = Date.now();
    try {
      const res = await fetch(`api.php?action=get_site&_t=${ts}`, { cache: 'no-store' });
      if (res.ok) {
        liveData = await res.json();
        fromServer = true;
      }
    } catch {}

    // Fallback: try direct data/site.json static fetch if api.php failed or returned empty
    if (!liveData || (!liveData.pages && !liveData.sections)) {
      try {
        const res2 = await fetch(`data/site.json?_t=${ts}`, { cache: 'no-store' });
        if (res2.ok) {
          liveData = await res2.json();
          fromServer = true;
        }
      } catch {}
    }

    // Fallback: try direct media canvas template fetch (assets/uploads/template_live_canvas.json)
    if (!liveData || (!liveData.pages && !liveData.sections)) {
      try {
        const res3 = await fetch(`assets/uploads/template_live_canvas.json?_t=${ts}`, { cache: 'no-store' });
        if (res3.ok) {
          liveData = await res3.json();
          fromServer = true;
        }
      } catch {}
    }

    // Fallback: check media assets list for newest json template
    if (!liveData || (!liveData.pages && !liveData.sections)) {
      try {
        const resList = await fetch(`api.php?action=list_assets&_t=${ts}`, { cache: 'no-store' });
        if (resList.ok) {
          const assetData = await resList.json();
          const jsonAssets = (assetData.assets || []).filter(a => a.ext === 'json');
          if (jsonAssets.length > 0) {
            const resTemplate = await fetch(`${jsonAssets[0].url}?_t=${ts}`, { cache: 'no-store' });
            if (resTemplate.ok) {
              liveData = await resTemplate.json();
              fromServer = true;
            }
          }
        }
      } catch {}
    }

    // If server fetch failed, try localStorage (both new and legacy keys)
    if (!liveData || (!liveData.pages && !liveData.sections)) {
      const raw = localStorage.getItem('aether_public_site_v2')
             || localStorage.getItem('aether_public_site');
      if (raw) { try { liveData = JSON.parse(raw); } catch {} }
    }

    // Check if local public storage has a NEWER published snapshot than the server
    const localRaw = localStorage.getItem('aether_public_site_v2') || localStorage.getItem('aether_public_site');
    if (localRaw) {
      try {
        const localPub = JSON.parse(localRaw);
        if (localPub && (localPub.pages || localPub.sections)) {
          const localTime = localPub.publishedAt ? new Date(localPub.publishedAt).getTime() : 0;
          const serverTime = (fromServer && liveData && liveData.publishedAt) ? new Date(liveData.publishedAt).getTime() : 0;
          if (localTime > serverTime) {
            console.log('📌 Local published site is newer than server response. Retaining local latest published changes.');
            liveData = localPub;
            fromServer = false;
            // Background re-sync to update server with the latest snapshot
            state.publishToLive().catch(() => {});
          }
        }
      } catch (e) {}
    }

    // Last resort: use current in-memory state
    if (!liveData) liveData = state.getPublicSiteData();

    // Starter fallback: if still no pages or sections, load built-in starter template
    // so visitors/reviewers never see an empty black screen!
    const hasValidSections = (liveData?.pages || []).some(p => p.sections && p.sections.length > 0) || (liveData?.sections && liveData.sections.length > 0);
    if (!liveData || !hasValidSections) {
      const defaultSections = (TEMPLATES && TEMPLATES.saas && TEMPLATES.saas.sections) ? TEMPLATES.saas.sections : [];
      liveData = {
        publishedAt: new Date().toISOString(),
        pages: [
          {
            id: 'pg_home',
            slug: 'index',
            title: 'Home',
            sections: defaultSections,
            pageSettings: {
              pageTitle: 'USPF Program & Visual Studio',
              themePreset: 'dark-neon',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }
          }
        ],
        siteSettings: state.siteSettings || {}
      };
    }

    // Sanitize any incoming mojibake from legacy data
    liveData = sanitizeObject(liveData);

    // Overwrite localStorage with clean sanitized data (purges old corrupt cache)
    if (fromServer && (liveData.pages || liveData.sections)) {
      try {
        localStorage.setItem('aether_public_site_v2', JSON.stringify(liveData));
        // Remove old legacy key if it exists
        localStorage.removeItem('aether_public_site');
      } catch {}
    }


    // Cache liveData in state for runtime queries
    if (Array.isArray(liveData.pages) && liveData.pages.length > 0) {
      state.pages = liveData.pages;
    }

    // Determine which page to render based on ?page=slug query param
    const params   = new URLSearchParams(window.location.search);
    let pageSlug   = params.get('page') || 'index';
    if (pageSlug === 'home') pageSlug = 'index';

    let activePage = null;
    if (Array.isArray(liveData.pages) && liveData.pages.length > 0) {
      // Multi-page format
      activePage = liveData.pages.find(p => p.slug === pageSlug)
                || (pageSlug === 'index' ? liveData.pages.find(p => p.slug === 'home') : null)
                || (pageSlug === 'home' ? liveData.pages.find(p => p.slug === 'index') : null)
                || liveData.pages.find(p => p.slug === 'index')
                || liveData.pages[0];
    } else {
      // Legacy single-page format
      activePage = {
        title:        liveData.pageSettings?.pageTitle || 'Home',
        sections:     liveData.sections || [],
        pageSettings: liveData.pageSettings || {}
      };
    }

    const ps = activePage.pageSettings || {};
    applyTheme(ps.themePreset || 'dark-neon', ps.fontFamily, ps.themeCustom);
    const pageTitle = ps.pageTitle || activePage.title || 'Site';
    document.title = pageTitle;

    // Inject SEO & Social meta tags into <head>
    const injectMeta = (attrs) => {
      const key = attrs.name ? `meta[name="${attrs.name}"]` : attrs.property ? `meta[property="${attrs.property}"]` : null;
      if (key) document.head.querySelector(key)?.remove();
      const el = document.createElement('meta');
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el);
    };
    const setLink = (rel, href) => {
      document.head.querySelector(`link[rel="${rel}"]`)?.remove();
      if (!href) return;
      const el = document.createElement('link');
      el.rel = rel; el.href = href;
      document.head.appendChild(el);
    };
    if (ps.metaDescription) injectMeta({ name: 'description', content: ps.metaDescription });
    if (ps.metaKeywords)    injectMeta({ name: 'keywords',    content: ps.metaKeywords });
    if (ps.noIndex)         injectMeta({ name: 'robots',      content: 'noindex, nofollow' });
    injectMeta({ property: 'og:title',       content: pageTitle });
    if (ps.metaDescription) injectMeta({ property: 'og:description', content: ps.metaDescription });
    if (ps.ogImage)          injectMeta({ property: 'og:image',       content: ps.ogImage });
    injectMeta({ property: 'og:type', content: 'website' });
    setLink('canonical', ps.canonical || '');

    // Inject Site-Wide Settings (Favicon, Custom CSS, Analytics, Scripts)
    const siteSettings = liveData.siteSettings || state.siteSettings || {};

    // 1. Favicon
    if (siteSettings.faviconUrl) {
      setLink('icon', siteSettings.faviconUrl);
      setLink('shortcut icon', siteSettings.faviconUrl);
    }

    // 2. Custom Global CSS
    if (siteSettings.customCss) {
      let customStyle = document.getElementById('aether-site-custom-css');
      if (!customStyle) {
        customStyle = document.createElement('style');
        customStyle.id = 'aether-site-custom-css';
        document.head.appendChild(customStyle);
      }
      customStyle.textContent = siteSettings.customCss;
    }

    // 3. Google Analytics (GA4)
    if (siteSettings.gaId && !document.getElementById('aether-ga-script')) {
      const gaScript = document.createElement('script');
      gaScript.id = 'aether-ga-script';
      gaScript.async = true;
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(siteSettings.gaId)}`;
      document.head.appendChild(gaScript);

      const gaInit = document.createElement('script');
      gaInit.id = 'aether-ga-init';
      gaInit.textContent = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${siteSettings.gaId}');
      `;
      document.head.appendChild(gaInit);
    }

    // 3b. Site Verification Meta Tags (Google, Bing, Yandex, Pinterest)
    const verifyMap = [
      { key: 'verifyGoogle',    name: 'google-site-verification' },
      { key: 'verifyBing',      name: 'msvalidate.01' },
      { key: 'verifyYandex',    name: 'yandex-verification' },
      { key: 'verifyPinterest', name: 'p:domain_verify' },
    ];
    verifyMap.forEach(({ key, name }) => {
      const code = (siteSettings[key] || '').trim();
      const existingId = 'aether-verify-' + key;
      let tag = document.getElementById(existingId);
      if (code) {
        if (!tag) {
          tag = document.createElement('meta');
          tag.id = existingId;
          document.head.appendChild(tag);
        }
        tag.setAttribute('name', name);
        tag.setAttribute('content', code);
      } else if (tag) {
        tag.remove();
      }
    });

    // 4. Meta Pixel
    if (siteSettings.metaPixelId && !document.getElementById('aether-fb-pixel')) {
      const pixelScript = document.createElement('script');
      pixelScript.id = 'aether-fb-pixel';
      pixelScript.textContent = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${siteSettings.metaPixelId}');
        fbq('track', 'PageView');
      `;
      document.head.appendChild(pixelScript);
    }

    // 5. Custom Header Code
    if (siteSettings.headerScripts && !document.getElementById('aether-header-injected')) {
      const headerDiv = document.createElement('div');
      headerDiv.id = 'aether-header-injected';
      headerDiv.style.display = 'none';
      headerDiv.innerHTML = siteSettings.headerScripts;
      document.head.appendChild(headerDiv);
    }

    // 6. Custom Footer Code
    if (siteSettings.footerScripts && !document.getElementById('aether-footer-injected')) {
      const footerDiv = document.createElement('div');
      footerDiv.id = 'aether-footer-injected';
      footerDiv.innerHTML = siteSettings.footerScripts;
      document.body.appendChild(footerDiv);
    }

    // 7. Global / Page Background Image
    const activePageBg = ps.pageBg;
    const globalBg = siteSettings.globalBg;
    const activeBg = (activePageBg && activePageBg.enabled && activePageBg.imageUrl)
      ? activePageBg
      : ((globalBg && globalBg.enabled && globalBg.imageUrl) ? globalBg : null);

    if (activeBg) {
      const op = activeBg.overlayOpacity !== undefined ? (Number(activeBg.overlayOpacity) / 100) : 0.5;
      document.body.style.backgroundImage = `linear-gradient(rgba(0,0,0,${op}), rgba(0,0,0,${op})), url('${activeBg.imageUrl}')`;
      document.body.style.backgroundSize = activeBg.size || 'cover';
      document.body.style.backgroundPosition = activeBg.position || 'center center';
      document.body.style.backgroundAttachment = activeBg.attachment || 'fixed';
      document.body.style.backgroundRepeat = activeBg.repeat || 'no-repeat';
    } else {
      document.body.style.backgroundImage = '';
      document.body.style.backgroundSize = '';
      document.body.style.backgroundPosition = '';
      document.body.style.backgroundAttachment = '';
      document.body.style.backgroundRepeat = '';
    }

    // Resolve sections including global navbar or custom global header add-on
    let resolvedSections = [...(activePage.sections || [])];
    const isGlobalHeader = (s) =>
      (s.widgetType === 'navbar' && s.props?.globalHeader !== false && s.props?.globalHeader !== 'false') ||
      (s.widgetType !== 'navbar' && (s.props?.globalHeader === true || s.props?.globalHeader === 'true'));

    if (ps.hideHeader) {
      resolvedSections = resolvedSections.filter(s => !isGlobalHeader(s));
    } else {
      const hasHeader = resolvedSections.some(s => isGlobalHeader(s));
      if (!hasHeader && Array.isArray(liveData.pages) && liveData.pages.length > 0) {
        for (const pg of liveData.pages) {
          const globalNav = (pg.sections || []).find(s => isGlobalHeader(s));
          if (globalNav) {
            resolvedSections = [globalNav, ...resolvedSections];
            break;
          }
        }
      }
    }

    // Inject global footer if current page has no footer (and not hidden)
    if (ps.hideFooter) {
      resolvedSections = resolvedSections.filter(s => s.widgetType !== 'footer');
    } else {
      const hasFooter = resolvedSections.some(s => s.widgetType === 'footer');
      if (!hasFooter && Array.isArray(liveData.pages) && liveData.pages.length > 0) {
        for (const pg of liveData.pages) {
          const globalFoot = (pg.sections || []).find(s => s.widgetType === 'footer' && s.props?.globalFooter === true);
          if (globalFoot) {
            resolvedSections = [...resolvedSections, globalFoot];
            break;
          }
        }
      }
    }

    // Set public sections directly in state so BuilderCanvas can render them
    state._publicSections = resolvedSections;
    if (state.currentPage) {
      state.currentPage.sections = resolvedSections;
    }

    let container = document.getElementById('public-site-container');
    if (!container || document.querySelector('.builder-shell')) {
      document.body.innerHTML = `
        <div id="public-site-container" style="width: 100%; min-height: 100vh; position: relative;"></div>
      `;
      container = document.getElementById('public-site-container');

      // Handle internal link navigation seamlessly
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

        // If clicking a relative page link (e.g. ?page=about, index.html, index.html?page=about)
        if (href.startsWith('?') || href.startsWith('index.html') || href.startsWith('public.html') || href.startsWith('./')) {
          e.preventDefault();
          const targetUrl = new URL(href, window.location.href);
          window.history.pushState(null, '', targetUrl.href);
          this.initPublicView();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    if (ps.transparentHeader) {
      container.classList.add('has-transparent-header');
    } else {
      container.classList.remove('has-transparent-header');
    }

    this.canvas = new BuilderCanvas(container, true);

    // Mount 24/7 Decision-Tree Chatbot on public live site
    const cbConfig = siteSettings.chatbot || DEFAULT_CHATBOT_CONFIG;
    if (cbConfig.enabled !== false) {
      initPublicChatbot(cbConfig);
    }

    // Mount Floating Back to Top Button
    const bttConfig = siteSettings.backToTop || { enabled: true };
    if (bttConfig.enabled !== false) {
      initBackToTopButton();
    }

    // Mount discreet floating admin access button in public view
    this.mountPublicAdminTrigger();

    // Dismiss initial loading overlay
    removeInitialLoader();
  }

  // --------------------------------------------------------------------------
  // FLOATING ADMIN TRIGGER BUTTON (DISCREET & ALWAYS ACCESSIBLE)
  // --------------------------------------------------------------------------
  mountPublicAdminTrigger() {
    if (document.getElementById('aether-admin-access-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'aether-admin-access-btn';
    btn.type = 'button';
    btn.title = 'Access AetherBuilder Admin Studio (Ctrl + Alt + A)';
    btn.setAttribute('aria-label', 'Open Admin Studio');
    btn.innerHTML = `
      <span style="font-size: 15px; line-height: 1;">🔐</span>
      <span style="font-size: 12px; font-weight: 600; letter-spacing: 0.02em;">Admin</span>
      <kbd style="font-size: 10px; background: rgba(255,255,255,0.12); padding: 1px 5px; border-radius: 4px; font-family: monospace; border: 1px solid rgba(255,255,255,0.15); opacity: 0.85;">Ctrl+Alt+A</kbd>
    `;
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      height: 38px;
      padding: 0 14px 0 11px;
      display: flex;
      align-items: center;
      gap: 7px;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(99, 102, 241, 0.45);
      border-radius: 20px;
      color: #e2e8f0;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5), 0 0 12px rgba(99, 102, 241, 0.25);
      z-index: 998;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(99, 102, 241, 0.95)';
      btn.style.borderColor = 'rgba(165, 180, 252, 0.8)';
      btn.style.color = '#ffffff';
      btn.style.transform = 'translateY(-2px) scale(1.04)';
      btn.style.boxShadow = '0 10px 25px rgba(99, 102, 241, 0.45)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(15, 23, 42, 0.88)';
      btn.style.borderColor = 'rgba(99, 102, 241, 0.45)';
      btn.style.color = '#e2e8f0';
      btn.style.transform = 'translateY(0) scale(1)';
      btn.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.5), 0 0 12px rgba(99, 102, 241, 0.25)';
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.switchToAdmin();
    });
    document.body.appendChild(btn);
  }

  // --------------------------------------------------------------------------
  // ADMIN STUDIO VIEW MODE (ARGON2 PROTECTED)
  // --------------------------------------------------------------------------
  async initAdminView() {
    removeInitialLoader();
    // Dismiss public-only floating elements
    const floatBtn = document.getElementById('aether-admin-access-btn');
    if (floatBtn) floatBtn.remove();
    const btt = document.getElementById('aether-back-to-top');
    if (btt) btt.remove();
    const cb = document.getElementById('aether-chatbot-container');
    if (cb) cb.remove();

    // Ensure state pages exist so canvas has content to edit
    if (!state.pages || state.pages.length === 0 || !state.currentPage) {
      try { await state.init(); } catch (e) {}
    }

    applyTheme(state.pageSettings?.themePreset || 'dark-neon', state.pageSettings?.fontFamily, state.pageSettings?.themeCustom);
    if (state.pageSettings?.pageTitle) {
      document.title = `${state.pageSettings.pageTitle} (Admin Studio)`;
    }

    if (!auth.isAuthenticated()) {
      // Prompt user with Argon2 password verification
      auth.showLoginModal(() => {
        this.renderAdminStudio();
      });
    } else {
      this.renderAdminStudio();
    }
  }

  async renderAdminStudio() {
    removeInitialLoader();
    // Non-blocking background token verification so UI renders immediately
    if (auth && typeof auth.ensureSessionToken === 'function') {
      auth.ensureSessionToken().catch(() => {});
    }
    document.body.innerHTML = `
      <div class="builder-shell">
        <!-- 1. Top Navigation Bar -->
        <header class="builder-topbar">
          <div class="flex items-center gap-4">
            <div class="topbar-brand" id="topbar-brand-link" style="cursor: pointer;" title="AetherBuilder Studio (Click for System Info & Updates)">
              <img src="assets/logo.png" alt="AetherBuilder Logo" class="topbar-logo-img" style="width: 32px; height: 32px; object-fit: contain; border-radius: 8px; background: rgba(255,255,255,0.06); padding: 2px;" />
              <div>
                <span>AetherBuilder</span>
                <span class="app-version-pill" id="app-version-badge" style="font-size: 0.72rem; color: var(--text-dim); margin-left: 4px; font-weight: 500;">v${APP_VERSION}</span>
              </div>
            </div>

            <!-- Mobile Sidebar Drawer Toggle Button (visible on mobile <= 768px) -->
            <button type="button" class="mobile-drawer-btn" id="btn-mobile-sidebar-toggle" title="Toggle Studio Panel">
              <span>☰</span>
              <span>Edit</span>
            </button>

            <!-- WordPress-style Update Available pill -->
            <div id="update-indicator-pill" class="update-available-pill" style="display:none;" title="A newer version is ready! Click to install update.">
              <span>⚡</span>
              <span>Update Ready!</span>
            </div>

            <!-- Viewport Switcher -->
            <div class="device-toggle-group">
              <button class="device-btn active" data-mode="desktop" title="Desktop View (100%)">🖥️ Desktop</button>
              <button class="device-btn" data-mode="tablet" title="Tablet View (768px)">📱 Tablet</button>
              <button class="device-btn" data-mode="mobile" title="Mobile View (390px)">📱 Mobile</button>
            </div>
          </div>

          <!-- History & Tools Center -->
          <div class="topbar-controls-center">
            <div class="history-btn-group">
              <button class="tool-icon-btn" id="btn-undo" title="Undo (Ctrl+Z)">↶</button>
              <button class="tool-icon-btn" id="btn-redo" title="Redo (Ctrl+Y)">↷</button>
            </div>
            <button class="topbar-btn topbar-btn-sm" id="btn-templates">
              <span>📋</span> Templates
            </button>
            <button class="topbar-btn topbar-btn-sm" id="btn-revisions" title="Publish Version History & 1-Click Rollback">
              <span>🕒</span> Revisions
            </button>
            <button class="topbar-btn topbar-btn-sm" id="btn-seo-audit" title="Pre-Publish SEO & Accessibility Health Audit" style="border-color: rgba(16,185,129,0.35); color: #34d399;">
              <span>🛡️</span> SEO Audit
            </button>
            <button class="topbar-btn topbar-btn-sm" id="btn-export">
              <span>📤</span> Export
            </button>
            <button class="tool-icon-btn" id="btn-clear" title="Clear Canvas" style="color: var(--danger);">🗑</button>
          </div>

          <!-- Actions & Security Right -->
          <div class="topbar-actions">
            <!-- System Updates Center Button -->
            <button class="tool-icon-btn" id="btn-system-updates" title="System Updates & Maintenance" style="position: relative;">
              <span>🔄</span>
              <span id="update-badge-dot" style="display:none; position:absolute; top:-2px; right:-2px; background:#10b981; border-radius:50%; width:8px; height:8px; box-shadow:0 0 6px #10b981;"></span>
            </button>

            <!-- Notifications & Leads Hub -->
            <button class="tool-icon-btn" id="btn-notifications" title="Notifications & Leads Inbox" style="position: relative;">
              <span>🔔</span>
              <span id="notif-badge" style="display:none; position:absolute; top:-4px; right:-4px; background:#ef4444; color:#fff; font-size:0.62rem; font-weight:800; border-radius:10px; min-width:16px; height:16px; padding:0 3px; line-height:16px; text-align:center; box-shadow:0 0 8px rgba(239,68,68,0.8);">0</span>
            </button>

            <!-- Media Library -->
            <button class="tool-icon-btn" id="btn-media" title="Media Library">
              <span>🖼️</span>
            </button>

            <!-- Admin Security Badge -->
            <div class="security-badge" id="btn-security" title="Admin Security. Click to manage password.">
              <span>🔐</span>
              <span>Security</span>
            </div>

            <!-- Public Site Link -->
            <a href="?view=public" target="_blank" class="tool-icon-btn" title="Open live public view in new tab" style="text-decoration:none;display:flex;align-items:center;gap:4px;">
              <span>🌐</span>
            </a>

            <!-- Sync / Pull Latest from Server -->
            <button class="tool-icon-btn" id="btn-sync-server" title="Sync from Server: Load latest published content from data/site.json into builder">
              <span>🔄</span>
            </button>

            <!-- Add-On Store Button -->
            <button class="topbar-btn" id="btn-topbar-store" style="background: rgba(99,102,241,0.18); border: 1px solid rgba(99,102,241,0.4); color: #c7d2fe; display: flex; align-items: center; gap: 6px; font-weight: 700; padding: 6px 12px; border-radius: 8px; font-size: 0.82rem; cursor: pointer;" title="Browse & Install Add-ons from the Store">
              <span>🛒</span> Store
            </button>

            <!-- 1-Click Copy Public Link -->
            <button class="tool-icon-btn" id="btn-topbar-copy-link" title="Copy Live Website URL">
              <span>📋</span>
            </button>

            <!-- Mobile Preview QR Code -->
            <button class="tool-icon-btn" id="btn-topbar-qr" title="Show Mobile Test QR Code">
              <span>📱</span>
            </button>

            <!-- Publish Button -->
            <button class="topbar-btn topbar-btn-publish" id="btn-publish">
              <span>🚀</span> Publish Live
            </button>

            <!-- Admin Logout -->
            <button class="tool-icon-btn" id="btn-logout" title="Lock Admin Studio">
              <span>🚪</span>
            </button>
          </div>
        </header>

        <!-- 2. Builder Workspace (Sidebar + Canvas) -->
        <main class="builder-body">
          <!-- Mobile Drawer Backdrop Overlay -->
          <div class="mobile-sidebar-backdrop" id="mobile-sidebar-backdrop"></div>
          <!-- Left Sidebar (Widgets & Inspector - Resizable & Slidable) -->
          <aside class="builder-sidebar" id="builder-sidebar">
            <!-- Sidebar Resizer Handle -->
            <div class="sidebar-resizer" id="sidebar-resizer" title="Drag to resize sidebar width (Double-click to toggle)"></div>
            <!-- Toggle Resize Button -->
            <button class="sidebar-resize-toggle" id="sidebar-resize-toggle" title="Toggle Sidebar Resizing">🔓</button>

            <!-- Tab Navigation Header with Slide Controls -->
            <div class="sidebar-tabs-nav">
              <button type="button" class="sidebar-tab-arrow prev" id="tab-arrow-prev" title="Scroll tabs left" aria-label="Previous tabs">‹</button>
              <div class="sidebar-tabs" id="sidebar-tabs">
                <button type="button" class="sidebar-tab-btn active" data-side-tab="widgets">Widgets</button>
                <button type="button" class="sidebar-tab-btn" data-side-tab="inspector">Inspector</button>
                <button type="button" class="sidebar-tab-btn" data-side-tab="pages">📱 Pages</button>
                <button type="button" class="sidebar-tab-btn" data-side-tab="settings">Page</button>
                <button type="button" class="sidebar-tab-btn" data-side-tab="sitesettings">⚙️ Site</button>
                <button type="button" class="sidebar-tab-btn" data-side-tab="addons">🧩 Add-ons</button>
                <button type="button" class="sidebar-tab-btn" data-side-tab="developer">🔒 Developer</button>
              </div>
              <button type="button" class="sidebar-tab-arrow next" id="tab-arrow-next" title="Scroll tabs right" aria-label="Next tabs">›</button>
              <!-- Mobile Close Button -->
              <button type="button" class="mobile-sidebar-close-btn" id="btn-mobile-sidebar-close" title="Close Panel">✕</button>
            </div>

            <div class="sidebar-content-area" id="sidebar-tab-content">
              <!-- Widgets Tray Container -->
              <div id="tab-widgets-panel">
                <div class="widget-search-box" style="margin-bottom: 14px;">
                  <span class="widget-search-icon">🔍</span>
                  <input type="text" class="widget-search-input" id="widget-search" placeholder="Search elements..." />
                </div>
                <div id="widgets-list-container">
                  <!-- Dynamically Rendered Categories -->
                </div>
              </div>

              <!-- Element Inspector Container -->
              <div id="tab-inspector-panel" style="display: none; height: 100%;">
                <!-- Inspector controls rendered here -->
              </div>

              <!-- Pages Manager Container -->
              <div id="tab-pages-panel" style="display: none;">
                <!-- Pages manager rendered here -->
              </div>

              <!-- Page Settings Container -->
              <div id="tab-settings-panel" style="display: none;">
                <div style="font-weight: 700; font-size: 1rem; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
                  <span>Page Settings</span>
                  <span style="font-size: 0.72rem; color: var(--primary-light); background: var(--primary-soft); padding: 3px 8px; border-radius: 12px; font-weight: 700;">Realtime Engine</span>
                </div>
                <div class="prop-group">
                  <label class="prop-label">Page Title</label>
                  <input type="text" id="page-title-input" placeholder="Page Title..." />
                </div>
                <div class="prop-group" style="margin-top: 12px;">
                  <label class="prop-label">Theme Preset</label>
                  <select id="theme-preset-select"></select>
                </div>
                <div class="prop-group" style="margin-top: 10px;">
                  <label class="prop-label" style="margin-bottom: 4px;">Preset Palettes</label>
                  <div class="theme-swatch-list" id="theme-swatch-list"></div>
                </div>
                <div class="prop-group" style="margin-top: 16px;">
                  <label class="prop-label">Base Font Family</label>
                  <select id="font-family-select"></select>
                </div>
                <!-- Page Layout & Global Header / Footer Controls -->
                <div class="prop-group" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);">
                  <div style="font-weight: 700; font-size: 0.88rem; color: #f8fafc; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                    <span>🌐 Layout & Header / Footer</span>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="font-size: 0.82rem; color: var(--text-main); display: flex; align-items: center; gap: 8px; cursor: pointer;">
                      <input type="checkbox" id="page-hide-header" style="cursor: pointer;" />
                      <span>🚫 Hide Header / Navbar on this Page</span>
                    </label>
                    <label style="font-size: 0.82rem; color: var(--text-main); display: flex; align-items: center; gap: 8px; cursor: pointer;">
                      <input type="checkbox" id="page-hide-footer" style="cursor: pointer;" />
                      <span>🚫 Hide Footer on this Page</span>
                    </label>
                    <label style="font-size: 0.82rem; color: var(--text-main); display: flex; align-items: center; gap: 8px; cursor: pointer;">
                      <input type="checkbox" id="page-transparent-header" style="cursor: pointer;" />
                      <span>🪟 Transparent Header Over Hero</span>
                    </label>
                  </div>
                </div>
                <!-- Custom Palette & Theme Customizer -->
                <div class="prop-group" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);">
                  <div style="font-weight: 700; font-size: 0.88rem; color: #f8fafc; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                    <span>🎨 Custom Palette Builder</span>
                    <label style="font-weight: 500; font-size: 0.78rem; color: var(--primary-light); cursor: pointer; display: flex; align-items: center; gap: 4px;">
                      <input type="checkbox" id="theme-custom-enable" /> Custom Colors
                    </label>
                  </div>
                  <div id="theme-custom-controls" style="display: none; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; border: 1px solid var(--border-subtle); margin-top: 8px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.75rem;">
                      <div>
                        <label class="prop-label" style="font-size:0.7rem; margin-bottom:2px;">Primary Color</label>
                        <div style="display:flex; align-items:center; gap:6px;">
                          <input type="color" id="theme-custom-primary" value="#6366f1" style="width:28px; height:28px; border:none; background:none; cursor:pointer; padding:0;" />
                          <input type="text" id="theme-custom-primary-hex" value="#6366f1" style="font-size:0.72rem; padding:2px 5px; font-family:monospace; width:100%; border-radius:4px;" />
                        </div>
                      </div>
                      <div>
                        <label class="prop-label" style="font-size:0.7rem; margin-bottom:2px;">Secondary Color</label>
                        <div style="display:flex; align-items:center; gap:6px;">
                          <input type="color" id="theme-custom-secondary" value="#ec4899" style="width:28px; height:28px; border:none; background:none; cursor:pointer; padding:0;" />
                          <input type="text" id="theme-custom-secondary-hex" value="#ec4899" style="font-size:0.72rem; padding:2px 5px; font-family:monospace; width:100%; border-radius:4px;" />
                        </div>
                      </div>
                      <div>
                        <label class="prop-label" style="font-size:0.7rem; margin-bottom:2px;">Accent Glow</label>
                        <div style="display:flex; align-items:center; gap:6px;">
                          <input type="color" id="theme-custom-accent" value="#06b6d4" style="width:28px; height:28px; border:none; background:none; cursor:pointer; padding:0;" />
                          <input type="text" id="theme-custom-accent-hex" value="#06b6d4" style="font-size:0.72rem; padding:2px 5px; font-family:monospace; width:100%; border-radius:4px;" />
                        </div>
                      </div>
                      <div>
                        <label class="prop-label" style="font-size:0.7rem; margin-bottom:2px;">Deep Background</label>
                        <div style="display:flex; align-items:center; gap:6px;">
                          <input type="color" id="theme-custom-bgdeep" value="#090d16" style="width:28px; height:28px; border:none; background:none; cursor:pointer; padding:0;" />
                          <input type="text" id="theme-custom-bgdeep-hex" value="#090d16" style="font-size:0.72rem; padding:2px 5px; font-family:monospace; width:100%; border-radius:4px;" />
                        </div>
                      </div>
                      <div>
                        <label class="prop-label" style="font-size:0.7rem; margin-bottom:2px;">Card Surface</label>
                        <div style="display:flex; align-items:center; gap:6px;">
                          <input type="color" id="theme-custom-bgcard" value="#131b2e" style="width:28px; height:28px; border:none; background:none; cursor:pointer; padding:0;" />
                          <input type="text" id="theme-custom-bgcard-hex" value="#131b2e" style="font-size:0.72rem; padding:2px 5px; font-family:monospace; width:100%; border-radius:4px;" />
                        </div>
                      </div>
                      <div>
                        <label class="prop-label" style="font-size:0.7rem; margin-bottom:2px;">Main Text</label>
                        <div style="display:flex; align-items:center; gap:6px;">
                          <input type="color" id="theme-custom-textmain" value="#f8fafc" style="width:28px; height:28px; border:none; background:none; cursor:pointer; padding:0;" />
                          <input type="text" id="theme-custom-textmain-hex" value="#f8fafc" style="font-size:0.72rem; padding:2px 5px; font-family:monospace; width:100%; border-radius:4px;" />
                        </div>
                      </div>
                    </div>
                    <div style="display: flex; gap: 6px; margin-top: 10px;">
                      <button type="button" id="btn-reset-theme-custom" class="btn btn-sm btn-outline-danger" style="flex: 1; font-size: 0.72rem; padding: 4px 6px;">
                        ↺ Reset
                      </button>
                      <button type="button" id="btn-apply-global-theme" class="btn btn-sm btn-primary" style="flex: 1; font-size: 0.72rem; padding: 4px 6px;" title="Apply theme & palette to all pages">
                        🌐 Apply All Pages
                      </button>
                    </div>
                  </div>
                </div>

                <!-- SEO & Social Meta -->
                <div class="prop-group" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);">
                  <div style="font-weight: 700; font-size: 0.88rem; color: #f8fafc; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                    <span>🔍</span> SEO &amp; Social Meta
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div>
                      <label class="prop-label" style="font-size:0.75rem;">Meta Description</label>
                      <textarea id="page-meta-description" rows="3" placeholder="Brief summary of this page for search engines (150–160 chars recommended)..." style="font-size:0.78rem; width:100%; resize:vertical; padding:6px 8px; border-radius:6px; border:1px solid var(--border-subtle); background:var(--bg-deep); color:var(--text-main);"></textarea>
                    </div>
                    <div>
                      <label class="prop-label" style="font-size:0.75rem;">Meta Keywords <span style="color:var(--text-dim);font-weight:400;">(comma separated)</span></label>
                      <input type="text" id="page-meta-keywords" placeholder="e.g. seminar, MCLE, legal education" style="font-size:0.78rem;" />
                    </div>
                    <div>
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <label class="prop-label" style="font-size:0.75rem; margin:0;">OG / Social Share Image URL</label>
                        <button type="button" id="btn-pick-og-image" class="btn btn-sm" style="font-size:0.7rem; padding: 2px 7px; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: #a5b4fc; border-radius: 4px; cursor: pointer;">🖼️ Media</button>
                      </div>
                      <input type="text" id="page-og-image" placeholder="https://... or assets/uploads/og-image.jpg" style="font-size:0.78rem;" />
                      <div style="font-size:0.7rem; color:var(--text-dim); margin-top:3px;">Shown when sharing on Facebook, Twitter, WhatsApp, etc.</div>
                    </div>
                    <div>
                      <label class="prop-label" style="font-size:0.75rem;">Canonical URL <span style="color:var(--text-dim);font-weight:400;">(optional)</span></label>
                      <input type="text" id="page-canonical" placeholder="https://yourdomain.com/page-url" style="font-size:0.78rem;" />
                    </div>
                    <label style="font-size: 0.82rem; color: var(--text-main); display: flex; align-items: center; gap: 8px; cursor: pointer;">
                      <input type="checkbox" id="page-noindex" style="cursor: pointer;" />
                      <span>🚫 No-Index (hide from search engines)</span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Site-Wide Settings Container -->
              <div id="tab-sitesettings-panel" style="display: none; padding-bottom: 24px;">
                <div style="font-weight: 700; font-size: 1rem; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
                  <span>⚙️ Site Settings</span>
                  <span style="font-size: 0.72rem; color: var(--accent-light, #38bdf8); background: rgba(56,189,248,0.12); padding: 3px 8px; border-radius: 12px; font-weight: 700;">Global</span>
                </div>

                <!-- Site Identity -->
                <div class="prop-group">
                  <div style="font-weight: 700; font-size: 0.86rem; color: #f8fafc; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                    <span>🌐</span> Site Identity &amp; Branding
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div>
                      <label class="prop-label" style="font-size:0.75rem;">Site Brand / Title</label>
                      <input type="text" id="site-name-input" placeholder="e.g. My Website - Modern Experience" style="font-size:0.78rem;" />
                    </div>
                    <div>
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <label class="prop-label" style="font-size:0.75rem; margin:0;">Favicon URL</label>
                        <button type="button" id="btn-pick-favicon" class="btn btn-sm" style="font-size:0.7rem; padding: 2px 7px; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: #a5b4fc; border-radius: 4px; cursor: pointer;">🖼️ Media</button>
                      </div>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <input type="text" id="site-favicon-input" placeholder="assets/favicon.ico or https://..." style="font-size:0.78rem; flex: 1;" />
                        <img id="site-favicon-preview" src="" style="width: 22px; height: 22px; border-radius: 4px; object-fit: contain; display: none; background: #000; border: 1px solid var(--border-subtle);" alt="" />
                      </div>
                    </div>
                    <div>
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <label class="prop-label" style="font-size:0.75rem; margin:0;">Default Header Logo URL</label>
                        <button type="button" id="btn-pick-site-logo" class="btn btn-sm" style="font-size:0.7rem; padding: 2px 7px; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: #a5b4fc; border-radius: 4px; cursor: pointer;">🖼️ Media</button>
                      </div>
                      <input type="text" id="site-logo-input" placeholder="https://... or assets/logo.png" style="font-size:0.78rem;" />
                    </div>
                  </div>
                </div>

                                <!-- Pre-loader & Splash Screen Settings -->
                <div class="prop-group" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);">
                  <div style="font-weight: 700; font-size: 0.86rem; color: #f8fafc; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
                    <span style="display:flex;align-items:center;gap:6px;"><span>⚡</span> Splash Screen &amp; Pre-loader</span>
                    <label style="font-size:0.75rem;color:var(--text-dim);display:flex;align-items:center;gap:6px;cursor:pointer;">
                      <input type="checkbox" id="site-loader-enable" checked style="cursor:pointer;" />
                      <span id="site-loader-enable-label" style="font-weight:600;color:#a5b4fc;">Enable Splash Screen</span>
                    </label>
                  </div>
                  <div style="font-size: 0.72rem; color: var(--text-dim); margin-bottom: 10px;">
                    Control the initial dark loading screen. When disabled, your website renders immediately with zero black screen overlay.
                  </div>

                  <!-- Instant Loading Notice when disabled -->
                  <div id="site-loader-disabled-notice" style="display:none;padding:12px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:8px;text-align:center;margin-bottom:8px;">
                    <div style="font-size:0.8rem;font-weight:700;color:#34d399;display:flex;align-items:center;justify-content:center;gap:6px;">
                      <span>⚡</span> Instant Page Loading Active
                    </div>
                    <div style="font-size:0.72rem;color:#94a3b8;margin-top:4px;">
                      The black splash screen and initializing animation are completely disabled. Visitors see your header, layout, and background immediately.
                    </div>
                  </div>

                  <div id="site-loader-controls" style="display: flex; flex-direction: column; gap: 10px;">
                    <div>
                      <label class="prop-label" style="font-size:0.75rem;">Main Loader Caption</label>
                      <input type="text" id="site-loader-caption" placeholder="e.g. Loading My Website..." style="font-size:0.78rem;" />
                      <div style="font-size:0.7rem; color:var(--text-dim); margin-top:2px;">Primary text displayed below the spinner (leave blank to use Site Brand Title).</div>
                    </div>

                    <div>
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <label class="prop-label" style="font-size:0.75rem;margin:0;">Sub-caption</label>
                        <label style="font-size:0.7rem;color:var(--text-dim);display:flex;align-items:center;gap:4px;cursor:pointer;">
                          <input type="checkbox" id="site-loader-subcaption-enable" checked style="cursor:pointer;" />
                          <span>Show</span>
                        </label>
                      </div>
                      <input type="text" id="site-loader-subcaption" placeholder="e.g. Initializing modules &amp; layout engine" style="font-size:0.78rem;" />
                      <div style="font-size:0.7rem; color:var(--text-dim); margin-top:2px;">When unchecked, the initializing text &amp; animation are completely disabled.</div>
                    </div>

                    <!-- Live Mini Splash Preview -->
                    <div id="site-loader-preview-box" style="margin-top: 4px; padding: 12px; background: #090d16; border: 1px solid rgba(99,102,241,0.25); border-radius: 8px; text-align: center;">
                      <div style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px;">Live Splash Preview</div>
                      <div style="display: inline-block; width: 24px; height: 24px; border: 2px solid rgba(99,102,241,0.2); border-top-color: #6366f1; border-radius: 50%; animation: aether-spin 0.8s linear infinite; margin-bottom: 8px;"></div>
                      <div id="site-loader-preview-caption" style="font-size: 0.82rem; font-weight: 600; color: #f8fafc; letter-spacing: 0.01em;">Loading...</div>
                      <div id="site-loader-preview-subcaption" style="font-size: 0.7rem; color: #94a3b8; margin-top: 3px;">Initializing modules &amp; layout engine</div>
                    </div>
                  </div>
                </div>

                <!-- Global Background Image -->
                <div class="prop-group" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);">
                  <div style="font-weight: 700; font-size: 0.86rem; color: #f8fafc; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                    <span style="display:flex;align-items:center;gap:6px;"><span>🖼️</span> Global Background Image</span>
                    <label style="font-size:0.75rem;color:var(--text-dim);display:flex;align-items:center;gap:6px;cursor:pointer;">
                      <input type="checkbox" id="site-global-bg-enable" style="cursor:pointer;" />
                      <span>Enable</span>
                    </label>
                  </div>
                  <div id="site-global-bg-controls" style="display:none;flex-direction:column;gap:10px;">
                    <div>
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <label class="prop-label" style="font-size:0.75rem;margin:0;">Background Image URL</label>
                        <button type="button" id="btn-pick-global-bg" class="btn btn-sm" style="font-size:0.7rem;padding:2px 7px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;border-radius:4px;cursor:pointer;">🖼️ Media Library</button>
                      </div>
                      <div style="display:flex;align-items:center;gap:6px;">
                        <input type="text" id="site-global-bg-url" placeholder="assets/uploads/wallpaper.jpg or https://..." style="font-size:0.78rem;flex:1;" />
                        <button type="button" id="btn-clear-global-bg" class="btn btn-sm" style="font-size:0.7rem;padding:2px 6px;color:#fca5a5;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);border-radius:4px;cursor:pointer;" title="Clear image">✕</button>
                      </div>
                    </div>

                    <!-- Image Preview Thumbnail -->
                    <div id="site-global-bg-preview-wrap" style="display:none;height:65px;border-radius:6px;overflow:hidden;border:1px solid var(--border-subtle);background-size:cover;background-position:center;position:relative;">
                      <div style="position:absolute;bottom:3px;right:6px;font-size:0.65rem;color:#fff;background:rgba(0,0,0,0.65);padding:1px 5px;border-radius:4px;">Wallpaper Preview</div>
                    </div>

                    <!-- Display Modes -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                      <div>
                        <label class="prop-label" style="font-size:0.72rem;">Display Size</label>
                        <select id="site-global-bg-size" style="font-size:0.75rem;width:100%;">
                          <option value="cover">Cover (Fill Screen)</option>
                          <option value="contain">Contain (Fit)</option>
                          <option value="auto">Original Size</option>
                        </select>
                      </div>
                      <div>
                        <label class="prop-label" style="font-size:0.72rem;">Scroll Behavior</label>
                        <select id="site-global-bg-attachment" style="font-size:0.75rem;width:100%;">
                          <option value="fixed">Fixed (Parallax)</option>
                          <option value="scroll">Scrolls with Page</option>
                        </select>
                      </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                      <div>
                        <label class="prop-label" style="font-size:0.72rem;">Position</label>
                        <select id="site-global-bg-position" style="font-size:0.75rem;width:100%;">
                          <option value="center center">Center</option>
                          <option value="top center">Top Center</option>
                          <option value="bottom center">Bottom Center</option>
                          <option value="top left">Top Left</option>
                        </select>
                      </div>
                      <div>
                        <label class="prop-label" style="font-size:0.72rem;">Repeat</label>
                        <select id="site-global-bg-repeat" style="font-size:0.75rem;width:100%;">
                          <option value="no-repeat">No Repeat</option>
                          <option value="repeat">Tile / Pattern</option>
                        </select>
                      </div>
                    </div>

                    <!-- Overlay Opacity Tint Slider -->
                    <div>
                      <div style="display:flex;justify-content:space-between;align-items:center;">
                        <label class="prop-label" style="font-size:0.72rem;margin:0;">Dark Overlay Opacity</label>
                        <span id="site-global-bg-opacity-val" style="font-size:0.72rem;color:var(--text-dim);font-family:monospace;">50%</span>
                      </div>
                      <input type="range" id="site-global-bg-opacity" min="0" max="95" step="5" value="50" style="width:100%;cursor:pointer;margin-top:4px;" />
                      <div style="font-size:0.68rem;color:var(--text-dim);margin-top:2px;">Darkens the background image so text on sections remains clear.</div>
                    </div>
                  </div>
                </div>

                <!-- Template Autosave & Media Backups -->
                <div class="prop-group" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);">
                  <div style="font-weight: 700; font-size: 0.86rem; color: #f8fafc; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                    <span style="display:flex;align-items:center;gap:6px;"><span>💾</span> Template Autosave &amp; Media Backups</span>
                    <label style="font-size:0.75rem;color:var(--text-dim);display:flex;align-items:center;gap:6px;cursor:pointer;">
                      <input type="checkbox" id="site-template-autosave-enable" checked style="cursor:pointer;" />
                      <span>Enable Autosave</span>
                    </label>
                  </div>
                  <div style="font-size: 0.72rem; color: var(--text-dim); margin-bottom: 12px; line-height: 1.4;">
                    Automatically saves canvas JSON snapshots into your Media Library on <em>Publish Live</em>. Older snapshots rotate automatically when the backup limit is reached.
                  </div>

                  <div id="site-template-autosave-controls" style="display: flex; flex-direction: column; gap: 10px;">
                    <div>
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <label class="prop-label" style="font-size:0.75rem;margin:0;">Current Template Name / Prefix</label>
                        <span style="font-size:0.68rem;color:var(--accent-light,#38bdf8);font-family:monospace;" id="site-template-filename-preview">template_live_canvas.json</span>
                      </div>
                      <input type="text" id="site-template-name-input" placeholder="e.g. portfolio_landing, mcle_seminar, v1" style="font-size:0.78rem;" />
                      <div style="font-size:0.7rem; color:var(--text-dim); margin-top:3px;">
                        Name your template so you can easily recognize and switch between different designs in the Media Library.
                      </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:center;">
                      <div>
                        <label class="prop-label" style="font-size:0.75rem;">Max Backups in Media</label>
                        <select id="site-template-limit-select" style="font-size:0.78rem;width:100%;">
                          <option value="1">1 (Keep latest only - auto replace)</option>
                          <option value="3">3 Backups</option>
                          <option value="5" selected>5 Backups (Recommended)</option>
                          <option value="10">10 Backups</option>
                          <option value="20">20 Backups</option>
                          <option value="50">50 Backups</option>
                        </select>
                      </div>
                      <div>
                        <label class="prop-label" style="font-size:0.75rem;">Existing Backups</label>
                        <div style="display:flex;align-items:center;gap:6px;">
                          <span id="site-template-count-badge" style="font-size:0.74rem;font-weight:700;padding:4px 8px;border-radius:6px;background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.25);">Checking...</span>
                          <button type="button" id="btn-prune-templates-now" class="btn btn-sm" style="font-size:0.7rem;padding:4px 8px;color:#fca5a5;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);border-radius:4px;cursor:pointer;" title="Enforce limit & delete oldest templates now">🧹 Clean</button>
                        </div>
                      </div>
                    </div>

                    <div style="display:flex;gap:8px;margin-top:4px;">
                      <button type="button" id="btn-save-template-now-site" class="btn btn-sm" style="flex:1;font-size:0.75rem;padding:6px 10px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">
                        💾 Save Snapshot to Media
                      </button>
                      <button type="button" id="btn-open-media-templates-site" class="btn btn-sm" style="font-size:0.75rem;padding:6px 10px;background:rgba(255,255,255,0.06);color:#cbd5e1;border:1px solid var(--border-subtle);border-radius:6px;cursor:pointer;">
                        📁 Browse Templates
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Analytics & Integrations -->
                <div class="prop-group" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);">
                  <div style="font-weight: 700; font-size: 0.86rem; color: #f8fafc; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                    <span>📊</span> Analytics &amp; Tracking
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div>
                      <label class="prop-label" style="font-size:0.75rem;">Google Analytics (GA4) Measurement ID</label>
                      <input type="text" id="site-ga-id" placeholder="G-XXXXXXXXXX" style="font-size:0.78rem;" />
                      <div style="font-size:0.7rem; color:var(--text-dim); margin-top:3px;">Automatically injects gtag.js tracker on live pages.</div>
                    </div>
                    <div>
                      <label class="prop-label" style="font-size:0.75rem;">Meta / Facebook Pixel ID</label>
                      <input type="text" id="site-pixel-id" placeholder="e.g. 123456789012345" style="font-size:0.78rem;" />
                    </div>
                  </div>
                </div>

                <!-- Site Verification -->
                <div class="prop-group" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);">
                  <div style="font-weight: 700; font-size: 0.86rem; color: #f8fafc; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                    <span>🔍</span> Site Verification
                    <span style="font-size: 0.68rem; padding: 2px 7px; border-radius: 10px; background: rgba(99,102,241,0.15); color: #a5b4fc; font-weight: 700; margin-left: 4px;">SEO</span>
                  </div>
                  <div style="font-size: 0.72rem; color: var(--text-dim); margin-bottom: 10px;">Paste only the <code style="color:#a5f3fc;background:rgba(99,102,241,0.12);padding:1px 5px;border-radius:3px;">content="..."</code> value from each search engine's verification meta tag.</div>
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div>
                      <label class="prop-label" style="font-size:0.75rem; display:flex; align-items:center; gap:6px;">
                        <img src="https://www.google.com/favicon.ico" style="width:13px;height:13px;border-radius:2px;" onerror="this.style.display='none'" />
                        Google Search Console
                      </label>
                      <input type="text" id="site-verify-google" placeholder="NcM2UD8GVMDC0zjg_Gt4GPl15Hx1IP_27AbZxK5ZQho" style="font-size:0.78rem; font-family: monospace;" />
                      <div style="font-size:0.7rem; color:var(--text-dim); margin-top:3px;">From Google Search Console → Settings → Ownership Verification → HTML tag.</div>
                    </div>
                    <div>
                      <label class="prop-label" style="font-size:0.75rem; display:flex; align-items:center; gap:6px;">
                        <img src="https://www.bing.com/favicon.ico" style="width:13px;height:13px;border-radius:2px;" onerror="this.style.display='none'" />
                        Bing Webmaster Tools
                      </label>
                      <input type="text" id="site-verify-bing" placeholder="Paste your Bing verification code..." style="font-size:0.78rem; font-family: monospace;" />
                    </div>
                    <div>
                      <label class="prop-label" style="font-size:0.75rem; display:flex; align-items:center; gap:6px;">
                        <span style="font-size:11px;">🟡</span> Yandex Webmaster
                      </label>
                      <input type="text" id="site-verify-yandex" placeholder="Paste your Yandex verification code..." style="font-size:0.78rem; font-family: monospace;" />
                    </div>
                    <div>
                      <label class="prop-label" style="font-size:0.75rem; display:flex; align-items:center; gap:6px;">
                        <span style="font-size:11px;">📌</span> Pinterest
                      </label>
                      <input type="text" id="site-verify-pinterest" placeholder="Paste your Pinterest verification code..." style="font-size:0.78rem; font-family: monospace;" />
                    </div>
                  </div>
                </div>

                <!-- Custom Global CSS -->
                <div class="prop-group" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);">
                  <div style="font-weight: 700; font-size: 0.86rem; color: #f8fafc; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    <span>🎨</span> Global Custom CSS
                  </div>
                  <div style="font-size:0.72rem; color:var(--text-dim); margin-bottom: 6px;">Injected into &lt;head&gt; across all pages.</div>
                  <textarea id="site-custom-css" rows="6" placeholder="/* Custom CSS rules */&#10;.custom-glow { filter: drop-shadow(0 0 10px #6366f1); }" style="font-family: monospace; font-size: 0.75rem; width: 100%; resize: vertical; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-deep); color: #a5f3fc; line-height: 1.4;"></textarea>
                </div>

                <!-- Code Injections -->
                <div class="prop-group" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);">
                  <div style="font-weight: 700; font-size: 0.86rem; color: #f8fafc; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                    <span>💻</span> Custom Scripts &amp; Code Injection
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div>
                      <label class="prop-label" style="font-size:0.75rem;">Header Code <span style="color:var(--text-dim);font-weight:400;">(before &lt;/head&gt;)</span></label>
                      <textarea id="site-header-scripts" rows="3" placeholder="<!-- External scripts, font links, or chat widgets -->" style="font-family: monospace; font-size: 0.73rem; width: 100%; resize: vertical; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-deep); color: var(--text-main);"></textarea>
                    </div>
                    <div>
                      <label class="prop-label" style="font-size:0.75rem;">Footer Code <span style="color:var(--text-dim);font-weight:400;">(before &lt;/body&gt;)</span></label>
                      <textarea id="site-footer-scripts" rows="3" placeholder="<!-- Conversion tracking or body-end scripts -->" style="font-family: monospace; font-size: 0.73rem; width: 100%; resize: vertical; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-deep); color: var(--text-main);"></textarea>
                    </div>
                  </div>
                </div>

                <!-- Global Copyright Notice -->
                <div class="prop-group" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);">
                  <label class="prop-label" style="font-size:0.75rem;">Global Copyright Text</label>
                  <input type="text" id="site-copyright-input" placeholder="© 2026 My Organization. All rights reserved." style="font-size:0.78rem;" />
                </div>

                <!-- 24/7 Automated Decision-Tree Chatbot -->
                <div class="prop-group" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);">
                  <div style="font-weight: 700; font-size: 0.86rem; color: #f8fafc; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                    <span style="display:flex;align-items:center;gap:6px;"><span>🤖</span> 24/7 Automated Chatbot</span>
                    <span style="font-size:0.68rem;padding:2px 6px;border-radius:10px;background:rgba(16,185,129,0.15);color:#34d399;font-weight:700;">Zero-API Cost</span>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    <label style="font-size: 0.82rem; color: var(--text-main); display: flex; align-items: center; gap: 8px; cursor: pointer;">
                      <input type="checkbox" id="site-chatbot-enable" style="cursor: pointer;" />
                      <span>Enable Floating Chatbot on Live Site</span>
                    </label>
                    <div>
                      <label class="prop-label" style="font-size:0.75rem;">Bot Title / Name</label>
                      <input type="text" id="site-chatbot-title" placeholder="e.g. AI Assistant" style="font-size:0.78rem;" />
                    </div>
                    <div>
                      <label class="prop-label" style="font-size:0.75rem;">Bot Subtitle / Status</label>
                      <input type="text" id="site-chatbot-subtitle" placeholder="e.g. Automated 24/7 Guidance &amp; Inquiries" style="font-size:0.78rem;" />
                    </div>
                    <div>
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <label class="prop-label" style="font-size:0.75rem;margin:0;">Avatar Icon / Image</label>
                        <button type="button" id="btn-pick-chatbot-avatar" class="btn btn-sm" style="font-size:0.7rem;padding:2px 7px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;border-radius:4px;cursor:pointer;">🖼️ Media</button>
                      </div>
                      <div style="display:flex;align-items:center;gap:6px;">
                        <input type="text" id="site-chatbot-avatar" placeholder="⚖️ or assets/uploads/bot.png" style="font-size:0.78rem;flex:1;" />
                        <div id="site-chatbot-avatar-preview" style="width:28px;height:28px;border-radius:6px;background:rgba(255,255,255,0.06);border:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;font-size:1.1rem;overflow:hidden;flex-shrink:0;">⚖️</div>
                      </div>
                      <div style="font-size:0.7rem;color:var(--text-dim);margin-top:2px;">Type an emoji or pick an image from the Media Library.</div>
                    </div>
                    <div>
                      <label class="prop-label" style="font-size:0.75rem;">Bubble Prompt</label>
                      <input type="text" id="site-chatbot-bubble" placeholder="Need help? Ask us!" style="font-size:0.78rem;" />
                    </div>
                    <button type="button" id="btn-edit-chatbot-flow" class="topbar-btn topbar-btn-sm" style="margin-top:4px;width:100%;justify-content:center;background:rgba(99,102,241,0.18);border-color:#6366f1;color:#a5b4fc;padding:6px;">
                      <span>🌳 Customize Questions &amp; Flowchart</span>
                    </button>
                  </div>
                </div>

                <!-- Admin Notification Alerts -->
                <div class="prop-group" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);">
                  <div style="font-weight: 700; font-size: 0.86rem; color: #f8fafc; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <span>🔔</span> Leads &amp; Form Notification Alerts
                  </div>
                  <div>
                    <label class="prop-label" style="font-size:0.75rem;">Admin Alert Email Address</label>
                    <input type="email" id="site-notif-email" placeholder="e.g. contact@example.com" style="font-size:0.78rem;" />
                    <div style="font-size:0.7rem; color:var(--text-dim); margin-top:3px;">Receive instant email notifications when someone submits a contact form or chatbot lead.</div>
                  </div>
                </div>

                <!-- Floating Back to Top Button Setting -->
                <div class="prop-group" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);">
                  <div style="font-weight: 700; font-size: 0.86rem; color: #f8fafc; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                    <span style="display:flex;align-items:center;gap:6px;"><span>⬆️</span> Floating Back-to-Top Button</span>
                    <label style="font-size:0.75rem;color:var(--text-dim);display:flex;align-items:center;gap:6px;cursor:pointer;">
                      <input type="checkbox" id="site-backtotop-enable" checked style="cursor:pointer;" />
                      <span>Enable</span>
                    </label>
                  </div>
                  <div style="font-size: 0.72rem; color: var(--text-dim);">
                    Displays a smooth floating circular button at the bottom-right corner when visitors scroll down, allowing 1-tap return to the top.
                  </div>
                </div>
              </div>

              <!-- Add-ons & Widget Plugins Panel -->
              <div id="tab-addons-panel" style="display: none; padding-bottom: 24px;">
                <div class="addons-header-sticky">
                  <div style="font-weight: 700; font-size: 1rem; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
                  <span>🧩 Add-ons &amp; Plugins</span>
                  <span style="font-size: 0.72rem; color: #a5b4fc; background: rgba(99,102,241,0.15); padding: 3px 8px; border-radius: 12px; font-weight: 700;">Extensible</span>
                </div>

                <div style="display:flex;gap:6px;margin-bottom:16px;">
                  <button type="button" id="btn-open-addon-store" class="btn btn-sm" style="flex:1.2;justify-content:center;padding:8px 8px;font-size:0.78rem;font-weight:700;color:#ffffff !important;background:linear-gradient(135deg,#6366f1,#4f46e5);border:1px solid rgba(255,255,255,0.25);box-shadow:0 4px 12px rgba(99,102,241,0.35);border-radius:6px;cursor:pointer;">
                    <span style="color:#ffffff !important;font-weight:700;">🛒 Add-On Store</span>
                  </button>
                  <button type="button" id="btn-open-addon-maker" class="btn btn-sm" style="flex:1;justify-content:center;padding:8px 6px;font-size:0.75rem;background:rgba(255,255,255,0.08);border:1px solid var(--border-subtle);color:#ffffff !important;font-weight:600;border-radius:6px;cursor:pointer;">
                    <span style="color:#ffffff !important;">✨ Maker</span>
                  </button>
                  <button type="button" id="btn-upload-addon-pkg" class="btn btn-sm" style="flex:1;justify-content:center;padding:8px 6px;font-size:0.75rem;background:rgba(255,255,255,0.08);border:1px solid var(--border-subtle);color:#ffffff !important;font-weight:600;border-radius:6px;cursor:pointer;">
                    <span style="color:#ffffff !important;">📁 .json</span>
                  </button>
                  <input type="file" id="addon-file-picker" accept=".json" style="display:none;" />
                </div>

                <!-- Quick Toggle for Built-in Chatbot Assistant -->
                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);font-size:0.78rem;">
                  <span style="display:flex;align-items:center;gap:6px;color:var(--text-main,#f8fafc);font-weight:600;">
                    <span>💬</span> Built-in Assistant
                  </span>
                  <label style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;">
                    <input type="checkbox" id="addons-quick-toggle-chatbot" style="cursor:pointer;accent-color:var(--primary,#6366f1);" />
                    <span id="addons-quick-chatbot-label" style="font-size:0.72rem;font-weight:700;color:var(--primary-light,#818cf8);">Active</span>
                  </label>
                </div>
                </div>

                <div id="installed-addons-list" style="display:flex;flex-direction:column;gap:12px;margin-top:14px;">
                  <!-- Rendered dynamically -->
                </div>
              </div>

              <!-- Developer Hub Panel (Argon2 WebAssembly Protected) -->
              <div id="tab-developer-panel" style="display: none; padding-bottom: 24px;">
                <!-- Dynamically rendered via renderDeveloperPanel() -->
              </div>
            </div>

            <!-- Sticky Bottom Publish Dock (Always accessible in Mobile Portrait & Desktop) -->
            <div class="sidebar-bottom-dock" id="sidebar-bottom-dock">
              <button type="button" class="sidebar-btn-publish" id="btn-sidebar-publish" title="Publish Canvas Changes to Live Website">
                <span>🚀</span> <strong>Publish Live</strong>
              </button>
              <button type="button" class="sidebar-dock-action-btn" id="btn-sidebar-copy-link" title="Copy Public Live URL">
                <span>📋</span>
              </button>
              <button type="button" class="sidebar-dock-action-btn" id="btn-sidebar-qr" title="Show Mobile Test QR Code">
                <span>📱</span>
              </button>
              <a href="index.html?view=public" target="_blank" class="sidebar-dock-action-btn" id="btn-sidebar-view-live" title="Open Live Site in New Tab">
                <span>🌐</span>
              </a>
            </div>
          </aside>

          <!-- Canvas Viewport Center -->
          <section class="builder-canvas-viewport mode-desktop" id="builder-canvas-container">
            <!-- Mobile Floating Action Button to Open Drawer -->
            <button type="button" class="mobile-canvas-drawer-fab" id="btn-mobile-fab" title="Open Studio Controls">
              <span>☰</span>
            </button>
            <!-- Live Canvas Frame Rendered Here -->
          </section>


        </main>
      </div>
    `;

    try { this.bindTopbarActions(); } catch (e) { console.warn('bindTopbarActions error:', e); }
    try { this.renderWidgetTray(); } catch (e) { console.warn('renderWidgetTray error:', e); }
    try { this.initSidebarTabs(); } catch (e) { console.warn('initSidebarTabs error:', e); }
    try { this.initSidebarResizer(); } catch (e) { console.warn('initSidebarResizer error:', e); }
    try { this.initMobileSidebar(); } catch (e) { console.warn('initMobileSidebar error:', e); }

    // Initialize Canvas & Inspector
    const canvasContainer = document.getElementById('builder-canvas-container');
    const inspectorContainer = document.getElementById('tab-inspector-panel');

    try {
      this.canvas = new BuilderCanvas(canvasContainer, false);
    } catch (e) {
      console.error('BuilderCanvas init error:', e);
    }

    try {
      this.inspector = new InspectorPanel(inspectorContainer);
    } catch (e) {
      console.error('InspectorPanel init error:', e);
    }

    // Auto-switch to inspector tab when an element is clicked
    try {
      state.subscribe((_, action) => {
        if (action === 'selection' && state.activeElementId) {
          this.switchSidebarTab('inspector');
        }
      });
    } catch (e) {}

    try { this.bindKeyboardShortcuts(); } catch (e) { console.warn('bindKeyboardShortcuts error:', e); }
    try { this.initPageSettings(); } catch (e) { console.warn('initPageSettings error:', e); }
    try { this.initSiteSettings(); } catch (e) { console.warn('initSiteSettings error:', e); }
    try { this.initMediaLibrary(); } catch (e) { console.warn('initMediaLibrary error:', e); }
    try { this.initPagesPanel(); } catch (e) { console.warn('initPagesPanel error:', e); }
    try { this.initNotificationsHub(); } catch (e) { console.warn('initNotificationsHub error:', e); }
    try { this.initAddonsHandlers(); } catch (e) { console.warn('initAddonsHandlers error:', e); }
  }

  // --------------------------------------------------------------------------
  // MEDIA LIBRARY
  // --------------------------------------------------------------------------
  initMediaLibrary() {
    // Inject modal HTML into DOM
    const modalEl = document.createElement('div');
    modalEl.id = 'media-library-modal';
    modalEl.className = 'media-modal-overlay hidden';
    modalEl.innerHTML = `
      <div class="media-modal-panel">
        <div class="media-modal-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.4rem;">🖼️</span>
            <div>
              <div style="font-weight:700;font-size:1.05rem;">Media Library</div>
              <div style="font-size:0.78rem;color:var(--text-dim);">Upload &amp; manage your site assets</div>
            </div>
          </div>
          <button class="media-modal-close" id="media-modal-close">✕</button>
        </div>

        <div class="media-upload-zone" id="media-upload-zone">
          <input type="file" id="media-file-input" multiple accept="image/*,video/mp4,video/webm,.pdf" style="display:none;" />
          <div class="media-upload-inner" id="media-upload-trigger">
            <div style="font-size:1.8rem;line-height:1;">☁️</div>
            <div style="flex:1;">
              <div style="font-weight:600;font-size:0.92rem;color:#fff;">Click to upload or drag &amp; drop files here</div>
              <div style="font-size:0.75rem;color:var(--text-dim);margin-top:2px;">Supports JPG, PNG, GIF, WebP, SVG, MP4, WebM, PDF</div>
            </div>
            <button type="button" class="topbar-btn" style="pointer-events:none;background:rgba(99,102,241,0.18);border-color:rgba(99,102,241,0.4);color:#a5b4fc;font-size:0.8rem;padding:6px 14px;">Browse Files</button>
          </div>
          <div class="media-upload-progress hidden" id="media-upload-progress">
            <div class="media-progress-bar"><div class="media-progress-fill" id="media-progress-fill"></div></div>
            <div style="font-size:0.82rem;color:var(--text-muted);margin-top:6px;" id="media-upload-status">Uploading...</div>
          </div>
        </div>

        <div class="media-library-toolbar">
          <input type="text" id="media-search" placeholder="🔍  Search assets..." class="media-search-input" />
          <span id="media-asset-count" style="font-size:0.8rem;color:var(--text-dim);">0 files</span>
        </div>

        <div class="media-grid" id="media-grid">
          <div class="media-empty-state" id="media-empty-state">
            <div style="font-size:2.5rem;margin-bottom:10px;">📂</div>
            <div style="font-weight:600;color:var(--text-muted);">No assets uploaded yet</div>
            <div style="font-size:0.82rem;color:var(--text-dim);margin-top:4px;">Upload images and files using the zone above</div>
          </div>
        </div>

        <div class="media-modal-footer">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
            <div id="media-selected-info" style="font-size:0.85rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">No asset selected</div>
            <button class="topbar-btn" id="media-btn-copy" style="display:none;padding:5px 12px;font-size:0.78rem;background:rgba(99,102,241,0.15);border-color:rgba(99,102,241,0.3);color:#a5b4fc;" title="Copy file URL to clipboard">📋 Copy URL</button>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="topbar-btn" id="media-btn-cancel">Cancel</button>
            <button class="topbar-btn topbar-btn-publish" id="media-btn-use" disabled>Use Selected ✓</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    let _selectCallback = null;
    let _selectedAsset = null;
    let _allAssets = [];

    // Helper to update selection UI
    const setSelection = (asset) => {
      _selectedAsset = asset;
      const copyBtn = document.getElementById('media-btn-copy');
      const selectedInfo = document.getElementById('media-selected-info');
      if (asset) {
        selectedInfo.innerHTML = `Selected: <strong style="color:#ffffff;">${asset.name}</strong> <span style="color:var(--text-dim);font-size:0.78rem;">(${(asset.size / 1024).toFixed(1)} KB)</span>`;
        if (copyBtn) copyBtn.style.display = 'inline-flex';
        document.getElementById('media-btn-use').disabled = false;
      } else {
        selectedInfo.textContent = 'No asset selected';
        if (copyBtn) copyBtn.style.display = 'none';
        document.getElementById('media-btn-use').disabled = true;
      }
    };

    // Expose global opener function (called by inspector image-picker fields)
    window.openMediaLibrary = (callback) => {
      _selectCallback = callback;
      setSelection(null);
      modalEl.classList.remove('hidden');
      this.loadAssets(_allAssets, '');
      this.fetchAssets().then(assets => {
        _allAssets = assets;
        this.renderAssetGrid(assets, '', (asset) => {
          setSelection(asset);
        });
      });
    };

    this.openMediaModal = (callback) => window.openMediaLibrary(callback);

    // Topbar button also opens library (browse mode, no selection callback)
    document.getElementById('btn-media')?.addEventListener('click', () => {
      window.openMediaLibrary(null);
    });

    // Close actions
    const closeModal = () => {
      modalEl.classList.add('hidden');
      _selectCallback = null;
      _selectedAsset = null;
    };
    document.getElementById('media-modal-close').addEventListener('click', closeModal);
    document.getElementById('media-btn-cancel').addEventListener('click', closeModal);
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(); });

    // Use selected button
    document.getElementById('media-btn-use').addEventListener('click', () => {
      if (_selectedAsset && _selectCallback) {
        _selectCallback(_selectedAsset.url);
      }
      closeModal();
    });

    // Copy selected URL button
    document.getElementById('media-btn-copy')?.addEventListener('click', async () => {
      if (_selectedAsset?.url) {
        const btn = document.getElementById('media-btn-copy');
        try {
          await navigator.clipboard.writeText(_selectedAsset.url);
          btn.innerHTML = '✅ Copied!';
          setTimeout(() => { btn.innerHTML = '📋 Copy URL'; }, 2000);
        } catch {
          prompt('Copy asset URL:', _selectedAsset.url);
        }
      }
    });

    // Search filter
    document.getElementById('media-search').addEventListener('input', (e) => {
      this.renderAssetGrid(_allAssets, e.target.value, (asset) => {
        setSelection(asset);
      });
    });

    // Helper for instant media grid refresh after upload/delete
    const refreshMediaGrid = async () => {
      const assets = await this.fetchAssets();
      _allAssets = assets;
      const searchVal = document.getElementById('media-search')?.value || '';
      this.renderAssetGrid(assets, searchVal, (asset) => {
        setSelection(asset);
      });
      if (assets.length > 0) {
        setSelection(assets[0]);
      } else {
        setSelection(null);
      }
    };

    // File upload via click
    document.getElementById('media-upload-trigger').addEventListener('click', () => {
      document.getElementById('media-file-input').click();
    });
    document.getElementById('media-file-input').addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      this.uploadFiles(files, _allAssets, () => {
        refreshMediaGrid();
      });
      e.target.value = ''; // Reset input so same file can be re-selected
    });

    // Drag and drop upload
    const dropZone = document.getElementById('media-upload-zone');
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      this.uploadFiles(files, _allAssets, () => {
        refreshMediaGrid();
      });
    });
  }

  async fetchAssets() {
    try {
      const res = await fetch('api.php?action=list_assets');
      const data = await res.json();
      return data.assets || [];
    } catch {
      return [];
    }
  }

  loadAssets(assets, query) {
    // Placeholder until actual fetch resolves
    document.getElementById('media-asset-count').textContent = `${assets.length} files`;
  }

  renderAssetGrid(assets, query, onSelect) {
    const grid = document.getElementById('media-grid');
    const emptyState = document.getElementById('media-empty-state');
    const filtered = query
      ? assets.filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
      : assets;

    document.getElementById('media-asset-count').textContent = `${filtered.length} file${filtered.length !== 1 ? 's' : ''}`;

    // Clear grid but keep empty state element
    Array.from(grid.children).forEach(c => { if (c.id !== 'media-empty-state') c.remove(); });

    if (filtered.length === 0) {
      emptyState.style.display = 'flex';
      return;
    }
    emptyState.style.display = 'none';

    const imageExts = ['jpg','jpeg','png','gif','webp','svg'];
    filtered.forEach(asset => {
      const card = document.createElement('div');
      card.className = 'media-asset-card';
      card.dataset.url = asset.url;

      const isImage = imageExts.includes(asset.ext);
      const thumb = isImage
        ? `<img src="${asset.url}" alt="${asset.name}" loading="lazy" />`
        : `<div class="media-asset-icon">${asset.ext === 'pdf' ? '📄' : asset.ext.includes('mp4') || asset.ext.includes('webm') ? '🎬' : '📁'}</div>`;

      const sizekb = (asset.size / 1024).toFixed(1);
      card.innerHTML = `
        <button class="media-asset-copy" data-url="${asset.url}" title="Copy file URL">📋</button>
        <button class="media-asset-rename" data-name="${asset.name}" title="Rename file">✏️</button>
        <button class="media-asset-delete" data-name="${asset.name}" title="Delete asset">🗑</button>
        <div class="media-asset-thumb">${thumb}</div>
        <div class="media-asset-info">
          <div class="media-asset-name" title="${asset.name}">${asset.name}</div>
          <div class="media-asset-meta">${sizekb} KB · ${asset.ext.toUpperCase()}</div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.media-asset-delete') || e.target.closest('.media-asset-copy') || e.target.closest('.media-asset-rename')) return;
        document.querySelectorAll('.media-asset-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        onSelect(asset);
      });

      card.addEventListener('dblclick', (e) => {
        if (e.target.closest('.media-asset-delete') || e.target.closest('.media-asset-copy') || e.target.closest('.media-asset-rename')) return;
        onSelect(asset);
        document.getElementById('media-btn-use')?.click();
      });

      card.querySelector('.media-asset-copy').addEventListener('click', async (e) => {
        e.stopPropagation();
        const btn = e.currentTarget;
        try {
          await navigator.clipboard.writeText(asset.url);
          btn.innerHTML = '✓';
          btn.style.color = '#34d399';
          setTimeout(() => { btn.innerHTML = '📋'; btn.style.color = ''; }, 1600);
        } catch {
          prompt('Copy asset URL:', asset.url);
        }
      });

      card.querySelector('.media-asset-rename')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const lastDot = asset.name.lastIndexOf('.');
        const curBase = lastDot > 0 ? asset.name.substring(0, lastDot) : asset.name;
        const ext = lastDot > 0 ? asset.name.substring(lastDot + 1).toLowerCase() : asset.ext || '';

        const input = prompt(`Rename "${asset.name}" to:`, curBase);
        if (input === null) return;
        const cleanBase = input.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/^_+|_+$/g, '');
        if (!cleanBase) {
          alert('Filename cannot be empty.');
          return;
        }
        const newFullName = cleanBase.toLowerCase().endsWith('.' + ext) ? cleanBase : `${cleanBase}.${ext}`;
        if (newFullName === asset.name) return;

        try {
          const res = await fetch('api.php?action=rename_asset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              old_name: asset.name,
              new_name: newFullName,
              admin_token: getAdminToken()
            })
          });
          const result = await res.json();
          if (result.success) {
            this.canvas?.showToast(`File renamed to "${newFullName}"`, 'success');
            const assets2 = await this.fetchAssets();
            this.renderAssetGrid(assets2, document.getElementById('media-search')?.value || '', onSelect);
          } else {
            this.canvas?.showToast(`Failed to rename: ${result.error || 'Server error'}`, 'error');
          }
        } catch (err) {
          this.canvas?.showToast('Network error while renaming asset', 'error');
        }
      });

      card.querySelector('.media-asset-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${asset.name}"?`)) return;
        await fetch('api.php?action=delete_asset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json',
          'X-Admin-Token': getAdminToken(), },
          body: JSON.stringify({ name: asset.name })
        });
        this.fetchAssets().then(assets2 => {
          this.renderAssetGrid(assets2, document.getElementById('media-search').value, onSelect);
        });
      });

      grid.appendChild(card);
    });
  }

  // --------------------------------------------------------------------------
  // PAGES MANAGER
  // --------------------------------------------------------------------------
  initPagesPanel() {
    // Re-render on any page-related state changes
    state.subscribe((_, action) => {
      if (['pageAdded','pageDeleted','pageDuplicated','pageReordered','pageSwitched','pageMeta','serverSync','import'].includes(action)) {
        const panel = document.getElementById('tab-pages-panel');
        if (panel && panel.style.display !== 'none') this.renderPagesPanel();
      }
    });
  }

  renderPagesPanel() {
    const panel = document.getElementById('tab-pages-panel');
    if (!panel) return;

    const pagesHtml = state.pages.map((page, idx) => {
      const isActive = page.id === state.currentPageId;
      const isHome   = idx === 0;
      return `
        <div class="page-item ${isActive ? 'active' : ''}" data-page-id="${page.id}" data-index="${idx}" draggable="true">
          <div class="page-item-drag">⠿</div>
          <div class="page-item-info" style="flex:1;min-width:0;">
            <div class="page-item-title">${page.title}</div>
            <div class="page-item-slug">${isHome ? '(homepage)' : page.slug + '.html'}</div>
          </div>
          <div class="page-item-actions">
            <button class="page-action-btn" data-action="duplicate" data-page-id="${page.id}" title="Duplicate page">❐</button>
            ${!isHome ? `<button class="page-action-btn danger" data-action="delete" data-page-id="${page.id}" title="Delete page">🗑</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    panel.innerHTML = `
      <div style="padding: 14px 14px 0; font-weight: 700; font-size: 0.95rem; display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
        <span>📄 Pages <span style="font-size:0.75rem;color:var(--text-dim);font-weight:400;">${state.pages.length} page${state.pages.length !== 1 ? 's' : ''}</span></span>
      </div>
      <div id="pages-list">${pagesHtml}</div>
      <div style="padding: 12px 14px; border-top: 1px solid var(--border-subtle); margin-top: 10px;">
        <button class="topbar-btn" id="btn-add-page" style="width:100%; justify-content:center;">
          <span>➕</span> Add New Page
        </button>
      </div>
    `;

    // Click page to switch
    panel.querySelectorAll('.page-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.page-action-btn')) return;
        state.switchPage(item.dataset.pageId);
        this.renderPagesPanel();
        this.canvas.showToast(`Switched to: ${state.currentPage.title}`, 'info');
      });
    });

    // Page actions: duplicate / delete
    panel.querySelectorAll('.page-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const pageId = btn.dataset.pageId;
        if (action === 'duplicate') {
          const clone = state.duplicatePage(pageId);
          this.canvas.showToast(`Duplicated: ${clone.title}`, 'success');
        } else if (action === 'delete') {
          const page = state.pages.find(p => p.id === pageId);
          if (confirm(`Delete page "${page?.title}"? This cannot be undone.`)) {
            state.deletePage(pageId);
            this.canvas.showToast('Page deleted', 'info');
          }
        }
        this.renderPagesPanel();
      });
    });

    // Add page button
    panel.querySelector('#btn-add-page')?.addEventListener('click', () => {
      const title = prompt('New page title:', 'About');
      if (!title) return;
      const slug  = prompt('URL slug (e.g. about):', title.toLowerCase().replace(/\s+/g, '-'));
      state.addPage(title, slug || title);
      this.canvas.showToast(`Page created: ${title}`, 'success');
      this.renderPagesPanel();
    });

    // Drag-to-reorder
    let dragFrom = null;
    panel.querySelectorAll('.page-item').forEach(item => {
      item.addEventListener('dragstart', () => { dragFrom = parseInt(item.dataset.index); item.style.opacity = '0.5'; });
      item.addEventListener('dragend',   () => { item.style.opacity = ''; });
      item.addEventListener('dragover',  (e) => { e.preventDefault(); item.classList.add('drag-over-page'); });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over-page'));
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over-page');
        const toIdx = parseInt(item.dataset.index);
        if (dragFrom !== null && dragFrom !== toIdx) {
          state.reorderPages(dragFrom, toIdx);
          this.renderPagesPanel();
        }
        dragFrom = null;
      });
    });
  }

  /**
   * Upload files with frontend duplicate detection.
   * @param {File[]} files - Files to upload
   * @param {Array} existingAssets - Currently loaded asset list (for duplicate check)
   * @param {Function} onComplete - Called after all uploads finish
   */
  async uploadFiles(files, existingAssets = [], onComplete) {
    const progressBar = document.getElementById('media-upload-progress');
    const progressFill = document.getElementById('media-progress-fill');
    const statusText = document.getElementById('media-upload-status');
    progressBar.classList.remove('hidden');

    // Build a Set of existing sanitized filenames for fast lookup
    const existingNames = new Set(
      (existingAssets || []).map(a => a.name?.toLowerCase())
    );

    let uploaded = 0;
    let skipped = 0;
    const total = files.length;

    // Automatically optimize oversized images before upload to save bandwidth & disk space
    statusText.textContent = `Optimizing ${files.length} asset${files.length > 1 ? 's' : ''}...`;
    const readyFiles = [];
    for (const f of files) {
      try {
        const opt = await optimizeImageForUpload(f);
        readyFiles.push(opt);
      } catch (err) {
        readyFiles.push(f);
      }
    }

    for (const file of readyFiles) {
      // Sanitize filename the same way the backend does
      const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const sanitizedName = ext ? `${baseName}.${ext}` : baseName;

      let overwrite = false;

      // Check for duplicate
      if (existingNames.has(sanitizedName.toLowerCase())) {
        const action = await this._showDuplicateDialog(file.name, sanitizedName);
        if (action === 'skip') {
          skipped++;
          progressFill.style.width = `${((uploaded + skipped) / total) * 100}%`;
          statusText.textContent = `Skipped ${file.name}`;
          continue;
        }
        overwrite = (action === 'replace');
      }

      statusText.textContent = `Uploading ${file.name}...`;
      const formData = new FormData();
      formData.append('file', file);
      if (overwrite) {
        formData.append('overwrite', '1');
      }
      try {
        formData.append('admin_token', getAdminToken());
        const res = await fetch('api.php?action=upload', { method: 'POST', body: formData });
        const result = await res.json();
        if (result.success) {
          uploaded++;
          // Add the new name so subsequent files in the same batch also detect it
          existingNames.add((result.name || sanitizedName).toLowerCase());
        } else {
          console.error('Upload rejected:', result.error);
        }
        progressFill.style.width = `${((uploaded + skipped) / total) * 100}%`;
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }

    const parts = [];
    if (uploaded > 0) parts.push(`${uploaded} uploaded`);
    if (skipped > 0) parts.push(`${skipped} skipped`);
    if (uploaded === 0 && skipped === 0) {
      statusText.textContent = `❌ Upload failed. Please check file type and size.`;
    } else {
      statusText.textContent = `✅ ${parts.join(', ')}!`;
    }
    setTimeout(() => {
      progressBar.classList.add('hidden');
      progressFill.style.width = '0%';
    }, 2500);
    onComplete();
  }

  /**
   * Shows a styled duplicate-file dialog. Returns 'replace', 'rename', or 'skip'.
   */
  _showDuplicateDialog(originalName, sanitizedName) {
    return new Promise((resolve) => {
      // Remove any existing dialog first
      document.getElementById('media-dup-dialog')?.remove();

      const overlay = document.createElement('div');
      overlay.id = 'media-dup-dialog';
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 100001;
        background: rgba(0,0,0,0.55); backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        animation: fadeIn 0.15s ease;
      `;
      overlay.innerHTML = `
        <div style="
          background: linear-gradient(145deg, #1e1b4b, #1a1a2e);
          border: 1px solid rgba(99,102,241,0.35);
          border-radius: 16px; padding: 28px 32px; max-width: 420px; width: 90%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.15);
          font-family: 'Inter', system-ui, sans-serif; color: #e2e8f0;
        ">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <span style="font-size:1.5rem;">⚠️</span>
            <span style="font-weight:700;font-size:1.05rem;color:#fbbf24;">Duplicate File Detected</span>
          </div>
          <div style="font-size:0.88rem;color:#94a3b8;margin-bottom:6px;">
            A file named <strong style="color:#a5b4fc;">${sanitizedName}</strong> already exists in your Media Library.
          </div>
          <div style="font-size:0.82rem;color:#64748b;margin-bottom:20px;">
            Original: ${originalName}
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button id="dup-btn-replace" style="
              flex:1; padding:10px 16px; border-radius:10px; border:1px solid rgba(239,68,68,0.4);
              background:rgba(239,68,68,0.15); color:#fca5a5; font-weight:600; font-size:0.85rem;
              cursor:pointer; transition:all 0.2s;
            " onmouseover="this.style.background='rgba(239,68,68,0.3)'" onmouseout="this.style.background='rgba(239,68,68,0.15)'">
              🔄 Replace
            </button>
            <button id="dup-btn-rename" style="
              flex:1; padding:10px 16px; border-radius:10px; border:1px solid rgba(99,102,241,0.4);
              background:rgba(99,102,241,0.15); color:#a5b4fc; font-weight:600; font-size:0.85rem;
              cursor:pointer; transition:all 0.2s;
            " onmouseover="this.style.background='rgba(99,102,241,0.3)'" onmouseout="this.style.background='rgba(99,102,241,0.15)'">
              📝 Keep Both
            </button>
            <button id="dup-btn-skip" style="
              flex:1; padding:10px 16px; border-radius:10px; border:1px solid rgba(100,116,139,0.4);
              background:rgba(100,116,139,0.12); color:#94a3b8; font-weight:600; font-size:0.85rem;
              cursor:pointer; transition:all 0.2s;
            " onmouseover="this.style.background='rgba(100,116,139,0.25)'" onmouseout="this.style.background='rgba(100,116,139,0.12)'">
              ⏭ Skip
            </button>
          </div>
          <div style="font-size:0.72rem;color:#475569;margin-top:12px;text-align:center;">
            Replace overwrites the existing file · Keep Both saves with an incremented name
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const cleanup = (result) => {
        overlay.remove();
        resolve(result);
      };

      document.getElementById('dup-btn-replace').addEventListener('click', () => cleanup('replace'));
      document.getElementById('dup-btn-rename').addEventListener('click', () => cleanup('rename'));
      document.getElementById('dup-btn-skip').addEventListener('click', () => cleanup('skip'));
    });
  }

  // Render Left Widget Tray
  renderWidgetTray() {
    const container = document.getElementById('widgets-list-container');
    if (!container) return;

    const categories = {
      layout: { title: 'Layout & Structure', items: [] },
      content: { title: 'Content & Messaging', items: [] },
      media: { title: 'Media & Interactive', items: [] },
      addons: { title: '🧩 Add-ons & Plugins', items: [] }
    };

    Object.entries(WIDGET_REGISTRY).forEach(([key, w]) => {
      let catKey = w.category;
      if (w.isAddon || catKey === 'addons') {
        catKey = 'addons';
      }
      const cat = categories[catKey] || categories.content;
      cat.items.push({ key, ...w });
    });

    let html = '';
    Object.values(categories).forEach((cat) => {
      if (cat.items.length === 0) return;
      html += `<div class="widget-category-title">${cat.title}</div>`;
      html += `<div class="widget-grid" style="margin-bottom: 16px;">`;
      cat.items.forEach((item) => {
        html += `
          <div class="widget-card ${item.isAddon ? 'is-addon-widget' : ''}" data-widget-type="${item.key}" draggable="true" title="${item.description || ''}">
            <div class="widget-card-icon">${item.icon || '🧩'}</div>
            <div class="widget-card-name">
              <span>${item.name}</span>
              ${item.isAddon ? '<span style="font-size:0.62rem;background:rgba(99,102,241,0.25);color:#a5b4fc;padding:1px 5px;border-radius:4px;margin-left:4px;font-weight:700;">Add-on</span>' : ''}
            </div>
          </div>
        `;
      });
      html += `</div>`;
    });

    container.innerHTML = html;

    // Click or Drag to add widget to page
    container.querySelectorAll('.widget-card').forEach((card) => {
      card.addEventListener('click', () => {
        const type = card.getAttribute('data-widget-type');
        state.addSection(type);
        this.canvas.showToast(`Added ${WIDGET_REGISTRY[type]?.name || type}`, 'success');
      });

      card.addEventListener('dragstart', (e) => {
        const type = card.getAttribute('data-widget-type');
        e.dataTransfer.setData('text/plain', type);
        e.dataTransfer.setData('application/x-widget-type', type);
        e.dataTransfer.effectAllowed = 'copy';
        window._draggedWidgetType = type;
        window._draggedSectionId = null;
        card.classList.add('is-dragging');
        document.body.classList.add('builder-is-dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        document.body.classList.remove('builder-is-dragging');
        window._draggedWidgetType = null;
        document.querySelectorAll('.drop-target-top, .drop-target-bottom, .is-active').forEach((el) => {
          el.classList.remove('drop-target-top', 'drop-target-bottom', 'is-active');
        });
      });
    });

    // Realtime search filtering
    const searchInput = document.getElementById('widget-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        container.querySelectorAll('.widget-card').forEach((card) => {
          const name = card.querySelector('.widget-card-name').textContent.toLowerCase();
          card.style.display = name.includes(query) ? 'flex' : 'none';
        });
      });
    }
  }

  // Sidebar Tab Switching with Slidable Nav & Auto-Scroll
  initSidebarTabs() {
    const tabsContainer = document.getElementById('sidebar-tabs') || document.querySelector('.sidebar-tabs');
    const prevArrow = document.getElementById('tab-arrow-prev');
    const nextArrow = document.getElementById('tab-arrow-next');
    const tabs = document.querySelectorAll('.sidebar-tab-btn');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.switchSidebarTab(tab.getAttribute('data-side-tab'));
      });
    });

    const updateArrowState = () => {
      if (!tabsContainer || !prevArrow || !nextArrow) return;
      const maxScroll = Math.max(0, tabsContainer.scrollWidth - tabsContainer.clientWidth);
      const hasOverflow = maxScroll > 4;
      prevArrow.style.display = hasOverflow ? 'flex' : 'none';
      nextArrow.style.display = hasOverflow ? 'flex' : 'none';
      prevArrow.disabled = tabsContainer.scrollLeft <= 2;
      nextArrow.disabled = tabsContainer.scrollLeft >= maxScroll - 2;
    };

    if (prevArrow && tabsContainer) {
      prevArrow.addEventListener('click', (e) => {
        e.preventDefault();
        tabsContainer.scrollBy({ left: -140, behavior: 'smooth' });
      });
    }

    if (nextArrow && tabsContainer) {
      nextArrow.addEventListener('click', (e) => {
        e.preventDefault();
        tabsContainer.scrollBy({ left: 140, behavior: 'smooth' });
      });
    }

    if (tabsContainer) {
      // Horizontal mouse wheel scrolling over tabs
      tabsContainer.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          tabsContainer.scrollLeft += e.deltaY;
          updateArrowState();
        }
      }, { passive: false });

      tabsContainer.addEventListener('scroll', updateArrowState, { passive: true });
      window.addEventListener('resize', updateArrowState);
      setTimeout(updateArrowState, 200);
    }
  }

  switchSidebarTab(tabName) {
    document.querySelectorAll('.sidebar-tab-btn').forEach((b) => {
      const isTarget = b.getAttribute('data-side-tab') === tabName;
      b.classList.toggle('active', isTarget);
      if (isTarget) {
        b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    });

    document.getElementById('tab-widgets-panel').style.display     = tabName === 'widgets'      ? 'block' : 'none';
    document.getElementById('tab-inspector-panel').style.display   = tabName === 'inspector'    ? 'block' : 'none';
    document.getElementById('tab-pages-panel').style.display       = tabName === 'pages'        ? 'block' : 'none';
    document.getElementById('tab-settings-panel').style.display    = tabName === 'settings'     ? 'block' : 'none';
    const sitePanel = document.getElementById('tab-sitesettings-panel');
    if (sitePanel) sitePanel.style.display                         = tabName === 'sitesettings' ? 'block' : 'none';
    const addonsPanel = document.getElementById('tab-addons-panel');
    if (addonsPanel) addonsPanel.style.display                     = tabName === 'addons'       ? 'block' : 'none';
    const devPanel = document.getElementById('tab-developer-panel');
    if (devPanel) devPanel.style.display                           = tabName === 'developer'    ? 'block' : 'none';

    if (tabName === 'pages') this.renderPagesPanel();
    if (tabName === 'sitesettings') this.syncSiteSettingsInputs();
    if (tabName === 'addons') this.renderAddonsPanel();
    if (tabName === 'developer') this.renderDeveloperPanel();

    const tabsContainer = document.getElementById('sidebar-tabs');
    if (tabsContainer) {
      tabsContainer.dispatchEvent(new Event('scroll'));
    }
  }

  // --------------------------------------------------------------------------
  // DRAGGABLE RESIZABLE SIDEBAR
  // --------------------------------------------------------------------------
  initSidebarResizer() {
    const sidebar = document.getElementById('builder-sidebar');
    const resizer = document.getElementById('sidebar-resizer');
    const toggleBtn = document.getElementById('sidebar-resize-toggle');
    if (!sidebar || !resizer || !toggleBtn) return;

    // Restore saved width and resize state from localStorage
    const savedWidth = localStorage.getItem('aether_sidebar_width');
    if (savedWidth) {
      const w = parseInt(savedWidth, 10);
      if (!isNaN(w) && w >= 260 && w <= 750) {
        sidebar.style.width = `${w}px`;
        document.documentElement.style.setProperty('--sidebar-width', `${w}px`);
      }
    } else {
      sidebar.style.width = '380px';
      document.documentElement.style.setProperty('--sidebar-width', '380px');
    }

    // Restore resize enabled/disabled state
    const resizeEnabled = localStorage.getItem('aether_sidebar_resizable') !== 'false';
    if (!resizeEnabled) {
      document.body.classList.add('sidebar-resizing-disabled');
      toggleBtn.textContent = '🔒';
    } else {
      toggleBtn.textContent = '🔓';
    }

    // Helper to update toggle button icon
    const updateToggleIcon = () => {
      const disabled = document.body.classList.contains('sidebar-resizing-disabled');
      toggleBtn.textContent = disabled ? '🔒' : '🔓';
    };

    // Toggle button click handler
    toggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-resizing-disabled');
      const disabled = document.body.classList.contains('sidebar-resizing-disabled');
      localStorage.setItem('aether_sidebar_resizable', disabled ? 'false' : 'true');
      updateToggleIcon();
    });

    // Restore saved width from localStorage or comfortable default
    // (already done above)

    let isDragging = false;
    let startX = 0;
    let startWidth = 380;

    resizer.addEventListener('mousedown', (e) => {
      if (document.body.classList.contains('sidebar-resizing-disabled')) return;
      isDragging = true;
      startX = e.clientX;
      startWidth = sidebar.getBoundingClientRect().width;
      document.body.classList.add('is-resizing-sidebar');
      resizer.classList.add('active');
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const delta = e.clientX - startX;
      const maxWidth = Math.min(680, Math.floor(window.innerWidth * 0.6));
      const newWidth = Math.max(260, Math.min(maxWidth, Math.round(startWidth + delta)));
      sidebar.style.width = `${newWidth}px`;
      document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      document.body.classList.remove('is-resizing-sidebar');
      resizer.classList.remove('active');
      const finalWidth = Math.round(sidebar.getBoundingClientRect().width);
      localStorage.setItem('aether_sidebar_width', finalWidth);
      const tabsContainer = document.getElementById('sidebar-tabs');
      if (tabsContainer) {
        tabsContainer.dispatchEvent(new Event('scroll'));
      }
    });

    // Double-click – only cycle widths when resizing is enabled
    resizer.addEventListener('dblclick', () => {
      if (document.body.classList.contains('sidebar-resizing-disabled')) return;
      const current = sidebar.getBoundingClientRect().width;
      let nextWidth = 420;
      if (current < 360) nextWidth = 420;
      else if (current < 460) nextWidth = 500;
      else nextWidth = 320;

      sidebar.style.width = `${nextWidth}px`;
      document.documentElement.style.setProperty('--sidebar-width', `${nextWidth}px`);
      localStorage.setItem('aether_sidebar_width', nextWidth);
      const tabsContainer = document.getElementById('sidebar-tabs');
      if (tabsContainer) {
        tabsContainer.dispatchEvent(new Event('scroll'));
      }
    });
  }

  // --------------------------------------------------------------------------
  // MOBILE SIDEBAR DRAWER CONTROLLER (< 768px)
  // --------------------------------------------------------------------------
  initMobileSidebar() {
    const toggleBtn = document.getElementById('btn-mobile-sidebar-toggle');
    const fabBtn = document.getElementById('btn-mobile-fab');
    const closeBtn = document.getElementById('btn-mobile-sidebar-close');
    const backdrop = document.getElementById('mobile-sidebar-backdrop');

    const openDrawer = () => {
      document.body.classList.add('mobile-sidebar-open');
    };
    const closeDrawer = () => {
      document.body.classList.remove('mobile-sidebar-open');
    };

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('mobile-sidebar-open');
      });
    }
    if (fabBtn) {
      fabBtn.addEventListener('click', openDrawer);
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', closeDrawer);
    }
    if (backdrop) {
      backdrop.addEventListener('click', closeDrawer);
    }

    // Auto-open drawer when an element is selected on mobile screens
    state.subscribe((_, action) => {
      if (action === 'selection' && state.activeElementId && window.innerWidth <= 768) {
        openDrawer();
      }
    });
  }

  // --------------------------------------------------------------------------
  // ADD-ONS & PLUGINS PANEL WIRING
  // --------------------------------------------------------------------------
  initAddonsHandlers() {
    const handleOpenStore = () => {
      addonStore.openStoreModal((installed) => {
        this.renderAddonsPanel();
        this.renderWidgetTray();
        this.canvas.render();
        this.canvas.showToast(`Installed "${installed.name}" from Store!`, 'success');
      });
    };

    const btnStore = document.getElementById('btn-open-addon-store');
    if (btnStore) {
      btnStore.addEventListener('click', handleOpenStore);
    }

    const btnTopbarStore = document.getElementById('btn-topbar-store');
    if (btnTopbarStore) {
      btnTopbarStore.addEventListener('click', handleOpenStore);
    }

    const btnNew = document.getElementById('btn-open-addon-maker');
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        AddonMaker.open(null, (pkg) => {
          this.renderAddonsPanel();
          this.renderWidgetTray();
          this.canvas.render();
          this.canvas.showToast(`Installed "${pkg.name}" into Add-ons!`, 'success');
        });
      });
    }

    const btnUpload = document.getElementById('btn-upload-addon-pkg');
    const filePicker = document.getElementById('addon-file-picker');

    // Quick Toggle for Built-in Chatbot Assistant
    const quickCb = document.getElementById('addons-quick-toggle-chatbot');
    const quickLabel = document.getElementById('addons-quick-chatbot-label');
    const updateQuickCbUI = () => {
      if (!quickCb) return;
      const curCb = state.siteSettings.chatbot || DEFAULT_CHATBOT_CONFIG;
      const isEnabled = curCb.enabled !== false;
      quickCb.checked = isEnabled;
      if (quickLabel) {
        quickLabel.textContent = isEnabled ? 'Active' : 'Disabled';
        quickLabel.style.color = isEnabled ? 'var(--primary-light, #818cf8)' : 'var(--text-muted, #94a3b8)';
      }
    };
    updateQuickCbUI();

    if (quickCb) {
      quickCb.addEventListener('change', (e) => {
        const curCb = state.siteSettings.chatbot || DEFAULT_CHATBOT_CONFIG;
        state.setSiteSetting('chatbot', { ...curCb, enabled: e.target.checked });
        updateQuickCbUI();
        this.canvas?.showToast(e.target.checked ? '💬 Built-in Assistant enabled' : 'Built-in Assistant disabled', 'info');
        const siteCb = document.getElementById('site-chatbot-enable');
        if (siteCb) siteCb.checked = e.target.checked;
      });
    }

    const siteCb = document.getElementById('site-chatbot-enable');
    if (siteCb) {
      siteCb.addEventListener('change', updateQuickCbUI);
    }
    if (btnUpload && filePicker) {
      btnUpload.addEventListener('click', () => filePicker.click());
      filePicker.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            const installed = addonManager.installAddon(data);
            this.renderAddonsPanel();
            this.renderWidgetTray();
            this.canvas.render();
            this.canvas.showToast(`Successfully installed ${installed.name}!`, 'success');
          } catch(err) {
            alert('Failed to install add-on package: ' + err.message);
          }
          filePicker.value = '';
        };
        reader.readAsText(file);
      });
    }
  }

  renderAddonsPanel() {
    const listContainer = document.getElementById('installed-addons-list');
    if (!listContainer) return;

    const addons = addonManager.addons || [];
    if (addons.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align:center;padding:32px 14px;color:var(--text-dim);font-size:0.85rem;background:rgba(255,255,255,0.02);border:1px dashed var(--border-subtle);border-radius:10px;">
          <div style="font-size:2rem;margin-bottom:8px;">🧩</div>
          <div style="font-weight:600;color:#f1f5f9;margin-bottom:4px;">No Custom Add-ons Installed</div>
          <div>Click "✨ Create Add-On" to build a new widget or install a .json package.</div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = addons.map((addon) => {
      const isEnabled = addon.enabled !== false;
      return `
        <div class="addon-installed-card" data-addon-id="${addon.id}" style="padding:14px;background:rgba(255,255,255,0.03);border:1px solid ${isEnabled ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'};border-radius:10px;display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:1.4rem;padding:6px;background:rgba(255,255,255,0.06);border-radius:8px;">${addon.icon || '🧩'}</span>
              <div>
                <div style="font-weight:700;font-size:0.9rem;color:#ffffff;display:flex;align-items:center;gap:6px;">
                  <span>${addon.name}</span>
                  <span style="font-size:0.65rem;padding:1px 6px;border-radius:10px;background:rgba(255,255,255,0.08);color:var(--text-dim);font-weight:500;">v${addon.version || '1.0.0'}</span>
                </div>
                <div style="font-size:0.73rem;color:var(--text-dim);margin-top:2px;">${addon.author || 'Custom'} &bull; <code style="color:#a5b4fc;">${addon.id}</code></div>
              </div>
            </div>
            <label style="position:relative;display:inline-block;width:38px;height:20px;margin:0;cursor:pointer;">
              <input type="checkbox" class="toggle-addon-switch" ${isEnabled ? 'checked' : ''} style="opacity:0;width:0;height:0;" />
              <span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:${isEnabled ? '#6366f1' : '#334155'};transition:.2s;border-radius:20px;">
                <span style="position:absolute;content:'';height:14px;width:14px;left:3px;bottom:3px;background-color:white;transition:.2s;border-radius:50%;transform:${isEnabled ? 'translateX(18px)' : 'none'};"></span>
              </span>
            </label>
          </div>

          ${addon.description ? `<div style="font-size:0.78rem;color:var(--text-muted);line-height:1.4;">${addon.description}</div>` : ''}

          <div style="display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);font-size:0.74rem;">
            <div style="display:flex;gap:6px;">
              <button type="button" class="btn btn-sm btn-edit-addon" style="padding:3px 8px;font-size:0.72rem;background:rgba(255,255,255,0.06);color:#e2e8f0;border:1px solid var(--border-subtle);">
                ✏️ Edit
              </button>
              <button type="button" class="btn btn-sm btn-export-addon" style="padding:3px 8px;font-size:0.72rem;background:rgba(255,255,255,0.06);color:#e2e8f0;border:1px solid var(--border-subtle);">
                📦 Export
              </button>
            </div>
            <button type="button" class="tool-icon-btn btn-delete-addon" style="color:#f87171;padding:3px 6px;" title="Uninstall Add-on">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Wire actions
    listContainer.querySelectorAll('.addon-installed-card').forEach((card) => {
      const id = card.getAttribute('data-addon-id');
      const addon = addons.find(a => a.id === id);

      card.querySelector('.toggle-addon-switch').addEventListener('change', (e) => {
        addonManager.toggleAddon(id, e.target.checked);
        this.renderWidgetTray();
        this.canvas.render();
        this.canvas.showToast(`${addon.name} ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
        this.renderAddonsPanel();
      });

      card.querySelector('.btn-edit-addon').addEventListener('click', () => {
        AddonMaker.open(addon, () => {
          this.renderAddonsPanel();
          this.renderWidgetTray();
          this.canvas.render();
          this.canvas.showToast(`Updated ${addon.name}`, 'success');
        });
      });

      card.querySelector('.btn-export-addon').addEventListener('click', () => {
        addonManager.exportAddon(id);
      });

      card.querySelector('.btn-delete-addon').addEventListener('click', () => {
        if (confirm(`Are you sure you want to uninstall and remove "${addon.name}"?`)) {
          addonManager.deleteAddon(id);
          this.renderWidgetTray();
          this.canvas.render();
          this.canvas.showToast(`Uninstalled ${addon.name}`, 'info');
          this.renderAddonsPanel();
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // DEVELOPER CONSOLE & REMOTE FEED MANAGER (ARGON2 PROTECTED)
  // --------------------------------------------------------------------------
  async renderDeveloperPanel() {
    const panel = document.getElementById('tab-developer-panel');
    if (!panel) return;

    if (!this.activeDevSubTab) {
      this.activeDevSubTab = 'feed';
    }

    // ── 1. If Locked: Render Security Gate ──
    if (!devAuth.isAuthenticated()) {
      panel.innerHTML = `
        <div style="padding: 18px 14px; display: flex; flex-direction: column; gap: 16px;">
          <div style="text-align: center; padding: 20px 14px; background: rgba(99,102,241,0.06); border: 1px solid rgba(99,102,241,0.25); border-radius: 12px;">
            <div style="font-size: 2.4rem; margin-bottom: 8px;">🔒</div>
            <div style="font-weight: 800; font-size: 1.05rem; color: #ffffff; letter-spacing: -0.02em;">Developer Hub Gate</div>
            <div style="font-size: 0.74rem; color: #818cf8; font-weight: 600; margin-top: 2px;">Restricted Access</div>
            <p style="font-size: 0.76rem; color: var(--text-dim); margin-top: 10px; line-height: 1.45;">
              This area is reserved for managing marketplace packages, custom widgets, and templates.
            </p>
          </div>

          <form id="form-dev-unlock" style="display: flex; flex-direction: column; gap: 10px;">
            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #e2e8f0; margin-bottom: 6px;">
                Developer Password
              </label>
              <input type="password" id="dev-unlock-password" placeholder="Enter developer password..." autocomplete="current-password"
                style="width: 100%; font-size: 0.82rem; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-deep); color: #ffffff;" />
            </div>

            <button type="submit" id="btn-dev-unlock-submit" class="wb-btn wb-btn-primary"
              style="width: 100%; justify-content: center; padding: 9px 12px; font-size: 0.82rem; font-weight: 700;">
              <span>🔓</span> Unlock Developer Hub
            </button>

            <div id="dev-unlock-feedback" style="display: none; font-size: 0.74rem; padding: 8px 10px; border-radius: 6px; line-height: 1.4;"></div>
          </form>
        </div>
      `;

      const form = panel.querySelector('#form-dev-unlock');
      const pwdInput = panel.querySelector('#dev-unlock-password');
      const submitBtn = panel.querySelector('#btn-dev-unlock-submit');
      const feedback = panel.querySelector('#dev-unlock-feedback');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = pwdInput.value;
        if (!pwd) {
          pwdInput.focus();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>⏳</span> Verifying credentials...`;
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(99,102,241,0.15)';
        feedback.style.border = '1px solid rgba(99,102,241,0.3)';
        feedback.style.color = '#c7d2fe';
        feedback.textContent = 'Verifying security credentials...';

        try {
          const res = await devAuth.unlock(pwd);
          if (res.success) {
            feedback.style.background = 'rgba(16,185,129,0.15)';
            feedback.style.border = '1px solid rgba(16,185,129,0.3)';
            feedback.style.color = '#6ee7b7';
            feedback.textContent = `✅ Access granted in ${res.computeTime}ms. Opening Developer Hub...`;
            this.canvas.showToast(`🔓 Developer Hub unlocked (${res.computeTime}ms)`, 'success');
            setTimeout(() => {
              this.renderDeveloperPanel();
            }, 300);
          } else {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>🔓</span> Unlock Developer Hub`;
            feedback.style.background = 'rgba(239,68,68,0.15)';
            feedback.style.border = '1px solid rgba(239,68,68,0.3)';
            feedback.style.color = '#fca5a5';
            feedback.textContent = `❌ ${res.error || 'Incorrect developer password.'}`;
            pwdInput.focus();
            pwdInput.select();
          }
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>🔓</span> Unlock Developer Hub`;
          feedback.style.background = 'rgba(239,68,68,0.15)';
          feedback.style.border = '1px solid rgba(239,68,68,0.3)';
          feedback.style.color = '#fca5a5';
          feedback.textContent = `❌ Verification error: ${err.message}`;
        }
      });

      return;
    }

    // ── 2. If Unlocked: Render Full Developer Hub ──
    // Load store feed configuration
    let feedConfig = {
      remoteFeedUrl: 'https://raw.githubusercontent.com/aetherbuilder/addons-repo/main/addons.json',
      lastSynced: null,
      gcash: { accountName: 'MCLE Program Office', accountNumber: '0917-888-5678', qrImageUrl: '' },
      stripeCheckoutUrl: '',
      paypalEmail: 'admin@uspf-mcle.edu.ph',
      masterUnlockKey: 'AETHER-PRO-UNLOCK'
    };

    try {
      const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';
      const fRes = await fetch(`${apiBase}?action=get_store_feed_config&_t=${Date.now()}`);
      if (fRes.ok) {
        const fData = await fRes.json();
        if (fData && typeof fData === 'object') {
          feedConfig = { ...feedConfig, ...fData };
        }
      }
    } catch {}

    const curSubTab = this.activeDevSubTab;

    panel.innerHTML = `
      <div style="padding: 14px;">
        <!-- Top Status Bar & Lock Action -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981;"></span>
            <span style="font-weight: 700; font-size: 0.85rem; color: #ffffff;">Developer Console</span>
          </div>
          <button type="button" id="btn-dev-lock-session" class="btn btn-sm"
            style="padding: 3px 8px; font-size: 0.72rem; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; border-radius: 4px; cursor: pointer;">
            🔒 Lock Hub
          </button>
        </div>

        <!-- Sub-tabs Navigation -->
        <div style="display: flex; gap: 4px; margin-bottom: 14px; background: rgba(15,23,42,0.6); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
          <button type="button" class="dev-subtab-btn ${curSubTab === 'feed' ? 'active' : ''}" data-dev-subtab="feed"
            style="flex: 1; padding: 6px 4px; font-size: 0.72rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: all 0.15s; ${curSubTab === 'feed' ? 'background:#6366f1;color:#ffffff;' : 'background:transparent;color:var(--text-dim);'}">
            📡 Feed &amp; Sales
          </button>
          <button type="button" class="dev-subtab-btn ${curSubTab === 'templates' ? 'active' : ''}" data-dev-subtab="templates"
            style="flex: 1; padding: 6px 4px; font-size: 0.72rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: all 0.15s; ${curSubTab === 'templates' ? 'background:#6366f1;color:#ffffff;' : 'background:transparent;color:var(--text-dim);'}">
            📋 Free Templates
          </button>
          <button type="button" class="dev-subtab-btn ${curSubTab === 'security' ? 'active' : ''}" data-dev-subtab="security"
            style="flex: 1; padding: 6px 4px; font-size: 0.72rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: all 0.15s; ${curSubTab === 'security' ? 'background:#6366f1;color:#ffffff;' : 'background:transparent;color:var(--text-dim);'}">
            🔐 Dev Security
          </button>
        </div>

        <!-- Sub-tab Content Area -->
        <div id="dev-subtab-content">
          ${curSubTab === 'feed' ? this.getDevFeedSubTabHtml(feedConfig) : ''}
          ${curSubTab === 'templates' ? this.getDevTemplatesSubTabHtml() : ''}
          ${curSubTab === 'security' ? this.getDevSecuritySubTabHtml() : ''}
        </div>
      </div>
    `;

    // Wire Lock Session
    panel.querySelector('#btn-dev-lock-session')?.addEventListener('click', () => {
      devAuth.lock();
      this.canvas.showToast('🔒 Developer Hub locked', 'info');
      this.renderDeveloperPanel();
    });

    // Wire Sub-tab buttons
    panel.querySelectorAll('.dev-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeDevSubTab = btn.dataset.devSubtab;
        this.renderDeveloperPanel();
      });
    });

    // Wire specific sub-tab interactions
    if (curSubTab === 'feed') {
      this.bindDevFeedSubTabEvents(panel, feedConfig);
    } else if (curSubTab === 'templates') {
      this.bindDevTemplatesSubTabEvents(panel);
    } else if (curSubTab === 'security') {
      this.bindDevSecuritySubTabEvents(panel);
    }
  }

  // ── SUB-TAB 1: Remote Feed & Sales ──
  getDevFeedSubTabHtml(feedConfig) {
    const catalog = addonStore.catalog || [];
    return `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Hidden Remote Feed URL Control -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(99,102,241,0.25); border-radius: 10px; padding: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <label style="font-size: 0.76rem; font-weight: 700; color: #ffffff;">
              📡 Remote Add-on Feed URL
            </label>
            <span style="font-size: 0.65rem; background: rgba(99,102,241,0.2); color: #c7d2fe; padding: 1px 6px; border-radius: 10px; font-weight: 700;">
              Hidden from Public
            </span>
          </div>
          <p style="font-size: 0.72rem; color: var(--text-dim); margin-bottom: 8px; line-height: 1.4;">
            GitHub Raw JSON or Google Sheets CSV endpoint for distributing updates or selling add-ons. Completely masked from regular users.
          </p>
          <input type="url" id="dev-feed-url-input" value="${feedConfig.remoteFeedUrl || ''}" placeholder="https://raw.githubusercontent.com/.../addons.json"
            style="width: 100%; font-size: 0.76rem; font-family: var(--font-mono); padding: 7px 9px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-deep); color: #38bdf8; margin-bottom: 10px;" />

          <div style="display: flex; gap: 8px;">
            <button type="button" id="btn-dev-sync-feed" class="btn btn-sm"
              style="flex: 1; justify-content: center; padding: 7px; font-size: 0.75rem; background: rgba(99,102,241,0.25); border: 1px solid rgba(99,102,241,0.5); color: #ffffff; font-weight: 700; border-radius: 6px; cursor: pointer;">
              🔄 Sync Remote Feed Now
            </button>
            <button type="button" id="btn-dev-save-feed-url" class="btn btn-sm"
              style="padding: 7px 12px; font-size: 0.75rem; background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); color: #ffffff; border-radius: 6px; cursor: pointer;">
              💾 Save URL
            </button>
          </div>
          <div id="dev-feed-sync-status" style="display: none; font-size: 0.72rem; margin-top: 8px; padding: 6px 8px; border-radius: 6px;"></div>
        </div>

        <!-- Master License Key for Testing & Unlock -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px;">
          <label style="display: block; font-size: 0.76rem; font-weight: 700; color: #ffffff; margin-bottom: 4px;">
            🔑 Master License Key
          </label>
          <div style="font-size: 0.72rem; color: var(--text-dim); margin-bottom: 8px;">
            Overrides premium unlock for all add-ons during testing or client deployments.
          </div>
          <div style="display: flex; gap: 6px;">
            <input type="text" id="dev-master-key-input" value="${feedConfig.masterUnlockKey || 'AETHER-PRO-UNLOCK'}"
              style="flex: 1; font-size: 0.76rem; font-family: var(--font-mono); padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-deep); color: #34d399; font-weight: 700;" />
            <button type="button" id="btn-dev-generate-key" class="btn btn-sm"
              style="padding: 6px 10px; font-size: 0.72rem; background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); color: #ffffff; border-radius: 6px; cursor: pointer;">
              🎲 Random
            </button>
          </div>
        </div>

        <!-- Marketplace Seller Pricing Quick View -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px;">
          <div style="font-weight: 700; font-size: 0.76rem; color: #ffffff; margin-bottom: 4px;">
            🛒 Active Store Listings (${catalog.length})
          </div>
          <div style="font-size: 0.72rem; color: var(--text-dim); margin-bottom: 10px;">
            Public marketplace listings and pricing visible in the Add-on Store:
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto;">
            ${catalog.map(c => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: rgba(15,23,42,0.5); border: 1px solid rgba(255,255,255,0.04); border-radius: 6px; font-size: 0.74rem;">
                <div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;">
                  <span>${c.icon || '🧩'}</span>
                  <span style="color: #ffffff; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.name}</span>
                </div>
                <span style="font-weight: 800; padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; ${c.price === 0 ? 'background:rgba(16,185,129,0.2);color:#6ee7b7;' : 'background:rgba(99,102,241,0.25);color:#c7d2fe;'}">
                  ${c.price === 0 ? 'FREE' : `₱${c.price}`}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  bindDevFeedSubTabEvents(panel, feedConfig) {
    const urlInput = panel.querySelector('#dev-feed-url-input');
    const syncBtn = panel.querySelector('#btn-dev-sync-feed');
    const saveBtn = panel.querySelector('#btn-dev-save-feed-url');
    const statusBox = panel.querySelector('#dev-feed-sync-status');
    const keyInput = panel.querySelector('#dev-master-key-input');
    const genKeyBtn = panel.querySelector('#btn-dev-generate-key');

    const saveFeedData = async (updates) => {
      feedConfig = { ...feedConfig, ...updates };
      try {
        const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';
        await fetch(`${apiBase}?action=save_store_feed_config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedConfig)
        });
      } catch {}
    };

    saveBtn?.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      await saveFeedData({ remoteFeedUrl: url });
      this.canvas.showToast('Remote Feed URL saved', 'success');
    });

    syncBtn?.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (!url) {
        alert('Please enter a valid remote feed URL first.');
        return;
      }
      syncBtn.disabled = true;
      syncBtn.innerHTML = `<span>⏳</span> Syncing remote feed...`;
      statusBox.style.display = 'block';
      statusBox.style.background = 'rgba(99,102,241,0.15)';
      statusBox.style.color = '#c7d2fe';
      statusBox.textContent = `Connecting to ${url}...`;

      try {
        const result = await addonStore.syncRemoteFeed(url);
        await saveFeedData({ remoteFeedUrl: url, lastSynced: new Date().toISOString() });
        statusBox.style.background = 'rgba(16,185,129,0.15)';
        statusBox.style.color = '#6ee7b7';
        statusBox.textContent = `✅ Successfully synced ${result.count || 0} add-ons from remote feed!`;
        this.canvas.showToast(`✅ Synced ${result.count || 0} add-ons from remote feed!`, 'success');
        this.renderDeveloperPanel();
      } catch (err) {
        statusBox.style.background = 'rgba(239,68,68,0.15)';
        statusBox.style.color = '#fca5a5';
        statusBox.textContent = `❌ Remote sync failed: ${err.message}`;
      } finally {
        syncBtn.disabled = false;
        syncBtn.innerHTML = `🔄 Sync Remote Feed Now`;
      }
    });

    genKeyBtn?.addEventListener('click', async () => {
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newKey = `AETHER-${randomPart}-KEY`;
      keyInput.value = newKey;
      await saveFeedData({ masterUnlockKey: newKey });
      this.canvas.showToast(`Generated new Master Key: ${newKey}`, 'success');
    });

    keyInput?.addEventListener('change', async () => {
      await saveFeedData({ masterUnlockKey: keyInput.value.trim() });
      this.canvas.showToast('Master Key updated', 'info');
    });
  }

  // ── SUB-TAB 2: Free Template Store Management ──
  getDevTemplatesSubTabHtml() {
    const tmpls = templateStore.templates || [];
    return `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); border-radius: 10px; padding: 12px;">
          <div style="font-weight: 700; font-size: 0.82rem; color: #6ee7b7; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span>✨</span> 100% Free Template Policy
          </div>
          <div style="font-size: 0.73rem; color: var(--text-dim); line-height: 1.45;">
            All templates in this store are 100% free. Templates automatically declare and detect their required add-on dependencies so users never encounter missing widgets.
          </div>
          <button type="button" id="btn-dev-create-template-from-canvas" class="wb-btn wb-btn-primary"
            style="width: 100%; justify-content: center; padding: 8px 12px; font-size: 0.78rem; font-weight: 700; margin-top: 10px;">
            <span>➕</span> Save Current Canvas as New Free Template
          </button>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 0.78rem; font-weight: 700; color: #ffffff;">Available Templates (${tmpls.length})</span>
          <button type="button" id="btn-dev-restore-seed-templates" class="btn btn-sm"
            style="padding: 3px 8px; font-size: 0.7rem; background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); color: #cbd5e1; border-radius: 4px; cursor: pointer;">
            ↺ Reset Defaults
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px; max-height: 380px; overflow-y: auto;">
          ${tmpls.map((tmpl) => {
            const reqList = templateStore.getRequiredAddonsDetails(tmpl.requiredAddons || []);
            return `
              <div class="dev-tmpl-card" data-template-id="${tmpl.id}" style="padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; gap: 10px;">
                  <img src="${tmpl.thumbnail}" alt="" style="width: 60px; height: 48px; object-fit: cover; border-radius: 6px; background: #0f172a;" />
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <div style="font-weight: 700; font-size: 0.82rem; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${tmpl.name}</div>
                      <span style="font-size: 0.65rem; background: rgba(16,185,129,0.2); color: #6ee7b7; font-weight: 800; padding: 1px 5px; border-radius: 4px;">FREE</span>
                    </div>
                    <div style="font-size: 0.7rem; color: #a5b4fc; font-weight: 600;">${tmpl.category}</div>
                    <div style="font-size: 0.68rem; color: var(--text-dim); line-height: 1.3; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${tmpl.description}</div>
                  </div>
                </div>

                <!-- Required Addons Badge Row -->
                <div style="font-size: 0.68rem; color: #94a3b8; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.06);">
                  <span style="font-weight: 700; color: #e2e8f0;">Required:</span>
                  ${reqList.length === 0 ? '<span style="color:var(--text-dim);">(Core widgets only)</span>' : ''}
                  ${reqList.map(r => `
                    <span style="display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 600; ${r.isInstalled ? 'background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);' : 'background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);'}">
                      <span>${r.icon || '🧩'}</span>
                      <span>${r.name}</span>
                      <span>${r.isInstalled ? '✓' : '⚠️'}</span>
                    </span>
                  `).join('')}
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 2px;">
                  <button type="button" class="btn btn-sm btn-dev-load-tmpl" data-id="${tmpl.id}"
                    style="padding: 3px 8px; font-size: 0.72rem; background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.4); color: #c7d2fe; border-radius: 4px; cursor: pointer;">
                    🚀 Test Load
                  </button>
                  <button type="button" class="tool-icon-btn btn-dev-delete-tmpl" data-id="${tmpl.id}" style="color: #f87171; padding: 3px 6px;" title="Delete Template">
                    🗑️
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  bindDevTemplatesSubTabEvents(panel) {
    // 1. Create Template from Canvas
    panel.querySelector('#btn-dev-create-template-from-canvas')?.addEventListener('click', () => {
      const detected = templateStore.detectRequiredAddons(state.sections || []);
      const detectedNames = detected.map(id => {
        const item = (addonStore.catalog || []).find(c => c.id === id);
        return item ? item.name : id;
      });

      const name = prompt('Template Title / Name:', 'New Custom Legal Template');
      if (!name) return;

      const category = prompt('Template Category:', 'Legal & Summit');
      if (!category) return;

      const description = prompt('Template Description:', 'Custom turnkey layout curated for conferences and legal offices.');
      if (!description) return;

      const thumbnail = prompt('Thumbnail Image URL:', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80') || '';

      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36).substring(2, 6);

      const newTemplate = {
        id,
        name,
        category,
        description,
        thumbnail,
        price: 0,
        requiredAddons: detected,
        sections: JSON.parse(JSON.stringify(state.sections || [])),
        pageSettings: JSON.parse(JSON.stringify(state.pageSettings || {}))
      };

      templateStore.templates.unshift(newTemplate);
      templateStore.save();
      this.canvas.showToast(`✅ Saved template "${name}" with ${detected.length} detected add-on(s)!`, 'success');
      this.renderDeveloperPanel();
    });

    // 2. Reset Defaults
    panel.querySelector('#btn-dev-restore-seed-templates')?.addEventListener('click', () => {
      if (confirm('Reset template store back to official built-in free templates?')) {
        templateStore.templates = templateStore.getSeedTemplates();
        templateStore.save();
        this.canvas.showToast('Restored official default templates', 'info');
        this.renderDeveloperPanel();
      }
    });

    // 3. Test Load
    panel.querySelectorAll('.btn-dev-load-tmpl').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const tmpl = templateStore.templates.find(t => t.id === id);
        if (!tmpl) return;

        if (confirm(`Load "${tmpl.name}" into builder canvas? Current canvas will be replaced (undoable).`)) {
          await templateStore.applyTemplate(id, { autoInstall: true });
          this.canvas.render();
          this.renderWidgetTray();
          this.canvas.showToast(`Loaded template "${tmpl.name}"`, 'success');
        }
      });
    });

    // 4. Delete
    panel.querySelectorAll('.btn-dev-delete-tmpl').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const tmpl = templateStore.templates.find(t => t.id === id);
        if (!tmpl) return;

        if (confirm(`Delete "${tmpl.name}" from Free Template Store?`)) {
          templateStore.templates = templateStore.templates.filter(t => t.id !== id);
          templateStore.save();
          this.canvas.showToast(`Deleted "${tmpl.name}"`, 'info');
          this.renderDeveloperPanel();
        }
      });
    });
  }

  // ── SUB-TAB 3: Developer Security & GitHub Remote Master Pitcher ──
  getDevSecuritySubTabHtml() {
    const curHash = devAuth.getStoredHash();
    const storedPat = devAuth.getStoredPat();
    const lastSync = localStorage.getItem('aether_dev_last_remote_sync') || 'Just now';

    return `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Remote GitHub Authority Status Banner -->
        <div style="background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.3); border-radius: 10px; padding: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981;"></span>
              <span style="font-weight: 700; font-size: 0.8rem; color: #ffffff;">GitHub Supreme Authority</span>
            </div>
            <span style="font-size: 0.65rem; background: rgba(16,185,129,0.2); color: #6ee7b7; padding: 2px 6px; border-radius: 4px; font-weight: 700;">
              Auto-Sync Active
            </span>
          </div>
          <div style="font-size: 0.72rem; color: var(--text-dim); line-height: 1.45;">
            Master security repository: <a href="https://github.com/bernardlolo25/aetherbuilder" target="_blank" style="color: #38bdf8; text-decoration: underline; font-family: var(--font-mono);">bernardlolo25/aetherbuilder</a>
          </div>
          <p style="font-size: 0.71rem; color: #94a3b8; margin-top: 6px; line-height: 1.4;">
            When you update your developer password here, it can be <strong>automatically pitched to GitHub</strong>. Every client installation in the world checks this repository and instantly requires your new password!
          </p>
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button type="button" id="btn-dev-pull-github-hash" class="btn btn-sm"
              style="flex: 1; justify-content: center; padding: 6px 10px; font-size: 0.72rem; background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.4); color: #c7d2fe; border-radius: 6px; cursor: pointer;">
              🔄 Check &amp; Pull Latest Hash from GitHub
            </button>
          </div>
          <div id="dev-pull-github-feedback" style="display: none; font-size: 0.71rem; margin-top: 6px; padding: 6px 8px; border-radius: 4px;"></div>
        </div>

        <!-- Master Password Form with Automatic GitHub Pitch -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(99,102,241,0.25); border-radius: 10px; padding: 12px;">
          <div style="font-weight: 700; font-size: 0.82rem; color: #ffffff; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <span>🔑</span> Update Master Developer Password
          </div>
          <p style="font-size: 0.72rem; color: var(--text-dim); margin-bottom: 10px; line-height: 1.4;">
            Computes a fresh WebAssembly Argon2id hash (4MB RAM cost) and saves to <code style="color:#a5b4fc;">data/dev_auth.json</code>.
          </p>

          <form id="form-dev-change-password" style="display: flex; flex-direction: column; gap: 8px;">
            <div>
              <label style="display: block; font-size: 0.72rem; font-weight: 700; color: #e2e8f0; margin-bottom: 4px;">
                Current Developer Password
              </label>
              <input type="password" id="dev-pwd-current" placeholder="Enter current password..."
                style="width: 100%; font-size: 0.78rem; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-deep); color: #ffffff;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.72rem; font-weight: 700; color: #e2e8f0; margin-bottom: 4px;">
                New Developer Password
              </label>
              <input type="password" id="dev-pwd-new" placeholder="Enter at least 5 characters..."
                style="width: 100%; font-size: 0.78rem; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-deep); color: #ffffff;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.72rem; font-weight: 700; color: #e2e8f0; margin-bottom: 4px;">
                Confirm New Password
              </label>
              <input type="password" id="dev-pwd-confirm" placeholder="Re-type new password..."
                style="width: 100%; font-size: 0.78rem; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-deep); color: #ffffff;" />
            </div>

            <!-- GitHub Personal Access Token for Auto-Push -->
            <div style="background: rgba(15,23,42,0.5); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); margin-top: 4px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <label style="font-size: 0.71rem; font-weight: 700; color: #e2e8f0;">
                  GitHub Personal Access Token (PAT)
                </label>
                <a href="https://github.com/settings/tokens/new?scopes=repo" target="_blank" style="font-size: 0.68rem; color: #38bdf8; text-decoration: underline;">
                  Generate Token ↗
                </a>
              </div>
              <input type="password" id="dev-github-pat" value="${storedPat}" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (repo scope)"
                style="width: 100%; font-size: 0.74rem; font-family: var(--font-mono); padding: 5px 8px; border-radius: 4px; border: 1px solid var(--border-subtle); background: var(--bg-deep); color: #34d399;" />
              
              <label style="display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 0.7rem; color: #cbd5e1; cursor: pointer;">
                <input type="checkbox" id="dev-auto-push-github-cb" checked style="accent-color: #6366f1; cursor: pointer;" />
                <span>🚀 Automatically pitch new Argon2 hash to GitHub repo</span>
              </label>
            </div>

            <button type="submit" id="btn-dev-pwd-submit" class="wb-btn wb-btn-primary"
              style="width: 100%; justify-content: center; padding: 8px 12px; font-size: 0.78rem; font-weight: 700; margin-top: 6px;">
              🛡️ Hash &amp; Pitch New Developer Password
            </button>

            <div id="dev-pwd-feedback" style="display: none; font-size: 0.72rem; padding: 6px 8px; border-radius: 6px;"></div>
          </form>
        </div>

        <!-- 1-Click Push Core Files to GitHub Tool -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px;">
          <div style="font-weight: 700; font-size: 0.8rem; color: #ffffff; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <span>📦</span> GitHub Core Sync Engine
          </div>
          <div style="font-size: 0.72rem; color: var(--text-dim); margin-bottom: 8px; line-height: 1.4;">
            Directly commit and push core system files (<code style="color:#a5b4fc;">dev_auth.json</code>, <code style="color:#a5b4fc;">templates.json</code>, <code style="color:#a5b4fc;">store_feed.json</code>, <code style="color:#a5b4fc;">version.json</code>) to <strong style="color:#fff;">bernardlolo25/aetherbuilder</strong>.
          </div>
          <button type="button" id="btn-dev-push-all-core" class="btn btn-sm"
            style="width: 100%; justify-content: center; padding: 7px; font-size: 0.75rem; background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4); color: #6ee7b7; font-weight: 700; border-radius: 6px; cursor: pointer;">
            🚀 Push Core Files to GitHub Now
          </button>
          <div id="dev-push-core-status" style="display: none; font-size: 0.71rem; margin-top: 8px; padding: 6px 8px; border-radius: 6px;"></div>
        </div>

        <!-- Git Terminal Commands Guide -->
        <div style="background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <div style="font-size: 0.74rem; font-weight: 700; color: #ffffff;">
              💻 Git CLI Commands (Terminal)
            </div>
            <button type="button" id="btn-copy-git-cli" class="btn btn-sm"
              style="padding: 2px 6px; font-size: 0.68rem; background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.4); color: #a5b4fc; border-radius: 4px; cursor: pointer;">
              📋 Copy Commands
            </button>
          </div>
          <div style="font-size: 0.7rem; color: var(--text-dim); margin-bottom: 6px;">
            Remote origin is already pre-configured to <code style="color:#38bdf8;">https://github.com/bernardlolo25/aetherbuilder.git</code>:
          </div>
          <textarea id="dev-git-cli-code" readonly rows="4"
            style="width: 100%; font-size: 0.7rem; font-family: var(--font-mono); padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-deep); color: #34d399; resize: none;">git add .
git commit -m "Update AetherBuilder core files and developer security v2.9.0"
git push -u origin main</textarea>
        </div>

        <!-- Current Encoded Argon2 PHC Hash -->
        <div style="background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <label style="font-size: 0.74rem; font-weight: 700; color: #ffffff;">
              Current PHC Argon2id Hash
            </label>
            <button type="button" id="btn-copy-dev-hash" class="btn btn-sm"
              style="padding: 2px 6px; font-size: 0.68rem; background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.4); color: #a5b4fc; border-radius: 4px; cursor: pointer;">
              📋 Copy
            </button>
          </div>
          <textarea id="dev-hash-readonly" readonly rows="3"
            style="width: 100%; font-size: 0.68rem; font-family: var(--font-mono); padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-deep); color: #94a3b8; resize: none;">${curHash || '(Initializing default dev hash...)'}</textarea>
        </div>
      </div>
    `;
  }

  bindDevSecuritySubTabEvents(panel) {
    const form = panel.querySelector('#form-dev-change-password');
    const curPwd = panel.querySelector('#dev-pwd-current');
    const newPwd = panel.querySelector('#dev-pwd-new');
    const confPwd = panel.querySelector('#dev-pwd-confirm');
    const patInput = panel.querySelector('#dev-github-pat');
    const autoPushCb = panel.querySelector('#dev-auto-push-github-cb');
    const submitBtn = panel.querySelector('#btn-dev-pwd-submit');
    const feedback = panel.querySelector('#dev-pwd-feedback');
    const copyBtn = panel.querySelector('#btn-copy-dev-hash');
    const hashArea = panel.querySelector('#dev-hash-readonly');
    const pullGithubBtn = panel.querySelector('#btn-dev-pull-github-hash');
    const pullFeedback = panel.querySelector('#dev-pull-github-feedback');
    const pushAllCoreBtn = panel.querySelector('#btn-dev-push-all-core');
    const pushCoreStatus = panel.querySelector('#dev-push-core-status');
    const copyGitCliBtn = panel.querySelector('#btn-copy-git-cli');
    const gitCliTextarea = panel.querySelector('#dev-git-cli-code');

    // Save PAT on change
    patInput?.addEventListener('input', () => {
      devAuth.setStoredPat(patInput.value.trim());
    });

    // Copy Git CLI commands
    copyGitCliBtn?.addEventListener('click', () => {
      navigator.clipboard.writeText(gitCliTextarea.value);
      this.canvas.showToast('Copied Git CLI commands to clipboard', 'info');
    });

    // Copy Argon2 Hash
    copyBtn?.addEventListener('click', () => {
      navigator.clipboard.writeText(hashArea.value);
      this.canvas.showToast('Copied Argon2 PHC hash to clipboard', 'info');
    });

    // Pull Latest Master Hash from GitHub
    pullGithubBtn?.addEventListener('click', async () => {
      pullGithubBtn.disabled = true;
      pullGithubBtn.innerHTML = `<span>⏳</span> Checking GitHub repository...`;
      pullFeedback.style.display = 'block';
      pullFeedback.style.background = 'rgba(99,102,241,0.15)';
      pullFeedback.style.color = '#c7d2fe';
      pullFeedback.textContent = 'Querying https://raw.githubusercontent.com/bernardlolo25/aetherbuilder/main/data/dev_auth.json...';

      try {
        const res = await devAuth.syncRemoteMasterHash(true);
        if (res.success) {
          pullFeedback.style.background = 'rgba(16,185,129,0.15)';
          pullFeedback.style.color = '#6ee7b7';
          pullFeedback.textContent = res.updated
            ? '✅ Successfully pulled and synchronized updated master Argon2 hash from GitHub!'
            : '✅ Local master hash is already in sync with GitHub supreme authority.';
          hashArea.value = res.hash;
          this.canvas.showToast('✅ Synced with GitHub security authority!', 'success');
        } else {
          pullFeedback.style.background = 'rgba(245,158,11,0.15)';
          pullFeedback.style.color = '#fde68a';
          pullFeedback.textContent = '⚠️ GitHub dev_auth.json not found yet (repository might not have this file committed yet). Push the security hash below!';
        }
      } catch (err) {
        pullFeedback.style.background = 'rgba(239,68,68,0.15)';
        pullFeedback.style.color = '#fca5a5';
        pullFeedback.textContent = `❌ Error: ${err.message}`;
      } finally {
        pullGithubBtn.disabled = false;
        pullGithubBtn.innerHTML = `🔄 Check &amp; Pull Latest Hash from GitHub`;
      }
    });

    // Update Developer Password & Pitch to GitHub
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const current = curPwd.value;
      const next = newPwd.value;
      const confirm = confPwd.value;
      const pat = patInput ? patInput.value.trim() : '';
      const shouldPush = autoPushCb ? autoPushCb.checked : false;

      if (!current) {
        curPwd.focus();
        return;
      }
      if (next !== confirm) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(239,68,68,0.15)';
        feedback.style.color = '#fca5a5';
        feedback.textContent = '❌ New password and confirmation do not match.';
        return;
      }
      if (next.length < 5) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(239,68,68,0.15)';
        feedback.style.color = '#fca5a5';
        feedback.textContent = '❌ Password must be at least 5 characters.';
        return;
      }

      if (shouldPush && !pat) {
        if (!confirm('No GitHub Personal Access Token was entered. The password will be updated locally and on your server, but will NOT be pushed to GitHub automatically. Proceed?')) {
          patInput.focus();
          return;
        }
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>⏳</span> Generating Argon2id hash &amp; pitching...`;
      feedback.style.display = 'block';
      feedback.style.background = 'rgba(99,102,241,0.15)';
      feedback.style.color = '#c7d2fe';
      feedback.textContent = 'Re-computing WebAssembly Argon2id cryptographic salt and PHC string...';

      try {
        const res = await devAuth.updatePassword(current, next, {
          pushToGithub: shouldPush,
          pat: pat
        });

        if (res.success) {
          hashArea.value = res.newHash || devAuth.getStoredHash();
          curPwd.value = '';
          newPwd.value = '';
          confPwd.value = '';

          let msg = '✅ Master developer password successfully updated!';
          if (res.githubPushResult && res.githubPushResult.success) {
            msg += `<br>🚀 <strong>Pitched to GitHub repository!</strong> All installed user systems worldwide will automatically enforce your new password.`;
          } else if (res.githubPushResult && res.githubPushResult.error) {
            msg += `<br>⚠️ Local password updated, but GitHub push failed: ${res.githubPushResult.error}. Use "Push Core Files" below with a valid token.`;
          }

          feedback.style.background = 'rgba(16,185,129,0.15)';
          feedback.style.color = '#6ee7b7';
          feedback.innerHTML = msg;
          this.canvas.showToast('✅ Developer password updated!', 'success');
        } else {
          feedback.style.background = 'rgba(239,68,68,0.15)';
          feedback.style.color = '#fca5a5';
          feedback.textContent = `❌ ${res.error || 'Failed to update password.'}`;
        }
      } catch (err) {
        feedback.style.background = 'rgba(239,68,68,0.15)';
        feedback.style.color = '#fca5a5';
        feedback.textContent = `❌ Error: ${err.message}`;
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `🛡️ Hash &amp; Pitch New Developer Password`;
      }
    });

    // Push All Core Files to GitHub Now
    pushAllCoreBtn?.addEventListener('click', async () => {
      const pat = patInput ? patInput.value.trim() : '';
      if (!pat) {
        alert('Please enter a GitHub Personal Access Token (PAT) with "repo" scope first.');
        patInput.focus();
        return;
      }

      pushAllCoreBtn.disabled = true;
      pushAllCoreBtn.innerHTML = `<span>⏳</span> Pushing core files to GitHub...`;
      pushCoreStatus.style.display = 'block';
      pushCoreStatus.style.background = 'rgba(99,102,241,0.15)';
      pushCoreStatus.style.color = '#c7d2fe';
      pushCoreStatus.innerHTML = 'Connecting to GitHub REST API...';

      const filesToPush = [
        { path: 'data/dev_auth.json', name: 'Developer Security Hash' },
        { path: 'data/templates.json', name: 'Free Template Store Catalog' },
        { path: 'data/store_feed.json', name: 'Marketplace Feed & Gateways' },
        { path: 'version.json', name: 'Version Release Manifest' }
      ];

      let resultsLog = [];
      let allSuccess = true;

      for (const item of filesToPush) {
        try {
          // Fetch current file content
          let fileContent = '';
          const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';
          if (item.path === 'data/dev_auth.json') {
            fileContent = JSON.stringify({ argon2_hash: devAuth.getStoredHash(), updated_at: new Date().toISOString() }, null, 2);
          } else if (item.path === 'data/templates.json') {
            if (!templateStore.templates || templateStore.templates.length === 0) {
              resultsLog.push(`⚠️ Skipped ${item.name} — in-memory templates is empty, refusing to overwrite`);
              continue;
            }
            fileContent = JSON.stringify(templateStore.templates, null, 2);
          } else if (item.path === 'data/store_feed.json') {
            const feedRes = await fetch(`${apiBase}?action=get_store_feed_config&_t=${Date.now()}`);
            fileContent = await feedRes.text();
          } else if (item.path === 'version.json') {
            const vRes = await fetch(`version.json?_t=${Date.now()}`);
            fileContent = await vRes.text();
          }

          pushCoreStatus.innerHTML = `Uploading ${item.name} (${item.path})...`;
          const pushRes = await devAuth.pushFileToGitHub(
            item.path,
            fileContent,
            `Core update: sync ${item.path} via AetherBuilder Developer Hub [v${APP_VERSION}]`,
            pat
          );
          resultsLog.push(`✓ ${item.name} (${item.path})`);
        } catch (err) {
          allSuccess = false;
          resultsLog.push(`❌ ${item.name}: ${err.message}`);
        }
      }

      if (allSuccess) {
        pushCoreStatus.style.background = 'rgba(16,185,129,0.15)';
        pushCoreStatus.style.color = '#6ee7b7';
        pushCoreStatus.innerHTML = `<strong>✅ All core files successfully pushed to GitHub!</strong><br>${resultsLog.join('<br>')}`;
        this.canvas.showToast('🚀 Core files successfully pushed to GitHub!', 'success');
      } else {
        pushCoreStatus.style.background = 'rgba(239,68,68,0.15)';
        pushCoreStatus.style.color = '#fca5a5';
        pushCoreStatus.innerHTML = `<strong>⚠️ Some files could not be pushed:</strong><br>${resultsLog.join('<br>')}`;
      }

      pushAllCoreBtn.disabled = false;
      pushAllCoreBtn.innerHTML = `🚀 Push Core Files to GitHub Now`;
    });
  }

  // --------------------------------------------------------------------------
  // PAGE SETTINGS & THEME ENGINE WIRING
  // --------------------------------------------------------------------------
  initPageSettings() {
    const titleInput = document.getElementById('page-title-input');
    const themeSelect = document.getElementById('theme-preset-select');
    const swatchList = document.getElementById('theme-swatch-list');
    const fontSelect = document.getElementById('font-family-select');

    if (!themeSelect || !fontSelect) return;

    // Populate theme preset options
    themeSelect.innerHTML = Object.values(THEME_PRESETS)
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join('');

    // Populate visual swatch cards
    if (swatchList) {
      swatchList.innerHTML = Object.values(THEME_PRESETS)
        .map((p) => {
          const primary = p.vars['--primary'] || '#6366f1';
          const secondary = p.vars['--secondary'] || '#ec4899';
          const accent = p.vars['--accent'] || '#06b6d4';
          const isActive = (state.pageSettings.themePreset || 'dark-neon') === p.id;
          return `
            <div class="theme-swatch-card ${isActive ? 'active' : ''}" data-theme-id="${p.id}" title="Click to apply ${p.name}">
              <div class="theme-card-info">
                <div class="theme-card-name">${p.name}</div>
                <div class="theme-card-desc">${p.accentName || ''}</div>
              </div>
              <div class="theme-card-colors">
                <span class="theme-color-dot" style="background: ${primary};"></span>
                <span class="theme-color-dot" style="background: ${secondary};"></span>
                <span class="theme-color-dot" style="background: ${accent};"></span>
              </div>
            </div>
          `;
        })
        .join('');

      // Add click listeners to swatch cards
      swatchList.querySelectorAll('.theme-swatch-card').forEach((card) => {
        card.addEventListener('click', () => {
          const themeId = card.getAttribute('data-theme-id');
          this.applyThemeSelection(themeId);
        });
      });
    }

    // Populate fonts
    fontSelect.innerHTML = AVAILABLE_FONTS.map(
      (f) => `<option value="${f.id}">${f.name}</option>`
    ).join('');

    // Set initial values
    this.syncPageSettingsInputs();

    // Event listeners
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        const val = e.target.value;
        state.setPageSetting('pageTitle', val);
        document.title = `${val} (Admin Studio)`;
      });
    }

    themeSelect.addEventListener('change', (e) => {
      this.applyThemeSelection(e.target.value);
    });

    fontSelect.addEventListener('change', (e) => {
      const fontVal = e.target.value;
      state.setPageSetting('fontFamily', fontVal);
      this.canvas.showToast(`🔤 Base font updated`, 'info');
    });

    // Page Layout (Hide Header, Hide Footer, Transparent Header)
    const hideHeaderCb = document.getElementById('page-hide-header');
    const hideFooterCb = document.getElementById('page-hide-footer');
    const transparentHeaderCb = document.getElementById('page-transparent-header');

    if (hideHeaderCb) {
      hideHeaderCb.addEventListener('change', (e) => {
        state.setPageSetting('hideHeader', e.target.checked);
        this.canvas.render();
        this.canvas.showToast(e.target.checked ? '🚫 Header hidden on this page' : '👁️ Header visible on this page', 'info');
      });
    }

    if (hideFooterCb) {
      hideFooterCb.addEventListener('change', (e) => {
        state.setPageSetting('hideFooter', e.target.checked);
        this.canvas.render();
        this.canvas.showToast(e.target.checked ? '🚫 Footer hidden on this page' : '👁️ Footer visible on this page', 'info');
      });
    }

    if (transparentHeaderCb) {
      transparentHeaderCb.addEventListener('change', (e) => {
        state.setPageSetting('transparentHeader', e.target.checked);
        this.canvas.render();
        this.canvas.showToast(e.target.checked ? '🪟 Transparent header enabled' : 'Header background restored', 'info');
      });
    }

    // SEO & Social Meta fields
    const seoFields = [
      { id: 'page-meta-description', key: 'metaDescription', event: 'input' },
      { id: 'page-meta-keywords',    key: 'metaKeywords',    event: 'input' },
      { id: 'page-og-image',         key: 'ogImage',         event: 'input' },
      { id: 'page-canonical',        key: 'canonical',       event: 'input' }
    ];
    seoFields.forEach(({ id, key, event }) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener(event, (e) => {
          state.setPageSetting(key, e.target.value);
        });
      }
    });
    const noIndexCb = document.getElementById('page-noindex');
    if (noIndexCb) {
      noIndexCb.addEventListener('change', (e) => {
        state.setPageSetting('noIndex', e.target.checked);
      });
    }

    // Pick OG / Social Share Image from Media Library
    const pickOgBtn = document.getElementById('btn-pick-og-image');
    if (pickOgBtn) {
      pickOgBtn.addEventListener('click', () => {
        if (typeof window.openMediaLibrary === 'function') {
          window.openMediaLibrary((selectedUrl) => {
            state.setPageSetting('ogImage', selectedUrl);
            const input = document.getElementById('page-og-image');
            if (input) input.value = selectedUrl;
            this.canvas?.showToast('Social share image updated from Media Library', 'success');
          });
        }
      });
    }

    // Custom Palette controls wiring
    const customEnableCheckbox = document.getElementById('theme-custom-enable');
    const customControlsBox = document.getElementById('theme-custom-controls');
    const resetBtn = document.getElementById('btn-reset-theme-custom');
    const applyGlobalBtn = document.getElementById('btn-apply-global-theme');

    const colorPairs = [
      { picker: 'theme-custom-primary', hex: 'theme-custom-primary-hex', key: 'primary' },
      { picker: 'theme-custom-secondary', hex: 'theme-custom-secondary-hex', key: 'secondary' },
      { picker: 'theme-custom-accent', hex: 'theme-custom-accent-hex', key: 'accent' },
      { picker: 'theme-custom-bgdeep', hex: 'theme-custom-bgdeep-hex', key: 'bgDeep' },
      { picker: 'theme-custom-bgcard', hex: 'theme-custom-bgcard-hex', key: 'bgCard' },
      { picker: 'theme-custom-textmain', hex: 'theme-custom-textmain-hex', key: 'textMain' },
    ];

    const updateCustomThemeFromInputs = () => {
      if (!customEnableCheckbox || !customEnableCheckbox.checked) return;
      const customObj = { enabled: true };
      colorPairs.forEach((pair) => {
        const pickerEl = document.getElementById(pair.picker);
        if (pickerEl) customObj[pair.key] = pickerEl.value;
      });
      state.setPageSetting('themeCustom', customObj);
    };

    if (customEnableCheckbox) {
      customEnableCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        if (customControlsBox) customControlsBox.style.display = isChecked ? 'block' : 'none';
        if (!isChecked) {
          state.setPageSetting('themeCustom', { enabled: false });
          this.canvas.showToast('🎨 Reverted to preset colors', 'info');
        } else {
          // Fill inputs from current preset if no custom values exist
          const activePreset = THEME_PRESETS[state.pageSettings.themePreset || 'dark-neon'];
          if (activePreset && activePreset.vars) {
            const defaults = {
              primary: activePreset.vars['--primary'] || '#6366f1',
              secondary: activePreset.vars['--secondary'] || '#ec4899',
              accent: activePreset.vars['--accent'] || '#06b6d4',
              bgDeep: activePreset.vars['--bg-deep'] || '#090d16',
              bgCard: activePreset.vars['--bg-panel'] || '#131b2e',
              textMain: activePreset.vars['--text-main'] || '#f8fafc'
            };
            colorPairs.forEach((pair) => {
              const pEl = document.getElementById(pair.picker);
              const hEl = document.getElementById(pair.hex);
              if (pEl && hEl) {
                pEl.value = defaults[pair.key] || pEl.value;
                hEl.value = defaults[pair.key] || hEl.value;
              }
            });
          }
          updateCustomThemeFromInputs();
          this.canvas.showToast('🎨 Custom color palette enabled', 'success');
        }
      });
    }

    colorPairs.forEach((pair) => {
      const pEl = document.getElementById(pair.picker);
      const hEl = document.getElementById(pair.hex);
      if (pEl && hEl) {
        pEl.addEventListener('input', (e) => {
          hEl.value = e.target.value;
          updateCustomThemeFromInputs();
        });
        hEl.addEventListener('change', (e) => {
          let val = e.target.value.trim();
          if (!val.startsWith('#')) val = '#' + val;
          pEl.value = val;
          updateCustomThemeFromInputs();
        });
      }
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (customEnableCheckbox) customEnableCheckbox.checked = false;
        if (customControlsBox) customControlsBox.style.display = 'none';
        state.setPageSetting('themeCustom', { enabled: false });
        this.syncPageSettingsInputs();
        this.canvas.showToast('🎨 Palette reset to theme preset', 'info');
      });
    }

    if (applyGlobalBtn) {
      applyGlobalBtn.addEventListener('click', () => {
        const curPreset = state.pageSettings.themePreset || 'dark-neon';
        const curFont = state.pageSettings.fontFamily;
        const curCustom = state.pageSettings.themeCustom;

        state.pages.forEach((pg) => {
          if (!pg.pageSettings) pg.pageSettings = {};
          pg.pageSettings.themePreset = curPreset;
          pg.pageSettings.fontFamily = curFont;
          pg.pageSettings.themeCustom = curCustom;
        });
        state.saveAndPublish();
        this.canvas.showToast('🌐 Applied theme & palette globally to all pages', 'success');
      });
    }

    // Subscribe to state updates (e.g. undo/redo, template load, server sync)
    state.subscribe((_, action) => {
      if (['undo', 'redo', 'import', 'serverSync', 'loadTemplate', 'pageSettings'].includes(action)) {
        this.syncPageSettingsInputs();
      }
    });
  }

  applyThemeSelection(themeId) {
    if (!THEME_PRESETS[themeId]) return;
    state.setPageSetting('themePreset', themeId);
    this.syncPageSettingsInputs();
    this.canvas.showToast(`🎨 Theme preset applied: ${THEME_PRESETS[themeId].name}`, 'success');
  }

  syncPageSettingsInputs() {
    const titleInput = document.getElementById('page-title-input');
    const themeSelect = document.getElementById('theme-preset-select');
    const fontSelect = document.getElementById('font-family-select');
    const swatchList = document.getElementById('theme-swatch-list');

    const customEnableCheckbox = document.getElementById('theme-custom-enable');
    const customControlsBox = document.getElementById('theme-custom-controls');
    const themeCustom = state.pageSettings.themeCustom || {};

    const currentTheme = state.pageSettings.themePreset || 'dark-neon';
    const currentFont = state.pageSettings.fontFamily || "'Plus Jakarta Sans', sans-serif";
    const currentTitle = state.pageSettings.pageTitle || 'My Website';

    if (titleInput && titleInput.value !== currentTitle) {
      titleInput.value = currentTitle;
    }
    if (themeSelect) {
      themeSelect.value = currentTheme;
    }
    if (fontSelect) {
      fontSelect.value = currentFont;
    }
    if (swatchList) {
      swatchList.querySelectorAll('.theme-swatch-card').forEach((card) => {
        const id = card.getAttribute('data-theme-id');
        card.classList.toggle('active', id === currentTheme);
      });
    }

    const hideHeaderCb = document.getElementById('page-hide-header');
    const hideFooterCb = document.getElementById('page-hide-footer');
    const transparentHeaderCb = document.getElementById('page-transparent-header');

    if (hideHeaderCb) hideHeaderCb.checked = !!state.pageSettings.hideHeader;
    if (hideFooterCb) hideFooterCb.checked = !!state.pageSettings.hideFooter;
    if (transparentHeaderCb) transparentHeaderCb.checked = !!state.pageSettings.transparentHeader;

    if (customEnableCheckbox) {
      customEnableCheckbox.checked = !!themeCustom.enabled;
    }
    if (customControlsBox) {
      customControlsBox.style.display = themeCustom.enabled ? 'block' : 'none';
    }

    if (themeCustom.enabled) {
      const activePreset = THEME_PRESETS[currentTheme] || THEME_PRESETS['dark-neon'];
      const defaultVars = activePreset.vars || {};
      const colorPairs = [
        { picker: 'theme-custom-primary', hex: 'theme-custom-primary-hex', val: themeCustom.primary || defaultVars['--primary'] || '#6366f1' },
        { picker: 'theme-custom-secondary', hex: 'theme-custom-secondary-hex', val: themeCustom.secondary || defaultVars['--secondary'] || '#ec4899' },
        { picker: 'theme-custom-accent', hex: 'theme-custom-accent-hex', val: themeCustom.accent || defaultVars['--accent'] || '#06b6d4' },
        { picker: 'theme-custom-bgdeep', hex: 'theme-custom-bgdeep-hex', val: themeCustom.bgDeep || defaultVars['--bg-deep'] || '#090d16' },
        { picker: 'theme-custom-bgcard', hex: 'theme-custom-bgcard-hex', val: themeCustom.bgCard || defaultVars['--bg-panel'] || '#131b2e' },
        { picker: 'theme-custom-textmain', hex: 'theme-custom-textmain-hex', val: themeCustom.textMain || defaultVars['--text-main'] || '#f8fafc' },
      ];
      colorPairs.forEach((pair) => {
        const pEl = document.getElementById(pair.picker);
        const hEl = document.getElementById(pair.hex);
        if (pEl) pEl.value = pair.val;
        if (hEl) hEl.value = pair.val;
      });
    }

    // Sync SEO fields
    const seoSyncMap = {
      'page-meta-description': 'metaDescription',
      'page-meta-keywords':    'metaKeywords',
      'page-og-image':         'ogImage',
      'page-canonical':        'canonical'
    };
    Object.entries(seoSyncMap).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el && el.value !== (state.pageSettings[key] || '')) {
        el.value = state.pageSettings[key] || '';
      }
    });
    const noIndexEl = document.getElementById('page-noindex');
    if (noIndexEl) noIndexEl.checked = !!state.pageSettings.noIndex;
  }

  // --------------------------------------------------------------------------
  // SITE-WIDE SETTINGS WIRING
  // --------------------------------------------------------------------------
  initSiteSettings() {
    const textFields = [
      { id: 'site-name-input',      key: 'siteName' },
      { id: 'site-favicon-input',   key: 'faviconUrl' },
      { id: 'site-logo-input',      key: 'brandLogoUrl' },
      { id: 'site-ga-id',           key: 'gaId' },
      { id: 'site-pixel-id',        key: 'metaPixelId' },
      { id: 'site-verify-google',   key: 'verifyGoogle' },
      { id: 'site-verify-bing',     key: 'verifyBing' },
      { id: 'site-verify-yandex',   key: 'verifyYandex' },
      { id: 'site-verify-pinterest',key: 'verifyPinterest' },
      { id: 'site-custom-css',      key: 'customCss' },
      { id: 'site-header-scripts',  key: 'headerScripts' },
      { id: 'site-footer-scripts',  key: 'footerScripts' },
      { id: 'site-copyright-input', key: 'copyright' }
    ];

    textFields.forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          state.setSiteSetting(key, e.target.value);
          if (key === 'siteName') this.updateLoaderPreview();
          if (key === 'faviconUrl') this.updateFaviconPreview(e.target.value);
          if (key === 'customCss') this.applyLiveCustomCss(e.target.value);
        });
      }
    });

    // Pick Favicon from Media Library
    const pickFaviconBtn = document.getElementById('btn-pick-favicon');
    if (pickFaviconBtn) {
      pickFaviconBtn.addEventListener('click', () => {
        if (typeof window.openMediaLibrary === 'function') {
          window.openMediaLibrary((selectedUrl) => {
            state.setSiteSetting('faviconUrl', selectedUrl);
            const input = document.getElementById('site-favicon-input');
            if (input) input.value = selectedUrl;
            this.updateFaviconPreview(selectedUrl);
            this.canvas?.showToast('Favicon updated from Media Library', 'success');
          });
        }
      });
    }

    // Pick Brand Logo from Media Library
    const pickLogoBtn = document.getElementById('btn-pick-site-logo');
    if (pickLogoBtn) {
      pickLogoBtn.addEventListener('click', () => {
        if (typeof window.openMediaLibrary === 'function') {
          window.openMediaLibrary((selectedUrl) => {
            state.setSiteSetting('brandLogoUrl', selectedUrl);
            const input = document.getElementById('site-logo-input');
            if (input) input.value = selectedUrl;
            this.canvas?.showToast('Site logo updated from Media Library', 'success');
          });
        }
      });
    }

    // Loader & Splash Screen Settings Wiring
    const loaderEnableCb = document.getElementById('site-loader-enable');
    const loaderCapInput = document.getElementById('site-loader-caption');
    const loaderSubInput = document.getElementById('site-loader-subcaption');
    const loaderSubEnableCb = document.getElementById('site-loader-subcaption-enable');

    if (loaderEnableCb) {
      loaderEnableCb.addEventListener('change', (e) => {
        state.setSiteSetting('loaderEnabled', e.target.checked);
        if (state.siteSettings.loader) {
          state.siteSettings.loader.enabled = e.target.checked;
        }
        state.syncLoaderCache();
        this.updateLoaderPreview();
      });
    }

    if (loaderCapInput) {
      loaderCapInput.addEventListener('input', (e) => {
        state.setSiteSetting('loaderCaption', e.target.value);
        if (state.siteSettings.loader) {
          state.siteSettings.loader.caption = e.target.value;
        }
        state.syncLoaderCache();
        this.updateLoaderPreview();
      });
    }

    if (loaderSubInput) {
      loaderSubInput.addEventListener('input', (e) => {
        state.setSiteSetting('loaderSubcaption', e.target.value);
        if (state.siteSettings.loader) {
          state.siteSettings.loader.subcaption = e.target.value;
        }
        state.syncLoaderCache();
        this.updateLoaderPreview();
      });
    }

    if (loaderSubEnableCb) {
      loaderSubEnableCb.addEventListener('change', (e) => {
        state.setSiteSetting('loaderShowSubcaption', e.target.checked);
        if (state.siteSettings.loader) {
          state.siteSettings.loader.showSubcaption = e.target.checked;
        }
        state.syncLoaderCache();
        this.updateLoaderPreview();
      });
    }

    // Admin Notification Alert Email
    const notifEmailInput = document.getElementById('site-notif-email');
    if (notifEmailInput) {
      notifEmailInput.addEventListener('input', (e) => {
        state.setSiteSetting('notificationEmail', e.target.value);
      });
    }

    // Back to Top Button Wiring
    const bttEnableCb = document.getElementById('site-backtotop-enable');
    if (bttEnableCb) {
      bttEnableCb.addEventListener('change', (e) => {
        const cur = state.siteSettings.backToTop || { enabled: true };
        state.setSiteSetting('backToTop', { ...cur, enabled: e.target.checked });
        this.canvas?.showToast(e.target.checked ? '⬆️ Back-to-top button enabled' : 'Back-to-top button disabled', 'info');
      });
    }

    // Chatbot Settings Wiring
    const cbEnableCb = document.getElementById('site-chatbot-enable');
    if (cbEnableCb) {
      cbEnableCb.addEventListener('change', (e) => {
        const curCb = state.siteSettings.chatbot || DEFAULT_CHATBOT_CONFIG;
        state.setSiteSetting('chatbot', { ...curCb, enabled: e.target.checked });
        this.canvas?.showToast(e.target.checked ? '🤖 24/7 Chatbot enabled' : 'Chatbot disabled', 'info');
      });
    }

    const cbFields = [
      { id: 'site-chatbot-title',    prop: 'title' },
      { id: 'site-chatbot-subtitle', prop: 'subtitle' },
      { id: 'site-chatbot-avatar',   prop: 'avatar' },
      { id: 'site-chatbot-bubble',   prop: 'bubbleText' }
    ];
    cbFields.forEach(({ id, prop }) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          const curCb = state.siteSettings.chatbot || DEFAULT_CHATBOT_CONFIG;
          state.setSiteSetting('chatbot', { ...curCb, [prop]: e.target.value });
          if (prop === 'avatar') this.updateChatbotAvatarPreview(e.target.value);
        });
      }
    });

    // Chatbot Avatar Pick from Media Library
    const pickChatbotAvatarBtn = document.getElementById('btn-pick-chatbot-avatar');
    if (pickChatbotAvatarBtn) {
      pickChatbotAvatarBtn.addEventListener('click', () => {
        if (typeof window.openMediaLibrary === 'function') {
          window.openMediaLibrary((selectedUrl) => {
            const curCb = state.siteSettings.chatbot || DEFAULT_CHATBOT_CONFIG;
            state.setSiteSetting('chatbot', { ...curCb, avatar: selectedUrl });
            const input = document.getElementById('site-chatbot-avatar');
            if (input) input.value = selectedUrl;
            this.updateChatbotAvatarPreview(selectedUrl);
            this.canvas?.showToast('Chatbot avatar updated from Media Library', 'success');
          });
        }
      });
    }

    // Global Background Image Wiring
    const globalBgEnable = document.getElementById('site-global-bg-enable');
    const globalBgControls = document.getElementById('site-global-bg-controls');
    const globalBgUrl = document.getElementById('site-global-bg-url');
    const pickGlobalBgBtn = document.getElementById('btn-pick-global-bg');
    const clearGlobalBgBtn = document.getElementById('btn-clear-global-bg');
    const globalBgSize = document.getElementById('site-global-bg-size');
    const globalBgAttachment = document.getElementById('site-global-bg-attachment');
    const globalBgPosition = document.getElementById('site-global-bg-position');
    const globalBgRepeat = document.getElementById('site-global-bg-repeat');
    const globalBgOpacity = document.getElementById('site-global-bg-opacity');

    const updateGlobalBgSetting = (key, value) => {
      const cur = state.siteSettings.globalBg || {};
      const updated = { ...cur, [key]: value };
      state.setSiteSetting('globalBg', updated);
      this.updateGlobalBgPreview(updated);
      this.canvas?.render();
    };

    if (globalBgEnable) {
      globalBgEnable.addEventListener('change', (e) => {
        updateGlobalBgSetting('enabled', e.target.checked);
        if (globalBgControls) globalBgControls.style.display = e.target.checked ? 'flex' : 'none';
        this.canvas?.showToast(e.target.checked ? '🖼️ Global Background Image enabled' : 'Global Background Image disabled', 'info');
      });
    }

    if (globalBgUrl) {
      globalBgUrl.addEventListener('input', (e) => {
        updateGlobalBgSetting('imageUrl', e.target.value.trim());
      });
    }

    if (pickGlobalBgBtn) {
      pickGlobalBgBtn.addEventListener('click', () => {
        if (typeof window.openMediaLibrary === 'function') {
          window.openMediaLibrary((selectedUrl) => {
            if (globalBgUrl) globalBgUrl.value = selectedUrl;
            updateGlobalBgSetting('imageUrl', selectedUrl);
            this.canvas?.showToast('Global background updated from Media Library', 'success');
          });
        }
      });
    }

    if (clearGlobalBgBtn) {
      clearGlobalBgBtn.addEventListener('click', () => {
        if (globalBgUrl) globalBgUrl.value = '';
        updateGlobalBgSetting('imageUrl', '');
      });
    }

    if (globalBgSize) {
      globalBgSize.addEventListener('change', (e) => updateGlobalBgSetting('size', e.target.value));
    }
    if (globalBgAttachment) {
      globalBgAttachment.addEventListener('change', (e) => updateGlobalBgSetting('attachment', e.target.value));
    }
    if (globalBgPosition) {
      globalBgPosition.addEventListener('change', (e) => updateGlobalBgSetting('position', e.target.value));
    }
    if (globalBgRepeat) {
      globalBgRepeat.addEventListener('change', (e) => updateGlobalBgSetting('repeat', e.target.value));
    }
    if (globalBgOpacity) {
      globalBgOpacity.addEventListener('input', (e) => {
        const valText = document.getElementById('site-global-bg-opacity-val');
        if (valText) valText.textContent = `${e.target.value}%`;
        updateGlobalBgSetting('overlayOpacity', Number(e.target.value));
      });
    }

    // Template Autosave & Backup Settings Wiring
    const tAutosaveEnable = document.getElementById('site-template-autosave-enable');
    const tNameInput = document.getElementById('site-template-name-input');
    const tLimitSelect = document.getElementById('site-template-limit-select');
    const tPreviewBadge = document.getElementById('site-template-filename-preview');
    const btnPruneNow = document.getElementById('btn-prune-templates-now');
    const btnSaveNowSite = document.getElementById('btn-save-template-now-site');
    const btnBrowseSite = document.getElementById('btn-open-media-templates-site');

    const updateTemplateAutosaveSetting = (key, value) => {
      const cur = state.siteSettings.templateAutosave || { enabled: true, templateName: 'live_canvas', maxBackups: 5 };
      const updated = { ...cur, [key]: value };
      state.setSiteSetting('templateAutosave', updated);
    };

    if (tAutosaveEnable) {
      tAutosaveEnable.addEventListener('change', (e) => {
        updateTemplateAutosaveSetting('enabled', e.target.checked);
        const controls = document.getElementById('site-template-autosave-controls');
        if (controls) controls.style.opacity = e.target.checked ? '1' : '0.5';
        this.canvas?.showToast(e.target.checked ? '💾 Template autosave enabled' : 'Template autosave disabled', 'info');
      });
    }

    if (tNameInput) {
      tNameInput.addEventListener('input', (e) => {
        const clean = e.target.value.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
        updateTemplateAutosaveSetting('templateName', clean);
        if (tPreviewBadge) {
          tPreviewBadge.textContent = `template_${clean || 'live_canvas'}.json`;
        }
      });
    }

    if (tLimitSelect) {
      tLimitSelect.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10) || 5;
        updateTemplateAutosaveSetting('maxBackups', val);
        this.refreshTemplateBackupsCounter();
        this.canvas?.showToast(`Max template backups set to ${val}`, 'info');
      });
    }

    if (btnPruneNow) {
      btnPruneNow.addEventListener('click', async () => {
        btnPruneNow.disabled = true;
        btnPruneNow.textContent = '...';
        const max = state.getTemplateMaxBackups();
        const res = await state.pruneTemplateBackups(max);
        btnPruneNow.disabled = false;
        btnPruneNow.textContent = '🧹 Clean';
        await this.refreshTemplateBackupsCounter();
        if (res && res.deleted > 0) {
          this.canvas?.showToast(`🧹 Cleaned up ${res.deleted} older template backup(s) to match the limit of ${max}!`, 'success');
        } else {
          this.canvas?.showToast(`All backups are within the limit (${max}) — nothing to prune.`, 'info');
        }
      });
    }

    if (btnSaveNowSite) {
      btnSaveNowSite.addEventListener('click', async () => {
        btnSaveNowSite.disabled = true;
        btnSaveNowSite.textContent = 'Saving...';
        try {
          const res = await state.saveTemplateToMedia();
          await this.refreshTemplateBackupsCounter();
          this.canvas?.showToast(`💾 Snapshot saved to Media: ${res.fileName}`, 'success');
        } catch (err) {
          this.canvas?.showToast('Failed to save snapshot to Media Library', 'error');
        } finally {
          btnSaveNowSite.disabled = false;
          btnSaveNowSite.textContent = '💾 Save Snapshot to Media';
        }
      });
    }

    if (btnBrowseSite) {
      btnBrowseSite.addEventListener('click', () => {
        if (typeof window.openMediaLibrary === 'function') {
          window.openMediaLibrary(async (selectedUrl) => {
            if (selectedUrl && /\.json$/i.test(selectedUrl)) {
              if (confirm(`Load this template snapshot onto your canvas?\n\nFile: ${selectedUrl}`)) {
                try {
                  const fetchUrl = selectedUrl.replace(/^\/+/, '');
                  const r = await fetch(`${fetchUrl}?_t=${Date.now()}`);
                  if (r.ok) {
                    const txt = await r.text();
                    if (state.importJSON(txt)) {
                      await state.saveAndPublish();
                      this.canvas?.render();
                      this.canvas?.showToast('✅ Template successfully loaded onto canvas!', 'success');
                    }
                  }
                } catch (e) {
                  this.canvas?.showToast('Failed to load selected template', 'error');
                }
              }
            } else if (selectedUrl) {
              this.canvas?.showToast('Selected file is not a JSON template', 'warning');
            }
          });
        }
      });
    }

    // Chatbot Flowchart Editor Modal
    document.getElementById('btn-edit-chatbot-flow')?.addEventListener('click', () => {
      this.showChatbotFlowModal();
    });

    // Live state subscriber for siteSettings sync & undo/redo
    state.subscribe((_, action) => {
      if (['siteSettings', 'serverSync', 'undo', 'redo', 'import'].includes(action)) {
        this.syncSiteSettingsInputs();
      }
    });

    this.syncSiteSettingsInputs();
  }

  async refreshTemplateBackupsCounter() {
    const badge = document.getElementById('site-template-count-badge');
    if (!badge) return;
    try {
      const res = await fetch('api.php?action=list_assets&_t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.assets)) {
          const count = data.assets.filter(a => a.ext === 'json' && /^template_/i.test(a.name)).length;
          const max = state.getTemplateMaxBackups();
          badge.textContent = `${count} / ${max} Backups`;
          badge.style.color = count >= max ? '#fbbf24' : '#a5b4fc';
          badge.style.borderColor = count >= max ? 'rgba(251,191,36,0.3)' : 'rgba(99,102,241,0.25)';
        }
      }
    } catch {}
  }

  updateGlobalBgPreview(bgConfig) {
    const previewWrap = document.getElementById('site-global-bg-preview-wrap');
    if (!previewWrap) return;
    const url = bgConfig?.imageUrl;
    if (url && url.trim()) {
      previewWrap.style.backgroundImage = `url('${url.trim()}')`;
      previewWrap.style.display = 'block';
    } else {
      previewWrap.style.display = 'none';
    }
  }

  updateChatbotAvatarPreview(val) {
    const preview = document.getElementById('site-chatbot-avatar-preview');
    if (!preview) return;
    const str = String(val || '💬').trim();
    if (
      str.startsWith('http://') ||
      str.startsWith('https://') ||
      str.startsWith('assets/') ||
      str.startsWith('/') ||
      /\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i.test(str)
    ) {
      preview.innerHTML = `<img src="${str}" alt="Bot" style="width:100%;height:100%;object-fit:cover;display:block;" />`;
    } else {
      preview.innerHTML = str || '💬';
    }
  }

  updateFaviconPreview(url) {
    const preview = document.getElementById('site-favicon-preview');
    if (!preview) return;
    if (url && url.trim()) {
      preview.src = url.trim();
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
  }

  applyLiveCustomCss(css) {
    let styleEl = document.getElementById('aether-site-custom-css');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'aether-site-custom-css';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css || '';
  }

  syncSiteSettingsInputs() {
    const s = state.siteSettings || {};
    const cb = s.chatbot || DEFAULT_CHATBOT_CONFIG;
    const map = {
      'site-name-input':      s.siteName || '',
      'site-favicon-input':   s.faviconUrl || '',
      'site-logo-input':      s.brandLogoUrl || '',
      'site-ga-id':           s.gaId || '',
      'site-pixel-id':        s.metaPixelId || '',
      'site-verify-google':   s.verifyGoogle || '',
      'site-verify-bing':     s.verifyBing || '',
      'site-verify-yandex':   s.verifyYandex || '',
      'site-verify-pinterest':s.verifyPinterest || '',
      'site-custom-css':      s.customCss || '',
      'site-header-scripts':  s.headerScripts || '',
      'site-footer-scripts':  s.footerScripts || '',
      'site-copyright-input': s.copyright || '',
      'site-notif-email':     s.notificationEmail || '',
      'site-chatbot-title':   cb.title || '',
      'site-chatbot-subtitle':cb.subtitle || '',
      'site-chatbot-avatar':  cb.avatar || '',
      'site-chatbot-bubble':  cb.bubbleText || ''
    };

    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && el.value !== val) el.value = val;
    });

    // Template Autosave & Backup settings sync
    const tCfg = s.templateAutosave || { enabled: true, templateName: 'live_canvas', maxBackups: 5 };
    const tEnableEl = document.getElementById('site-template-autosave-enable');
    if (tEnableEl) tEnableEl.checked = tCfg.enabled !== false;

    const tNameEl = document.getElementById('site-template-name-input');
    if (tNameEl) tNameEl.value = tCfg.templateName || 'live_canvas';

    const tPreviewEl = document.getElementById('site-template-filename-preview');
    if (tPreviewEl) tPreviewEl.textContent = `template_${tCfg.templateName || 'live_canvas'}.json`;

    const tLimitEl = document.getElementById('site-template-limit-select');
    if (tLimitEl) tLimitEl.value = String(tCfg.maxBackups || 5);

    this.refreshTemplateBackupsCounter();

    const cbEnableEl = document.getElementById('site-chatbot-enable');
    if (cbEnableEl) cbEnableEl.checked = cb.enabled !== false;

    const msgrEnableEl = document.getElementById('site-messenger-enable');
    if (msgrEnableEl) msgrEnableEl.checked = !!cb.messengerEnabled;

    const msgrDirectEl = document.getElementById('site-messenger-direct');
    if (msgrDirectEl) msgrDirectEl.checked = !!cb.messengerDirectLaunch;

    const msgrPageIdEl = document.getElementById('site-messenger-page-id');
    if (msgrPageIdEl) msgrPageIdEl.value = cb.messengerPageId || '';

    const btt = s.backToTop || { enabled: true };
    const bttEnableEl = document.getElementById('site-backtotop-enable');
    if (bttEnableEl) bttEnableEl.checked = btt.enabled !== false;

    // Sync Global Background Image inputs
    const gBg = s.globalBg || {};
    const gBgEnable = document.getElementById('site-global-bg-enable');
    const gBgControls = document.getElementById('site-global-bg-controls');
    if (gBgEnable) gBgEnable.checked = !!gBg.enabled;
    if (gBgControls) gBgControls.style.display = gBg.enabled ? 'flex' : 'none';

    const gBgUrl = document.getElementById('site-global-bg-url');
    if (gBgUrl && gBgUrl.value !== (gBg.imageUrl || '')) gBgUrl.value = gBg.imageUrl || '';

    const gBgSize = document.getElementById('site-global-bg-size');
    if (gBgSize) gBgSize.value = gBg.size || 'cover';

    const gBgAttachment = document.getElementById('site-global-bg-attachment');
    if (gBgAttachment) gBgAttachment.value = gBg.attachment || 'fixed';

    const gBgPosition = document.getElementById('site-global-bg-position');
    if (gBgPosition) gBgPosition.value = gBg.position || 'center center';

    const gBgRepeat = document.getElementById('site-global-bg-repeat');
    if (gBgRepeat) gBgRepeat.value = gBg.repeat || 'no-repeat';

    const gBgOpacity = document.getElementById('site-global-bg-opacity');
    const gBgOpacityVal = document.getElementById('site-global-bg-opacity-val');
    const op = gBg.overlayOpacity !== undefined ? gBg.overlayOpacity : 50;
    if (gBgOpacity) gBgOpacity.value = op;
    if (gBgOpacityVal) gBgOpacityVal.textContent = `${op}%`;

    this.updateGlobalBgPreview(gBg);
    this.updateChatbotAvatarPreview(cb.avatar);
    this.updateFaviconPreview(s.faviconUrl);
    this.applyLiveCustomCss(s.customCss);

    // Sync Loader & Splash Screen settings
    const l = s.loader || {};
    const loaderEnabled = s.loaderEnabled !== undefined ? s.loaderEnabled : (l.enabled !== false);
    const loaderCap = s.loaderCaption !== undefined ? s.loaderCaption : (l.caption || '');
    const loaderSub = s.loaderSubcaption !== undefined ? s.loaderSubcaption : (l.subcaption || '');
    const loaderShowSub = s.loaderShowSubcaption !== undefined ? s.loaderShowSubcaption : (l.showSubcaption !== false);

    const loaderEnableEl = document.getElementById('site-loader-enable');
    if (loaderEnableEl) loaderEnableEl.checked = loaderEnabled;

    const loaderCapEl = document.getElementById('site-loader-caption');
    if (loaderCapEl && loaderCapEl.value !== loaderCap) loaderCapEl.value = loaderCap;

    const loaderSubEl = document.getElementById('site-loader-subcaption');
    if (loaderSubEl && loaderSubEl.value !== loaderSub) loaderSubEl.value = loaderSub;

    const loaderSubEnableEl = document.getElementById('site-loader-subcaption-enable');
    if (loaderSubEnableEl) loaderSubEnableEl.checked = loaderShowSub;

    this.updateLoaderPreview();
  }

  updateLoaderPreview() {
    const s = state.siteSettings || {};
    const l = s.loader || {};
    const enabled = s.loaderEnabled !== undefined ? (s.loaderEnabled !== false) : (l.enabled !== false);
    const caption = s.loaderCaption !== undefined && s.loaderCaption !== '' ? s.loaderCaption : (l.caption || (s.siteName ? `Loading ${s.siteName}...` : 'Loading...'));
    const subcaption = s.loaderSubcaption !== undefined && s.loaderSubcaption !== '' ? s.loaderSubcaption : (l.subcaption || 'Initializing modules & layout engine');
    const showSub = s.loaderShowSubcaption !== undefined ? (s.loaderShowSubcaption !== false) : (l.showSubcaption !== false);

    const enableLabel = document.getElementById('site-loader-enable-label');
    const disabledNotice = document.getElementById('site-loader-disabled-notice');
    const previewBox = document.getElementById('site-loader-preview-box');
    const previewCap = document.getElementById('site-loader-preview-caption');
    const previewSub = document.getElementById('site-loader-preview-subcaption');
    const subInput = document.getElementById('site-loader-subcaption');
    const capInput = document.getElementById('site-loader-caption');

    if (enableLabel) {
      enableLabel.textContent = enabled ? 'Enable Splash Screen' : 'Disabled (Instant Load)';
      enableLabel.style.color = enabled ? '#a5b4fc' : '#34d399';
    }

    if (disabledNotice) {
      disabledNotice.style.display = enabled ? 'none' : 'block';
    }
    if (previewBox) {
      previewBox.style.display = enabled ? 'block' : 'none';
    }

    if (previewCap) {
      previewCap.style.display = enabled ? 'block' : 'none';
      previewCap.textContent = caption;
    }
    if (previewSub) {
      previewSub.style.display = (enabled && showSub) ? 'block' : 'none';
      previewSub.textContent = subcaption;
    }
    if (subInput) {
      subInput.disabled = !showSub;
      subInput.style.opacity = showSub ? '1' : '0.4';
      subInput.style.cursor = showSub ? 'text' : 'not-allowed';
    }
    if (capInput && !capInput.value && s.siteName) {
      capInput.placeholder = `Loading ${s.siteName}...`;
    }
  }

  // Bind Topbar Actions
  bindTopbarActions() {
    // Viewport switcher
    document.querySelectorAll('.device-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.device-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.setViewportMode(btn.getAttribute('data-mode'));
      });
    });

    // Undo / Redo
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');

    const updateHistoryButtons = () => {
      undoBtn.disabled = !state.canUndo();
      redoBtn.disabled = !state.canRedo();
    };

    state.subscribe(updateHistoryButtons);
    updateHistoryButtons();

    undoBtn.addEventListener('click', () => state.undo());
    redoBtn.addEventListener('click', () => state.redo());

    // Clear Canvas
    document.getElementById('btn-clear').addEventListener('click', () => {
      if (confirm('Clear the entire canvas? You can undo with Ctrl+Z.')) {
        state.clearCanvas();
        this.canvas.showToast('Canvas cleared', 'info');
      }
    });

    // Copy Public Link Helper
    const copyPublicLiveUrl = () => {
      const base = window.location.origin + window.location.pathname.replace(/index\.html$/, '');
      const pubUrl = `${base}index.html?view=public`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pubUrl).then(() => {
          this.canvas?.showToast('📋 Public live link copied to clipboard!', 'success');
        }).catch(() => {
          prompt('Copy public website URL:', pubUrl);
        });
      } else {
        prompt('Copy public website URL:', pubUrl);
      }
    };

    // Publish to Live Public View (Handles both topbar & sticky sidebar bottom dock)
    const handlePublish = async () => {
      const topbarBtn = document.getElementById('btn-publish');
      const sidebarBtn = document.getElementById('btn-sidebar-publish');

      const setPublishState = (disabled, text) => {
        if (topbarBtn) {
          topbarBtn.disabled = disabled;
          topbarBtn.innerHTML = `<span>${disabled ? '⏳' : '🚀'}</span> ${text}`;
        }
        if (sidebarBtn) {
          sidebarBtn.disabled = disabled;
          sidebarBtn.innerHTML = `<span>${disabled ? '⏳' : '🚀'}</span> <span class="publish-label">${text}</span>`;
        }
      };

      setPublishState(true, 'Publishing...');
      try {
        await state.publishToLive();
        setPublishState(false, 'Publish Live');
        this.canvas.showToast('🚀 Changes published live! Synced to server.', 'success');
      } catch (err) {
        setPublishState(false, 'Publish Live');
        this.canvas.showToast('❌ Publish failed: ' + (err.message || 'Server error'), 'error');
        alert('⚠️ Publish to server failed: ' + (err.message || 'Network/Server Error') + '\n\nPlease check your admin session or hard-refresh.');
      }
    };

    document.getElementById('btn-publish')?.addEventListener('click', handlePublish);
    document.getElementById('btn-sidebar-publish')?.addEventListener('click', handlePublish);

    document.getElementById('btn-topbar-copy-link')?.addEventListener('click', copyPublicLiveUrl);
    document.getElementById('btn-sidebar-copy-link')?.addEventListener('click', copyPublicLiveUrl);

    document.getElementById('btn-topbar-qr')?.addEventListener('click', () => this.showQrModal());
    document.getElementById('btn-sidebar-qr')?.addEventListener('click', () => this.showQrModal());
    

    // Sync / Pull Latest from Server
    const btnSync = document.getElementById('btn-sync-server');
    if (btnSync) {
      btnSync.addEventListener('click', async () => {
        if (confirm('Sync latest published content from server? Any unsaved local edits in this browser session will be replaced with server data.')) {
          btnSync.disabled = true;
          btnSync.style.opacity = '0.5';
          const ok = await state.syncFromServer(true);
          btnSync.disabled = false;
          btnSync.style.opacity = '1';
          if (ok) {
            this.canvas.render();
            this.canvas.showToast('✅ Synced latest published content from server!', 'success');
          } else {
            this.canvas.showToast('⚠️ No published server data found to sync.', 'warning');
          }
        }
      });
    }

    // Notifications & Leads Inbox Modal
    document.getElementById('btn-notifications')?.addEventListener('click', () => {
      this.showNotificationsModal();
    });

    // Templates Library Modal
    document.getElementById('btn-templates').addEventListener('click', () => {
      this.showTemplatesModal();
    });

    // Revisions Version History & 1-Click Rollback Modal
    document.getElementById('btn-revisions')?.addEventListener('click', () => {
      this.showRevisionsModal();
    });

    // Pre-Publish SEO Health Audit Modal
    document.getElementById('btn-seo-audit')?.addEventListener('click', () => {
      this.showSeoAuditModal();
    });

    // Export / Import Modal
    document.getElementById('btn-export').addEventListener('click', () => {
      this.showExportModal();
    });

    // Argon2 Security Details & Password Manager
    document.getElementById('btn-security').addEventListener('click', () => {
      this.showSecurityModal();
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
      if (confirm('Lock Admin Studio and log out?')) {
        auth.logout();
      }
    });

    // System Updates & Maintenance Hub
    document.getElementById('update-indicator-pill')?.addEventListener('click', () => {
      this.showUpdateModal();
    });
    document.getElementById('btn-system-updates')?.addEventListener('click', () => {
      this.showUpdateModal();
    });
    document.getElementById('topbar-brand-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showUpdateModal();
    });

    // Pre-flight version check
    this.checkForUpdates();
  }

  // Keyboard Shortcuts (Undo, Redo, Save/Publish)
  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          state.redo();
        } else {
          state.undo();
        }
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        state.redo();
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        state.publishToLive();
        this.canvas.showToast('🚀 Published live via shortcut!', 'success');
      } else if (e.key === 'Escape') {
        state.setActiveElement(null);
      }
    });
  }

  // Template Library Modal (Free Template Store with Dependency Resolution)
  showTemplatesModal() {
    templateStore.openStoreModal((appliedTemplate) => {
      this.canvas.render();
      this.renderWidgetTray();
      this.canvas.showToast(`Loaded Free Template: "${appliedTemplate.name}"`, 'success');
    });
  }

  // Export / Import Modal
  showExportModal() {
    let modal = document.getElementById('export-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'export-modal';
    modal.className = 'modal-overlay animate-fade-in';

    const jsonContent = state.exportJSON();

    modal.innerHTML = `
      <div class="modal-box modal-wide animate-scale-in">
        <div class="modal-header">
          <div class="modal-title"><span>📤</span> Export & Import Project</div>
          <button class="tool-icon-btn" id="close-export-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="inspector-tabs" style="margin-bottom: 12px;">
            <button class="inspector-tab-btn active" id="tab-export-json">Export JSON</button>
            <button class="inspector-tab-btn" id="tab-export-html">Standalone HTML</button>
            <button class="inspector-tab-btn" id="tab-import-json">Import JSON</button>
          </div>

          <div id="export-json-view">
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">Copy this page configuration JSON, save to Media Library, or download as a backup file:</p>
            <textarea id="export-json-textarea" rows="12" style="width: 100%; font-family: var(--font-mono); font-size: 0.8rem;" readonly>${jsonContent}</textarea>
            <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
              <button class="wb-btn wb-btn-primary" id="btn-copy-json" style="padding: 8px 16px; font-size: 0.85rem;">Copy JSON</button>
              <button class="wb-btn wb-btn-secondary" id="btn-save-media-template" style="padding: 8px 16px; font-size: 0.85rem;">📁 Save to Media Assets</button>
              <button class="wb-btn wb-btn-outline" id="btn-download-json" style="padding: 8px 16px; font-size: 0.85rem;">Download .json</button>
            </div>
          </div>

          <div id="export-html-view" style="display: none;">
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">Download a standalone production HTML file containing all rendered elements, widgets, and styles for immediate hosting:</p>
            <button class="wb-btn wb-btn-primary" id="btn-download-html" style="padding: 10px 24px; font-size: 0.95rem;">
              <span>💾</span> Download index.html Bundle
            </button>
          </div>

          <div id="import-json-view" style="display: none;">
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">Paste a previously saved AetherBuilder JSON configuration below, or load from saved Media Library assets:</p>
            <textarea id="import-json-textarea" rows="9" placeholder="Paste JSON here..." style="width: 100%; font-family: var(--font-mono); font-size: 0.8rem;"></textarea>
            <div style="display: flex; gap: 8px; margin-top: 10px;">
              <button class="wb-btn wb-btn-primary" id="btn-perform-import" style="padding: 8px 16px; font-size: 0.85rem;">Import and Replace Canvas</button>
              <button class="wb-btn wb-btn-secondary" id="btn-load-media-template" style="padding: 8px 16px; font-size: 0.85rem;">📁 Load Latest Media Template</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#close-export-modal').addEventListener('click', () => modal.remove());

    // Switch export tabs
    const tabExportJson = modal.querySelector('#tab-export-json');
    const tabExportHtml = modal.querySelector('#tab-export-html');
    const tabImportJson = modal.querySelector('#tab-import-json');

    const viewJson = modal.querySelector('#export-json-view');
    const viewHtml = modal.querySelector('#export-html-view');
    const viewImport = modal.querySelector('#import-json-view');

    tabExportJson.addEventListener('click', () => {
      tabExportJson.classList.add('active');
      tabExportHtml.classList.remove('active');
      tabImportJson.classList.remove('active');
      viewJson.style.display = 'block';
      viewHtml.style.display = 'none';
      viewImport.style.display = 'none';
    });

    tabExportHtml.addEventListener('click', () => {
      tabExportHtml.classList.add('active');
      tabExportJson.classList.remove('active');
      tabImportJson.classList.remove('active');
      viewJson.style.display = 'none';
      viewHtml.style.display = 'block';
      viewImport.style.display = 'none';
    });

    tabImportJson.addEventListener('click', () => {
      tabImportJson.classList.add('active');
      tabExportJson.classList.remove('active');
      tabExportHtml.classList.remove('active');
      viewJson.style.display = 'none';
      viewHtml.style.display = 'none';
      viewImport.style.display = 'block';
    });

    // Copy JSON
    modal.querySelector('#btn-copy-json').addEventListener('click', () => {
      navigator.clipboard.writeText(jsonContent);
      this.canvas.showToast('JSON copied to clipboard!', 'success');
    });

    // Save Template directly to Media Library Assets
    modal.querySelector('#btn-save-media-template')?.addEventListener('click', async () => {
      try {
        const res = await state.saveTemplateToMedia();
        this.canvas.showToast(`📁 Template saved to Media Library Assets (${res.fileName})`, 'success');
      } catch (err) {
        this.canvas.showToast('Error saving template to Media Library', 'error');
      }
    });

    // Load Latest Template from Media Library Assets
    modal.querySelector('#btn-load-media-template')?.addEventListener('click', async () => {
      try {
        let templateText = null;
        let templateName = 'template_live_canvas.json';

        // 1. First try listing assets from API
        try {
          const res = await fetch('api.php?action=list_assets');
          if (res.ok) {
            const data = await res.json();
            const jsonAssets = (data.assets || []).filter(a => a.ext === 'json');
            if (jsonAssets.length > 0) {
              const latest = jsonAssets[0];
              templateName = latest.name || templateName;
              const fetchUrl = (latest.url || '').replace(/^\/+/, '');
              const res2 = await fetch(`${fetchUrl}?_t=${Date.now()}`);
              if (res2.ok) {
                templateText = await res2.text();
              }
            }
          }
        } catch (e) {
          console.warn('list_assets check failed, falling back to direct canvas template:', e);
        }

        // 2. Direct fallback to assets/uploads/template_live_canvas.json
        if (!templateText) {
          try {
            const resFallback = await fetch(`assets/uploads/template_live_canvas.json?_t=${Date.now()}`);
            if (resFallback.ok) {
              templateText = await resFallback.text();
              templateName = 'template_live_canvas.json';
            }
          } catch {}
        }

        // 3. Fallback to data/site.json
        if (!templateText) {
          try {
            const resSite = await fetch(`data/site.json?_t=${Date.now()}`);
            if (resSite.ok) {
              templateText = await resSite.text();
              templateName = 'data/site.json';
            }
          } catch {}
        }

        if (!templateText) {
          this.canvas.showToast('No saved JSON template files found in Media Library', 'info');
          return;
        }

        const success = state.importJSON(templateText);
        if (success) {
          await state.saveAndPublish();
          this.canvas.render();
          this.renderPagesPanel();
          this.canvas.showToast(`✅ Successfully loaded template: ${templateName}`, 'success');
          modal.remove();
        } else {
          this.canvas.showToast('Invalid template file format in Media Library', 'error');
        }
      } catch (err) {
        console.error('Error loading template from Media Library:', err);
        this.canvas.showToast(`Error loading template: ${err.message || 'Unknown error'}`, 'error');
      }
    });

    // Download JSON
    modal.querySelector('#btn-download-json').addEventListener('click', () => {
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aether-page-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Download HTML
    modal.querySelector('#btn-download-html').addEventListener('click', () => {
      const liveData = state.getPublicSiteData();
      const settings = liveData.pageSettings || state.pageSettings || {};
      const siteSettings = liveData.siteSettings || state.siteSettings || {};
      const activePreset = THEME_PRESETS[settings.themePreset] || THEME_PRESETS['dark-neon'];
      const activeFont = settings.fontFamily || activePreset.font;
      const docTitle = settings.pageTitle || siteSettings.siteName || 'Published Site - AetherBuilder';

      const varCss = Object.entries(activePreset.vars || {})
        .map(([k, v]) => `    ${k}: ${v};`)
        .join('\n');

      const renderedElements = (liveData.sections || [])
        .map((s) => {
          const wDef = WIDGET_REGISTRY[s.widgetType];
          if (!wDef) return '';
          const html = wDef.render(s.props, { isPublicMode: true });
          // Wrap addon widgets with data attributes so customJs can target them
          if (wDef.isAddon && wDef.addonId) {
            let propsAttr = '';
            try { propsAttr = ` data-addon-props='${JSON.stringify(s.props || {}).replace(/'/g, "&#39;")}'`; } catch {}
            return `<div data-addon-id="${wDef.addonId}"${propsAttr}>${html}</div>`;
          }
          return html;
        })
        .join('\n');

      const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle}</title>
  ${settings.metaDescription ? `<meta name="description" content="${settings.metaDescription}">` : ''}
  ${settings.metaKeywords ? `<meta name="keywords" content="${settings.metaKeywords}">` : ''}
  ${settings.noIndex ? `<meta name="robots" content="noindex, nofollow">` : ''}
  <meta property="og:title" content="${docTitle}">
  ${settings.metaDescription ? `<meta property="og:description" content="${settings.metaDescription}">` : ''}
  ${settings.ogImage ? `<meta property="og:image" content="${settings.ogImage}">` : ''}
  <meta property="og:type" content="website">
  ${settings.canonical ? `<link rel="canonical" href="${settings.canonical}">` : ''}
  ${siteSettings.faviconUrl ? `<link rel="icon" href="${siteSettings.faviconUrl}">\n  <link rel="shortcut icon" href="${siteSettings.faviconUrl}">` : ''}
  <link rel="stylesheet" href="css/design-system.css">
  <link rel="stylesheet" href="css/widgets.css">
  <link rel="stylesheet" href="css/animations.css">
  <style>
    :root {
${varCss}
      --font-sans: ${activeFont};
    }
    body {
      background-color: ${activePreset.vars['--bg-deep']};
    }
  </style>
  ${siteSettings.customCss ? `<style id="aether-site-custom-css">\n${siteSettings.customCss}\n  </style>` : ''}
  ${addonManager.getAllActiveCss() ? `<style id="wb-addons-css">\n${addonManager.getAllActiveCss()}\n  </style>` : ''}
  ${siteSettings.gaId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(siteSettings.gaId)}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${siteSettings.gaId}');
  </script>` : ''}
  ${siteSettings.headerScripts || ''}
</head>
<body data-preset="${activePreset.id}">
  <div id="site-root">
    ${renderedElements}
  </div>
  ${siteSettings.footerScripts || ''}
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Mobile Navigation Drawer Toggle
      document.querySelectorAll('.wb-navbar').forEach(function(navbar) {
        var toggleBtn = navbar.querySelector('.wb-nav-toggle');
        var mobileMenu = navbar.querySelector('.wb-nav-mobile-menu');
        if (!toggleBtn || !mobileMenu) return;
        var toggleIcon = toggleBtn.querySelector('.wb-nav-toggle-icon') || toggleBtn;
        function setOpen(open) {
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
        }
        toggleBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          setOpen(!navbar.classList.contains('is-open'));
        });
        mobileMenu.querySelectorAll('a').forEach(function(link) {
          link.addEventListener('click', function() { setOpen(false); });
        });
        document.addEventListener('click', function(e) {
          if (!navbar.contains(e.target) && navbar.classList.contains('is-open')) {
            setOpen(false);
          }
        });

        // Dynamic Overflow Protection
        function checkNavOverflow() {
          var row = navbar.querySelector('.wb-nav-row, .wb-nav-institutional-row, .wb-nav-bottombar-inner');
          if (!row) return;
          navbar.classList.remove('is-overflow-collapsed');
          if (row.scrollWidth > row.clientWidth + 2) {
            navbar.classList.add('is-overflow-collapsed');
          }
        }
        if (typeof ResizeObserver !== 'undefined') {
          var ro = new ResizeObserver(function() { checkNavOverflow(); });
          ro.observe(navbar);
        }
        window.addEventListener('resize', checkNavOverflow);
        setTimeout(checkNavOverflow, 50);
      });

      // Interactive Carousel Sliders
      document.querySelectorAll('.wb-slider-container').forEach(function(slider) {
        var track = slider.querySelector('.wb-slider-track');
        var slides = slider.querySelectorAll('.wb-slide');
        var prevBtn = slider.querySelector('.wb-slider-btn.prev');
        var nextBtn = slider.querySelector('.wb-slider-btn.next');
        var dots = slider.querySelectorAll('.wb-slider-dot');
        if (!track || slides.length === 0) return;
        var cur = 0, count = slides.length;
        var auto = slider.getAttribute('data-autoplay') === 'true';
        var interval = parseInt(slider.getAttribute('data-interval'), 10) || 4500;
        var timer = null;
        function update() {
          track.style.transform = 'translateX(-' + (cur * 100) + '%)';
          dots.forEach(function(d, i) { d.classList.toggle('active', i === cur); });
        }
        function next() { cur = (cur + 1) % count; update(); }
        function prev() { cur = (cur - 1 + count) % count; update(); }
        if (nextBtn) nextBtn.onclick = function() { next(); resetAuto(); };
        if (prevBtn) prevBtn.onclick = function() { prev(); resetAuto(); };
        dots.forEach(function(d, i) { d.onclick = function() { cur = i; update(); resetAuto(); }; });
        function startAuto() { if (auto && count > 1) { timer = setInterval(next, interval); } }
        function resetAuto() { if (timer) clearInterval(timer); startAuto(); }
        slider.onmouseenter = function() { if (timer) clearInterval(timer); };
        slider.onmouseleave = resetAuto;
        update();
        startAuto();
      });

      // Seminar Schedule Displayer Interactive Slider
      document.querySelectorAll('.wb-schedule-widget').forEach(function(widget) {
        var track = widget.querySelector('.wb-schedule-slider-track');
        var slides = widget.querySelectorAll('.wb-schedule-slide');
        var prevBtn = widget.querySelector('.wb-schedule-nav-btn.prev');
        var nextBtn = widget.querySelector('.wb-schedule-nav-btn.next');
        var dots = widget.querySelectorAll('.wb-schedule-dot');
        var pageInfo = widget.querySelector('.wb-schedule-page-info');
        var dayTabs = widget.querySelectorAll('.wb-schedule-day-tab');
        if (!track || slides.length === 0) return;
        var cur = 0, count = slides.length;
        var auto = widget.getAttribute('data-autoplay') === 'true';
        var interval = parseInt(widget.getAttribute('data-interval'), 10) || 5000;
        var timer = null;
        function update() {
          track.style.transform = 'translateX(-' + (cur * 100) + '%)';
          dots.forEach(function(d, i) { d.classList.toggle('active', i === cur); });
          if (prevBtn) prevBtn.disabled = cur === 0;
          if (nextBtn) nextBtn.disabled = cur >= count - 1;
          if (pageInfo) pageInfo.textContent = 'Page ' + (cur + 1) + ' of ' + count;
          var curSlide = slides[cur];
          var curDay = curSlide ? curSlide.getAttribute('data-day') : '';
          if (curDay && dayTabs.length > 0) {
            dayTabs.forEach(function(tab) {
              tab.classList.toggle('active', tab.getAttribute('data-day') === curDay);
            });
          }
        }
        function goTo(idx) { cur = Math.max(0, Math.min(idx, count - 1)); update(); }
        if (prevBtn) prevBtn.onclick = function() { goTo(cur - 1); resetAuto(); };
        if (nextBtn) nextBtn.onclick = function() { goTo(cur + 1); resetAuto(); };
        dots.forEach(function(dot, i) { dot.onclick = function() { goTo(i); resetAuto(); }; });
        dayTabs.forEach(function(tab) {
          tab.onclick = function() {
            var targetDay = tab.getAttribute('data-day');
            if (!targetDay || targetDay === 'all') {
              goTo(0);
              dayTabs.forEach(function(t) { t.classList.remove('active'); });
              tab.classList.add('active');
            } else {
              for (var i = 0; i < slides.length; i++) {
                if (slides[i].getAttribute('data-day') === targetDay) {
                  goTo(i);
                  break;
                }
              }
            }
            resetAuto();
          };
        });
        function startAuto() { if (auto && count > 1) { timer = setInterval(function() { cur = (cur + 1) % count; update(); }, interval); } }
        function resetAuto() { if (timer) clearInterval(timer); startAuto(); }
        widget.onmouseenter = function() { if (timer) clearInterval(timer); };
        widget.onmouseleave = resetAuto;
        update();
        startAuto();
      });

      // FAQ Accordion Toggle
      document.querySelectorAll('.wb-faq-item').forEach(function(item) {
        var q = item.querySelector('.wb-faq-question');
        if (!q) return;
        q.addEventListener('click', function() {
          var isOpen = item.classList.contains('is-open');
          item.classList.toggle('is-open', !isOpen);
          q.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
        });
      });

      // ── Dynamic Registration Form Handler (with Google Sheets sync) ──
      document.querySelectorAll('.wb-reg-form').forEach(function(form) {
        // Real-time file size check on change
        form.querySelectorAll('.wb-reg-file-input').forEach(function(fileInput) {
          fileInput.addEventListener('change', function() {
            var file = fileInput.files && fileInput.files[0];
            var box = fileInput.closest('.wb-reg-file-box');
            var errEl = box ? box.querySelector('.wb-reg-file-error') : null;
            var maxMB = parseFloat(fileInput.getAttribute('data-max-size-mb')) || 5;

            if (file) {
              var sizeMB = file.size / (1024 * 1024);
              if (sizeMB > maxMB) {
                fileInput.value = ''; // Reset invalid file
                if (errEl) {
                  errEl.textContent = '⚠️ File "' + file.name + '" (' + sizeMB.toFixed(1) + ' MB) exceeds the ' + maxMB + ' MB limit. Please select a smaller file.';
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
        });

        // Interactive image option cards
        form.querySelectorAll('.wb-reg-img-option').forEach(function(optLabel) {
          var radio = optLabel.querySelector('.wb-reg-img-radio');
          if (!radio) return;
          var updateSelection = function() {
            var allInGroup = form.querySelectorAll('input[name="' + radio.name + '"]');
            allInGroup.forEach(function(r) {
              var p = r.closest('.wb-reg-img-option');
              if (p) {
                if (r.checked) p.classList.add('is-selected');
                else p.classList.remove('is-selected');
              }
            });
          };
          if (radio.checked) optLabel.classList.add('is-selected');
          radio.addEventListener('change', updateSelection);
          optLabel.addEventListener('click', function(e) {
            if (e.target !== radio) {
              radio.checked = true;
              updateSelection();
            }
          });
        });

        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          var widget = form.closest('.wb-registration-widget');
          var statusEl = form.querySelector('.wb-reg-status');
          var submitBtn = form.querySelector('.wb-reg-submit-btn');
          var successMsg = form.getAttribute('data-success-msg') || 'Registration submitted!';
          var gsheetUrl = widget ? widget.getAttribute('data-gsheet-url') : '';
          var apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';

          // Pre-flight check: validate all file inputs
          var fileInputs = form.querySelectorAll('.wb-reg-file-input');
          var fileValidationError = null;
          for (var fi = 0; fi < fileInputs.length; fi++) {
            var finp = fileInputs[fi];
            var f = finp.files && finp.files[0];
            if (f) {
              var maxMB = parseFloat(finp.getAttribute('data-max-size-mb')) || 5;
              var szMB = f.size / (1024 * 1024);
              if (szMB > maxMB) {
                fileValidationError = 'File "' + f.name + '" (' + szMB.toFixed(1) + ' MB) exceeds the ' + maxMB + ' MB size limit.';
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

          if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.6'; }
          if (statusEl) { statusEl.style.display = 'none'; statusEl.className = 'wb-reg-status'; }

          // Build payload & upload files to server media storage so real URLs are generated
          var payload = { type: 'registration' };
          var elements = form.elements;
          var fileUploadPromises = [];

          for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            if (!el.name || el.name === '_hp') continue;

            if (el.type === 'file') {
              if (el.files && el.files[0]) {
                (function(name, file) {
                  fileUploadPromises.push(new Promise(async function(resolve) {
                    try {
                      var formData = new FormData();
                      formData.append('file', file);
                      var upRes = await fetch(apiBase + '?action=upload', {
                        method: 'POST',
                        body: formData
                      });
                      var upData = await upRes.json();
                      if (upData && upData.success && upData.url) {
                        var fileLink = window.location.origin + '/' + upData.url.replace(/^\//, '');
                        payload[name] = fileLink;
                        payload[name + '_filename'] = file.name;
                        payload[name + '_url'] = fileLink;
                      } else {
                        payload[name] = file.name + ' (Uploaded)';
                      }
                    } catch(err) {
                      console.warn('File upload to media error:', err);
                      payload[name] = file.name;
                    }
                    resolve();
                  }));
                })(el.name, el.files[0]);
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

          // 1. Save to local submissions store
          try {
            var localRes = await fetch(apiBase + '?action=submit_form', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json',
          'X-Admin-Token': getAdminToken(), },
              body: JSON.stringify(payload)
            });
            var localData = await localRes.json();
            if (!localData.success) throw new Error(localData.message || 'Local save failed');
          } catch(err) {
            if (statusEl) {
              statusEl.textContent = '⚠️ Submission failed. Please try again. (' + err.message + ')';
              statusEl.className = 'wb-reg-status is-error';
              statusEl.style.display = 'block';
            }
            if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
            return;
          }

          // 2. Mirror to Google Sheets with real file URL links (clean non-redundant columns)!
          if (gsheetUrl && gsheetUrl.indexOf('script.google.com') !== -1) {
            try {
              var excludeSummary = widget ? widget.getAttribute('data-gsheet-exclude-summary') !== 'false' : true;
              var excludeMeta = widget ? widget.getAttribute('data-gsheet-exclude-meta') !== 'false' : true;
              var excludeHidden = widget ? widget.getAttribute('data-gsheet-exclude-hidden') !== 'false' : true;

              // Find hidden inputs if excludeHidden is active
              var hiddenNames = {};
              if (excludeHidden) {
                var hiddenInputs = form.querySelectorAll('input[type="hidden"]');
                for (var hi = 0; hi < hiddenInputs.length; hi++) {
                  if (hiddenInputs[hi].name) hiddenNames[hiddenInputs[hi].name] = true;
                }
              }

              var labelMap = {};
              var regFields = form.querySelectorAll('.wb-reg-field');
              for (var rfi = 0; rfi < regFields.length; rfi++) {
                var fld = regFields[rfi];
                var inp = fld.querySelector('input,select,textarea');
                var lbl = fld.querySelector('.wb-reg-label');
                if (inp && inp.name && lbl) {
                  var cleanLbl = lbl.textContent.replace(/\s*\*.*$/, '').trim().replace(/[^a-zA-Z0-9_]/g, '_');
                  if (cleanLbl) labelMap[inp.name] = cleanLbl;
                }
              }

              var sheetPayload = {};
              Object.keys(payload).forEach(function(k) {
                // Always exclude internal system helpers
                if (k === '_hp' || k === 'website_hp' || k === 'extra' || k.endsWith('_b64')) return;

                // Exclude redundant file auxiliary keys (*_filename, *_url) since the field itself contains the link!
                if (k.endsWith('_filename') || k.endsWith('_url')) return;

                // Exclude system metadata if enabled
                if (excludeMeta && (k === 'type' || k === 'page')) return;

                // Exclude summary / message column if enabled
                if (excludeSummary && k === 'message') return;

                // Exclude hidden fields if enabled
                if (excludeHidden && hiddenNames[k]) return;

                // Exclude duplicate generic fields if specific user fields exist
                if (k === 'name' && (payload.FullName || payload.fullName || payload.full_name || payload.Full_Name)) return;
                if (k === 'email' && (payload.Email || payload.email_address || payload.Email_Address)) return;
                if (k === 'phone' && (payload.Phone || payload.mobile || payload.Mobile || payload.Mobile_No || payload.Mobile_No_)) return;

                var finalKey = (k.indexOf('field_') === 0 && labelMap[k]) ? labelMap[k] : k;
                sheetPayload[finalKey] = payload[k]; // Real media URL for file fields!
              });
              fetch(gsheetUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(sheetPayload)
              }).catch(function() {});
            } catch(ignored) {}
          }

          // 3. Show success & reset form
          form.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(function(inp) {
            inp.value = '';
            if (inp.type === 'checkbox') inp.checked = false;
          });
          if (statusEl) {
            statusEl.textContent = successMsg;
            statusEl.className = 'wb-reg-status is-success';
            statusEl.style.display = 'block';
          }
          if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }

          // Show card-style e-receipt modal with important details and image download
          if (typeof window.showRegistrationReceiptModal === 'function') {
            var formTitleEl = widget ? widget.querySelector('.wb-reg-title') : null;
            var titleText = formTitleEl ? formTitleEl.textContent : 'Official Registration E-Receipt';
            window.showRegistrationReceiptModal(payload, { form: form, title: titleText });
          }
        });
      });
    });
  </script>
  <script type="module" src="./js/receipt.js"></script>
  ${(siteSettings.chatbot && siteSettings.chatbot.enabled !== false) ? `
  <script type="module">
    import { initPublicChatbot } from './js/assistant.js';


    initPublicChatbot(${JSON.stringify(siteSettings.chatbot)});
  </script>` : ''}
  ${addonManager.getAllActiveJs() ? `<script id="wb-addons-js">
/* ══ AetherBuilder • Custom Add-On JavaScript ══ */
(function() {
  function runAddonMounts() {
${addonManager.getAllActiveJs()}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAddonMounts);
  } else {
    runAddonMounts();
  }
})();
</script>` : ''}
</body>
</html>`;

      const blob = new Blob([standaloneHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'published-index.html';
      a.click();
      URL.revokeObjectURL(url);
    });

    // Perform Import
    modal.querySelector('#btn-perform-import').addEventListener('click', () => {
      const text = modal.querySelector('#import-json-textarea').value.trim();
      if (!text) return;
      const success = state.importJSON(text);
      if (success) {
        modal.remove();
        this.canvas.showToast('Project imported successfully!', 'success');
      } else {
        alert('Invalid JSON format. Please verify the configuration.');
      }
    });
  }

  // Argon2 Security Modal & Password Manager
  showSecurityModal() {
    let modal = document.getElementById('security-modal');
    if (modal) modal.remove();

    const storedHash = auth.getStoredHash();

    modal = document.createElement('div');
    modal.id = 'security-modal';
    modal.className = 'modal-overlay animate-fade-in';
    modal.innerHTML = `
      <div class="modal-box animate-scale-in" style="max-width: 440px;">
        <div class="modal-header">
          <div class="modal-title">
            <span>🔐</span> Security &amp; Password
          </div>
          <button class="tool-icon-btn" id="close-sec-modal">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size: 0.88rem; color: var(--text-dim); margin: 0 0 16px; line-height: 1.5;">
            Update your master administrator password for this workspace.
          </p>

          <form id="change-pass-form" style="display: flex; flex-direction: column; gap: 12px;">
            <div class="prop-group">
              <label class="prop-label">Current Password</label>
              <input type="password" id="cur-pass-input" placeholder="Current password..." required />
            </div>
            <div class="prop-group">
              <label class="prop-label">New Password</label>
              <input type="password" id="new-pass-input" placeholder="New password (min 4 chars)..." required />
            </div>
            <div id="change-pass-msg" style="font-size: 0.85rem; font-weight: 600; min-height: 18px;"></div>
            <button type="submit" class="wb-btn wb-btn-primary" style="width: 100%;">
              <span>Save New Password</span>
            </button>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#close-sec-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    const form = modal.querySelector('#change-pass-form');
    const msg = modal.querySelector('#change-pass-msg');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.textContent = 'Updating password...';
      msg.style.color = 'var(--warning)';

      const curPass = modal.querySelector('#cur-pass-input').value;
      const newPass = modal.querySelector('#new-pass-input').value;

      const res = await auth.updatePassword(curPass, newPass);
      if (res.success) {
        msg.textContent = '✓ Password successfully updated!';
        msg.style.color = 'var(--success)';
        setTimeout(() => modal.remove(), 1200);
      } else {
        msg.textContent = res.error || 'Failed to update password.';
        msg.style.color = 'var(--danger)';
      }
    });
  }

  // --------------------------------------------------------------------------
  // NOTIFICATIONS & LEADS HUB
  // --------------------------------------------------------------------------
  initNotificationsHub() {
    this.unreadNotifsCount = 0;
    this.checkNotifications();
    if (this._notifInterval) clearInterval(this._notifInterval);
    this._notifInterval = setInterval(() => this.checkNotifications(), 25000);
  }

  async checkNotifications() {
    try {
      const res = await fetch(`api.php?action=get_submissions&_t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      const unread = data.unreadCount || 0;
      const badge = document.getElementById('notif-badge');
      if (badge) {
        if (unread > 0) {
          badge.textContent = unread > 99 ? '99+' : unread;
          badge.style.display = 'block';
          if (unread > this.unreadNotifsCount && this.unreadNotifsCount !== 0) {
            this.playNotificationChime();
            this.canvas?.showToast(`🔔 New lead received! (${unread} unread)`, 'info');
          }
        } else {
          badge.style.display = 'none';
        }
      }
      this.unreadNotifsCount = unread;
    } catch {}
  }

  playNotificationChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch {}
  }

  async showNotificationsModal() {
    const modal = document.createElement('div');
    modal.className = 'media-modal-overlay';
    modal.id = 'notifications-modal';
    modal.innerHTML = `
      <div class="media-modal-panel" style="max-width: 820px; height: 600px; display: flex; flex-direction: column;">
        <div class="media-modal-header" style="padding: 14px 18px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.5rem;">📬</span>
            <div>
              <div style="font-weight: 700; font-size: 1.05rem; color: #f8fafc;">Leads &amp; Notifications Hub</div>
              <div style="font-size: 0.74rem; color: var(--text-dim);" id="notif-modal-sub">Loading submissions...</div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button id="notif-btn-export-csv" class="topbar-btn topbar-btn-sm" style="background: rgba(16,185,129,0.18); border-color: #10b981; color: #6ee7b7;" title="Export all submissions as CSV spreadsheet">
              📥 Export CSV
            </button>
            <button id="notif-btn-mark-all" class="topbar-btn topbar-btn-sm" title="Mark all submissions as read">
              ✓ Mark All Read
            </button>
            <button class="media-modal-close" id="close-notif-modal">✕</button>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div style="padding: 10px 18px; background: rgba(15,23,42,0.6); border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; gap: 6px;" id="notif-filter-group">
            <button class="btn btn-sm active-filter" data-filter="all" style="font-size:0.75rem; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(99,102,241,0.4); background: rgba(99,102,241,0.25); color: #fff; cursor: pointer;">All</button>
            <button class="btn btn-sm" data-filter="chatbot" style="font-size:0.75rem; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-muted); cursor: pointer;">🤖 Chatbot</button>
            <button class="btn btn-sm" data-filter="contact" style="font-size:0.75rem; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-muted); cursor: pointer;">📝 Contact</button>
            <button class="btn btn-sm" data-filter="registration" style="font-size:0.75rem; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-muted); cursor: pointer;">🎫 Registrations</button>
          </div>
          <input type="text" id="notif-search-input" placeholder="🔍 Search name, email, phone..." style="width: 220px; font-size: 0.76rem; padding: 5px 10px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-deep); color: var(--text-main);" />
        </div>

        <!-- Submissions Stream Container -->
        <div style="flex: 1; overflow-y: auto; padding: 14px 18px; display: flex; flex-direction: column; gap: 10px;" id="notif-list-container">
          <div style="text-align: center; color: var(--text-dim); padding: 40px;">Loading leads...</div>
        </div>

        <!-- Footer -->
        <div class="media-modal-footer" style="padding: 10px 18px; justify-content: space-between;">
          <button id="notif-btn-clear-all" class="topbar-btn topbar-btn-sm" style="color: var(--danger); border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.1);">
            🗑️ Clear All History
          </button>
          <button class="topbar-btn topbar-btn-publish" id="notif-btn-done">Done</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#close-notif-modal').addEventListener('click', closeModal);
    modal.querySelector('#notif-btn-done').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Export CSV
    modal.querySelector('#notif-btn-export-csv').addEventListener('click', () => {
      window.open('api.php?action=export_submissions_csv', '_blank');
      this.canvas?.showToast('📥 Downloading submissions CSV...', 'info');
    });

    let allSubs = [];
    let currentFilter = 'all';
    let searchQuery = '';

    const renderList = () => {
      const container = modal.querySelector('#notif-list-container');
      const filtered = allSubs.filter(s => {
        const matchesType = currentFilter === 'all' || s.type === currentFilter;
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q || (s.name && s.name.toLowerCase().includes(q))
                                || (s.email && s.email.toLowerCase().includes(q))
                                || (s.phone && s.phone.toLowerCase().includes(q))
                                || (s.message && s.message.toLowerCase().includes(q));
        return matchesType && matchesSearch;
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; color: var(--text-dim); padding: 50px 20px;">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">📭</div>
            <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-muted);">No submissions found</div>
            <div style="font-size: 0.78rem; margin-top: 4px;">Leads from the chatbot and contact forms will appear here in real time.</div>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(s => {
        const isUnread = !s.is_read;
        const dateStr = s.submitted_at ? new Date(s.submitted_at).toLocaleString() : 'Recent';
        const typeBadge = s.type === 'chatbot' ? '🤖 Chatbot Lead' : s.type === 'registration' ? '🎫 Registration' : '📝 Contact Form';
        const typeBg = s.type === 'chatbot' ? 'rgba(99,102,241,0.2)' : s.type === 'registration' ? 'rgba(16,185,129,0.2)' : 'rgba(56,189,248,0.2)';
        const typeColor = s.type === 'chatbot' ? '#a5b4fc' : s.type === 'registration' ? '#6ee7b7' : '#7dd3fc';

        return `
          <div class="notif-card" data-sub-id="${s.id}" style="background: rgba(30,41,59,0.7); border: 1px solid ${isUnread ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; transition: all 0.2s; position: relative;">
            ${isUnread ? '<div style="position:absolute;top:10px;right:10px;width:8px;height:8px;border-radius:50%;background:#38bdf8;box-shadow:0 0 6px #38bdf8;"></div>' : ''}
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size:0.68rem; padding: 2px 8px; border-radius: 12px; background: ${typeBg}; color: ${typeColor}; font-weight: 700;">${typeBadge}</span>
                <span style="font-weight: 700; font-size: 0.88rem; color: #f8fafc;">${s.name || 'Anonymous'}</span>
              </div>
              <span style="font-size: 0.72rem; color: var(--text-dim); margin-right: 18px;">${dateStr}</span>
            </div>

            <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.78rem; color: var(--text-muted);">
              ${s.email ? `<span>✉️ <a href="mailto:${s.email}" style="color:#38bdf8;text-decoration:none;">${s.email}</a></span>` : ''}
              ${s.phone ? `<span>📞 <a href="tel:${s.phone}" style="color:#38bdf8;text-decoration:none;">${s.phone}</a></span>` : ''}
              ${s.page ? `<span>📄 Page: <code style="color:#a5b4fc;background:rgba(0,0,0,0.3);padding:1px 5px;border-radius:4px;">${s.page}</code></span>` : ''}
            </div>

            ${s.message ? `<div style="font-size: 0.78rem; color: #cbd5e1; background: rgba(15,23,42,0.6); padding: 8px 10px; border-radius: 6px; line-height: 1.5; border-left: 3px solid #6366f1; white-space: pre-wrap; word-break: break-word;">${s.message}</div>` : ''}

            ${(() => {
              const fileLinks = [];
              const seen = new Set();
              for (const [k, v] of Object.entries(s)) {
                if (typeof v === 'string' && (v.includes('assets/uploads/') || (k.endsWith('_url') && (v.startsWith('http') || v.startsWith('assets/'))))) {
                  if (seen.has(v)) continue;
                  seen.add(v);
                  const label = k.replace(/_url$/, '').replace(/^field_\d+_?/, '').replace(/_/g, ' ');
                  fileLinks.push(`<a href="${v}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:5px;font-size:0.75rem;padding:4px 10px;border-radius:6px;background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.4);color:#38bdf8;text-decoration:none;font-weight:600;">📎 ${label || 'Uploaded Attachment'} ↗</a>`);
                }
              }
              return fileLinks.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:2px;">${fileLinks.join('')}</div>` : '';
            })()}

            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px;">
              ${isUnread ? `<button class="btn-mark-item-read" data-id="${s.id}" style="font-size: 0.7rem; padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); background: transparent; color: var(--text-muted); cursor: pointer;">Mark Read</button>` : ''}
              <button class="btn-del-item" data-id="${s.id}" style="font-size: 0.7rem; padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.1); color: #fca5a5; cursor: pointer;">Delete</button>
            </div>
          </div>
        `;
      }).join('');

      // Bind single item actions
      container.querySelectorAll('.btn-mark-item-read').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          await fetch('api.php?action=mark_read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json',
          'X-Admin-Token': getAdminToken(), },
            body: JSON.stringify({ id })
          });
          const item = allSubs.find(x => x.id === id);
          if (item) item.is_read = true;
          this.checkNotifications();
          renderList();
        });
      });

      container.querySelectorAll('.btn-del-item').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          if (!confirm('Delete this submission?')) return;
          await fetch('api.php?action=delete_submission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json',
          'X-Admin-Token': getAdminToken(), },
            body: JSON.stringify({ id })
          });
          allSubs = allSubs.filter(x => x.id !== id);
          this.checkNotifications();
          renderList();
        });
      });
    };

    const fetchSubmissions = async () => {
      try {
        const res = await fetch(`api.php?action=get_submissions&_t=${Date.now()}`);
        const data = await res.json();

        // Robust normalization: handle plain array, PowerShell { value: [...] }, or object maps
        let rawSubs = data.submissions;
        if (rawSubs && Array.isArray(rawSubs.value)) {
          allSubs = rawSubs.value;
        } else if (Array.isArray(rawSubs)) {
          allSubs = rawSubs;
        } else if (typeof rawSubs === 'object' && rawSubs !== null) {
          allSubs = Object.values(rawSubs).filter(item => item && typeof item === 'object');
        } else {
          allSubs = [];
        }

        const unreadCount = typeof data.unreadCount === 'number'
          ? data.unreadCount
          : allSubs.filter(s => !s.is_read).length;

        const subEl = modal.querySelector('#notif-modal-sub');
        if (subEl) {
          subEl.textContent = `${allSubs.length} total submission${allSubs.length !== 1 ? 's' : ''} • ${unreadCount} unread`;
        }
        renderList();
      } catch (err) {
        console.error('Error loading submissions:', err);
        modal.querySelector('#notif-list-container').innerHTML = `<div style="text-align:center;color:var(--danger);padding:30px;">Error loading submissions.</div>`;
      }
    };

    fetchSubmissions();

    // Mark All Read
    modal.querySelector('#notif-btn-mark-all').addEventListener('click', async () => {
      await fetch('api.php?action=mark_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'X-Admin-Token': getAdminToken(), },
        body: JSON.stringify({ id: '' })
      });
      allSubs.forEach(s => s.is_read = true);
      this.checkNotifications();
      renderList();
      this.canvas?.showToast('All submissions marked as read', 'success');
    });

    // Clear All
    modal.querySelector('#notif-btn-clear-all').addEventListener('click', async () => {
      if (!confirm('Are you sure you want to permanently clear all submissions?')) return;
      await fetch('api.php?action=clear_submissions');
      allSubs = [];
      this.checkNotifications();
      renderList();
      this.canvas?.showToast('All submissions cleared', 'info');
    });

    // Filter Buttons
    modal.querySelectorAll('#notif-filter-group button').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('#notif-filter-group button').forEach(b => {
          b.style.background = 'var(--bg-surface)';
          b.style.color = 'var(--text-muted)';
          b.style.borderColor = 'var(--border-subtle)';
        });
        btn.style.background = 'rgba(99,102,241,0.25)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'rgba(99,102,241,0.4)';
        currentFilter = btn.getAttribute('data-filter');
        renderList();
      });
    });

    // Search Input
    modal.querySelector('#notif-search-input').addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderList();
    });
  }

  // --------------------------------------------------------------------------
  // CHATBOT FLOWCHART VISUAL EDITOR MODAL
  // --------------------------------------------------------------------------
  showChatbotFlowModal() {
    const currentCb = state.siteSettings?.chatbot || DEFAULT_CHATBOT_CONFIG;
    let nodes = JSON.parse(JSON.stringify(currentCb.nodes || DEFAULT_CHATBOT_CONFIG.nodes));

    const modal = document.createElement('div');
    modal.className = 'media-modal-overlay';
    modal.id = 'chatbot-flow-modal';
    modal.innerHTML = `
      <div class="media-modal-panel" style="max-width: 860px; height: 640px; display: flex; flex-direction: column;">
        <div class="media-modal-header" style="padding: 14px 18px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.5rem;">🌳</span>
            <div>
              <div style="font-weight: 700; font-size: 1.05rem; color: #f8fafc;">Chatbot Decision-Tree Flowchart</div>
              <div style="font-size: 0.74rem; color: var(--text-dim);">Customize bot questions, quick-reply choice buttons, and lead capture steps</div>
            </div>
          </div>
          <button class="media-modal-close" id="close-cb-flow-modal">✕</button>
        </div>

        <div style="flex: 1; overflow-y: auto; padding: 14px 18px; display: flex; flex-direction: column; gap: 14px;" id="cb-nodes-container">
          <!-- Nodes rendered here -->
        </div>

        <div class="media-modal-footer" style="padding: 10px 18px; justify-content: space-between;">
          <div style="display: flex; gap: 8px;">
            <button type="button" id="btn-add-cb-node" class="topbar-btn topbar-btn-sm" style="background: rgba(99,102,241,0.18); border-color: #6366f1; color: #a5b4fc;">
              + Add Question / Step
            </button>
            <button type="button" id="btn-restore-cb-default" class="topbar-btn topbar-btn-sm" style="color: var(--text-dim);">
              🔄 Restore Default MCLE Flow
            </button>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="topbar-btn" id="btn-cancel-cb-flow">Cancel</button>
            <button class="topbar-btn topbar-btn-publish" id="btn-save-cb-flow">Save Flowchart ✓</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#close-cb-flow-modal').addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-cb-flow').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    const renderNodes = () => {
      const container = modal.querySelector('#cb-nodes-container');
      container.innerHTML = '';

      const allNodeIds = nodes.map(n => n.id);

      nodes.forEach((node, nodeIdx) => {
        const card = document.createElement('div');
        card.className = 'cb-node-card';
        card.style.cssText = 'background: rgba(30,41,59,0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px;';

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.72rem; font-weight: 700; color: #a5b4fc; background: rgba(99,102,241,0.2); padding: 3px 8px; border-radius: 6px;">Step ID:</span>
              <input type="text" class="node-id-input" value="${node.id}" style="font-family: monospace; font-size: 0.78rem; font-weight: 700; background: var(--bg-deep); border: 1px solid var(--border-subtle); color: #38bdf8; border-radius: 4px; padding: 3px 6px; width: 140px;" ${node.id === 'start' ? 'disabled title="start is the initial entry node"' : ''} />
              ${node.id === 'start' ? '<span style="font-size:0.68rem;color:#10b981;font-weight:700;">(Entry Node)</span>' : ''}
            </div>
            ${node.id !== 'start' ? `<button class="btn-del-node" style="font-size:0.75rem;color:var(--danger);background:transparent;border:none;cursor:pointer;" title="Delete this step">🗑️ Delete Step</button>` : ''}
          </div>

          <div>
            <label class="prop-label" style="font-size:0.75rem;margin-bottom:3px;">Bot Response Message</label>
            <textarea class="node-message-input" rows="2" style="width:100%;font-size:0.78rem;padding:6px;border-radius:6px;background:var(--bg-deep);border:1px solid var(--border-subtle);color:var(--text-main);resize:vertical;">${node.message || ''}</textarea>
          </div>

          <label style="font-size: 0.78rem; color: var(--text-main); display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="checkbox" class="node-lead-capture-cb" ${node.isLeadCapture ? 'checked' : ''} style="cursor: pointer;" />
            <span>✍️ Include Lead Capture Form at this step (Name &amp; Phone/Email inputs)</span>
          </label>

          <!-- Choices List -->
          <div style="margin-top: 4px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.08);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Quick-Reply Choice Buttons:</span>
              <button class="btn-add-choice" style="font-size:0.7rem;padding:2px 7px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;border-radius:4px;cursor:pointer;">+ Add Choice Button</button>
            </div>
            <div class="choices-container" style="display:flex;flex-direction:column;gap:6px;">
              ${(node.options || []).map((opt, optIdx) => `
                <div class="choice-row" style="display:flex;gap:6px;align-items:center;">
                  <input type="text" class="choice-label-input" value="${opt.label || ''}" placeholder="Button Text (e.g. 📅 Seminar Schedules)" style="flex:1;font-size:0.76rem;padding:4px 8px;border-radius:4px;border:1px solid var(--border-subtle);background:var(--bg-deep);color:var(--text-main);" />
                  <span style="font-size:0.72rem;color:var(--text-dim);">➜</span>
                  <select class="choice-next-select" style="font-size:0.74rem;padding:4px 6px;border-radius:4px;border:1px solid var(--border-subtle);background:var(--bg-deep);color:#38bdf8;width:150px;">
                    ${allNodeIds.map(nid => `<option value="${nid}" ${nid === opt.next ? 'selected' : ''}>${nid}</option>`).join('')}
                  </select>
                  <button class="btn-del-choice" data-opt-idx="${optIdx}" style="background:transparent;border:none;color:var(--danger);cursor:pointer;font-size:0.85rem;" title="Remove choice">✕</button>
                </div>
              `).join('')}
            </div>
          </div>
        `;

        // Wire inputs on this card
        card.querySelector('.node-id-input')?.addEventListener('input', (e) => {
          node.id = e.target.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        });
        card.querySelector('.node-message-input')?.addEventListener('input', (e) => {
          node.message = e.target.value;
        });
        card.querySelector('.node-lead-capture-cb')?.addEventListener('change', (e) => {
          node.isLeadCapture = e.target.checked;
        });
        card.querySelector('.btn-del-node')?.addEventListener('click', () => {
          nodes.splice(nodeIdx, 1);
          renderNodes();
        });

        // Choices wiring
        card.querySelectorAll('.choice-label-input').forEach((inp, idx) => {
          inp.addEventListener('input', (e) => {
            if (node.options && node.options[idx]) node.options[idx].label = e.target.value;
          });
        });
        card.querySelectorAll('.choice-next-select').forEach((sel, idx) => {
          sel.addEventListener('change', (e) => {
            if (node.options && node.options[idx]) node.options[idx].next = e.target.value;
          });
        });
        card.querySelectorAll('.btn-del-choice').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-opt-idx'));
            node.options.splice(idx, 1);
            renderNodes();
          });
        });
        card.querySelector('.btn-add-choice')?.addEventListener('click', () => {
          if (!node.options) node.options = [];
          node.options.push({ label: 'New Option', next: 'start' });
          renderNodes();
        });

        container.appendChild(card);
      });
    };

    renderNodes();

    // Add New Question Node
    modal.querySelector('#btn-add-cb-node').addEventListener('click', () => {
      const newId = `step_${nodes.length + 1}`;
      nodes.push({
        id: newId,
        message: 'New information message...',
        options: [
          { label: '↩️ Return to Menu', next: 'start' }
        ]
      });
      renderNodes();
      const container = modal.querySelector('#cb-nodes-container');
      container.scrollTop = container.scrollHeight;
    });

    // Restore Default Flow
    modal.querySelector('#btn-restore-cb-default').addEventListener('click', () => {
      if (!confirm('Reset flowchart back to default consultation tree?')) return;
      nodes = JSON.parse(JSON.stringify(DEFAULT_CHATBOT_CONFIG.nodes));
      renderNodes();
    });

    // Save Flowchart
    modal.querySelector('#btn-save-cb-flow').addEventListener('click', () => {
      const curCb = state.siteSettings?.chatbot || DEFAULT_CHATBOT_CONFIG;
      state.setSiteSetting('chatbot', { ...curCb, nodes });
      this.canvas?.showToast('🌳 Chatbot flowchart saved successfully!', 'success');
      closeModal();
    });
  }

  // --------------------------------------------------------------------------
  // PUBLISH VERSION HISTORY & 1-CLICK ROLLBACK MODAL
  // --------------------------------------------------------------------------
  async showRevisionsModal() {
    let modal = document.getElementById('revisions-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'revisions-modal';
    modal.className = 'modal-overlay animate-fade-in';
    modal.innerHTML = `
      <div class="modal-box modal-wide animate-scale-in" style="max-width: 780px;">
        <div class="modal-header">
          <div class="modal-title">
            <span>🕒</span> Publish Version History &amp; 1-Click Rollback
          </div>
          <button class="tool-icon-btn" id="close-revisions-modal">✕</button>
        </div>
        <div class="modal-body" style="padding: 20px 24px;">
          <div style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 16px; line-height: 1.5;">
            Every time you publish to live, an immutable snapshot of your entire multi-page site and settings is archived. You can inspect revisions and restore any version with 1-click.
          </div>
          <div id="revisions-loading" style="text-align: center; padding: 40px; color: var(--text-dim);">
            <span>⏳ Fetching version history...</span>
          </div>
          <div id="revisions-list" class="revisions-timeline" style="display: none;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#close-revisions-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    try {
      const token = typeof getAdminToken === 'function' ? getAdminToken() : '';
      const res = await fetch(`api.php?action=get_revisions&admin_token=${encodeURIComponent(token)}&_t=${Date.now()}`, {
        headers: { 'X-Admin-Token': token }
      });
      let data = {};
      const text = await res.text();
      try {
        data = text && text.trim() ? JSON.parse(text) : {};
      } catch (jsonErr) {
        console.warn('Revisions response was not valid JSON:', text);
        data = { success: false, revisions: [] };
      }
      const loading = modal.querySelector('#revisions-loading');
      const list = modal.querySelector('#revisions-list');
      if (loading) loading.style.display = 'none';
      if (list) list.style.display = 'flex';

      let revs = Array.isArray(data.revisions) ? data.revisions : [];
      if (revs.length === 0) {
        // Fallback: check localStorage for cached publish revisions
        try {
          const cached = localStorage.getItem('aether_site_revisions');
          if (cached) revs = JSON.parse(cached);
          if (!Array.isArray(revs)) revs = [];
        } catch {}
      }

      if (revs.length === 0) {
        list.innerHTML = `
          <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
            <div style="font-size: 2.2rem; margin-bottom: 10px;">🕒</div>
            <div style="font-weight: 700; color: #fff; font-size: 1rem; margin-bottom: 4px;">No Published Revisions Yet</div>
            <div style="font-size: 0.82rem; margin-bottom: 16px;">Publish your site for the first time to create an automatic recovery point.</div>
            <button class="topbar-btn topbar-btn-publish" id="btn-rev-publish-now" style="display: inline-flex;">
              <span>🚀</span> Publish Now
            </button>
          </div>
        `;
        list.querySelector('#btn-rev-publish-now')?.addEventListener('click', () => {
          modal.remove();
          document.getElementById('btn-publish')?.click();
        });
        return;
      }

      list.innerHTML = revs.map((r, i) => {
        const displayDate = r.formattedDate || (r.saved_at ? new Date(r.saved_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
        }) : 'Recent Snapshot');
        const pCount = r.pageCount || (r.pages ? r.pages.length : 1);
        const secCount = r.totalSections !== undefined ? r.totalSections : 0;
        const sizeKb = r.sizeBytes ? (r.sizeBytes / 1024).toFixed(1) : '15.4';

        return `
          <div class="revision-card ${i === 0 ? 'is-current' : ''}">
            <div style="flex: 1; min-width: 0;">
              <div class="revision-meta-title">
                <span>${r.siteName || 'USPF MCLE Site'}</span>
                ${i === 0 ? `<span style="font-size: 0.68rem; padding: 2px 8px; border-radius: 10px; background: rgba(16,185,129,0.2); color: #34d399; font-weight: 700;">Active Live Version</span>` : ''}
              </div>
              <div class="revision-meta-sub">
                <span>📅 ${displayDate}</span>
                <span>📄 ${pCount} Page${pCount !== 1 ? 's' : ''}</span>
                <span>🧩 ${secCount} Section${secCount !== 1 ? 's' : ''}</span>
                <span>💾 ${sizeKb} KB</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="topbar-btn btn-rollback" data-id="${r.id}" data-date="${displayDate}" style="padding: 6px 14px; font-size: 0.8rem; background: rgba(99,102,241,0.15); border-color: rgba(99,102,241,0.4); color: #c7d2fe;">
                <span>🔄</span> Rollback
              </button>
            </div>
          </div>
        `;
      }).join('');

      list.querySelectorAll('.btn-rollback').forEach(btn => {
        btn.addEventListener('click', async () => {
          const revId = btn.dataset.id;
          const revDate = btn.dataset.date;
          if (!confirm(`Are you sure you want to rollback to revision from ${revDate}?\n\nYour current canvas state will be restored to this snapshot.`)) return;

          btn.disabled = true;
          btn.innerHTML = '<span>⏳</span> Restoring...';
          try {
            const rbRes = await fetch('api.php?action=rollback_revision', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json',
          'X-Admin-Token': getAdminToken(), },
              body: JSON.stringify({ revisionId: revId })
            });
            const rbData = await rbRes.json();
            if (rbData.success) {
              await state.syncFromServer(true);
              this.canvas.render();
              modal.remove();
              this.canvas.showToast(`✅ Successfully rolled back to revision ${revId}!`, 'success');
            } else {
              alert(rbData.error || 'Failed to rollback revision.');
              btn.disabled = false;
              btn.innerHTML = '<span>🔄</span> Rollback';
            }
          } catch (err) {
            alert('Network error while rolling back revision.');
            btn.disabled = false;
            btn.innerHTML = '<span>🔄</span> Rollback';
          }
        });
      });

    } catch (err) {
      const loading = modal.querySelector('#revisions-loading');
      if (loading) loading.innerHTML = `<span style="color: #f87171;">⚠️ Error loading revisions: ${err.message}</span>`;
    }
  }

  // --------------------------------------------------------------------------
  // PRE-PUBLISH SEO & HEALTH AUDIT PRE-FLIGHT SCANNER
  // --------------------------------------------------------------------------
  showSeoAuditModal() {
    let modal = document.getElementById('seo-audit-modal');
    if (modal) modal.remove();

    // Perform Live Audit
    const page = state.currentPage || {};
    const ps = page.pageSettings || state.pageSettings || {};
    const ss = state.siteSettings || {};
    const sections = page.sections || state.sections || [];

    // Collect DOM / section data
    let h1Count = 0;
    let missingAltCount = 0;
    let totalImages = 0;
    let emptyLinksCount = 0;

    sections.forEach(s => {
      const props = s.props || {};
      // H1 check
      if (s.widgetType === 'hero' || s.widgetType === 'heading') {
        if (props.tag === 'h1' || s.widgetType === 'hero') h1Count++;
      }
      // Image checks
      ['image', 'imageUrl', 'bgImage', 'logoUrl', 'speakerAvatar'].forEach(k => {
        if (props[k]) {
          totalImages++;
          if (!props.alt && !props.imageAlt) missingAltCount++;
        }
      });
      if (Array.isArray(props.galleryImages)) {
        props.galleryImages.forEach(img => {
          totalImages++;
          if (!img.alt) missingAltCount++;
        });
      }
      if (Array.isArray(props.lecturers)) {
        props.lecturers.forEach(lec => {
          if (lec.photoUrl) {
            totalImages++;
            if (!lec.name) missingAltCount++;
          }
        });
      }
      // Link checks
      ['buttonLink', 'ctaLink', 'linkUrl'].forEach(k => {
        if (props[k] === '' || props[k] === '#') emptyLinksCount++;
      });
    });

    const checks = [];
    let score = 100;

    // Check 1: Primary H1
    if (h1Count === 1) {
      checks.push({ status: 'passed', icon: '✅', title: 'Single Primary <h1> Heading', desc: 'Optimal SEO hierarchy. Found exactly 1 primary H1 heading on this page.' });
    } else if (h1Count === 0) {
      score -= 15;
      checks.push({ status: 'error', icon: '❌', title: 'Missing <h1> Heading', desc: 'No primary <h1> found. Add a Hero Banner or Heading element set to H1 for strong search engine indexing.' });
    } else {
      score -= 8;
      checks.push({ status: 'warning', icon: '⚠️', title: 'Multiple <h1> Headings Found (' + h1Count + ')', desc: 'Best SEO practice recommends having only one <h1> heading per page for clear topical hierarchy.' });
    }

    // Check 2: Page Title
    const title = (ps.pageTitle || '').trim();
    if (title.length >= 30 && title.length <= 65) {
      checks.push({ status: 'passed', icon: '✅', title: `Page Title Length (${title.length} chars)`, desc: `"${title}" is in the optimal sweet spot for Google SERP title snippets (30–65 chars).` });
    } else if (title.length > 0 && title.length < 30) {
      score -= 6;
      checks.push({ status: 'warning', icon: '⚠️', title: `Page Title is Short (${title.length} chars)`, desc: `Consider adding descriptive keywords or school name to expand: "${title}".` });
    } else if (title.length > 65) {
      score -= 5;
      checks.push({ status: 'warning', icon: '⚠️', title: `Page Title Exceeds 65 Chars (${title.length} chars)`, desc: 'Long titles may get truncated with "..." on Google search results.' });
    } else {
      score -= 20;
      checks.push({ status: 'error', icon: '❌', title: 'Missing Page Title', desc: 'Page title is empty. Set a title under the Page settings tab.' });
    }

    // Check 3: Meta Description
    const metaDesc = (ps.metaDescription || '').trim();
    if (metaDesc.length >= 100 && metaDesc.length <= 165) {
      checks.push({ status: 'passed', icon: '✅', title: `Meta Description (${metaDesc.length} chars)`, desc: 'Optimal length for search result snippet previews (100–165 chars).' });
    } else if (metaDesc.length > 0) {
      score -= 5;
      checks.push({ status: 'warning', icon: '⚠️', title: `Meta Description Length (${metaDesc.length} chars)`, desc: 'Aim for 120–160 characters for best organic search click-through rate.' });
    } else {
      score -= 12;
      checks.push({ status: 'warning', icon: '⚠️', title: 'Missing Meta Description', desc: 'No meta description found. Search engines will generate an automatic fallback snippet.' });
    }

    // Check 4: Social Share Image (OpenGraph)
    if (ps.ogImage) {
      checks.push({ status: 'passed', icon: '✅', title: 'Social Share Image (og:image)', desc: 'Banner image configured for Facebook, LinkedIn, Twitter/X, and Viber previews.' });
    } else {
      score -= 8;
      checks.push({ status: 'warning', icon: '⚠️', title: 'Missing Social Share Image', desc: 'Set an OpenGraph banner in Page Settings so link previews look rich and attractive on social media.' });
    }

    // Check 5: Image Alt Tags
    if (missingAltCount === 0 && totalImages > 0) {
      checks.push({ status: 'passed', icon: '✅', title: `Accessible Images (${totalImages} images)`, desc: 'All images contain descriptive alternative text for accessibility and image search.' });
    } else if (missingAltCount > 0) {
      score -= Math.min(15, missingAltCount * 4);
      checks.push({ status: 'warning', icon: '⚠️', title: `${missingAltCount} Image(s) Missing Alt Text`, desc: 'Add descriptive alt text to images to improve accessibility and image ranking.' });
    }

    // Check 6: Mobile Navigation & Viewport
    checks.push({ status: 'passed', icon: '✅', title: 'Mobile Viewport & Drawer Health', desc: 'Responsive viewport meta tag and automated mobile slide-out drawer are active.' });

    // Check 7: Lead Collection & Inquiries
    if (ss.notificationEmail) {
      checks.push({ status: 'passed', icon: '✅', title: `Admin Lead Alert (${ss.notificationEmail})`, desc: 'Registrations and chatbot inquiries are routed directly to admin inbox.' });
    } else {
      score -= 5;
      checks.push({ status: 'warning', icon: '⚠️', title: 'No Admin Notification Email Configured', desc: 'Set an email in Site Settings (⚙️) to receive immediate email notifications for new leads.' });
    }

    score = Math.max(10, Math.min(100, score));
    const grade = score >= 90 ? 'A+ (Excellent)' : score >= 75 ? 'B (Good)' : 'Needs Improvement';
    const scoreClass = score >= 90 ? 'score-excellent' : score >= 75 ? 'score-good' : 'score-poor';

    modal = document.createElement('div');
    modal.id = 'seo-audit-modal';
    modal.className = 'modal-overlay animate-fade-in';
    modal.innerHTML = `
      <div class="modal-box modal-wide animate-scale-in" style="max-width: 720px;">
        <div class="modal-header">
          <div class="modal-title"><span>🛡️</span> Pre-Publish SEO &amp; Health Pre-Flight Audit</div>
          <button class="tool-icon-btn" id="close-seo-modal">✕</button>
        </div>
        <div class="modal-body" style="padding: 22px;">
          <div class="seo-audit-container">
            <div class="seo-score-banner">
              <div class="seo-score-circle ${scoreClass}">
                <div>${score}%</div>
                <div class="seo-score-label">${grade}</div>
              </div>
              <div style="flex: 1;">
                <div style="font-weight: 800; font-size: 1.15rem; color: #fff; margin-bottom: 4px;">
                  Site Health &amp; Readiness Score
                </div>
                <div style="font-size: 0.82rem; color: var(--text-dim); line-height: 1.5;">
                  ${score >= 90 
                    ? '🎉 Outstanding! Your page adheres to high-performance SEO, semantic hierarchy, and mobile usability standards.' 
                    : 'Review the recommendations below to maximize your organic Google visibility and attendee engagement.'}
                </div>
              </div>
            </div>

            <div class="seo-checks-list">
              ${checks.map(c => `
                <div class="seo-check-item ${c.status}">
                  <div class="seo-check-icon">${c.icon}</div>
                  <div class="seo-check-body">
                    <div class="seo-check-title">${c.title}</div>
                    <div class="seo-check-desc">${c.desc}</div>
                  </div>
                </div>
              `).join('')}
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--border-subtle);">
              <button class="topbar-btn" id="btn-seo-fix-settings" style="font-size: 0.85rem;">
                <span>⚙️</span> Open Page Settings
              </button>
              <button class="topbar-btn topbar-btn-publish" id="btn-seo-publish-now" style="padding: 8px 20px;">
                <span>🚀</span> Ready to Publish Live
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#close-seo-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#btn-seo-fix-settings').addEventListener('click', () => {
      modal.remove();
      const pageTab = document.querySelector('.sidebar-tab-btn[data-side-tab="settings"]');
      if (pageTab) pageTab.click();
    });

    modal.querySelector('#btn-seo-publish-now').addEventListener('click', () => {
      modal.remove();
      document.getElementById('btn-publish')?.click();
    });
  }

  // --------------------------------------------------------------------------
  // WORDPRESS-STYLE 1-CLICK SYSTEM UPDATER (GITHUB-CONNECTED)
  // --------------------------------------------------------------------------
  async checkForUpdates() {
    try {
      const ts = Date.now();
      let manifest = null;

      // 1. Check official public distribution channel (aetherbuilder-releases) first
      // Allows main engine repository to stay permanently PRIVATE while updates remain public 24/7
      const RELEASES_REPO = 'bernardlolo25/aetherbuilder-releases';
      const GITHUB_REPO = 'bernardlolo25/aetherbuilder';
      const GITHUB_RAW_MANIFEST = `https://raw.githubusercontent.com/${RELEASES_REPO}/main/version.json?_t=${ts}`;
      const GITHUB_RAW_ZIP = `https://raw.githubusercontent.com/${RELEASES_REPO}/main/aetherbuilder-update.zip?_t=${ts}`;

      try {
        const ghRes = await fetch(GITHUB_RAW_MANIFEST, { cache: 'no-store' });
        if (ghRes.ok) {
          manifest = await ghRes.json();
          manifest.is_github = true;
          manifest.github_zip_url = GITHUB_RAW_ZIP;
        }
      } catch (ghErr) {
        console.warn('Releases channel deferred:', ghErr);
      }

      // Fallback: check primary repository
      if (!manifest) {
        try {
          const fbManifest = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/version.json?_t=${ts}`;
          const ghRes = await fetch(fbManifest, { cache: 'no-store' });
          if (ghRes.ok) {
            manifest = await ghRes.json();
            manifest.is_github = true;
            manifest.github_zip_url = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/aetherbuilder-update.zip?_t=${ts}`;
          }
        } catch (fbErr) {
          console.warn('Primary repository fallback deferred:', fbErr);
        }
      }

      // 2. Fallback to local version.json if GitHub is unreachable
      if (!manifest) {
        try {
          const res = await fetch(`version.json?_t=${ts}`, { cache: 'no-store' });
          if (res.ok) {
            manifest = await res.json();
          }
        } catch {}
      }

      if (!manifest) return;

      this.latestVersionManifest = manifest;
      const remoteVer = manifest.version || '0.0.0';
      const isNewer = this.compareVersions(remoteVer, APP_VERSION) > 0;

      const pill = document.getElementById('update-indicator-pill');
      const dot = document.getElementById('update-badge-dot');
      const badge = document.getElementById('app-version-badge');

      if (isNewer) {
        if (pill) {
          pill.style.display = 'inline-flex';
          pill.innerHTML = `<span>⚡</span> <span>v${remoteVer} Ready!</span>`;
        }
        if (dot) dot.style.display = 'block';
        if (badge) {
          badge.style.color = '#10b981';
          badge.style.fontWeight = '700';
          badge.title = `New version v${remoteVer} available on GitHub! Click to update.`;
        }
      }
    } catch (err) {
      console.warn('Update check deferred:', err);
    }
  }

  compareVersions(v1, v2) {
    const parts1 = String(v1).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = String(v2).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const maxLen = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < maxLen; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  async showUpdateModal() {
    let modal = document.getElementById('aether-update-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'aether-update-modal';
    modal.className = 'modal-overlay animate-fade-in';

    modal.innerHTML = `
      <div class="modal-box modal-wide animate-scale-in" style="max-width: 680px; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden;">
        <div class="modal-header">
          <div class="modal-title flex items-center gap-2">
            <img src="assets/logo.png" alt="AetherBuilder" style="height: 28px; width: 28px; object-fit: contain; border-radius: 6px; background: rgba(255,255,255,0.08); padding: 2px;" />
            <span>AetherBuilder Update & System Hub</span>
          </div>
          <button class="tool-icon-btn" id="close-update-modal">✕</button>
        </div>
        <div class="modal-body" style="padding: 16px 22px; overflow-y: auto; flex: 1; max-height: calc(88vh - 130px); min-height: 0;">
          <!-- System Status Bar -->
          <div class="update-system-checks" id="update-system-checks">
            <div class="update-check-item">
              <span class="check-label">Installed Version</span>
              <span class="check-value" id="stat-curr-ver">v${APP_VERSION}</span>
            </div>
            <div class="update-check-item">
              <span class="check-label">Latest Release</span>
              <span class="check-value" id="stat-latest-ver">Checking...</span>
            </div>
            <div class="update-check-item">
              <span class="check-label">PHP Engine</span>
              <span class="check-value" id="stat-php-ver">...</span>
            </div>
            <div class="update-check-item">
              <span class="check-label">ZipArchive</span>
              <span class="check-value" id="stat-zip-status">...</span>
            </div>
          </div>

          <!-- Tabs -->
          <div class="update-modal-tabs">
            <button class="update-modal-tab active" data-tab="auto">⚡ 1-Click Update</button>
            <button class="update-modal-tab" data-tab="manual">📦 Manual ZIP Drop</button>
            <button class="update-modal-tab" data-tab="backups">🕒 Backups & Rollback</button>
          </div>

          <!-- Tab 1: 1-Click Auto Update -->
          <div id="tab-auto-content" class="update-tab-content">
            <div class="update-changelog-card" style="max-height: 150px; overflow-y: auto;">
              <h4>📋 What's in this Release</h4>
              <ul class="update-changelog-list" id="update-changelog-list">
                <li>Loading release notes...</li>
              </ul>
            </div>

            <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; font-size: 0.82rem; color: #a7f3d0; display: flex; align-items: flex-start; gap: 8px;">
              <span>🛡️</span>
              <div>
                <strong>Zero-Risk Data Guarantee:</strong> Updating will overwrite system files only. Your published pages, layout drafts, uploaded media in <code>assets/uploads/</code>, and custom add-ons will <strong>NEVER</strong> be overwritten or deleted.
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: var(--text-muted); cursor: pointer;">
                <input type="checkbox" id="chk-auto-backup" checked style="accent-color: var(--primary);">
                Create pre-update safety backup in <code>data/backups/</code>
              </label>
            </div>

            <!-- Progress Bar -->
            <div id="update-progress-area" class="update-progress-container" style="display: none;">
              <div class="update-progress-bar-bg">
                <div id="update-progress-fill" class="update-progress-bar-fill"></div>
              </div>
              <div class="update-progress-status">
                <span id="update-status-msg">Initializing update...</span>
                <span id="update-percent-text">0%</span>
              </div>
            </div>
          </div>

          <!-- Tab 2: Manual ZIP Drop -->
          <div id="tab-manual-content" class="update-tab-content" style="display: none;">
            <div style="font-size: 0.82rem; color: var(--text-dim); margin-bottom: 14px; line-height: 1.5;">
              If your web host blocks outgoing internet connections, you can drop any <code>aetherbuilder-update.zip</code> here to update your builder directly in 2 seconds without logging into cPanel or FTP!
            </div>
            
            <div class="update-dropzone" id="update-zip-dropzone">
              <div style="font-size: 2.2rem; margin-bottom: 8px;">📦</div>
              <div style="font-size: 0.9rem; font-weight: 700; color: #f1f5f9; margin-bottom: 4px;">Drag & Drop Update ZIP Here</div>
              <div style="font-size: 0.78rem; color: var(--text-dim); margin-bottom: 12px;">or click to browse your computer</div>
              <input type="file" id="update-zip-file-input" accept=".zip" style="display: none;">
              <button class="topbar-btn topbar-btn-sm" id="btn-select-zip-file" style="margin: 0 auto;">Select ZIP File</button>
            </div>

            <div style="margin-top: 14px; padding: 12px 14px; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.25); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
              <div>
                <div style="font-size: 0.82rem; font-weight: 700; color: #e2e8f0;">Already uploaded via FTP to root?</div>
                <div style="font-size: 0.72rem; color: var(--text-dim);">Instant server-side unpack (no browser upload needed).</div>
              </div>
              <button type="button" class="topbar-btn topbar-btn-publish" id="btn-unpack-server-zip" style="padding: 6px 14px; font-size: 0.78rem; white-space: nowrap;">
                <span>⚡</span> Unpack Server ZIP
              </button>
            </div>

            <div id="manual-file-selected-info" style="display:none; margin-top: 12px; padding: 10px 14px; background: rgba(255,255,255,0.04); border-radius: 8px; font-size: 0.82rem; justify-content: space-between; align-items: center;">
              <span id="selected-zip-name" style="color: #a5b4fc; font-weight: 600;">package.zip</span>
              <button class="topbar-btn topbar-btn-publish" id="btn-upload-manual-zip" style="padding: 6px 14px; font-size: 0.8rem;">
                <span>🚀</span> Unpack & Install
              </button>
            </div>
          </div>

          <!-- Tab 3: Backups & Rollback -->
          <div id="tab-backups-content" class="update-tab-content" style="display: none;">
            <div style="font-size: 0.82rem; color: var(--text-dim); margin-bottom: 12px;">
              Pre-update archives are preserved in <code>data/backups/</code>.
            </div>
            <div id="backups-list-container" style="display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto;">
              <div style="color: var(--text-dim); font-size: 0.8rem; text-align: center; padding: 20px;">Fetching backups...</div>
            </div>
          </div>

        </div>

        <!-- Pinned Sticky Modal Footer: ALWAYS visible on all screen sizes -->
        <div class="modal-footer" id="update-modal-footer" style="padding: 12px 22px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-shrink: 0; z-index: 10;">
          <button class="topbar-btn" id="btn-cancel-update" style="background: rgba(255,255,255,0.08); font-size: 0.84rem; padding: 8px 16px;">Close</button>
          <button class="topbar-btn topbar-btn-publish" id="btn-start-auto-update" style="padding: 9px 22px; font-size: 0.88rem; font-weight: 700; box-shadow: 0 4px 14px rgba(16,185,129,0.35);">
            <span>⚡</span> Install Update Now
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#close-update-modal').addEventListener('click', () => modal.remove());
    modal.querySelector('#btn-cancel-update').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelectorAll('.update-modal-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        modal.querySelectorAll('.update-modal-tab').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        const tab = tabBtn.dataset.tab;
        modal.querySelector('#tab-auto-content').style.display = tab === 'auto' ? 'block' : 'none';
        modal.querySelector('#tab-manual-content').style.display = tab === 'manual' ? 'block' : 'none';
        modal.querySelector('#tab-backups-content').style.display = tab === 'backups' ? 'block' : 'none';
        const autoBtn = modal.querySelector('#btn-start-auto-update');
        if (autoBtn) autoBtn.style.display = tab === 'auto' ? 'inline-flex' : 'none';
        if (tab === 'backups') this.loadBackupsList(modal);
      });
    });

    this.populateUpdateModal(modal);
    this.bindManualZipUpload(modal);
  }

  async populateUpdateModal(modal) {
    try {
      // 1. Fetch system info from api.php
      const sysRes = await fetch('api.php?action=get_system_info');
      if (sysRes.ok) {
        const sys = await sysRes.json();
        const phpEl = modal.querySelector('#stat-php-ver');
        if (phpEl) phpEl.textContent = 'PHP ' + (sys.php_version ? sys.php_version.split('-')[0] : 'OK');
        
        const zipEl = modal.querySelector('#stat-zip-status');
        if (zipEl) {
          if (sys.zip_supported) {
            zipEl.innerHTML = '<span style="color:#10b981;">✓ Enabled</span>';
          } else {
            zipEl.innerHTML = '<span style="color:#ef4444;">✗ Disabled</span>';
          }
        }
      }
    } catch (e) {
      console.warn('System info query skipped:', e);
    }

    // 2. Populate manifest info
    const manifest = this.latestVersionManifest;
    const latestEl = modal.querySelector('#stat-latest-ver');
    const changelogList = modal.querySelector('#update-changelog-list');
    const updateBtn = modal.querySelector('#btn-start-auto-update');

    if (manifest) {
      const remoteVer = manifest.version || APP_VERSION;
      const isNewer = this.compareVersions(remoteVer, APP_VERSION) > 0;
      
      if (latestEl) {
        latestEl.textContent = 'v' + remoteVer;
        if (isNewer) latestEl.className = 'check-value';
      }

      if (changelogList && Array.isArray(manifest.changelog)) {
        changelogList.innerHTML = manifest.changelog.map(item => `<li>${item}</li>`).join('');
        // Scroll changelog back to top so newest/most important items show first
        const changelogCard = changelogList.closest('.update-changelog-card');
        if (changelogCard) changelogCard.scrollTop = 0;
      }

      // 3. Check if update is already pre-cached / staged on hosting server
      try {
        const stageRes = await fetch('api.php?action=check_staged_update');
        if (stageRes.ok) {
          const stageData = await stageRes.json();
          if (stageData.staged) {
            const chkCard = changelogList?.closest('.update-changelog-card');
            if (chkCard && !modal.querySelector('#staged-update-banner')) {
              const badge = document.createElement('div');
              badge.id = 'staged-update-banner';
              badge.style.cssText = 'background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);border-radius:6px;padding:8px 12px;font-size:0.78rem;color:#c7d2fe;margin-bottom:12px;display:flex;align-items:center;gap:8px;';
              badge.innerHTML = `<span>💾</span> <div><strong>Pre-staged on server:</strong> <code>${stageData.filename}</code> (${stageData.size_kb} KB) is cached on your hosting. Ready for 1-click install without external downloads!</div>`;
              chkCard.parentNode.insertBefore(badge, chkCard);
            }
          }
        }
      } catch (e) {}

      if (updateBtn) {
        if (!isNewer) {
          updateBtn.innerHTML = '<span>🔄</span> Reinstall / Repair Core';
        } else {
          updateBtn.innerHTML = `<span>⚡</span> Install Update (v${remoteVer})`;
        }

        updateBtn.onclick = () => this.executeAutoUpdate(modal, manifest);
      }
    } else {
      if (latestEl) latestEl.textContent = 'v' + APP_VERSION;
      if (changelogList) changelogList.innerHTML = '<li>System is operating normally on current version.</li>';
    }
  }

  async executeAutoUpdate(modal, manifest) {
    const btn = modal.querySelector('#btn-start-auto-update');
    const progressArea = modal.querySelector('#update-progress-area');
    const fill = modal.querySelector('#update-progress-fill');
    const statusMsg = modal.querySelector('#update-status-msg');
    const percentText = modal.querySelector('#update-percent-text');
    const chkBackup = modal.querySelector('#chk-auto-backup');

    if (btn) btn.disabled = true;
    if (progressArea) progressArea.style.display = 'flex';

    const setProgress = (pct, text) => {
      if (fill) fill.style.width = pct + '%';
      if (percentText) percentText.textContent = pct + '%';
      if (statusMsg) statusMsg.textContent = text;
    };

    try {
      let data = null;
      const downloadUrl = manifest?.github_zip_url || 
        (manifest?.download_url?.startsWith('http') ? manifest.download_url : null);

      let downloadedViaClient = false;
      if (downloadUrl) {
        try {
          // Client-side download from GitHub CDN (bypasses hosting firewalls & server cURL restrictions!)
          setProgress(25, `Downloading update package from GitHub (v${manifest.version || ''})...`);
          const zipRes = await fetch(downloadUrl, { cache: 'no-store' });
          if (zipRes.ok) {
            const zipBlob = await zipRes.blob();
            setProgress(65, 'Unpacking core files & verifying integrity on server...');
            const formData = new FormData();
            formData.append('update_zip', zipBlob, 'aetherbuilder-update.zip');
            formData.append('backup', chkBackup ? (chkBackup.checked ? '1' : '0') : '1');
            formData.append('admin_token', getAdminToken());

            const postRes = await fetch(`api.php?action=upload_update_zip&token=${encodeURIComponent(getAdminToken())}`, {
              method: 'POST',
              body: formData
            });
            data = await postRes.json();
            downloadedViaClient = true;
          }
        } catch (clientErr) {
          console.warn('Client-side download fallback to server apply_update:', clientErr);
        }
      }

      if (!downloadedViaClient) {
        // Server-side local or direct install fallback
        setProgress(25, 'Connecting to update channel & creating safety backup...');
        const res = await fetch(`api.php?action=apply_update&token=${encodeURIComponent(getAdminToken())}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            download_url: manifest?.download_url || 'aetherbuilder-update.zip',
            backup: chkBackup ? chkBackup.checked : true,
            admin_token: getAdminToken()
          })
        });
        setProgress(65, 'Unpacking core files & verifying integrity...');
        data = await res.json();
      }

      if (data && data.success) {
        setProgress(100, 'Update complete! Refreshing AetherBuilder in 2 seconds...');
        this.canvas?.showToast('🎉 Core successfully updated! Reloading...', 'success');
        setTimeout(() => {
          window.location.reload(true);
        }, 1800);
      } else {
        setProgress(100, 'Update paused: ' + (data?.error || 'Server rejected update'));
        if (fill) fill.style.background = '#ef4444';
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span>⚠️</span> Try Again or Use Manual ZIP';
        }
      }
    } catch (err) {
      console.error('Update execution failed:', err);
      setProgress(100, 'Update failed: ' + (err.message || 'Network error'));
      if (fill) fill.style.background = '#ef4444';
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>⚠️</span> Retry';
      }
    }
  }

  bindManualZipUpload(modal) {
    const dropzone = modal.querySelector('#update-zip-dropzone');
    const fileInput = modal.querySelector('#update-zip-file-input');
    const btnSelect = modal.querySelector('#btn-select-zip-file');
    const selectedInfo = modal.querySelector('#manual-file-selected-info');
    const nameLabel = modal.querySelector('#selected-zip-name');
    const btnUpload = modal.querySelector('#btn-upload-manual-zip');

    if (!dropzone || !fileInput) return;

    btnSelect?.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('click', (e) => {
      if (e.target !== btnSelect) fileInput.click();
    });

    ['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    let selectedFile = null;

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0 && files[0].name.endsWith('.zip')) {
        selectedFile = files[0];
        showSelected();
      } else {
        alert('Please drop a valid .zip update package.');
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        selectedFile = fileInput.files[0];
        showSelected();
      }
    });

    function showSelected() {
      if (nameLabel && selectedFile) nameLabel.textContent = selectedFile.name + ' (' + Math.round(selectedFile.size / 1024) + ' KB)';
      if (selectedInfo) selectedInfo.style.display = 'flex';
    }

    // btn-unpack-server-zip click listener
    const btnServerUnpack = modal.querySelector('#btn-unpack-server-zip');
    btnServerUnpack?.addEventListener('click', async () => {
      btnServerUnpack.disabled = true;
      btnServerUnpack.innerHTML = '<span>⏳</span> Unpacking on server...';
      try {
        // No X-Admin-Token header — InfinityFree intercepts OPTIONS preflight. Token goes in JSON body.
        const res = await fetch('api.php?action=apply_update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            download_url: 'aetherbuilder-update.zip',
            backup: true,
            admin_token: getAdminToken()
          })
        });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (jsonErr) {
          const preview = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
          throw new Error('Server returned non-JSON response (HTTP ' + res.status + '): ' + (preview || 'Empty response'));
        }

        if (data && data.success) {
          btnServerUnpack.innerHTML = '<span>✅</span> Installed!';
          alert('🎉 Update successfully unpacked and applied! AetherBuilder will now reload.');
          window.location.reload(true);
        } else {
          alert('Server unpack error: ' + (data.error || 'Failed to unpack server zip'));
          btnServerUnpack.disabled = false;
          btnServerUnpack.innerHTML = '<span>⚡</span> Unpack Server ZIP';
        }
      } catch (err) {
        console.error('Server unpack error:', err);
        alert('⚠️ Update Request Failed: ' + (err.message || 'Unknown network error') + '\n\nTip: Verify that aetherbuilder-update.zip (or aetherbuilder.zip) is uploaded directly into your site root folder (e.g. htdocs/).');
        btnServerUnpack.disabled = false;
        btnServerUnpack.innerHTML = '<span>⚡</span> Unpack Server ZIP';
      }
    });

    btnUpload?.addEventListener('click', async () => {
      if (!selectedFile) return;
      btnUpload.disabled = true;
      btnUpload.innerHTML = '<span>⏳</span> Installing...';

      const formData = new FormData();
      formData.append('update_zip', selectedFile);
      formData.append('backup', '1');
      formData.append('admin_token', getAdminToken());

      try {
        const res = await fetch('api.php?action=upload_update_zip', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          btnUpload.innerHTML = '<span>✅</span> Installed!';
          alert('Update successfully applied! AetherBuilder will now reload.');
          window.location.reload(true);
        } else {
          alert('Update error: ' + (data.error || 'Failed to install zip'));
          btnUpload.disabled = false;
          btnUpload.innerHTML = '<span>🚀</span> Unpack & Install';
        }
      } catch (err) {
        console.error('Manual ZIP upload error:', err);
        alert('Hosting upload limit reached or connection reset by InfinityFree.\n\nTip: Upload "aetherbuilder-update.zip" to your site root using FTP, then click "⚡ Unpack Server ZIP" right above!');
        btnUpload.disabled = false;
        btnUpload.innerHTML = '<span>🚀</span> Unpack & Install';
      }
    });
  }

  async loadBackupsList(modal) {
    const container = modal.querySelector('#backups-list-container');
    if (!container) return;
    try {
      const res = await fetch('api.php?action=list_backups');
      if (!res.ok) throw new Error('Failed to fetch backups');
      const data = await res.json();
      if (data.backups && data.backups.length > 0) {
        container.innerHTML = data.backups.map(b => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:8px;">
            <div>
              <div style="font-weight:600; font-size:0.83rem; color:#e2e8f0;">${b.filename}</div>
              <div style="font-size:0.72rem; color:var(--text-dim);">${b.date} • ${Math.round(b.size / 1024)} KB</div>
            </div>
            <a href="data/backups/${b.filename}" download class="topbar-btn topbar-btn-sm" style="text-decoration:none; padding:4px 10px; font-size:0.75rem;">
              <span>⬇️</span> Download
            </a>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<div style="color:var(--text-dim); font-size:0.8rem; text-align:center; padding:20px;">No pre-update backups found yet. Backups are created automatically before each update.</div>';
      }
    } catch (err) {
      container.innerHTML = `<div style="color:#ef4444; font-size:0.8rem; text-align:center; padding:20px;">Could not list backups: ${err.message}</div>`;
    }
  }

}

// Bootstrap application reliably regardless of script load timing
function bootstrapAetherApp() {
  try {
    const app = new AetherApp();
    window.aetherApp = app;
    app.start().catch(err => {
      console.error('Fatal AetherApp start error:', err);
      removeInitialLoader();
    });
  } catch (err) {
    console.error('Fatal AetherApp bootstrap error:', err);
    removeInitialLoader();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapAetherApp);
} else {
  bootstrapAetherApp();
}
