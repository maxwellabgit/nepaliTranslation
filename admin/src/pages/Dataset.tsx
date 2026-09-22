import { useState, type FormEvent } from "react";
import type { AdminClient } from "../api";
import { formatApiError } from "../App";

export function DatasetPage({ api }: { api: AdminClient }) {
  const [version, setVersion] = useState("");
  const [objectPath, setObjectPath] = useState("staging/exports/");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.stageExport({
        version,
        object_path: objectPath,
        filter_manifest: { note: "manual_staging_only" },
        row_count: 0,
      });
      setResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Dataset staging</h2>
      <p className="muted">
        Manual export metadata only. Does not train models or modify benchmarks.
      </p>
      <form className="panel stack" onSubmit={onSubmit}>
        <div>
          <label htmlFor="version">Version label</label>
          <input
            id="version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            required
            placeholder="2026-09-22.ops"
          />
        </div>
        <div>
          <label htmlFor="path">Object path</label>
          <input
            id="path"
            value={objectPath}
            onChange={(e) => setObjectPath(e.target.value)}
            required
          />
        </div>
        {error ? <p className="err">{error}</p> : null}
        <button type="submit" disabled={busy}>
          {busy ? "Staging…" : "Stage export record"}
        </button>
      </form>
      {result ? (
        <pre className="panel" style={{ overflow: "auto" }}>
          {result}
        </pre>
      ) : null}
    </div>
  );
}
