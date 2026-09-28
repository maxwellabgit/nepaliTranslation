import {
  INITIAL_SHELL,
  TODAYS_REVIEW_ROUTE,
  isPrimaryMode,
  openTodaysReview,
  reduceShell,
} from '../shellRoutes';

describe('shell route reducer', () => {
  test('primary surfaces are only Translate, Camera, and Learn', () => {
    expect(isPrimaryMode('translate')).toBe(true);
    expect(isPrimaryMode('camera')).toBe(true);
    expect(isPrimaryMode('learn')).toBe(true);
    expect(isPrimaryMode('contributions')).toBe(false);
    expect(isPrimaryMode('todays_review')).toBe(false);
  });

  test('Learn and Settings open the same Today\'s 10 route', () => {
    const fromLearn = openTodaysReview({ mode: 'learn', overlay: null });
    const fromSettings = openTodaysReview({
      mode: 'translate',
      overlay: 'settings',
    });
    expect(fromLearn.overlay).toBe(TODAYS_REVIEW_ROUTE);
    expect(fromSettings.overlay).toBe(TODAYS_REVIEW_ROUTE);
    expect(fromLearn.overlay).toBe(fromSettings.overlay);
    expect(fromLearn.mode).toBe('learn');
    expect(fromSettings.mode).toBe('translate');
  });

  test('closing the review route returns to the underlying surface', () => {
    const open = openTodaysReview(INITIAL_SHELL);
    const closed = reduceShell(open, { type: 'close_overlay' });
    expect(closed).toEqual({ mode: 'translate', overlay: null });
  });

  test('history selection returns to Translate and clears overlays', () => {
    const next = reduceShell(
      { mode: 'learn', overlay: 'history' },
      { type: 'select_history' },
    );
    expect(next).toEqual({ mode: 'translate', overlay: null });
  });
});
