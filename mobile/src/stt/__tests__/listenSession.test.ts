import { createListenSession } from '../listenSession';

type Sub = { remove: jest.Mock };
const listeners: Record<string, Array<(e: unknown) => void>> = {};

function emit(event: string, payload: unknown) {
  for (const cb of listeners[event] ?? []) cb(payload);
}

function makeModule() {
  Object.keys(listeners).forEach((k) => delete listeners[k]);
  return {
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    addListener: jest.fn((event: string, cb: (e: unknown) => void): Sub => {
      (listeners[event] ??= []).push(cb);
      return { remove: jest.fn() };
    }),
  };
}

describe('createListenSession', () => {
  it('fails when module is null', async () => {
    const onError = jest.fn();
    const session = createListenSession(null, {
      onPartial: jest.fn(),
      onFinal: jest.fn(),
      onError,
      onEnded: jest.fn(),
    });
    await expect(session.start('en-US')).resolves.toBe(false);
    expect(onError).toHaveBeenCalled();
  });

  it('starts with expected options', async () => {
    const mod = makeModule();
    const session = createListenSession(mod, {
      onPartial: jest.fn(),
      onFinal: jest.fn(),
      onError: jest.fn(),
      onEnded: jest.fn(),
    });
    await expect(session.start('ne-NP')).resolves.toBe(true);
    expect(mod.start).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: 'ne-NP',
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: false,
      }),
    );
    expect(session.isActive()).toBe(true);
  });

  it('routes partial and final results', async () => {
    const mod = makeModule();
    const onPartial = jest.fn();
    const onFinal = jest.fn();
    const session = createListenSession(mod, {
      onPartial,
      onFinal,
      onError: jest.fn(),
      onEnded: jest.fn(),
    });
    await session.start('en-US');
    emit('result', {
      isFinal: false,
      results: [{ transcript: 'hel' }],
    });
    emit('result', {
      isFinal: true,
      results: [{ transcript: 'hello' }],
    });
    expect(onPartial).toHaveBeenCalledWith('hel');
    expect(onFinal).toHaveBeenCalledWith('hello');
  });

  it('handles error and end', async () => {
    const mod = makeModule();
    const onError = jest.fn();
    const onEnded = jest.fn();
    const session = createListenSession(mod, {
      onPartial: jest.fn(),
      onFinal: jest.fn(),
      onError,
      onEnded,
    });
    await session.start('en-US');
    emit('error', { message: 'boom' });
    expect(onError).toHaveBeenCalled();
    expect(onEnded).toHaveBeenCalled();
    expect(session.isActive()).toBe(false);

    await session.start('en-US');
    emit('end', {});
    expect(session.isActive()).toBe(false);
  });

  it('stop and abort clear activity', async () => {
    const mod = makeModule();
    const session = createListenSession(mod, {
      onPartial: jest.fn(),
      onFinal: jest.fn(),
      onError: jest.fn(),
      onEnded: jest.fn(),
    });
    await session.start('en-US');
    await session.stop();
    expect(mod.stop).toHaveBeenCalled();
    expect(session.isActive()).toBe(false);

    await session.start('en-US');
    await session.abort();
    expect(mod.abort).toHaveBeenCalled();
    expect(session.isActive()).toBe(false);
  });
});
