import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n.jsx";

const Leaderboard = ({ apiBase }) => {
  const { t } = useI18n();
  const base = apiBase || import.meta.env.VITE_API_URL || "/api";
  const [data, setData] = useState({ weekly: [], monthly: [], hall_of_fame: [] });
  const [tab, setTab] = useState("weekly");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const r = await fetch(`${base}/rewards/leaderboard`);
        if (r.ok) {
          const d = await r.json();
          setData(d);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [base]);

  const list = data[tab] || [];

  return (
    <main className="container pb-16 pt-10 leaderboard-page">
      <h1 className="text-2xl font-bold text-white md:text-3xl">
        {t("leaderboard.title") || "Leaderboard"}
      </h1>
      <p className="mt-2 text-white/60">
        {t("leaderboard.subtitle") || "Top hunters by approved reports."}
      </p>

      <div className="mt-6 flex gap-2">
        {["weekly", "monthly", "hall_of_fame"].map((k) => (
          <button
            key={k}
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === k ? "bg-purple-500/30 text-white" : "bg-white/10 text-white/70 hover:bg-white/15"
            }`}
            onClick={() => setTab(k)}
          >
            {k === "weekly" ? (t("leaderboard.weekly") || "Weekly") : k === "monthly" ? (t("leaderboard.monthly") || "Monthly") : (t("leaderboard.hallOfFame") || "Hall of Fame")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 glass-card p-12 text-center">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-white/60" />
        </div>
      ) : (
        <section className="mt-8 space-y-3">
          {list.map((u, i) => (
            <div key={u.user_id} className="glass-card p-4 tilt-card flex items-center gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white/80">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Link to={`/profile/${u.user_id}`} className="font-semibold text-white hover:text-cyan-400 truncate block">
                  {u.display_name || `User ${u.user_id?.slice(0, 8)}`}
                </Link>
                <p className="text-sm text-white/50">{u.badge || u.level || ""}</p>
              </div>
              <span className="font-bold text-cyan-400">
                ${tab === "hall_of_fame" ? (u.lifetime_earned_usd ?? 0) : tab === "monthly" ? (u.monthly_earned_usd ?? 0) : (u.weekly_earned_usd ?? 0)}
              </span>
            </div>
          ))}
        </section>
      )}
    </main>
  );
};

export default Leaderboard;
