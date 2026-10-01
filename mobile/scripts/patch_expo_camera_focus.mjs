/**
 * expo-camera 57 has no tap-to-focus method. This adds focusAt on the
 * preview view and is safe to run more than once.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const camera = path.join(root, 'node_modules', 'expo-camera');
const marker = 'neptranslate-tap-focus';

function read(rel) {
  const file = path.join(camera, rel);
  if (!fs.existsSync(file)) return null;
  return { file, text: fs.readFileSync(file, 'utf8') };
}

function write(entry, next) {
  if (entry.text === next) return;
  fs.writeFileSync(entry.file, next);
}

if (!fs.existsSync(camera)) {
  throw new Error('patch_expo_camera_focus: expo-camera is not installed');
}

const required = [
  'ios/CameraViewModule.swift',
  'ios/Current/CameraView.swift',
  'android/src/main/java/expo/modules/camera/CameraViewModule.kt',
  'android/src/main/java/expo/modules/camera/ExpoCameraView.kt',
];
for (const rel of required) {
  if (!fs.existsSync(path.join(camera, rel))) {
    throw new Error(`patch_expo_camera_focus: missing ${rel}`);
  }
}

const iosModule = read('ios/CameraViewModule.swift');
if (iosModule && !iosModule.text.includes(marker)) {
  const anchor = `      AsyncFunction("pausePreview") { view in
        view.pausePreview()
      }`;
  const next = `${anchor}

      // ${marker}
      AsyncFunction("focusAt") { (view, x: Double, y: Double) in
        view.focusAt(x: x, y: y)
      }`;
  if (!iosModule.text.includes(anchor)) {
    throw new Error('patch_expo_camera_focus: iOS pausePreview anchor missing');
  }
  write(iosModule, iosModule.text.replace(anchor, next));
}

const iosView = read('ios/Current/CameraView.swift');
if (iosView && !iosView.text.includes('func focusAt(x:')) {
  const anchor = '  func startSessionIfNeeded() {';
  const method = `  // ${marker}
  func focusAt(x: Double, y: Double) {
    let apply = { [weak self] in
      guard let self else {
        return
      }
      let width = self.bounds.width
      let height = self.bounds.height
      guard width > 0, height > 0 else {
        return
      }
      let clampedX = min(max(x, 0), 1)
      let clampedY = min(max(y, 0), 1)
      let viewPoint = CGPoint(x: width * CGFloat(clampedX), y: height * CGFloat(clampedY))
      let devicePoint = self.previewLayer.captureDevicePointConverted(fromLayerPoint: viewPoint)
      self.sessionQueue.async { [weak self] in
        self?.sessionManager.focus(at: devicePoint)
      }
    }
    if Thread.isMainThread {
      apply()
    } else {
      DispatchQueue.main.async(execute: apply)
    }
  }

  func startSessionIfNeeded() {`;
  if (!iosView.text.includes(anchor)) {
    throw new Error('patch_expo_camera_focus: iOS CameraView anchor missing');
  }
  write(iosView, iosView.text.replace(anchor, method));
}

const iosSession = read('ios/Current/CameraSessionManager.swift');
if (iosSession && !iosSession.text.includes('func focus(at devicePoint:')) {
  const anchor = '  func updateZoom() {';
  const method = `  // ${marker}
  func focus(at devicePoint: CGPoint) {
    guard let device = captureDeviceInput?.device else {
      return
    }
    let point = CGPoint(
      x: min(max(devicePoint.x, 0), 1),
      y: min(max(devicePoint.y, 0), 1)
    )
    do {
      try device.lockForConfiguration()
      defer { device.unlockForConfiguration() }
      if device.isFocusPointOfInterestSupported {
        device.focusPointOfInterest = point
        if device.isFocusModeSupported(.autoFocus) {
          device.focusMode = .autoFocus
        }
      }
      if device.isExposurePointOfInterestSupported {
        device.exposurePointOfInterest = point
        if device.isExposureModeSupported(.autoExpose) {
          device.exposureMode = .autoExpose
        }
      }
    } catch {
      log.info("\\(#function): \\(error.localizedDescription)")
    }
  }

  func updateZoom() {`;
  if (!iosSession.text.includes(anchor)) {
    throw new Error('patch_expo_camera_focus: iOS session anchor missing');
  }
  write(iosSession, iosSession.text.replace(anchor, method));
}

const androidModule = read('android/src/main/java/expo/modules/camera/CameraViewModule.kt');
if (androidModule && !androidModule.text.includes(marker)) {
  const anchor = `      AsyncFunction("pausePreview") { view: ExpoCameraView ->
        view.pausePreview()
      }`;
      const next = `${anchor}

      // ${marker}
      AsyncFunction("focusAt") { view: ExpoCameraView, x: Double, y: Double ->
        view.focusAt(x.toFloat(), y.toFloat())
      }.runOnQueue(Queues.MAIN)`;
  if (!androidModule.text.includes(anchor)) {
    throw new Error('patch_expo_camera_focus: Android pausePreview anchor missing');
  }
  write(androidModule, androidModule.text.replace(anchor, next));
}

const androidView = read('android/src/main/java/expo/modules/camera/ExpoCameraView.kt');
if (androidView && !androidView.text.includes('fun focusAt(')) {
  const anchor = '  private fun startFocusMetering() {';
  const method = `  // ${marker}
  fun focusAt(x: Float, y: Float) {
    val width = previewView.width.toFloat()
    val height = previewView.height.toFloat()
    if (width <= 0f || height <= 0f) return
    val point = previewView.meteringPointFactory.createPoint(
      x.coerceIn(0f, 1f) * width,
      y.coerceIn(0f, 1f) * height
    )
    val action = FocusMeteringAction.Builder(
      point,
      FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
    ).build()
    camera?.cameraControl?.startFocusAndMetering(action)
  }

  private fun startFocusMetering() {`;
  if (!androidView.text.includes(anchor)) {
    throw new Error('patch_expo_camera_focus: Android view anchor missing');
  }
  write(androidView, androidView.text.replace(anchor, method));
}

const viewJs = read('build/CameraView.js');
if (viewJs && !viewJs.text.includes('async focusAt(')) {
  const anchor = `    async pausePreview() {
        return this._cameraRef.current?.pausePreview();
    }`;
  const next = `${anchor}
    /**
     * Focus and expose at a point in the preview. x and y are 0 to 1.
     */
    async focusAt(point) {
        const x = point?.x ?? 0;
        const y = point?.y ?? 0;
        return this._cameraRef.current?.focusAt?.(x, y);
    }`;
  if (!viewJs.text.includes(anchor)) {
    throw new Error('patch_expo_camera_focus: CameraView.js anchor missing');
  }
  write(viewJs, viewJs.text.replace(anchor, next));
}

const viewDts = read('build/CameraView.d.ts');
if (viewDts && !viewDts.text.includes('focusAt(point:')) {
  const anchor = '    pausePreview(): Promise<void>;';
  const next = `${anchor}
    /**
     * Focus and expose at a point in the preview. x and y are 0 to 1.
     */
    focusAt(point: {
        x: number;
        y: number;
    }): Promise<void>;`;
  if (!viewDts.text.includes(anchor)) {
    throw new Error('patch_expo_camera_focus: CameraView.d.ts anchor missing');
  }
  write(viewDts, viewDts.text.replace(anchor, next));
}

const typesDts = read('build/Camera.types.d.ts');
if (typesDts && !typesDts.text.includes('focusAt')) {
  const anchor = '    readonly pausePreview: () => Promise<void>;';
  const next = `${anchor}
    readonly focusAt?: (x: number, y: number) => Promise<void>;`;
  if (!typesDts.text.includes(anchor)) {
    throw new Error('patch_expo_camera_focus: Camera.types.d.ts anchor missing');
  }
  write(typesDts, typesDts.text.replace(anchor, next));
}

const typesAgain = read('build/Camera.types.d.ts');
if (typesAgain) {
  const line = '    readonly focusAt?: (x: number, y: number) => Promise<void>;\n';
  const doubled = line + line;
  if (typesAgain.text.includes(doubled)) {
    write(typesAgain, typesAgain.text.replace(doubled, line));
  }
}

const androidAgain = read('android/src/main/java/expo/modules/camera/ExpoCameraView.kt');
if (androidAgain?.text.includes('DisplayOrientedMeteringPointFactory(\n      previewView.display')) {
  const stale = `  fun focusAt(x: Float, y: Float) {
    val active = camera ?: return
    val width = previewView.width.toFloat()
    val height = previewView.height.toFloat()
    if (width <= 0f || height <= 0f) return
    val factory = DisplayOrientedMeteringPointFactory(
      previewView.display,
      active.cameraInfo,
      width,
      height
    )
    val point = factory.createPoint(
      x.coerceIn(0f, 1f) * width,
      y.coerceIn(0f, 1f) * height
    )
    val action = FocusMeteringAction.Builder(
      point,
      FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
    ).build()
    active.cameraControl.startFocusAndMetering(action)
  }`;
  const current = `  fun focusAt(x: Float, y: Float) {
    val width = previewView.width.toFloat()
    val height = previewView.height.toFloat()
    if (width <= 0f || height <= 0f) return
    val point = previewView.meteringPointFactory.createPoint(
      x.coerceIn(0f, 1f) * width,
      y.coerceIn(0f, 1f) * height
    )
    val action = FocusMeteringAction.Builder(
      point,
      FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
    ).build()
    camera?.cameraControl?.startFocusAndMetering(action)
  }`;
  if (androidAgain.text.includes(stale)) {
    write(androidAgain, androidAgain.text.replace(stale, current));
  }
}

const moduleAgain = read('android/src/main/java/expo/modules/camera/CameraViewModule.kt');
if (
  moduleAgain &&
  moduleAgain.text.includes('view.focusAt(x.toFloat(), y.toFloat())\n      }') &&
  !moduleAgain.text.includes('view.focusAt(x.toFloat(), y.toFloat())\n      }.runOnQueue(Queues.MAIN)')
) {
  write(
    moduleAgain,
    moduleAgain.text.replace(
      'view.focusAt(x.toFloat(), y.toFloat())\n      }',
      'view.focusAt(x.toFloat(), y.toFloat())\n      }.runOnQueue(Queues.MAIN)',
    ),
  );
}

console.log('patch_expo_camera_focus: ok');
