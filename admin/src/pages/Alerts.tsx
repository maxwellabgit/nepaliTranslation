import { useEffect, useState } from "react";
import type { AdminClient } from "../api";
import { formatApiError } from "../App";

type Alert = {
  id: string;
  user_id: string;
  alert_type: string;
  message?: string | null;
  created_at?: string;
  acknowledged_at?: string | null;
};

export function AlertsPage({ api }: { api: AdminClient }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .alerts()
      .then((res) => setAlerts((res.alerts ?? []) as Alert[]))
      .catch((e) => setError(formatApiError(e)));
  }, [api]);

  if (error) return <p className="err">{error}</p>;

  return (
    <div>
      <h2>Contributor alerts</h2>
      <div className="panel">
        {alerts.length === 0 ? <p className="muted">No alerts.</p> : null}
        {alerts.map((a) => (
          <div className="row" key={a.id}>
            <div>
              <strong>{a.alert_type}</strong>
              <div className="muted">
                {a.user_id} · {a.created_at}
                {a.acknowledged_at ? " · acknowledged" : " · open"}
              </div>
              {a.message ? <div>{a.message}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
