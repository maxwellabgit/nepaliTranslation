import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { RuntimePorts } from './ports';
import { createProductionRuntime } from './createProductionRuntime';

const RuntimeContext = createContext<RuntimePorts | null>(null);

export function RuntimeProvider({
  runtime,
  children,
}: {
  runtime?: RuntimePorts;
  children: ReactNode;
}) {
  const fallback = useMemo(() => createProductionRuntime(), []);
  const value = runtime ?? fallback;
  return (
    <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
  );
}

export function useRuntime(): RuntimePorts {
  const ctx = useContext(RuntimeContext);
  if (!ctx) {
    return createProductionRuntime();
  }
  return ctx;
}
