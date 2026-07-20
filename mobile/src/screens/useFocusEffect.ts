import { useEffect } from 'react';

/** Tiny stand-in so History can reload when shown (no react-navigation). */
export function useFocusEffect(cb: () => void | Promise<void>) {
  useEffect(() => {
    void cb();
  }, [cb]);
}
