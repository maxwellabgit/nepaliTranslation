import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as Speech from 'expo-speech';

import { AppProviders } from '../../app/AppProviders';
import { LearnScreen } from '../../screens/LearnScreen';
import { createTestServices } from '../../services/createTestServices';
import * as sttSupport from '../../stt/sttSupport';
import { saveLessonPosition } from '../../learn/learnProgress';

jest.mock('../../stt/sttSupport', () => ({
  hasNepaliVoice: jest.fn(),
}));

function renderLearn(
  props: { active?: boolean; onOpenContributions?: () => void } = {},
) {
  const { active = true, onOpenContributions = jest.fn() } = props;
  return render(
    <AppProviders services={createTestServices({ offline: true })}>
      <LearnScreen active={active} onOpenContributions={onOpenContributions} />
    </AppProviders>,
  );
}

describe('LearnScreen H5', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (sttSupport.hasNepaliVoice as jest.Mock).mockReset();
    (sttSupport.hasNepaliVoice as jest.Mock).mockResolvedValue(true);
    (Speech.stop as jest.Mock).mockClear();
    (Speech.speak as jest.Mock).mockClear();
  });

  it('landing works offline without auth chrome', async () => {
    await act(async () => {
      renderLearn();
    });
    await waitFor(() => {
      expect(screen.getByTestId('learn-screen')).toBeTruthy();
    });
    expect(screen.getByTestId('learn-card-alphabet')).toBeTruthy();
    expect(screen.getByTestId('learn-card-contribute')).toBeTruthy();
    expect(screen.getByTestId('reward-summary')).toBeTruthy();
    expect(screen.queryByText(/sign in/i)).toBeNull();
    expect(screen.getByText(/no account needed/i)).toBeTruthy();
  });

  it('opens alphabet without gating on contributions', async () => {
    const onOpen = jest.fn();
    await act(async () => {
      renderLearn({ onOpenContributions: onOpen });
    });
    await waitFor(() => expect(screen.getByTestId('learn-open-alphabet')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('learn-open-alphabet'));
    await waitFor(() => {
      expect(screen.getByTestId('alphabet-lesson')).toBeTruthy();
      expect(screen.getByTestId('learn-progress')).toBeTruthy();
    });
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.queryByTestId('learn-card-contribute')).toBeNull();
  });

  it('shows honest no-voice banner and disables speak controls', async () => {
    (sttSupport.hasNepaliVoice as jest.Mock).mockResolvedValue(false);
    await act(async () => {
      renderLearn();
    });
    await fireEvent.press(await screen.findByTestId('learn-open-alphabet'));
    await waitFor(() => {
      expect(screen.getByTestId('learn-no-voice')).toBeTruthy();
    });
    expect(
      screen.getByTestId('learn-speak').props.accessibilityState?.disabled,
    ).toBe(true);
    expect(
      screen.getByTestId('learn-speak-slow').props.accessibilityState?.disabled,
    ).toBe(true);
  });

  it('speaks normal and slow rates and hard-stops on Back', async () => {
    await act(async () => {
      renderLearn();
    });
    await fireEvent.press(await screen.findByTestId('learn-open-alphabet'));
    await waitFor(() => expect(screen.getByTestId('learn-speak')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('learn-speak'));
    expect(Speech.speak).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ rate: 0.85 }),
    );
    await fireEvent.press(screen.getByTestId('learn-speak-slow'));
    expect(Speech.speak).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ rate: 0.45 }),
    );
    await fireEvent.press(screen.getByTestId('app-header-back'));
    expect(Speech.stop).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId('learn-screen')).toBeTruthy();
    });
  });

  it('persists lesson position across remount', async () => {
    await saveLessonPosition({ sectionId: 'consonants', glyphIndex: 2 });
    await act(async () => {
      renderLearn();
    });
    await fireEvent.press(await screen.findByTestId('learn-open-alphabet'));
    await waitFor(() => {
      expect(screen.getByTestId('learn-progress').props.children).toEqual([
        3,
        ' / ',
        33,
      ]);
    });
  });

  it('shows dental/retroflex place labels with IAST roman', async () => {
    await saveLessonPosition({ sectionId: 'consonants', glyphIndex: 10 }); // ट ṭa
    await act(async () => {
      renderLearn();
    });
    await fireEvent.press(await screen.findByTestId('learn-open-alphabet'));
    await waitFor(() => {
      expect(screen.getByTestId('learn-roman').props.children).toBe('ṭa');
      expect(screen.getByTestId('learn-place').props.children).toBe('Retroflex');
    });
  });

  it('quiz choices are unique with exactly one correct answer', async () => {
    await act(async () => {
      renderLearn();
    });
    await fireEvent.press(await screen.findByTestId('learn-open-alphabet'));
    await waitFor(() => expect(screen.getByTestId('learn-quiz-choices')).toBeTruthy());
    const choiceNodes = screen
      .getAllByLabelText(/^Choice /)
      .map((n) => n.props.accessibilityLabel?.replace(/^Choice /, '') ?? '');
    expect(choiceNodes).toHaveLength(4);
    expect(new Set(choiceNodes).size).toBe(4);
    await fireEvent.press(screen.getByLabelText('Choice a'));
    await waitFor(() => {
      expect(screen.getByTestId('learn-quiz-feedback').props.children).toBe(
        'Correct',
      );
    });
  });

  it('exposes accessibility names for primary alphabet actions', async () => {
    await act(async () => {
      renderLearn();
    });
    expect(
      screen.getByLabelText('Nepali alphabet, offline, no account needed'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Help improve translations')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('learn-open-alphabet'));
    await waitFor(() => {
      expect(screen.getByLabelText('Speak letter at normal speed')).toBeTruthy();
      expect(screen.getByLabelText('Speak letter slowly')).toBeTruthy();
      expect(screen.getByLabelText('Next letter')).toBeTruthy();
      expect(screen.getByLabelText('Go back')).toBeTruthy();
    });
  });
});
