import type { ReviewItem, ReviewSubmitAction } from './publicReviewApi';

/** Working-from categories on the Today's 10 intro. Two cards per row. */
export type ReviewCategoryId = 'deva' | 'roman' | 'english';

export const REVIEW_CATEGORY_ORDER: ReviewCategoryId[] = [
  'english',
  'deva',
  'roman',
];

export type ReviewJudgment = 'same' | 'mine' | 'neither';

const CREDIT_AWARD_ZONE = 'America/New_York';
const CREDIT_AWARD_HOUR = 17;

export function reviewCategoryOf(item: ReviewItem): ReviewCategoryId {
  if (item.direction === 'en-ne') return 'english';
  const script = item.script.toLowerCase();
  if (script === 'roman' || script === 'noisy_roman' || script === 'latn') {
    return 'roman';
  }
  return 'deva';
}

export function groupReviewItems(
  items: ReviewItem[],
): Record<ReviewCategoryId, ReviewItem[]> {
  const grouped: Record<ReviewCategoryId, ReviewItem[]> = {
    deva: [],
    roman: [],
    english: [],
  };
  for (const item of items) {
    grouped[reviewCategoryOf(item)].push(item);
  }
  return grouped;
}

export function firstUnsubmittedIn(
  items: ReviewItem[],
  doneIds: ReadonlySet<string>,
): number {
  return items.findIndex((item) => !doneIds.has(item.source_item_id));
}

/**
 * Same meaning confirms the current line.
 * Mine is better stores the typed line as the correction.
 * Neither is right reports the item and earns nothing.
 * With no current line, same meaning keeps the typed line.
 */
export function judgmentToSubmit(
  judgment: ReviewJudgment,
  typed: string,
  proposed: string | null,
): { action: ReviewSubmitAction; correctedText?: string } {
  const text = typed.trim();
  if (judgment === 'neither') return { action: 'report' };
  if (judgment === 'mine') return { action: 'edit', correctedText: text };
  if (proposed?.trim()) return { action: 'confirm' };
  if (text) return { action: 'edit', correctedText: text };
  return { action: 'confirm' };
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const bag: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)) {
    if (part.type !== 'literal') bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = zonedParts(guess, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

/** Next 5:00 PM America/New_York, including the DST offset for that calendar day. */
export function nextNewYorkFivePm(now: Date): Date {
  const parts = zonedParts(now, CREDIT_AWARD_ZONE);
  let { year, month, day } = parts;
  const past =
    parts.hour > CREDIT_AWARD_HOUR ||
    (parts.hour === CREDIT_AWARD_HOUR &&
      (parts.minute > 0 || parts.second > 0));
  if (past) {
    const next = new Date(Date.UTC(year, month - 1, day) + 24 * 60 * 60 * 1000);
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
  }
  return zonedLocalToUtc(year, month, day, CREDIT_AWARD_HOUR, 0, CREDIT_AWARD_ZONE);
}

/**
 * Prefer the open window's close instant. After it passes, count down to the
 * next 5:00 PM America/New_York.
 */
export function creditAwardDeadline(now: Date, closeAtIso?: string | null): Date {
  if (closeAtIso) {
    const parsed = new Date(closeAtIso);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > now.getTime()) {
      return parsed;
    }
  }
  return nextNewYorkFivePm(now);
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}
