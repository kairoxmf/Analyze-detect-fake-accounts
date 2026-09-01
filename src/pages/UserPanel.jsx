import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

const UserPanel = ({ apiBase, token, currentUser }) => {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${apiBase}/user/panel`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || t("userPanelPage.loadFailed"));
        setData(payload);
      } catch (err) {
        setError(err?.message || t("userPanelPage.loadFailed"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [apiBase, t, token]);

  const rewards = data?.rewards || {};
  const rewardUser = rewards?.user_reward || {};
  const gamification = rewards?.gamification || {};
  const claims = useMemo(() => rewards?.claims || [], [rewards]);
  const pendingClaims = claims.filter((x) => x.status === "pending").length;
  const approvedClaims = claims.filter((x) => x.status === "approved").length;

  return (
    <main className="container user-panel-page pb-16 pt-10">
      <section className="glass-card p-6">
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">{t("userPanelPage.tag")}</p>
        <h2 className="text-2xl font-semibold text-white">
          {currentUser?.display_name || currentUser?.username || t("userPanelPage.user")}
        </h2>
        <div className="mt-2 inline-flex items-center rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1 text-xs text-amber-100">
          {String(
            {
              Rookie: t("rewardsPage.badgeRookie"),
              "Rising Hunter": t("rewardsPage.badgeRisingHunter"),
              "Pro Hunter": t("rewardsPage.badgeProHunter"),
              "Elite Hunter": t("rewardsPage.badgeEliteHunter"),
              Legend: t("rewardsPage.badgeLegend"),
            }[String(gamification?.badge || "Rookie")] || gamification?.badge || t("rewardsPage.badgeRookie")
          )} · {t("rewardsPage.levelAbbr")}{Number(gamification?.level || 1)}
        </div>
        <p className="mt-2 text-sm text-white/70">
          {t("userPanelPage.subtitle")}
        </p>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-4">
        <div className="stat-card">
          <p>{t("userPanelPage.available")}</p>
          <h4>${Number(rewardUser?.available_usd || 0)}</h4>
        </div>
        <div className="stat-card stat-card--accent">
          <p>{t("userPanelPage.lifetimeEarned")}</p>
          <h4>${Number(rewardUser?.lifetime_earned_usd || 0)}</h4>
        </div>
        <div className="stat-card">
          <p>{t("userPanelPage.approvedReports")}</p>
          <h4>{approvedClaims}</h4>
        </div>
        <div className="stat-card">
          <p>{t("userPanelPage.pendingReports")}</p>
          <h4>{pendingClaims}</h4>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("userPanelPage.quickAccess")}</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Link to="/analyze" className="btn-outline text-center">{t("userPanelPage.analyzeCsv")}</Link>
            <Link to="/instagram" className="btn-outline text-center">{t("userPanelPage.instagramScan")}</Link>
            <Link to="/ai-chat" className="btn-outline text-center">{t("userPanelPage.aiChat")}</Link>
            <Link to="/rewards" className="btn-primary text-center">{t("userPanelPage.rewardsPanel")}</Link>
          </div>
        </div>
        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("userPanelPage.account")}</h3>
          <div className="mt-4 space-y-2 text-sm text-white/75">
            <p>{t("userPanelPage.username")}: <span className="text-white">{currentUser?.username || "-"}</span></p>
            <p>{t("userPanelPage.displayName")}: <span className="text-white">{currentUser?.display_name || "-"}</span></p>
            <p>{t("userPanelPage.joined")}: <span className="text-white">{currentUser?.created_at || "-"}</span></p>
            <p>{t("userPanelPage.lastLogin")}: <span className="text-white">{currentUser?.last_login_at || "-"}</span></p>
          </div>
        </div>
      </section>

      <section className="mt-8 glass-card p-6">
        <h3 className="text-xl font-semibold text-white">{t("userPanelPage.recentActivity")}</h3>
        {loading && <p className="mt-3 text-sm text-white/60">{t("userPanelPage.loading")}</p>}
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <div className="mt-4 space-y-3">
          {(data?.activity || []).length === 0 && (
            <p className="text-sm text-white/50">{t("userPanelPage.noActivity")}</p>
          )}
          {(data?.activity || []).map((item, idx) => (
            <div key={`${item.time}-${idx}`} className="result-card">
              <p className="text-sm text-white">{item.event}</p>
              <p className="mt-1 text-xs text-white/50">{item.time}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};

export default UserPanel;
