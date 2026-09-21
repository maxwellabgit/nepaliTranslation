/**
 * Copy mobile/dist → public/hosted-app and rewrite root-absolute asset URLs
 * so the Expo web export works under /hosted-app/ inside the Vite/Tauri shell.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(root, '..');
const srcDist = path.join(repoRoot, 'mobile', 'dist');
const dest = path.join(root, 'public', 'hosted-app');

const BRIDGE_BOOT = `
<script id="neptranslate-tg-boot">
(function () {
  try {
    var host = window.parent && window.parent.__NEPTRANSLATE_TG_HOST__;
    if (host && typeof host.getBootConfig === 'function') {
      window.__NEPTRANSLATE_TG__ = host.getBootConfig();
    }
  } catch (e) {}
  window.addEventListener('message', function (ev) {
    if (!ev.data || ev.data.type !== 'neptranlate-tg') return;
    if (ev.data.channel === 'config' && ev.data.payload) {
      window.__NEPTRANSLATE_TG__ = Object.assign(
        {},
        window.__NEPTRANSLATE_TG__ || {},
        ev.data.payload
      );
      window.dispatchEvent(
        new CustomEvent('neptranlate-tg-update', {
          detail: window.__NEPTRANSLATE_TG__,
        })
      );
    }
  });
})();
</script>
`;

function rmrf(p) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
  }
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function rewriteIndex(html) {
  let out = html
    .replace(/(href|src)="\/([^"]*)"/g, '$1="./$2"')
    .replace(/(href|src)='\/([^']*)'/g, "$1='./$2'");
  if (!out.includes('neptranslate-tg-boot')) {
    out = out.replace(/<body([^>]*)>/i, `<body$1>${BRIDGE_BOOT}`);
  }
  return out;
}

if (!fs.existsSync(srcDist) || !fs.existsSync(path.join(srcDist, 'index.html'))) {
  console.error(
    `[prepare-hosted-app] Missing mobile/dist. Run: cd mobile && npx expo export --platform web`,
  );
  process.exit(1);
}

rmrf(dest);
copyDir(srcDist, dest);
const indexPath = path.join(dest, 'index.html');
const rewritten = rewriteIndex(fs.readFileSync(indexPath, 'utf8'));
fs.writeFileSync(indexPath, rewritten, 'utf8');
console.log(`[prepare-hosted-app] Wrote ${dest}`);
