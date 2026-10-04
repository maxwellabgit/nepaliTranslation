import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContributionsPage } from './Contributions';
import type { AdminClient, ContributionPage } from '../api';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let container: HTMLDivElement; let root: Root;
const page = (correction: string): ContributionPage => ({ schema_version: 1, generated_at: '2026-10-03',
  classification: 'private_review_only', next_cursor: null, records: [{ id: 'synthetic', owner_id: 'owner',
    record_type: 'text', created_at: '2026-10-03', source: 'original', result: 'shown', correction,
    consent_version: 'guest', metadata: { method: 'todays_10', revision: 1 },
    classification: 'private_review_only', training_eligible: false, public_display_eligible: false }] });
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
describe('private contributions page', () => {
  it('shows a freshly authorized portable JSON export and clears it on close', async () => {
    const contributions = vi.fn().mockResolvedValueOnce(page('cached')).mockResolvedValueOnce(page('fresh'));
    await act(async () => root.render(<ContributionsPage api={{ contributions } as unknown as AdminClient} />));
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Show JSON export')!.click());
    expect(contributions).toHaveBeenLastCalledWith(null, true);
    const exported = JSON.parse(container.querySelector('textarea')!.value);
    expect(exported.records[0].correction).toBe('fresh');
    expect(exported.records[0].training_eligible).toBe(false);
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Close export')!.click());
    expect(container.querySelector('textarea')).toBeNull();
  });
  it('downloads a freshly authorized response rather than cached withdrawn records', async () => {
    const contributions = vi.fn().mockResolvedValueOnce(page('cached answer')).mockResolvedValueOnce({ ...page('fresh answer'), records: [] });
    const api = { contributions } as unknown as AdminClient;
    let blob: Blob | undefined;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn((value: Blob) => { blob = value; return 'blob:private'; }) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await act(async () => root.render(<ContributionsPage api={api} />));
    expect(container.textContent).toContain('cached answer');
    await act(async () => (Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Download'))!).click());
    expect(contributions).toHaveBeenLastCalledWith(null, true);
    const text = await new Promise<string>((resolve, reject) => { const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(blob!); });
    expect(JSON.parse(text).records).toEqual([]);
    expect(text).not.toContain('cached answer');
  });
  it('does not download a late export response after navigation/unmount', async () => {
    let complete!: (value: ContributionPage) => void;
    const contributions = vi.fn().mockResolvedValueOnce(page('first')).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const create = vi.fn(); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    await act(async () => root.render(<ContributionsPage api={{ contributions } as unknown as AdminClient} />));
    await act(async () => (Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Download'))!).click());
    await act(async () => root.unmount());
    await act(async () => complete(page('late')));
    expect(create).not.toHaveBeenCalled();
  });
});
