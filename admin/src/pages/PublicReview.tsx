import { useEffect, useState } from "react";
import type { AdminClient } from "../api";
import { formatApiError } from "../App";

type WindowSummary = {
  window_id: string;
  ny_close_at: string;
  state: "open" | "closed" | "granted";
  size: number;
  slot: number;
};

/**
 * R3 admin public-review skeleton.
 *
 * The audit rule 9 requires an admin surface for:
 *   * import runs and reject manifests
 *   * current/previous review window and its exact 10 items
 *   * submission inspection/diff
 *   * pre-close unsatisfactory marking
 *   * late rejection with contributor alert
 *   * report/quarantine resolution
 *   * source eligibility/exclusion history
 *   * reward and scheduler audit events
 *
 * This page is the read-only starting point built on the RLS-safe
 * `public.review_current_window` view. Mutating admin actions
 * (unsatisfactory, late reject, quarantine resolution) require a new
 * service-role-backed `admin-api` endpoint; those endpoints are
 * scheduled for R7/R8 polish and are documented below rather than
 * silently absent from this UI.
 */
export function PublicReviewPage({ api }: { api: AdminClient }) {
  const [rows, setRows] = useState<WindowSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .publicReviewCurrentWindow()
      .then((res) => {
        if (cancelled) return;
        setRows(res as WindowSummary[]);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(formatApiError(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const windowId = rows[0]?.window_id ?? null;
  const closeAt = rows[0]?.ny_close_at ?? null;

  return (
    <section data-testid="admin-public-review">
      <header>
        <h1>Public review — current window</h1>
        <p>
          Shared 10-item window for every eligible reviewer today. Reads via
          the RLS-safe <code>public.review_current_window</code> view;
          mutating admin actions (unsatisfactory / late reject / quarantine
          resolution) require a service-role <code>admin-api</code> endpoint
          — see R3/R7 in <code>plans/active/v1-testflight-runbook.md</code>.
        </p>
      </header>

      {loading ? <p>Loading…</p> : null}
      {error ? (
        <p className="error" data-testid="admin-public-review-error">
          {error}
        </p>
      ) : null}
      {!loading && !error && windowId ? (
        <>
          <dl>
            <dt>Window ID</dt>
            <dd data-testid="admin-window-id">{windowId}</dd>
            <dt>Closes at (America/New_York 5 PM equivalent)</dt>
            <dd data-testid="admin-window-close">{closeAt}</dd>
            <dt>Slots</dt>
            <dd data-testid="admin-window-size">{rows.length}</dd>
          </dl>
          <table>
            <thead>
              <tr>
                <th>slot</th>
                <th>source_item_id</th>
                <th>close_at</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.window_id}-${r.slot}`} data-testid={`admin-slot-${r.slot}`}>
                  <td>{r.slot}</td>
                  <td>{r.window_id}</td>
                  <td>{r.ny_close_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      {!loading && !error && !windowId ? (
        <p data-testid="admin-public-review-empty">
          No open window. Either the scheduler has not opened one yet or all
          items are past retirement — check <code>process-scheduled-jobs</code>
          and the R2 exclusion table.
        </p>
      ) : null}

      <footer>
        <h2>Panels required by the audit but not yet wired</h2>
        <ul>
          <li>Import runs + reject manifests (needs admin RPC + service role)</li>
          <li>Submission inspection / diff (needs admin RPC + RLS bypass)</li>
          <li>Pre-close unsatisfactory marking (RPC exists: <code>service_mark_review_unsatisfactory</code>)</li>
          <li>Late rejection + contributor alert (RPC exists: <code>service_late_reject_review</code>)</li>
          <li>Report / quarantine resolution (needs admin RPC around <code>service_add_review_exclusion</code>)</li>
          <li>Source eligibility / exclusion history (view against <code>public.review_exclusions</code>)</li>
          <li>Reward + scheduler audit events (view against <code>private.audit_log</code>)</li>
        </ul>
      </footer>
    </section>
  );
}
