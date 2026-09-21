import type { Formality, NepaliScript } from '../mt/onDeviceTranslate';
import { canPassPhone } from './passLogic';

export type Side = 'en' | 'ne';

export type SessionTurn = {
  id: string;
  from: Side;
  source: string;
  translation: string;
  method?: string;
  direction?: 'en-ne' | 'ne-en';
};

export type SessionState = {
  activeSide: Side;
  turns: SessionTurn[];
  draft: string;
  listening: boolean;
  translating: boolean;
  formality: Formality;
  script: NepaliScript;
  pendingPass: boolean;
};

export type SessionAction =
  | { type: 'setDraft'; text: string }
  | { type: 'setListening'; listening: boolean }
  | { type: 'setTranslating'; translating: boolean }
  | { type: 'setFormality'; formality: Formality }
  | { type: 'setScript'; script: NepaliScript }
  | { type: 'commitTurn'; turn: SessionTurn; pass?: boolean; keepDraft?: boolean }
  | { type: 'replaceTurn'; id: string; turn: SessionTurn }
  | { type: 'pass' }
  | { type: 'setSide'; side: Side }
  | { type: 'beginPass' }
  | { type: 'cancelPass' };

const MAX_TURNS = 40;
export const RETRY_TURN_LIMIT = 5;

export function oppositeSide(side: Side): Side {
  return side === 'en' ? 'ne' : 'en';
}

export function sessionPhase(state: SessionState): 'empty' | 'single' | 'exchange' {
  if (state.turns.length === 0) return 'empty';
  if (state.turns.length === 1) return 'single';
  return 'exchange';
}

export function latestFrom(state: SessionState): Side | null {
  return state.turns.length ? state.turns[state.turns.length - 1].from : null;
}

export function isRetryableTurn(turn: SessionTurn, all: SessionTurn[]): boolean {
  return all.slice(-RETRY_TURN_LIMIT).some((t) => t.id === turn.id);
}

export function initialSession(seed?: {
  source?: string;
  translation?: string;
  sourceLang?: Side;
} | null): SessionState {
  const side: Side = seed?.sourceLang === 'ne' ? 'ne' : 'en';
  const source = seed?.source?.trim() ?? '';
  const translation = seed?.translation?.trim() ?? '';
  const turns: SessionTurn[] =
    source && translation
      ? [
          {
            id: 'seed',
            from: side,
            source,
            translation,
            direction: side === 'en' ? 'en-ne' : 'ne-en',
          },
        ]
      : [];
  return {
    activeSide: side,
    turns,
    draft: source,
    listening: false,
    translating: false,
    formality: 'formal',
    script: 'deva',
    pendingPass: false,
  };
}

export function reduceSession(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'setDraft':
      return { ...state, draft: action.text };
    case 'setListening':
      return { ...state, listening: action.listening };
    case 'setTranslating':
      return { ...state, translating: action.translating };
    case 'setFormality':
      return { ...state, formality: action.formality };
    case 'setScript':
      return { ...state, script: action.script };
    case 'beginPass':
      return { ...state, pendingPass: true };
    case 'cancelPass':
      return { ...state, pendingPass: false };
    case 'commitTurn': {
      const turns = [...state.turns, action.turn].slice(-MAX_TURNS);
      const pass = Boolean(action.pass);
      return {
        ...state,
        turns,
        draft: action.keepDraft ? state.draft : '',
        listening: false,
        translating: false,
        pendingPass: false,
        activeSide: pass ? oppositeSide(state.activeSide) : state.activeSide,
      };
    }
    case 'replaceTurn':
      return {
        ...state,
        translating: false,
        turns: state.turns.map((turn) =>
          turn.id === action.id ? action.turn : turn,
        ),
      };
    case 'pass': {
      if (!canPassPhone(state.draft, latestFrom(state), state.activeSide)) {
        return { ...state, pendingPass: false };
      }
      return {
        ...state,
        activeSide: oppositeSide(state.activeSide),
        draft: '',
        listening: false,
        pendingPass: false,
      };
    }
    case 'setSide':
      if (action.side === state.activeSide) return state;
      return {
        ...state,
        activeSide: action.side,
        draft: '',
        listening: false,
      };
    default:
      return state;
  }
}
