import AsyncStorage from '@react-native-async-storage/async-storage';
import { creditAwardDeadline } from './reviewFlow';

const KEY = 'neptranslate.todays10.progress';

export type ReviewProgress = {
  windowId: string;
  expiresAt: string;
  reviewedIds: string[];
};

export async function readReviewProgress(now: Date): Promise<ReviewProgress | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ReviewProgress;
    const expires = new Date(parsed.expiresAt).getTime();
    if (!parsed.windowId || !Number.isFinite(expires) || expires <= now.getTime()) {
      await AsyncStorage.removeItem(KEY);
      return null;
    }
    return {
      windowId: parsed.windowId,
      expiresAt: parsed.expiresAt,
      reviewedIds: Array.isArray(parsed.reviewedIds) ? parsed.reviewedIds : [],
    };
  } catch {
    await AsyncStorage.removeItem(KEY);
    return null;
  }
}

export async function writeReviewProgress(input: {
  windowId: string;
  closeAt: string | null;
  reviewedIds: string[];
  now: Date;
}): Promise<void> {
  const expiresAt = creditAwardDeadline(input.now, input.closeAt).toISOString();
  if (new Date(expiresAt).getTime() <= input.now.getTime()) {
    await AsyncStorage.removeItem(KEY);
    return;
  }
  const progress: ReviewProgress = {
    windowId: input.windowId,
    expiresAt,
    reviewedIds: input.reviewedIds,
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(progress));
}
