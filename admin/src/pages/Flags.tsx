import { useEffect, useState } from "react";
import type { AdminClient } from "../api";
import { formatApiError } from "../App";

const FLAG_KEYS = [
  "contribution_text_enabled",
  "contribution_speech_enabled",
  "contribution_photos_enabled",
  "rewards_enabled",
  "network_ads_enabled",
  "rewarded_ads_enabled",
  "automatic_interstitial_enabled",
  "paywall_enabled",
  "learn_enabled",
  "deletion_processing_enabled",
] as const;

export function FlagsPage({ api }: { api: AdminClient }) {
  const [flags, setFlags] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void api
      .getFlags()
      .then(setFlags)
      .catch((e) => setError(formatApiError(e)));
  }, [api]);

  async function toggle(key: (typeof FLAG_KEYS)[number]) {
    if (!flags) return;
    const next = !(flags[key] === true);
    setBusy(key);
    setError(null);
    try {
      const updated = await api.patchFlags({ [key]: next });
      setFlags(updated);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(null);
    }
  }

  if (error && !flags) return <p className="err">{error}</p>;
  if (!flags) return <p className="muted">Loading flags…</p>;

  return (
    <div>
      <h2>Feature flags</h2>
      {error ? <p className="err">{error}</p> : null}
      <p className="muted">Version {String(flags.version ?? "?")}</p>
      <div className="panel">
        {FLAG_KEYS.map((key) => (
          <div className="row" key={key}>
            <div>
              <strong>{key}</strong>
              <div className="muted">{flags[key] === true ? "on" : "off"}</div>
            </div>
            <button
              type="button"
              disabled={busy === key}
              onClick={() => void toggle(key)}
            >
              {flags[key] === true ? "Disable" : "Enable"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
