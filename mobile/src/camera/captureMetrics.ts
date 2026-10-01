/** Counts for one testing session. Production behavior does not depend on them. */
let ocrCalls = 0;
let translateCalls = 0;
let scriptCalls = 0;
let keepCalls = 0;

export function noteCaptureOcrCall(): void {
  ocrCalls += 1;
  publish();
}

export function noteTranslate(): void {
  translateCalls += 1;
  publish();
}

export function noteScript(): void {
  scriptCalls += 1;
  publish();
}

export function noteKeep(): void {
  keepCalls += 1;
  publish();
}

export function captureMetricSnapshot(): {
  ocr: number;
  translate: number;
  script: number;
  keep: number;
} {
  return { ocr: ocrCalls, translate: translateCalls, script: scriptCalls, keep: keepCalls };
}

export function resetCaptureMetrics(): void {
  ocrCalls = 0;
  translateCalls = 0;
  scriptCalls = 0;
  keepCalls = 0;
  publish();
}

export function publishOcrLines(
  lines: Array<{ text: string; confidence: number | null; y: number; h: number }>,
): void {
  if (typeof window === 'undefined') return;
  const boot = (window as { __NEPTRANSLATE_TG__?: { harness?: string } }).__NEPTRANSLATE_TG__;
  if (!boot || boot.harness !== 'neptranslate-testing-ground') return;
  (window as { __NEPTRANSLATE_OCR_LINES__?: typeof lines }).__NEPTRANSLATE_OCR_LINES__ = lines;
}

function publish(): void {
  if (typeof window === 'undefined') return;
  const boot = (window as { __NEPTRANSLATE_TG__?: { harness?: string } }).__NEPTRANSLATE_TG__;
  if (!boot || boot.harness !== 'neptranslate-testing-ground') return;
  (window as { __NEPTRANSLATE_CAPTURE_METRICS__?: ReturnType<typeof captureMetricSnapshot> }).__NEPTRANSLATE_CAPTURE_METRICS__ =
    captureMetricSnapshot();
}
