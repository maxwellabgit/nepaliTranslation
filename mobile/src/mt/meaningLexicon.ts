import raw from './generated/meaningLexicon.json';

export type MeaningLexicon = {
  enToNe: Record<string, string>;
  neToEn: Record<string, string>;
  romanToEn: Record<string, string>;
  romanWords: Record<string, string>;
};

export const meaningLexicon = raw as MeaningLexicon;

export function normKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[?.!,;:।]+$/u, '')
    .replace(/\s+/g, ' ');
}
