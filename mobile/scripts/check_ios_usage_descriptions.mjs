import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const expoCli = require.resolve('expo/bin/cli');

// Inspect the result of every iOS config plugin, not just the app.json input.
const result = spawnSync(process.execPath, [expoCli, 'config', '--type', 'introspect', '--json'], {
  cwd: mobileRoot,
  env: { ...process.env, EXPO_PUBLIC_ADS_ENV: 'test' },
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});
if (result.error) throw result.error;
assert.equal(result.status, 0, result.stderr || 'Expo config introspection failed');

const infoPlist = JSON.parse(result.stdout)._internal?.modResults?.ios?.infoPlist;
assert.ok(infoPlist, 'Expo did not generate an iOS Info.plist');
for (const key of [
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSSpeechRecognitionUsageDescription',
  'NSPhotoLibraryUsageDescription',
]) {
  assert.ok(typeof infoPlist[key] === 'string' && infoPlist[key].trim(), `${key} missing from generated Info.plist`);
}
console.log('iOS Camera, microphone, speech, and photo purpose strings present in generated Info.plist');
