/**
 * Pack IndicTrans2 ONNX folders into the native iOS/Android app so install
 * includes the model (no first-launch Hugging Face download).
 *
 * Expects mobile/assets/models/it2_en_indic + it2_indic_en (see
 * scripts/eas_fetch_it2_models.mjs / eas-build-post-install).
 */
const {
  withDangerousMod,
  withXcodeProject,
  IOSConfig,
  createRunOncePlugin,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MODEL_DIRS = ['it2_en_indic', 'it2_indic_en'];
const REQUIRED = [
  'encoder_model.onnx',
  'encoder_model.onnx.data',
  'decoder_model.onnx',
  'decoder_with_past_model.onnx',
  'decoder_shared.onnx.data',
  'tokenizer_src.json',
  'tokenizer_tgt.json',
  'tokenizer_meta.json',
  'generation_config.json',
];

function modelsSrc(projectRoot) {
  return path.join(projectRoot, 'assets', 'models');
}

function modelsComplete(projectRoot) {
  const root = modelsSrc(projectRoot);
  for (const dir of MODEL_DIRS) {
    for (const file of REQUIRED) {
      const p = path.join(root, dir, file);
      if (!fs.existsSync(p) || fs.statSync(p).size <= 0) return false;
    }
  }
  return true;
}

function ensureModelsPresent(projectRoot) {
  if (modelsComplete(projectRoot)) return;

  // EAS sometimes skips npm lifecycle hooks; fetch here during prebuild.
  const script = path.join(projectRoot, 'scripts', 'eas_fetch_it2_models.mjs');
  if (!fs.existsSync(script)) {
    throw new Error(
      `[withIt2Models] Missing ${script}. Add scripts/eas_fetch_it2_models.mjs`,
    );
  }
  console.log('[withIt2Models] Models missing — running eas_fetch_it2_models.mjs');
  const { spawnSync } = require('child_process');
  const result = spawnSync(process.execPath, [script], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `[withIt2Models] Failed to download IndicTrans2 models (exit ${result.status})`,
    );
  }
  if (!modelsComplete(projectRoot)) {
    throw new Error(
      `[withIt2Models] Models still incomplete after fetch under assets/models/`,
    );
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function withAndroidModels(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      ensureModelsPresent(projectRoot);
      const dest = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets',
        'models',
      );
      fs.rmSync(dest, { recursive: true, force: true });
      copyDir(modelsSrc(projectRoot), dest);
      return cfg;
    },
  ]);
}

function withIosModelFiles(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      ensureModelsPresent(projectRoot);
      const dest = path.join(
        cfg.modRequest.platformProjectRoot,
        'NepTranslateModels',
        'models',
      );
      fs.rmSync(dest, { recursive: true, force: true });
      copyDir(modelsSrc(projectRoot), dest);
      return cfg;
    },
  ]);
}

function withIosBundleScript(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const phaseName = 'Bundle IndicTrans2 Models';
    const appTarget = project.getFirstTarget();
    if (!appTarget?.uuid) {
      throw new Error('[withIt2Models] Could not find the iOS app target');
    }

    const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    const already = Object.values(phases).some(
      (phase) =>
        phase &&
        typeof phase === 'object' &&
        (phase.name === phaseName || phase.name === `"${phaseName}"`),
    );
    if (!already) {
      project.addBuildPhase(
        [],
        'PBXShellScriptBuildPhase',
        phaseName,
        appTarget.uuid,
        {
          shellPath: '/bin/sh',
          shellScript: `
set -e
SRC="\${PROJECT_DIR}/NepTranslateModels/models"
DEST="\${BUILT_PRODUCTS_DIR}/\${UNLOCALIZED_RESOURCES_FOLDER_PATH}/models"
if [ ! -d "$SRC" ]; then
  echo "error: IndicTrans2 models missing at $SRC — run node scripts/eas_fetch_it2_models.mjs"
  exit 1
fi
mkdir -p "$DEST"
rsync -a --delete "$SRC/" "$DEST/"
echo "Bundled IndicTrans2 models into app resources"
`.trim(),
        },
      );
    }

    // Keep a group entry so the folder is visible in Xcode.
    IOSConfig.XcodeUtils.ensureGroupRecursively(project, 'NepTranslateModels');
    return cfg;
  });
}

function withIt2Models(config) {
  config = withAndroidModels(config);
  config = withIosModelFiles(config);
  config = withIosBundleScript(config);
  return config;
}

module.exports = createRunOncePlugin(withIt2Models, 'withIt2Models', '1.0.0');
