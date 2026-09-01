import { useEffect, useState } from "react";
import { useI18n } from "../i18n.jsx";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { grid } from "../assets";

const Stats = ({ apiBase }) => {
  const { t } = useI18n();
  const base = apiBase || import.meta.env.VITE_API_URL || "/api";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const r = await fetch(`${base}/stats/overview`);
        if (r.ok) {
          const d = await r.json();
          setData(d);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [base]);

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

  const chart = data?.chart || [];
  const monthChange = data?.month_change_pct ?? 0;

  return (
    <main className="container pb-16 pt-10 stats-page">
      <h1 className="text-2xl font-bold text-white md:text-3xl">
        {t("stats.title") || "Statistics & Charts"}
      </h1>
      <p className="mt-2 text-white/60">
        {t("stats.subtitle") || "Reports over time and monthly comparison."}
      </p>

      <section className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card p-6 tilt-card relative overflow-hidden">
          <div className="scanline" />
          <img src={grid} alt="" className="pointer-events-none absolute inset-0 opacity-10 mix-blend-soft-light" />
          <p className="text-sm uppercase tracking-widest text-white/50">{t("stats.totalReports") || "Total Reports"}</p>
          <p className="mt-2 text-3xl font-bold text-cyan-400">{data?.total_reports ?? 0}</p>
        </div>
        <div className="glass-card p-6 tilt-card relative overflow-hidden">
          <div className="scanline" />
          <p className="text-sm uppercase tracking-widest text-white/50">{t("stats.approved") || "Approved"}</p>
          <p className="mt-2 text-3xl font-bold text-emerald-400">{data?.approved_reports ?? 0}</p>
        </div>
        <div className="glass-card p-6 tilt-card relative overflow-hidden">
          <div className="scanline" />
          <p className="text-sm uppercase tracking-widest text-white/50">{t("stats.thisMonth") || "This Month"}</p>
          <p className="mt-2 text-3xl font-bold text-amber-400">{data?.this_month ?? 0}</p>
        </div>
        <div className="glass-card p-6 tilt-card relative overflow-hidden">
          <div className="scanline" />
          <p className="text-sm uppercase tracking-widest text-white/50">{t("stats.vsLastMonth") || "vs Last Month"}</p>
          <p className={`mt-2 text-3xl font-bold ${monthChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {monthChange >= 0 ? "+" : ""}{monthChange}%
          </p>
        </div>
      </section>

      <section className="mt-8 glass-card p-6 tilt-card relative overflow-hidden">
        <div className="scanline" />
        <img src={grid} alt="" className="pointer-events-none absolute inset-0 opacity-10 mix-blend-soft-light" />
        <h2 className="text-xl font-semibold text-white">
          {t("stats.reportsOverTime") || "Reports Over Time"}
        </h2>
        <div className="mt-6 h-64 w-full md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1b1b2e", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px" }}
                labelStyle={{ color: "#fff" }}
              />
              <Legend />
              <Line type="monotone" dataKey="reports" stroke="#7c4dff" strokeWidth={2} dot={false} name={t("stats.reports") || "Reports"} />
              <Line type="monotone" dataKey="approved" stroke="#34d399" strokeWidth={2} dot={false} name={t("stats.approved") || "Approved"} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
};

export default Stats;
