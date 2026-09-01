import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n.jsx";

const Admin = ({ onLogout }) => {
  const { t } = useI18n();
  const [token, setToken] = useState(
    () => localStorage.getItem("admin_token") || ""
  );
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [rewardData, setRewardData] = useState(null);
  const [rewardError, setRewardError] = useState("");
  const [rewardSuccess, setRewardSuccess] = useState("");
  const [gamificationConfig, setGamificationConfig] = useState(null);
  const [gamificationError, setGamificationError] = useState("");
  const [showGamificationPanel, setShowGamificationPanel] = useState(true);
  const apiBase = useMemo(
    () => import.meta.env.VITE_API_URL || "http://localhost:5000",
    []
  );

  const fetchSummary = async (adminToken) => {
    setError("");
    try {
      const response = await fetch(`${apiBase}/admin/summary`, {
        headers: { "X-Admin-Token": adminToken },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unauthorized");
      }
      const payload = await response.json();
      setData(payload);
    } catch (err) {
      setError(err.message || "Failed to load admin data.");
      setData(null);
    }
  };

  const fetchGamificationConfig = async (adminToken) => {
    setGamificationError("");
    try {
      const response = await fetch(`${apiBase}/admin/rewards/config`, {
        headers: { "X-Admin-Token": adminToken },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Failed to load config.");
      setGamificationConfig({ ...(payload?.config || {}), active_events: payload?.active_events || {} });
    } catch (err) {
      setGamificationError(err.message || "Failed to load config.");
      setGamificationConfig(null);
    }
  };

  const fetchRewardOverview = async (adminToken) => {
    setRewardError("");
    try {
      const response = await fetch(`${apiBase}/admin/rewards/overview`, {
        headers: { "X-Admin-Token": adminToken },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Failed to load reward data.");
      setRewardData(payload);
    } catch (err) {
      setRewardError(err.message || "Failed to load reward data.");
      setRewardData(null);
    }
  };

  const saveGamificationConfig = async (updates) => {
    if (!token) return;
    try {
      const response = await fetch(`${apiBase}/admin/rewards/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token,
        },
        body: JSON.stringify(updates),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Save failed.");
      setGamificationConfig((c) => ({ ...c, ...(payload?.config || {}), active_events: c?.active_events || {} }));
    } catch (err) {
      setGamificationError(err.message || "Save failed.");
    }
  };

  const saveActiveEvents = async (updates) => {
    if (!token) return;
    try {
      const response = await fetch(`${apiBase}/admin/rewards/events`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token,
        },
        body: JSON.stringify(updates),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Save failed.");
      fetchGamificationConfig(token);
    } catch (err) {
      setGamificationError(err.message || "Save failed.");
    }
  };

  const sendNotification = async (userId, title) => {
    if (!token) return;
    const uid = userId || "";
    const t = title || window.prompt("Notification title:", "") || "";
    if (!t) return;
    try {
      const response = await fetch(`${apiBase}/admin/rewards/notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token,
        },
        body: JSON.stringify(uid ? { user_id: uid, title: t } : { title: t }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Send failed.");
      alert(`Sent to ${payload?.sent || 0} users`);
    } catch (err) {
      setGamificationError(err.message || "Send failed.");
    }
  };

  const setHunterOfDay = async (userId) => {
    if (!token) return;
    const uid = userId || window.prompt("User ID:", "") || "";
    if (!uid) return;
    try {
      const response = await fetch(`${apiBase}/admin/rewards/hunter-of-day`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token,
        },
        body: JSON.stringify({ user_id: uid }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Failed.");
      alert("Hunter of the Day set!");
    } catch (err) {
      setGamificationError(err.message || "Failed.");
    }
  };

  useEffect(() => {
    if (token) {
      fetchSummary(token);
      fetchRewardOverview(token);
      fetchGamificationConfig(token);
    }
  }, [token]);

  const reviewClaim = async (claimId, status) => {
    if (!token) return;
    const note = window.prompt("Admin note (optional):", "") || "";
    try {
      const response = await fetch(`${apiBase}/admin/rewards/claim/${claimId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token,
        },
        body: JSON.stringify({ status, review_note: note }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Review failed.");
      fetchRewardOverview(token);
    } catch (err) {
      setRewardError(err.message || "Review failed.");
    }
  };

  const reviewWithdrawal = async (withdrawalId, status) => {
    if (!token) return;
    const note = window.prompt("Admin note (optional):", "") || "";
    try {
      const response = await fetch(`${apiBase}/admin/rewards/withdrawal/${withdrawalId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token,
        },
        body: JSON.stringify({ status, review_note: note }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Review failed.");
      fetchRewardOverview(token);
    } catch (err) {
      setRewardError(err.message || "Review failed.");
    }
  };

  const closeSeason = async () => {
    if (!token) return;
    const note = window.prompt("Season close note (optional):", "") || "";
    setRewardSuccess("");
    setRewardError("");
    try {
      const response = await fetch(`${apiBase}/admin/rewards/season/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token,
        },
        body: JSON.stringify({ note }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Season close failed.");
      setRewardError("");
      const season = payload?.season || {};
      const rewarded = season?.rewarded || [];
      const msg = rewarded.length > 0
        ? `Season closed. Rewards distributed to ${rewarded.length} clan(s): ${rewarded.map((r) => `${r.clan_name} (Rank ${r.rank})`).join(", ")}`
        : "Season closed successfully.";
      setRewardSuccess(msg);
      setTimeout(() => setRewardSuccess(""), 8000);
      fetchRewardOverview(token);
    } catch (err) {
      setRewardError(err.message || "Season close failed.");
    }
  };

  const summary = data?.summary || {};
  const meta = data?.analysis_meta || {};
  const activity = data?.activity || [];
  const topRisky = data?.top_risky || [];
  const rewardStats = rewardData?.stats || {};
  const pendingClaims = rewardData?.pending_claims || [];
  const pendingWithdrawals = rewardData?.pending_withdrawals || [];

  return (
    <main className="container pb-16 pt-10 admin-page">
      <section className="glass-card p-6 tilt-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">
              Admin Control
            </p>
            <h2 className="text-2xl font-semibold text-white">
              {t("admin.title")}
            </h2>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              className="input-field"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={t("admin.token")}
            />
            <button
              className="btn-primary"
              onClick={() => {
                localStorage.setItem("admin_token", token);
                fetchSummary(token);
              }}
            >
              {t("admin.unlock")}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-outline ml-auto" onClick={onLogout}>
            {t("login.logout")}
          </button>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="stat-card">
          <p>{t("admin.lastUpload")}</p>
          <h4>{data?.last_upload_at || "N/A"}</h4>
        </div>
        <div className="stat-card stat-card--accent">
          <p>{t("admin.total")}</p>
          <h4>{summary.total || 0}</h4>
        </div>
        <div className="stat-card">
          <p>{t("admin.model")}</p>
          <h4>{meta.model_type || "N/A"}</h4>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-outline" onClick={closeSeason}>
            Close Current Season + Distribute Clan Rewards
          </button>
          <button
            className="btn-outline"
            onClick={() => setShowGamificationPanel((v) => !v)}
          >
            {showGamificationPanel ? "Hide" : "Show"} Competitions, Events & Lucky Wheel
          </button>
        </div>
        {rewardSuccess && (
          <div className="mt-3 rounded-xl border border-emerald-400/50 bg-emerald-400/20 px-4 py-3 text-sm text-emerald-100">
            {rewardSuccess}
          </div>
        )}
        {rewardError && (
          <div className="mt-3 rounded-xl border border-rose-400/50 bg-rose-400/20 px-4 py-3 text-sm text-rose-100">
            {rewardError}
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-card p-6 tilt-card">
          <h3 className="text-xl font-semibold text-white">
            {t("admin.topRisky")}
          </h3>
          <div className="mt-4 space-y-3">
            {topRisky.length === 0 && (
              <p className="text-sm text-white/50">{t("admin.noData")}</p>
            )}
            {topRisky.map((item) => (
              <div key={item.user} className="result-card">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white">{item.user}</p>
                  <span className="badge badge-danger">
                    {item.risk_level}
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/50">
                  Fake Probability {(item.fake_probability * 100).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 tilt-card">
          <h3 className="text-xl font-semibold text-white">
            {t("admin.activity")}
          </h3>
          <div className="mt-4 space-y-3">
            {activity.length === 0 && (
              <p className="text-sm text-white/50">{t("admin.noActivity")}</p>
            )}
            {activity.map((item, idx) => (
              <div key={`${item.time}-${idx}`} className="text-sm text-white/70">
                <span className="text-white/40">{item.time}</span> ·{" "}
                <span className="text-white">{item.event}</span>{" "}
                {item.username ? `· ${item.username}` : ""}
                {item.file ? `· ${item.file}` : ""}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="stat-card">
          <p>Reward Users</p>
          <h4>{rewardStats.users || 0}</h4>
        </div>
        <div className="stat-card stat-card--accent">
          <p>Pending Claims</p>
          <h4>{rewardStats.claims_pending || 0}</h4>
        </div>
        <div className="stat-card">
          <p>Pending Withdrawals</p>
          <h4>{rewardStats.withdrawals_pending || 0}</h4>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-6 tilt-card">
          <h3 className="text-xl font-semibold text-white">Pending Fake Reports</h3>
          {rewardError && <p className="mt-2 text-sm text-red-400">{rewardError}</p>}
          <div className="mt-4 space-y-3">
            {pendingClaims.length === 0 && (
              <p className="text-sm text-white/50">No pending claims.</p>
            )}
            {pendingClaims.map((item) => (
              <div key={item.id} className="result-card">
                <p className="text-sm text-white">
                  @{item.suspect_username} · {item.platform}
                </p>
                {item.assist && (
                  <div className="mt-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                        Smart Assist
                      </p>
                      <span className={`badge ${item.assist.risk_tag === "HIGH" ? "badge-danger" : item.assist.risk_tag === "MEDIUM" ? "badge-warning" : "badge-success"}`}>
                        {item.assist.risk_tag} · {item.assist.priority_score}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-white/80">{item.assist.summary}</p>
                    <p className="mt-1 text-[11px] text-white/60">
                      Reporter: Lv.{item.assist.reporter_level} · {item.assist.reporter_badge} · Trust {Number(item.assist.reporter_trust_score || 0).toFixed(1)}%
                    </p>
                    {item.assist.fast_lane && (
                      <p className="mt-1 text-[11px] font-semibold text-emerald-300">
                        Fast Lane Reviewer
                      </p>
                    )}
                    {!!item.assist.top_signals?.length && (
                      <p className="mt-1 text-[11px] text-cyan-200/80">
                        Signals: {item.assist.top_signals.join(" • ")}
                      </p>
                    )}
                  </div>
                )}
                {item.evidence && (
                  <p className="mt-2 text-xs text-white/60">Evidence: {item.evidence}</p>
                )}
                {item.note && (
                  <p className="mt-1 text-xs text-white/60">Note: {item.note}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-primary"
                    onClick={() => reviewClaim(item.id, "approved")}
                  >
                    Approve +$25
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() => reviewClaim(item.id, "rejected")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 tilt-card">
          <h3 className="text-xl font-semibold text-white">Pending Withdrawals</h3>
          <div className="mt-4 space-y-3">
            {pendingWithdrawals.length === 0 && (
              <p className="text-sm text-white/50">No pending withdrawals.</p>
            )}
            {pendingWithdrawals.map((item) => (
              <div key={item.id} className="result-card">
                <p className="text-sm text-white">${item.amount_usd} · {item.method}</p>
                <p className="mt-1 text-xs text-white/60 break-all">{item.wallet_address}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-primary"
                    onClick={() => reviewWithdrawal(item.id, "paid")}
                  >
                    Mark Paid
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() => reviewWithdrawal(item.id, "rejected")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8">
      {showGamificationPanel && (
          <div className="space-y-6">
            <div className="glass-card p-6 tilt-card">
              <h3 className="text-xl font-semibold text-white">Active Events</h3>
              {gamificationError && <p className="mt-2 text-sm text-red-400">{gamificationError}</p>}
              <div className="mt-4 flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!(gamificationConfig?.active_events || {}).double_reward}
                    onChange={(e) => { saveActiveEvents({ double_reward: e.target.checked }); setGamificationConfig((c) => ({ ...c, active_events: { ...(c?.active_events || {}), double_reward: e.target.checked } })); }}
                  />
                  <span className="text-sm text-white">2x Rewards</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!(gamificationConfig?.active_events || {}).golden_week}
                    onChange={(e) => { saveActiveEvents({ golden_week: e.target.checked }); setGamificationConfig((c) => ({ ...c, active_events: { ...(c?.active_events || {}), golden_week: e.target.checked } })); }}
                  />
                  <span className="text-sm text-white">Golden Week</span>
                </label>
              </div>
            </div>

            <div className="glass-card p-6 tilt-card">
              <h3 className="text-xl font-semibold text-white">Gamification Config</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-white/60">Golden Hour (0-23, empty=off)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    className="input-field mt-1 w-full"
                    placeholder="e.g. 14"
                    value={gamificationConfig?.golden_hour ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      saveGamificationConfig({ golden_hour: v === "" ? null : parseInt(v, 10) });
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">Birthday Bonus ($)</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field mt-1 w-full"
                    value={gamificationConfig?.birthday_bonus_usd ?? 10}
                    onChange={(e) => saveGamificationConfig({ birthday_bonus_usd: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">Comeback Bonus ($)</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field mt-1 w-full"
                    value={gamificationConfig?.comeback_bonus_usd ?? 5}
                    onChange={(e) => saveGamificationConfig({ comeback_bonus_usd: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">Lucky Wheel Every N reports</label>
                  <input
                    type="number"
                    min="1"
                    className="input-field mt-1 w-full"
                    value={gamificationConfig?.lucky_wheel_every_n ?? 5}
                    onChange={(e) => saveGamificationConfig({ lucky_wheel_every_n: parseInt(e.target.value, 10) || 5 })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-white/60">Season Story</label>
                  <input
                    type="text"
                    className="input-field mt-1 w-full"
                    placeholder="e.g. فصل شکارچیان افسانه‌ای"
                    value={gamificationConfig?.season_story ?? ""}
                    onChange={(e) => saveGamificationConfig({ season_story: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">Lucky Day (0=Mon … 6=Sun, empty=off)</label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    className="input-field mt-1 w-full"
                    placeholder="e.g. 3"
                    value={gamificationConfig?.lucky_day_dow ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      saveGamificationConfig({ lucky_day_dow: v === "" ? null : parseInt(v, 10) });
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">Lucky Day Bonus %</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field mt-1 w-full"
                    value={gamificationConfig?.lucky_day_bonus_pct ?? 15}
                    onChange={(e) => saveGamificationConfig({ lucky_day_bonus_pct: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">Combo Bonus % per Report</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field mt-1 w-full"
                    value={gamificationConfig?.combo_bonus_per_report ?? 2}
                    onChange={(e) => saveGamificationConfig({ combo_bonus_per_report: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">Combo Max %</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field mt-1 w-full"
                    value={gamificationConfig?.combo_max_pct ?? 20}
                    onChange={(e) => saveGamificationConfig({ combo_max_pct: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-white/60">League Thresholds (XP)</label>
                  <div className="mt-1 flex flex-wrap gap-3">
                    <span className="text-white/60">Bronze:</span>
                    <input type="number" min="0" className="input-field w-20" value={(gamificationConfig?.league_thresholds || {}).bronze ?? 0} onChange={(e) => saveGamificationConfig({ league_thresholds: { ...(gamificationConfig?.league_thresholds || {}), bronze: parseInt(e.target.value, 10) || 0 } })} />
                    <span className="text-white/60">Silver:</span>
                    <input type="number" min="0" className="input-field w-20" value={(gamificationConfig?.league_thresholds || {}).silver ?? 500} onChange={(e) => saveGamificationConfig({ league_thresholds: { ...(gamificationConfig?.league_thresholds || {}), silver: parseInt(e.target.value, 10) || 500 } })} />
                    <span className="text-white/60">Gold:</span>
                    <input type="number" min="0" className="input-field w-20" value={(gamificationConfig?.league_thresholds || {}).gold ?? 2000} onChange={(e) => saveGamificationConfig({ league_thresholds: { ...(gamificationConfig?.league_thresholds || {}), gold: parseInt(e.target.value, 10) || 2000 } })} />
                    <span className="text-white/60">Platinum:</span>
                    <input type="number" min="0" className="input-field w-20" value={(gamificationConfig?.league_thresholds || {}).platinum ?? 5000} onChange={(e) => saveGamificationConfig({ league_thresholds: { ...(gamificationConfig?.league_thresholds || {}), platinum: parseInt(e.target.value, 10) || 5000 } })} />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-white/60">Streak Freeze per Month</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field mt-1 w-full max-w-[120px]"
                    value={gamificationConfig?.streak_freeze_per_month ?? 1}
                    onChange={(e) => saveGamificationConfig({ streak_freeze_per_month: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>
            </div>

            <div className="glass-card p-6 tilt-card">
              <h3 className="text-xl font-semibold text-white">Actions</h3>
              <div className="mt-4 flex flex-wrap gap-3">
                <button className="btn-primary" onClick={() => sendNotification()}>
                  Send Notification (All Users)
                </button>
                <button className="btn-outline" onClick={() => setHunterOfDay()}>
                  Set Hunter of the Day
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
};

export default Admin;
