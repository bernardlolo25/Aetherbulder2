/**
 * AETHERBUILDER - THEME PRESETS ENGINE
 * Provides curated, luxury color palettes and typographic design systems with real-time CSS variable injection.
 */

export const THEME_PRESETS = {
  'dark-neon': {
    id: 'dark-neon',
    name: 'Cyber Dark & Neon (Default)',
    accentName: 'Indigo & Electric Pink',
    font: "'Plus Jakarta Sans', 'Inter', sans-serif",
    headingFont: "'Outfit', 'Plus Jakarta Sans', sans-serif",
    vars: {
      '--primary': '#6366f1',
      '--primary-hover': '#4f46e5',
      '--primary-glow': 'rgba(99, 102, 241, 0.4)',
      '--primary-light': '#818cf8',
      '--primary-soft': 'rgba(99, 102, 241, 0.12)',
      '--secondary': '#ec4899',
      '--secondary-glow': 'rgba(236, 72, 153, 0.35)',
      '--accent': '#06b6d4',
      '--accent-glow': 'rgba(6, 182, 212, 0.35)',
      '--bg-deep': '#090d16',
      '--bg-app': '#0d121f',
      '--bg-panel': '#131b2e',
      '--bg-panel-header': '#17223b',
      '--bg-card': 'rgba(23, 34, 59, 0.7)',
      '--text-main': '#f8fafc',
      '--text-muted': '#94a3b8',
      '--text-dim': '#64748b',
      '--border-subtle': 'rgba(255, 255, 255, 0.08)'
    }
  },
  'midnight-gold': {
    id: 'midnight-gold',
    name: 'Midnight Slate & Luxury Gold',
    accentName: 'Amber & Warm Gold',
    font: "'Outfit', 'Plus Jakarta Sans', sans-serif",
    headingFont: "'Outfit', sans-serif",
    vars: {
      '--primary': '#d97706',
      '--primary-hover': '#b45309',
      '--primary-glow': 'rgba(217, 119, 6, 0.45)',
      '--primary-light': '#fbbf24',
      '--primary-soft': 'rgba(217, 119, 6, 0.15)',
      '--secondary': '#f59e0b',
      '--secondary-glow': 'rgba(245, 158, 11, 0.35)',
      '--accent': '#eab308',
      '--accent-glow': 'rgba(234, 179, 8, 0.35)',
      '--bg-deep': '#0a0b0e',
      '--bg-app': '#101217',
      '--bg-panel': '#161920',
      '--bg-panel-header': '#1b1f28',
      '--bg-card': 'rgba(24, 28, 38, 0.75)',
      '--text-main': '#fef3c7',
      '--text-muted': '#cbd5e1',
      '--text-dim': '#94a3b8',
      '--border-subtle': 'rgba(217, 119, 6, 0.18)'
    }
  },
  'emerald-cyber': {
    id: 'emerald-cyber',
    name: 'Cyber Emerald & Matrix Tech',
    accentName: 'Mint Emerald & Teal',
    font: "'Inter', sans-serif",
    headingFont: "'Outfit', sans-serif",
    vars: {
      '--primary': '#10b981',
      '--primary-hover': '#059669',
      '--primary-glow': 'rgba(16, 185, 129, 0.45)',
      '--primary-light': '#34d399',
      '--primary-soft': 'rgba(16, 185, 129, 0.15)',
      '--secondary': '#06b6d4',
      '--secondary-glow': 'rgba(6, 182, 212, 0.35)',
      '--accent': '#14b8a6',
      '--accent-glow': 'rgba(20, 184, 166, 0.35)',
      '--bg-deep': '#04100c',
      '--bg-app': '#071711',
      '--bg-panel': '#0c221a',
      '--bg-panel-header': '#102d23',
      '--bg-card': 'rgba(12, 38, 30, 0.75)',
      '--text-main': '#ecfdf5',
      '--text-muted': '#a7f3d0',
      '--text-dim': '#6ee7b7',
      '--border-subtle': 'rgba(16, 185, 129, 0.18)'
    }
  },
  'clean-saas': {
    id: 'clean-saas',
    name: 'Clean Modern Violet & Tech Blue',
    accentName: 'Electric Indigo & Royal Blue',
    font: "'Plus Jakarta Sans', sans-serif",
    headingFont: "'Plus Jakarta Sans', sans-serif",
    vars: {
      '--primary': '#4f46e5',
      '--primary-hover': '#4338ca',
      '--primary-glow': 'rgba(79, 70, 229, 0.4)',
      '--primary-light': '#818cf8',
      '--primary-soft': 'rgba(79, 70, 229, 0.12)',
      '--secondary': '#7c3aed',
      '--secondary-glow': 'rgba(124, 58, 237, 0.35)',
      '--accent': '#3b82f6',
      '--accent-glow': 'rgba(59, 130, 246, 0.35)',
      '--bg-deep': '#080c18',
      '--bg-app': '#0d1326',
      '--bg-panel': '#141c38',
      '--bg-panel-header': '#192347',
      '--bg-card': 'rgba(21, 29, 58, 0.75)',
      '--text-main': '#f1f5f9',
      '--text-muted': '#94a3b8',
      '--text-dim': '#64748b',
      '--border-subtle': 'rgba(79, 70, 229, 0.16)'
    }
  },
  'sunset-crimson': {
    id: 'sunset-crimson',
    name: 'Sunset Crimson & Flame Rose',
    accentName: 'Rose & Warm Flame',
    font: "'Outfit', 'Plus Jakarta Sans', sans-serif",
    headingFont: "'Outfit', sans-serif",
    vars: {
      '--primary': '#f43f5e',
      '--primary-hover': '#e11d48',
      '--primary-glow': 'rgba(244, 63, 94, 0.45)',
      '--primary-light': '#fb7185',
      '--primary-soft': 'rgba(244, 63, 94, 0.15)',
      '--secondary': '#f97316',
      '--secondary-glow': 'rgba(249, 115, 22, 0.35)',
      '--accent': '#fbbf24',
      '--accent-glow': 'rgba(251, 191, 36, 0.35)',
      '--bg-deep': '#11070a',
      '--bg-app': '#190a0f',
      '--bg-panel': '#240e16',
      '--bg-panel-header': '#2e121c',
      '--bg-card': 'rgba(38, 16, 24, 0.75)',
      '--text-main': '#fff1f2',
      '--text-muted': '#fecdd3',
      '--text-dim': '#fda4af',
      '--border-subtle': 'rgba(244, 63, 94, 0.18)'
    }
  }
};

export const AVAILABLE_FONTS = [
  { id: "'Plus Jakarta Sans', sans-serif", name: 'Plus Jakarta Sans (Modern Clean)' },
  { id: "'Inter', sans-serif", name: 'Inter (Precision Tech)' },
  { id: "'Outfit', sans-serif", name: 'Outfit (Geometric Luxury)' }
];

/**
 * Converts hex color (#rrggbb or #rgb) to rgba string with custom alpha
 */
export function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(99, 102, 241, ${alpha})`;
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  if (c.length !== 6) return hex;
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Injects CSS variables and sets theme data attributes on root DOM
 */
export function applyTheme(presetId = 'dark-neon', fontOverride = null, themeCustom = null) {
  const preset = THEME_PRESETS[presetId] || THEME_PRESETS['dark-neon'];
  const root = document.documentElement;

  // 1. Apply base preset variables
  if (preset.vars) {
    Object.entries(preset.vars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });
    if (preset.vars['--primary']) {
      root.style.setProperty('--border-focus', preset.vars['--primary']);
    }
  }

  // 2. Apply custom palette overrides if enabled
  if (themeCustom && themeCustom.enabled) {
    if (themeCustom.primary) {
      root.style.setProperty('--primary', themeCustom.primary);
      root.style.setProperty('--primary-hover', themeCustom.primary);
      root.style.setProperty('--primary-glow', hexToRgba(themeCustom.primary, 0.45));
      root.style.setProperty('--primary-light', themeCustom.primary);
      root.style.setProperty('--primary-soft', hexToRgba(themeCustom.primary, 0.14));
      root.style.setProperty('--border-subtle', hexToRgba(themeCustom.primary, 0.18));
      root.style.setProperty('--border-focus', themeCustom.primary);
    }
    if (themeCustom.secondary) {
      root.style.setProperty('--secondary', themeCustom.secondary);
      root.style.setProperty('--secondary-glow', hexToRgba(themeCustom.secondary, 0.35));
    }
    if (themeCustom.accent) {
      root.style.setProperty('--accent', themeCustom.accent);
      root.style.setProperty('--accent-glow', hexToRgba(themeCustom.accent, 0.35));
    }
    if (themeCustom.bgDeep) {
      root.style.setProperty('--bg-deep', themeCustom.bgDeep);
      document.body.style.backgroundColor = themeCustom.bgDeep;
    }
    if (themeCustom.bgCard) {
      root.style.setProperty('--bg-card', hexToRgba(themeCustom.bgCard, 0.85));
      root.style.setProperty('--bg-panel', themeCustom.bgCard);
    }
    if (themeCustom.textMain) {
      root.style.setProperty('--text-main', themeCustom.textMain);
    }
    if (themeCustom.textMuted) {
      root.style.setProperty('--text-muted', themeCustom.textMuted);
    }
  } else if (preset.vars && preset.vars['--bg-deep']) {
    document.body.style.backgroundColor = preset.vars['--bg-deep'];
  }

  // Apply typography
  const activeFont = fontOverride || preset.font;
  root.style.setProperty('--font-sans', activeFont);
  if (preset.headingFont) {
    root.style.setProperty('--font-heading', preset.headingFont);
  }

  // Set data-preset attribute for custom selectors
  document.body.setAttribute('data-preset', preset.id);

  console.log(`🎨 Theme applied: preset=${preset.id}, custom=${!!(themeCustom && themeCustom.enabled)}`);
}
