import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { SupportPage } from './Support';
import type { AdminClient } from '../api';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const containers: HTMLDivElement[] = [];
afterEach(() => { containers.forEach(node => node.remove()); containers.length = 0; vi.restoreAllMocks(); });
it('reaches older requests through the server cursor', async () => {
  const cursor = { created_at: '2026-10-03', id: 'older-id' };
  const support = vi.fn().mockResolvedValueOnce({ requests: [], next_cursor: cursor }).mockResolvedValueOnce({ requests: [], next_cursor: null });
  const container = document.createElement('div'); document.body.append(container); containers.push(container); const root = createRoot(container);
  await act(async () => root.render(<SupportPage api={{ support } as unknown as AdminClient} />));
  await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Older requests')!.click());
  expect(support).toHaveBeenLastCalledWith(cursor);
  await act(async () => root.unmount());
});
it('shows user text as text and sends only an explicit operator reply', async () => {
  const request = { id: 'request', message: '<script>private user text</script>', category: 'ad', app_version: '1.7.0', created_at: '2026-10-03', reply: 'operator response' };
  const support = vi.fn().mockResolvedValue({ requests: [request], next_cursor: null }); const replySupport = vi.fn().mockResolvedValue({});
  const container = document.createElement('div'); document.body.append(container); containers.push(container); const root = createRoot(container);
  await act(async () => root.render(<SupportPage api={{ support, replySupport } as unknown as AdminClient} />));
  expect(container.querySelector('script')).toBeNull(); expect(container.textContent).toContain(request.message);
  expect(replySupport).not.toHaveBeenCalled();
  await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Send reply')!.click());
  expect(replySupport).toHaveBeenCalledWith('request', 'operator response');
  await act(async () => root.unmount());
});
