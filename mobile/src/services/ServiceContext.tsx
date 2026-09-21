import { createContext, useContext, type ReactNode } from 'react';
import type { AppServices } from './contracts';
import { createProductionServices } from './productionServices';

const ServiceContext = createContext<AppServices | null>(null);

export function ServiceProvider({
  services,
  children,
}: {
  services?: AppServices;
  children: ReactNode;
}) {
  const value = services ?? createProductionServices();
  return (
    <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>
  );
}

export function useServices(): AppServices {
  const ctx = useContext(ServiceContext);
  if (!ctx) {
    // Soft fallback so screens never crash outside the provider.
    return createProductionServices();
  }
  return ctx;
}
