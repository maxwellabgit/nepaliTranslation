import {
  canPassPhone,
  shouldRemountSttLocale,
  methodLabel,
} from '../passLogic';

describe('canPassPhone', () => {
  it('allows pass with interim', () => {
    expect(
      canPassPhone({ interim: 'hello', turns: [], side: 'en' }),
    ).toBe(true);
  });

  it('allows pass when last turn is from current side', () => {
    expect(
      canPassPhone({
        interim: '',
        turns: [{ from: 'en' }],
        side: 'en',
      }),
    ).toBe(true);
  });

  it('blocks empty pass after flip', () => {
    expect(
      canPassPhone({
        interim: '',
        turns: [{ from: 'en' }],
        side: 'ne',
      }),
    ).toBe(false);
  });
});

describe('shouldRemountSttLocale', () => {
  it('remounts only when listening and lang flips', () => {
    expect(
      shouldRemountSttLocale({
        listening: true,
        currentLang: 'en-US',
        detectedDirection: 'ne-en',
      }),
    ).toBe(true);
    expect(
      shouldRemountSttLocale({
        listening: true,
        currentLang: 'en-US',
        detectedDirection: 'en-ne',
      }),
    ).toBe(false);
    expect(
      shouldRemountSttLocale({
        listening: false,
        currentLang: 'en-US',
        detectedDirection: 'ne-en',
      }),
    ).toBe(false);
  });
});

describe('methodLabel', () => {
  it('labels honesty modes', () => {
    expect(methodLabel('phrase')).toBe('saved phrase');
    expect(methodLabel('lexicon')).toBe('word guess');
    expect(methodLabel('neural')).toBe('on-device model');
  });
});
