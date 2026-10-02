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
      var resetId = window.__NEPTRANSLATE_TG__.runId;
      if (window.__NEPTRANSLATE_TG__.resetTimers && resetId && sessionStorage.getItem('neptranslate.tg.lastTimerReset') !== resetId) {
        ['nepx.entitlement.v1', 'neptranslate.ads.provisional_grant.v1', '@neptranslate/banner_cooldown_v1', '@neptranslate/ads/foregroundActiveMs', '@neptranslate/ads/interstitialNyDay', '@neptranslate/ads/interstitialNyCount', 'neptranslate.dailyOpen.v1'].forEach(function(key) { localStorage.removeItem(key); });
        var installationId = localStorage.getItem('neptranslate.installation.v1') || 'inst_testing_ground_reset';
        localStorage.setItem('neptranslate.installation.v1', installationId);
        var nyDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        localStorage.setItem('neptranslate.dailyOpen.v2', JSON.stringify({ schemaVersion: 2, installationId: installationId, nyDate: nyDate, untilMs: 0, adDismissed: true, welcomed: true, pendingFlight: null, receipt: installationId + ':' + nyDate }));
        sessionStorage.setItem('neptranslate.tg.lastTimerReset', resetId);
      }
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

function rewriteHostedAssetPaths(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      rewriteHostedAssetPaths(full);
      continue;
    }
    if (!/\.(js|css|html|json)$/i.test(entry.name)) continue;
    const text = fs.readFileSync(full, 'utf8');
    const next = text
      .replaceAll('"/assets/', '"/hosted-app/assets/')
      .replaceAll("'/assets/", "'/hosted-app/assets/")
      .replaceAll('"/_expo/', '"/hosted-app/_expo/')
      .replaceAll("'/_expo/", "'/hosted-app/_expo/");
    if (next !== text) fs.writeFileSync(full, next, 'utf8');
  }
}

rmrf(dest);
copyDir(srcDist, dest);
const indexPath = path.join(dest, 'index.html');
const rewritten = rewriteIndex(fs.readFileSync(indexPath, 'utf8'));
fs.writeFileSync(indexPath, rewritten, 'utf8');
rewriteHostedAssetPaths(dest);
console.log(`[prepare-hosted-app] Wrote ${dest}`);

// Local neural assets: copied from the same pinned bundles packaged into iOS.
const modelSource = path.join(repoRoot, 'mobile', 'assets', 'models');
if (fs.existsSync(modelSource)) copyDir(modelSource, path.join(root, 'public', 'models'));
const runtimeSource = path.join(repoRoot, 'mobile', 'node_modules', 'onnxruntime-web', 'dist');
const runtimeDest = path.join(root, 'public', 'model-runtime');
fs.mkdirSync(runtimeDest, { recursive: true });
for (const name of ['ort.wasm.min.js', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  fs.copyFileSync(path.join(runtimeSource, name), path.join(runtimeDest, name));
}
