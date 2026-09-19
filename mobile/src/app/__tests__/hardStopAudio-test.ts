import * as Speech from 'expo-speech';
import { hardStopAudio } from '../hardStopAudio';
import { hardStopRecognition } from '../../stt/sttSupport';
import { sharedTranslationEngine } from '../../mt/TranslationEngine';

describe('hardStopAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('stops recognition, speech, and cancels in-flight translation', () => {
    hardStopAudio();
    expect(hardStopRecognition).toHaveBeenCalledTimes(1);
    expect(Speech.stop).toHaveBeenCalledTimes(1);
    expect(sharedTranslationEngine.cancelAll).toHaveBeenCalledTimes(1);
  });

  test('still cancels MT when Speech.stop throws', () => {
    (Speech.stop as jest.Mock).mockImplementationOnce(() => {
      throw new Error('speech busy');
    });
    expect(() => hardStopAudio()).not.toThrow();
    expect(hardStopRecognition).toHaveBeenCalled();
    expect(sharedTranslationEngine.cancelAll).toHaveBeenCalled();
  });
});
