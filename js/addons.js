/**
 * AETHERBUILDER - ADD-ONS & PLUGIN SYSTEM WITH ADD-ON MAKER
 * Enables modular widget extensions like WordPress plugins.
 * Users can create, install, toggle, export, and manage custom widgets seamlessly.
 */

import { WIDGET_REGISTRY, formatSafeCurrency, getSafeIcon } from './widgets.js';

// Admin token helper (server-side session)
function _getAdminToken() { return sessionStorage.getItem('aether_admin_token') || ''; }
import { state } from './state.js';

// ── 1. LIGHTWEIGHT & SAFE ADD-ON TEMPLATE COMPILER ───────────────────────────
// ── 1. LIGHTWEIGHT & SAFE RECURSIVE ADD-ON TEMPLATE COMPILER ─────────────────────────────
export function parseJsonProps(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const [k, v] of Object.entries(result)) {
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try {
          result[k] = parseJsonProps(JSON.parse(trimmed));
        } catch (_) {}
      }
    } else if (typeof v === 'object' && v !== null) {
      result[k] = parseJsonProps(v);
    }
  }
  return result;
}

function resolveTemplateKey(key, context, parents = []) {
  if (!key) return undefined;
  const trimmed = key.trim();
  if (trimmed === 'this') {
    if (typeof context === 'object' && context !== null && 'this' in context) return context.this;
    return context;
  }
  // Handle Handlebars parent scope navigation: ../var or ../../var
  if (trimmed.startsWith('../')) {
    let parentLevels = 0;
    let cleanKey = trimmed;
    while (cleanKey.startsWith('../')) {
      parentLevels++;
      cleanKey = cleanKey.slice(3);
    }
    const targetParent = parents[parentLevels - 1];
    if (targetParent !== undefined && targetParent !== null) {
      const remainingParents = parents.slice(parentLevels);
      return resolveTemplateKey(cleanKey, targetParent, remainingParents);
    }
    return undefined;
  }
  if (typeof context === 'object' && context !== null) {
    if (trimmed in context) return context[trimmed];
    if (trimmed.includes('.')) {
      const parts = trimmed.split('.');
      let cur = parts[0] === 'this' ? context : context[parts[0]];
      parts.shift();
      while (cur !== undefined && cur !== null && parts.length > 0) {
        cur = cur[parts.shift()];
      }
      if (cur !== undefined) return cur;
    }
  }
  for (const parent of parents) {
    if (typeof parent === 'object' && parent !== null) {
      if (trimmed in parent) return parent[trimmed];
      if (trimmed.includes('.')) {
        const parts = trimmed.split('.');
        let cur = parent[parts[0]];
        if (cur !== undefined) {
          parts.shift();
          while (cur !== undefined && cur !== null && parts.length > 0) {
            cur = cur[parts.shift()];
          }
          if (cur !== undefined) return cur;
        }
      }
    }
  }
  return undefined;
}

function evaluateCondition(condStr, context, parents = []) {
  if (!condStr) return false;
  let s = condStr.trim();
  if (s.startsWith('(') && s.endsWith(')')) {
    s = s.slice(1, -1).trim();
  }

  // Handle helpers: eq, ne, gt, lt
  const helperMatch = s.match(/^(eq|ne|gt|lt)\s+([^\s]+)\s+([\s\S]+)$/);
  if (helperMatch) {
    const op = helperMatch[1];
    const leftRaw = helperMatch[2];
    const rightRaw = helperMatch[3].trim();

    const parseVal = (token) => {
      const t = token.trim();
      if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
        return t.slice(1, -1);
      }
      if (t === 'true') return true;
      if (t === 'false') return false;
      if (t === 'null') return null;
      if (t === 'undefined') return undefined;
      if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
      return resolveTemplateKey(t, context, parents);
    };

    const left = parseVal(leftRaw);
    const right = parseVal(rightRaw);

    if (op === 'eq') return left == right;
    if (op === 'ne') return left != right;
    if (op === 'gt') return Number(left) > Number(right);
    if (op === 'lt') return Number(left) < Number(right);
  }

  // Handle comparison operators: ==, !=, ===, !==, >, <
  const compMatch = s.match(/^([^\s=!<]+)\s*(===?|!==?|>=?|<=?)\s*([\s\S]+)$/);
  if (compMatch) {
    const leftToken = compMatch[1].trim();
    const op = compMatch[2].trim();
    const rightToken = compMatch[3].trim();
    const parseVal = (token) => {
      const t = token.trim();
      if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
        return t.slice(1, -1);
      }
      if (t === 'true') return true;
      if (t === 'false') return false;
      if (t === 'null') return null;
      if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
      return resolveTemplateKey(t, context, parents);
    };
    const left = parseVal(leftToken);
    const right = parseVal(rightToken);
    if (op === '==' || op === '===') return left == right;
    if (op === '!=' || op === '!==') return left != right;
    if (op === '>') return Number(left) > Number(right);
    if (op === '<') return Number(left) < Number(right);
  }

  const val = resolveTemplateKey(s, context, parents);
  return !!val && val !== 'false' && val !== '0' && (!Array.isArray(val) || val.length > 0);
}

function parseTemplateToAst(templateStr) {
  const root = { type: 'root', children: [] };
  const stack = [root];
  let lastIndex = 0;
  // Support block tags ({{#each}}, {{/each}}), variable tags ({{name}}, {{../currencySymbol}}), and triple curlies ({{{raw}}})
  const tagRegex = /\{\{\{?\s*(?:([#\/])([a-zA-Z0-9_]+)(?:\s+([\s\S]*?))?|([a-zA-Z0-9_\.\@\/]+))\s*\}\}\}?/g;
  let match;

  while ((match = tagRegex.exec(templateStr)) !== null) {
    const textBefore = templateStr.slice(lastIndex, match.index);
    if (textBefore) {
      const current = stack[stack.length - 1];
      const targetChildren = current.inElse ? current.elseChildren : current.children;
      targetChildren.push({ type: 'text', value: textBefore });
    }
    lastIndex = tagRegex.lastIndex;

    const prefix = match[1];
    const blockCmd = match[2];
    const blockArg = (match[3] || '').trim();
    const varName = match[4];

    if (varName === 'else') {
      const current = stack[stack.length - 1];
      if (current && (current.type === 'if' || current.type === 'unless')) {
        current.inElse = true;
      }
      continue;
    }

    if (prefix === '#') {
      const newBlock = {
        type: blockCmd,
        key: blockArg,
        children: [],
        elseChildren: [],
        inElse: false
      };
      const current = stack[stack.length - 1];
      const targetChildren = current.inElse ? current.elseChildren : current.children;
      targetChildren.push(newBlock);
      stack.push(newBlock);
    } else if (prefix === '/') {
      if (stack.length > 1) {
        stack.pop();
      }
    } else if (varName) {
      const current = stack[stack.length - 1];
      const targetChildren = current.inElse ? current.elseChildren : current.children;
      targetChildren.push({ type: 'var', key: varName });
    }
  }

  const trailingText = templateStr.slice(lastIndex);
  if (trailingText) {
    const current = stack[stack.length - 1];
    const targetChildren = current.inElse ? current.elseChildren : current.children;
    targetChildren.push({ type: 'text', value: trailingText });
  }

  return root;
}

function evaluateTemplateAst(node, context, parents = [], loopMeta = {}) {
  if (node.type === 'root') {
    return node.children.map(c => evaluateTemplateAst(c, context, parents, loopMeta)).join('');
  }
  if (node.type === 'text') {
    return node.value;
  }
  if (node.type === 'var') {
    if (node.key === '@index') return String(loopMeta.index ?? '');
    if (node.key === '@number') return String((loopMeta.index ?? -1) + 1);
    const val = resolveTemplateKey(node.key, context, parents);
    if (val === undefined || val === null) return '';
    return String(val);
  }
  if (node.type === 'if') {
    const isTruthy = evaluateCondition(node.key, context, parents);
    const childrenToRender = isTruthy ? node.children : node.elseChildren;
    return childrenToRender.map(c => evaluateTemplateAst(c, context, parents, loopMeta)).join('');
  }
  if (node.type === 'unless') {
    const isTruthy = evaluateCondition(node.key, context, parents);
    const childrenToRender = !isTruthy ? node.children : node.elseChildren;
    return childrenToRender.map(c => evaluateTemplateAst(c, context, parents, loopMeta)).join('');
  }
  if (node.type === 'with') {
    const val = resolveTemplateKey(node.key, context, parents);
    if (!val || typeof val !== 'object') {
      return (node.elseChildren || []).map(c => evaluateTemplateAst(c, context, parents, loopMeta)).join('');
    }
    const nextParents = [context, ...parents];
    return node.children.map(c => evaluateTemplateAst(c, val, nextParents, loopMeta)).join('');
  }
  if (node.type === 'each') {
    const list = resolveTemplateKey(node.key, context, parents);
    if (!Array.isArray(list) || list.length === 0) {
      return (node.elseChildren || []).map(c => evaluateTemplateAst(c, context, parents, loopMeta)).join('');
    }
    const nextParents = [context, ...parents];
    return list.map((item, idx) => {
      const itemContext = (typeof item === 'object' && item !== null) ? item : { this: item };
      return node.children.map(c => evaluateTemplateAst(c, itemContext, nextParents, { index: idx, count: list.length })).join('');
    }).join('');
  }
  return '';
}

export function compileAddonTemplate(templateStr, rawProps = {}) {
  if (!templateStr) return '';
  const parsedProps = parseJsonProps(rawProps);
  const ast = parseTemplateToAst(templateStr);
  const output = evaluateTemplateAst(ast, parsedProps);
  return formatSafeCurrency(output);
}

// ── 2. PRE-BUNDLED HIGH QUALITY SAMPLE ADD-ONS ──────────────────────────────
export const STARTER_ADDONS = [
  {
    id: 'addon_notice_banner',
    name: 'Notice Alert Banner',
    category: 'addons',
    icon: '📣',
    version: '1.0.0',
    author: 'Aether Studio',
    description: 'Dismissible notification banner with pulse status, callout styles, and action button',
    enabled: true,
    defaultProps: {
      tone: 'promo',
      badgeText: 'HOT ANNOUNCEMENT',
      message: 'Exclusive early bird seminar registration slots now available. Secure your accredited credit units!',
      actionText: 'Register Now',
      actionLink: '?page=registration',
      showAction: true,
      dismissible: true,
      cardStyle: 'glass'
    },
    schema: {
      content: [
        { key: 'badgeText',   label: 'Badge Label',         type: 'text' },
        { key: 'message',     label: 'Announcement Text',   type: 'textarea' },
        { key: 'showAction',  label: 'Show Action Button',  type: 'toggle' },
        { key: 'actionText',  label: 'Button Label',        type: 'text' },
        { key: 'actionLink',  label: 'Button Link / URL',   type: 'page-link' },
        { key: 'dismissible', label: 'Allow User to Dismiss', type: 'toggle' }
      ],
      style: [
        {
          key: 'tone',
          label: 'Banner Style & Tone',
          type: 'select',
          options: [
            { label: '🔥 Promo Glow (Purple / Pink)', value: 'promo' },
            { label: 'ℹ️ Info Blue',                 value: 'info' },
            { label: '✅ Success Green',              value: 'success' },
            { label: '⚠️ Warning Amber',             value: 'warning' }
          ]
        },
        {
          key: 'cardStyle',
          label: 'Card Surface',
          type: 'select',
          options: [
            { label: 'Glassmorphism Blur', value: 'glass' },
            { label: 'Solid Card',         value: 'solid' }
          ]
        }
      ]
    },
    template: `
<div class="wb-addon-notice-banner tone-{{tone}} surface-{{cardStyle}}" id="wb-notice-{{tone}}">
  <div class="wb-notice-content">
    {{#if badgeText}}
      <span class="wb-notice-badge">{{badgeText}}</span>
    {{/if}}
    <span class="wb-notice-msg">{{message}}</span>
    {{#if showAction}}
      <a href="{{actionLink}}" class="wb-notice-btn">{{actionText}} &rarr;</a>
    {{/if}}
  </div>
  {{#if dismissible}}
    <button type="button" class="wb-notice-close" onclick="this.closest('.wb-addon-notice-banner').remove();" title="Dismiss">&times;</button>
  {{/if}}
</div>`,
    customCss: `
.wb-addon-notice-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 22px;
  border-radius: var(--radius-lg, 14px);
  margin: 12px 0;
  transition: all 0.3s ease;
  box-sizing: border-box;
}
.wb-addon-notice-banner.surface-glass {
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.14);
}
.wb-addon-notice-banner.surface-solid {
  background: var(--bg-card, #131b2e);
  border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
}
.wb-addon-notice-banner.tone-promo {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(236, 72, 153, 0.18) 100%);
  border-color: rgba(168, 85, 247, 0.4);
  box-shadow: 0 10px 30px -10px rgba(99, 102, 241, 0.3);
}
.wb-addon-notice-banner.tone-info {
  background: rgba(14, 165, 233, 0.15);
  border-color: rgba(14, 165, 233, 0.4);
}
.wb-addon-notice-banner.tone-success {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.4);
}
.wb-addon-notice-banner.tone-warning {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.4);
}
.wb-notice-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 0.92rem;
  color: #f8fafc;
}
.wb-notice-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  background: #6366f1;
  color: #ffffff;
  text-transform: uppercase;
}
.tone-promo .wb-notice-badge {
  background: linear-gradient(135deg, #6366f1, #ec4899);
}
.wb-notice-msg {
  font-weight: 500;
  line-height: 1.4;
}
.wb-notice-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.25);
  transition: all 0.2s ease;
}
.wb-notice-btn:hover {
  background: #ffffff;
  color: #0f172a;
  transform: translateY(-1px);
}
.wb-notice-close {
  background: none;
  border: none;
  color: var(--text-dim, #94a3b8);
  font-size: 1.3rem;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
  border-radius: 6px;
  transition: all 0.2s ease;
}
.wb-notice-close:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}
`
  },
  {
    id: 'addon_step_timeline',
    name: 'Step Process Roadmap',
    category: 'addons',
    icon: '🚀',
    version: '1.0.0',
    author: 'Aether Studio',
    description: 'Visual step-by-step roadmap or onboarding flow with glowing numbers and connected track',
    enabled: true,
    defaultProps: {
      headline: 'Simple 3-Step Procedure',
      subheadline: 'Follow our guided path to full completion',
      accentColor: '#6366f1',
      steps: [
        { stepNum: '1', title: 'Submit Online Registration', desc: 'Fill out your attorney details and select your package.' },
        { stepNum: '2', title: 'Verify Deposit / Payment',   desc: 'Upload your proof of payment or GCash reference number.' },
        { stepNum: '3', title: 'Receive Confirmation Slip',  desc: 'Access your seminar link and get accredited unit credit.' }
      ]
    },
    schema: {
      content: [
        { key: 'headline',    label: 'Main Heading',     type: 'text' },
        { key: 'subheadline', label: 'Subheading',       type: 'textarea' },
        {
          key: 'steps',
          label: '🚀 Timeline Steps',
          type: 'repeater',
          itemLabel: 'Step',
          fields: [
            { key: 'stepNum', label: 'Step Number or Icon', type: 'text' },
            { key: 'title',   label: 'Step Title',          type: 'text' },
            { key: 'desc',    label: 'Step Description',    type: 'textarea' }
          ]
        }
      ],
      style: [
        { key: 'accentColor', label: 'Glow Accent Color', type: 'color', default: '#6366f1' }
      ]
    },
    template: `
<div class="wb-addon-timeline" style="--timeline-accent: {{accentColor}};">
  {{#if headline}}
    <div class="wb-timeline-header">
      <h3 class="wb-timeline-title">{{headline}}</h3>
      {{#if subheadline}}
        <p class="wb-timeline-sub">{{subheadline}}</p>
      {{/if}}
    </div>
  {{/if}}
  <div class="wb-timeline-steps">
    {{#each steps}}
      <div class="wb-timeline-step-card">
        <div class="wb-timeline-num-badge">{{stepNum}}</div>
        <div class="wb-timeline-body">
          <h4 class="wb-timeline-step-title">{{title}}</h4>
          <p class="wb-timeline-step-desc">{{desc}}</p>
        </div>
      </div>
    {{/each}}
  </div>
</div>`,
    customCss: `
.wb-addon-timeline {
  padding: 30px 20px;
  max-width: 1100px;
  margin: 0 auto;
}
.wb-timeline-header {
  text-align: center;
  margin-bottom: 36px;
}
.wb-timeline-title {
  font-size: 1.8rem;
  font-weight: 800;
  color: #ffffff;
  margin: 0 0 8px 0;
}
.wb-timeline-sub {
  font-size: 0.95rem;
  color: var(--text-muted, #94a3b8);
  margin: 0;
}
.wb-timeline-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  position: relative;
}
.wb-timeline-step-card {
  position: relative;
  background: rgba(19, 27, 46, 0.7);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 26px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.wb-timeline-step-card:hover {
  transform: translateY(-4px);
  border-color: var(--timeline-accent, #6366f1);
  box-shadow: 0 16px 36px -12px rgba(99, 102, 241, 0.35);
}
.wb-timeline-num-badge {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--timeline-accent, #6366f1);
  color: #ffffff;
  font-size: 1.2rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px -4px var(--timeline-accent, #6366f1);
}
.wb-timeline-step-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 6px 0;
}
.wb-timeline-step-desc {
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--text-dim, #94a3b8);
  margin: 0;
}
`
  },
  {
    id: 'addon_nav_dropdown',
    name: 'Navbar & Dropdown Menu',
    category: 'addons',
    icon: '🧭',
    version: '1.0.0',
    author: 'Aether Studio',
    description: 'Responsive glass navigation bar with multi-level dropdown submenus and CTA button',
    enabled: true,
    defaultProps: {
      brandName: 'AetherStudio',
      brandLink: 'index.html',
      showCta: true,
      ctaText: 'Get Started',
      ctaLink: '#',
      accentColor: '#6366f1',
      navItems: [
        { label: 'Home', link: 'index.html' },
        {
          label: 'Solutions',
          link: '#',
          children: [
            { label: 'Visual Builder', link: '#' },
            { label: 'Add-on Studio', link: '#' },
            { label: 'Cloud Hosting', link: '#' }
          ]
        },
        {
          label: 'Resources',
          link: '#',
          children: [
            { label: 'Documentation', link: '#' },
            { label: 'API Reference', link: '#' },
            { label: 'Community Forum', link: '#' }
          ]
        },
        { label: 'Pricing', link: '#pricing' },
        { label: 'Contact', link: '#contact' }
      ]
    },
    schema: {
      content: [
        { key: 'brandName', label: 'Brand / Logo Text', type: 'text' },
        { key: 'brandLink', label: 'Brand Link', type: 'page-link' },
        {
          key: 'navItems',
          label: 'Navigation Links & Dropdowns',
          type: 'repeater',
          fields: [
            { key: 'label', label: 'Item Label', type: 'text' },
            { key: 'link', label: 'Destination Link', type: 'page-link' },
            {
              key: 'children',
              label: 'Submenu (Dropdown Items)',
              type: 'repeater',
              fields: [
                { key: 'label', label: 'Sub-item Label', type: 'text' },
                { key: 'link', label: 'Sub-item Link', type: 'page-link' }
              ]
            }
          ]
        },
        { key: 'showCta', label: 'Show Action Button', type: 'toggle' },
        { key: 'ctaText', label: 'Button Label', type: 'text' },
        { key: 'ctaLink', label: 'Button Link', type: 'page-link' }
      ],
      style: [
        { key: 'accentColor', label: 'Brand Accent Color', type: 'color', default: '#6366f1' }
      ]
    },
    template: `
<header class="wb-addon-nav-bar" style="--nav-accent: {{accentColor}};">
  <div class="wb-addon-nav-container">
    <a href="{{brandLink}}" class="wb-addon-brand">{{brandName}}</a>
    <nav class="wb-addon-menu-wrap">
      <ul class="wb-addon-nav-ul">
        {{#each navItems}}
          <li class="wb-addon-nav-li {{#if children}}is-dropdown{{/if}}">
            <a href="{{link}}" class="wb-addon-nav-a">
              <span>{{label}}</span>
              {{#if children}}<span class="wb-nav-caret">▾</span>{{/if}}
            </a>
            {{#if children}}
              <ul class="wb-addon-sub-ul">
                {{#each children}}
                  <li class="wb-addon-sub-li">
                    <a href="{{link}}" class="wb-addon-sub-a">{{label}}</a>
                  </li>
                {{/each}}
              </ul>
            {{/if}}
          </li>
        {{/each}}
      </ul>
    </nav>
    {{#if showCta}}
      <div class="wb-addon-cta-wrap">
        <a href="{{ctaLink}}" class="wb-addon-cta-btn">{{ctaText}} &rarr;</a>
      </div>
    {{/if}}
  </div>
</header>`,
    customCss: `
.wb-addon-nav-bar {
  width: 100%;
  background: rgba(11, 15, 25, 0.85);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
  z-index: 50;
  box-sizing: border-box;
}
.wb-addon-nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.wb-addon-brand {
  font-size: 1.25rem;
  font-weight: 800;
  color: #fff;
  text-decoration: none;
  letter-spacing: -0.02em;
}
.wb-addon-nav-ul {
  display: flex;
  align-items: center;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.wb-addon-nav-li {
  position: relative;
}
.wb-addon-nav-a {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  color: #cbd5e1;
  text-decoration: none;
  font-size: 0.92rem;
  font-weight: 500;
  transition: all 0.2s ease;
}
.wb-addon-nav-a:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.06);
}
.wb-nav-caret {
  font-size: 0.72rem;
  transition: transform 0.2s ease;
}
.wb-addon-nav-li.is-dropdown:hover .wb-nav-caret {
  transform: rotate(180deg);
}
.wb-addon-sub-ul {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 200px;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.5);
  list-style: none;
  margin: 8px 0 0 0;
  padding: 6px;
  display: none;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 100;
}
.wb-addon-nav-li.is-dropdown:hover .wb-addon-sub-ul {
  display: block;
  opacity: 1;
  transform: translateY(0);
}
.wb-addon-sub-a {
  display: block;
  padding: 8px 12px;
  border-radius: 6px;
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.88rem;
  transition: all 0.15s ease;
}
.wb-addon-sub-a:hover {
  color: #ffffff;
  background: rgba(99, 102, 241, 0.18);
}
.wb-addon-cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 8px;
  background: var(--nav-accent, #6366f1);
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.88rem;
  transition: filter 0.2s ease;
}
.wb-addon-cta-btn:hover {
  filter: brightness(1.15);
}
`,
    customJs: `
function onMount(el, props) {
  el.querySelectorAll('.wb-addon-nav-li.is-dropdown').forEach(function(item) {
    var link = item.querySelector('.wb-addon-nav-a');
    if (link) {
      link.addEventListener('click', function(e) {
        if (window.innerWidth <= 768 && item.querySelector('.wb-addon-sub-ul')) {
          e.preventDefault();
          var sub = item.querySelector('.wb-addon-sub-ul');
          var isOpen = sub.style.display === 'block';
          sub.style.display = isOpen ? 'none' : 'block';
          sub.style.opacity = isOpen ? '0' : '1';
        }
      });
    }
  });
}
`
  }
];

// ── 3. ADDON MANAGER CLASS ──────────────────────────────────────────────────
class AddonManager {
  constructor() {
    this.addons = [];
    this.isInitialized = false;
    this.compileAddonTemplate = compileAddonTemplate;
  }

  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Try fetching from server first (data/addons.json)
    let serverAddons = null;
    try {
      const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';
      const res = await fetch(`${apiBase}?action=get_addons&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          serverAddons = data;
        } else if (data && data.success && Array.isArray(data.addons)) {
          serverAddons = data.addons;
        } else if (data && data.success && typeof data.addons === 'string') {
          try { serverAddons = JSON.parse(data.addons); } catch {}
        }
      }
    } catch {}

    // 2. Fallback to localStorage
    let localAddons = null;
    try {
      const raw = localStorage.getItem('aether_installed_addons');
      if (raw) localAddons = JSON.parse(raw);
    } catch {}

    // SMART MERGE: If both server and local cache exist, preserve any user-created custom addons!
    if (serverAddons && Array.isArray(serverAddons) && localAddons && Array.isArray(localAddons)) {
      const serverMap = new Map(serverAddons.map(a => [a.id, a]));
      let hasCustom = false;
      localAddons.forEach(loc => {
        if (loc && loc.id && !serverMap.has(loc.id)) {
          serverAddons.push(loc);
          hasCustom = true;
        }
      });
      if (hasCustom) {
        this.addons = serverAddons;
        this.save(true); // Automatically sync recovered user addons back to server!
      }
    }

    // Choose best source
    let source = serverAddons && serverAddons.length > 0 ? serverAddons : localAddons;

    // If still empty, seed default starter add-ons
    if (!source || !Array.isArray(source) || source.length === 0) {
      source = JSON.parse(JSON.stringify(STARTER_ADDONS));
      this.addons = source;
      this.save(false);
    } else {
      this.addons = source;
    }

    // 3. Register all enabled add-ons into WIDGET_REGISTRY
    this.registerAllEnabled();

    // 4. Inject combined custom CSS
    this.updateCss();
  }

  registerAllEnabled() {
    this.addons.forEach(addon => {
      if (addon.enabled !== false) {
        this.registerWidget(addon);
      }
    });
  }

  registerWidget(addon) {
    if (!addon || !addon.id) return;

    const widgetDef = {
      name: addon.name || 'Custom Add-On',
      category: addon.category || 'addons',
      icon: addon.icon || '🧩',
      description: addon.description || 'Custom installed add-on widget',
      isAddon: true,
      addonId: addon.id,
      version: addon.version || '1.0.0',
      author: addon.author || 'Custom',
      defaultProps: JSON.parse(JSON.stringify(addon.defaultProps || {})),
      schema: JSON.parse(JSON.stringify(addon.schema || { content: [], style: [] })),
      customJs: addon.customJs || '',
      render: function(props, options = {}) {
        return compileAddonTemplate(addon.template, props);
      },
      // Called by the canvas after the widget HTML is injected into the DOM
      mount: function(el, props) {
        if (!addon.customJs || !addon.customJs.trim()) return;
        try {
          // Wrap user code in an IIFE so their local vars are scoped
          const fn = new Function('el', 'props', `
            "use strict";
            ${addon.customJs}
            if (typeof onMount === 'function') { onMount(el, props); }
          `);
          fn(el, props);
        } catch (err) {
          console.warn('[AetherBuilder] Addon JS error in "' + addon.id + '":', err);
        }
      }
    };

    WIDGET_REGISTRY[addon.id] = widgetDef;
  }

  unregisterWidget(addonId) {
    if (WIDGET_REGISTRY[addonId]) {
      delete WIDGET_REGISTRY[addonId];
    }
  }

  async save(syncServer = true) {
    try {
      localStorage.setItem('aether_installed_addons', JSON.stringify(this.addons));
    } catch {}

    if (syncServer) {
      try {
        const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';
        await fetch(`${apiBase}?action=save_addons`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json',
          'X-Admin-Token': _getAdminToken(), },
          body: JSON.stringify(this.addons)
        });
      } catch {}
    }
  }

  updateCss() {
    let styleEl = document.getElementById('aether-addons-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'aether-addons-styles';
      document.head.appendChild(styleEl);
    }
    const combinedCss = this.getAllActiveCss();
    styleEl.textContent = combinedCss;
  }

  getAllActiveCss() {
    return this.addons
      .filter(a => a.enabled !== false && a.customCss)
      .map(a => `/* Add-on: ${a.name} (${a.id}) */\n${a.customCss}`)
      .join('\n\n');
  }

  getAllActiveJs() {
    return this.addons
      .filter(a => a.enabled !== false && a.customJs && a.customJs.trim())
      .map(a => {
        // Wrap each add-on's JS so onMount is scoped and auto-called on matching elements
        return `/* ── Add-on: ${a.name} (${a.id}) ── */
(function() {
  "use strict";
  ${a.customJs}
  if (typeof onMount === 'function') {
    document.querySelectorAll('[data-addon-id="${a.id}"]').forEach(function(el) {
      try { onMount(el, JSON.parse(el.getAttribute('data-addon-props') || '{}')); } catch(e) { console.warn('[Addon JS] ${a.id}:', e); }
    });
  }
})();`;
      })
      .join('\n\n');
  }

  installAddon(addonData) {
    if (!addonData || typeof addonData !== 'object') {
      throw new Error('Invalid add-on package: must be a valid JSON object.');
    }
    if (!addonData.name || !addonData.name.trim()) {
      throw new Error('Invalid add-on package: "name" is required.');
    }
    if (!addonData.template || !addonData.template.trim()) {
      throw new Error('Invalid add-on package: "template" HTML is required.');
    }

    let id = addonData.id;
    if (!id) {
      id = 'addon_' + addonData.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }
    addonData.id = id;
    addonData.category = addonData.category || 'addons';
    addonData.enabled = true;
    addonData.installedAt = new Date().toISOString();

    const existingIdx = this.addons.findIndex(a => a.id === id);
    if (existingIdx !== -1) {
      this.addons[existingIdx] = addonData;
    } else {
      this.addons.push(addonData);
    }

    this.registerWidget(addonData);
    this.updateCss();
    this.save(true);
    return addonData;
  }

  toggleAddon(addonId, enable) {
    const addon = this.addons.find(a => a.id === addonId);
    if (!addon) return;
    addon.enabled = !!enable;

    if (addon.enabled) {
      this.registerWidget(addon);
    } else {
      this.unregisterWidget(addonId);
    }

    this.updateCss();
    this.save(true);
  }

  deleteAddon(addonId) {
    this.unregisterWidget(addonId);
    this.addons = this.addons.filter(a => a.id !== addonId);
    this.updateCss();
    this.save(true);
  }

  exportAddon(addonId) {
    const addon = this.addons.find(a => a.id === addonId);
    if (!addon) return;
    const clean = JSON.parse(JSON.stringify(addon));
    delete clean.installedAt;

    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${addon.id}-v${addon.version || '1.0.0'}.addon.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const addonManager = new AddonManager();

// ── 4. ADD-ON MAKER VISUAL STUDIO WIZARD ────────────────────────────────────
export class AddonMaker {
  static open(existingAddon = null, onSaved = null) {
    const isEdit = !!existingAddon;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay animate-fade-in wb-addon-maker-modal';
    modal.style.zIndex = '99999';

    // Initial state
    const currentData = existingAddon ? JSON.parse(JSON.stringify(existingAddon)) : {
      id: 'addon_' + Date.now().toString(36),
      name: 'Custom Element',
      category: 'addons',
      icon: '🧩',
      version: '1.0.0',
      author: 'Aether Studio',
      description: 'Dynamic custom visual widget',
      defaultProps: {
        heading: 'Hello World',
        subtext: 'This is a custom built widget add-on.',
        accentColor: '#6366f1'
      },
      schema: {
        content: [
          { key: 'heading', label: 'Main Heading', type: 'text' },
          { key: 'subtext', label: 'Description', type: 'textarea' }
        ],
        style: [
          { key: 'accentColor', label: 'Accent Color', type: 'color', default: '#6366f1' }
        ]
      },
      template: `<div class="wb-custom-box" style="--accent: {{accentColor}};">\n  <h3 class="wb-custom-title">{{heading}}</h3>\n  <p class="wb-custom-desc">{{subtext}}</p>\n</div>`,
      customCss: `.wb-custom-box {\n  padding: 24px;\n  border-radius: 14px;\n  background: rgba(19, 27, 46, 0.75);\n  border: 1px solid var(--border-subtle, rgba(255,255,255,0.1));\n  box-shadow: 0 10px 25px rgba(0,0,0,0.3);\n  text-align: center;\n}\n.wb-custom-title {\n  font-size: 1.4rem;\n  font-weight: 800;\n  color: #fff;\n  margin-bottom: 8px;\n}\n.wb-custom-desc {\n  font-size: 0.92rem;\n  color: var(--text-dim, #94a3b8);\n  line-height: 1.5;\n}`
    };

    modal.innerHTML = `
      <div class="modal-box modal-wide" style="max-width: 960px; width: 95vw; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="modal-header" style="padding: 16px 20px; border-bottom: 1px solid var(--border-subtle);">
          <div class="modal-title" style="display:flex;align-items:center;gap:10px;">
            <span style="font-size: 1.4rem;">🧩</span>
            <div>
              <div style="font-weight: 800; font-size: 1.1rem; color: #fff;">${isEdit ? 'Edit Add-On: ' + currentData.name : 'Aether Add-On Maker Studio'}</div>
              <div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 2px;">Design, configure, preview &amp; package custom widgets for AetherBuilder</div>
            </div>
          </div>
          <button class="tool-icon-btn" id="btn-close-maker" style="font-size: 1.2rem;">✕</button>
        </div>

        <!-- Wizard Navigation Tabs -->
        <div class="maker-tabs-bar" style="display:flex;gap:4px;padding:8px 20px;background:rgba(0,0,0,0.25);border-bottom:1px solid var(--border-subtle);overflow-x:auto;">
          <button type="button" class="maker-tab-btn active" data-tab="meta">1. 📝 Identity &amp; Info</button>
          <button type="button" class="maker-tab-btn" data-tab="props">2. ⚙️ Props &amp; Controls</button>
          <button type="button" class="maker-tab-btn" data-tab="template">3. 📄 HTML Template</button>
          <button type="button" class="maker-tab-btn" data-tab="css">4. 🎨 Scoped CSS</button>
          <button type="button" class="maker-tab-btn" data-tab="js">5. ⚡ Client JS</button>
          <button type="button" class="maker-tab-btn" data-tab="preview">6. 👁️ Live Preview</button>
        </div>

        <!-- Body Area -->
        <div class="modal-body" style="flex:1;overflow-y:auto;padding:20px;">
          <!-- TAB 1: META & IDENTITY -->
          <div id="maker-tab-meta" class="maker-tab-pane active">
            <div class="maker-meta-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <span style="font-weight:700;font-size:0.95rem;color:#fff;">Widget Information &amp; Manifest</span>
              <div style="display:flex;align-items:center;gap:8px;">
                <label style="font-size:0.78rem;font-weight:600;color:#f1f5f9;">⚡ Load Starter Preset:</label>
                <select id="maker-preset-select" style="font-size:0.78rem;padding:4px 8px;border-radius:6px;background:var(--bg-elevated);color:#fff;border:1px solid var(--border-subtle);">
                  <option value="">-- Choose Starter --</option>
                  <option value="notice">📣 Notice Alert Banner</option>
                  <option value="timeline">🚀 Step Roadmap Timeline</option>
                  <option value="card">💎 Glass Feature Card</option>
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div>
                <label class="prop-label">Widget Name *</label>
                <input type="text" id="maker-name" value="${currentData.name || ''}" placeholder="e.g. Price Comparison Matrix" />
              </div>
              <div>
                <label class="prop-label">Unique Slug / ID (letters, numbers, underscore) *</label>
                <input type="text" id="maker-id" value="${currentData.id || ''}" placeholder="e.g. addon_pricing_matrix" />
              </div>
              <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;">
                <div>
                  <label class="prop-label">Icon (Emoji or SVG)</label>
                  <input type="text" id="maker-icon" value="${currentData.icon || '🧩'}" style="text-align:center;font-size:1.1rem;" />
                </div>
                <div>
                  <label class="prop-label">Category</label>
                  <input type="text" id="maker-category" value="${currentData.category || 'addons'}" placeholder="addons" />
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div>
                  <label class="prop-label">Version</label>
                  <input type="text" id="maker-version" value="${currentData.version || '1.0.0'}" />
                </div>
                <div>
                  <label class="prop-label">Author / Agency</label>
                  <input type="text" id="maker-author" value="${currentData.author || 'Aether Studio'}" />
                </div>
              </div>
              <div style="grid-column: span 2;">
                <label class="prop-label">Description</label>
                <textarea id="maker-desc" rows="2" placeholder="Brief summary of what this widget does...">${currentData.description || ''}</textarea>
              </div>
            </div>
          </div>

          <!-- TAB 2: PROPS & SCHEMA -->
          <div id="maker-tab-props" class="maker-tab-pane" style="display:none;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <div>
                <div style="font-weight:700;font-size:0.95rem;color:#fff;">Configurable Properties &amp; Controls</div>
                <div style="font-size:0.78rem;color:#cbd5e1;margin-top:2px;">These fields will appear in the Inspector sidebar when an editor clicks this widget.</div>
              </div>
              <button type="button" id="btn-maker-add-prop" class="btn btn-sm btn-primary" style="font-size:0.78rem;font-weight:700;color:#ffffff !important;background:linear-gradient(135deg,#6366f1,#4f46e5);border:1px solid rgba(255,255,255,0.25);padding:6px 14px;box-shadow:0 2px 10px rgba(99,102,241,0.35);border-radius:6px;cursor:pointer;">
                <span style="color:#ffffff !important;">+ Add Prop</span>
              </button>
            </div>
            <div id="maker-props-list" style="display:flex;flex-direction:column;gap:10px;">
              <!-- Dynamically populated rows -->
            </div>
          </div>

          <!-- TAB 3: HTML TEMPLATE -->
          <div id="maker-tab-template" class="maker-tab-pane" style="display:none;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div>
                <div style="font-weight:700;font-size:0.95rem;color:#fff;">Widget HTML Template</div>
                <div style="font-size:0.78rem;color:#cbd5e1;margin-top:2px;">Use double curly braces to output props: <code style="color:#a5b4fc;">{{variableName}}</code></div>
              </div>
            </div>
            <div style="margin-bottom:10px;padding:8px 12px;background:rgba(99,102,241,0.1);border-radius:8px;border:1px solid rgba(99,102,241,0.25);">
              <span style="font-size:0.75rem;font-weight:700;color:#c7d2fe;margin-right:8px;">Click to Insert Prop:</span>
              <span id="maker-token-pills" style="display:inline-flex;flex-wrap:wrap;gap:6px;"></span>
            </div>
            <textarea id="maker-template" rows="12" style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;width:100%;resize:vertical;line-height:1.45;">${currentData.template || ''}</textarea>
          </div>

          <!-- TAB 4: SCOPED CSS -->
          <div id="maker-tab-css" class="maker-tab-pane" style="display:none;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div>
                <div style="font-weight:700;font-size:0.95rem;color:#fff;">Custom Scoped CSS</div>
                <div style="font-size:0.78rem;color:#cbd5e1;margin-top:2px;">Write clean CSS for your widget. It will be loaded on the canvas and in the live site.</div>
              </div>
            </div>
            <textarea id="maker-css" rows="14" style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;width:100%;resize:vertical;line-height:1.45;">${currentData.customCss || ''}</textarea>
          </div>

          <!-- TAB 5: CLIENT JS -->
          <div id="maker-tab-js" class="maker-tab-pane" style="display:none;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div>
                <div style="font-weight:700;font-size:0.95rem;color:#fff;">⚡ Client-Side JavaScript</div>
                <div style="font-size:0.78rem;color:#cbd5e1;margin-top:2px;">Write an <code style="color:#fbbf24;">onMount(el, props)</code> function — called every time your widget is placed on the page.</div>
              </div>
            </div>
            <div style="margin-bottom:10px;padding:10px 14px;background:rgba(251,191,36,0.08);border-radius:8px;border:1px solid rgba(251,191,36,0.25);">
              <div style="font-size:0.74rem;font-weight:700;color:#fde68a;margin-bottom:6px;">📖 Lifecycle API</div>
              <code style="font-size:0.74rem;color:#fcd34d;white-space:pre;display:block;line-height:1.7;">function onMount(el, props) {
  // el  → the root DOM element of your widget
  // props → the resolved prop values (key/value object)
  // Write any interactive JS here:
  //   el.querySelector('.my-btn').addEventListener('click', ...)
  //   setInterval(...)
  //   fetch(...)
}</code>
            </div>
            <textarea id="maker-js" rows="14" style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;width:100%;resize:vertical;line-height:1.45;" placeholder="// Write your onMount(el, props) function here...&#10;function onMount(el, props) {&#10;  // e.g. attach a click counter&#10;  var btn = el.querySelector('.my-btn');&#10;  if (btn) btn.addEventListener('click', function() {&#10;    alert('Clicked!');&#10;  });&#10;}">${currentData.customJs || ''}</textarea>
          </div>

          <!-- TAB 6: LIVE PREVIEW -->
          <div id="maker-tab-preview" class="maker-tab-pane" style="display:none;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <div>
                <div style="font-weight:700;font-size:0.95rem;color:#fff;">Realtime WYSIWYG Live Preview</div>
                <div style="font-size:0.78rem;color:#cbd5e1;margin-top:2px;">Verify how your template and CSS render with the default values.</div>
              </div>
              <button type="button" id="btn-refresh-preview" class="btn btn-sm" style="font-size:0.75rem;padding:5px 12px;color:#ffffff !important;background:rgba(255,255,255,0.08);border:1px solid var(--border-subtle);border-radius:6px;cursor:pointer;">
                <span style="color:#ffffff !important;">🔄 Refresh Preview</span>
              </button>
            </div>
            <div id="maker-preview-container" style="padding:24px;border-radius:12px;background:#090d16;border:1px dashed rgba(255,255,255,0.15);min-height:180px;">
              <!-- Live preview rendered here -->
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="modal-footer" style="padding:14px 20px;border-top:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.2);">
          <div style="display:flex;align-items:center;gap:8px;">
            <button type="button" id="btn-maker-export" class="btn btn-sm" style="background:rgba(255,255,255,0.08);color:#ffffff !important;border:1px solid var(--border-subtle);padding:7px 14px;border-radius:6px;cursor:pointer;">
              <span style="color:#ffffff !important;">📦 Export .json Package</span>
            </button>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" class="btn btn-sm" id="btn-maker-cancel" style="background:rgba(255,255,255,0.06);color:#cbd5e1;border:1px solid var(--border-subtle);padding:7px 14px;border-radius:6px;cursor:pointer;">Cancel</button>
            <button type="button" class="btn btn-sm btn-success" id="btn-maker-save" style="font-weight:700;font-size:0.84rem;padding:9px 20px;color:#ffffff !important;background:linear-gradient(135deg,#10b981,#059669);border:1px solid rgba(255,255,255,0.25);box-shadow:0 4px 16px rgba(16,185,129,0.45);border-radius:8px;cursor:pointer;">
              <span style="color:#ffffff !important;">🚀 Save &amp; Install Add-On</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Tab switcher
    const tabBtns = modal.querySelectorAll('.maker-tab-btn');
    const tabPanes = modal.querySelectorAll('.maker-tab-pane');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.toggle('active', b === btn));
        tabPanes.forEach(p => {
          const isTarget = p.id === `maker-tab-${targetTab}`;
          p.style.display = isTarget ? 'block' : 'none';
          p.classList.toggle('active', isTarget);
        });
        if (targetTab === 'preview') {
          renderPreview();
        }
        if (targetTab === 'template') {
          renderTokenPills();
        }
        if (targetTab === 'js') {
          // Focus the JS editor when switching to that tab
          setTimeout(() => modal.querySelector('#maker-js')?.focus(), 50);
        }
      });
    });

    // Populate Props Table
    const propsListEl = modal.querySelector('#maker-props-list');
    let propsState = [];

    // Flatten existing schema content and style
    const contentFields = (currentData.schema && currentData.schema.content) || [];
    const styleFields = (currentData.schema && currentData.schema.style) || [];
    contentFields.forEach(f => propsState.push({ ...f, section: 'content', defVal: currentData.defaultProps?.[f.key] ?? '' }));
    styleFields.forEach(f => propsState.push({ ...f, section: 'style', defVal: currentData.defaultProps?.[f.key] ?? '' }));

    if (propsState.length === 0) {
      propsState = [
        { key: 'heading', label: 'Main Heading', type: 'text', section: 'content', defVal: 'Welcome to our Seminar' },
        { key: 'accentColor', label: 'Accent Color', type: 'color', section: 'style', defVal: '#6366f1' }
      ];
    }

    // ── Sub-field editor (recursive) ──────────────────────────────────────
    // Renders a visual sub-field list for repeater type props at any depth.
    // depth=0 → top-level repeater fields, depth=1 → nested (submenu) fields
    const SUB_FIELD_TYPES = [
      { value: 'text',         label: 'Text' },
      { value: 'textarea',     label: 'Textarea' },
      { value: 'number',       label: 'Number' },
      { value: 'color',        label: 'Color' },
      { value: 'toggle',       label: 'Toggle' },
      { value: 'image-picker', label: 'Image' },
      { value: 'page-link',    label: 'Link (Page Selector)' },
      { value: 'repeater',     label: 'Repeater (Nested List)' },
    ];

    const buildSubFieldTypeOptions = (selectedType) =>
      SUB_FIELD_TYPES.map(t =>
        `<option value="${t.value}" ${selectedType === t.value ? 'selected' : ''}>${t.label}</option>`
      ).join('');

    const renderSubFieldEditor = (fieldsArray, container, depth = 0) => {
      container.innerHTML = '';
      const indent = depth > 0 ? 'border-left:2px solid rgba(139,92,246,0.35);padding-left:12px;' : '';
      const bgColor = depth === 0
        ? 'rgba(99,102,241,0.07)'
        : 'rgba(139,92,246,0.05)';
      const accentColor = depth === 0 ? '#a5b4fc' : '#c4b5fd';
      const headerLabel = depth === 0 ? '↳ Sub-fields (Repeater Items)' : '↳↳ Nested Sub-fields';

      // Header bar
      const header = document.createElement('div');
      header.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:${bgColor};border-radius:6px 6px 0 0;border:1px solid rgba(99,102,241,0.2);border-bottom:none;${indent}`;
      header.innerHTML = `
        <span style="font-size:0.72rem;font-weight:700;color:${accentColor};letter-spacing:0.04em;">${headerLabel}</span>
        <button type="button" class="btn-add-subfield" style="font-size:0.7rem;font-weight:700;padding:3px 10px;border-radius:5px;background:rgba(99,102,241,0.25);color:${accentColor};border:1px solid rgba(99,102,241,0.35);cursor:pointer;">+ Add Sub-field</button>
      `;
      container.appendChild(header);

      // Sub-field rows wrapper
      const rowsWrap = document.createElement('div');
      rowsWrap.style.cssText = `background:${bgColor};border:1px solid rgba(99,102,241,0.2);border-top:none;border-radius:0 0 6px 6px;padding:8px;display:flex;flex-direction:column;gap:6px;`;

      const renderSubRows = () => {
        rowsWrap.innerHTML = '';
        if (fieldsArray.length === 0) {
          const empty = document.createElement('div');
          empty.style.cssText = 'font-size:0.72rem;color:var(--text-dim);text-align:center;padding:8px;font-style:italic;';
          empty.textContent = 'No sub-fields yet. Click "+ Add Sub-field" to define what each list item contains.';
          rowsWrap.appendChild(empty);
          return;
        }
        fieldsArray.forEach((sf, si) => {
          const sfRow = document.createElement('div');
          sfRow.className = 'maker-subfield-row';
          sfRow.style.cssText = 'display:grid;grid-template-columns:1.2fr 1.2fr 1.2fr 28px;gap:6px;align-items:start;padding:6px 8px;background:rgba(255,255,255,0.03);border:1px solid rgba(99,102,241,0.15);border-radius:6px;';
          sfRow.innerHTML = `
            <div>
              <span style="font-size:0.68rem;font-weight:700;color:#94a3b8;display:block;margin-bottom:2px;">Key</span>
              <input type="text" class="sf-key" value="${sf.key || ''}" placeholder="key" style="font-size:0.73rem;padding:3px 5px;font-family:monospace;width:100%;box-sizing:border-box;" />
            </div>
            <div>
              <span style="font-size:0.68rem;font-weight:700;color:#94a3b8;display:block;margin-bottom:2px;">Label</span>
              <input type="text" class="sf-label" value="${sf.label || ''}" placeholder="Label" style="font-size:0.73rem;padding:3px 5px;width:100%;box-sizing:border-box;" />
            </div>
            <div>
              <span style="font-size:0.68rem;font-weight:700;color:#94a3b8;display:block;margin-bottom:2px;">Type</span>
              <select class="sf-type" style="font-size:0.73rem;padding:3px 5px;width:100%;box-sizing:border-box;">
                ${buildSubFieldTypeOptions(sf.type || 'text')}
              </select>
            </div>
            <div style="display:flex;align-items:flex-end;padding-bottom:2px;">
              <button type="button" class="sf-del" style="color:#f87171;font-size:0.8rem;padding:3px;cursor:pointer;background:none;border:none;" title="Remove">🗑️</button>
            </div>
          `;

          // Nested sub-field container (shown when type = repeater)
          const nestedContainer = document.createElement('div');
          nestedContainer.style.cssText = 'grid-column:1/-1;margin-top:4px;display:' + (sf.type === 'repeater' ? 'block' : 'none') + ';';
          if (!Array.isArray(sf.fields)) sf.fields = [];
          if (sf.type === 'repeater' && depth < 1) {
            renderSubFieldEditor(sf.fields, nestedContainer, depth + 1);
          }
          sfRow.appendChild(nestedContainer);

          // Listeners
          sfRow.querySelector('.sf-key').addEventListener('input', (e) => { sf.key = e.target.value; });
          sfRow.querySelector('.sf-label').addEventListener('input', (e) => { sf.label = e.target.value; });
          sfRow.querySelector('.sf-type').addEventListener('change', (e) => {
            sf.type = e.target.value;
            if (sf.type === 'repeater' && depth < 1) {
              if (!Array.isArray(sf.fields)) sf.fields = [];
              nestedContainer.style.display = 'block';
              renderSubFieldEditor(sf.fields, nestedContainer, depth + 1);
            } else {
              nestedContainer.style.display = 'none';
            }
          });
          sfRow.querySelector('.sf-del').addEventListener('click', () => {
            fieldsArray.splice(si, 1);
            renderSubRows();
          });

          rowsWrap.appendChild(sfRow);
        });
      };

      renderSubRows();
      container.appendChild(rowsWrap);

      // Add sub-field button
      header.querySelector('.btn-add-subfield').addEventListener('click', () => {
        fieldsArray.push({ key: 'field_' + (fieldsArray.length + 1), label: 'Field ' + (fieldsArray.length + 1), type: 'text' });
        renderSubRows();
      });
    };
    // ── End sub-field editor ───────────────────────────────────────────────

    const renderPropsRows = () => {
      propsListEl.innerHTML = '';
      propsState.forEach((prop, idx) => {
        // Outer wrapper so sub-field panel sits below the main row
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;gap:0;';

        const row = document.createElement('div');
        row.className = 'maker-prop-row';
        row.style.cssText = 'display:grid;grid-template-columns:1.5fr 1.5fr 1fr 1fr 1.5fr 36px;gap:8px;align-items:center;padding:8px 10px;background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:' + (prop.type === 'repeater' ? '8px 8px 0 0' : '8px') + ';';
        row.innerHTML = `
          <div>
            <span style="font-size:0.74rem;font-weight:700;color:#e2e8f0;margin-bottom:4px;display:block;">Variable Key</span>
            <input type="text" class="prop-key-input" value="${prop.key || ''}" style="font-size:0.75rem;padding:4px 6px;font-family:monospace;" placeholder="key" />
          </div>
          <div>
            <span style="font-size:0.74rem;font-weight:700;color:#e2e8f0;margin-bottom:4px;display:block;">Label</span>
            <input type="text" class="prop-label-input" value="${prop.label || ''}" style="font-size:0.75rem;padding:4px 6px;" placeholder="Label" />
          </div>
          <div>
            <span style="font-size:0.74rem;font-weight:700;color:#e2e8f0;margin-bottom:4px;display:block;">Control Type</span>
            <select class="prop-type-select" style="font-size:0.75rem;padding:4px 6px;">
              <option value="text" ${prop.type === 'text' ? 'selected' : ''}>Text</option>
              <option value="textarea" ${prop.type === 'textarea' ? 'selected' : ''}>Textarea</option>
              <option value="color" ${prop.type === 'color' ? 'selected' : ''}>Color</option>
              <option value="number" ${prop.type === 'number' ? 'selected' : ''}>Number</option>
              <option value="toggle" ${prop.type === 'toggle' ? 'selected' : ''}>Toggle</option>
              <option value="select" ${prop.type === 'select' ? 'selected' : ''}>Select</option>
              <option value="image-picker" ${prop.type === 'image-picker' ? 'selected' : ''}>Image</option>
              <option value="page-link" ${prop.type === 'page-link' ? 'selected' : ''}>Link</option>
              <option value="repeater" ${prop.type === 'repeater' ? 'selected' : ''}>Repeater (List)</option>
              <option value="form-builder" ${prop.type === 'form-builder' ? 'selected' : ''}>Form Fields Builder</option>
            </select>
          </div>
          <div>
            <span style="font-size:0.74rem;font-weight:700;color:#e2e8f0;margin-bottom:4px;display:block;">Inspector Tab</span>
            <select class="prop-sec-select" style="font-size:0.75rem;padding:4px 6px;">
              <option value="content" ${prop.section === 'content' ? 'selected' : ''}>Content</option>
              <option value="style" ${prop.section === 'style' ? 'selected' : ''}>Style</option>
            </select>
          </div>
          <div>
            <span style="font-size:0.74rem;font-weight:700;color:#e2e8f0;margin-bottom:4px;display:block;">Default Value</span>
            <input type="text" class="prop-val-input" value="${prop.defVal ?? ''}" style="font-size:0.75rem;padding:4px 6px;" placeholder="${prop.type === 'repeater' ? 'n/a — use sub-fields' : 'default'}" ${prop.type === 'repeater' ? 'disabled' : ''} />
          </div>
          <div>
            <span style="font-size:0.74rem;color:transparent;display:block;margin-bottom:4px;">x</span>
            <button type="button" class="tool-icon-btn btn-del-prop" style="color:#f87171;padding:4px;" title="Remove Prop">🗑️</button>
          </div>
        `;

        // Sub-field panel (shown only when type = repeater)
        const subFieldPanel = document.createElement('div');
        subFieldPanel.style.cssText = 'display:' + (prop.type === 'repeater' ? 'block' : 'none') + ';margin-bottom:4px;';
        if (!Array.isArray(prop.fields)) prop.fields = [];
        if (prop.type === 'repeater') {
          renderSubFieldEditor(prop.fields, subFieldPanel, 0);
        }

        // Listeners
        row.querySelector('.prop-key-input').addEventListener('input', (e) => { prop.key = e.target.value; renderTokenPills(); });
        row.querySelector('.prop-label-input').addEventListener('input', (e) => { prop.label = e.target.value; });
        row.querySelector('.prop-type-select').addEventListener('change', (e) => {
          prop.type = e.target.value;
          const isRepeater = prop.type === 'repeater';
          row.style.borderRadius = isRepeater ? '8px 8px 0 0' : '8px';
          const valInput = row.querySelector('.prop-val-input');
          valInput.disabled = isRepeater;
          valInput.placeholder = isRepeater ? 'n/a — use sub-fields' : 'default';
          if (isRepeater) {
            if (!Array.isArray(prop.fields)) prop.fields = [];
            subFieldPanel.style.display = 'block';
            renderSubFieldEditor(prop.fields, subFieldPanel, 0);
          } else {
            subFieldPanel.style.display = 'none';
          }
        });
        row.querySelector('.prop-sec-select').addEventListener('change', (e) => { prop.section = e.target.value; });
        row.querySelector('.prop-val-input').addEventListener('input', (e) => { prop.defVal = e.target.value; });
        row.querySelector('.btn-del-prop').addEventListener('click', () => {
          propsState.splice(idx, 1);
          renderPropsRows();
          renderTokenPills();
        });

        wrapper.appendChild(row);
        wrapper.appendChild(subFieldPanel);
        propsListEl.appendChild(wrapper);
      });
    };

    renderPropsRows();

    modal.querySelector('#btn-maker-add-prop').addEventListener('click', () => {
      propsState.push({
        key: 'newProp_' + (propsState.length + 1),
        label: 'New Property',
        type: 'text',
        section: 'content',
        defVal: ''
      });
      renderPropsRows();
      renderTokenPills();
    });

    // Token Pills in Template Tab
    const renderTokenPills = () => {
      const container = modal.querySelector('#maker-token-pills');
      if (!container) return;
      container.innerHTML = '';
      propsState.forEach(p => {
        if (!p.key) return;
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.style.cssText = 'padding:2px 8px;border-radius:4px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);color:#a5b4fc;font-size:0.72rem;cursor:pointer;font-family:monospace;';
        pill.textContent = `{{${p.key}}}`;
        pill.title = `Insert {{${p.key}}}`;
        pill.addEventListener('click', () => {
          const tArea = modal.querySelector('#maker-template');
          const token = `{{${p.key}}}`;
          const start = tArea.selectionStart;
          const end = tArea.selectionEnd;
          tArea.value = tArea.value.substring(0, start) + token + tArea.value.substring(end);
          tArea.selectionStart = tArea.selectionEnd = start + token.length;
          tArea.focus();
        });
        container.appendChild(pill);
      });
    };

    // Preset selector loader
    const presetSelect = modal.querySelector('#maker-preset-select');
    presetSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (!val) return;
      const starter = STARTER_ADDONS.find(s => s.id.includes(val));
      if (starter) {
        modal.querySelector('#maker-name').value = starter.name;
        modal.querySelector('#maker-id').value = starter.id;
        modal.querySelector('#maker-icon').value = starter.icon;
        modal.querySelector('#maker-desc').value = starter.description;
        modal.querySelector('#maker-template').value = starter.template;
        modal.querySelector('#maker-css').value = starter.customCss || '';
        modal.querySelector('#maker-js').value = starter.customJs || '';

        propsState = [];
        const cF = (starter.schema && starter.schema.content) || [];
        const sF = (starter.schema && starter.schema.style) || [];
        cF.forEach(f => propsState.push({ ...f, section: 'content', defVal: starter.defaultProps?.[f.key] ?? '' }));
        sF.forEach(f => propsState.push({ ...f, section: 'style', defVal: starter.defaultProps?.[f.key] ?? '' }));
        renderPropsRows();
        renderTokenPills();
      }
    });

    // Auto slugify ID when typing Name
    const nameInput = modal.querySelector('#maker-name');
    const idInput = modal.querySelector('#maker-id');
    nameInput.addEventListener('input', () => {
      if (!isEdit && (!idInput.dataset.manual)) {
        idInput.value = 'addon_' + nameInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      }
    });
    idInput.addEventListener('input', () => { idInput.dataset.manual = 'true'; });

    // Live Preview Renderer
    const renderPreview = () => {
      const previewContainer = modal.querySelector('#maker-preview-container');
      const templateStr = modal.querySelector('#maker-template').value;
      const cssStr = modal.querySelector('#maker-css').value;

      // Build sample props
      const testProps = {};
      propsState.forEach(p => {
        if (!p.key) return;
        testProps[p.key] = p.defVal ?? '';
      });

      // Inject preview scoped CSS
      let prevStyle = document.getElementById('maker-preview-scoped-style');
      if (!prevStyle) {
        prevStyle = document.createElement('style');
        prevStyle.id = 'maker-preview-scoped-style';
        document.head.appendChild(prevStyle);
      }
      prevStyle.textContent = cssStr;

      try {
        const renderedHtml = compileAddonTemplate(templateStr, testProps);
        previewContainer.innerHTML = renderedHtml || '<span style="color:#94a3b8;font-size:0.88rem;">Template is empty.</span>';
      } catch (err) {
        previewContainer.innerHTML = `<div style="color:#f87171;font-size:0.85rem;">Preview Error: ${err.message}</div>`;
      }
    };

    modal.querySelector('#btn-refresh-preview')?.addEventListener('click', renderPreview);

    // Save and Install
    const saveAddonPackage = () => {
      const name = nameInput.value.trim();
      const id = idInput.value.trim();
      const template = modal.querySelector('#maker-template').value.trim();
      const customCss = modal.querySelector('#maker-css').value.trim();
      const customJs = modal.querySelector('#maker-js').value.trim();

      if (!name) { alert('Please provide a Widget Name.'); return null; }
      if (!id) { alert('Please provide a Unique ID.'); return null; }
      if (!template) { alert('Please write an HTML Template.'); return null; }

      // Validate JS: if provided it must define an onMount function
      if (customJs && !/function\s+onMount\s*\(/.test(customJs)) {
        const ok = confirm('⚠️ Your Client JS does not define an "onMount" function.\n\nThe code will still be saved but may not execute automatically.\n\nContinue anyway?');
        if (!ok) return null;
      }

      // Build defaultProps & schema
      const defaultProps = {};
      const schema = { content: [], style: [] };

      propsState.forEach(p => {
        if (!p.key) return;
        let defValue = p.defVal;
        if (p.type === 'number') {
          defValue = parseFloat(p.defVal) || 0;
        } else if (p.type === 'toggle') {
          defValue = (p.defVal === 'true' || p.defVal === true);
        } else if (p.type === 'repeater') {
          if (typeof p.defVal === 'string' && p.defVal.trim()) {
            try {
              defValue = JSON.parse(p.defVal);
            } catch (_) {
              defValue = [];
            }
          } else if (Array.isArray(p.defVal)) {
            defValue = p.defVal;
          } else {
            defValue = [];
          }
        }
        defaultProps[p.key] = defValue;

        const fieldItem = { key: p.key, label: p.label || p.key, type: p.type || 'text' };
        if (p.type === 'repeater') {
          if (p.fields && Array.isArray(p.fields) && p.fields.length > 0) {
            fieldItem.fields = p.fields;
          } else if (Array.isArray(defValue) && defValue.length > 0 && typeof defValue[0] === 'object' && defValue[0] !== null) {
            fieldItem.fields = Object.keys(defValue[0]).map(k => {
              const val = defValue[0][k];
              let fType = 'text';
              if (typeof val === 'boolean') fType = 'toggle';
              else if (typeof val === 'number') fType = 'number';
              else if (Array.isArray(val) || k === 'children' || k === 'subItems') {
                fType = 'repeater';
                const subSample = (Array.isArray(val) && val[0]) ? val[0] : {};
                const subKeys = Object.keys(subSample);
                const subFields = subKeys.length ? subKeys.map(sk => ({
                  key: sk,
                  label: sk.charAt(0).toUpperCase() + sk.slice(1),
                  type: (sk === 'link' || sk === 'url') ? 'page-link' : 'text'
                })) : [
                  { key: 'label', label: 'Label', type: 'text' },
                  { key: 'link', label: 'Link', type: 'page-link' }
                ];
                return { key: k, label: k.charAt(0).toUpperCase() + k.slice(1), type: 'repeater', fields: subFields };
              } else if (k === 'link' || k === 'url' || k === 'page') fType = 'page-link';
              else if (k.toLowerCase().includes('image') || k.toLowerCase().includes('photo')) fType = 'image-picker';
              return { key: k, label: k.charAt(0).toUpperCase() + k.slice(1), type: fType };
            });
          } else {
            fieldItem.fields = [
              { key: 'label', label: 'Label', type: 'text' },
              { key: 'link', label: 'Link', type: 'page-link' },
              {
                key: 'children',
                label: 'Submenu (Children)',
                type: 'repeater',
                fields: [
                  { key: 'label', label: 'Submenu Label', type: 'text' },
                  { key: 'link', label: 'Submenu Link', type: 'page-link' }
                ]
              }
            ];
          }
        }

        if (p.section === 'style') {
          schema.style.push(fieldItem);
        } else {
          schema.content.push(fieldItem);
        }
      });

      const pkg = {
        id,
        name,
        category: modal.querySelector('#maker-category').value.trim() || 'addons',
        icon: modal.querySelector('#maker-icon').value.trim() || '🧩',
        version: modal.querySelector('#maker-version').value.trim() || '1.0.0',
        author: modal.querySelector('#maker-author').value.trim() || 'Aether Studio',
        description: modal.querySelector('#maker-desc').value.trim(),
        enabled: true,
        defaultProps,
        schema,
        template,
        customCss,
        customJs: customJs || ''
      };

      addonManager.installAddon(pkg);
      return pkg;
    };

    modal.querySelector('#btn-maker-save').addEventListener('click', () => {
      const pkg = saveAddonPackage();
      if (pkg) {
        modal.remove();
        if (typeof onSaved === 'function') onSaved(pkg);
      }
    });

    modal.querySelector('#btn-maker-export').addEventListener('click', () => {
      const pkg = saveAddonPackage();
      if (pkg) {
        addonManager.exportAddon(pkg.id);
      }
    });

    // Close
    const closeBtn = modal.querySelector('#btn-close-maker');
    const cancelBtn = modal.querySelector('#btn-maker-cancel');
    const doClose = () => {
      modal.remove();
      const prevStyle = document.getElementById('maker-preview-scoped-style');
      if (prevStyle) prevStyle.remove();
    };
    closeBtn.addEventListener('click', doClose);
    cancelBtn.addEventListener('click', doClose);
  }
}
