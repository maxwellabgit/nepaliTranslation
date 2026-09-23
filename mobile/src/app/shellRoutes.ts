export const TODAYS_REVIEW_ROUTE = 'todays_review' as const;

export type AppMode = 'translate' | 'camera' | 'learn';

export type AppOverlay =
  | 'history'
  | 'settings'
  | typeof TODAYS_REVIEW_ROUTE
  | null;

export type ShellState = {
  mode: AppMode;
  overlay: AppOverlay;
};

export type ShellEvent =
  | { type: 'switch_mode'; mode: AppMode }
  | { type: 'open_overlay'; overlay: Exclude<AppOverlay, null> }
  | { type: 'close_overlay' }
  | { type: 'select_history' };

export const INITIAL_SHELL: ShellState = {
  mode: 'translate',
  overlay: null,
};

const PRIMARY_MODES: readonly AppMode[] = ['translate', 'camera', 'learn'];

export function isPrimaryMode(mode: string): mode is AppMode {
  return (PRIMARY_MODES as readonly string[]).includes(mode);
}

export function reduceShell(state: ShellState, event: ShellEvent): ShellState {
  switch (event.type) {
    case 'switch_mode':
      return { ...state, mode: event.mode };
    case 'open_overlay':
      return { ...state, overlay: event.overlay };
    case 'close_overlay':
      return { ...state, overlay: null };
    case 'select_history':
      return { mode: 'translate', overlay: null };
    default:
      return state;
  }
}

/** Learn and Settings both open the single public correction route. */
export function openTodaysReview(state: ShellState): ShellState {
  return reduceShell(state, {
    type: 'open_overlay',
    overlay: TODAYS_REVIEW_ROUTE,
  });
}
