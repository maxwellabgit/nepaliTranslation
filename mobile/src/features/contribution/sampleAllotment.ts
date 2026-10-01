import AsyncStorage from '@react-native-async-storage/async-storage';
import { REVIEW_CATEGORIES } from './reviewDayPlan';
import { REVIEW_DAYS } from './reviewRoster';

const KEY = 'neptranslate.sampleAllotment.v1';

/** A user has moved past this share of the samples shipped with the app. */
export const ALLOTMENT_RECORD_RATIO = 0.9;

export type AllotmentCrossing = {
  userId: string | null;
  allotted: number;
  completed: number;
  crossedAtMs: number;
};

export type AllotmentState = {
  completedIds: string[];
  crossing: AllotmentCrossing | null;
};

/** Samples bundled in the app. Public review does not download a later set. */
export function allottedSampleCount(
  days: { length: number }[] = REVIEW_DAYS,
): number {
  return days.reduce((total, day) => total + day.length * REVIEW_CATEGORIES.length, 0);
}

export function passedAllotmentRatio(completed: number, allotted: number): boolean {
  if (allotted <= 0) return false;
  return completed / allotted >= ALLOTMENT_RECORD_RATIO;
}

async function readState(): Promise<AllotmentState> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { completedIds: [], crossing: null };
  try {
    const parsed = JSON.parse(raw) as AllotmentState;
    return {
      completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds : [],
      crossing: parsed.crossing ?? null,
    };
  } catch {
    return { completedIds: [], crossing: null };
  }
}

/**
 * Remember one finished sample. The first time a user passes 90% of the
 * shipped allotment, keep who they are and the counts. Later samples do not
 * overwrite that record.
 */
export async function recordCompletedSample(input: {
  sampleId: string;
  userId: string | null;
  allotted?: number;
  nowMs?: number;
}): Promise<AllotmentState> {
  const current = await readState();
  const completedIds = current.completedIds.includes(input.sampleId)
    ? current.completedIds
    : [...current.completedIds, input.sampleId];
  const allotted = input.allotted ?? allottedSampleCount();
  const crossing =
    current.crossing ??
    (passedAllotmentRatio(completedIds.length, allotted)
      ? {
          userId: input.userId,
          allotted,
          completed: completedIds.length,
          crossedAtMs: input.nowMs ?? Date.now(),
        }
      : null);
  const next: AllotmentState = { completedIds, crossing };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function readAllotmentState(): Promise<AllotmentState> {
  return readState();
}
