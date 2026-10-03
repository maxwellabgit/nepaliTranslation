import type { Direction, NepaliScript } from './onDeviceTranslate';

const END = /([.!?।…]+)(["'”’»）)\]]*)$/u;
const ABBREVIATION = /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc)|(?:\b[A-Za-z]\.)+[A-Za-z]|डा)\.$/u;

/** Source owns sentence-ending punctuation; leave the translated body untouched. */
export function matchTerminalPunctuation(source: string, translated: string,
  direction: Direction, script: NepaliScript = 'deva'): string {
  const input = source.trim();
  const output = translated.trim();
  if (!output) return output;
  const sourceEnd = END.exec(input);
  const outputEnd = END.exec(output);
  const sourceAbbreviation = sourceEnd?.[1] === '.' && ABBREVIATION.test(input.slice(0, input.length - sourceEnd[2].length));
  let punctuation = sourceAbbreviation ? '' : sourceEnd?.[1] ?? '';
  if (!/^\.{2,}$/.test(punctuation)) punctuation = punctuation.replace(/[.।]/g, direction === 'en-ne' && script === 'deva' ? '।' : '.');
  const suffix = outputEnd?.[2] ?? /(["'”’»）)\]]+)$/u.exec(output)?.[1] ?? '';
  const body = outputEnd ? output.slice(0, outputEnd.index).trimEnd() : output.slice(0, output.length - suffix.length).trimEnd();
  // A model's lexical abbreviation dot is part of its word, not an invented sentence end.
  if (outputEnd?.[1] === '.' && ABBREVIATION.test(output.slice(0, output.length - suffix.length))) {
    return punctuation && punctuation !== '.' && punctuation !== '।' ? `${body}.${punctuation}${suffix}` : output;
  }
  return `${body}${punctuation}${suffix}`;
}
