<?php
/**
 * AetherBuilder — index.php
 * PHP wrapper to prevent LiteSpeed/server-side caching of this entry point.
 * Identical to index.html but served as PHP so it's never statically cached.
 */
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Comprehensive Browser Defense & Security Headers (Defense-in-depth for OpenResty / LiteSpeed)
header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
header('X-Frame-Options: SAMEORIGIN');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=()');
header("Content-Security-Policy: default-src 'self' 'unsafe-inline' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob: data:; style-src 'self' 'unsafe-inline' https:; font-src 'self' https: data:; img-src 'self' data: blob: https:; media-src 'self' https: data: blob:; connect-src 'self' https: wss: blob:; frame-src 'self' https:; frame-ancestors 'self';");
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AetherBuilder</title>
  <meta name="description" content="AetherBuilder - Modern No-Code Website & Page Builder Engine">
  <meta property="og:title" content="AetherBuilder">
  <meta property="og:description" content="AetherBuilder - Modern No-Code Website & Page Builder Engine">

  <!-- Favicon & Icons -->
  <link rel="icon" type="image/png" href="favicon.png">
  <link rel="shortcut icon" href="favicon.ico">

  <!-- Typography & Google Fonts Pre-fetch -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">

  <!-- Core Design System & Component Styles -->
  <link rel="stylesheet" href="css/design-system.css?v=<?php echo filemtime(__DIR__.'/css/design-system.css'); ?>">
  <link rel="stylesheet" href="css/animations.css?v=<?php echo filemtime(__DIR__.'/css/animations.css'); ?>">
  <link rel="stylesheet" href="css/widgets.css?v=<?php echo filemtime(__DIR__.'/css/widgets.css'); ?>">
  <link rel="stylesheet" href="css/builder.css?v=<?php echo filemtime(__DIR__.'/css/builder.css'); ?>">

  <!-- Argon2 WebAssembly Engine (Local copy with dynamic fallback) -->
  <script src="js/vendor/argon2.umd.min.js"></script>
  <script src="js/vendor/qrcode.min.js"></script>
  <script>
    if (!window.hashwasm || !window.hashwasm.argon2id) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/hash-wasm@4/dist/argon2.umd.min.js';
      document.head.appendChild(s);
    }
  </script>
  <!-- Synchronously check pre-loader configuration before <body> parses to avoid any black screen flash -->
  <script>
    (function() {
      try {
        var raw = localStorage.getItem('aether_site_loader_config');
        var cfg = null;
        if (raw) {
          cfg = JSON.parse(raw);
        } else {
          var draft = localStorage.getItem('aether_builder_draft_v2') || localStorage.getItem('aether_public_site_v2');
          if (draft) {
            var d = JSON.parse(draft);
            var ss = d && d.siteSettings ? d.siteSettings : null;
            if (ss) {
              cfg = {
                enabled: ss.loaderEnabled !== false && (ss.loader ? ss.loader.enabled !== false : true),
                caption: ss.loaderCaption !== undefined ? ss.loaderCaption : (ss.loader && ss.loader.caption !== undefined ? ss.loader.caption : (ss.siteName ? 'Loading ' + ss.siteName + '...' : 'Loading...')),
                subcaption: ss.loaderSubcaption !== undefined ? ss.loaderSubcaption : (ss.loader && ss.loader.subcaption !== undefined ? ss.loader.subcaption : 'Initializing modules & layout engine'),
                showSubcaption: ss.loaderShowSubcaption !== false && (ss.loader ? ss.loader.showSubcaption !== false : true)
              };
            }
          }
        }
        window.__AETHER_LOADER_CFG = cfg;
        // If splash screen is disabled: inject instant-hide style so browser NEVER paints the black screen or spinner overlay
        if (cfg && cfg.enabled === false) {
          var s = document.createElement('style');
          s.id = 'aether-loader-instant-hide';
          s.textContent = '#aether-initial-loader { display: none !important; }';
          document.head.appendChild(s);
        }
        // If subcaption is unchecked: inject style so "Initializing modules & layout engine" never flashes or animates
        if (cfg && (cfg.showSubcaption === false || cfg.subcaption === false || cfg.subcaption === '')) {
          var subS = document.createElement('style');
          subS.id = 'aether-subcaption-instant-hide';
          subS.textContent = '#aether-loader-subcaption { display: none !important; }';
          document.head.appendChild(subS);
        }
      } catch(e) {}
    })();
  </script>
</head>
<body>
  <!-- Initial Loading Shell (Dismissed automatically when app renders; completely bypassed when splash screen is disabled) -->
  <div id="aether-initial-loader" style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#090d16;color:#e2e8f0;font-family:'Plus Jakarta Sans',sans-serif;z-index:999;transition:opacity 0.2s ease;">
    <div style="width:40px;height:40px;border:3px solid rgba(99,102,241,0.2);border-top-color:#6366f1;border-radius:50%;animation:aether-spin 0.8s linear infinite;margin-bottom:16px;"></div>
    <div id="aether-loader-caption" style="font-size:0.95rem;font-weight:600;letter-spacing:0.02em;">Loading...</div>
    <div id="aether-loader-subcaption" style="font-size:0.75rem;color:#94a3b8;margin-top:4px;">Initializing modules & layout engine</div>
    <style>@keyframes aether-spin{to{transform:rotate(360deg)}}</style>
  </div>
  <script>
    (function() {
      try {
        var cfg = window.__AETHER_LOADER_CFG;
        var loaderEl = document.getElementById('aether-initial-loader');
        if (cfg && cfg.enabled === false) {
          if (loaderEl) {
            loaderEl.style.display = 'none';
            try { loaderEl.remove(); } catch(e){}
          }
          return;
        }
        var cap = document.getElementById('aether-loader-caption');
        var sub = document.getElementById('aether-loader-subcaption');
        if (cfg) {
          if (cap) {
            if (cfg.caption === false || cfg.caption === '') {
              cap.style.display = 'none';
            } else {
              cap.textContent = cfg.caption;
            }
          }
          if (sub) {
            if (cfg.showSubcaption === false || cfg.subcaption === false || cfg.subcaption === '') {
              sub.style.display = 'none';
            } else {
              sub.textContent = cfg.subcaption;
            }
          }
        }
      } catch(e) {}
    })();

    // Failsafe auto-dismiss: ensure loader never blocks screen if app takes time or finishes
    if (!window.__AETHER_LOADER_CFG || window.__AETHER_LOADER_CFG.enabled !== false) {
      setTimeout(function() {
        var l = document.getElementById('aether-initial-loader');
        if (l) {
          l.style.opacity = '0';
          l.style.pointerEvents = 'none';
          l.style.display = 'none';
          try { l.remove(); } catch(e){}
        }
      }, 400);
    }
  </script>

  <noscript>
    <div style="padding: 40px; text-align: center; color: #fff; background: #0b0f19;">
      <h2>JavaScript Required</h2>
      <p>AetherBuilder requires JavaScript to render the visual canvas and compute Argon2 cryptographic hashes.</p>
    </div>
  </noscript>

  <!-- Main ES Module Bootstrap -->
  <script type="module" src="js/app.js?v=<?php echo filemtime(__DIR__.'/js/app.js'); ?>"></script>
</body>
</html>
