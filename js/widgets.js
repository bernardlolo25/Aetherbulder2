/**
 * AETHERBUILDER - WIDGET DEFINITIONS & RENDER ENGINE
 * Defines schemas, defaults, and HTML generators for all visual builder elements.
 */

// Vector SVG Icon Helper: immune to server charset / encoding distortions
export function getSafeIcon(iconVal, customImgUrl = null, className = '', style = '') {
  if (customImgUrl) {
    return `<img src="${customImgUrl}" alt="" class="${className}" style="object-fit: contain; ${style}" />`;
  }
  if (!iconVal) iconVal = '⚡';

  const svgMap = {
    '⚡': `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle;${style}"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    '🚀': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;${style}"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
    '🔐': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;${style}"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    '📱': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;${style}"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`,
    '👥': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;${style}"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    '🌍': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;${style}"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
    '⭐': `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle;${style}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    '💎': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;${style}"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>`,
    '📊': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;${style}"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>`,
    '🖼️': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;${style}"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
    '🎠': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;${style}"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 8 6 4-6 4Z"/></svg>`,
    '✉️': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;${style}"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`
  };

  if (svgMap[iconVal]) return svgMap[iconVal];
  return `<span>${iconVal}</span>`;
}

// Philippine Peso (₱) and Currency Safe Formatter: Prevents charset corruptions on public hosting
export function formatSafeCurrency(val) {
  if (val === undefined || val === null) return '';
  let str = String(val);
  // Clean corrupt UTF-8 mojibake for Peso: â‚±, \u00e2\u201a\u00b1, or raw ₱ / PHP
  return str.replace(/â‚±|\u00e2\u201a\u00b1|₱|PHP|Php/gi, '<span class="wb-peso-symbol">&#8369;</span>');
}

export const WIDGET_REGISTRY = {
  // 0. COUNTDOWN & ANNOUNCEMENT BANNER
  countdown_banner: {
    name: 'Countdown Banner',
    category: 'layout',
    icon: '⏱️',
    description: 'Sticky or inline promo banner with live countdown timer, discount badge, and action button',
    defaultProps: {
      badge: '🔥 LIMITED TIME PROMO',
      message: 'Early-Bird Discount ends soon! Save ₱1,000 on regular seminar rates.',
      targetDate: '2026-11-14T23:59:59',
      showCountdown: true,
      ctaText: 'Claim Discount',
      ctaLink: '?page=registration',
      position: 'sticky-top',
      showCloseBtn: true,
      bgGradient: 'linear-gradient(135deg, #3730a3 0%, #6366f1 50%, #ec4899 100%)',
      textColor: '#ffffff',
      timerAccentColor: '#fbbf24',
      btnBgColor: '#ffffff',
      btnTextColor: '#4338ca',
      btnShape: 'pill'
    },
    schema: {
      content: [
        { key: 'badge', label: 'Badge Text', type: 'text' },
        { key: 'message', label: 'Announcement Message', type: 'text' },
        { key: 'showCountdown', label: 'Display Countdown Timer', type: 'toggle' },
        { key: 'targetDate', label: 'Target Deadline (YYYY-MM-DDTHH:MM)', type: 'text' },
        { key: 'ctaText', label: 'CTA Button Text', type: 'text' },
        { key: 'ctaLink', label: 'CTA Target Page / URL', type: 'page-link' },
        { key: 'position', label: 'Banner Placement', type: 'select', options: [
          { label: 'Sticky Top (Pinned to Screen)', value: 'sticky-top' },
          { label: 'Sticky Bottom (Pinned to Screen)', value: 'sticky-bottom' },
          { label: 'Standard Section (Inline)', value: 'inline' }
        ] },
        { key: 'showCloseBtn', label: 'Show Close Button (✕)', type: 'toggle' }
      ],
      style: [
        { key: 'bgGradient', label: 'Background / Gradient', type: 'text', default: 'linear-gradient(135deg, #3730a3 0%, #6366f1 50%, #ec4899 100%)' },
        { key: 'textColor', label: 'Text Color', type: 'color', default: '#ffffff' },
        { key: 'timerAccentColor', label: 'Timer Digits Color', type: 'color', default: '#fbbf24' },
        { key: 'btnBgColor', label: 'CTA Button Background', type: 'color', default: '#ffffff' },
        { key: 'btnTextColor', label: 'CTA Button Text Color', type: 'color', default: '#4338ca' },
        { key: 'btnShape', label: 'Button Shape', type: 'select', options: [
          { label: 'Pill', value: 'pill' },
          { label: 'Rounded', value: 'rounded' },
          { label: 'Default', value: 'default' },
          { label: 'Square', value: 'square' }
        ], default: 'pill' }
      ]
    },
    render: (props) => {
      const p = props || {};
      const posClass = p.position === 'sticky-bottom' ? 'is-sticky-bottom' : (p.position === 'inline' ? 'is-inline' : 'is-sticky-top');
      const badgeHtml = p.badge ? `<span class="wb-cb-badge">${p.badge}</span>` : '';
      const ctaBorderRadius = ({ default: '4px', rounded: '8px', pill: '9999px', square: '0px' }[p.btnShape] || '9999px');
      const ctaBtn = p.ctaText ? `
        <a href="${p.ctaLink || '#'}" class="wb-cb-btn" style="background:${p.btnBgColor || '#ffffff'};color:${p.btnTextColor || '#4338ca'};border-radius:${ctaBorderRadius};">
          ${p.ctaText} →
        </a>
      ` : '';

      const targetIso = p.targetDate || '2026-11-14T23:59:59';
      const countdownHtml = p.showCountdown !== false ? `
        <div class="wb-cb-timer" data-target="${targetIso}" style="color:${p.timerAccentColor || '#fbbf24'};">
          <div class="wb-cb-unit"><span class="wb-cb-val wb-cb-days">00</span><span class="wb-cb-lbl">d</span></div>
          <span class="wb-cb-sep">:</span>
          <div class="wb-cb-unit"><span class="wb-cb-val wb-cb-hours">00</span><span class="wb-cb-lbl">h</span></div>
          <span class="wb-cb-sep">:</span>
          <div class="wb-cb-unit"><span class="wb-cb-val wb-cb-mins">00</span><span class="wb-cb-lbl">m</span></div>
          <span class="wb-cb-sep">:</span>
          <div class="wb-cb-unit"><span class="wb-cb-val wb-cb-secs">00</span><span class="wb-cb-lbl">s</span></div>
        </div>
      ` : '';

      const closeBtn = p.showCloseBtn !== false ? `
        <button class="wb-cb-close" aria-label="Dismiss announcement" onclick="this.closest('.wb-countdown-banner').style.display='none';">✕</button>
      ` : '';

      return `
        <div class="wb-countdown-banner ${posClass}" style="background:${p.bgGradient || 'linear-gradient(135deg, #3730a3, #ec4899)'};color:${p.textColor || '#ffffff'};">
          <div class="wb-cb-container">
            <div class="wb-cb-message-wrap">
              ${badgeHtml}
              <span class="wb-cb-text">${p.message || ''}</span>
              ${countdownHtml}
            </div>
            <div class="wb-cb-actions">
              ${ctaBtn}
              ${closeBtn}
            </div>
          </div>
        </div>
      `;
    }
  },

  // 1. HEADER / NAVBAR WIDGET
  navbar: {
    name: 'Navbar / Header',
    category: 'layout',
    icon: '🧭',
    description: 'Navigation bar with brand logo, links, and CTA button',
    defaultProps: {
      headerStyle: 'modern',
      brandLayout: 'horizontal',
      globalHeader: true,
      brandText: 'AetherStudio',
      brandSubtitle: '',
      brandTextSize: 'medium',
      brandIcon: '⚡',
      floating: true,
      sticky: true,
      logoType: 'icon',
      logoImageUrl: '',
      logoLink: '#',
      logoWidth: 44,
      logoBadge: false,
      logoOverlap: false,
      showBrandText: true,
      showWave: false,
      topbarInfo: '',
      // Background options
      bgMode: 'glass',
      bgColor: 'rgba(17, 24, 39, 0.75)',
      bgImageUrl: '',
      bgImageSize: 'cover',
      bgImagePosition: 'center center',
      bgOverlayColor: 'rgba(0, 0, 0, 0.45)',
      bgGradient: '',
      bannerBgColor: '#06103c',
      ctaText: 'Get Started',
      ctaLink: '#pricing',
      links: [
        { label: 'Home',     url: '#',        children: [] },
        { label: 'About',    url: '#about',   children: [] },
        { label: 'Services', url: '#services',children: [] },
        { label: 'Contact',  url: '#contact', children: [] }
      ]
    },
    schema: {
      content: [
        {
          key: 'headerStyle',
          label: 'Header Layout Preset',
          type: 'select',
          options: [
            { label: '🌟 Modern Floating / Pill (Default)', value: 'modern' },
            { label: '🏛️ Organization / Institutional Banner', value: 'institutional' },
            { label: '📑 Two-Tier Header (Top Banner + Nav Strip)', value: 'twotier' },
            { label: '⬛ Clean Edge-to-Edge Full-Width', value: 'fullwidth' },
            { label: '🎯 Centered Brand & Emblem', value: 'centered' }
          ]
        },
        { key: 'globalHeader', label: '🌐 Display Globally Across All Pages', type: 'toggle' },
        { key: 'floating', label: 'Always on Top (Floating Sticky - Modern style)', type: 'toggle' },
        {
          key: 'links',
          label: 'Nav Links & Dropdowns',
          type: 'repeater',
          fields: [
            { key: 'label', label: 'Link Label', type: 'text' },
            { key: 'url', label: 'Target Page / URL', type: 'page-link' },
            {
              key: 'children',
              label: 'Dropdown Submenu Items',
              type: 'repeater',
              fields: [
                { key: 'label', label: 'Submenu Link Label', type: 'text' },
                { key: 'url', label: 'Submenu Target Page / URL', type: 'page-link' }
              ]
            }
          ]
        },
        {
          key: 'brandLayout',
          label: 'Logo & Brand Layout',
          type: 'select',
          options: [
            { label: '➡️ Horizontal (Side-by-Side)', value: 'horizontal' },
            { label: '⬇️ Stacked (Logo Above Text)', value: 'stacked' }
          ]
        },
        {
          key: 'logoType',
          label: 'Logo Display Mode',
          type: 'select',
          options: [
            { label: 'Custom Logo Image URL', value: 'image' },
            { label: 'Icon / Emoji', value: 'icon' }
          ]
        },
        { key: 'logoImageUrl', label: 'Custom Logo Image URL', type: 'image-picker' },
        { key: 'logoLink', label: 'Logo Click URL / Page', type: 'page-link' },
        { key: 'logoWidth', label: 'Logo Size / Width (px)', type: 'number' },
        { key: 'logoBadge', label: 'Circular Emblem Badge (White Backing)', type: 'toggle' },
        { key: 'logoOverlap', label: 'Overhanging Seal (Protrudes Below Header)', type: 'toggle' },
        { key: 'brandIcon', label: 'Fallback Icon / Emoji', type: 'text' },
        { key: 'showBrandText', label: 'Show Brand Text', type: 'toggle' },
        { key: 'brandText', label: 'Brand / Site Name', type: 'text' },
        { key: 'brandSubtitle', label: 'Brand Subtitle / Tagline', type: 'text' },
        {
          key: 'brandTextSize',
          label: 'Brand Title Font Size',
          type: 'select',
          options: [
            { label: 'Small (Compact)', value: 'small' },
            { label: 'Medium (Standard)', value: 'medium' },
            { label: 'Large (Prominent)', value: 'large' },
            { label: 'Large Bold Headline (Uppercase Headline)', value: 'institutional' }
          ]
        },
        { key: 'topbarInfo', label: 'Top Bar Contact / Info (Two-Tier Mode)', type: 'text' },
        { key: 'ctaText', label: 'CTA Button Text', type: 'text' },
        { key: 'ctaLink', label: 'CTA Button Target Page', type: 'page-link' }
      ],
      style: [
        {
          key: 'bgMode',
          label: 'Header Background Mode',
          type: 'select',
          options: [
            { label: '✨ Frosted Glass (Translucent)', value: 'glass' },
            { label: '🎨 Solid Color (Non-Transparent)', value: 'solid' },
            { label: '🖼️ Custom Background Image', value: 'image' },
            { label: '🌈 Gradient Background', value: 'gradient' },
            { label: '⚪ Transparent (Seamless Overlay)', value: 'transparent' }
          ]
        },
        { key: 'bgColor', label: 'Navbar Background Color', type: 'color', default: 'rgba(17, 24, 39, 0.75)' },
        { key: 'bgImageUrl', label: 'Custom Background Image', type: 'image-picker' },
        {
          key: 'bgImageSize',
          label: 'Background Image Sizing',
          type: 'select',
          options: [
            { label: 'Cover (Fill full header)', value: 'cover' },
            { label: 'Contain (Fit inside header)', value: 'contain' },
            { label: 'Tile / Pattern (Repeat)', value: 'repeat' }
          ]
        },
        {
          key: 'bgImagePosition',
          label: 'Background Alignment',
          type: 'select',
          options: [
            { label: 'Center Center', value: 'center center' },
            { label: 'Top Center', value: 'top center' },
            { label: 'Bottom Center', value: 'bottom center' },
            { label: 'Left Center', value: 'left center' },
            { label: 'Right Center', value: 'right center' }
          ]
        },
        { key: 'bgOverlayColor', label: 'Background Image Tint / Overlay', type: 'color', default: 'rgba(0, 0, 0, 0.45)' },
        { key: 'bgGradient', label: 'Custom CSS Gradient', type: 'text', default: 'linear-gradient(135deg, #06103c, #1e1b4b)' },
        { key: 'bannerBgColor', label: 'Banner Background (Institutional/Two-Tier)', type: 'color', default: '#06103c' },
        { key: 'showWave', label: '🌊 Bottom Wave / Curved Edge', type: 'toggle' },
        { key: 'textColor', label: 'Nav Links Text Color', type: 'color', default: '#ffffff' },
        { key: 'brandTextColor', label: 'Brand Title Text Color', type: 'color', default: '#ffffff' },
        { key: 'brandSubtitleColor', label: 'Brand Subtitle Color', type: 'color', default: 'rgba(255, 255, 255, 0.75)' },
        { key: 'btnShape', label: 'Button Shape', type: 'select', options: [
          { label: 'Default', value: 'default' },
          { label: 'Rounded', value: 'rounded' },
          { label: 'Pill', value: 'pill' },
          { label: 'Square', value: 'square' }
        ], default: 'default' },
        { key: 'btnBgColor', label: 'Button Background Color', type: 'color', default: '#1d4ed8' },
        { key: 'btnTextColor', label: 'Button Text Color', type: 'color', default: '#ffffff' }
      ]
    },
    render: (props) => {
      const headerStyle = props.headerStyle || 'modern';
      const isFloating = props.floating !== false;
      const isSticky = props.sticky !== false;
      const navClass = [
        `style-${headerStyle}`,
        isFloating ? 'is-floating' : '',
        isSticky ? 'is-sticky' : '',
        props.showWave ? 'has-wave' : ''
      ].filter(Boolean).join(' ');

      const brandLayout = props.brandLayout || 'horizontal';
      const brandTextSize = props.brandTextSize || (headerStyle === 'institutional' ? 'institutional' : 'medium');
      const logoWidth = Number(props.logoWidth) || (headerStyle === 'institutional' ? 70 : 44);
      const isImage = (props.logoType === 'image' && props.logoImageUrl) || (props.logoImageUrl && !props.brandIcon);
      const hasBadge = props.logoBadge === true || (props.logoBadge === undefined && headerStyle === 'institutional');
      const hasOverlap = props.logoOverlap === true || (props.logoOverlap === undefined && headerStyle === 'institutional');

      // Background Style & Layer Computation
      const bgMode = props.bgMode || (props.bgImageUrl ? 'image' : (props.bgGradient ? 'gradient' : 'glass'));
      const hasCustomBg = bgMode === 'image' || bgMode === 'solid' || bgMode === 'gradient';

      let bgLayerStyle = '';
      let bgOverlayHtml = '';

      if (bgMode === 'image' && props.bgImageUrl) {
        const repeat = props.bgImageSize === 'repeat' ? 'repeat' : 'no-repeat';
        const size = props.bgImageSize === 'repeat' ? 'auto' : (props.bgImageSize || 'cover');
        const pos = props.bgImagePosition || 'center center';
        bgLayerStyle = `background-image: url('${props.bgImageUrl}'); background-size: ${size}; background-position: ${pos}; background-repeat: ${repeat};`;
        if (props.bgColor && props.bgColor !== 'transparent') {
          bgLayerStyle += ` background-color: ${props.bgColor};`;
        }
        if (props.bgOverlayColor) {
          bgOverlayHtml = `<div class="wb-navbar-bg-overlay" style="background: ${props.bgOverlayColor};"></div>`;
        }
      } else if (bgMode === 'solid') {
        const solidBg = props.bgColor || (headerStyle === 'institutional' ? (props.bannerBgColor || '#06103c') : '#090d16');
        bgLayerStyle = `background: ${solidBg};`;
      } else if (bgMode === 'gradient') {
        const grad = props.bgGradient || 'linear-gradient(135deg, #06103c, #1e1b4b)';
        bgLayerStyle = `background: ${grad};`;
      } else if (bgMode === 'transparent') {
        bgLayerStyle = `background: transparent;`;
      } else {
        // 'glass' mode: default frosted glass with user's bgColor
        const glassBg = props.bgColor || 'rgba(17, 24, 39, 0.75)';
        bgLayerStyle = `background: ${glassBg}; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);`;
      }

      const bgLayerHtml = `<div class="wb-navbar-bg-layer" style="${bgLayerStyle}">${bgOverlayHtml}</div>`;

      const currentSlug = (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('page') : '') || 'index';
      const isLinkActive = (url) => {
        if (!url) return false;
        if (url === `?page=${currentSlug}` || url === `index.html?page=${currentSlug}`) return true;
        if (currentSlug === 'index' && (url === '#' || url === '/' || url === 'index.html' || url === '?page=index' || url === '?view=public')) return true;
        return false;
      };

      const parseSublinks = (raw) => {
        if (!raw) return [];
        if (Array.isArray(raw)) {
          return raw.map((s) => {
            if (typeof s === 'string') return { label: s, url: '#' };
            return {
              label: s.label || s.title || s.name || 'Sublink',
              url: s.url || s.link || '#'
            };
          });
        }
        if (typeof raw === 'string') {
          const trimmed = raw.trim();
          if (!trimmed) return [];
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) return parsed;
              if (parsed && typeof parsed === 'object') {
                if (Array.isArray(parsed.links)) return parsed.links;
                if (Array.isArray(parsed.children)) return parsed.children;
                if (Array.isArray(parsed.items)) return parsed.items;
              }
            } catch (e) {}
          }
          const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          if (lines.length > 0) {
            return lines.map((line) => {
              if (line.includes('|')) {
                const parts = line.split('|');
                return { label: parts[0]?.trim() || 'Link', url: parts[1]?.trim() || '#' };
              }
              return { label: line, url: '#' };
            });
          }
        } else if (typeof raw === 'object') {
          if (Array.isArray(raw.links)) return raw.links;
          if (Array.isArray(raw.children)) return raw.children;
          if (Array.isArray(raw.items)) return raw.items;
        }
        return [];
      };

      const linksHtml = (props.links || [])
        .map((l) => {
          const activeClass = isLinkActive(l.url) ? 'active' : '';
          const childrenList = parseSublinks(l.children);
          const hasChildren = childrenList.length > 0;
          const subHtml = childrenList.map((s) => {
            const item = typeof s === 'string' ? { label: s, url: '#' } : (s || {});
            const subUrl = item.url || item.link || '#';
            const subLabel = item.label || item.title || item.name || 'Sublink';
            const subActive = isLinkActive(subUrl) ? 'active' : '';
            return `<li><a href="${subUrl}" class="wb-nav-sublink ${subActive}" style="${props.textColor ? `color:${props.textColor};` : ''}">${subLabel}</a></li>`;
          }).join('');
          const caret = hasChildren ? ' <span class="wb-nav-caret">▾</span>' : '';
          const submenu = hasChildren ? `<ul class="wb-nav-submenu">${subHtml}</ul>` : '';
          return `<li class="wb-nav-item ${activeClass} ${hasChildren ? 'has-submenu' : ''}"><a href="${l.url || '#'}" class="wb-nav-link ${activeClass}" style="${props.textColor ? `color:${props.textColor};` : ''}">${l.label || 'Link'}${caret}</a>${submenu}</li>`;
        })
        .join('');

      const logoImgHtml = isImage
        ? `<img src="${props.logoImageUrl}" alt="${props.brandText || 'Logo'}" class="brand-logo-img" style="width: ${logoWidth}px; max-height: ${Math.max(logoWidth, 80)}px;" />`
        : `<span class="brand-icon">${getSafeIcon(props.brandIcon || '⚡', null, '', 'width: 22px; height: 22px; color: #fff;')}</span>`;

      const showBrand = props.showBrandText !== false && (props.brandText || props.brandSubtitle);
      const brandTitleStyle = props.brandTextColor ? `color: ${props.brandTextColor};` : '';
      const brandSubtitleStyle = props.brandSubtitleColor ? `color: ${props.brandSubtitleColor};` : '';

      const brandHtml = `
        <a href="${props.logoLink || 'index.html'}" class="wb-nav-brand ${hasOverlap ? 'has-overlap' : ''}">
          <div class="wb-nav-brand-wrapper ${brandLayout === 'stacked' ? 'is-stacked' : ''}">
            <div class="wb-nav-logo-box ${hasBadge ? 'has-badge' : ''} ${hasOverlap ? 'has-overlap' : ''}">
              ${logoImgHtml}
            </div>
            ${showBrand ? `
              <div class="wb-nav-brand-text size-${brandTextSize}">
                <span class="wb-nav-brand-title" style="${brandTitleStyle}">${props.brandText || ''}</span>
                ${props.brandSubtitle ? `<span class="wb-nav-brand-subtitle" style="${brandSubtitleStyle}">${props.brandSubtitle}</span>` : ''}
              </div>
            ` : ''}
          </div>
        </a>
      `;

      const ctaBtnHtml = props.ctaText ? `
        <a href="${props.ctaLink || '#'}" class="wb-nav-cta" style="background:${props.btnBgColor || ''};color:${props.btnTextColor || ''};border-radius:${({default:'4px',rounded:'8px',pill:'9999px',square:'0px'}[props.btnShape]||'4px')};">${props.ctaText} →</a>
      ` : '';

      const navActionsHtml = `
        <div class="wb-nav-actions">
          ${ctaBtnHtml}
          <button class="wb-nav-toggle" aria-label="Toggle Menu" aria-expanded="false">
            <span class="wb-nav-toggle-icon">☰</span>
          </button>
        </div>
      `;

      const mobileMenuHtml = `
        <div class="wb-nav-mobile-menu" aria-hidden="true">
          <ul class="wb-nav-mobile-links">
            ${linksHtml}
          </ul>
          ${props.ctaText ? `
            <div class="wb-nav-mobile-cta-wrap">
              <a href="${props.ctaLink || '#'}" class="wb-nav-cta wb-nav-mobile-cta" style="background:${props.btnBgColor || ''};color:${props.btnTextColor || ''};border-radius:${({default:'4px',rounded:'8px',pill:'9999px',square:'0px'}[props.btnShape]||'4px')};">${props.ctaText} →</a>
            </div>
          ` : ''}
        </div>
      `;

      // Wave SVG decoration (Image 2 style)
      const waveColor = props.bannerBgColor || props.bgColor || '#06103c';
      const waveSvgHtml = (props.showWave || headerStyle === 'institutional') ? `
        <div class="wb-navbar-wave-wrap" style="color: ${waveColor};">
          <svg class="wb-navbar-wave" viewBox="0 0 1440 48" preserveAspectRatio="none">
            <path d="M0,0 C380,42 760,12 1440,36 L1440,0 L0,0 Z" fill="currentColor"></path>
          </svg>
        </div>
      ` : '';

      // Two-Tier Header Layout
      if (headerStyle === 'twotier') {
        const bannerBg = props.bannerBgColor || '#06103c';
        const navBg = props.bgColor || 'rgba(15, 23, 42, 0.95)';
        return `
          <header class="wb-navbar style-twotier ${hasCustomBg ? 'has-custom-bg' : ''} ${isFloating ? 'is-floating' : ''} ${isSticky ? 'is-sticky' : ''}">
            <div class="wb-nav-topbar" style="position: relative; overflow: hidden; background: ${bannerBg};">
              ${bgMode === 'image' && props.bgImageUrl ? bgLayerHtml : ''}
              <div class="wb-nav-topbar-inner" style="position: relative; z-index: 2;">
                ${brandHtml}
                <div class="wb-nav-topbar-right">
                  ${props.topbarInfo ? `<div class="wb-nav-topbar-info">${props.topbarInfo}</div>` : ''}
                  <button class="wb-nav-toggle" aria-label="Toggle Menu" aria-expanded="false">
                    <span class="wb-nav-toggle-icon">☰</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="wb-nav-bottombar" style="background: ${navBg};">
              <div class="wb-nav-bottombar-inner">
                <ul class="wb-nav-links">
                  ${linksHtml}
                </ul>
                <div class="wb-nav-actions">
                  ${ctaBtnHtml}
                </div>
              </div>
            </div>
            ${mobileMenuHtml}
          </header>
        `;
      }

      // Institutional Header Layout (Image 2 Match)
      if (headerStyle === 'institutional') {
        const bannerBg = props.bannerBgColor || props.bgColor || '#06103c';
        const institutionalInlineBg = (!props.bgImageUrl && !props.bgGradient) ? `background: ${bannerBg};` : '';
        return `
          <header class="wb-navbar style-institutional ${hasCustomBg ? 'has-custom-bg' : ''} ${isFloating ? 'is-floating' : ''} ${isSticky ? 'is-sticky' : ''}" style="${institutionalInlineBg}">
            ${bgLayerHtml}
            <div class="wb-nav-row wb-nav-institutional-row">
              ${brandHtml}
              <ul class="wb-nav-links wb-nav-institutional-links">
                ${linksHtml}
              </ul>
              ${navActionsHtml}
            </div>
            ${waveSvgHtml}
            ${mobileMenuHtml}
          </header>
        `;
      }

      // Centered Brand Layout
      if (headerStyle === 'centered') {
        return `
          <header class="wb-navbar style-centered ${navClass} ${hasCustomBg ? 'has-custom-bg' : ''}">
            ${bgLayerHtml}
            <div class="wb-nav-centered-top">
              ${brandHtml}
              <button class="wb-nav-toggle" aria-label="Toggle Menu" aria-expanded="false">
                <span class="wb-nav-toggle-icon">☰</span>
              </button>
            </div>
            <div class="wb-nav-centered-bottom">
              <ul class="wb-nav-links">
                ${linksHtml}
              </ul>
              ${ctaBtnHtml ? `<div class="wb-nav-actions">${ctaBtnHtml}</div>` : ''}
            </div>
            ${mobileMenuHtml}
          </header>
        `;
      }

      // Default Modern Floating / Clean Fullwidth Layout
      return `
        <header class="wb-navbar ${navClass} ${hasCustomBg ? 'has-custom-bg' : ''}">
          ${bgLayerHtml}
          <div class="wb-nav-row">
            ${brandHtml}
            <ul class="wb-nav-links">
              ${linksHtml}
            </ul>
            ${navActionsHtml}
          </div>
          ${waveSvgHtml}
          ${mobileMenuHtml}
        </header>
      `;
    }
  },

  // 1.5 HEADING / TITLE TEXT WIDGET
  heading_title: {
    name: 'Title & Heading',
    category: 'content',
    icon: '🔤',
    description: 'Customizable section title with HTML heading tags (H1-H6), gradient highlights, and subheadings',
    defaultProps: {
      badge: 'FEATURED SECTION',
      badgeIconUrl: '',
      title: 'Build High-Converting Websites with Ease',
      highlightWord: 'High-Converting',
      subtitle: 'Flexible layout blocks engineered for modern web design and responsive performance.',
      tag: 'h2',
      alignment: 'center',
      size: 'medium',
      textColor: '#ffffff',
      fitContentHeight: false,
      paddingTop: '24px',
      paddingBottom: '24px'
    },
    schema: {
      content: [
        { key: 'badge', label: 'Badge Micro-Label', type: 'text' },
        { key: 'badgeIconUrl', label: 'Badge Icon Image (Optional)', type: 'image-picker' },
        { key: 'title', label: 'Heading Text', type: 'text' },
        { key: 'highlightWord', label: 'Gradient Highlight Word', type: 'text' },
        { key: 'subtitle', label: 'Subtitle Description', type: 'textarea' },
        {
          key: 'tag',
          label: 'HTML Heading Tag',
          type: 'select',
          options: [
            { label: 'H1 - Main Page Title', value: 'h1' },
            { label: 'H2 - Section Heading', value: 'h2' },
            { label: 'H3 - Sub-heading', value: 'h3' },
            { label: 'H4 - Minor Heading', value: 'h4' },
            { label: 'H5 - Small Title', value: 'h5' },
            { label: 'H6 - Micro Title', value: 'h6' }
          ]
        }
      ],
      style: [
        { key: 'fitContentHeight', label: '⚡ Fit to Content Height (Zero Extra Spacing)', type: 'toggle', default: false },
        { key: 'paddingTop', label: 'Padding Top (e.g. 0px, 12px, 24px)', type: 'text', default: '24px' },
        { key: 'paddingBottom', label: 'Padding Bottom (e.g. 0px, 12px, 24px)', type: 'text', default: '24px' },
        {
          key: 'alignment',
          label: 'Text Alignment',
          type: 'select',
          options: [
            { label: 'Center', value: 'center' },
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' }
          ]
        },
        {
          key: 'size',
          label: 'Title Size',
          type: 'select',
          options: [
            { label: 'Small (1.5rem)', value: 'small' },
            { label: 'Medium (2.2rem)', value: 'medium' },
            { label: 'Large (3.0rem)', value: 'large' },
            { label: 'Giant Hero (3.8rem)', value: 'giant' }
          ]
        },
        { key: 'textColor', label: 'Text Color', type: 'color', default: '#ffffff' }
      ]
    },
    render: (props) => {
      const tag = props.tag || 'h2';
      let titleHtml = props.title || 'Heading Title';
      if (props.highlightWord && titleHtml.includes(props.highlightWord)) {
        titleHtml = titleHtml.replace(
          props.highlightWord,
          `<span class="gradient-text">${props.highlightWord}</span>`
        );
      }

      const sizeMap = {
        small: '1.5rem',
        medium: '2.2rem',
        large: '3.0rem',
        giant: '3.8rem'
      };
      const fontSize = sizeMap[props.size] || '2.2rem';
      const align = props.alignment || 'center';
      const colorStyle = props.textColor ? `color: ${props.textColor};` : '';

      const badgeIconHtml = props.badgeIconUrl ? `<img src="${props.badgeIconUrl}" alt="" style="width: 16px; height: 16px; object-fit: contain; vertical-align: middle; margin-right: 4px;" />` : '';

      const isFit = props.fitContentHeight === true;
      const headingPadTop = isFit ? '0px' : (props.paddingTop !== undefined && props.paddingTop !== '' ? (String(props.paddingTop).match(/[a-z%]/i) ? props.paddingTop : `${props.paddingTop}px`) : '24px');
      const headingPadBottom = isFit ? '0px' : (props.paddingBottom !== undefined && props.paddingBottom !== '' ? (String(props.paddingBottom).match(/[a-z%]/i) ? props.paddingBottom : `${props.paddingBottom}px`) : '24px');
      const headingPadding = `padding-top: ${headingPadTop}; padding-bottom: ${headingPadBottom}; margin: 0;`;
      const gapMargin = isFit ? 'margin-bottom: 4px;' : 'margin-bottom: 12px;';

      return `
        <div class="wb-heading-widget ${isFit ? 'fit-content-height' : ''}" style="text-align: ${align}; ${headingPadding}">
          ${props.badge ? `<div class="wb-section-badge" style="display: inline-flex; align-items: center; gap: 4px; ${gapMargin}">${badgeIconHtml}<span>${props.badge}</span></div>` : ''}
          <${tag} class="wb-heading-title" style="font-size: ${fontSize}; font-weight: 800; line-height: 1.2; ${gapMargin} ${colorStyle}">
            ${titleHtml}
          </${tag}>
          ${props.subtitle ? `<p class="wb-heading-subtitle" style="font-size: 1.05rem; color: var(--text-muted); max-width: 680px; margin: 0 ${align === 'center' ? 'auto' : '0'}; line-height: 1.6;">${props.subtitle}</p>` : ''}
        </div>
      `;
    }
  },

  // 2. HERO WIDGET
  hero: {
    name: 'Hero Section',
    category: 'content',
    icon: '🚀',
    description: 'High-impact headline, subtitle, badges, and action buttons',
    defaultProps: {
      badgeText: '✨ Next-Gen Visual Web Engine',
      badgeIconUrl: '',
      title: 'Craft Extraordinary Digital Experiences with Ease',
      highlightWord: 'Extraordinary',
      description: 'The ultra-responsive, Elementor-grade web builder with high-security protection, live reactive components, and instant publishing.',
      primaryBtnText: 'Start Building Free',
      primaryBtnLink: '#features',
      secondaryBtnText: 'Explore Showcase',
      secondaryBtnLink: '#slider',
      fitContentHeight: false,
      paddingTop: '60px',
      paddingBottom: '60px'
    },
    schema: {
      content: [
        { key: 'badgeText', label: 'Badge Text', type: 'text' },
        { key: 'badgeIconUrl', label: 'Badge Icon Image (Optional)', type: 'image-picker' },
        { key: 'title', label: 'Main Headline', type: 'text' },
        { key: 'highlightWord', label: 'Gradient Highlight Word', type: 'text' },
        { key: 'description', label: 'Description Text', type: 'textarea' },
        { key: 'primaryBtnText', label: 'Primary Button Text', type: 'text' },
        { key: 'primaryBtnLink', label: 'Primary Button Target Page', type: 'page-link' },
        { key: 'secondaryBtnText', label: 'Secondary Button Text', type: 'text' },
        { key: 'secondaryBtnLink', label: 'Secondary Button Target Page', type: 'page-link' }
      ],
      style: [
        { key: 'fitContentHeight', label: '⚡ Fit to Content Height', type: 'toggle', default: false },
        { key: 'paddingTop', label: 'Padding Top (e.g. 20px, 60px)', type: 'text', default: '60px' },
        { key: 'paddingBottom', label: 'Padding Bottom (e.g. 20px, 60px)', type: 'text', default: '60px' },
        { key: 'textAlign', label: 'Alignment', type: 'select', options: ['center', 'left'], default: 'center' },
        { key: 'glowColor', label: 'Mesh Glow Color', type: 'color', default: 'rgba(99, 102, 241, 0.25)' }
      ]
    },
    render: (props) => {
      let titleHtml = props.title || '';
      if (props.highlightWord && titleHtml.includes(props.highlightWord)) {
        titleHtml = titleHtml.replace(
          props.highlightWord,
          `<span class="gradient-text">${props.highlightWord}</span>`
        );
      }

      const badgeIcon = props.badgeIconUrl
        ? `<img src="${props.badgeIconUrl}" alt="" style="width: 16px; height: 16px; object-fit: contain; vertical-align: middle; margin-right: 4px;" />`
        : `<span>⚡</span>`;

      const isFit = props.fitContentHeight === true;
      const heroPadTop = isFit ? '12px' : (props.paddingTop !== undefined && props.paddingTop !== '' ? (String(props.paddingTop).match(/[a-z%]/i) ? props.paddingTop : `${props.paddingTop}px`) : '60px');
      const heroPadBottom = isFit ? '12px' : (props.paddingBottom !== undefined && props.paddingBottom !== '' ? (String(props.paddingBottom).match(/[a-z%]/i) ? props.paddingBottom : `${props.paddingBottom}px`) : '60px');
      const heroPadding = `padding-top: ${heroPadTop}; padding-bottom: ${heroPadBottom};`;

      return `
        <div class="wb-hero animate-fade-in-up ${isFit ? 'fit-content-height' : ''}" style="text-align: ${props.textAlign || 'center'}; ${heroPadding}">
          ${props.badgeText ? `<div class="wb-hero-badge">${badgeIcon} ${props.badgeText}</div>` : ''}
          <h1 class="wb-hero-title">${titleHtml}</h1>
          <p class="wb-hero-desc">${props.description || ''}</p>
          <div class="wb-hero-actions" style="justify-content: ${props.textAlign === 'left' ? 'flex-start' : 'center'};">
            ${props.primaryBtnText ? `<a href="${props.primaryBtnLink || '#'}" class="wb-btn wb-btn-primary">${props.primaryBtnText} ⚡</a>` : ''}
            ${props.secondaryBtnText ? `<a href="${props.secondaryBtnLink || '#'}" class="wb-btn wb-btn-secondary">${props.secondaryBtnText} ↗</a>` : ''}
          </div>
        </div>
      `;
    }
  },

  // 4. COUNTER WIDGET (ANIMATED STATS)
  counter: {
    name: 'Counter Stats',
    category: 'content',
    icon: '📊',
    description: 'Dynamic animated number counters that count up into view',
    defaultProps: {
      badge: 'PROVEN TRACTION',
      title: 'Global Performance & Trust Metrics',
      subtitle: 'Engineered for uninterrupted high-concurrency uptime and lightning execution speed.',
      stats: [
        { iconType: 'icon', icon: '⚡', iconImageUrl: '', target: 99.9, prefix: '', suffix: '%', label: 'Uptime Guaranteed', decimals: 1 },
        { iconType: 'icon', icon: '👥', iconImageUrl: '', target: 140, prefix: '', suffix: 'K+', label: 'Active Creators', decimals: 0 },
        { iconType: 'icon', icon: '🌍', iconImageUrl: '', target: 82, prefix: '', suffix: '+', label: 'Global Edge PoPs', decimals: 0 },
        { iconType: 'icon', icon: '⭐', iconImageUrl: '', target: 4.95, prefix: '', suffix: '/5', label: 'Customer Rating', decimals: 2 }
      ]
    },
    schema: {
      content: [
        { key: 'badge', label: 'Section Badge', type: 'text' },
        { key: 'title', label: 'Section Title', type: 'text' },
        { key: 'subtitle', label: 'Section Subtitle', type: 'textarea' },
        {
          key: 'stats',
          label: 'Counter Items',
          type: 'repeater',
          fields: [
            {
              key: 'iconType',
              label: 'Icon Mode',
              type: 'select',
              options: [
                { label: 'Emoji / Icon', value: 'icon' },
                { label: 'Custom Image from Library', value: 'image' }
              ]
            },
            { key: 'iconImageUrl', label: 'Custom Icon Image URL', type: 'image-picker' },
            { key: 'icon', label: 'Fallback Emoji / Icon', type: 'text' },
            { key: 'target', label: 'Target Number', type: 'number' },
            { key: 'prefix', label: 'Prefix (e.g. $)', type: 'text' },
            { key: 'suffix', label: 'Suffix (e.g. +)', type: 'text' },
            { key: 'label', label: 'Stat Description', type: 'text' },
            { key: 'decimals', label: 'Decimals', type: 'number' }
          ]
        }
      ]
    },
    render: (props) => {
      const itemsHtml = (props.stats || []).map((s) => {
        const isImage = (s.iconType === 'image' && s.iconImageUrl) || (s.iconImageUrl && !s.icon);
        const iconHtml = isImage
          ? `<div class="wb-counter-icon"><img src="${s.iconImageUrl}" alt="" style="width: 32px; height: 32px; object-fit: contain;" /></div>`
          : (s.icon ? `<div class="wb-counter-icon">${s.icon}</div>` : '');

        return `
          <div class="wb-counter-card" data-target="${s.target || 0}" data-decimals="${s.decimals || 0}">
            ${iconHtml}
            <div class="wb-counter-value">
              <span class="wb-counter-prefix">${s.prefix || ''}</span>
              <span class="counter-number" data-count="${s.target || 0}">${s.target || 0}</span>
              <span class="wb-counter-suffix">${s.suffix || ''}</span>
            </div>
            <div class="wb-counter-label">${s.label || ''}</div>
          </div>
        `;
      }).join('');

      return `
        <div class="wb-counter-wrapper">
          ${props.title || props.badge ? `
            <div class="wb-section-heading">
              ${props.badge ? `<div class="wb-section-badge">${props.badge}</div>` : ''}
              ${props.title ? `<h2 class="wb-section-title">${props.title}</h2>` : ''}
              ${props.subtitle ? `<p class="wb-section-subtitle">${props.subtitle}</p>` : ''}
            </div>
          ` : ''}
          <div class="wb-counter-grid">${itemsHtml}</div>
        </div>
      `;
    }
  },

  // 5. GALLERY WIDGET (FILTERABLE + LIGHTBOX)
  gallery: {
    name: 'Gallery & Lightbox',
    category: 'media',
    icon: '🖼️',
    description: 'Filterable responsive photo gallery with full-screen lightbox modal',
    defaultProps: {
      filterAllLabel: 'All Works',
      images: [
        {
          url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
          title: 'Aura Gradient Flow',
          category: 'Digital Art',
          tag: 'Abstract'
        },
        {
          url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
          title: 'Cyber Hardware Matrix',
          category: 'Technology',
          tag: 'SaaS'
        },
        {
          url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
          title: 'Geometric Modernity',
          category: 'Digital Art',
          tag: 'Design'
        },
        {
          url: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=800&q=80',
          title: 'Minimalist Workspace',
          category: 'Branding',
          tag: 'Creative'
        },
        {
          url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
          title: 'Encrypted Cryptography',
          category: 'Technology',
          tag: 'Security'
        },
        {
          url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80',
          title: 'Interface Prototyping',
          category: 'Branding',
          tag: 'Mobile'
        }
      ]
    },
    schema: {
      content: [
        { key: 'filterAllLabel', label: 'All Filter Label', type: 'text' },
        {
          key: 'images',
          label: 'Gallery Images',
          type: 'repeater',
          fields: [
            { key: 'url', label: 'Image URL', type: 'image-picker' },
            { key: 'title', label: 'Title', type: 'text' },
            { key: 'category', label: 'Category Filter', type: 'text' },
            { key: 'tag', label: 'Tag Badge', type: 'text' }
          ]
        }
      ]
    },
    render: (props) => {
      const images = props.images || [];
      const categories = ['All', ...new Set(images.map((img) => img.category).filter(Boolean))];

      const filtersHtml = categories
        .map(
          (cat, idx) => `
          <button class="wb-gallery-filter-btn ${idx === 0 ? 'active' : ''}" data-filter="${cat.toLowerCase()}">
            ${cat === 'All' ? props.filterAllLabel || 'All' : cat}
          </button>
        `
        )
        .join('');

      const gridHtml = images
        .map(
          (img, idx) => `
        <div class="wb-gallery-item" data-category="${(img.category || 'all').toLowerCase()}" data-index="${idx}">
          <img src="${img.url}" alt="${img.title || 'Gallery image'}" loading="lazy" />
          <div class="wb-gallery-overlay">
            <span class="wb-gallery-tag">${img.tag || img.category || 'Visual'}</span>
            <div class="wb-gallery-title">${img.title || 'Untitled Project'}</div>
          </div>
        </div>
      `
        )
        .join('');

      return `
        <div class="wb-gallery-wrapper" id="gallery">
          <div class="wb-gallery-filters">
            ${filtersHtml}
          </div>
          <div class="wb-gallery-grid">
            ${gridHtml}
          </div>
        </div>
      `;
    }
  },

  // 6. SLIDER / CAROUSEL WIDGET
  slider: {
    name: 'Interactive Slider',
    category: 'media',
    icon: '🎠',
    description: 'Dynamic carousel with smooth transitions, autoplay, custom slide buttons and links',
    defaultProps: {
      autoPlay: true,
      autoPlayInterval: 4500,
      showSlideButtons: true,
      fitContentHeight: false,
      sliderHeight: '380px',
      slidePadding: '60px 48px',
      paddingTop: '48px',
      paddingBottom: '48px',
      slides: [
        {
          bgImage: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
          title: 'Quantum Cloud Infrastructure',
          desc: 'High-concurrency clusters designed to withstand hyper-scale traffic spikes with zero downtime.',
          showButton: true,
          btnText: 'Discover Architecture',
          btnLink: '#features',
          btnStyle: 'primary',
          btnTargetBlank: false
        },
        {
          bgImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
          title: 'Hardened Studio Defense',
          desc: 'Zero-knowledge memory-hard security safeguarding administrative panels against unauthorized access.',
          showButton: true,
          btnText: 'Security Deep Dive',
          btnLink: '#stats',
          btnStyle: 'glow',
          btnTargetBlank: false
        },
        {
          bgImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
          title: 'Universal Elementor Flexibility',
          desc: 'Drag, assemble, restyle, and publish pixel-perfect landing pages in minutes without coding boundaries.',
          showButton: true,
          btnText: 'Start Building Now',
          btnLink: '#contact',
          btnStyle: 'primary',
          btnTargetBlank: false
        }
      ]
    },
    schema: {
      content: [
        { key: 'autoPlay', label: 'Auto-Play Carousel', type: 'toggle' },
        { key: 'autoPlayInterval', label: 'Interval (ms)', type: 'number' },
        { key: 'showSlideButtons', label: 'Enable Slide Buttons', type: 'toggle' },
        {
          key: 'slides',
          label: 'Slides',
          type: 'repeater',
          fields: [
            { key: 'bgImage', label: 'Background Image URL', type: 'image-picker' },
            { key: 'title', label: 'Slide Title', type: 'text' },
            { key: 'desc', label: 'Description', type: 'textarea' },
            { key: 'showButton', label: 'Show Button on Slide', type: 'toggle' },
            { key: 'btnText', label: 'Button Text', type: 'text' },
            { key: 'btnLink', label: 'Button Link URL', type: 'text' },
            {
              key: 'btnStyle',
              label: 'Button Style',
              type: 'select',
              options: [
                { label: 'Primary Gradient', value: 'primary' },
                { label: 'Neon Glow', value: 'glow' },
                { label: 'Outline', value: 'outline' },
                { label: 'Secondary Ghost', value: 'secondary' }
              ]
            },
            { key: 'btnTargetBlank', label: 'Open in New Tab', type: 'toggle' },
            { key: 'btnShape', label: 'Button Shape', type: 'select', options: [
                { label: 'Default', value: 'default' },
                { label: 'Rounded', value: 'rounded' },
                { label: 'Pill', value: 'pill' },
                { label: 'Square', value: 'square' }
              ], default: 'default' },
            { key: 'btnBgColor', label: 'Button Background Color', type: 'color', default: '#1d4ed8' },
            { key: 'btnTextColor', label: 'Button Text Color', type: 'color', default: '#ffffff' }
          ]
        }
      ],
      style: [
        { key: 'fitContentHeight', label: '⚡ Fit Content Height (Compact Slider)', type: 'toggle', default: false },
        {
          key: 'sliderHeight',
          label: 'Slide Height',
          type: 'select',
          options: [
            { label: 'Fit to Content (Auto Height)', value: 'auto' },
            { label: 'Compact (260px)', value: '260px' },
            { label: 'Medium (380px - Default)', value: '380px' },
            { label: 'Standard (480px)', value: '480px' },
            { label: 'Large Hero (600px)', value: '600px' }
          ]
        },
        {
          key: 'slidePadding',
          label: 'Slide Content Padding',
          type: 'select',
          options: [
            { label: 'Tight (16px 20px)', value: '16px 20px' },
            { label: 'Compact (32px 32px)', value: '32px 32px' },
            { label: 'Standard (60px 48px - Default)', value: '60px 48px' },
            { label: 'Spacious (80px 64px)', value: '80px 64px' }
          ]
        },
        { key: 'paddingTop', label: 'Section Padding Top', type: 'text', default: '48px' },
        { key: 'paddingBottom', label: 'Section Padding Bottom', type: 'text', default: '48px' }
      ]
    },
    render: (props) => {
      const slides = props.slides || [];
      const showGlobalButtons = props.showSlideButtons !== false;

      const isFit = props.fitContentHeight === true;
      const heightVal = isFit ? 'auto' : (props.sliderHeight || '380px');
      const padVal = isFit ? '20px 24px' : (props.slidePadding || '60px 48px');
      const minHeightStyle = heightVal === 'auto' ? 'min-height: auto; height: auto;' : `min-height: ${heightVal}; height: ${heightVal};`;
      const sliderStyle = isFit ? 'margin: 0; padding: 0;' : '';

      const slidesHtml = slides
        .map(
          (s) => {
            const hasButton = showGlobalButtons && s.showButton !== false && s.btnText;
            const btnTarget = s.btnTargetBlank ? 'target="_blank" rel="noopener"' : '';
            const btnStyle = s.btnStyle || 'primary';

            return `
              <div class="wb-slide" style="background-image: url('${s.bgImage}'); ${minHeightStyle} padding: ${padVal};">
                <div class="wb-slide-overlay"></div>
                <div class="wb-slide-content" style="${isFit ? 'padding: 0; margin: 0;' : ''}">
                  <h2 class="wb-slide-title" style="${isFit ? 'margin-bottom: 6px; font-size: 1.6rem;' : ''}">${s.title || ''}</h2>
                  <p class="wb-slide-desc" style="${isFit ? 'margin-bottom: 12px; font-size: 0.95rem;' : ''}">${s.desc || ''}</p>
                  ${hasButton ? `<a href="${s.btnLink || '#'}" class="wb-btn wb-btn-${btnStyle}" ${btnTarget} style="background:${s.btnBgColor || ''};color:${s.btnTextColor || ''};border-radius:${({default:'4px',rounded:'8px',pill:'9999px',square:'0px'}[s.btnShape]||'4px')};">${s.btnText} →</a>` : ''}
                </div>
              </div>
            `;
          }
        )
        .join('');

      const dotsHtml = slides
        .map((_, i) => `<span class="wb-slider-dot ${i === 0 ? 'active' : ''}" data-slide="${i}"></span>`)
        .join('');

      return `
        <div class="wb-slider-container ${isFit ? 'fit-content-height' : ''}" id="slider" style="${minHeightStyle} ${sliderStyle}" data-autoplay="${props.autoPlay !== false}" data-interval="${props.autoPlayInterval || 4500}">
          <div class="wb-slider-track">
            ${slidesHtml}
          </div>
          <button class="wb-slider-btn prev" aria-label="Previous slide">❮</button>
          <button class="wb-slider-btn next" aria-label="Next slide">❯</button>
          <div class="wb-slider-dots">
            ${dotsHtml}
          </div>
        </div>
      `;
    }
  },

  // 7. TEXT & IMAGE WIDGET
  text_image: {
    name: 'Text & Image',
    category: 'content',
    icon: '📰',
    description: 'Split-view editorial block with rich typography and feature checklist',
    defaultProps: {
      badge: 'Unmatched Performance',
      title: 'Precision Engineering Meets Intuitive Simplicity',
      body: 'Transform static designs into living digital web applications. Our reactive layout engine computes fluid constraints, handles device responsiveness, and preserves semantic markup.',
      imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
      imagePosition: 'right',
      features: [
        'Zero-latency visual tree updates with state reconciliation',
        'Built-in hardened cryptographic credential security',
        'Instant multi-device viewport scaling (Desktop, Tablet, Mobile)',
        'Full JSON & HTML standalone export capabilities'
      ],
      btnText: 'Explore Documentation',
      btnLink: '#features'
    },
    schema: {
      content: [
        { key: 'badge', label: 'Badge Label', type: 'text' },
        { key: 'title', label: 'Headline', type: 'text' },
        { key: 'body', label: 'Paragraph Text', type: 'textarea' },
        { key: 'imageUrl', label: 'Image URL', type: 'image-picker' },
        {
          key: 'imagePosition',
          label: 'Image Side',
          type: 'select',
          options: [
            { label: 'Right', value: 'right' },
            { label: 'Left', value: 'left' }
          ]
        },
        { key: 'btnText', label: 'Button Text', type: 'text' },
        { key: 'btnLink', label: 'Button Link', type: 'text' },
        { key: 'btnShape', label: 'Button Shape', type: 'select', options: [
          { label: 'Default', value: 'default' },
          { label: 'Rounded', value: 'rounded' },
          { label: 'Pill', value: 'pill' },
          { label: 'Square', value: 'square' }
        ], default: 'default' },
        { key: 'btnBgColor', label: 'Button Background Color', type: 'color', default: '#1d4ed8' },
        { key: 'btnTextColor', label: 'Button Text Color', type: 'color', default: '#ffffff' },
        {
          key: 'features',
          label: 'Feature Bullet Points',
          type: 'repeater',
          fields: [{ key: 'text', label: 'Point', type: 'text' }]
        }
      ]
    },
    render: (props) => {
      const isReverse = props.imagePosition === 'left' ? 'reverse' : '';
      const rawFeatures = props.features || [];
      const featureListHtml = rawFeatures
        .map((f) => {
          const text = typeof f === 'string' ? f : f.text;
          return `
          <li class="wb-feature-item">
            <span class="wb-feature-check">✓</span>
            <span>${text}</span>
          </li>
        `;
        })
        .join('');

      return `
        <div class="wb-text-image ${isReverse}">
          <div class="wb-text-content">
            ${props.badge ? `<div class="wb-text-badge">${props.badge}</div>` : ''}
            <h2 class="wb-text-title">${props.title || ''}</h2>
            <p class="wb-text-body">${props.body || ''}</p>
            ${featureListHtml ? `<ul class="wb-feature-list">${featureListHtml}</ul>` : ''}
            ${props.btnText ? `<div><a href="${props.btnLink || '#'}" class="wb-btn wb-btn-primary" style="background:${props.btnBgColor || ''};color:${props.btnTextColor || ''};border-radius:${({default:'4px',rounded:'8px',pill:'9999px',square:'0px'}[props.btnShape]||'4px')};">${props.btnText} →</a></div>` : ''}
          </div>
          <div class="wb-image-wrapper">
            <img src="${props.imageUrl}" alt="${props.title || 'Feature image'}" loading="lazy" />
          </div>
        </div>
      `;
    }
  },

  // 8. DIVIDER WIDGET
  divider: {
    name: 'Section Divider',
    category: 'layout',
    icon: '➖',
    description: 'Decorative divider line, neon glow, or curved wave boundary',
    defaultProps: {
      style: 'glow',
      badgeText: 'AETHER'
    },
    schema: {
      content: [
        {
          key: 'style',
          label: 'Divider Style',
          type: 'select',
          options: [
            { label: 'Neon Glow Line', value: 'glow' },
            { label: 'Subtle Solid Line', value: 'solid' },
            { label: 'Dashed Border', value: 'dashed' },
            { label: 'SVG Wave Curve', value: 'wave' },
            { label: 'Badge with Center Icon', value: 'badge' }
          ]
        },
        { key: 'badgeText', label: 'Center Text (if Badge)', type: 'text' }
      ]
    },
    render: (props) => {
      const style = props.style || 'glow';
      if (style === 'wave') {
        return `
          <div class="wb-divider style-wave">
            <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"></path>
            </svg>
          </div>
        `;
      }
      if (style === 'badge') {
        return `
          <div class="wb-divider style-glow">
            <div class="wb-divider-line"></div>
            <div class="wb-divider-badge">${props.badgeText || '✦'}</div>
          </div>
        `;
      }
      return `
        <div class="wb-divider style-${style}">
          <div class="wb-divider-line"></div>
        </div>
      `;
    }
  },

  // 8.5 ACTION BUTTON WIDGET (STANDALONE CTA BUTTON)
  button: {
    name: 'Action Button',
    category: 'content',
    icon: '🔘',
    description: 'Customizable call-to-action button with icons, links, and effects',
    defaultProps: {
      text: 'Explore Capabilities',
      link: '#features',
      targetBlank: false,
      btnStyle: 'primary',
      size: 'medium',
      alignment: 'center',
      iconType: 'icon',
      icon: '⚡',
      iconImageUrl: '',
      iconPosition: 'right',
      subtext: 'Instant Access • No Credit Card Required',
      customBgColor: '',
      customTextColor: ''
    },
    schema: {
      content: [
        { key: 'text', label: 'Button Label Text', type: 'text' },
        { key: 'link', label: 'Button Target Page / URL', type: 'page-link' },
        { key: 'targetBlank', label: 'Open in New Tab', type: 'toggle' },
        {
          key: 'iconType',
          label: 'Icon Mode',
          type: 'select',
          options: [
            { label: 'Emoji / Text Icon', value: 'icon' },
            { label: 'Custom Image from Media Library', value: 'image' }
          ]
        },
        { key: 'iconImageUrl', label: 'Custom Icon Image URL', type: 'image-picker' },
        { key: 'icon', label: 'Emoji / Text Icon', type: 'text' },
        {
          key: 'iconPosition',
          label: 'Icon Placement',
          type: 'select',
          options: [
            { label: 'Right Side', value: 'right' },
            { label: 'Left Side', value: 'left' }
          ]
        },
        { key: 'subtext', label: 'Subtext Micro-Copy', type: 'text' }
      ],
      style: [
        {
          key: 'btnStyle',
          label: 'Visual Style',
          type: 'select',
          options: [
            { label: 'Primary Gradient', value: 'primary' },
            { label: 'Neon Glow Pulse', value: 'glow' },
            { label: 'Cyan-Pink Gradient', value: 'gradient' },
            { label: 'Border Outline', value: 'outline' },
            { label: 'Secondary Dark', value: 'secondary' }
          ]
        },
        {
          key: 'size',
          label: 'Button Size',
          type: 'select',
          options: [
            { label: 'Small', value: 'small' },
            { label: 'Medium (Default)', value: 'medium' },
            { label: 'Large (Hero CTA)', value: 'large' }
          ]
        },
        {
          key: 'alignment',
          label: 'Alignment',
          type: 'select',
          options: [
            { label: 'Center', value: 'center' },
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' },
            { label: 'Full Width', value: 'full' }
          ]
        },
        { key: 'customBgColor', label: 'Custom Background Color', type: 'color' },
        { key: 'customTextColor', label: 'Custom Text Color', type: 'color' }
      ]
    },
    render: (props) => {
      const targetAttr = props.targetBlank ? 'target="_blank" rel="noopener"' : '';
      const styleClass = `wb-btn-${props.btnStyle || 'primary'}`;
      const sizeClass = `wb-btn-${props.size || 'medium'}`;
      const alignClass = `align-${props.alignment || 'center'}`;

      let customStyles = '';
      if (props.customBgColor) customStyles += `background: ${props.customBgColor};`;
      if (props.customTextColor) customStyles += `color: ${props.customTextColor} !important;`;

      const isImage = (props.iconType === 'image' && props.iconImageUrl) || (props.iconImageUrl && !props.icon);
      const iconHtml = isImage
        ? `<img src="${props.iconImageUrl}" alt="" class="btn-icon-img" style="width: 18px; height: 18px; object-fit: contain; vertical-align: middle;" />`
        : (props.icon ? `<span class="btn-icon">${props.icon}</span>` : '');

      return `
        <div class="wb-button-wrapper ${alignClass}">
          <a href="${props.link || '#'}" class="wb-btn ${styleClass} ${sizeClass}" ${targetAttr} style="${customStyles}">
            ${props.iconPosition === 'left' ? iconHtml : ''}
            <span>${props.text || 'Action Button'}</span>
            ${props.iconPosition !== 'left' ? iconHtml : ''}
          </a>
          ${props.subtext ? `<div class="wb-btn-subtext">${props.subtext}</div>` : ''}
        </div>
      `;
    }
  },

  // 9. FEATURES GRID WIDGET
  features_grid: {
    name: 'Feature Grid',
    category: 'content',
    icon: '💎',
    description: 'Triple or quad card grid showcasing key system capabilities',
    defaultProps: {
      badge: 'ARCHITECTURAL ADVANTAGE',
      title: 'Next-Level Studio Capabilities',
      subtitle: 'Experience true visual freedom without sacrificing speed, security, or clean code output.',
      cards: [
        {
          iconType: 'icon',
          icon: '⚡',
          iconImageUrl: '',
          title: 'Sub-millisecond Canvas',
          desc: 'Every edit, color shift, and layout tweak updates the live virtual tree instantly with zero stutter or lag.'
        },
        {
          iconType: 'icon',
          icon: '🔐',
          iconImageUrl: '',
          title: 'Hardened Studio Defense',
          desc: 'Armed with industrial-grade cryptographic security to keep the admin workspace protected.'
        },
        {
          iconType: 'icon',
          icon: '📱',
          iconImageUrl: '',
          title: 'Pixel-Accurate Device Views',
          desc: 'Simulate Desktop, Tablet (768px), and Mobile (390px) viewports with realistic chassis previewing.'
        }
      ]
    },
    schema: {
      content: [
        { key: 'badge', label: 'Section Badge', type: 'text' },
        { key: 'title', label: 'Section Title', type: 'text' },
        { key: 'subtitle', label: 'Section Subtitle', type: 'textarea' },
        {
          key: 'cards',
          label: 'Feature Cards',
          type: 'repeater',
          fields: [
            {
              key: 'iconType',
              label: 'Icon Mode',
              type: 'select',
              options: [
                { label: 'Emoji / Icon', value: 'icon' },
                { label: 'Custom Image from Library', value: 'image' }
              ]
            },
            { key: 'iconImageUrl', label: 'Custom Icon Image URL', type: 'image-picker' },
            { key: 'icon', label: 'Emoji / Text Icon', type: 'text' },
            { key: 'title', label: 'Card Title', type: 'text' },
            { key: 'desc', label: 'Card Description', type: 'textarea' }
          ]
        }
      ],
      style: [
        { key: 'cardSize', label: '📐 Card Size', type: 'select', default: 'full', options: [
          { label: 'Full Width (stretch to fill)', value: 'full' },
          { label: 'Large (max ~460px)', value: 'lg' },
          { label: 'Standard (max ~360px)', value: 'md' },
          { label: 'Small (max ~280px)', value: 'sm' },
          { label: 'Compact (max ~200px)', value: 'xs' }
        ]}
      ]
    },
    render: (props) => {
      const sizeClass = props.cardSize && props.cardSize !== 'full' ? ` card-size-${props.cardSize}` : '';
      const cardsHtml = (props.cards || [])
        .map((c) => {
          const isImage = (c.iconType === 'image' && c.iconImageUrl) || (c.iconImageUrl && !c.icon);
          const iconBox = isImage
            ? `<div class="wb-feature-icon-box" style="padding: 6px; display: flex; align-items: center; justify-content: center;"><img src="${c.iconImageUrl}" alt="${c.title || ''}" class="wb-feature-icon-img" style="width: 36px; height: 36px; object-fit: contain; border-radius: 6px;" /></div>`
            : `<div class="wb-feature-icon-box">${c.icon || '✦'}</div>`;

          return `
            <div class="wb-feature-card">
              ${iconBox}
              <h3 class="wb-feature-title">${c.title || ''}</h3>
              <p class="wb-feature-desc">${c.desc || ''}</p>
            </div>
          `;
        })
        .join('');

      return `
        <div class="wb-features-wrapper" id="features">
          ${props.title || props.badge ? `
            <div class="wb-section-heading">
              ${props.badge ? `<div class="wb-section-badge">${props.badge}</div>` : ''}
              ${props.title ? `<h2 class="wb-section-title">${props.title}</h2>` : ''}
              ${props.subtitle ? `<p class="wb-section-subtitle">${props.subtitle}</p>` : ''}
            </div>
          ` : ''}
          <div class="wb-features-grid${sizeClass}">${cardsHtml}</div>
        </div>
      `;
    }
  },

  // 10. PRICING TABLE WIDGET
  pricing: {
    name: 'Pricing Table',
    category: 'content',
    icon: '🏷️',
    description: 'Tier cards for seminar registration packages, memberships, or service offerings',
    defaultProps: {
      sectionTitle: '',
      sectionSubtitle: '',
      fitContentHeight: false,
      paddingTop: '48px',
      paddingBottom: '48px',
      tiers: [
        {
          name: 'Face to Face',
          showDiscount: true,
          regularPrice: '₱16,000',
          discountedPrice: '₱14,500',
          rateLayout: 'discount_bottom',
          discountBadge: 'Save ₱1,500! Early Bird Rate',
          price: '₱14,500',
          period: '/ Regular Rate',
          venueAddress: '📍 Waterfront Cebu City Hotel & Casino, Lahug, Cebu City',
          featured: false,
          featuresText: '📍 Venue: Waterfront Cebu City Hotel & Casino, Lahug\n🍱 Complete 4-Day Buffet Lunch & PM Snacks\n📜 36-Credit Unit MCLE Accredited Certificate\n💼 Physical Seminar Kit & Printed Lecture Materials\n☕ Morning & Afternoon Coffee Stations',
          btnText: 'Register Now!',
          btnLink: '?page=registration',
          btnStyle: 'primary'
        },
        {
          name: 'Synchronous Online Via Zoom',
          showDiscount: true,
          regularPrice: '₱9,500',
          discountedPrice: '₱8,000',
          rateLayout: 'discount_bottom',
          discountBadge: 'Save ₱1,500 Online Special',
          price: '₱8,000',
          period: 'Regular Rate',
          venueAddress: '🌐 Live Interactive Sessions via Zoom Meeting',
          featured: true,
          badge: 'Most Popular',
          featuresText: '🌐 High-Definition Live Zoom Classroom\n💬 Interactive Q&A with Guest Lecturers\n📥 Digital PDF Syllabus & Lecture Handouts\n📜 Verifiable Digital MCLE Certificate\n⚡ Fast Online Attendance Verification',
          btnText: 'Register Now!',
          btnLink: '?page=registration',
          btnStyle: 'glow'
        }
      ]
    },
    schema: {
      content: [
        { key: 'sectionTitle', label: 'Section Title', type: 'text' },
        { key: 'sectionSubtitle', label: 'Section Subtitle', type: 'textarea' },
        {
          key: 'tiers',
          label: 'Pricing Packages / Tiers',
          type: 'repeater',
          fields: [
            { key: 'name', label: 'Package Name', type: 'text' },
            { key: 'showDiscount', label: '⚡ Enable Dual Rates (Regular + Discounted)', type: 'toggle' },
            { key: 'discountedPrice', label: 'Discounted / Promo Rate (e.g. ₱14,500)', type: 'text' },
            { key: 'regularPrice', label: 'Regular Original Rate (e.g. ₱16,000)', type: 'text' },
            {
              key: 'rateLayout',
              label: 'Rate Position & Layout',
              type: 'select',
              options: [
                { label: 'Regular on Top (Strike) ➔ Discounted on Bottom (Recommended)', value: 'discount_bottom' },
                { label: 'Discounted on Top ➔ Regular Rate below', value: 'discount_top' }
              ]
            },
            { key: 'discountBadge', label: 'Discount Badge / Savings Note', type: 'text' },
            { key: 'price', label: 'Single Rate Fallback (if dual rate is disabled)', type: 'text' },
            { key: 'period', label: 'Rate Label (e.g. / Regular Rate, / person)', type: 'text' },
            { key: 'venueAddress', label: 'Venue Address / Delivery Note (Optional)', type: 'text' },
            {
              key: 'featuresText',
              label: 'Inclusions & Details (Multiline, supports emojis & symbols)',
              type: 'textarea'
            },
            { key: 'featured', label: 'Highlight Card (Featured Glow)', type: 'toggle' },
            { key: 'badge', label: 'Card Badge Text (e.g. Most Popular)', type: 'text' },
            { key: 'btnText', label: 'Button Label', type: 'text' },
            { key: 'btnLink', label: 'Button Target Page / URL', type: 'page-link' },
            {
              key: 'btnStyle',
              label: 'Button Style',
              type: 'select',
              options: [
                { label: 'Primary Gradient', value: 'primary' },
                { label: 'Neon Glow', value: 'glow' },
                { label: 'Outline', value: 'outline' },
                { label: 'Secondary Ghost', value: 'secondary' }
              ]
            }
          ]
        }
      ],
      style: [
        { key: 'fitContentHeight', label: '⚡ Fit to Content Height', type: 'toggle', default: false },
        { key: 'cardSize', label: '📐 Card Size', type: 'select', default: 'full', options: [
          { label: 'Full Width (stretch to fill)', value: 'full' },
          { label: 'Large (max ~480px)', value: 'lg' },
          { label: 'Standard (max ~380px)', value: 'md' },
          { label: 'Small (max ~300px)', value: 'sm' },
          { label: 'Compact (max ~220px)', value: 'xs' }
        ]},
        { key: 'paddingTop', label: 'Padding Top', type: 'text', default: '48px' },
        { key: 'paddingBottom', label: 'Padding Bottom', type: 'text', default: '48px' }
      ]
    },
    render: (props) => {
      const isFit = props.fitContentHeight === true;
      const sizeClass = props.cardSize && props.cardSize !== 'full' ? ` card-size-${props.cardSize}` : '';
      const tiersHtml = (props.tiers || [])
        .map((t) => {
          const featuredClass = t.featured ? 'featured' : '';
          const btnTarget = t.btnLink || '?page=registration';
          const btnStyle = t.btnStyle || (t.featured ? 'primary' : 'secondary');

          // Parse features list (multiline text or array)
          let featureLines = [];
          if (t.featuresText && typeof t.featuresText === 'string') {
            featureLines = t.featuresText.split('\n').map((l) => l.trim()).filter(Boolean);
          } else if (Array.isArray(t.features) && t.features.length > 0) {
            featureLines = t.features;
          }

          const featureListHtml = featureLines.map((line) => {
            // Check if line starts with an emoji, icon, or symbol
            const emojiMatch = line.match(/^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|📍|🏢|🍱|📜|💼|☕|🌐|💬|📥|⚡|✅|✓|•|-)\s*(.*)$/u);
            if (emojiMatch) {
              const iconPart = emojiMatch[1];
              const textPart = emojiMatch[2] || '';
              return `
                <li class="wb-feature-item" style="font-size: 0.92rem; align-items: flex-start; gap: 8px;">
                  <span style="font-size: 1.05rem; flex-shrink: 0; line-height: 1.4;">${iconPart}</span>
                  <span style="line-height: 1.45;">${textPart}</span>
                </li>
              `;
            }
            return `
              <li class="wb-feature-item" style="font-size: 0.92rem; align-items: flex-start; gap: 8px;">
                <span class="wb-feature-check" style="flex-shrink: 0; margin-top: 2px;">✓</span>
                <span style="line-height: 1.45;">${line}</span>
              </li>
            `;
          }).join('');

          // Rate display logic (Dual rates vs Single rate)
          let costHtml = '';
          const hasDualRates = t.showDiscount && (t.discountedPrice || t.regularPrice);
          if (hasDualRates) {
            const regPriceSafe = formatSafeCurrency(t.regularPrice || '');
            const discPriceSafe = formatSafeCurrency(t.discountedPrice || t.price || '');
            const periodText = t.period ? `<span class="wb-pricing-period">${t.period}</span>` : '';
            const discountBadgeHtml = t.discountBadge ? `<div class="wb-pricing-save-pill">${formatSafeCurrency(t.discountBadge)}</div>` : '';

            if (t.rateLayout === 'discount_top') {
              costHtml = `
                <div class="wb-dual-pricing-box discount-top">
                  ${discountBadgeHtml}
                  <div class="wb-pricing-cost main-price">
                    ${discPriceSafe} ${periodText}
                  </div>
                  <div class="wb-pricing-sub-strike">
                    Regular: <span class="wb-pricing-strike">${regPriceSafe}</span>
                  </div>
                </div>
              `;
            } else {
              // discount_bottom (Regular on top with strikethrough, Discounted below)
              costHtml = `
                <div class="wb-dual-pricing-box discount-bottom">
                  <div class="wb-pricing-sub-strike">
                    Regular: <span class="wb-pricing-strike">${regPriceSafe}</span>
                  </div>
                  <div class="wb-pricing-cost main-price" style="margin: 4px 0 6px;">
                    ${discPriceSafe} ${periodText}
                  </div>
                  ${discountBadgeHtml}
                </div>
              `;
            }
          } else {
            const singlePriceSafe = formatSafeCurrency(t.price || '');
            costHtml = `
              <div class="wb-pricing-cost">
                ${singlePriceSafe} <span class="wb-pricing-period">${t.period || ''}</span>
              </div>
            `;
          }

          const venueHtml = t.venueAddress ? `
            <div class="wb-pricing-venue-badge">
              <span>${t.venueAddress}</span>
            </div>
          ` : '';

          return `
            <div class="wb-pricing-card ${featuredClass}">
              ${t.featured && t.badge ? `<div class="wb-pricing-badge">${t.badge}</div>` : ''}
              <div>
                <div class="wb-pricing-name">${t.name || 'Plan Name'}</div>
                ${costHtml}
                ${venueHtml}
                <ul class="wb-feature-list" style="margin: 18px 0 24px;">
                  ${featureListHtml}
                </ul>
              </div>
              <a href="${btnTarget}" class="wb-btn wb-btn-${btnStyle}" style="width: 100%; text-align: center; text-decoration: none;">
                ${t.btnText || 'Register Now!'}
              </a>
            </div>
          `;
        })
        .join('');

      return `
        <div class="wb-pricing-wrapper ${isFit ? 'fit-content-height' : ''}" id="pricing">
          ${props.sectionTitle ? `
            <div style="text-align: center; margin-bottom: ${isFit ? '16px' : '36px'};">
              <h2 style="font-size: ${isFit ? '1.8rem' : '2.2rem'}; font-weight: 800; margin-bottom: 8px; color: var(--text-main);">${props.sectionTitle}</h2>
              ${props.sectionSubtitle ? `<p style="font-size: 1.05rem; color: var(--text-muted); max-width: 680px; margin: 0 auto; line-height: 1.6;">${props.sectionSubtitle}</p>` : ''}
            </div>
          ` : ''}
          <div class="wb-pricing-grid${sizeClass}">${tiersHtml}</div>
        </div>
      `;
    }
  },

  // 11. FAQ ACCORDION WIDGET
  faq: {
    name: 'FAQ Accordion',
    category: 'content',
    icon: '❓',
    description: 'Expandable question and answer accordions',
    defaultProps: {
      items: [
        {
          question: 'How does workspace protection secure my builder?',
          answer: 'AetherBuilder employs high-grade memory-hard credential security that resists GPU and ASIC cracking attacks. When you sign in, cryptographic verification runs right inside your browser to keep your workspace protected.'
        },
        {
          question: 'Can I export the website to host on any server?',
          answer: 'Yes! AetherBuilder provides 1-click HTML & JSON export. You can download the static files and host them on Cloudflare Pages, Netlify, Vercel, AWS S3, or any standard Apache/Nginx web server.'
        },
        {
          question: 'Does the public view load quickly for visitors?',
          answer: 'Absolutely. The public view is stripped of all editor overhead. It renders lightweight, semantic HTML with CSS variables and lazy-loaded media for blazing 99+ Google Lighthouse scores.'
        }
      ]
    },
    schema: {
      content: [
        {
          key: 'items',
          label: 'Q&A Items',
          type: 'repeater',
          fields: [
            { key: 'question', label: 'Question', type: 'text' },
            { key: 'answer', label: 'Answer', type: 'textarea' }
          ]
        }
      ]
    },
    render: (props) => {
      const itemsHtml = (props.items || [])
        .map(
          (item, idx) => `
        <div class="wb-faq-item ${idx === 0 ? 'open' : ''}">
          <div class="wb-faq-question">
            <span>${item.question}</span>
            <span class="wb-faq-chevron">▾</span>
          </div>
          <div class="wb-faq-answer">
            ${item.answer}
          </div>
        </div>
      `
        )
        .join('');

      return `<div class="wb-faq-container" id="faq">${itemsHtml}</div>`;
    }
  },

  // 12. CONTACT FORM WIDGET
  contact: {
    name: 'Contact Form',
    category: 'content',
    icon: '✉️',
    description: 'Clean contact form with validation and instant feedback toast',
    defaultProps: {
      title: 'Get in Touch with our Architects',
      subtitle: 'Have a project in mind or need tailored deployment assistance? Send us a message.',
      btnText: 'Send Message'
    },
    schema: {
      content: [
        { key: 'title', label: 'Form Title', type: 'text' },
        { key: 'subtitle', label: 'Subtitle', type: 'textarea' },
        { key: 'btnText', label: 'Button Text', type: 'text' }
      ]
    },
    render: (props) => {
      return `
        <form class="wb-contact-form" id="contact" onsubmit="return false;">
          <input type="text" name="_hp" style="display:none;" tabindex="-1" autocomplete="off" />
          <div style="text-align: center; margin-bottom: 8px;">
            <h3 style="font-size: 1.6rem; font-weight: 700; margin-bottom: 6px;">${props.title || 'Contact Us'}</h3>
            <p style="font-size: 0.95rem; color: var(--text-muted);">${props.subtitle || ''}</p>
          </div>
          <div class="wb-form-group">
            <label class="wb-form-label">Full Name</label>
            <input type="text" name="name" class="wb-form-input" placeholder="e.g. Sarah Connor" required />
          </div>
          <div class="wb-form-group">
            <label class="wb-form-label">Email Address</label>
            <input type="email" name="email" class="wb-form-input" placeholder="e.g. sarah@cyberdyne.io" required />
          </div>
          <div class="wb-form-group">
            <label class="wb-form-label">Your Message</label>
            <textarea name="message" class="wb-form-textarea" rows="4" placeholder="How can we help your team?" required></textarea>
          </div>
          <button type="submit" class="wb-btn wb-btn-primary" style="width: 100%; margin-top: 6px;">
            ${props.btnText || 'Send Message'} ✉️
          </button>
        </form>
      `;
    }
  },

  // 13. VIDEO PLAYER WIDGET
  video_player: {
    name: 'Video Player',
    category: 'media',
    icon: '▶️',
    description: 'Embed YouTube, Vimeo, or direct video URLs with a responsive player',
    defaultProps: {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Watch Our Introduction',
      subtitle: 'A quick overview of everything AetherStudio can do for your team.',
      aspectRatio: '16/9',
      autoplay: false,
      muted: false,
      controls: true,
      showCaption: true,
      captionText: '▶ Play Video · 3 min watch',
      rounded: true,
      showShadow: true
    },
    schema: {
      content: [
        { key: 'url', label: 'Video URL (YouTube / Vimeo / .mp4)', type: 'text' },
        { key: 'title', label: 'Section Title', type: 'text' },
        { key: 'subtitle', label: 'Section Subtitle', type: 'textarea' },
        { key: 'showCaption', label: 'Show Caption Below', type: 'toggle' },
        { key: 'captionText', label: 'Caption Text', type: 'text' },
        { key: 'autoplay', label: 'Autoplay (mutes automatically)', type: 'toggle' },
        { key: 'muted', label: 'Start Muted', type: 'toggle' },
        { key: 'controls', label: 'Show Player Controls', type: 'toggle' }
      ],
      style: [
        {
          key: 'aspectRatio',
          label: 'Aspect Ratio',
          type: 'select',
          options: [
            { label: '16:9 (Widescreen)', value: '16/9' },
            { label: '4:3 (Classic)', value: '4/3' },
            { label: '1:1 (Square)', value: '1/1' },
            { label: '21:9 (Cinematic)', value: '21/9' }
          ]
        },
        { key: 'rounded', label: 'Rounded Corners', type: 'toggle' },
        { key: 'showShadow', label: 'Drop Shadow Glow', type: 'toggle' }
      ]
    },
    render: (props) => {
      const url = props.url || '';
      const autoplay = props.autoplay ? 1 : 0;
      const muted = (props.muted || props.autoplay) ? 1 : 0;
      const controls = props.controls !== false ? 1 : 0;
      const roundedClass = props.rounded !== false ? 'is-rounded' : '';
      const shadowClass = props.showShadow !== false ? 'has-shadow' : '';

      let embedHtml = '';

      // --- YouTube detection ---
      const ytMatch = url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
      );
      // --- Vimeo detection ---
      const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/);

      if (ytMatch) {
        const videoId = ytMatch[1];
        const src = `https://www.youtube.com/embed/${videoId}?autoplay=${autoplay}&mute=${muted}&controls=${controls}&rel=0&modestbranding=1`;
        embedHtml = `<iframe
            src="${src}"
            title="${props.title || 'YouTube video'}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          ></iframe>`;
      } else if (vimeoMatch) {
        const videoId = vimeoMatch[1];
        const src = `https://player.vimeo.com/video/${videoId}?autoplay=${autoplay}&muted=${muted}&controls=${controls}`;
        embedHtml = `<iframe
            src="${src}"
            title="${props.title || 'Vimeo video'}"
            allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen
          ></iframe>`;
      } else if (url) {
        // Direct video file (.mp4, .webm, .ogg, etc.)
        embedHtml = `<video
            ${controls ? 'controls' : ''}
            ${autoplay ? 'autoplay' : ''}
            ${muted ? 'muted' : ''}
            playsinline
          >
            <source src="${url}" />
            Your browser does not support the video tag.
          </video>`;
      } else {
        embedHtml = `<div class="wb-video-placeholder">
            <div class="wb-video-play-icon">▶</div>
            <p>Paste a YouTube, Vimeo, or video URL in the settings panel.</p>
          </div>`;
      }

      const [arW, arH] = (props.aspectRatio || '16/9').split('/');
      const paddingBottom = ((Number(arH) / Number(arW)) * 100).toFixed(4);

      return `
        <div class="wb-video-widget">
          ${props.title ? `
            <div class="wb-section-heading" style="margin-bottom: 32px;">
              ${props.title ? `<h2 class="wb-section-title">${props.title}</h2>` : ''}
              ${props.subtitle ? `<p class="wb-section-subtitle">${props.subtitle}</p>` : ''}
            </div>
          ` : ''}
          <div class="wb-video-frame-wrapper ${roundedClass} ${shadowClass}">
            <div class="wb-video-aspect" style="padding-bottom: ${paddingBottom}%;">
              ${embedHtml}
            </div>
          </div>
          ${props.showCaption && props.captionText ? `
            <div class="wb-video-caption">${props.captionText}</div>
          ` : ''}
        </div>
      `;
    }
  },

  // 14. PDF VIEWER WIDGET
  pdf_viewer: {
    name: 'PDF Viewer',
    category: 'media',
    icon: '📄',
    description: 'Embed and display PDF documents inline with a native browser viewer',
    defaultProps: {
      url: '',
      title: 'Document Viewer',
      subtitle: 'View and download the document below.',
      height: 680,
      showDownload: true,
      downloadLabel: '⬇ Download PDF',
      showToolbar: true,
      rounded: true,
      showShadow: true
    },
    schema: {
      content: [
        { key: 'url', label: 'PDF URL or Uploaded Asset', type: 'image-picker' },
        { key: 'title', label: 'Section Title', type: 'text' },
        { key: 'subtitle', label: 'Section Subtitle', type: 'textarea' },
        { key: 'showDownload', label: 'Show Download Button', type: 'toggle' },
        { key: 'downloadLabel', label: 'Download Button Text', type: 'text' },
        { key: 'showToolbar', label: 'Show Browser PDF Toolbar', type: 'toggle' }
      ],
      style: [
        { key: 'height', label: 'Viewer Height (px)', type: 'number' },
        { key: 'rounded', label: 'Rounded Corners', type: 'toggle' },
        { key: 'showShadow', label: 'Drop Shadow', type: 'toggle' }
      ]
    },
    render: (props) => {
      const url          = props.url || '';
      const height       = props.height || 680;
      const roundedClass = props.rounded !== false ? 'is-rounded' : '';
      const shadowClass  = props.showShadow !== false ? 'has-shadow' : '';

      let embedHtml = '';
      if (url) {
        const toolbarParam = props.showToolbar !== false ? '1' : '0';
        const sep = url.includes('?') ? '&' : '#';
        const embedUrl = url + sep + 'toolbar=' + toolbarParam;
        embedHtml = `
          <iframe
            src="${embedUrl}"
            title="${props.title || 'PDF Document'}"
            type="application/pdf"
            style="width:100%;height:${height}px;border:none;display:block;"
          ></iframe>
          <div class="wb-pdf-fallback">
            <p>Can't see the PDF? <a href="${url}" target="_blank" rel="noopener">Open in new tab ↗</a></p>
          </div>
        `;
      } else {
        embedHtml = `
          <div class="wb-pdf-placeholder" style="height:${height}px;">
            <div class="wb-pdf-icon">📄</div>
            <p>Select a PDF from your Media Library or paste a URL in the settings panel.</p>
          </div>
        `;
      }

      return `
        <div class="wb-pdf-widget">
          ${props.title ? `
            <div class="wb-section-heading" style="margin-bottom: 28px;">
              ${props.title ? `<h2 class="wb-section-title">${props.title}</h2>` : ''}
              ${props.subtitle ? `<p class="wb-section-subtitle">${props.subtitle}</p>` : ''}
            </div>
          ` : ''}
          <div class="wb-pdf-frame-wrapper ${roundedClass} ${shadowClass}">
            ${embedHtml}
          </div>
          ${props.showDownload && url ? `
            <div class="wb-pdf-actions">
              <a href="${url}" download target="_blank" rel="noopener" class="wb-btn wb-btn-secondary">
                ${props.downloadLabel || '⬇ Download PDF'}
              </a>
            </div>
          ` : ''}
        </div>
      `;
    }
  },

  // 15. FOOTER WIDGET
  footer: {
    name: 'Footer',
    category: 'layout',
    icon: '🔻',
    description: 'Customizable footer with dynamic year, alignment, brand logo, link groups, and copyright toggle',
    defaultProps: {
      globalFooter: false,
      fixedBottom: false,
      showOnlyCopyright: false,
      copyrightAlignment: 'center',
      copyright: '© {year} AetherStudio Inc. All rights reserved.',
      showAdminLogin: true,
      adminLoginText: 'Admin Login',
      logoType: 'icon',
      logoImageUrl: '',
      brandIcon: '⚡',
      brandText: 'AetherStudio',
      brandDesc: 'The next-generation visual web engine empowering designers and developers to build at lightspeed.',
      showColumns: true,
      col1Title: 'Navigation',
      col1Links: 'Features|#features\nStats|#stats\nGallery|#gallery\nShowcase|#slider\nFAQ|#faq',
      col2Title: 'Resources',
      col2Links: 'Documentation|#faq\nPricing Plans|#pricing\nContact Us|#contact',
      col3Title: 'Pages',
      col3Links: 'Home|index.html\nRegistration|?page=registration\nContact|?page=contact-us',
      showBottomLinks: false,
      bottomLinks: 'Privacy Policy|#\nTerms of Service|#\nSecurity Whitepaper|#'
    },
    schema: {
      content: [
        { key: 'globalFooter', label: '🌐 Display Globally Across All Pages', type: 'toggle' },
        { key: 'fixedBottom', label: '📌 Float Fixed at Bottom of Screen', type: 'toggle' },
        { key: 'showOnlyCopyright', label: '⚡ Display Only Copyright Section (Minimal Footer)', type: 'toggle' },
        { key: 'showAdminLogin', label: '🔐 Show Admin Login Link in Footer', type: 'toggle' },
        { key: 'adminLoginText', label: 'Admin Login Link Label', type: 'text' },
        {
          key: 'copyrightAlignment',
          label: 'Copyright Text Alignment',
          type: 'select',
          options: [
            { label: 'Center (Default)', value: 'center' },
            { label: 'Left Aligned', value: 'left' },
            { label: 'Right Aligned', value: 'right' }
          ]
        },
        { key: 'copyright', label: 'Copyright Notice (Use {year} for live year)', type: 'text' },
        {
          key: 'logoType',
          label: 'Brand Logo Mode',
          type: 'select',
          options: [
            { label: 'Emoji / Vector Icon', value: 'icon' },
            { label: 'Custom Logo Image from Library', value: 'image' }
          ]
        },
        { key: 'logoImageUrl', label: 'Brand Logo Image URL', type: 'image-picker' },
        { key: 'brandIcon', label: 'Fallback Icon / Emoji', type: 'text' },
        { key: 'brandText', label: 'Brand Name', type: 'text' },
        { key: 'brandDesc', label: 'Brand Description', type: 'textarea' },
        { key: 'showColumns', label: 'Show Link Columns (in Full Mode)', type: 'toggle' },
        { key: 'col1Title', label: 'Column 1 Title', type: 'text' },
        { key: 'col1Links', label: 'Column 1 Links (One per line: Label|URL)', type: 'textarea' },
        { key: 'col2Title', label: 'Column 2 Title', type: 'text' },
        { key: 'col2Links', label: 'Column 2 Links (One per line: Label|URL)', type: 'textarea' },
        { key: 'col3Title', label: 'Column 3 Title', type: 'text' },
        { key: 'col3Links', label: 'Column 3 Links (One per line: Label|URL)', type: 'textarea' },
        { key: 'showBottomLinks', label: 'Show Bottom Legal Links', type: 'toggle' },
        { key: 'bottomLinks', label: 'Bottom Links (One per line: Label|URL)', type: 'textarea' }
      ]
    },
    render: (props) => {
      // Dynamic live year computation
      const currentYear = new Date().getFullYear();
      let rawCopyright = props.copyright || '© {year} AetherStudio Inc. All rights reserved.';
      if (rawCopyright.includes('{year}') || rawCopyright.includes('{current_year}') || rawCopyright.includes('{YEAR}')) {
        rawCopyright = rawCopyright.replace(/\{year\}|\{current_year\}|\{YEAR\}/g, currentYear);
      } else if (/©\s*(20\d\d)/.test(rawCopyright)) {
        rawCopyright = rawCopyright.replace(/©\s*(20\d\d)/, `© ${currentYear}`);
      }

      const align = (props.copyrightAlignment || 'center').toLowerCase();
      const justifyVal = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

      const parseLinks = (linesText) => {
        if (!linesText) return [];
        return String(linesText)
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean)
          .map(l => {
            const parts = l.split('|');
            const label = parts[0]?.trim() || 'Link';
            const url = parts[1]?.trim() || '#';
            return `<a href="${url}" class="wb-footer-link">${label}</a>`;
          });
      };

      const bottomLinksHtml = props.showBottomLinks && props.bottomLinks
        ? parseLinks(props.bottomLinks).join('')
        : '';

      let bottomRowStyle = '';
      let copyrightWrapStyle = '';

      if (!bottomLinksHtml) {
        // Single copyright notice: align directly to center, left, or right
        bottomRowStyle = `display: flex; align-items: center; justify-content: ${justifyVal}; text-align: ${align}; width: 100%; flex-wrap: wrap; gap: 12px;`;
        copyrightWrapStyle = `display: flex; align-items: center; justify-content: ${justifyVal}; text-align: ${align}; width: 100%; gap: 14px; flex-wrap: wrap;`;
      } else if (align === 'center') {
        // Centered copyright with bottom links: center both stacked
        bottomRowStyle = `display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%; gap: 10px;`;
        copyrightWrapStyle = `display: flex; align-items: center; justify-content: center; text-align: center; width: 100%; gap: 14px; flex-wrap: wrap;`;
      } else if (align === 'right') {
        // Right-aligned copyright with bottom links on left
        bottomRowStyle = `display: flex; align-items: center; justify-content: space-between; text-align: right; width: 100%; flex-wrap: wrap; gap: 12px; flex-direction: row-reverse;`;
        copyrightWrapStyle = `display: flex; align-items: center; justify-content: flex-end; text-align: right; gap: 14px; flex-wrap: wrap;`;
      } else {
        // Left-aligned copyright with bottom links on right
        bottomRowStyle = `display: flex; align-items: center; justify-content: space-between; text-align: left; width: 100%; flex-wrap: wrap; gap: 12px;`;
        copyrightWrapStyle = `display: flex; align-items: center; justify-content: flex-start; text-align: left; gap: 14px; flex-wrap: wrap;`;
      }

      // Admin Login Link in Footer (toggled via props.showAdminLogin)
      const adminLoginHtml = (props.showAdminLogin !== false)
        ? `<a href="?view=admin" class="wb-footer-link wb-footer-admin-link" onclick="event.preventDefault(); if (window.aetherApp) { window.aetherApp.switchToAdmin(); } else { window.location.href='?view=admin'; }" style="display: inline-flex; align-items: center; gap: 5px; color: var(--primary-light, #818cf8); font-weight: 600; text-decoration: none; cursor: pointer; padding: 2px 8px; border-radius: 6px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); font-size: 0.78rem; transition: all 0.2s;" title="Administrative Access"><span>🔐</span><span>${props.adminLoginText || 'Admin Login'}</span></a>`
        : '';

      // Fixed bottom positioning (applied to both footer modes)
      const fixedStyle = props.fixedBottom
        ? 'position: fixed; bottom: 0; left: 0; right: 0; z-index: 900; width: 100%;'
        : '';

      // Height of the footer for spacer (approx)
      const footerHeight = props.fixedBottom
        ? (props.showOnlyCopyright ? '72px' : (props.showColumns !== false ? '320px' : '120px'))
        : '0px';
      const spacerHtml = props.fixedBottom
        ? '<div class="wb-footer-spacer" style="height: ' + footerHeight + '; width: 100%; display: block;"></div>'
        : '';

      // Mode 1: Display ONLY Copyright Section
      if (props.showOnlyCopyright) {
        return spacerHtml + `
          <footer class="wb-footer is-minimal" style="${fixedStyle} padding: 24px 20px; border-top: 1px solid var(--border-subtle); background: rgba(9, 13, 22, 0.7); width: 100%;">
            <div class="wb-footer-bottom" style="margin: 0 auto; border-top: none; padding-top: 0; max-width: 1240px; ${bottomRowStyle}">
              <div style="${copyrightWrapStyle} color: var(--text-dim); font-size: 0.88rem;">
                <span>${rawCopyright}</span>
                ${adminLoginHtml}
              </div>
              ${bottomLinksHtml ? `<div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center; ${align === 'center' ? 'justify-content: center;' : ''}">${bottomLinksHtml}</div>` : ''}
            </div>
          </footer>
        `;
      }

      // Mode 2: Full Multi-Column Footer
      const isImageLogo = (props.logoType === 'image' && props.logoImageUrl) || (props.logoImageUrl && !props.brandIcon);
      const logoHtml = isImageLogo
        ? `<img src="${props.logoImageUrl}" alt="${props.brandText || 'Logo'}" style="max-height: 38px; object-fit: contain; border-radius: 6px;" />`
        : `<span class="brand-icon">${getSafeIcon(props.brandIcon || '⚡', null, '', 'width: 20px; height: 20px; color: #fff;')}</span>`;

      const col1Html = props.col1Links ? parseLinks(props.col1Links).join('') : '';
      const col2Html = props.col2Links ? parseLinks(props.col2Links).join('') : '';
      const col3Html = props.col3Links ? parseLinks(props.col3Links).join('') : '';

      const columnsHtml = props.showColumns !== false ? `
        <div class="wb-footer-col">
          <div class="wb-footer-title">${props.col1Title || 'Navigation'}</div>
          ${col1Html}
        </div>
        <div class="wb-footer-col">
          <div class="wb-footer-title">${props.col2Title || 'Resources'}</div>
          ${col2Html}
        </div>
        <div class="wb-footer-col">
          <div class="wb-footer-title">${props.col3Title || 'Pages'}</div>
          ${col3Html}
        </div>
      ` : '';

      return spacerHtml + `
        <footer class="wb-footer" style="${fixedStyle}">
          <div class="wb-footer-grid" style="${props.showColumns === false ? 'grid-template-columns: 1fr;' : ''}">
            <div class="wb-footer-col">
              <div class="wb-nav-brand" style="margin-bottom: 8px;">
                ${logoHtml}
                <span>${props.brandText || 'AetherStudio'}</span>
              </div>
              <p style="font-size: 0.92rem; line-height: 1.6; max-width: 320px; color: var(--text-muted);">
                ${props.brandDesc || ''}
              </p>
            </div>
            ${columnsHtml}
          </div>
          <div class="wb-footer-bottom" style="${bottomRowStyle}">
            <div style="${copyrightWrapStyle}">
              <span>${rawCopyright}</span>
              ${adminLoginHtml}
            </div>
            ${bottomLinksHtml ? `<div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center; ${align === 'center' ? 'justify-content: center;' : ''}">${bottomLinksHtml}</div>` : ''}
          </div>
        </footer>
      `;
    }
  },

  // 14. CONTACT DETAILS CARDS WIDGET
  contact_cards: {
    name: 'Contact Details Cards',
    category: 'content',
    icon: '📇',
    description: 'Display contact persons with direct 1-click Call, SMS Text, and WhatsApp buttons in responsive cards',
    defaultProps: {
      sectionTitle: 'Key Contacts & Inquiries',
      sectionSubtitle: 'Get in touch directly with our coordinators, officers, and secretariat via phone call or SMS text.',
      columns: '3',
      cardStyle: 'glass',
      fitContentHeight: false,
      paddingTop: '48px',
      paddingBottom: '48px',
      contacts: [
        {
          name: 'Atty. Maria Santos',
          role: 'Secretariat & Registration Head',
          mobile: '+63 917 123 4567',
          email: 'maria.santos@seminar.org',
          avatarUrl: '',
          avatarIcon: '👤',
          callBtnText: 'Call',
          textBtnText: 'Text SMS',
          enableWhatsapp: true,
          whatsappNumber: '639171234567'
        },
        {
          name: 'Engr. David Reyes',
          role: 'Technical & Venue Coordinator',
          mobile: '+63 918 987 6543',
          email: 'david.reyes@seminar.org',
          avatarUrl: '',
          avatarIcon: '📱',
          callBtnText: 'Call',
          textBtnText: 'Text SMS',
          enableWhatsapp: false,
          whatsappNumber: ''
        },
        {
          name: 'Clarisse Gomez',
          role: 'MCLE Accreditation Officer',
          mobile: '+63 920 555 0199',
          email: 'accreditation@seminar.org',
          avatarUrl: '',
          avatarIcon: '⚖️',
          callBtnText: 'Call',
          textBtnText: 'Text SMS',
          enableWhatsapp: true,
          whatsappNumber: '639205550199'
        }
      ]
    },
    schema: {
      content: [
        { key: 'sectionTitle', label: 'Section Title', type: 'text' },
        { key: 'sectionSubtitle', label: 'Section Subtitle', type: 'textarea' },
        {
          key: 'columns',
          label: 'Cards Per Row',
          type: 'select',
          options: [
            { label: '1 Column (Full Width)', value: '1' },
            { label: '2 Columns', value: '2' },
            { label: '3 Columns (Recommended)', value: '3' },
            { label: '4 Columns', value: '4' }
          ]
        },
        {
          key: 'contacts',
          label: 'Contact Cards',
          type: 'repeater',
          fields: [
            { key: 'name', label: 'Contact Name', type: 'text' },
            { key: 'role', label: 'Role / Designation', type: 'text' },
            { key: 'mobile', label: 'Mobile Number', type: 'text' },
            { key: 'email', label: 'Email Address (Optional)', type: 'text' },
            { key: 'avatarUrl', label: 'Photo / Avatar Image URL', type: 'image-picker' },
            { key: 'avatarIcon', label: 'Fallback Icon / Emoji', type: 'text' },
            { key: 'callBtnText', label: 'Call Button Text', type: 'text' },
            { key: 'textBtnText', label: 'Text / SMS Button Text', type: 'text' },
            { key: 'enableWhatsapp', label: 'Enable WhatsApp Button', type: 'toggle' },
            { key: 'whatsappNumber', label: 'WhatsApp Number (Digits only)', type: 'text' }
          ]
        }
      ],
      style: [
        { key: 'fitContentHeight', label: '⚡ Fit to Content Height', type: 'toggle', default: false },
        { key: 'paddingTop', label: 'Padding Top', type: 'text', default: '48px' },
        { key: 'paddingBottom', label: 'Padding Bottom', type: 'text', default: '48px' },
        {
          key: 'cardStyle',
          label: 'Card Theme',
          type: 'select',
          options: [
            { label: 'Glassmorphic Dark Glow', value: 'glass' },
            { label: 'Solid Slate Surface', value: 'solid' },
            { label: 'Neon Glow Outline', value: 'outline' }
          ]
        },
        { key: 'cardSize', label: '📐 Card Size', type: 'select', default: 'full', options: [
          { label: 'Full Width (stretch to fill)', value: 'full' },
          { label: 'Large (max ~480px)', value: 'lg' },
          { label: 'Standard (max ~360px)', value: 'md' },
          { label: 'Small (max ~280px)', value: 'sm' },
          { label: 'Compact (max ~220px)', value: 'xs' }
        ]},
        { key: 'callBtnColor',      label: '📞 Call Button Color',      type: 'color', default: '#10b981' },
        { key: 'smsBtnColor',       label: '💬 SMS / Text Button Color', type: 'color', default: '#6366f1' },
        { key: 'whatsappBtnColor',  label: '🟢 WhatsApp Button Color',  type: 'color', default: '#25d366' }
      ]
    },
    render: (props) => {
      const contacts = props.contacts || [];
      const colClass = `wb-cols-${props.columns || 3}`;
      const styleClass = props.cardStyle === 'solid' ? 'card-solid' : (props.cardStyle === 'outline' ? 'card-outline' : '');
      const isFit = props.fitContentHeight === true;

      // Button colors (with sensible defaults)
      const callColor   = props.callBtnColor     || '#10b981';
      const smsColor    = props.smsBtnColor      || '#6366f1';
      const waColor     = props.whatsappBtnColor || '#25d366';

      // Size class for the grid
      const sizeClass = props.cardSize && props.cardSize !== 'full' ? ` card-size-${props.cardSize}` : '';

      const cleanPhone = (num) => String(num || '').replace(/[^0-9+]/g, '');
      const cleanWa    = (num) => String(num || '').replace(/[^0-9]/g, '');

      const cardsHtml = contacts.map((c) => {
        const phone = cleanPhone(c.mobile);
        const waNum = cleanWa(c.whatsappNumber || c.mobile);
        const avatarHtml = c.avatarUrl
          ? `<img src="${c.avatarUrl}" alt="${c.name || 'Contact'}" class="wb-contact-avatar" />`
          : `<div class="wb-contact-avatar-icon">${c.avatarIcon || '👤'}</div>`;

        return `
          <div class="wb-contact-card ${styleClass}">
            <div class="wb-contact-header">
              ${avatarHtml}
              <div class="wb-contact-meta">
                <h3 class="wb-contact-name">${c.name || 'Contact Name'}</h3>
                ${c.role ? `<span class="wb-contact-role">${c.role}</span>` : ''}
              </div>
            </div>
            <div class="wb-contact-info-list">
              ${c.mobile ? `
                <a href="tel:${phone}" class="wb-contact-info-item" title="Click to call">
                  <span>📞</span>
                  <span><strong>${c.mobile}</strong></span>
                </a>
              ` : ''}
              ${c.email ? `
                <a href="mailto:${c.email}" class="wb-contact-info-item" title="Click to send email">
                  <span>✉️</span>
                  <span>${c.email}</span>
                </a>
              ` : ''}
            </div>
            <div class="wb-contact-actions">
              ${c.mobile ? `
                <a href="tel:${phone}" class="wb-contact-btn wb-btn-call" style="background:linear-gradient(135deg,${callColor},${callColor}cc);box-shadow:0 4px 12px ${callColor}40;" title="Call ${c.name}">
                  <span>📞</span> ${c.callBtnText || 'Call'}
                </a>
                <a href="sms:${phone}" class="wb-contact-btn wb-btn-text" style="background:linear-gradient(135deg,${smsColor},${smsColor}cc);box-shadow:0 4px 12px ${smsColor}40;" title="Send SMS Text">
                  <span>💬</span> ${c.textBtnText || 'Text'}
                </a>
              ` : ''}
              ${c.enableWhatsapp && waNum ? `
                <a href="https://wa.me/${waNum}" target="_blank" rel="noopener" class="wb-contact-btn wb-btn-wa" style="background:${waColor};box-shadow:0 4px 12px ${waColor}40;" title="Chat on WhatsApp">
                  <span>🟢</span> WhatsApp
                </a>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="wb-contact-directory-widget ${isFit ? 'fit-content-height' : ''}">
          ${props.sectionTitle ? `
            <div style="text-align: center; margin-bottom: ${isFit ? '16px' : '36px'};">
              <h2 style="font-size: ${isFit ? '1.8rem' : '2.2rem'}; font-weight: 800; margin-bottom: 8px; color: var(--text-main);">${props.sectionTitle}</h2>
              ${props.sectionSubtitle ? `<p style="font-size: 1.05rem; color: var(--text-muted); max-width: 680px; margin: 0 auto; line-height: 1.6;">${props.sectionSubtitle}</p>` : ''}
            </div>
          ` : ''}
          <div class="wb-contact-grid ${colClass}${sizeClass}">
            ${cardsHtml}
          </div>
        </div>
      `;
    }
  },

  // 15. SEMINAR SCHEDULE DISPLAYER WIDGET
  seminar_schedule: {
    name: 'Seminar Schedule Displayer',
    category: 'content',
    icon: '📅',
    description: 'Dynamic seminar schedule table with Day grouping, paginated slider, and live Google Sheets sync',
    defaultProps: {
      sectionTitle: 'MCLE Seminar & Lecture Schedule',
      sectionSubtitle: 'Comprehensive multi-day schedule with topic outlines, speakers, and accredited subject units.',
      dataSource: 'manual',
      googleSheetUrl: '',
      rowsPerSlide: 4,
      autoSlide: false,
      autoSlideInterval: 5000,
      showDayFilter: true,
      fitContentHeight: false,
      colWidthTime: '20',
      colWidthTopic: '35',
      colWidthLecturer: '25',
      colWidthSubject: '20',
      colAlignTime: 'left',
      colAlignTopic: 'left',
      colAlignLecturer: 'left',
      colAlignSubject: 'left',
      paddingTop: '48px',
      paddingBottom: '48px',
      items: [
        // Day 1
        { day: 'Day 1, February 18, 2026', time: '8:00 am – 10:00 am', topic: 'Living Legal Ethics Part I', lecturer: 'Justice Efren N. Dela Cruz', subjectArea: 'Legal Ethics (2 cu)' },
        { day: 'Day 1, February 18, 2026', time: '10:15 am – 12:15 pm', topic: 'Trial and Pre-Trial in Criminal Case', lecturer: 'Dean Ferdinand A. Tan', subjectArea: 'Trial/Pre-Trial Skills (2 cu)' },
        { day: 'Day 1, February 18, 2026', time: '1:00 pm – 4:00 pm', topic: 'Katarungang Pambarangay Law', lecturer: 'Judge Silvino T. Pampilo, Jr.', subjectArea: 'Alternative Dispute Resolution (3 cu)' },
        { day: 'Day 1, February 18, 2026', time: '4:15 pm – 6:15 pm', topic: 'Updates in Labor Law', lecturer: 'Dean Voltaire T. Duano', subjectArea: 'Updates in Substantive & Procedural Laws (2 cu)' },
        // Day 2
        { day: 'Day 2, February 19, 2026', time: '8:00 am – 10:00 am', topic: 'Living Legal Ethics Part II', lecturer: 'Justice Efren N. Dela Cruz', subjectArea: 'Legal Ethics (2 cu)' },
        { day: 'Day 2, February 19, 2026', time: '10:15 am – 12:15 pm', topic: 'ADR for Practitioners', lecturer: 'Atty. Gerardo F. Lara', subjectArea: 'Alternative Dispute Resolution (2 cu)' },
        { day: 'Day 2, February 19, 2026', time: '1:00 pm – 3:00 pm', topic: 'Effective Legal Writing', lecturer: 'Atty. Edward P. Chico', subjectArea: 'Legal Writing/Oral Advocacy (2 cu)' },
        { day: 'Day 2, February 19, 2026', time: '3:15 pm – 6:15 pm', topic: 'Development in Civil Procedure', lecturer: 'Justice Magdangal M. De Leon', subjectArea: 'MCLE Prescribed (3 cu) Law Reform in Specific Areas of Law' },
        // Day 3
        { day: 'Day 3, February 20, 2026', time: '8:00 am – 10:00 am', topic: 'Rome Statute', lecturer: 'Atty. Hilarion B. Buban', subjectArea: 'International Law (2 cu)' },
        { day: 'Day 3, February 20, 2026', time: '10:15 am – 12:15 pm', topic: 'Oral Advocacy', lecturer: 'Judge Silvino T. Pampilo, Jr.', subjectArea: 'Legal Writing/Oral Advocacy (2 cu)' },
        { day: 'Day 3, February 20, 2026', time: '1:00 pm – 4:00 pm', topic: 'Special Proceedings', lecturer: 'Dean Gemy Lito L. Festin', subjectArea: 'Updates in Substantive and Procedural Law (3 cu)' },
        { day: 'Day 3, February 20, 2026', time: '4:15 pm – 6:15 pm', topic: 'RA 9165: Comprehensive Dangerous Drugs Act of 2002', lecturer: 'Judge Silvino T. Pampilo, Jr.', subjectArea: 'Updates in Substantive and Procedural Law (2 cu)' },
        // Day 4
        { day: 'Day 4, February 21, 2026', time: '8:00 am – 10:00 am', topic: 'Legal Ethics: How to Cross the Line', lecturer: 'Atty. Ferdinand G.S. Gujilde', subjectArea: 'Legal Ethics (2 cu)' },
        { day: 'Day 4, February 21, 2026', time: '10:15 am – 12:15 pm', topic: 'Updates in Election Laws', lecturer: 'Atty. Ferdinand G.S. Gujilde', subjectArea: 'Updates in Substantive and Procedural Law (2 cu)' },
        { day: 'Day 4, February 21, 2026', time: '1:00 pm – 4:00 pm', topic: 'Land Registration and Deeds', lecturer: 'Atty. Robert Nomar V. Leyretana', subjectArea: 'MCLE Prescribed (3 cu) Law Reforms in Specific Areas of Law' },
        { day: 'Day 4, February 21, 2026', time: '4:15 pm – 6:15 pm', topic: 'Trial and Pre-Trial in Civil Case', lecturer: 'Dean Ferdinand A. Tan', subjectArea: 'Trial/Pre-Trial Skills (2 cu)' }
      ]
    },
    schema: {
      content: [
        { key: 'sectionTitle', label: 'Section Title', type: 'text' },
        { key: 'sectionSubtitle', label: 'Section Subtitle', type: 'textarea' },
        {
          key: 'dataSource',
          label: 'Data Source',
          type: 'select',
          options: [
            { label: 'Manual Entries (Below)', value: 'manual' },
            { label: 'Google Sheets (Live Sync via URL)', value: 'google_sheets' }
          ]
        },
        { key: 'googleSheetUrl', label: 'Google Sheets Link / Published CSV URL', type: 'text' },
        {
          key: 'rowsPerSlide',
          label: 'Rows Per Slide / Page',
          type: 'select',
          options: [
            { label: '1 Row per slide', value: 1 },
            { label: '2 Rows per slide', value: 2 },
            { label: '3 Rows per slide', value: 3 },
            { label: '4 Rows per slide (Recommended)', value: 4 },
            { label: '5 Rows per slide', value: 5 },
            { label: '6 Rows per slide', value: 6 },
            { label: '8 Rows per slide', value: 8 },
            { label: 'All Rows (No Slider)', value: 999 }
          ]
        },
        { key: 'autoSlide', label: 'Enable Auto-Slide Carousel', type: 'toggle' },
        { key: 'autoSlideInterval', label: 'Auto-Slide Interval (ms)', type: 'number' },
        { key: 'showDayFilter', label: 'Show Quick Day Filter Tabs', type: 'toggle' },
        {
          key: 'items',
          label: 'Schedule Rows (Manual Mode)',
          type: 'repeater',
          fields: [
            { key: 'day', label: 'Day / Date Heading', type: 'text' },
            { key: 'time', label: 'Time (e.g. 8:00 am – 10:00 am)', type: 'text' },
            { key: 'topic', label: 'Topic / Session Name', type: 'text' },
            { key: 'lecturer', label: 'Lecturer / Speaker Name', type: 'text' },
            { key: 'subjectArea', label: 'MCLE Subject Area & Units', type: 'text' }
          ]
        }
      ],
      style: [
        { key: 'fitContentHeight', label: '⚡ Fit to Content Height', type: 'toggle', default: false },
        {
          key: 'mobileCardMode',
          label: 'Mobile View Layout',
          type: 'select',
          options: [
            { label: 'Smart Mobile Cards (Recommended)', value: 'cards' },
            { label: 'Horizontal Scroll Table', value: 'table' }
          ]
        },
        { key: 'colWidthTime', label: '📐 Time Column Width (%)', type: 'text', default: '20' },
        { key: 'colWidthTopic', label: '📐 Topic Column Width (%)', type: 'text', default: '35' },
        { key: 'colWidthLecturer', label: '📐 Lecturer Column Width (%)', type: 'text', default: '25' },
        { key: 'colWidthSubject', label: '📐 Subject Column Width (%)', type: 'text', default: '20' },
        { key: 'colAlignTime', label: '↔️ Time Column Align', type: 'select', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] },
        { key: 'colAlignTopic', label: '↔️ Topic Column Align', type: 'select', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] },
        { key: 'colAlignLecturer', label: '↔️ Lecturer Column Align', type: 'select', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] },
        { key: 'colAlignSubject', label: '↔️ Subject Column Align', type: 'select', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] },
        { key: 'paddingTop', label: 'Padding Top', type: 'text', default: '48px' },
        { key: 'paddingBottom', label: 'Padding Bottom', type: 'text', default: '48px' }
      ]
    },
    render: (props) => {
      const items = props.items || [];
      const rowsPerSlide = parseInt(props.rowsPerSlide, 10) || 4;
      const autoPlay = props.autoSlide === true;
      const interval = parseInt(props.autoSlideInterval, 10) || 5000;
      const isGoogleSheet = props.dataSource === 'google_sheets' && props.googleSheetUrl;
      const isFit = props.fitContentHeight === true;

      // Column widths from admin settings (default: 20/35/25/20)
      const wTime = parseInt(props.colWidthTime, 10) || 20;
      const wTopic = parseInt(props.colWidthTopic, 10) || 35;
      const wLecturer = parseInt(props.colWidthLecturer, 10) || 25;
      const wSubject = parseInt(props.colWidthSubject, 10) || 20;

      // Column text alignment from admin settings (default: left)
      const aTime = props.colAlignTime || 'left';
      const aTopic = props.colAlignTopic || 'left';
      const aLecturer = props.colAlignLecturer || 'left';
      const aSubject = props.colAlignSubject || 'left';

      // Slice items into chunks of rowsPerSlide
      const slides = [];
      for (let i = 0; i < items.length; i += rowsPerSlide) {
        slides.push(items.slice(i, i + rowsPerSlide));
      }
      if (slides.length === 0) slides.push([]);

      const totalSlides = slides.length;

      // Extract unique days for tabs
      const uniqueDays = [...new Set(items.map((it) => it.day).filter(Boolean))];
      const tabsHtml = props.showDayFilter !== false && uniqueDays.length > 1
        ? `
          <div class="wb-schedule-day-tabs">
            <button class="wb-schedule-day-tab active" data-day="all">All Sessions</button>
            ${uniqueDays.map((d) => `<button class="wb-schedule-day-tab" data-day="${d}">${d}</button>`).join('')}
          </div>
        `
        : '';

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
              <table class="wb-schedule-table ${isFit ? 'is-compact' : ''}">
                <thead>
                  <tr>
                    <th style="width: ${wTime}%;">Time</th>
                    <th style="width: ${wTopic}%;">Topic / Session</th>
                    <th style="width: ${wLecturer}%;">Lecturer / Speaker</th>
                    <th style="width: ${wSubject}%;">MCLE Subject Area</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || '<tr><td colspan="4" style="text-align:center;color:var(--text-dim);">No sessions scheduled</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }).join('');

      const dotsHtml = slides.map((_, i) => `<span class="wb-schedule-dot ${i === 0 ? 'active' : ''}" data-slide="${i}"></span>`).join('');

      return `
        <div class="wb-schedule-widget ${isFit ? 'fit-content-height' : ''} ${props.mobileCardMode !== 'table' ? 'wb-schedule-mobile-cards' : ''}"
             data-source="${props.dataSource || 'manual'}"
             data-sheet-url="${props.googleSheetUrl || ''}"
             data-rows-per-slide="${rowsPerSlide}"
             data-autoplay="${autoPlay}"
             data-interval="${interval}"
             data-col-w-time="${wTime}"
             data-col-w-topic="${wTopic}"
             data-col-w-lecturer="${wLecturer}"
             data-col-w-subject="${wSubject}"
             data-col-a-time="${aTime}"
             data-col-a-topic="${aTopic}"
             data-col-a-lecturer="${aLecturer}"
             data-col-a-subject="${aSubject}">
          <div class="wb-schedule-topbar">
            <div class="wb-schedule-title-area">
              <h2>${props.sectionTitle || 'Seminar Schedule'}</h2>
              ${props.sectionSubtitle ? `<p>${props.sectionSubtitle}</p>` : ''}
            </div>
            ${isGoogleSheet ? `
              <div class="wb-schedule-sync-badge">
                <span>🔄</span> Live Google Sheets Sync
              </div>
            ` : ''}
          </div>

          ${tabsHtml}

          <div class="wb-schedule-slider-track-wrap">
            <div class="wb-schedule-slider-track">
              ${slidesHtml}
            </div>
          </div>

          ${totalSlides > 1 ? `
            <div class="wb-schedule-footer">
              <div class="wb-schedule-nav-btns">
                <button class="wb-schedule-nav-btn prev" aria-label="Previous page">❮ Prev</button>
                <button class="wb-schedule-nav-btn next" aria-label="Next page">Next ❯</button>
              </div>
              <div class="wb-schedule-dots">
                ${dotsHtml}
              </div>
              <div class="wb-schedule-page-info">
                Page 1 of ${totalSlides} (${items.length} sessions)
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }
  },

  // 16. PAYMENT OPTIONS & BANK DETAILS WIDGET
  payment_options: {
    name: 'Payment & Bank Options',
    category: 'content',
    icon: '💳',
    description: 'Display payment channels (GCash, BPI, BDO, etc.) with account details, 1-click copy, and QR codes',
    defaultProps: {
      sectionTitle: 'Official Payment Channels',
      sectionSubtitle: 'Please deposit your seminar registration fees to any of our accredited university bank and e-wallet accounts below.',
      noticeText: 'IMPORTANT: After completing payment, please save your transaction reference number and upload a clear screenshot or photo of your deposit slip or transfer confirmation on the registration form.',
      columns: '3',
      fitContentHeight: false,
      paddingTop: '48px',
      paddingBottom: '48px',
      channels: [
        {
          type: 'gcash',
          channelName: 'GCash e-Wallet',
          accountName: 'Sample Organization Name',
          accountNumber: '0917 123 4567',
          branchOrNote: 'Verified Merchant / Scan to Pay',
          qrImageUrl: '',
          feeNote: 'Zero transfer fee via GCash'
        },
        {
          type: 'bpi',
          channelName: 'BPI (Bank of the Philippine Islands)',
          accountName: 'Sample Organization Name',
          accountNumber: '1234-5678-90',
          branchOrNote: 'Cebu Lahug Branch (Current Account)',
          qrImageUrl: '',
          feeNote: 'Online Banking / Over-the-Counter'
        },
        {
          type: 'bdo',
          channelName: 'BDO Unibank',
          accountName: 'Sample Foundation Inc.',
          accountNumber: '0098-7654-3210',
          branchOrNote: 'Gorordo Avenue Branch (Savings Account)',
          qrImageUrl: '',
          feeNote: 'BDO Pay / Online Banking / Branch Deposit'
        }
      ]
    },
    schema: {
      content: [
        { key: 'sectionTitle', label: 'Section Title', type: 'text' },
        { key: 'sectionSubtitle', label: 'Section Subtitle', type: 'textarea' },
        { key: 'noticeText', label: 'Payment Notice / Instructions', type: 'textarea' },
        {
          key: 'columns',
          label: 'Cards Per Row',
          type: 'select',
          options: [
            { label: '1 Column', value: '1' },
            { label: '2 Columns', value: '2' },
            { label: '3 Columns (Recommended)', value: '3' },
            { label: '4 Columns', value: '4' }
          ]
        },
        {
          key: 'channels',
          label: 'Payment Channels & Accounts',
          type: 'repeater',
          fields: [
            {
              key: 'type',
              label: 'Channel / Bank Type',
              type: 'select',
              options: [
                { label: 'GCash e-Wallet', value: 'gcash' },
                { label: 'BPI (Bank of the Philippine Islands)', value: 'bpi' },
                { label: 'BDO Unibank', value: 'bdo' },
                { label: 'Maya (PayMaya)', value: 'maya' },
                { label: 'UnionBank of the Philippines', value: 'unionbank' },
                { label: 'Metrobank', value: 'metrobank' },
                { label: 'Other Commercial Bank / General', value: 'bank' }
              ]
            },
            { key: 'channelName', label: 'Display Name', type: 'text' },
            { key: 'accountName', label: 'Account Name', type: 'text' },
            { key: 'accountNumber', label: 'Account / Mobile Number', type: 'text' },
            { key: 'branchOrNote', label: 'Branch / Account Type / Note', type: 'text' },
            { key: 'qrImageUrl', label: 'QR Code Image URL (Optional)', type: 'image-picker' },
            { key: 'feeNote', label: 'Transfer Note / Fee Info', type: 'text' }
          ]
        }
      ],
      style: [
        { key: 'fitContentHeight', label: '⚡ Fit to Content Height', type: 'toggle', default: false },
        { key: 'paddingTop', label: 'Padding Top', type: 'text', default: '48px' },
        { key: 'paddingBottom', label: 'Padding Bottom', type: 'text', default: '48px' }
      ]
    },
    render: (props) => {
      const channels = props.channels || [];
      const colClass = `wb-cols-${props.columns || 3}`;
      const isFit = props.fitContentHeight === true;

      const getChannelIcon = (type) => {
        switch (type) {
          case 'gcash':
            return `
              <div class="wb-pay-icon wb-icon-gcash" style="width: 44px; height: 44px; border-radius: 50%; background: #005ce6; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0, 92, 230, 0.35); flex-shrink: 0;">
                <svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#005ce6"/><path d="M24 10a14 14 0 1 0 14 14h-5a9 9 0 1 1-9-9c2.4 0 4.6.9 6.2 2.5l3.5-3.5A13.9 13.9 0 0 0 24 10z" fill="#fff"/><circle cx="28" cy="24" r="3.5" fill="#fff"/></svg>
              </div>
            `;
          case 'bpi':
            return `
              <div class="wb-pay-icon wb-icon-bpi" style="width: 44px; height: 44px; border-radius: 50%; background: #b91c1c; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(185, 28, 28, 0.35); flex-shrink: 0;">
                <svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#b91c1c"/><text x="24" y="30" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="900" font-size="14" fill="#fff" text-anchor="middle" letter-spacing="1">BPI</text></svg>
              </div>
            `;
          case 'bdo':
            return `
              <div class="wb-pay-icon wb-icon-bdo" style="width: 44px; height: 44px; border-radius: 50%; background: #002060; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0, 32, 96, 0.35); flex-shrink: 0; border: 1.5px solid #ffc000;">
                <svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#002060"/><text x="24" y="27" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="900" font-size="14" fill="#fff" text-anchor="middle">BDO</text><rect x="14" y="30" width="20" height="3" rx="1.5" fill="#ffc000"/></svg>
              </div>
            `;
          case 'maya':
            return `
              <div class="wb-pay-icon wb-icon-maya" style="width: 44px; height: 44px; border-radius: 50%; background: #00d632; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0, 214, 50, 0.35); flex-shrink: 0;">
                <svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#00d632"/><text x="24" y="29" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="900" font-size="12" fill="#090d16" text-anchor="middle">maya</text></svg>
              </div>
            `;
          case 'unionbank':
            return `
              <div class="wb-pay-icon wb-icon-unionbank" style="width: 44px; height: 44px; border-radius: 50%; background: #f37021; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(243, 112, 33, 0.35); flex-shrink: 0;">
                <svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#f37021"/><text x="24" y="30" font-family="Arial, sans-serif" font-weight="900" font-size="15" fill="#fff" text-anchor="middle">UB</text></svg>
              </div>
            `;
          case 'metrobank':
            return `
              <div class="wb-pay-icon wb-icon-metrobank" style="width: 44px; height: 44px; border-radius: 50%; background: #003882; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0, 56, 130, 0.35); flex-shrink: 0;">
                <svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="22" fill="#003882"/><text x="24" y="30" font-family="Arial, sans-serif" font-weight="900" font-size="14" fill="#fff" text-anchor="middle">MB</text></svg>
              </div>
            `;
          default:
            return `
              <div class="wb-pay-icon wb-icon-bank" style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--primary, #6366f1), var(--secondary, #ec4899)); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px var(--primary-glow, rgba(99, 102, 241, 0.35)); flex-shrink: 0;">
                <span style="font-size: 1.4rem;">🏦</span>
              </div>
            `;
        }
      };

      const cardsHtml = channels.map((ch) => {
        const iconHtml = getChannelIcon(ch.type);
        const qrHtml = ch.qrImageUrl ? `
          <div class="wb-pay-qr-inline">
            <div class="wb-pay-qr-label">📱 Scan to Pay</div>
            <div class="wb-pay-qr-img-wrap">
              <img src="${ch.qrImageUrl}" alt="QR Code for ${ch.channelName || 'payment'}" class="wb-pay-qr-img" />
            </div>
          </div>
        ` : '';

        return `
          <div class="wb-pay-card">
            <div>
              <div class="wb-pay-header">
                ${iconHtml}
                <div style="flex: 1; min-width: 0;">
                  <h3 class="wb-pay-channel-name">${ch.channelName || 'Payment Channel'}</h3>
                  ${ch.feeNote ? `<div class="wb-pay-channel-note">${ch.feeNote}</div>` : ''}
                </div>
              </div>
              <div class="wb-pay-details">
                <div>
                  <div class="wb-pay-acc-label">ACCOUNT NAME:</div>
                  <div class="wb-pay-acc-name">${ch.accountName || 'Organization Account'}</div>
                </div>
                <div>
                  <div class="wb-pay-acc-label">ACCOUNT / MOBILE NUMBER:</div>
                  <div class="wb-pay-acc-box">
                    <span class="wb-pay-acc-num">${ch.accountNumber || 'N/A'}</span>
                    <button type="button" class="wb-pay-copy-btn" data-copy="${ch.accountNumber || ''}" title="Click to copy account number">
                      <span class="copy-icon">📋</span> <span class="copy-text">Copy</span>
                    </button>
                  </div>
                </div>
                ${ch.branchOrNote ? `
                  <div class="wb-pay-branch">
                    <span>🏢</span> <span>${ch.branchOrNote}</span>
                  </div>
                ` : ''}
              </div>
            </div>
            ${qrHtml}
          </div>
        `;
      }).join('');

      return `
        <div class="wb-payments-widget ${isFit ? 'fit-content-height' : ''}">
          ${props.sectionTitle ? `
            <div style="text-align: center; margin-bottom: ${isFit ? '16px' : '36px'};">
              <h2 style="font-size: ${isFit ? '1.8rem' : '2.2rem'}; font-weight: 800; margin-bottom: 8px; color: var(--text-main);">${props.sectionTitle}</h2>
              ${props.sectionSubtitle ? `<p style="font-size: 1.05rem; color: var(--text-muted); max-width: 680px; margin: 0 auto; line-height: 1.6;">${props.sectionSubtitle}</p>` : ''}
            </div>
          ` : ''}
          <div class="wb-payments-grid ${colClass}">
            ${cardsHtml}
          </div>
          ${props.noticeText ? `
            <div class="wb-pay-notice-box">
              <span style="font-size: 1.3rem; flex-shrink: 0;">⚠️</span>
              <div>${props.noticeText}</div>
            </div>
          ` : ''}
        </div>
      `;
    }
  },

  // 18. LECTURER PROFILE GALLERY WIDGET
  lecturer_gallery: {
    name: 'Lecturer Gallery',
    category: 'content',
    icon: '🎓',
    description: 'Showcase lecturer profiles in Gallery, List, or Slider view with search and click-to-view detail',
    defaultProps: {
      sectionTitle: 'Our Lecturers',
      sectionSubtitle: 'Meet the experts behind our programs',
      viewMode: 'gallery',
      columns: 3,
      slidesPerView: 3,
      autoPlay: false,
      autoPlaySpeed: 4,
      showSearch: true,
      cardStyle: 'modern',
      modalListPosition: 'left',
      dataSource: 'manual',
      googleSheetUrl: '',
      lecturers: [
        { name: 'Dr. Maria Santos', photoUrl: '', topics: 'Data Science, Machine Learning', summary: 'An expert in AI and data-driven solutions with over 15 years of experience in academia and industry.' },
        { name: 'Prof. James Rivera', photoUrl: '', topics: 'Web Development, Cloud Computing', summary: 'Full-stack architect specializing in modern JavaScript frameworks and scalable cloud infrastructure.' },
        { name: 'Dr. Angela Cruz', photoUrl: '', topics: 'Cybersecurity, Networking', summary: 'Certified ethical hacker and networking specialist. Published researcher in zero-trust security models.' },
        { name: 'Prof. Ricardo Lim', photoUrl: '', topics: 'Database Systems, Big Data', summary: 'Database architect with deep expertise in distributed systems and real-time analytics platforms.' },
        { name: 'Dr. Sofia Reyes', photoUrl: '', topics: 'UI/UX Design, Human-Computer Interaction', summary: 'Award-winning designer focused on accessible, user-centered digital experiences.' },
        { name: 'Prof. Daniel Park', photoUrl: '', topics: 'Mobile Development, IoT', summary: 'Pioneer in cross-platform mobile frameworks and Internet of Things ecosystems for smart campuses.' }
      ]
    },
    schema: {
      content: [
        { key: 'sectionTitle', label: '📝 Section Title', type: 'text' },
        { key: 'sectionSubtitle', label: '📄 Section Subtitle', type: 'textarea' },
        {
          key: 'dataSource',
          label: '📊 Data Source',
          type: 'select',
          options: [
            { label: 'Manual Entry (Inspector Profiles)', value: 'manual' },
            { label: 'Google Sheets (Live Sync via URL)', value: 'google_sheets' }
          ]
        },
        {
          key: 'googleSheetUrl',
          label: '🔗 Google Sheets Public Link / CSV',
          type: 'text'
        },
        {
          key: 'viewMode',
          label: '🖼️ Display Mode',
          type: 'select',
          options: [
            { label: 'Gallery Grid', value: 'gallery' },
            { label: 'List View (Searchable)', value: 'list' },
            { label: 'Slider / Carousel', value: 'slider' }
          ]
        },
        {
          key: 'lecturers',
          label: '👨‍🏫 Lecturer Profiles',
          type: 'repeater',
          fields: [
            { key: 'photoUrl', label: 'Profile Photo', type: 'image-picker' },
            { key: 'name', label: 'Full Name', type: 'text' },
            { key: 'topics', label: 'Topics / Specializations (comma-separated)', type: 'text' },
            { key: 'summary', label: 'Profile Summary', type: 'textarea' }
          ]
        }
      ],
      style: [
        {
          key: 'columns',
          label: '📊 Gallery Columns',
          type: 'select',
          options: [
            { label: '2 Columns', value: 2 },
            { label: '3 Columns', value: 3 },
            { label: '4 Columns', value: 4 }
          ]
        },
        {
          key: 'slidesPerView',
          label: '🎞️ Slides Per View (Slider Mode)',
          type: 'select',
          options: [
            { label: '1 Slide', value: 1 },
            { label: '2 Slides', value: 2 },
            { label: '3 Slides', value: 3 },
            { label: '4 Slides', value: 4 }
          ]
        },
        { key: 'autoPlay', label: '▶️ Auto-Play Slider', type: 'toggle', default: false },
        { key: 'autoPlaySpeed', label: '⏱️ Auto-Play Interval (seconds)', type: 'number', default: 4 },
        { key: 'showSearch', label: '🔍 Show Search Bar (List Mode)', type: 'toggle', default: true },
        {
          key: 'cardStyle',
          label: '🎨 Card Style',
          type: 'select',
          options: [
            { label: 'Modern Glass', value: 'modern' },
            { label: 'Minimal Clean', value: 'minimal' },
            { label: 'Bold Accent', value: 'bold' }
          ]
        },
        {
          key: 'modalListPosition',
          label: '🧭 Modal Speaker List Position',
          type: 'select',
          options: [
            { label: 'Left Side (Default)', value: 'left' },
            { label: 'Right Side', value: 'right' }
          ]
        }
      ]
    },
    render: (props) => {
      const lecturers = props.lecturers || [];
      const mode = props.viewMode || 'gallery';
      const cols = parseInt(props.columns) || 3;
      const spv = parseInt(props.slidesPerView) || 3;
      const autoPlay = props.autoPlay;
      const autoSpeed = (parseInt(props.autoPlaySpeed) || 4) * 1000;
      const showSearch = props.showSearch !== false;
      const cardStyle = props.cardStyle || 'modern';
      const uid = 'lg-' + Math.random().toString(36).slice(2, 8);

      const isGoogleSheet = props.dataSource === 'google_sheets' && props.googleSheetUrl;

      if (lecturers.length === 0 && !isGoogleSheet) {
        return `
          <div class="wb-lg-empty">
            <div style="font-size:2.5rem;margin-bottom:12px;">🎓</div>
            <div style="font-weight:600;font-size:1rem;color:#e2e8f0;">No Lecturers Added Yet</div>
            <div style="font-size:0.85rem;color:#64748b;margin-top:6px;">Add lecturer profiles in the inspector panel or link a Google Sheet</div>
          </div>
        `;
      }

      // Helper: render a single profile card
      const renderCard = (l, idx) => {
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
      };

      // Section header
      const headerHtml = `
        <div class="wb-lg-header">
          ${props.sectionTitle ? `<h2 class="wb-lg-title">${props.sectionTitle}</h2>` : ''}
          ${props.sectionSubtitle ? `<p class="wb-lg-subtitle">${props.sectionSubtitle}</p>` : ''}
          ${isGoogleSheet ? `
            <div style="margin-top: 10px; display: flex; justify-content: center;">
              <span class="wb-lg-sync-badge">
                <span>🔄</span> Live Google Sheets Sync
              </span>
            </div>
          ` : ''}
        </div>
      `;

      // Build hidden profile modal data
      const profilesData = lecturers.map(l => ({
        name: l.name || 'Unnamed',
        photoUrl: l.photoUrl || '',
        topics: l.topics || '',
        summary: l.summary || 'No profile summary available.'
      }));

      let bodyHtml = '';

      if (lecturers.length === 0) {
        bodyHtml = `
          <div class="wb-lg-loading-placeholder" style="text-align: center; padding: 48px 20px; color: #94a3b8; background: rgba(15, 23, 42, 0.4); border-radius: 12px; border: 1px dashed rgba(255, 255, 255, 0.1);">
            <div style="font-size: 2rem; margin-bottom: 10px;">⏳</div>
            <div style="font-weight: 700; font-size: 1.05rem; color: #e2e8f0;">Connecting to Google Sheet...</div>
            <p style="font-size: 0.85rem; margin-top: 6px; color: #94a3b8;">Loading live speaker profiles from linked sheet.</p>
          </div>
        `;
      } else if (mode === 'gallery') {
        bodyHtml = `
          <div class="wb-lg-grid wb-lg-grid--${cols}">
            ${lecturers.map((l, i) => renderCard(l, i)).join('')}
          </div>
        `;
      }

      // ── LIST MODE ──
      else if (mode === 'list') {
        const searchBar = showSearch ? `
          <div class="wb-lg-search-bar">
            <input type="text" class="wb-lg-search-input" data-lg-uid="${uid}" placeholder="🔍  Search by name or topic..." />
          </div>
        ` : '';
        const rows = lecturers.map((l, i) => {
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
        bodyHtml = `${searchBar}<div class="wb-lg-list" data-lg-uid="${uid}">${rows}</div>`;
      }

      // ── SLIDER MODE ──
      else if (mode === 'slider') {
        const slideWidth = 100 / spv;
        const slides = lecturers.map((l, i) =>
          `<div class="wb-lg-slide" style="min-width:${slideWidth}%;max-width:${slideWidth}%;">${renderCard(l, i)}</div>`
        ).join('');
        bodyHtml = `
          <div class="wb-lg-slider-wrap" data-lg-uid="${uid}">
            <button class="wb-lg-slider-btn wb-lg-slider-prev" data-lg-uid="${uid}" data-dir="-1">‹</button>
            <div class="wb-lg-slider-viewport">
              <div class="wb-lg-slider-track" data-lg-uid="${uid}" data-spv="${spv}" data-total="${lecturers.length}"
                   style="width:${(lecturers.length / spv) * 100}%;transition:transform 0.45s cubic-bezier(.25,.8,.25,1);">
                ${slides}
              </div>
            </div>
            <button class="wb-lg-slider-btn wb-lg-slider-next" data-lg-uid="${uid}" data-dir="1">›</button>
          </div>
          <div class="wb-lg-slider-dots" data-lg-uid="${uid}">
            ${Array.from({ length: Math.ceil(lecturers.length / spv) }, (_, i) =>
              `<span class="wb-lg-dot${i === 0 ? ' active' : ''}" data-slide="${i}" data-lg-uid="${uid}"></span>`
            ).join('')}
          </div>
        `;
      }

      const encodedLecturers = encodeURIComponent(JSON.stringify(lecturers));
      const modalListPos = props.modalListPosition || 'left';

      return `
        <div class="wb-lg-section" data-lg-uid="${uid}" 
             data-lecturers="${encodedLecturers}" 
             data-modal-list-pos="${modalListPos}"
             data-data-source="${props.dataSource || 'manual'}"
             data-sheet-url="${props.googleSheetUrl || ''}"
             data-autoplay="${autoPlay ? 'true' : 'false'}" 
             data-autoplay-speed="${props.autoPlaySpeed || 4}">
          ${headerHtml}
          ${bodyHtml}
        </div>
      `;
    }
  },

  // 17. CUSTOM HTML / EMBED WIDGET
  custom_html: {
    name: 'Custom HTML / Embed',
    category: 'advanced',
    icon: '🛠️',
    description: 'Inject custom HTML, CSS, JavaScript, or third-party embed codes (maps, forms, widgets) safely in an isolated block',
    defaultProps: {
      htmlCode: '<!-- Paste your HTML, iframe, or embed code here -->\n<div style="padding: 24px; border: 2px dashed rgba(99,102,241,0.4); border-radius: 12px; text-align: center; color: #a5b4fc;">\n  <p style="margin: 0; font-size: 1rem;">✏️ Custom HTML Block — edit in the inspector panel</p>\n</div>',
      cssCode: '',
      label: 'Custom HTML Block',
      paddingTop: '0px',
      paddingBottom: '0px',
      fitContentHeight: true,
      wrapInContainer: false,
      previewInAdmin: false
    },
    schema: {
      content: [
        { key: 'label', label: '🏷️ Block Label (internal, not shown publicly)', type: 'text' },
        { key: 'htmlCode', label: '💻 HTML / Embed Code', type: 'code', rows: 14 },
        { key: 'cssCode', label: '🎨 Custom CSS (scoped to this block, optional)', type: 'code', rows: 6 },
        { key: 'wrapInContainer', label: 'Wrap in centered content container', type: 'toggle' }
      ],
      style: [
        { key: 'previewInAdmin', label: '👁️ Live Preview in Admin Canvas', type: 'toggle', default: false },
        { key: 'fitContentHeight', label: '⚡ Fit to Content Height', type: 'toggle', default: true },
        { key: 'paddingTop', label: 'Padding Top', type: 'text', default: '0px' },
        { key: 'paddingBottom', label: 'Padding Bottom', type: 'text', default: '0px' }
      ]
    },
    render: (props, context) => {
      const isPublic = (context && typeof context.isPublicMode === 'boolean')
        ? context.isPublicMode
        : (typeof window !== 'undefined' && (
            window.app?.viewMode === 'public' ||
            (!new URLSearchParams(window.location.search).get('view')?.includes('admin') &&
             !window.location.pathname.endsWith('admin.html') &&
             !document.querySelector('.builder-shell'))
          ));

      // In admin builder without live preview toggle: display property settings and code card
      if (!isPublic && !props.previewInAdmin) {
        const rawCode = props.htmlCode || '';
        const lines = rawCode ? rawCode.split('\n').length : 0;
        const chars = rawCode.length;
        const previewSnippet = rawCode
          ? rawCode
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
          : '<span style="color:#64748b;font-style:italic;">(No HTML code entered yet — configure in inspector)</span>';
        const label = props.label || 'Custom HTML / Embed';
        const pTop = props.paddingTop || '0px';
        const pBottom = props.paddingBottom || '0px';

        return `
          <div class="wb-custom-html-admin-card" style="margin-top: ${pTop}; margin-bottom: ${pBottom};">
            <div class="wb-custom-html-admin-header">
              <div class="wb-custom-html-admin-title">
                <span class="wb-custom-html-admin-icon">🛠️</span>
                <span class="wb-custom-html-admin-name">${label}</span>
                <span class="wb-custom-html-admin-badge">Admin Settings View</span>
              </div>
              <div class="wb-custom-html-admin-stats">
                <span>📄 ${lines} line${lines === 1 ? '' : 's'}</span>
                <span>🔡 ${chars} chars</span>
              </div>
            </div>
            <div class="wb-custom-html-admin-props">
              <div class="wb-custom-html-admin-prop-item"><strong>Centered Container:</strong> ${props.wrapInContainer ? 'Yes' : 'No'}</div>
              <div class="wb-custom-html-admin-prop-item"><strong>Padding:</strong> Top ${pTop} / Bottom ${pBottom}</div>
              <div class="wb-custom-html-admin-prop-item"><strong>Fit Height:</strong> ${props.fitContentHeight !== false ? 'Yes' : 'No'}</div>
              ${props.cssCode ? `<div class="wb-custom-html-admin-prop-item"><strong>Scoped CSS:</strong> ${props.cssCode.length} chars</div>` : ''}
            </div>
            <div class="wb-custom-html-admin-code">
              <code>${previewSnippet}</code>
            </div>
            <div class="wb-custom-html-admin-footer">
              <span>🌐 <strong>Live UI displays only when published.</strong> To preview live inside the admin canvas, turn on <em>"Live Preview in Admin Canvas"</em> in Style tab.</span>
            </div>
          </div>
        `;
      }

      // Published live site or Admin live preview mode
      const blockId = `wb-custom-html-${Math.random().toString(36).slice(2, 8)}`;
      const isFit = props.fitContentHeight !== false;
      const containerStyle = `padding-top: ${props.paddingTop || '0px'}; padding-bottom: ${props.paddingBottom || '0px'};`;

      const scopedCss = props.cssCode
        ? `<style>#${blockId} { ${props.cssCode} }</style>`
        : '';

      const innerHtml = props.htmlCode || '';
      const wrapped = props.wrapInContainer
        ? `<div class="wb-custom-inner" style="max-width: 1200px; margin: 0 auto; width: 100%; box-sizing: border-box;">${innerHtml}</div>`
        : innerHtml;

      return `
        <div class="wb-custom-html-block" id="${blockId}" style="${containerStyle} width: 100%; box-sizing: border-box; overflow: hidden;">
          ${scopedCss}
          ${wrapped}
        </div>
      `;
    }
  },

  // 17. REGISTRATION & LEAD CAPTURE FORM
  registration_form: {
    name: 'Registration Form',
    category: 'content',
    icon: '📝',
    description: 'Fully dynamic form — add/remove any fields, connect to Google Sheets, and track leads in your inbox',
    defaultProps: {
      formTitle: 'Official MCLE Seminar Registration',
      formSubtitle: 'Complete the form below to secure your accredited credit units and reserve your seminar slot.',
      badgeText: 'ONLINE REGISTRATION',
      submitBtnText: 'Submit Registration Form',
      successMessage: '🎉 Thank you! Your registration has been submitted. Our secretariat will verify your payment and email your confirmation slip.',
      cardStyle: 'glass',
      btnStyle: 'primary',
      accentColor: '#6366f1',
      googleSheetUrl: '',
      gsheetExcludeSummary: true,
      gsheetExcludeMeta: true,
      gsheetExcludeHidden: true,
      fields: [
        { id: 'fullName',   label: 'Full Name (Attorney / Delegate)', type: 'text',     placeholder: 'Atty. Juan Dela Cruz',        required: true,  width: 'full' },
        { id: 'email',      label: 'Email Address',                   type: 'email',    placeholder: 'lawyer@example.com',          required: true,  width: 'half' },
        { id: 'mobile',     label: 'Mobile / Contact Number',         type: 'tel',      placeholder: '0917 123 4567',               required: true,  width: 'half' },
        { id: 'rollNumber', label: 'Roll of Attorneys No.',           type: 'text',     placeholder: 'e.g. 12345',                  required: false, width: 'half' },
        { id: 'ibpChapter', label: 'IBP Chapter',                     type: 'text',     placeholder: 'e.g. Cebu Chapter',           required: false, width: 'half' },
        { id: 'package',    label: 'Seminar Package',                 type: 'select',   placeholder: '-- Choose Package --',        required: true,  width: 'full',
          options: 'Face to Face (All 4 Days) - ₱13,500\nSynchronous Online via Zoom - ₱6,000' },
        { id: 'paymentRef', label: 'Payment Transaction Reference',   type: 'text',     placeholder: 'GCash Ref # or Bank Deposit', required: false, width: 'full' },
        { id: 'depositSlip',label: 'Proof of Payment / Deposit Slip', type: 'file',     placeholder: 'Upload GCash or deposit screenshot', required: false, width: 'full', maxFileSizeMB: 5 }
      ]
    },
    schema: {
      content: [
        { key: 'formTitle',      label: 'Form Heading',           type: 'text' },
        { key: 'formSubtitle',   label: 'Subtitle / Instructions', type: 'textarea' },
        { key: 'badgeText',      label: 'Top Badge Text',          type: 'text' },
        { key: 'submitBtnText',  label: 'Submit Button Label',     type: 'text' },
        { key: 'successMessage', label: 'Success Notice Text',     type: 'textarea' },
        {
          key: 'fields',
          label: '📝 Form Fields',
          type: 'form-builder'
        }

      ],
      style: [
        { key: 'cardStyle', label: 'Card Style', type: 'select', options: [
          { label: 'Glassmorphic Dark', value: 'glass' },
          { label: 'Solid Elevated Dark', value: 'solid' },
          { label: 'Clean Bordered', value: 'minimal' }
        ], default: 'glass' },
        { key: 'btnStyle', label: 'Button Style', type: 'select', options: [
          { label: 'Primary Gradient', value: 'primary' },
          { label: 'Glow Accent', value: 'glow' },
          { label: 'Solid Color', value: 'solid' }
        ], default: 'primary' },
        { key: 'accentColor', label: 'Accent Highlight Color', type: 'color', default: '#6366f1' },
        { key: 'googleSheetUrl', label: '📊 Google Sheets Webhook URL', type: 'text',
          placeholder: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec' },
        { key: 'gsheetExcludeSummary', label: '📊 Exclude Summary / Message Column', type: 'toggle', default: true },
        { key: 'gsheetExcludeMeta', label: '📊 Exclude Metadata (Type, Page)', type: 'toggle', default: true },
        { key: 'gsheetExcludeHidden', label: '📊 Exclude Hidden Fields', type: 'toggle', default: true }
      ]
    },
    render: (props) => {
      const p = props || {};
      const cardClass = p.cardStyle === 'solid' ? 'wb-reg-solid' : (p.cardStyle === 'minimal' ? 'wb-reg-minimal' : 'wb-reg-glass');
      const badgeHtml = p.badgeText ? `<span class="wb-reg-badge">${p.badgeText}</span>` : '';
      const btnClass  = p.btnStyle === 'glow' ? 'wb-btn-glow' : 'wb-btn-primary';
      const fields    = Array.isArray(p.fields) ? p.fields : [];

      const fieldsHtml = fields.map((f) => {
        if (!f || f.type === 'hidden') {
          return f ? `<input type="hidden" name="${f.id || ''}" value="${f.placeholder || ''}" />` : '';
        }

        // Caption / Text Display (no input)
        if (f.type === 'caption') {
          const style = f.captionStyle || 'text';
          const text = f.captionText || f.label || '';
          if (style === 'heading') {
            return `<div class="wb-reg-field wb-reg-field-full wb-reg-caption wb-reg-caption-heading">${text}</div>`;
          }
          const styleMap = { info: 'wb-reg-caption-info', warning: 'wb-reg-caption-warning', success: 'wb-reg-caption-success', text: 'wb-reg-caption-text' };
          return `<div class="wb-reg-field wb-reg-field-full wb-reg-caption ${styleMap[style] || 'wb-reg-caption-text'}">${text}</div>`;
        }

        const isFullWidth = f.width !== 'half';
        const colClass = isFullWidth ? 'wb-reg-field wb-reg-field-full' : 'wb-reg-field';
        const req = f.required ? 'required' : '';
        const reqStar = f.required ? ' *' : '';
        const ph = f.placeholder || '';
        const isAutoId = !f.id || /^field_\d+$/i.test(f.id);
        const fid = (!isAutoId && f.id) ? f.id : (f.label ? f.label.trim().replace(/[^a-zA-Z0-9_]/g, '_') : (f.id || 'field_' + Math.random().toString(36).substr(2, 6)));

        if (f.type === 'image_option') {
          const rawOpts = (f.options || '').split(/\r?\n/).map(o => o.trim()).filter(Boolean);
          const optItems = rawOpts.map((line, i) => {
            const parts = line.split('|').map(s => s ? s.trim() : '');
            const rawLabel = parts[0] || '';
            const imgPart = parts[1] || '';
            // Robust fallback if label is blank or only image/QR is given
            const cleanLabel = rawLabel || (imgPart ? (imgPart.split('/').pop().replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ') || `Option ${i + 1}`) : `Option ${i + 1}`);
            const optVal = cleanLabel.replace(/"/g, '&quot;');
            const optId = `${fid}_opt${i}`;
            return `
              <label class="wb-reg-img-option" for="${optId}">
                <input type="radio" id="${optId}" name="${fid}" value="${optVal}" class="wb-reg-img-radio" ${req} />
                ${imgPart ? `<div class="wb-reg-img-option-img"><img src="${imgPart}" alt="${cleanLabel}" draggable="false" style="pointer-events:none;user-select:none;-webkit-user-drag:none;" /></div>` : ''}
                <span class="wb-reg-img-option-label">${cleanLabel}</span>
              </label>`;
          }).join('');
          return `
            <div class="${colClass}">
              <label class="wb-reg-label">${f.label || 'Choose Option'}${reqStar}</label>
              <div class="wb-reg-img-options-grid" data-shape="${f.imageShape || (f.listLayout === 'vertical' ? 'fit' : 'square')}" data-layout="${f.listLayout || 'horizontal'}">${optItems}</div>
            </div>`;
        }

        if (f.type === 'select') {
          const opts = (f.options || '').split(/\r?\n/).map(o => o.trim()).filter(Boolean);
          return `
            <div class="${colClass}">
              <label class="wb-reg-label">${f.label || 'Select'}${reqStar}</label>
              <select name="${fid}" class="wb-reg-select" ${req}>
                <option value="">${ph || '-- Choose --'}</option>
                ${opts.map(o => `<option value="${o}">${o}</option>`).join('')}
              </select>
            </div>`;
        }

        if (f.type === 'textarea') {
          return `
            <div class="${colClass}">
              <label class="wb-reg-label">${f.label || 'Message'}${reqStar}</label>
              <textarea name="${fid}" class="wb-reg-textarea" placeholder="${ph}" rows="3" ${req}></textarea>
            </div>`;
        }

        if (f.type === 'checkbox') {
          return `
            <div class="wb-reg-field wb-reg-field-full wb-reg-checkbox-row">
              <label class="wb-reg-checkbox-label">
                <input type="checkbox" name="${fid}" class="wb-reg-checkbox" ${req} />
                <span>${f.label || 'I agree'}</span>
              </label>
            </div>`;
        }

        if (f.type === 'file') {
          const maxMB = (f.maxFileSizeMB !== undefined && f.maxFileSizeMB !== '' && f.maxFileSizeMB !== null) ? Number(f.maxFileSizeMB) : 5;
          return `
            <div class="${colClass}">
              <label class="wb-reg-label">${f.label || 'File Upload'}${reqStar}</label>
              <div class="wb-reg-file-box">
                <input type="file" name="${fid}" class="wb-reg-file-input" data-max-size-mb="${maxMB}" accept="image/*,application/pdf" style="font-size:0.85rem;color:#cbd5e1;" ${req} />
                <div class="wb-reg-file-status">
                  <span>${ph || 'Upload a clear photo or screenshot.'}</span>
                  <span class="wb-reg-file-limit" style="display:block;font-size:0.72rem;color:var(--text-dim,#94a3b8);margin-top:2px;">📁 Max file size: <strong>${maxMB} MB</strong> (Images or PDF)</span>
                </div>
                <div class="wb-reg-file-error" style="display:none;color:#f87171;font-size:0.75rem;margin-top:4px;font-weight:600;"></div>
              </div>
            </div>`;
        }

        // text, email, tel, number, date
        return `
          <div class="${colClass}">
            <label class="wb-reg-label">${f.label || 'Field'}${reqStar}</label>
            <input type="${f.type || 'text'}" name="${fid}" class="wb-reg-input" placeholder="${ph}" ${req} />
          </div>`;
      }).join('');

      return `
        <div class="wb-registration-widget ${cardClass}"
             data-gsheet-url="${p.googleSheetUrl || ''}"
             data-gsheet-exclude-summary="${p.gsheetExcludeSummary !== false ? 'true' : 'false'}"
             data-gsheet-exclude-meta="${p.gsheetExcludeMeta !== false ? 'true' : 'false'}"
             data-gsheet-exclude-hidden="${p.gsheetExcludeHidden !== false ? 'true' : 'false'}">
          <div class="wb-reg-header">
            ${badgeHtml}
            <h2 class="wb-reg-title">${p.formTitle || 'Seminar Registration'}</h2>
            ${p.formSubtitle ? `<p class="wb-reg-subtitle">${p.formSubtitle}</p>` : ''}
          </div>
          <form class="wb-reg-form" onsubmit="return false;" data-success-msg="${p.successMessage || 'Registration submitted!'}">
            <input type="text" name="_hp" style="display:none;" tabindex="-1" autocomplete="off" />
            <div class="wb-reg-grid">
              ${fieldsHtml}
            </div>
            <button type="submit" class="wb-reg-submit-btn wb-btn ${btnClass}">
              <span>${p.submitBtnText || 'Submit Registration'}</span> →
            </button>
            <div class="wb-reg-status"></div>
          </form>
        </div>
      `;
    }
  },

  // ── 18. TESTIMONIALS / REVIEWS ──────────────────────────────────────────────
  testimonials: {
    name: 'Testimonials / Reviews',
    category: 'content',
    icon: '💬',
    description: 'Showcase client testimonials, participant reviews, and star ratings in elegant quote cards',
    defaultProps: {
      sectionTitle: 'What Participants Say',
      sectionSubtitle: 'Hear from those who attended our seminars',
      layout: 'grid',
      cardStyle: 'glass',
      accentColor: '#6366f1',
      showRating: true,
      showAvatar: true,
      items: [
        { name: 'Atty. Maria Santos', role: 'Senior Partner, Santos & Cruz Law Firm', quote: 'An exceptional seminar that provided practical, up-to-date MCLE credit units. The speakers were world-class and the materials were comprehensive.', rating: 5, avatar: '' },
        { name: 'Atty. Jose Reyes', role: 'Public Prosecutor, DOJ', quote: 'Highly recommended for all legal professionals. The online format made it accessible even with my busy schedule. Will definitely join again next year.', rating: 5, avatar: '' },
        { name: 'Atty. Ana Garcia', role: 'Corporate Counsel, Ayala Corp.', quote: 'Best MCLE seminar I\'ve attended in years. The topics were relevant and the Q&A sessions were incredibly insightful. Top-notch organization.', rating: 4, avatar: '' }
      ]
    },
    schema: {
      content: [
        { key: 'sectionTitle',    label: 'Section Title',    type: 'text' },
        { key: 'sectionSubtitle', label: 'Section Subtitle', type: 'text' },
        { key: 'items', label: '💬 Testimonials', type: 'repeater', itemLabel: 'Testimonial',
          fields: [
            { key: 'name',   label: 'Person Name',  type: 'text' },
            { key: 'role',   label: 'Title / Role', type: 'text' },
            { key: 'quote',  label: 'Quote / Review', type: 'textarea' },
            { key: 'rating', label: 'Star Rating (1–5)', type: 'number' },
            { key: 'avatar', label: 'Photo URL (optional)', type: 'text' }
          ]
        }
      ],
      style: [
        { key: 'layout', label: 'Layout', type: 'select', options: [
            { label: 'Card Grid (2–3 cols)', value: 'grid' },
            { label: 'Single Centered Column', value: 'column' },
            { label: 'Horizontal Scroll Carousel', value: 'scroll' }
          ], default: 'grid'
        },
        { key: 'cardSize', label: '📐 Card Size (Grid layout only)', type: 'select', default: 'full', options: [
          { label: 'Full Width (stretch to fill)', value: 'full' },
          { label: 'Large (max ~520px)', value: 'lg' },
          { label: 'Standard (max ~420px)', value: 'md' },
          { label: 'Small (max ~340px)', value: 'sm' },
          { label: 'Compact (max ~260px)', value: 'xs' }
        ]},
        { key: 'cardStyle', label: 'Card Style', type: 'select', options: [
            { label: 'Glassmorphic', value: 'glass' },
            { label: 'Solid Elevated', value: 'solid' },
            { label: 'Minimal Border', value: 'minimal' }
          ], default: 'glass'
        },
        { key: 'accentColor', label: 'Accent / Star Color', type: 'color', default: '#6366f1' },
        { key: 'showRating', label: 'Show Star Ratings', type: 'toggle', default: true },
        { key: 'showAvatar', label: 'Show Avatars / Initials', type: 'toggle', default: true }
      ]
    },
    render: (props) => {
      const p = props || {};
      const items = Array.isArray(p.items) ? p.items : [];
      const accent = p.accentColor || '#6366f1';
      const cardClass = p.cardStyle === 'solid' ? 'wb-testi-solid' : p.cardStyle === 'minimal' ? 'wb-testi-minimal' : 'wb-testi-glass';
      const sizeClass = (p.layout === 'grid' && p.cardSize && p.cardSize !== 'full') ? ` card-size-${p.cardSize}` : '';
      const wrapClass = p.layout === 'scroll' ? 'wb-testi-scroll' : p.layout === 'column' ? 'wb-testi-column' : `wb-testi-grid${sizeClass}`;

      const stars = (n) => {
        const count = Math.min(5, Math.max(0, parseInt(n) || 5));
        return Array.from({ length: 5 }, (_, i) =>
          `<span style="color:${i < count ? accent : 'rgba(255,255,255,0.15)'}; font-size:1rem;">★</span>`
        ).join('');
      };

      const cards = items.map(item => {
        const initials = (item.name || 'A').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
        const avatarEl = (p.showAvatar !== false)
          ? (item.avatar
              ? `<img src="${item.avatar}" alt="${item.name||''}" class="wb-testi-avatar-img" />`
              : `<div class="wb-testi-avatar-initials" style="background:${accent}20;color:${accent};">${initials}</div>`)
          : '';
        const ratingEl = p.showRating !== false ? `<div class="wb-testi-stars">${stars(item.rating)}</div>` : '';
        return `
          <div class="wb-testi-card ${cardClass}">
            <div class="wb-testi-quote-mark" style="color:${accent};">"</div>
            <p class="wb-testi-quote">${item.quote || ''}</p>
            ${ratingEl}
            <div class="wb-testi-person">
              ${avatarEl}
              <div class="wb-testi-person-info">
                <div class="wb-testi-name">${item.name || 'Participant'}</div>
                <div class="wb-testi-role">${item.role || ''}</div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      const headerHtml = (p.sectionTitle || p.sectionSubtitle) ? `
        <div class="wb-testi-header">
          ${p.sectionTitle ? `<h2 class="wb-testi-title">${p.sectionTitle}</h2>` : ''}
          ${p.sectionSubtitle ? `<p class="wb-testi-subtitle">${p.sectionSubtitle}</p>` : ''}
        </div>
      ` : '';

      return `
        <div class="wb-testimonials-section">
          ${headerHtml}
          <div class="${wrapClass}">${cards}</div>
        </div>
      `;
    }
  },

  // ── 19. TIMELINE / PROCESS STEPS ────────────────────────────────────────────
  timeline: {
    name: 'Timeline / Process Steps',
    category: 'content',
    icon: '📅',
    description: 'Numbered process steps, event timeline, roadmap, or milestone tracker',
    defaultProps: {
      sectionTitle: 'How It Works',
      sectionSubtitle: 'Simple steps to join our seminar',
      layout: 'vertical',
      accentColor: '#6366f1',
      items: [
        { step: '1', icon: '📝', title: 'Register Online', description: 'Fill out the registration form and select your preferred seminar package.' },
        { step: '2', icon: '💳', title: 'Complete Payment', description: 'Pay via bank deposit, GCash, or online transfer. Upload your deposit slip for confirmation.' },
        { step: '3', icon: '✅', title: 'Receive Confirmation', description: 'Our secretariat will send your official confirmation slip and seminar details via email.' },
        { step: '4', icon: '🎓', title: 'Attend & Earn Credits', description: 'Participate in the seminar and receive your MCLE certificate upon completion.' }
      ]
    },
    schema: {
      content: [
        { key: 'sectionTitle',    label: 'Section Title',    type: 'text' },
        { key: 'sectionSubtitle', label: 'Section Subtitle', type: 'text' },
        { key: 'items', label: '📅 Steps / Events', type: 'repeater', itemLabel: 'Step',
          fields: [
            { key: 'step',        label: 'Step Number / Year / Label', type: 'text' },
            { key: 'icon',        label: 'Icon (emoji or URL)',        type: 'text' },
            { key: 'title',       label: 'Step Title',                 type: 'text' },
            { key: 'description', label: 'Description',                type: 'textarea' }
          ]
        }
      ],
      style: [
        { key: 'layout', label: 'Orientation', type: 'select', options: [
            { label: 'Vertical (Classic)', value: 'vertical' },
            { label: 'Horizontal Steps Bar', value: 'horizontal' },
            { label: 'Alternating Left-Right', value: 'alternating' }
          ], default: 'vertical'
        },
        { key: 'accentColor', label: 'Accent / Line Color', type: 'color', default: '#6366f1' }
      ]
    },
    render: (props) => {
      const p = props || {};
      const items = Array.isArray(p.items) ? p.items : [];
      const accent = p.accentColor || '#6366f1';
      const layout = p.layout || 'vertical';

      const headerHtml = (p.sectionTitle || p.sectionSubtitle) ? `
        <div class="wb-timeline-header">
          ${p.sectionTitle ? `<h2 class="wb-timeline-title">${p.sectionTitle}</h2>` : ''}
          ${p.sectionSubtitle ? `<p class="wb-timeline-subtitle">${p.sectionSubtitle}</p>` : ''}
        </div>
      ` : '';

      if (layout === 'horizontal') {
        const steps = items.map((item, i) => `
          <div class="wb-tl-h-step">
            <div class="wb-tl-h-dot" style="background:${accent}; box-shadow: 0 0 0 4px ${accent}22;">
              <span>${item.icon || item.step || (i + 1)}</span>
            </div>
            <div class="wb-tl-h-connector" style="background: linear-gradient(90deg, ${accent}, ${accent}44);"></div>
            <div class="wb-tl-h-content">
              <div class="wb-tl-h-step-label" style="color:${accent};">Step ${item.step || i + 1}</div>
              <div class="wb-tl-h-title">${item.title || ''}</div>
              <div class="wb-tl-h-desc">${item.description || ''}</div>
            </div>
          </div>
        `).join('');
        return `
          <div class="wb-timeline-section">
            ${headerHtml}
            <div class="wb-tl-horizontal">${steps}</div>
          </div>
        `;
      }

      // Vertical / Alternating
      const stepsHtml = items.map((item, i) => {
        const side = layout === 'alternating' ? (i % 2 === 0 ? 'left' : 'right') : 'left';
        return `
          <div class="wb-tl-item wb-tl-${side}">
            <div class="wb-tl-dot" style="background:${accent}; box-shadow: 0 0 0 5px ${accent}22, 0 0 20px ${accent}44;">
              <span class="wb-tl-dot-icon">${item.icon || item.step || (i + 1)}</span>
            </div>
            <div class="wb-tl-content">
              <div class="wb-tl-step-num" style="color:${accent};">
                ${item.step ? `Step ${item.step}` : `0${i + 1}`}
              </div>
              <h3 class="wb-tl-item-title">${item.title || ''}</h3>
              <p class="wb-tl-item-desc">${item.description || ''}</p>
            </div>
          </div>
        `;
      }).join('');

      const lineStyle = `background: linear-gradient(to bottom, ${accent}, ${accent}44);`;
      return `
        <div class="wb-timeline-section">
          ${headerHtml}
          <div class="wb-tl-track wb-tl-${layout}">
            <div class="wb-tl-line" style="${lineStyle}"></div>
            ${stepsHtml}
          </div>
        </div>
      `;
    }
  },

  // ── 20. IMAGE HOVER GALLERY ──────────────────────────────────────────────────
  image_hover_gallery: {
    name: 'Image Hover Gallery',
    category: 'media',
    icon: '🖼️',
    description: 'Image grid with elegant zoom, overlay, and caption effects on hover — perfect for portfolios, event photos, sponsor logos',
    defaultProps: {
      sectionTitle: 'Event Gallery',
      sectionSubtitle: 'Photos from our recent seminars',
      columns: '3',
      hoverEffect: 'zoom-caption',
      aspectRatio: '1/1',
      accentColor: '#6366f1',
      items: [
        { src: '', caption: 'Opening Ceremony', subcaption: 'Day 1' },
        { src: '', caption: 'Panel Discussion', subcaption: 'Day 1' },
        { src: '', caption: 'Guest Lecture', subcaption: 'Day 2' },
        { src: '', caption: 'Certificate Awarding', subcaption: 'Day 4' },
        { src: '', caption: 'Networking Session', subcaption: 'Day 3' },
        { src: '', caption: 'Workshop Breakout', subcaption: 'Day 2' }
      ]
    },
    schema: {
      content: [
        { key: 'sectionTitle',    label: 'Section Title',    type: 'text' },
        { key: 'sectionSubtitle', label: 'Section Subtitle', type: 'text' },
        { key: 'items', label: '🖼️ Images', type: 'repeater', itemLabel: 'Image',
          fields: [
            { key: 'src',        label: 'Image URL',    type: 'text' },
            { key: 'caption',    label: 'Caption',      type: 'text' },
            { key: 'subcaption', label: 'Sub-caption',  type: 'text' },
            { key: 'link',       label: 'Link URL (optional)', type: 'text' }
          ]
        }
      ],
      style: [
        { key: 'columns', label: 'Columns', type: 'select', options: [
            { label: '2 Columns', value: '2' },
            { label: '3 Columns', value: '3' },
            { label: '4 Columns', value: '4' },
            { label: '5 Columns', value: '5' }
          ], default: '3'
        },
        { key: 'hoverEffect', label: 'Hover Effect', type: 'select', options: [
            { label: '🔍 Zoom + Caption Overlay', value: 'zoom-caption' },
            { label: '✨ Glow Lift',              value: 'glow-lift' },
            { label: '🎞️ Blur Reveal Caption',    value: 'blur-reveal' },
            { label: '🌑 Dark Overlay + Icon',    value: 'dark-overlay' }
          ], default: 'zoom-caption'
        },
        { key: 'aspectRatio', label: 'Image Aspect Ratio', type: 'select', options: [
            { label: 'Square (1:1)',     value: '1/1' },
            { label: 'Landscape (4:3)', value: '4/3' },
            { label: 'Wide (16:9)',     value: '16/9' },
            { label: 'Portrait (3:4)', value: '3/4' }
          ], default: '1/1'
        },
        { key: 'accentColor', label: 'Overlay Accent Color', type: 'color', default: '#6366f1' }
      ]
    },
    render: (props) => {
      const p = props || {};
      const items = Array.isArray(p.items) ? p.items : [];
      const cols = parseInt(p.columns) || 3;
      const accent = p.accentColor || '#6366f1';
      const effect = p.hoverEffect || 'zoom-caption';
      const ratio = p.aspectRatio || '1/1';

      const placeholder = (i) => `
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;
                    background: linear-gradient(135deg, ${accent}18, ${accent}06);
                    color:${accent}; font-size:2.5rem; border: 2px dashed ${accent}30;">
          🖼️
        </div>`;

      const cards = items.map((item, i) => {
        const imgEl = item.src
          ? `<img src="${item.src}" alt="${item.caption || ''}" class="wb-ihg-img" loading="lazy" />`
          : placeholder(i);

        const captionHtml = (item.caption || item.subcaption) ? `
          <div class="wb-ihg-overlay wb-ihg-effect-${effect}" style="--ihg-accent:${accent};">
            ${item.caption ? `<div class="wb-ihg-caption">${item.caption}</div>` : ''}
            ${item.subcaption ? `<div class="wb-ihg-subcaption">${item.subcaption}</div>` : ''}
            ${effect === 'dark-overlay' ? `<div class="wb-ihg-icon" style="color:${accent};">🔍</div>` : ''}
          </div>
        ` : '';

        const inner = `
          <div class="wb-ihg-thumb wb-ihg-${effect}" style="aspect-ratio:${ratio};">
            ${imgEl}
            ${captionHtml}
          </div>
        `;

        return item.link
          ? `<a href="${item.link}" class="wb-ihg-item" target="_blank" rel="noopener">${inner}</a>`
          : `<div class="wb-ihg-item">${inner}</div>`;
      }).join('');

      const headerHtml = (p.sectionTitle || p.sectionSubtitle) ? `
        <div class="wb-ihg-header">
          ${p.sectionTitle ? `<h2 class="wb-ihg-title">${p.sectionTitle}</h2>` : ''}
          ${p.sectionSubtitle ? `<p class="wb-ihg-subtitle">${p.sectionSubtitle}</p>` : ''}
        </div>
      ` : '';

      return `
        <div class="wb-ihg-section">
          ${headerHtml}
          <div class="wb-ihg-grid" style="--ihg-cols:${cols};">
            ${cards}
          </div>
        </div>
      `;
    }
  }

};

// Real-time Countdown Timer Engine
export function initCountdownTimers() {
  if (typeof window === 'undefined') return;
  const update = () => {
    document.querySelectorAll('.wb-cb-timer[data-target]').forEach((el) => {
      const targetStr = el.getAttribute('data-target');
      if (!targetStr) return;
      const target = new Date(targetStr).getTime();
      const now = Date.now();
      const diff = Math.max(0, target - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      const pad = (n) => String(n).padStart(2, '0');
      const dEl = el.querySelector('.wb-cb-days');
      const hEl = el.querySelector('.wb-cb-hours');
      const mEl = el.querySelector('.wb-cb-mins');
      const sEl = el.querySelector('.wb-cb-secs');

      if (dEl && dEl.textContent !== pad(days)) dEl.textContent = pad(days);
      if (hEl && hEl.textContent !== pad(hours)) hEl.textContent = pad(hours);
      if (mEl && mEl.textContent !== pad(mins)) mEl.textContent = pad(mins);
      if (sEl && sEl.textContent !== pad(secs)) sEl.textContent = pad(secs);
    });
  };

  update();
  if (!window._wbCountdownInterval) {
    window._wbCountdownInterval = setInterval(update, 1000);
  }
}

// Auto-run when DOM ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCountdownTimers);
  } else {
    initCountdownTimers();
  }
}

