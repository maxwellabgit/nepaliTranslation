import { useEffect, useState } from "react";
import type { AdminClient } from "../api";
import { formatApiError } from "../App";

export function DashboardPage({ api }: { api: AdminClient }) {
  const [data, setData] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .dashboard()
      .then(setData)
      .catch((e) => setError(formatApiError(e)));
  }, [api]);

  if (error) return <p className="err">{error}</p>;
  if (!data) return <p className="muted">Loading dashboard…</p>;

  const items: Array<[string, string]> = [
    ["triage_reports", "Triage reports"],
    ["uploaded_media", "Uploaded media"],
    ["open_alerts", "Open alerts"],
    ["pending_deletions", "Pending deletions"],
    ["dataset_exports", "Dataset exports"],
  ];

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="panel grid">
        {items.map(([key, label]) => (
          <div className="stat" key={key}>
            <strong>{data[key] ?? 0}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
