import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

// 1. Clean and recreate dist directory
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true, force: true });
}
fs.mkdirSync(DIST, { recursive: true });

// 2. Helper to copy directories recursively
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 3. Copy all application asset directories into dist
['css', 'js', 'data', 'assets', 'public'].forEach((dir) => {
  copyDirSync(path.join(ROOT, dir), path.join(DIST, dir));
});

// 4. Copy root static files into dist
['index.html', 'admin.html', 'public.html', 'favicon.ico', 'favicon.png', 'sw.js', 'version.json'].forEach((file) => {
  const src = path.join(ROOT, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DIST, file));
  }
});

console.log('[Build] Successfully generated complete production dist/ bundle with all CSS, JS, HTML and assets.');
