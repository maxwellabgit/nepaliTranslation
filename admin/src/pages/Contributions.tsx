import { useEffect, useRef, useState } from 'react';
import type { AdminClient, ContributionCursor, ContributionPage } from '../api';
import { formatApiError } from '../App';

/** Private review download; not a training dataset or public-content grant. */
export function ContributionsPage({ api }: { api: AdminClient }) {
  const [page, setPage] = useState<ContributionPage | null>(null);
  const [cursor, setCursor] = useState<ContributionCursor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setBusy(true); setPage(null); setPreview(null); setError(null);
    api.contributions(cursor).then(data => {
      if (current === generation.current) setPage(data);
    }).catch(err => {
      if (current === generation.current) setError(formatApiError(err));
    }).finally(() => { if (current === generation.current) setBusy(false); });
    return () => { generation.current++; };
  }, [api, cursor]);

  async function download() {
    const current = generation.current;
    setBusy(true); setError(null);
    try {
      // Refetch under current authorization; never export the cached preview.
      const fresh = await api.contributions(cursor, true);
      if (current !== generation.current) return;
      setPage(fresh);
      const url = URL.createObjectURL(new Blob([JSON.stringify(fresh, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'bola-private-contributions-page.json'; link.click();
      URL.revokeObjectURL(url);
    } catch (err) { if (current === generation.current) setError(formatApiError(err)); }
    finally { if (current === generation.current) setBusy(false); }
  }
  async function listen(id: string) {
    const current = generation.current;
    setBusy(true); setPreview(null); setError(null);
    try {
      const data = await api.signMedia(id);
      if (current === generation.current) setPreview(data.signed_url);
    } catch (err) { if (current === generation.current) setError(formatApiError(err)); }
    finally { if (current === generation.current) setBusy(false); }
  }
  return <div>
    <h2>Contributions</h2>
    <p className="muted">Private feedback, Today’s 10 responses and speech. Originals and revisions stay separate. Withdrawn or pending-deletion data is excluded. Exports are for private review; they do not authorize training or public display.</p>
    {error && <p className="err" role="alert">{error}</p>}
    <div className="row">
      <button disabled={busy || !page} onClick={() => void download()}>Download this page as JSON</button>
      <button disabled={busy || cursor === null} className="secondary" onClick={() => setCursor(null)}>Newest records</button>
      <button disabled={busy || !page?.next_cursor} onClick={() => setCursor(page!.next_cursor)}>Older records</button>
    </div>
    {busy && <p role="status">Loading…</p>}
    {page && <p>{page.records.length} records on this page. {page.next_cursor ? 'More records are available.' : 'End of records.'}</p>}
    {page?.records.map(record => <article className="panel" key={`${record.record_type}:${record.id}`}>
      <h3>{String(record.metadata.method ?? record.metadata.translation_method ?? record.record_type)}</h3>
      <p className="muted">{record.created_at} · {record.id}</p>
      {record.record_type === 'text' && <>
        <p><strong>Original:</strong> {record.source}</p>
        <p><strong>Translation:</strong> {record.result}</p>
        <p><strong>Answer/correction:</strong> {record.correction}</p>
        <p>{record.direction} · {record.formality} · {record.script}</p>
      </>}
      {record.record_type === 'speech' && <button disabled={busy} onClick={() => void listen(record.id)}>Listen to speech</button>}
      <details><summary>Response and linkage metadata</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(record.metadata, null, 2)}</pre></details>
    </article>)}
    {preview && <audio controls src={preview} aria-label="Private speech preview" />}
  </div>;
}
