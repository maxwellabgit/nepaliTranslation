import {
  initialCameraPhase,
  reduceCameraPhase,
  isCameraBusy,
  type CameraPhaseEvent,
} from '../cameraPhase';

const ALL_EVENTS: CameraPhaseEvent[] = [
  { type: 'PERMISSION_NEEDED' },
  { type: 'PERMISSION_GRANTED' },
  { type: 'PERMISSION_DENIED' },
  { type: 'CAPTURE' },
  { type: 'CAPTURED' },
  { type: 'RECOGNIZE_STARTED' },
  { type: 'RECOGNIZE_EMPTY' },
  { type: 'RECOGNIZE_LOW_CONFIDENCE' },
  { type: 'TRANSLATE_STARTED' },
  { type: 'RESULT' },
  { type: 'FAIL', reasonCode: 'ocr_crash' },
  { type: 'RETAKE' },
  { type: 'CANCEL' },
  { type: 'MARK_UNAVAILABLE', reasonCode: 'no_camera' },
];

describe('cameraPhase machine', () => {
  test('permission → live → capture → recognize → translate → result', () => {
    let s = initialCameraPhase(false);
    expect(s.phase).toBe('permission');
    s = reduceCameraPhase(s, { type: 'PERMISSION_GRANTED' });
    expect(s.phase).toBe('live');
    s = reduceCameraPhase(s, { type: 'CAPTURE' });
    expect(s.phase).toBe('captured');
    expect(isCameraBusy(s.phase)).toBe(true);
    s = reduceCameraPhase(s, { type: 'CAPTURED' });
    expect(s.phase).toBe('captured');
    s = reduceCameraPhase(s, { type: 'RECOGNIZE_STARTED' });
    expect(s.phase).toBe('recognizing');
    s = reduceCameraPhase(s, { type: 'TRANSLATE_STARTED' });
    expect(s.phase).toBe('translating');
    s = reduceCameraPhase(s, { type: 'RESULT' });
    expect(s.phase).toBe('result');
    expect(isCameraBusy(s.phase)).toBe(false);
  });

  test('empty, low confidence, fail, denied, unavailable, cancel, retake', () => {
    let s = reduceCameraPhase(initialCameraPhase(true), { type: 'CAPTURE' });
    s = reduceCameraPhase(s, { type: 'RECOGNIZE_STARTED' });
    s = reduceCameraPhase(s, { type: 'RECOGNIZE_EMPTY' });
    expect(s).toEqual({ phase: 'empty', reasonCode: 'no_text' });
    s = reduceCameraPhase(s, { type: 'CAPTURE' });
    expect(s.phase).toBe('captured');

    s = reduceCameraPhase(initialCameraPhase(true), { type: 'CAPTURE' });
    s = reduceCameraPhase(s, { type: 'RECOGNIZE_STARTED' });
    s = reduceCameraPhase(s, { type: 'RECOGNIZE_LOW_CONFIDENCE' });
    expect(s.phase).toBe('lowConfidence');
    s = reduceCameraPhase(s, { type: 'CAPTURE' });
    expect(s.phase).toBe('captured');

    s = reduceCameraPhase(initialCameraPhase(true), { type: 'CAPTURE' });
    s = reduceCameraPhase(s, { type: 'FAIL', reasonCode: 'ocr_crash' });
    expect(s).toEqual({ phase: 'empty', reasonCode: 'ocr_crash' });

    s = reduceCameraPhase(s, { type: 'RETAKE' });
    expect(s.phase).toBe('live');

    s = reduceCameraPhase(s, { type: 'PERMISSION_NEEDED' });
    expect(s.phase).toBe('permission');
    s = reduceCameraPhase(s, { type: 'PERMISSION_DENIED' });
    expect(s.reasonCode).toBe('permission_denied');

    s = reduceCameraPhase(initialCameraPhase(true), {
      type: 'MARK_UNAVAILABLE',
      reasonCode: 'no_camera',
    });
    expect(s.phase).toBe('unavailable');
    s = reduceCameraPhase(s, { type: 'CANCEL' });
    expect(s.phase).toBe('unavailable');

    s = reduceCameraPhase(initialCameraPhase(true), { type: 'CAPTURE' });
    s = reduceCameraPhase(s, { type: 'CANCEL' });
    expect(s.phase).toBe('live');
  });

  test('every event type is handled without throwing from live', () => {
    const base = initialCameraPhase(true);
    for (const event of ALL_EVENTS) {
      expect(() => reduceCameraPhase(base, event)).not.toThrow();
    }
  });
});
