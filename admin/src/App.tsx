import { useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { AdminApiError, createAdminClient, type AdminClient } from "./api";
import { createBrowserSupabase, hasSupabaseConfig } from "./supabase";
import { DashboardPage } from "./pages/Dashboard";
import { PublicReviewPage } from "./pages/PublicReview";
import { AlertsPage } from "./pages/Alerts";
import { DeletionsPage } from "./pages/Deletions";
import { FlagsPage } from "./pages/Flags";
import { DatasetPage } from "./pages/Dataset";
import { LoginPage } from "./pages/Login";

export function App() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setBootError("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
      return;
    }
    try {
      const client = createBrowserSupabase();
      setSupabase(client);
      client.auth.getSession().then(({ data }) => setSession(data.session));
      const { data: sub } = client.auth.onAuthStateChange((_e, next) => {
        setSession(next);
      });
      return () => sub.subscription.unsubscribe();
    } catch (e) {
      setBootError(e instanceof Error ? e.message : "boot_failed");
    }
  }, []);

  const api: AdminClient | null = useMemo(() => {
    if (!supabase || !hasSupabaseConfig()) return null;
    const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    return createAdminClient({
      baseUrl,
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      getAccessToken: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      },
    });
  }, [supabase]);

  if (bootError) {
    return (
      <div className="shell">
        <h1>NepTranslate Admin</h1>
        <p className="err">{bootError}</p>
        <p className="muted">Copy admin/.env.example → .env (anon key only).</p>
      </div>
    );
  }

  if (!supabase || !api) {
    return <div className="shell muted">Loading…</div>;
  }

  if (!session) {
    return <LoginPage supabase={supabase} />;
  }

  return (
    <div className="shell">
      <nav className="nav">
        <span className="brand">NepTranslate Admin</span>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/public-review">Public Review</NavLink>
        <NavLink to="/alerts">Alerts</NavLink>
        <NavLink to="/deletions">Deletions</NavLink>
        <NavLink to="/flags">Flags</NavLink>
        <NavLink to="/dataset">Dataset</NavLink>
        <button
          className="secondary"
          type="button"
          onClick={() => void supabase.auth.signOut()}
        >
          Sign out
        </button>
      </nav>
      <Routes>
        <Route path="/" element={<DashboardPage api={api} />} />
        <Route path="/review" element={<Navigate to="/public-review" replace />} />
        <Route path="/public-review" element={<PublicReviewPage api={api} />} />
        <Route path="/alerts" element={<AlertsPage api={api} />} />
        <Route path="/deletions" element={<DeletionsPage api={api} />} />
        <Route path="/flags" element={<FlagsPage api={api} />} />
        <Route path="/dataset" element={<DatasetPage api={api} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export function formatApiError(err: unknown): string {
  if (err instanceof AdminApiError) {
    if (err.code === "forbidden") return "Forbidden (not an active admin)";
    return `${err.code} (${err.status})`;
  }
  return err instanceof Error ? err.message : "unknown_error";
}
