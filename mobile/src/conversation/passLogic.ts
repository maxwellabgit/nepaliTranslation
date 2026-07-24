/**
 * Pure Conversation pass helpers — unit-tested without device STT.
 */

export type PassSide = 'en' | 'ne';

export type PassTurn = {
  from: PassSide;
};

/** True when Pass should be allowed: live interim or a committed turn from this side. */
export function canPassPhone(args: {
  interim: string;
  turns: PassTurn[];
  side: PassSide;
}): boolean {
  if (args.interim.trim()) return true;
  const last = args.turns.length ? args.turns[args.turns.length - 1] : null;
  return Boolean(last && last.from === args.side);
}

/**
 * When Auto is listening, only remount STT locale on a clear script flip —
 * not on every interim detect flicker.
 */
export function shouldRemountSttLocale(args: {
  listening: boolean;
  currentLang: 'en-US' | 'ne-NP';
  detectedDirection: 'en-ne' | 'ne-en';
}): boolean {
  if (!args.listening) return false;
  const next: 'en-US' | 'ne-NP' =
    args.detectedDirection === 'ne-en' ? 'ne-NP' : 'en-US';
  return next !== args.currentLang;
}

export function methodLabel(method: 'phrase' | 'lexicon' | 'neural'): string {
  switch (method) {
    case 'neural':
      return 'on-device model';
    case 'lexicon':
      return 'word guess';
    default:
      return 'saved phrase';
  }
}
