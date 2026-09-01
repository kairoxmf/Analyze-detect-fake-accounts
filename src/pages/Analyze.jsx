import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n.jsx";
import ReportPanel from "../components/ReportPanel";
import { SkeletonCard, SkeletonList } from "../components/Skeleton";
import { useToast } from "../context/ToastContext";
import { downloadCsv, downloadSummaryTxt } from "../utils/exportReport";
import { getHistory } from "../utils/analysisHistory";
import { gradient, grid, smallSphere, loading1 } from "../assets";

const apiBase = () => import.meta.env.VITE_API_URL || "http://localhost:5000";

const toFixed = (value, digits = 2) =>
  Number.isFinite(value) ? value.toFixed(digits) : "0.00";

const useCountUp = (value, duration = 800) => {
  const [display, setDisplay] = useState(0);
  const lastDisplayRef = useRef(0);

  useEffect(() => {
    let start = 0;
    const end = Number.isFinite(value) ? value : 0;
    const step = Math.max(end / (duration / 16), 1);

    const tick = () => {
      start = Math.min(start + step, end);
      const next = Math.round(start);
      if (next !== lastDisplayRef.current) {
        lastDisplayRef.current = next;
        setDisplay(next);
      }
      if (start < end) requestAnimationFrame(tick);
    };

    lastDisplayRef.current = 0;
    requestAnimationFrame(tick);
    return () => {};
  }, [value, duration]);

  return display;
};

const Analyze = ({
  results,
  summary,
  loading,
  error,
  errorHints,
  selectedUser,
  analysisMeta,
  uploadProgress = 0,
  onUpload,
  onLookup,
  onLoadDemo,
}) => {
  const { t, lang } = useI18n();
  const { addToast } = useToast();
  const isRTL = lang === "fa" || lang === "ar";
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [username, setUsername] = useState("");
  const [apiOnline, setApiOnline] = useState(null);
  const [report, setReport] = useState(null);
  const [uploadName, setUploadName] = useState("");
  const [history, setHistory] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [manualFake, setManualFake] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [compareIds, setCompareIds] = useState([]);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [feedbackSending, setFeedbackSending] = useState(null);

  useEffect(() => {
    try {
      const w = JSON.parse(localStorage.getItem("analyze_whitelist") || "[]");
      const f = JSON.parse(localStorage.getItem("analyze_flagged") || "[]");
      if (Array.isArray(w)) setWhitelist(w);
      if (Array.isArray(f)) setManualFake(f);
    } catch {
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("analyze_whitelist", JSON.stringify(whitelist));
    } catch {
    }
  }, [whitelist]);

  useEffect(() => {
    try {
      localStorage.setItem("analyze_flagged", JSON.stringify(manualFake));
    } catch {
    }
  }, [manualFake]);

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return results;
    const q = searchQuery.trim().toLowerCase();
    return results.filter((r) => {
      const id = (r.username || r.user_id || "").toString().toLowerCase();
      return id.includes(q);
    });
  }, [results, searchQuery]);

  const stats = useMemo(() => {
    if (summary && !searchQuery.trim()) return summary;
    const source = searchQuery.trim() ? filteredResults : results;
    const total = source.length;
    const fake = source.filter((r) => r.is_fake).length;
    const real = total - fake;
    const botRings = source.filter((r) => r.bot_ring_warning).length;
    const avgProb =
      source.reduce((acc, r) => acc + (r.fake_probability || 0), 0) /
      (total || 1);
    return {
      total,
      fake,
      real,
      bot_ring_count: botRings,
      avg_fake_probability: avgProb,
      risk_levels: {
        low: source.filter((r) => r.risk_level === "LOW").length,
        medium: source.filter((r) => r.risk_level === "MEDIUM").length,
        high: source.filter((r) => r.risk_level === "HIGH").length,
      },
    };
  }, [summary, results, searchQuery, filteredResults]);

  useEffect(() => {
    setAnalysisHistory(getHistory());
  }, [results.length]);


  const submitFeedback = async (userId, correct) => {
    setFeedbackSending(userId);
    try {
      const res = await fetch(`${apiBase()}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, correct }),
      });
      if (res.ok) addToast(correct ? "Marked as correct" : "Marked as wrong");
      else addToast("Failed to send feedback", "info");
    } catch {
      addToast("Failed to send feedback", "info");
    } finally {
      setFeedbackSending(null);
    }
  };

  const toggleCompare = (id) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
    setOpenMenuId(null);
  };

  const compareItems = useMemo(() => {
    return compareIds.map((id) => results.find((r) => (r.username || r.user_id) === id)).filter(Boolean);
  }, [compareIds, results]);

  const uploadStatus = useMemo(() => {
    if (loading) return uploadProgress >= 100 ? t("analyze.processing") : t("analyze.uploading");
    if (analysisMeta?.fileName) return t("analyze.uploaded");
    if (uploadName) return t("analyze.waiting");
    return t("analyze.noFile");
  }, [analysisMeta, loading, uploadName, uploadProgress, t]);

  const trustScore = selectedUser ? selectedUser.trust_score : 0;
  const trustDisplay = useCountUp(trustScore, 900);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (file) {
      setUploadName(file.name);
      onUpload(file);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleLookup = () => {
    if (!username.trim()) return;
    onLookup(username.trim());
    setUsername("");
  };

  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/results`)
      .then((res) => {
        if (!active) return;
        setApiOnline(res.ok);
      })
      .catch(() => {
        if (!active) return;
        setApiOnline(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const loadReport = async () => {
      if (!results.length) {
        setReport(null);
        return;
      }
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/reports`
        );
        if (!response.ok) return;
        const payload = await response.json();
        setReport(payload);
      } catch {
        setReport(null);
      }
    };
    loadReport();
  }, [results]);

  const handleDemo = async () => {
    if (onLoadDemo) onLoadDemo();
  };

  useEffect(() => {
    if (!selectedUser) return;
    const id =
      selectedUser.username ||
      selectedUser.user_id ||
      username ||
      igUsername ||
      "";
    if (!id) return;
    setHistory((prev) => {
      const next = [
        {
          id: `${id}-${Date.now()}`,
          user: id,
          fake: selectedUser.is_fake,
          prob: selectedUser.fake_probability || 0,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ];
      return next.slice(0, 10);
    });
  }, [selectedUser]);

  return (
    <main
      className={`container pb-16 pt-10 analyze-page ${
        isRTL ? "text-right" : ""
      }`}
    >
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div
          data-tour="upload"
          className={`upload-zone card-hover ${dragActive ? "upload-zone--active" : ""} tilt-card ${
            isRTL ? "order-2" : ""
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          {loading && uploadProgress > 0 && (
            <div className="absolute left-0 right-0 top-0 z-20 h-1 rounded-b overflow-hidden bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
          <div className="upload-glow" />
          <div className="scanline" />
          <img
            src={grid}
            alt=""
            className="pointer-events-none absolute inset-0 opacity-20 mix-blend-soft-light"
          />
          <img
            src={gradient}
            alt=""
            className="pointer-events-none absolute -right-24 -top-16 w-64 opacity-70"
          />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-file-csv text-2xl opacity-80" />
              <p className="text-sm uppercase tracking-[0.3em] text-white/50">
                {t("analyze.uploadTag")}
              </p>
            </div>
            <h2 className="text-2xl font-semibold text-white neon-title">
              {t("analyze.uploadTitle")}
            </h2>
            <p className="text-sm text-white/60">{t("analyze.uploadBody")}</p>
            <div className="flex flex-wrap gap-3">
              <button
                data-sound="click"
                className="btn-primary inline-flex items-center gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="fa-solid fa-folder-open" />
                {t("analyze.select")}
              </button>
              <button data-sound="click" data-tour="demo" className="btn-outline inline-flex items-center gap-2" onClick={handleDemo}>
                <i className="fa-solid fa-bolt" />
                {t("analyze.demo")}
              </button>
              <span className="text-xs text-white/50">
                {t("analyze.demoHint")}
              </span>
            </div>
            <p className="text-xs text-white/40">
              {analysisMeta?.fileName
                ? (lang === "fa"
                    ? `فایل فعال: ${analysisMeta.fileName}`
                    : lang === "ar"
                      ? `الملف النشط: ${analysisMeta.fileName}`
                      : `Active file: ${analysisMeta.fileName}`)
                : uploadName
                  ? (lang === "fa"
                      ? `فایل انتخاب‌شده: ${uploadName}`
                      : lang === "ar"
                        ? `الملف المحدد: ${uploadName}`
                        : `Selected file: ${uploadName}`)
                  : lang === "fa"
                    ? "هنوز فایلی آپلود نشده."
                    : lang === "ar"
                      ? "لا يوجد ملف مرفوع بعد."
                      : "No file uploaded yet."}
            </p>
            <p className="text-xs text-white/60">{uploadStatus}</p>
            {error && (
              <p className="text-xs text-red-400">
                {error}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => handleFiles(event.target.files)}
            />
          </div>
        </div>

        <div
          className={`glass-card card-hover p-6 relative overflow-hidden tilt-card ${
            isRTL ? "order-1" : ""
          }`}
        >
          <div className="scanline" />
          <img
            src={gradient}
            alt=""
            className="pointer-events-none absolute -left-24 -top-20 w-56 opacity-40"
          />
          <img
            src={smallSphere}
            alt=""
            className="pointer-events-none absolute -right-10 bottom-4 w-16 opacity-80 animate-pulse"
          />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-white/50">
                {t("analyze.liveSignal")}
              </p>
              <h3 className="text-xl font-semibold text-white">
                {t("analyze.lookup")}
              </h3>
            </div>
            <span className={`badge ${apiOnline ? "badge-pulse" : ""}`}>
              {analysisMeta?.modelType || "ML"} ·{" "}
              {apiOnline === null
                ? "…"
                : apiOnline
                  ? t("analyze.apiReady")
                  : t("analyze.apiFail")}
            </span>
          </div>
          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="input-field"
              placeholder={t("analyze.enterUsername")}
            />
            <button
              data-sound="click"
              className="btn-primary inline-flex items-center gap-2"
              onClick={handleLookup}
              disabled={results.length === 0}
              title={results.length === 0 ? t("analyze.needUpload") : ""}
            >
              <i className="fa-solid fa-magnifying-glass" />
              {t("analyze.analyzeBtn")}
            </button>
          </div>
          <p className="mt-3 text-xs text-white/40">
            {t("analyze.lookupHint")}
          </p>
          {results.length === 0 && (
            <p className="mt-2 text-xs text-amber-300">
              {t("analyze.needUpload")}
            </p>
          )}

          {selectedUser && (
          <div className="mt-6 space-y-4">
              <div className="meter" style={{ "--value": trustScore / 100 }}>
                <div className="meter-inner">
                  <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                    {t("analyze.trust")}
                  </span>
                  <span className="text-3xl font-semibold text-white">
                    {trustDisplay}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <span className="badge">
                  {selectedUser.is_fake ? t("analyze.fake") : t("analyze.real")}
                </span>
                <span className="badge badge-outline">
                  {t("analyze.risk")} {selectedUser.risk_level}
                </span>
                {selectedUser.bot_ring_warning && (
                  <span className="badge badge-danger">
                    {t("analyze.botRing")}
                  </span>
                )}
                {selectedUser.botnet_attack_warning && (
                  <span className="badge badge-danger">
                    {t("analyze.botnet")}
                  </span>
                )}
                {selectedUser.simulated_attack && (
                  <span className="badge badge-danger">
                    {t("analyze.simulatedAttack")}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm text-white/60">
                  {t("analyze.probSelected")}:{" "}
                  <span className="text-white">
                    {toFixed(selectedUser.fake_probability * 100, 1)}%
                  </span>
                </p>
                <p className="text-sm text-white/60">
                  {t("analyze.behavior")}:{" "}
                  <span className="text-white">
                    {toFixed(selectedUser.behavioral_score, 1)}
                  </span>
                </p>
                {typeof selectedUser.sentiment_score === "number" && (
                  <p className="text-sm text-white/60">
                    {t("analyze.sentiment")}:{" "}
                    <span className="text-white">
                      {toFixed(selectedUser.sentiment_score, 1)}
                    </span>
                  </p>
                )}
                {typeof selectedUser.suspicious_keyword_score === "number" && (
                  <p className="text-sm text-white/60">
                    {t("analyze.suspicious")}:{" "}
                    <span className="text-white">
                      {selectedUser.suspicious_keyword_score}
                    </span>
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn-outline mt-3 px-4 py-2 text-xs"
                onClick={async () => {
                  const u = selectedUser;
                  if (!u) return;
                  const lines = [];
                  const name = u.username || u.user_id || "Unknown";
                  lines.push(`Account: ${name}`);
                  lines.push(
                    `Fake probability: ${toFixed(
                      (u.fake_probability || 0) * 100,
                      1
                    )}%`
                  );
                  lines.push(
                    `Trust score: ${toFixed(u.trust_score || 0, 0)} / 100`
                  );
                  lines.push(`Risk level: ${u.risk_level || "LOW"}`);
                  if (u.alerts && u.alerts.length) {
                    lines.push("Alerts:");
                    u.alerts.slice(0, 5).forEach((a) => lines.push(`- ${a}`));
                  }
                  if (u.reasons && u.reasons.length) {
                    lines.push("Reasons:");
                    u.reasons.slice(0, 4).forEach((r) => lines.push(`- ${r}`));
                  }
                  const text = lines.join("\n");
                  try {
                    await navigator.clipboard.writeText(text);
                    setCopyStatus("copied");
                    addToast(t("instagramPage.copyReportDone") || "Copied!");
                  } catch {
                    setCopyStatus("copied");
                    addToast(t("instagramPage.copyReportDone") || "Copied!");
                  }
                }}
              >
                {t("instagramPage.copyReport")}
              </button>
              {copyStatus === "copied" && (
                <p className="text-xs text-emerald-300">
                  {t("instagramPage.copyReportDone")}
                </p>
              )}
              <div className="glass-card p-4 relative overflow-hidden tilt-card">
                <div className="scanline" />
                <p className="text-sm uppercase tracking-[0.2em] text-white/50">
                  {t("analyze.explain")}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-white/70">
                  {(selectedUser.reasons || []).slice(0, 4).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
              <div className="glass-card p-4 relative overflow-hidden tilt-card">
                <div className="scanline" />
                <p className="text-sm uppercase tracking-[0.2em] text-white/50">
                  {t("analyze.alerts")}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-white/70">
                  {(selectedUser.alerts || []).length === 0 && (
                    <li className="text-white/40">{t("analyze.noAlerts")}</li>
                  )}
                  {(selectedUser.alerts || []).slice(0, 4).map((alert) => (
                    <li key={alert}>{alert}</li>
                  ))}
                </ul>
              </div>
              <div className="glass-card p-4 relative overflow-hidden tilt-card">
                <div className="scanline" />
                <p className="text-sm uppercase tracking-[0.2em] text-white/50">
                  {t("personal.title")}
                </p>
                <div className="mt-3 space-y-2 text-sm text-white/70">
                  <p>
                    {t("personal.outlook")}:{" "}
                    <span className="text-white">
                      {t(
                        `personal.outlookMap.${
                          selectedUser.personalized_report?.risk_outlook || ""
                        }`
                      ) || "—"}
                    </span>
                  </p>
                  <p>
                    {t("personal.prediction")}:{" "}
                    <span className="text-white">
                      {t(
                        `personal.predictionMap.${
                          selectedUser.personalized_report?.prediction || ""
                        }`
                      ) || "—"}
                    </span>
                  </p>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-white/70">
                  {(selectedUser.personalized_report?.recommendations || []).length ===
                    0 && <li className="text-white/40">{t("personal.none")}</li>}
                  {(selectedUser.personalized_report?.recommendations || [])
                    .slice(0, 4)
                    .map((rec) => (
                      <li key={rec}>{t(`personal.rec.${rec}`) || rec}</li>
                    ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>

      {loading && (
        <section className="mt-10">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="mt-6">
            <SkeletonList rows={4} />
          </div>
        </section>
      )}

      {results.length > 0 && (
        <>
          <section className="mt-10">
            <p className="mb-2 text-xs uppercase tracking-[0.25em] text-white/50">
              {lang === "fa"
                ? "آمار دیتاست آپلودشده"
                : lang === "ar"
                ? "إحصائيات مجموعة البيانات المرفوعة"
                : "Uploaded dataset statistics"}
            </p>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <div className="stat-card">
                <p>{t("analyze.total")}</p>
                <h4>{stats.total || 0}</h4>
              </div>
              <div className="stat-card stat-card--accent">
                <p>{t("analyze.fakeDetected")}</p>
                <h4>{stats.fake || 0}</h4>
              </div>
              <div className="stat-card stat-card--warning">
                <p>{t("analyze.botRings")}</p>
                <h4>{stats.bot_ring_count || 0}</h4>
              </div>
              <div className="stat-card">
                <p>{t("analyze.avgFake")}</p>
                <h4>{toFixed((stats.avg_fake_probability || 0) * 100, 1)}%</h4>
              </div>
            </div>
            <div className="mt-4">
              <p className="mb-1 text-xs uppercase tracking-[0.25em] text-white/40">
                {t("analyze.riskStripTitle")}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                {(() => {
                  const total = stats.total || 1;
                  const low = (stats.risk_levels?.low || 0) / total;
                  const medium = (stats.risk_levels?.medium || 0) / total;
                  const high = (stats.risk_levels?.high || 0) / total;
                  return (
                    <div className="flex h-2 w-full">
                      <div
                        className="h-2 bg-emerald-400"
                        style={{ width: `${low * 100}%` }}
                      />
                      <div
                        className="h-2 bg-amber-300"
                        style={{ width: `${medium * 100}%` }}
                      />
                      <div
                        className="h-2 bg-rose-500"
                        style={{ width: `${high * 100}%` }}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-outline inline-flex items-center gap-2 text-sm"
                onClick={() => downloadCsv(results, (analysisMeta?.fileName || "report").replace(/\.[^.]+$/, "") + "-export.csv")}
              >
                <i className="fa-solid fa-file-csv" aria-hidden />
                Download CSV
              </button>
              <button
                type="button"
                className="btn-outline inline-flex items-center gap-2 text-sm"
                onClick={() => downloadSummaryTxt(stats, results, analysisMeta)}
              >
                <i className="fa-solid fa-file-lines" aria-hidden />
                Download summary
              </button>
            </div>
          </section>

          {compareItems.length === 2 && (
            <section className="mt-10 glass-card p-6 tilt-card">
              <h3 className="text-xl font-semibold text-white mb-4">Compare accounts</h3>
              <div className="grid gap-6 md:grid-cols-2">
                {compareItems.map((item) => {
                  const id = item.user_id || item.username || "Unknown";
                  return (
                    <div key={id} className="rounded-2xl border border-white/20 bg-white/5 p-4">
                      <h4 className="font-semibold text-white">{id}</h4>
                      <p className="text-sm text-white/60 mt-2">Fake prob: {toFixed((item.fake_probability || 0) * 100, 1)}% · Trust: {toFixed(item.trust_score || 0, 0)}</p>
                      <p className="text-xs text-white/50 mt-1">{item.risk_level}</p>
                      <button type="button" className="mt-2 text-xs text-cyan-400 hover:text-cyan-300" onClick={() => setCompareIds((p) => p.filter((x) => x !== id))}>Remove from compare</button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="glass-card p-6 tilt-card">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xl font-semibold text-white">
              {t("analyze.results")}
            </h3>
            <input
              type="search"
              placeholder="Search by username..."
              className="input-field max-w-[200px] text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search results by username"
            />
            <span className="badge badge-outline">
              {analysisMeta?.analyzedAt || t("analyze.awaiting")}
            </span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {filteredResults.slice(0, 20).map((item) => {
              const id = item.user_id || item.username || "Unknown";
              const isCritical =
                (item.fake_probability || 0) > 0.9 && item.bot_ring_warning;
              const isWhitelisted = whitelist.includes(id);
              const isManualFake = manualFake.includes(id);
              return (
                <div
                  key={id}
                  className={`result-card ${
                    isCritical ? "result-card--critical" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-white">
                        {id}
                      </h4>
                      <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                        {isWhitelisted && (
                          <span className="badge badge-outline">
                            Whitelisted
                          </span>
                        )}
                        {isManualFake && (
                          <span className="badge badge-danger">
                            Flagged
                          </span>
                        )}
                        {isCritical && (
                          <span className="badge badge-danger">
                            {t("analyze.criticalBadge")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        className="h-6 w-6 rounded-full border border-white/20 text-xs text-white/60 hover:border-white hover:text-white"
                        onClick={() =>
                          setOpenMenuId((prev) => (prev === id ? null : id))
                        }
                      >
                        ⋮
                      </button>
                      {openMenuId === id && (
                        <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-white/10 bg-n-8/95 p-2 text-xs text-white/80 shadow-lg">
                          <p className="mb-1 px-1 text-[10px] uppercase tracking-[0.16em] text-white/50">
                            {t("analyze.cardMenuTitle")}
                          </p>
                          <button
                            type="button"
                            className="block w-full rounded-lg px-2 py-1 text-left hover:bg-white/10"
                            onClick={() => {
                              setWhitelist((prev) =>
                                prev.includes(id) ? prev : [...prev, id]
                              );
                              setOpenMenuId(null);
                            }}
                          >
                            {t("analyze.cardAddWhitelist")}
                          </button>
                          <button
                            type="button"
                            className="mt-1 block w-full rounded-lg px-2 py-1 text-left hover:bg-white/10"
                            onClick={() => {
                              setManualFake((prev) =>
                                prev.includes(id) ? prev : [...prev, id]
                              );
                              setOpenMenuId(null);
                            }}
                          >
                            {t("analyze.cardMarkFake")}
                          </button>
                          <button
                            type="button"
                            className="mt-1 block w-full rounded-lg px-2 py-1 text-left hover:bg-white/10"
                            onClick={() => toggleCompare(id)}
                          >
                            {compareIds.includes(id) ? "Remove from compare" : "Add to compare"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-white/50">
                    {t("analyze.prob")}:{" "}
                    {toFixed((item.fake_probability || 0) * 100, 1)}%
                  </p>
                  <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-purple-500 via-cyan-400 to-fuchsia-500"
                      style={{ width: `${(item.fake_probability || 0) * 100}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-white/50">
                    {t("analyze.trust")}{" "}
                    {toFixed(item.trust_score || 0, 0)} / 100
                  </p>
                  {item.alert_score > 0 && (
                    <p className="mt-2 text-xs text-amber-200">
                      {t("analyze.alerts")}: {item.alert_score}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                      onClick={() => submitFeedback(id, true)}
                      disabled={feedbackSending === id}
                      aria-label="Mark as correct"
                    >
                      Correct
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-rose-500/20 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
                      onClick={() => submitFeedback(id, false)}
                      disabled={feedbackSending === id}
                      aria-label="Mark as wrong"
                    >
                      Wrong
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredResults.length === 0 && (
              <p className="text-sm text-white/50">{t("analyze.noData")}</p>
            )}
          </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 tilt-card">
                <h3 className="text-xl font-semibold text-white">
                  {t("analyze.breakdown")}
                </h3>
                <div className="mt-4 space-y-3">
                  {["low", "medium", "high"].map((level) => {
                    const count = stats?.risk_levels?.[level] || 0;
                    const total = stats.total || 1;
                    return (
                      <div key={level}>
                        <div className="flex items-center justify-between text-sm text-white/70">
                          <span>{level.toUpperCase()}</span>
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
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                  {stats.bot_ring_count > 0
                    ? `${stats.bot_ring_count} suspicious rings detected.`
                    : "No bot rings detected yet."}
                </div>
              </div>

              <div className="glass-card p-6 tilt-card">
                <h3 className="text-xl font-semibold text-white">
                  {lang === "fa" ? "تاریخچه تحلیل" : "Analysis history"}
                </h3>
                <div className="mt-4 space-y-3 text-sm text-white/70">
                  {history.length === 0 && analysisHistory.length === 0 && <p>{lang === "fa" ? "هنوز جستجویی انجام نشده." : "No history yet."}</p>}
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
                    >
                      <div>
                        <p className="font-medium text-white">{item.user}</p>
                        <p className="text-xs text-white/50">{item.time}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white/60">
                          {toFixed(item.prob * 100, 1)}%
                        </p>
                        <span className={item.fake ? "badge badge-danger" : "badge badge-outline"}>
                          {item.fake ? t("analyze.fake") : t("analyze.real")}
                        </span>
                      </div>
                    </div>
                  ))}
                  {analysisHistory.filter((h) => h.type === "lookup").slice(0, 5).map((item, i) => (
                    <button
                      key={"ah-" + i}
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                      onClick={() => setUsername(item.name)}
                    >
                      <div>
                        <p className="font-medium text-white">{item.name}</p>
                        <p className="text-xs text-white/50">{item.at ? new Date(item.at).toLocaleString() : ""}</p>
                      </div>
                      <span className="text-xs text-white/50">{item.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="mt-10">
        <ReportPanel report={report} />
      </section>

      {loading && (
        <div className="loading-overlay">
          <img src={loading1} alt="" className="h-14 w-14 animate-spin opacity-90" />
          <p className="mt-3 text-sm text-white/70">{t("analyze.loading")}</p>
        </div>
      )}
      {apiOnline === false && !error && (
        <p className="mt-6 text-sm text-amber-300">
          {t("analyze.apiDown")}
        </p>
      )}
      {!analysisMeta?.fileName && error && (
        <p className="mt-6 text-sm text-red-400">{error}</p>
      )}
      {errorHints?.length > 0 && (
        <div className="mt-3 text-sm text-white/60">
          <span className="text-white/80">Try:</span>{" "}
          {errorHints.map((hint) => (
            <button
              key={hint}
              className="ml-2 text-cyan-300 hover:text-cyan-100"
              onClick={() => setUsername(hint)}
            >
              {hint}
            </button>
          ))}
        </div>
      )}
    </main>
  );
};

export default Analyze;
