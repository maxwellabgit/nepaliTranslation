import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { UiLangProvider, useSetUiLang, useUiLang, t } from '../index';
import { loadPrefs, savePrefs } from '../../storage/prefs';

function Probe() {
  const lang = useUiLang();
  const setLang = useSetUiLang();
  return (
    <>
      <Text testID="lang">{lang}</Text>
      <Text testID="title">{t('settings.title', lang)}</Text>
      <Pressable testID="set-ne" onPress={() => setLang('ne')}>
        <Text>ne</Text>
      </Pressable>
    </>
  );
}

describe('persisted UI language', () => {
  beforeEach(async () => {
    await savePrefs({
      formalOn: true,
      devaOn: true,
      conversationConsentSeen: false,
      uiLang: 'en',
    });
  });

  test('defaults to English then switches to Nepali immediately', async () => {
    await act(async () => {
      render(
        <UiLangProvider>
          <Probe />
        </UiLangProvider>,
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('lang').props.children).toBe('en');
    });
    expect(screen.getByTestId('title').props.children).toBe('Settings');
    await act(async () => {
      fireEvent.press(screen.getByTestId('set-ne'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('lang').props.children).toBe('ne');
      expect(screen.getByTestId('title').props.children).toBe('सेटिङ');
    });
    await expect(loadPrefs()).resolves.toMatchObject({ uiLang: 'ne' });
  });
});
