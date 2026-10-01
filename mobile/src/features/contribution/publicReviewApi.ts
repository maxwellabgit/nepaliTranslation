import { isTestingGroundHarness } from './testingGroundReview';
import { itemsForReviewDay, reviewWindowId } from './reviewDayItems';
import { loadReviewDay } from './reviewDayStore';

/**
 * Today's 10 reads the samples shipped with the app.
 * Public review is paused, so this client does not download or submit a
 * server window.
 */

export type ReviewItem = {
  slot: number;
  source_item_id: string;
  direction: 'en-ne' | 'ne-en';
  register: string;
  script: string;
  source_text: string;
  proposed_target: string | null;
  length_tier: 1 | 2;
  /** 1, 2, or 3 from the word-count rule. 4 remains for rows snapshotted earlier. */
  scheduled_credits: 1 | 2 | 3 | 4;
};

export type ReviewWindowSummary = {
  window_id: string;
  ny_close_at: string;
  size: number;
};

export type ReviewMine = {
  source_item_id: string;
  action: 'confirm' | 'edit' | 'skip' | 'report';
  corrected_text: string | null;
  reward_granted: boolean;
};

export type ReviewCurrent =
  | {
      ok: true;
      window: ReviewWindowSummary | null;
      items: ReviewItem[];
      mine: ReviewMine[];
    }
  | {
      ok: false;
      reason: 'unavailable' | 'sign_in' | 'window_closed';
    };

export type ReviewSubmitAction = 'confirm' | 'edit' | 'skip' | 'report';

export type ReviewSubmitResult =
  | { ok: true; submission: Record<string, unknown> }
  | {
      ok: false;
      reason:
        | 'unavailable'
        | 'sign_in'
        | 'window_closed'
        | 'already_submitted'
        | 'invalid';
    };

export async function fetchCurrentReviewWindow(): Promise<ReviewCurrent> {
  const now = new Date();
  const day = await loadReviewDay(now);
  const items = itemsForReviewDay(day, now);
  return {
    ok: true,
    window: {
      window_id: reviewWindowId(day, now),
      ny_close_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      size: items.length,
    },
    items,
    mine: [],
  };
}

/** First item the signed-in user has not already submitted in this window. */
export function firstUnsubmittedIndex(
  items: { source_item_id: string }[],
  mine: { source_item_id: string }[],
): number {
  const done = new Set(mine.map((row) => row.source_item_id));
  const index = items.findIndex((item) => !done.has(item.source_item_id));
  return index < 0 ? 0 : index;
}

export async function submitReview(input: {
  windowId: string;
  sourceItemId: string;
  action: ReviewSubmitAction;
  correctedText?: string;
}): Promise<ReviewSubmitResult> {
  if (input.action === 'edit' && !input.correctedText?.trim()) {
    return { ok: false, reason: 'invalid' };
  }
  if (isTestingGroundHarness()) {
    return {
      ok: true,
      submission: {
        testing_ground: true,
        window_id: input.windowId,
        source_item_id: input.sourceItemId,
        action: input.action,
      },
    };
  }
  return {
    ok: true,
    submission: {
      local: true,
      window_id: input.windowId,
      source_item_id: input.sourceItemId,
      action: input.action,
    },
  };
}

export function creditLabelForCredits(credits: number): string {
  const minutes = Math.max(0, credits) * 10;
  if (credits === 1) return '1 credit · 10 min ad-free';
  return `${credits} credits · ${minutes} min ad-free`;
}
