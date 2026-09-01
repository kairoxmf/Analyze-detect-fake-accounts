import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n.jsx";
import { useInView } from "../hooks/useInView";
import { useCountUpWhenVisible } from "../hooks/useCountUpWhenVisible";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { downloadCsv, downloadSummaryTxt, downloadPdf } from "../utils/exportReport";
import { gradient, grid, smallSphere, stars } from "../assets";

const toFixed = (value, digits = 2) =>
  Number.isFinite(value) ? value.toFixed(digits) : "0.00";

const Dashboard = ({ summary, results, analysisMeta = {} }) => {
  const { t } = useI18n();
  const [filters, setFilters] = useState({
    risk: "ALL",
    fakeOnly: false,
    botnetOnly: false,
    simulatedOnly: false,
    minProb: 0,
    whitelistOnly: false,
    flaggedOnly: false,
    searchQuery: "",
    sortBy: "prob_desc",
  });
  const [lists, setLists] = useState({ whitelist: [], flagged: [] });

  useEffect(() => {
    try {
      const w = JSON.parse(localStorage.getItem("analyze_whitelist") || "[]");
      const f = JSON.parse(localStorage.getItem("analyze_flagged") || "[]");
      setLists({
        whitelist: Array.isArray(w) ? w : [],
        flagged: Array.isArray(f) ? f : [],
      });
    } catch {
      setLists({ whitelist: [], flagged: [] });
    }
  }, []);

  const filteredResults = useMemo(() => {
    let list = results.filter((item) => {
      const id = (item.username || item.user_id || "").toString();
      const q = (filters.searchQuery || "").trim().toLowerCase();
      if (q && !id.toLowerCase().includes(q)) return false;
      if (filters.risk !== "ALL" && item.risk_level !== filters.risk) {
        return false;
      }
      if (filters.fakeOnly && !item.is_fake) return false;
      if (filters.botnetOnly && !item.botnet_attack_warning) return false;
      if (filters.simulatedOnly && !item.simulated_attack) return false;
      if (filters.whitelistOnly && !lists.whitelist.includes(id)) return false;
      if (filters.flaggedOnly && !lists.flagged.includes(id)) return false;
      if ((item.fake_probability || 0) * 100 < filters.minProb) return false;
      return true;
    });
    const sortBy = filters.sortBy || "prob_desc";
    list = [...list].sort((a, b) => {
      if (sortBy === "prob_desc") return (b.fake_probability || 0) - (a.fake_probability || 0);
      if (sortBy === "prob_asc") return (a.fake_probability || 0) - (b.fake_probability || 0);
      if (sortBy === "username") return String(a.username || a.user_id || "").localeCompare(String(b.username || b.user_id || ""));
      if (sortBy === "risk") {
        const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return (order[a.risk_level] ?? 3) - (order[b.risk_level] ?? 3);
      }
      return 0;
    });
    return list;
  }, [results, filters, lists]);
  const stats = useMemo(() => {
    const source = filteredResults.length ? filteredResults : results;
    const total = source.length;
    const fake = source.filter((r) => r.is_fake).length;
    const real = total - fake;
    const alertCount = source.reduce((acc, r) => acc + (r.alert_score || 0), 0);
    const avgBurst =
      source.reduce((acc, r) => acc + (r.burstiness || 0), 0) / (total || 1);
    const avgNight =
      source.reduce((acc, r) => acc + (r.night_activity_ratio || 0), 0) /
      (total || 1);
    return {
      total,
      fake,
      real,
      alert_count: alertCount,
      temporal_stats: {
        burstiness: avgBurst,
        night_ratio: avgNight,
      },
      avg_fake_probability:
        source.reduce((acc, r) => acc + (r.fake_probability || 0), 0) /
        (total || 1),
      risk_levels: {
        low: source.filter((r) => r.risk_level === "LOW").length,
        medium: source.filter((r) => r.risk_level === "MEDIUM").length,
        high: source.filter((r) => r.risk_level === "HIGH").length,
      },
      behavior_stats: {
        avg:
          source.reduce((acc, r) => acc + (r.behavioral_score || 0), 0) /
          (total || 1),
      },
      botnet_attack_count: source.filter((r) => r.botnet_attack_warning).length,
      simulated_attack_count: source.filter((r) => r.simulated_attack).length,
    };
  }, [filteredResults, results]);

  const fakeRatio = stats.total ? stats.fake / stats.total : 0;
  const ringStyle = {
    background: `conic-gradient(#7c4dff ${fakeRatio * 360}deg, #1b1b2e 0deg)`,
  };
  const avgBehavior = Math.min(stats.behavior_stats?.avg || 0, 100);

  const [statsRef, statsInView] = useInView({ threshold: 0.15 });
  const countTotal = useCountUpWhenVisible(stats.total || 0, statsInView, 700);
  const countFake = useCountUpWhenVisible(stats.fake || 0, statsInView, 700);
  const countReal = useCountUpWhenVisible(stats.real || 0, statsInView, 700);
  const countLow = useCountUpWhenVisible(stats?.risk_levels?.low || 0, statsInView, 600);
  const countMedium = useCountUpWhenVisible(stats?.risk_levels?.medium || 0, statsInView, 600);
  const countHigh = useCountUpWhenVisible(stats?.risk_levels?.high || 0, statsInView, 600);

  return (
    <main className="container pb-16 pt-10 dashboard-page">
      <section ref={statsRef} className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="glass-card p-6 relative overflow-hidden tilt-card">
          <div className="scanline" />
          <img
            src={stars}
            alt=""
            className="pointer-events-none absolute right-4 top-4 w-20 opacity-20"
          />
          <img
            src={grid}
            alt=""
            className="pointer-events-none absolute inset-0 opacity-20 mix-blend-soft-light"
          />
          <img
            src={gradient}
            alt=""
            className="pointer-events-none absolute -right-24 -top-20 w-64 opacity-70"
          />
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            {t("dashboard.fakeReal")}
          </p>
          <div className="mt-6 flex items-center gap-6">
            <div className="chart-ring" style={ringStyle}>
              <div className="chart-ring__inner">
                <span className="text-xs text-white/50">
                  {t("dashboard.fakeLabel")}
                </span>
                <span className="text-xl font-semibold text-white">
                  {toFixed(fakeRatio * 100, 1)}%
                </span>
              </div>
            </div>
            <div className="space-y-3 text-sm text-white/60">
              <p>
                {t("dashboard.fakeLabel")}: {countFake}
              </p>
              <p>
                {t("dashboard.realLabel")}: {countReal}
              </p>
              <p>
                {t("dashboard.totalLabel")}: {countTotal}
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 relative overflow-hidden tilt-card">
          <div className="scanline" />
          <img
            src={smallSphere}
            alt=""
            className="pointer-events-none absolute -left-10 bottom-4 w-16 opacity-80 animate-pulse"
          />
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            {t("dashboard.riskLevels")}
          </p>
          {stats.total > 0 && (() => {
            const chartData = [
              { name: "Low", value: countLow, color: "#34d399" },
              { name: "Medium", value: countMedium, color: "#fbbf24" },
              { name: "High", value: countHigh, color: "#f43f5e" },
            ].filter((d) => d.value > 0);
            return chartData.length > 0 ? (
              <div className="mt-4 h-48 w-full" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1b1b2e", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : null;
          })()}
          <div className="mt-4 space-y-4">
            {["low", "medium", "high"].map((level) => {
              const count = level === "low" ? countLow : level === "medium" ? countMedium : countHigh;
              const total = stats.total || 1;
              return (
                <div key={level}>
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <span>
                      {level === "low"
                        ? t("dashboard.levelLow")
                        : level === "medium"
                        ? t("dashboard.levelMedium")
                        : t("dashboard.levelHigh")}
                    </span>
                    <span>{count}</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-purple-500 via-cyan-400 to-fuchsia-500"
                      style={{ width: `${(count / total) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-6 glass-card p-6 tilt-card relative overflow-hidden">
        <div className="scanline" />
        <img
          src={grid}
          alt=""
          className="pointer-events-none absolute inset-0 opacity-10 mix-blend-soft-light"
        />
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              {t("dashboard.filters")}
            </p>
            <p className="text-sm text-white/70">
              {t("dashboard.filtered")} {filteredResults.length || stats.total}
            </p>
          </div>
          <select
            className="input-field max-w-[150px]"
            value={filters.risk}
            onChange={(event) =>
              setFilters({ ...filters, risk: event.target.value })
            }
          >
            <option value="ALL">{t("dashboard.allRisks")}</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={filters.fakeOnly}
              onChange={(event) =>
                setFilters({ ...filters, fakeOnly: event.target.checked })
              }
            />
            {t("dashboard.fakeOnly")}
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={filters.botnetOnly}
              onChange={(event) =>
                setFilters({ ...filters, botnetOnly: event.target.checked })
              }
            />
            {t("dashboard.botnet")}
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={filters.simulatedOnly}
              onChange={(event) =>
                setFilters({ ...filters, simulatedOnly: event.target.checked })
              }
            />
            {t("dashboard.simulated")}
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={filters.whitelistOnly}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  whitelistOnly: event.target.checked,
                })
              }
            />
            {t("dashboard.whitelistOnly")}
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={filters.flaggedOnly}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  flaggedOnly: event.target.checked,
                })
              }
            />
            {t("dashboard.flaggedOnly")}
          </label>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <span>{t("dashboard.minProb")}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={filters.minProb}
              onChange={(event) =>
                setFilters({ ...filters, minProb: Number(event.target.value) })
              }
              aria-label="Minimum fake probability"
            />
            <span>{filters.minProb}%</span>
          </div>
          <input
            type="search"
            placeholder={t("dashboard.searchUsername") || "Search by username"}
            className="input-field max-w-[220px] text-sm"
            value={filters.searchQuery || ""}
            onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
            aria-label="Search by username"
          />
          <select
            className="input-field max-w-[160px]"
            value={filters.sortBy}
            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
            aria-label="Sort by"
          >
            <option value="prob_desc">{t("dashboard.sortProbDesc") || "Fake % (high first)"}</option>
            <option value="prob_asc">{t("dashboard.sortProbAsc") || "Fake % (low first)"}</option>
            <option value="username">{t("dashboard.sortUsername") || "Username"}</option>
            <option value="risk">{t("dashboard.sortRisk") || "Risk level"}</option>
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-outline inline-flex items-center gap-2 text-sm"
              onClick={() => downloadCsv(filteredResults, "dashboard-export.csv")}
            >
              <i className="fa-solid fa-file-csv" aria-hidden />
              CSV
            </button>
            <button
              type="button"
              className="btn-outline inline-flex items-center gap-2 text-sm"
              onClick={() => downloadSummaryTxt(stats, filteredResults, {})}
            >
              <i className="fa-solid fa-file-lines" aria-hidden />
              Summary
            </button>
            <button
              type="button"
              className="btn-outline inline-flex items-center gap-2 text-sm"
              onClick={() => downloadPdf(summary, filteredResults, analysisMeta).catch(() => {})}
            >
              <i className="fa-solid fa-file-pdf" aria-hidden />
              PDF
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="glass-card p-6 relative overflow-hidden tilt-card">
          <div className="scanline" />
          <img
            src={gradient}
            alt=""
            className="pointer-events-none absolute -right-24 -top-24 w-72 opacity-60"
          />
          <h3 className="text-xl font-semibold text-white">
            {t("dashboard.behavior")}
          </h3>
          <p className="mt-3 text-sm text-white/60">
            {t("dashboard.behaviorHelp")}
          </p>
          <div className="mt-6 flex items-end gap-4">
            <div className="behavior-bar">
              <div
                className="behavior-bar__fill"
                style={{ height: `${avgBehavior}%` }}
              />
            </div>
            <div>
              <p className="text-3xl font-semibold text-white">
                {toFixed(stats.behavior_stats?.avg || 0, 1)}
              </p>
              <p className="text-sm text-white/60">
                {t("dashboard.avgScoreLabel")}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-6 relative overflow-hidden tilt-card">
          <div className="scanline" />
          <h3 className="text-xl font-semibold text-white">
            {t("dashboard.modelOutput")}
          </h3>
          <p className="mt-3 text-sm text-white/60">
            {t("dashboard.modelHelp")}
          </p>
          <div className="mt-6 grid gap-4">
            <div className="stat-card stat-card--accent">
              <p>{t("dashboard.avgFake")}</p>
              <h4>{toFixed((stats.avg_fake_probability || 0) * 100, 1)}%</h4>
            </div>
            <div className="stat-card">
              <p>{t("dashboard.highRisk")}</p>
              <h4>{stats?.risk_levels?.high || 0}</h4>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="glass-card p-6 relative overflow-hidden tilt-card">
          <div className="scanline" />
          <h3 className="text-xl font-semibold text-white">
            {t("dashboard.alerts")}
          </h3>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <div className="flex items-center justify-between">
              <span>{t("dashboard.totalAlerts")}</span>
              <span>{stats.alert_count || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("dashboard.botRings")}</span>
              <span>{summary?.bot_ring_count || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("dashboard.botnet")}</span>
              <span>{stats.botnet_attack_count || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("dashboard.simulated")}</span>
              <span>{stats.simulated_attack_count || 0}</span>
            </div>
          </div>
        </div>
        <div className="glass-card p-6 relative overflow-hidden tilt-card">
          <div className="scanline" />
          <h3 className="text-xl font-semibold text-white">
            {t("dashboard.temporal")}</h3>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <div className="flex items-center justify-between">
              <span>{t("dashboard.burstiness")}</span>
              <span>{(stats.temporal_stats?.burstiness || 0).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("dashboard.nightActivity")}</span>
              <span>{((stats.temporal_stats?.night_ratio || 0) * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 glass-card p-6 tilt-card">
        <h3 className="text-xl font-semibold text-white">
          {t("dashboard.filteredResults")}
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(filteredResults.length ? filteredResults : results)
            .slice(0, 6)
            .map((item) => (
              <div key={item.user_id || item.username} className="result-card">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white">
                    {item.username || item.user_id}
                  </p>
                  <span className="badge badge-outline">
                    {(item.fake_probability * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/50">
                  {item.risk_level} · {item.alert_score || 0} {t("dashboard.alerts")}
                </p>
              </div>
            ))}
        </div>
      </section>
    </main>
  );
};

export default Dashboard;
