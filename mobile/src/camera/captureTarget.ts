import { devanagariToRoman, romanToDevanagari } from '../mt/romanize';
import type { CorrelatedSentence, SourceSentence } from './ocrTypes';
import { colorForCategory, type SourceCategory } from './sourceCategory';
import { noteKeep, noteScript, noteTranslate } from './captureMetrics';

export type CaptureTarget = 'en' | 'ne-deva' | 'ne-roman';

export type TranslateRoute = {
  kind: 'translate';
  direction: 'en-ne' | 'ne-en';
  script: 'deva' | 'roman';
};

export type CaptureRoute = { kind: 'keep' } | { kind: 'script'; script: 'deva' | 'roman' } | TranslateRoute;

/** Drop macrons and other marks so the syllable parser can read scholarly romanization. */
export function foldScholarlyRoman(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '');
}

export function routeCapture(category: SourceCategory, target: CaptureTarget): CaptureRoute {
  if (category === target) return { kind: 'keep' };
  if (category === 'ne-deva' && target === 'ne-roman') return { kind: 'script', script: 'roman' };
  if (category === 'ne-roman' && target === 'ne-deva') return { kind: 'script', script: 'deva' };
  if (category === 'en') {
    return {
      kind: 'translate',
      direction: 'en-ne',
      script: target === 'ne-roman' ? 'roman' : 'deva',
    };
  }
  return { kind: 'translate', direction: 'ne-en', script: 'deva' };
}

/** Working text for the model. The stored OCR string is left unchanged. */
export function prepareTranslateInput(
  text: string,
  category: SourceCategory,
  route: TranslateRoute,
): string {
  if (category === 'ne-roman' && route.direction === 'ne-en') {
    return romanToDevanagari(foldScholarlyRoman(text));
  }
  return text;
}

export function convertNepaliScript(text: string, script: 'deva' | 'roman'): string {
  if (script === 'roman') {
    return /[\u0900-\u097F]/.test(text) ? devanagariToRoman(text) : text;
  }
  if (/[\u0900-\u097F]/.test(text)) return text;
  return romanToDevanagari(foldScholarlyRoman(text));
}

export function captureResultKey(captureId: number, groupId: string, target: CaptureTarget): string {
  return `${captureId}:${groupId}:${target}`;
}

export function acceptLatestTarget(request: {
  requestGeneration: number;
  currentGeneration: number;
  requestCapture: number;
  currentCapture: number;
}): boolean {
  return (
    request.requestGeneration === request.currentGeneration &&
    request.requestCapture === request.currentCapture
  );
}

export async function materializeCaptureGroups(input: {
  groups: SourceSentence[];
  target: CaptureTarget;
  captureId: number;
  cache: Map<string, CorrelatedSentence>;
  translate: (text: string, route: TranslateRoute) => Promise<string>;
}): Promise<CorrelatedSentence[]> {
  const rendered: CorrelatedSentence[] = [];
  for (const group of input.groups) {
    const key = captureResultKey(input.captureId, group.id, input.target);
    const cached = input.cache.get(key);
    if (cached && !cached.failed) {
      rendered.push(cached);
      continue;
    }
    const route = routeCapture(group.category, input.target);
    const color = colorForCategory(group.category);
    let translation = group.text;
    let failed = false;
    if (route.kind === 'keep') {
      noteKeep();
      translation = group.text;
    } else if (route.kind === 'script') {
      noteScript();
      translation = convertNepaliScript(group.text, route.script);
      failed = !translation.trim();
    } else {
      noteTranslate();
      try {
        const prepared = prepareTranslateInput(group.text, group.category, route);
        const raw = (await input.translate(prepared, route)).trim();
        translation =
          route.script === 'roman' && /[\u0900-\u097F]/.test(raw)
            ? devanagariToRoman(raw)
            : raw;
        failed = !translation;
      } catch {
        translation = '';
        failed = true;
      }
    }
    const sentence: CorrelatedSentence = { ...group, translation, color, failed };
    if (!failed) input.cache.set(key, sentence);
    rendered.push(sentence);
  }
  return rendered;
}
