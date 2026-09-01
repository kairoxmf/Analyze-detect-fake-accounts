import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n.jsx";

const MyReports = ({ apiBase, token }) => {
  const { t } = useI18n();
  const base = apiBase || import.meta.env.VITE_API_URL || "/api";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${base}/rewards/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setData(d);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [base, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!token) {
    return (
      <main className="container pb-16 pt-10">
        <div className="glass-card p-12 text-center">
          <p className="text-white/70">{t("myReports.loginRequired") || "Please log in to view your reports."}</p>
          <Link to="/user/auth" className="btn-primary mt-4 inline-block">
            {t("nav.login") || "Login"}
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="container pb-16 pt-10">
        <div className="glass-card p-12 text-center">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-white/60" />
          <p className="mt-4 text-white/70">{t("common.loading") || "Loading..."}</p>
        </div>
      </main>
    );
  }

  const claims = data?.claims || [];
  const sorted = [...claims].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return (
    <main className="container pb-16 pt-10 my-reports-page">
      <h1 className="text-2xl font-bold text-white md:text-3xl">
        {t("myReports.title") || "My Reports"}
      </h1>
      <p className="mt-2 text-white/60">
        {t("myReports.subtitle") || "History of your submitted reports."}
      </p>

      <section className="mt-8 space-y-4">
        {sorted.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <i className="fa-solid fa-inbox text-4xl text-white/30" />
            <p className="mt-4 text-white/60">{t("myReports.empty") || "No reports yet."}</p>
            <Link to="/rewards" className="btn-primary mt-4 inline-block">
              {t("myReports.submitReport") || "Submit Report"}
            </Link>
          </div>
        ) : (
          sorted.map((c) => (
            <div key={c.id} className="glass-card p-6 tilt-card flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-white">@{c.suspect_username || c.username || "—"}</p>
                <p className="text-sm text-white/50">{c.platform || "instagram"} · {new Date(c.created_at).toLocaleDateString()}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  c.status === "approved"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : c.status === "rejected"
                    ? "bg-rose-500/20 text-rose-400"
                    : "bg-amber-500/20 text-amber-400"
                }`}
              >
                {c.status === "approved" ? t("myReports.approved") || "Approved" : c.status === "rejected" ? t("myReports.rejected") || "Rejected" : t("myReports.pending") || "Pending"}
              </span>
            </div>
          ))
        )}
      </section>
    </main>
  );
};

export default MyReports;
