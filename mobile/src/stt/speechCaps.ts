import { englishOnDeviceSupported, englishSttMode, type EnglishSttMode } from './enSpeech';
import { nepaliAsrStatus, type NepaliAsrStatus } from './nepaliAsr';
import { getSttSupport, hasNepaliVoice } from './sttSupport';

export type SpeechCaps = {
  enApple: boolean;
  enSttMode: EnglishSttMode;
  enOnDeviceSupported: boolean;
  neApple: boolean;
  neAsr: NepaliAsrStatus;
  neTts: boolean;
};

export async function getSpeechCaps(): Promise<SpeechCaps> {
  const [stt, neTts] = await Promise.all([getSttSupport(), hasNepaliVoice()]);
  return {
    enApple: stt.en,
    enSttMode: englishSttMode(),
    enOnDeviceSupported: englishOnDeviceSupported(),
    neApple: stt.ne,
    neAsr: nepaliAsrStatus(),
    neTts,
  };
}
