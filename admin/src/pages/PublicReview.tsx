import { useEffect, useState } from "react";
import type { AdminClient } from "../api";
import { formatApiError } from "../App";
import { ReviewPage } from "./Review";

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
  const [submissionId, setSubmissionId] = useState("");
  const [contentHash, setContentHash] = useState("");
  const [reason, setReason] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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
        <p data-testid="admin-always-pass-notice">
          Temporary V1 rule: automated cosine review logs a real score and
          always returns PASS. A human unsatisfactory mark before close still
          prevents the reward.
        </p>
        <h1>Today's 10 — current window</h1>
        <p>
          Shared window for every eligible reviewer. Translation reports and
          contribution media are on this page. Unsatisfactory marks and
          quarantine write through the admin API.
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

      <section data-testid="admin-review-actions">
        <h2>Adjudication</h2>
        <label>
          Submission ID
          <input
            data-testid="admin-submission-id"
            value={submissionId}
            onChange={(event) => setSubmissionId(event.target.value)}
          />
        </label>
        <label>
          Content hash
          <input
            data-testid="admin-content-hash"
            value={contentHash}
            onChange={(event) => setContentHash(event.target.value)}
          />
        </label>
        <label>
          Reason
          <input
            data-testid="admin-review-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <button
          type="button"
          data-testid="admin-mark-unsatisfactory"
          onClick={() => {
            void api.markReviewUnsatisfactory(submissionId.trim(), reason.trim())
              .then(() => setActionMessage("Unsatisfactory mark saved."))
              .catch((e) => setError(formatApiError(e)));
          }}
        >
          Mark unsatisfactory
        </button>
        <button
          type="button"
          data-testid="admin-quarantine"
          onClick={() => {
            void api.quarantineReviewHash(contentHash.trim(), reason.trim())
              .then(() => setActionMessage("Quarantine saved."))
              .catch((e) => setError(formatApiError(e)));
          }}
        >
          Quarantine hash
        </button>
        {actionMessage ? <p data-testid="admin-action-message">{actionMessage}</p> : null}
      </section>
      <ReviewPage api={api} />
    </section>
  );
}
