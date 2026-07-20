/**
 * Sentence-level chunking for MT (IndicTrans2 is trained/served per sentence).
 *
 * Model window (IndicTrans2 dist-200M):
 *   max_source_positions = 256, max_target_positions = 256
 * Fine-tune default truncation: 96 tokens — keep utterances short.
 *
 * Prefer natural ends: . ? ! । … then soft-split long runs without punctuation.
 */

const END = /([.?!…।]+)(?:\s+|$)/u;
const SOFT_MAX = 140;
const HARD_MAX = 220;

export type SentenceSplit = {
  complete: string[];
  remainder: string;
};

/** Split text into complete sentences + trailing incomplete remainder. */
export function splitSentences(text: string): SentenceSplit {
  const raw = (text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return { complete: [], remainder: '' };

  const complete: string[] = [];
  let buf = '';
  let i = 0;
  while (i < raw.length) {
    const slice = raw.slice(i);
    const m = END.exec(slice);
    if (m && m.index != null) {
      buf += slice.slice(0, m.index + m[1].length);
      const sent = buf.trim();
      if (sent) complete.push(sent);
      buf = '';
      i += m.index + m[0].length;
      continue;
    }
    buf += slice;
    break;
  }

  let remainder = buf.trim();
  while (remainder.length > HARD_MAX) {
    const window = remainder.slice(0, SOFT_MAX);
    let cut = Math.max(window.lastIndexOf(' '), window.lastIndexOf(','));
    if (cut < 40) cut = SOFT_MAX;
    const piece = remainder.slice(0, cut).trim();
    if (piece) complete.push(piece);
    remainder = remainder.slice(cut).trim();
  }

  return { complete, remainder };
}

/**
 * From a growing STT transcript, emit only newly completed sentences
 * beyond `emittedCount` (number of complete sentences already translated).
 */
export function takeNewCompleteSentences(
  fullTranscript: string,
  emittedCount: number,
): { newSentences: string[]; nextEmittedCount: number; remainder: string } {
  const { complete, remainder } = splitSentences(fullTranscript);
  if (complete.length <= emittedCount) {
    return {
      newSentences: [],
      nextEmittedCount: emittedCount,
      remainder: remainder || (complete.length === 0 ? fullTranscript.trim() : ''),
    };
  }
  return {
    newSentences: complete.slice(emittedCount),
    nextEmittedCount: complete.length,
    remainder,
  };
}

/** True if text likely has multiple sentences (gold-review flag). */
export function isMultiSentence(text: string): boolean {
  const { complete, remainder } = splitSentences(text);
  if (complete.length >= 2) return true;
  if (complete.length === 1 && remainder.trim().length > 12) return true;
  return /[.?!…।].+\S/u.test((text || '').trim());
}

/** Suggest 1:1 sentence pairs when both sides split to the same count. */
export function suggestAlignedSplits(
  source: string,
  reference: string,
): { source: string; reference: string }[] | null {
  const left = (() => {
    const { complete, remainder } = splitSentences(source);
    return remainder ? [...complete, remainder] : complete;
  })().filter((s) => s.trim());
  const right = (() => {
    const { complete, remainder } = splitSentences(reference);
    return remainder ? [...complete, remainder] : complete;
  })().filter((s) => s.trim());
  if (left.length < 2 || left.length !== right.length) return null;
  return left.map((s, i) => ({ source: s, reference: right[i] }));
}

export const IT2_WINDOW = {
  maxSourcePositions: 256,
  maxTargetPositions: 256,
  fineTuneMaxLength: 96,
  softCharMax: SOFT_MAX,
  hardCharMax: HARD_MAX,
} as const;
