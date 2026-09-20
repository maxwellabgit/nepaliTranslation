/**
 * Fail the suite on unexpected console.error / console.warn.
 * Tests may allowlist exact messages when they intentionally prove a failure.
 */
const originalError = console.error.bind(console);
const originalWarn = console.warn.bind(console);

const allowedErrorExact = new Set<string>();
const allowedWarnExact = new Set<string>();

export function allowConsoleError(message: string): void {
  allowedErrorExact.add(message);
}

export function allowConsoleWarn(message: string): void {
  allowedWarnExact.add(message);
}

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

beforeEach(() => {
  allowedErrorExact.clear();
  allowedWarnExact.clear();
  console.error = (...args: unknown[]) => {
    const text = formatArgs(args);
    for (const allowed of allowedErrorExact) {
      if (text.includes(allowed)) return;
    }
    originalError(...args);
    throw new Error(`Unexpected console.error: ${text}`);
  };
  console.warn = (...args: unknown[]) => {
    const text = formatArgs(args);
    for (const allowed of allowedWarnExact) {
      if (text.includes(allowed)) return;
    }
    originalWarn(...args);
    throw new Error(`Unexpected console.warn: ${text}`);
  };
});

afterEach(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
