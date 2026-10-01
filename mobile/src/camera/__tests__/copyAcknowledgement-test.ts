import { applyClipboardResult } from '../copyAcknowledgement';

describe('camera copy acknowledgement', () => {
  it('shows Copied after a successful write', () => {
    expect(
      applyClipboardResult({
        requestGeneration: 1,
        currentGeneration: 1,
        copied: true,
        id: 'all',
        visibleId: null,
      }),
    ).toEqual({ visibleId: 'all', startTimer: true });
  });

  it('clears a previous Copied label when the next write returns false', () => {
    expect(
      applyClipboardResult({
        requestGeneration: 2,
        currentGeneration: 2,
        copied: false,
        id: 'all',
        visibleId: 'all',
      }),
    ).toEqual({ visibleId: null, startTimer: false });
  });

  it('clears Copied when the clipboard rejects', () => {
    expect(
      applyClipboardResult({
        requestGeneration: 3,
        currentGeneration: 3,
        copied: 'error',
        id: 'line-1',
        visibleId: 'line-1',
      }),
    ).toEqual({ visibleId: null, startTimer: false });
  });

  it('does not let an older result clear a newer success', () => {
    expect(
      applyClipboardResult({
        requestGeneration: 1,
        currentGeneration: 2,
        copied: false,
        id: 'all',
        visibleId: 'line-2',
      }),
    ).toEqual({ visibleId: 'line-2', startTimer: false });
  });
});
