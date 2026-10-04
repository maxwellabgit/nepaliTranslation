import { useEffect, useState } from 'react';
import type { AdminClient } from '../api';
import { formatApiError } from '../App';
export function SupportPage({ api }: { api: AdminClient }) {
  const [data, setData] = useState<Awaited<ReturnType<AdminClient['support']>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState<{ created_at: string; id: string } | null>(null);
  useEffect(() => { let active = true; setData(null); setError(null);
    api.support(cursor).then(value => { if (active) setData(value); }).catch(err => { if (active) setError(formatApiError(err)); });
    return () => { active = false; };
  }, [api, revision, cursor]);
  return <section><h2>Support</h2><p className="muted">Private support messages, separate from contributions. Never export these for training. Users can delete their messages and replies in Settings.</p>
    <button disabled={busy} onClick={() => setRevision(value => value + 1)}>Refresh</button>
    <button disabled={busy || !cursor} onClick={() => setCursor(null)}>Newest requests</button>
    <button disabled={busy || !data?.next_cursor} onClick={() => setCursor(data!.next_cursor)}>Older requests</button>
    {error && <p className="err" role="alert">{error}</p>}
    {data && data.requests.length === 0 && <p>No support requests.</p>}
    {data?.requests.map(row => <article className="panel" key={row.id}><p>{row.created_at} · {row.category} · v{row.app_version}</p><p>{row.message}</p>
      <label>Reply<textarea maxLength={2000} value={replies[row.id] ?? row.reply ?? ''} onChange={event => setReplies(value => ({ ...value, [row.id]: event.target.value }))} /></label>
      <button disabled={busy || !(replies[row.id] ?? row.reply ?? '').trim()} onClick={() => {
        setBusy(true); setError(null);
        void api.replySupport(row.id, replies[row.id] ?? row.reply ?? '').then(() => setRevision(value => value + 1)).catch(err => setError(formatApiError(err))).finally(() => setBusy(false));
      }}>Send reply</button>
    </article>)}
  </section>;
}
