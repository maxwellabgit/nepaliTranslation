import { useCallback, useEffect, useState } from "react";
import type { AdminClient } from "../api";
import { formatApiError } from "../App";

type Report = {
  id: string;
  item_type: string;
  source_preview?: string;
  model_preview?: string;
  created_at?: string;
};

type Media = {
  id: string;
  item_type: string;
  kind?: string;
  content_type?: string;
  created_at?: string;
};

export function ReviewPage({ api }: { api: AdminClient }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    void api
      .review()
      .then((res) => {
        setReports((res.reports ?? []) as Report[]);
        setMedia((res.media ?? []) as Media[]);
      })
      .catch((e) => setError(formatApiError(e)));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(item_type: string, item_id: string, decision: "approve" | "reject") {
    try {
      if (decision === "approve") await api.approve(item_type, item_id);
      else await api.reject(item_type, item_id);
      load();
    } catch (e) {
      setError(formatApiError(e));
    }
  }

  async function preview(media_id: string) {
    try {
      const signed = await api.signMedia(media_id);
      setPreviewUrl(signed.signed_url);
      setPreviewKind(signed.kind ?? signed.content_type ?? null);
    } catch (e) {
      setError(formatApiError(e));
    }
  }

  return (
    <div>
      <h2>Review queue</h2>
      {error ? <p className="err">{error}</p> : null}

      <div className="panel">
        <h3>Translation reports</h3>
        {reports.length === 0 ? <p className="muted">No triage reports.</p> : null}
        {reports.map((r) => (
          <div className="row" key={r.id}>
            <div>
              <div>{r.source_preview ?? r.id}</div>
              <div className="muted">{r.model_preview}</div>
            </div>
            <div>
              <button type="button" onClick={() => void decide("translation_report", r.id, "approve")}>
                Approve
              </button>{" "}
              <button
                type="button"
                className="danger"
                onClick={() => void decide("translation_report", r.id, "reject")}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>Contribution media</h3>
        {media.length === 0 ? <p className="muted">No uploaded media.</p> : null}
        {media.map((m) => (
          <div className="row" key={m.id}>
            <div>
              <div>
                {m.kind} · {m.content_type}
              </div>
              <div className="muted">{m.id}</div>
            </div>
            <div>
              <button type="button" className="secondary" onClick={() => void preview(m.id)}>
                Preview
              </button>{" "}
              <button type="button" onClick={() => void decide("contribution_media", m.id, "approve")}>
                Approve
              </button>{" "}
              <button
                type="button"
                className="danger"
                onClick={() => void decide("contribution_media", m.id, "reject")}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
        {previewUrl ? (
          <div>
            <p className="muted">Media preview (audited)</p>
            {previewKind?.includes("image") || previewKind === "photo" ? (
              <img className="preview" src={previewUrl} alt="Contribution preview" />
            ) : (
              <audio className="preview" controls src={previewUrl} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
