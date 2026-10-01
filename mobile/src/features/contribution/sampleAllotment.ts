import AsyncStorage from '@react-native-async-storage/async-storage';
import { readInstallationId } from '../../storage/installationId';
import { getSupabase } from '../../services/supabase';
import { REVIEW_DAYS } from './reviewRoster';

const KEY = 'neptranslate.sampleAllotment.v2';

/** Shipped meaning roster. Progress for another manifest is a separate partition. */
export const SAMPLE_MANIFEST_VERSION = 'review-roster-370';

/** Strictly above this share of distinct shipped meanings. 90% exactly does not fire. */
export const ALLOTMENT_RECORD_RATIO = 0.9;

export type AllotmentCrossing = {
  userId: string | null;
  subjectKey: string;
  manifestVersion: string;
  allotted: number;
  completed: number;
  crossedAtMs: number;
};

export type AllotmentState = {
  completedIds: string[];
  crossing: AllotmentCrossing | null;
  pendingDelivery: AllotmentCrossing | null;
};

type Partition = {
  completedMeaningIds: string[];
  crossing: AllotmentCrossing | null;
  pendingDelivery: AllotmentCrossing | null;
};

type Store = {
  schemaVersion: 2;
  manifests: Record<string, Record<string, Partition>>;
};

let chain: Promise<void> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function emptyPartition(): Partition {
  return { completedMeaningIds: [], crossing: null, pendingDelivery: null };
}

function emptyStore(): Store {
  return { schemaVersion: 2, manifests: {} };
}

/** Distinct meanings bundled in the app. Category variants are not extra samples. */
export function allottedSampleCount(days: { id: string }[][] = REVIEW_DAYS): number {
  const ids = new Set<string>();
  for (const day of days) {
    for (const item of day) {
      if (item.id) ids.add(item.id);
    }
  }
  return ids.size;
}

export function passedAllotmentRatio(completed: number, allotted: number): boolean {
  if (allotted <= 0 || completed <= 0) return false;
  return completed / allotted > ALLOTMENT_RECORD_RATIO;
}

export function meaningIdFromSample(sampleId: string): string {
  const split = sampleId.indexOf(':');
  return split > 0 ? sampleId.slice(0, split) : sampleId;
}

export async function allotmentSubjectKey(userId: string | null): Promise<string> {
  if (userId) return `user:${userId}`;
  return `guest:${await readInstallationId()}`;
}

async function readStore(): Promise<Store> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return emptyStore();
  try {
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || parsed.schemaVersion !== 2 || !parsed.manifests) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function toState(partition: Partition): AllotmentState {
  return {
    completedIds: partition.completedMeaningIds,
    crossing: partition.crossing,
    pendingDelivery: partition.pendingDelivery,
  };
}

/**
 * Remember one confirmed or edited meaning for this subject and manifest.
 * Skip, report, and open do not call this. 333/370 does not cross. 334/370 does.
 * The crossing and its pending delivery are written in the same record.
 */
export async function recordCompletedSample(input: {
  sampleId: string;
  userId: string | null;
  allotted?: number;
  nowMs?: number;
  manifestVersion?: string;
}): Promise<AllotmentState> {
  return enqueue(async () => {
    const manifest = input.manifestVersion ?? SAMPLE_MANIFEST_VERSION;
    const subjectKey = await allotmentSubjectKey(input.userId);
    const meaningId = meaningIdFromSample(input.sampleId);
    const store = await readStore();
    const manifestPartitions = store.manifests[manifest] ?? {};
    const current = manifestPartitions[subjectKey] ?? emptyPartition();
    const completedMeaningIds = current.completedMeaningIds.includes(meaningId)
      ? current.completedMeaningIds
      : [...current.completedMeaningIds, meaningId];
    const allotted = input.allotted ?? allottedSampleCount();
    const crossed =
      current.crossing ??
      (passedAllotmentRatio(completedMeaningIds.length, allotted)
        ? {
            userId: input.userId,
            subjectKey,
            manifestVersion: manifest,
            allotted,
            completed: completedMeaningIds.length,
            crossedAtMs: input.nowMs ?? Date.now(),
          }
        : null);
    // A second pass over an already acknowledged crossing must not queue again.
    const createdNow = current.crossing == null && crossed != null;
    const next: Partition = {
      completedMeaningIds,
      crossing: crossed,
      pendingDelivery: current.pendingDelivery ?? (createdNow ? crossed : null),
    };
    const written: Store = {
      schemaVersion: 2,
      manifests: {
        ...store.manifests,
        [manifest]: {
          ...manifestPartitions,
          [subjectKey]: next,
        },
      },
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(written));
    return toState(next);
  });
}

export async function readAllotmentState(
  userId: string | null = null,
  manifestVersion: string = SAMPLE_MANIFEST_VERSION,
): Promise<AllotmentState> {
  return enqueue(async () => {
    const subjectKey = await allotmentSubjectKey(userId);
    const store = await readStore();
    return toState(store.manifests[manifestVersion]?.[subjectKey] ?? emptyPartition());
  });
}

/** Drop the pending delivery only after the caller has an acknowledged receipt. */
export async function acknowledgeAllotmentDelivery(
  userId: string | null,
  manifestVersion: string = SAMPLE_MANIFEST_VERSION,
): Promise<void> {
  return enqueue(async () => {
    const subjectKey = await allotmentSubjectKey(userId);
    const store = await readStore();
    const partition = store.manifests[manifestVersion]?.[subjectKey];
    if (!partition?.pendingDelivery) return;
    const next: Store = {
      ...store,
      manifests: {
        ...store.manifests,
        [manifestVersion]: {
          ...store.manifests[manifestVersion],
          [subjectKey]: { ...partition, pendingDelivery: null },
        },
      },
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  });
}

/**
 * Send a pending crossing through `record_sample_progress`.
 * Counts are not rewards. Offline and failed calls leave the pending row in place.
 * The Edge wrapper is not used; this RPC is the only client delivery route.
 */
export async function deliverSampleProgress(
  userId: string | null,
): Promise<'pending' | 'delivered' | 'skipped'> {
  if (!userId) return 'pending';
  const state = await readAllotmentState(userId);
  const pending = state.pendingDelivery;
  if (!pending) return 'skipped';
  if (
    pending.manifestVersion !== SAMPLE_MANIFEST_VERSION ||
    pending.allotted <= 0 ||
    pending.completed < 0 ||
    pending.completed > pending.allotted ||
    !passedAllotmentRatio(pending.completed, pending.allotted)
  ) {
    return 'pending';
  }
  const client = getSupabase();
  if (!client || typeof client.rpc !== 'function') return 'pending';
  try {
    const rpc = client.rpc.bind(client) as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: unknown }>;
    const { error } = await rpc('record_sample_progress', {
      p_corpus_version: pending.manifestVersion,
      p_allotted: pending.allotted,
      p_completed: pending.completed,
      p_crossed_at: new Date(pending.crossedAtMs).toISOString(),
    });
    if (error) return 'pending';
  } catch {
    return 'pending';
  }
  await acknowledgeAllotmentDelivery(userId, pending.manifestVersion);
  return 'delivered';
}
