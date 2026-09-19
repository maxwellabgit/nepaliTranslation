import type { ReactNode } from 'react';
import { Fragment } from 'react';

type Props = {
  children: ReactNode;
};

/** Composition root for future Auth / Entitlement providers. Pass-through in Slice 01. */
export function AppProviders({ children }: Props) {
  return <Fragment>{children}</Fragment>;
}
