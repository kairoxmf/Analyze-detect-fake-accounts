import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

const LiveStats = ({ apiBase }) => {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const base = apiBase || import.meta.env.VITE_API_URL || "/api";

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const r = await fetch(`${base}/stats/live`);
        if (r.ok) {
          const data = await r.json();
          setStats(data);
        }
      } catch {
      }
    };
    fetchStats();
    const id = setInterval(fetchStats, 30000);
    return () => clearInterval(id);
  }, [base]);

  if (!stats) return null;

  return (
    <div className="flex flex-wrap justify-center gap-3 py-3 lg:gap-4 lg:py-4">
      <div className="stat-mini text-center">
        <p className="text-3xl font-bold text-cyan-400">{stats.total_reports ?? 0}</p>
        <p className="text-xs uppercase tracking-widest text-white/50">{t("home.liveStats.reports")}</p>
      </div>
      <div className="stat-mini text-center">
        <p className="text-3xl font-bold text-emerald-400">{stats.approved_reports ?? 0}</p>
        <p className="text-xs uppercase tracking-widest text-white/50">{t("home.liveStats.approved")}</p>
      </div>
      <div className="stat-mini text-center">
        <p className="text-3xl font-bold text-amber-400">{stats.total_users ?? 0}</p>
        <p className="text-xs uppercase tracking-widest text-white/50">{t("home.liveStats.users")}</p>
      </div>
      <div className="stat-mini text-center">
        <p className="text-3xl font-bold text-rose-400">{stats.fake_accounts_detected ?? 0}</p>
        <p className="text-xs uppercase tracking-widest text-white/50">{t("home.liveStats.realDetected")}</p>
      </div>
    </div>
  );
};

export default LiveStats;
