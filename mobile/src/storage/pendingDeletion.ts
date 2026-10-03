import AsyncStorage from '@react-native-async-storage/async-storage';
import { permissionMutation } from './permissionTransactions';
const KEY = 'neptranslate.sharedDeletion.v2';
export type PendingDeletion = { ownerId: string; requestedAt: string; dueAt: string | null; completedAt: string | null };
async function readRecords(): Promise<Record<string, PendingDeletion>> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid deletion records');
  return parsed as Record<string, PendingDeletion>;
}
export async function loadPendingDeletion(ownerId: string): Promise<PendingDeletion | null> {
  if (!ownerId) return null;
  return permissionMutation(async () => {
    const row = (await readRecords())[ownerId];
    return validateRow(row, ownerId);
  });
}
export async function savePendingDeletionIntent(ownerId: string): Promise<PendingDeletion> {
  if (!ownerId) throw new Error('Missing deletion owner');
  return permissionMutation(async () => {
    const records = await readRecords();
    const existing = records[ownerId];
    const row: PendingDeletion = existing?.ownerId === ownerId && !existing.completedAt ? existing :
      { ownerId, requestedAt: new Date().toISOString(), dueAt: null, completedAt: null };
    records[ownerId] = row;
    await AsyncStorage.setItem(KEY, JSON.stringify(records));
    return row;
  });
}
export async function savePendingDeletionDue(ownerId: string, dueAt: string): Promise<void> {
  if (!ownerId || !Number.isFinite(Date.parse(dueAt))) throw new Error('Invalid deletion deadline');
  return permissionMutation(async () => {
    const records = await readRecords();
    records[ownerId] = { ownerId, requestedAt: records[ownerId]?.requestedAt ?? new Date().toISOString(), dueAt, completedAt: null };
    await AsyncStorage.setItem(KEY, JSON.stringify(records));
  });
}
export async function markPendingDeletionComplete(ownerId: string, completedAt: string): Promise<void> {
  if (!isServerDeletionComplete(completedAt)) return;
  return permissionMutation(async () => {
    const records = await readRecords();
    const current = records[ownerId];
    if (!current || Date.parse(completedAt) < Date.parse(current.requestedAt)) return;
    records[ownerId] = { ...current, completedAt };
    await AsyncStorage.setItem(KEY, JSON.stringify(records));
  });
}
/** A passed deadline alone never proves deletion. */
export function isServerDeletionComplete(value: string | null | undefined): boolean {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

/** Caller may already hold the shared permission transaction. */
export async function readPendingDeletionUnserialized(ownerId: string): Promise<PendingDeletion | null> {
  const row = (await readRecords())[ownerId];
  return validateRow(row, ownerId);
}
export async function hasPendingDeletion(ownerId: string): Promise<boolean> {
  if (!ownerId) return true;
  try { const row = await loadPendingDeletion(ownerId); return Boolean(row && !row.completedAt); }
  catch { return true; }
}

function validateRow(row: PendingDeletion | undefined, ownerId: string): PendingDeletion | null {
  if (row === undefined) return null;
  if (!row || row.ownerId !== ownerId || !Number.isFinite(Date.parse(row.requestedAt)) ||
      (row.dueAt !== null && !Number.isFinite(Date.parse(row.dueAt))) ||
      (row.completedAt !== null && !Number.isFinite(Date.parse(row.completedAt)))) {
    throw new Error('Invalid owner deletion record');
  }
  return row;
}
