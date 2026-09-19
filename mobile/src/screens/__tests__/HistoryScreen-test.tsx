import { Alert } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { HistoryScreen } from '../HistoryScreen';
import * as phrasebook from '../../storage/phrasebook';

jest.mock('../../storage/phrasebook', () => {
  const actual = jest.requireActual('../../storage/phrasebook');
  return {
    ...actual,
    loadHistory: jest.fn(),
    clearHistory: jest.fn(async () => undefined),
    deleteHistoryItem: jest.fn(async () => undefined),
  };
});

jest.mock('../../storage/trainingContrib', () => ({
  loadSentTrainingKeys: jest.fn(async () => new Set()),
  sendHistoryItemToTraining: jest.fn(),
  trainingKeyFor: jest.fn((item: { id: string }) => item.id),
}));

describe('HistoryScreen clear confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (phrasebook.loadHistory as jest.Mock).mockResolvedValue([
      {
        id: '1',
        source: 'hello',
        translation: 'नमस्ते',
        sourceLang: 'en',
        targetLang: 'ne',
        createdAt: 1,
      },
    ]);
  });

  test('Clear asks for confirmation before wiping history', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await render(
      <HistoryScreen onClose={jest.fn()} onSelect={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('hello')).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText('Clear history'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Clear history',
      'Remove all translations from this device?',
      expect.any(Array),
    );
    expect(phrasebook.clearHistory).not.toHaveBeenCalled();

    const buttons = alertSpy.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const clearBtn = buttons.find((b) => b.text === 'Clear');
    clearBtn?.onPress?.();

    await waitFor(() => {
      expect(phrasebook.clearHistory).toHaveBeenCalledTimes(1);
    });

    alertSpy.mockRestore();
  });
});
