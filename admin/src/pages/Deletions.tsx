import { useEffect, useState } from "react";
import type { AdminClient } from "../api";
import { formatApiError } from "../App";

type Deletion = {
  user_id: string;
  deletion_requested_at?: string;
  deletion_due_at?: string;
  consent_withdrawn_at?: string | null;
};

export function DeletionsPage({ api }: { api: AdminClient }) {
  const [rows, setRows] = useState<Deletion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .deletions()
      .then((res) => setRows((res.deletions ?? []) as Deletion[]))
      .catch((e) => setError(formatApiError(e)));
  }, [api]);

  if (error) return <p className="err">{error}</p>;

  return (
    <div>
      <h2>Deletion queue</h2>
      <p className="muted">30-day purge window after withdrawal / account deletion.</p>
      <div className="panel">
        {rows.length === 0 ? <p className="muted">No pending deletions.</p> : null}
        {rows.map((d) => (
          <div className="row" key={d.user_id}>
            <div>
              <div>{d.user_id}</div>
              <div className="muted">
                requested {d.deletion_requested_at} · due {d.deletion_due_at}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
