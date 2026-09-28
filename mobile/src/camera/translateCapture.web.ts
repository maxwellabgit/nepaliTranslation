type BrowserTranslator = {
  translate: (text: string) => Promise<string>;
};

type TranslatorCtor = {
  availability: (options: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<string>;
  create: (options: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<BrowserTranslator>;
};

const engines = new Map<string, Promise<BrowserTranslator | null>>();

function translatorCtor(): TranslatorCtor | null {
  const candidate = (globalThis as { Translator?: TranslatorCtor }).Translator;
  return typeof candidate?.create === 'function' ? candidate : null;
}

function engine(source: string, target: string): Promise<BrowserTranslator | null> {
  const key = `${source}:${target}`;
  const existing = engines.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const ctor = translatorCtor();
    if (!ctor) return null;
    const availability = await ctor.availability({
      sourceLanguage: source,
      targetLanguage: target,
    });
    if (availability === 'unavailable') return null;
    return ctor.create({ sourceLanguage: source, targetLanguage: target });
  })().catch(() => null);
  engines.set(key, pending);
  return pending;
}

/**
 * Browser testing-ground translation. The IndicTrans weights are not in the
 * web bundle, so this uses the device translator in the browser. iOS stays
 * on the on-device model.
 */
export async function translateCapturedLine(
  text: string,
  direction: 'en-ne' | 'ne-en',
): Promise<string> {
  const source = direction === 'ne-en' ? 'ne' : 'en';
  const target = direction === 'ne-en' ? 'en' : 'ne';
  const ready = await engine(source, target);
  if (!ready) return '';
  const translated = await ready.translate(text);
  return translated.trim();
}
