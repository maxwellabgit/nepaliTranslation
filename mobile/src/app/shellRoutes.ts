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
  /** Pass-the-phone exchange. Homepage is translate with this false. */
  conversation: boolean;
};

export type ShellEvent =
  | { type: 'switch_mode'; mode: AppMode }
  | { type: 'enter_conversation' }
  | { type: 'exit_conversation' }
  | { type: 'open_overlay'; overlay: Exclude<AppOverlay, null> }
  | { type: 'close_overlay' }
  | { type: 'select_history' };

export const INITIAL_SHELL: ShellState = {
  mode: 'translate',
  overlay: null,
  conversation: false,
};

const PRIMARY_MODES: readonly AppMode[] = ['translate', 'camera', 'learn'];

export function isPrimaryMode(mode: string): mode is AppMode {
  return (PRIMARY_MODES as readonly string[]).includes(mode);
}

export function reduceShell(state: ShellState, event: ShellEvent): ShellState {
  switch (event.type) {
    case 'switch_mode':
      return {
        ...state,
        mode: event.mode,
        conversation: event.mode === 'translate' ? state.conversation : false,
      };
    case 'enter_conversation':
      return { mode: 'translate', overlay: null, conversation: true };
    case 'exit_conversation':
      return { mode: 'translate', overlay: null, conversation: false };
    case 'open_overlay':
      return { ...state, overlay: event.overlay };
    case 'close_overlay':
      return { ...state, overlay: null };
    case 'select_history':
      return { mode: 'translate', overlay: null, conversation: false };
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
