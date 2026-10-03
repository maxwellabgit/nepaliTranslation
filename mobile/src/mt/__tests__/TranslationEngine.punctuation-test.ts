import { TranslationEngine } from '../TranslationEngine';
import { sharedIndicTransOnnx } from '../onnx/IndicTransOnnx';

jest.unmock('../TranslationEngine');

jest.mock('../onnx/IndicTransOnnx', () => ({ sharedIndicTransOnnx: {
  warmUp: jest.fn(async () => undefined), isReady: () => true,
  translate: jest.fn(),
} }));

test('shared neural path uses source punctuation for both directions and sentence chunks', async () => {
  const engine = new TranslationEngine();
  await engine.warmUp();
  const model = sharedIndicTransOnnx.translate as jest.Mock;
  const options = { preferred: 'en-ne' as const, script: 'deva' as const,
    formality: 'formal' as const, forcePreferred: true };
  model.mockResolvedValueOnce('नमस्ते।');
  expect((await engine.translate({ ...options, text: 'Hello' })).text).toBe('नमस्ते');
  model.mockResolvedValueOnce('नमस्ते।').mockResolvedValueOnce('सन्चै छ।');
  expect((await engine.translate({ ...options, text: 'Hello! Are you well?' })).text).toBe('नमस्ते! सन्चै छ?');
  model.mockResolvedValueOnce('Hello!');
  expect((await engine.translate({ ...options, preferred: 'ne-en', text: 'नमस्ते।' })).text).toBe('Hello.');
  model.mockClear();
  model.mockResolvedValueOnce('“नमस्ते।”').mockResolvedValueOnce('सन्चै छ।');
  expect((await engine.translate({ ...options, text: '“Hello!” Are you well?' })).text).toBe('“नमस्ते!” सन्चै छ?');
  expect(model.mock.calls.map(call => call[0].text)).toEqual(['“Hello!”', 'Are you well?']);
  model.mockClear();
  model.mockResolvedValueOnce('डा. स्मिथ गए।').mockResolvedValueOnce('सन्चै छ।');
  expect((await engine.translate({ ...options, text: 'Dr. Smith left. Are you well?' })).text).toBe('डा. स्मिथ गए। सन्चै छ?');
  expect(model.mock.calls.map(call => call[0].text)).toEqual(['Dr. Smith left.', 'Are you well?']);
});
