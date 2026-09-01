import { useEffect, useState } from "react";
import { useI18n } from "../i18n.jsx";
import { gradient, smallSphere, grid, instagram as instagramIcon, loading1 } from "../assets";

const toFixed = (value, digits = 2) =>
  Number.isFinite(value) ? value.toFixed(digits) : "0.00";

const toDisplayNumber = (value, digits = 0) => {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const toUsernameString = (value, fallback = "") => {
  if (value == null) return String(fallback);
  if (typeof value === "string") {
    const s = value.trim();
    if (!s || s === "[object Object]") return String(fallback);
    return s;
  }
  if (typeof value === "object" && value !== null) {
    const s = value.username ?? value.user_id ?? value.pk;
    return toUsernameString(s, fallback);
  }
  return String(value);
};

const normalizeLookupResult = (payload, fallbackUsername = "") => {
  const top = payload?.result !== undefined ? payload.result : payload;
  const raw =
    top && typeof top === "object" && top.result && typeof top.result === "object"
      ? top.result
      : top;
  if (!raw || typeof raw !== "object") return null;
  const normalizedUsername = toUsernameString(
    raw.username ?? raw.user_id,
    fallbackUsername
  );
  return {
    ...raw,
    username: normalizedUsername,
    user_id: toUsernameString(raw.user_id, normalizedUsername),
  };
};

const Instagram = () => {
  const { t, lang } = useI18n();
  const isRTL = lang === "fa" || lang === "ar";
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [compareResultA, setCompareResultA] = useState(null);
  const [compareResultB, setCompareResultB] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [batchResults, setBatchResults] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState("");

  const apiRoot =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? "/api" : "http://localhost:5000");

  const runLookup = async (name) => {
    if (!name) return null;
    const cleanName = toUsernameString(name).replace(/^@+/, "");
    const response = await fetch(`${apiRoot}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cleanName }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || "User analysis failed.");
    }
    return normalizeLookupResult(payload, cleanName);
  };

  const sendFeedback = async (label) => {
    if (!result) return;
    const feedbackUsername = toUsernameString(
      result.username ?? result.user_id
    ).replace(/^@+/, "");
    if (!feedbackUsername) return;
    try {
      await fetch(`${apiRoot}/instagram/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: feedbackUsername, label }),
      });
      setFeedbackStatus("sent");
    } catch {
      setFeedbackStatus("");
    }
  };

  const handleLookup = async (overrideUsername) => {
    const override =
      typeof overrideUsername === "string" || typeof overrideUsername === "number"
        ? String(overrideUsername).trim()
        : "";
    const toLookup = override || username.trim();
    if (!toLookup) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const user = await runLookup(toLookup);
      setResult(user);
      if (user) {
        const id = toUsernameString(user.username ?? user.user_id, toLookup);
        setHistory((prev) => {
          const next = [
            {
              id: `${id}-${Date.now()}`,
              user: id,
              fake: user.is_fake,
              prob: user.fake_probability || 0,
              time: new Date().toLocaleTimeString(),
            },
            ...prev.map((item) => ({
              ...item,
              user: toUsernameString(item.user, "unknown"),
            })),
          ].slice(0, 15);
          try {
            localStorage.setItem("instagram_history", JSON.stringify(next));
          } catch {
          }
          return next;
        });
      }
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? t("analyze.apiDown")
          : err.message || "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
    if (overrideUsername === undefined) setUsername("");
  };

  const handleCompare = async () => {
    const a = compareA.trim();
    const b = compareB.trim();
    if (!a || !b) return;
    setCompareLoading(true);
    setError("");
    try {
      const [resA, resB] = await Promise.all([runLookup(a), runLookup(b)]);
      setCompareResultA(resA);
      setCompareResultB(resB);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? t("analyze.apiDown")
          : err.message || "Something went wrong."
      );
    } finally {
      setCompareLoading(false);
    }
    setCompareA("");
    setCompareB("");
  };

  const handleBatchAnalyze = async () => {
    const raw = batchInput.trim();
    if (!raw) return;
    setBatchLoading(true);
    setBatchError("");
    setBatchResults([]);
    try {
      const response = await fetch(`${apiRoot}/instagram/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: raw }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Batch analysis failed.");
      }
      setBatchResults(payload.results || []);
    } catch (err) {
      setBatchError(
        err.message === "Failed to fetch"
          ? t("analyze.apiDown")
          : err.message || "Something went wrong."
      );
    } finally {
      setBatchLoading(false);
    }
  };

  useEffect(() => {
    setError("");
  }, [username]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("instagram_history");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setHistory(
            parsed.map((item) => ({
              ...item,
              user: toUsernameString(item.user, "unknown"),
            }))
          );
        }
      }
    } catch {
    }
  }, []);

  const trustScore = result ? result.trust_score || 0 : 0;
  let trustLabel = "";
  let trustClass = "badge-outline";
  if (trustScore >= 70) {
    trustLabel = t("instagramPage.trustSafe");
    trustClass = "badge";
  } else if (trustScore < 40) {
    trustLabel = t("instagramPage.trustHighRisk");
    trustClass = "badge-danger";
  } else if (trustScore > 0) {
    trustLabel = t("instagramPage.trustWarning");
    trustClass = "badge-warning";
  }

  const riskReasons = [];
  if (result) {
    const ratio = Number(result.follower_following_ratio || 0);
    const postRate = Number(result.post_rate_per_day || 0);
    const hasPic = Number(result.has_profile_pic || 0);
    const suspicious = Number(result.suspicious_keyword_score || 0);
    if (ratio && ratio < 0.3) {
      riskReasons.push(t("instagramPage.reasonLowRatio"));
    }
    if (postRate && postRate > 5) {
      riskReasons.push(t("instagramPage.reasonHighPost"));
    }
    if (!hasPic) {
      riskReasons.push(t("instagramPage.reasonNoPic"));
    }
    if (suspicious > 0) {
      riskReasons.push(t("instagramPage.reasonKeywords"));
    }
  }

  const accountStats = result
    ? [
        {
          label: t("instagramPage.statFollowers"),
          value: toDisplayNumber(result.followers),
        },
        {
          label: t("instagramPage.statFollowing"),
          value: toDisplayNumber(result.following),
        },
        {
          label: t("instagramPage.statPosts"),
          value: toDisplayNumber(result.posts),
        },
        {
          label: t("instagramPage.statCreatedYear"),
          value: toDisplayNumber(result.account_created_year),
        },
        {
          label: t("instagramPage.statAccountAgeDays"),
          value: toDisplayNumber(result.account_age_days),
        },
        {
          label: t("instagramPage.statAvgLikes"),
          value: toDisplayNumber(result.avg_likes_recent, 1),
        },
        {
          label: t("instagramPage.statAvgComments"),
          value: toDisplayNumber(result.avg_comments_recent, 1),
        },
        {
          label: t("instagramPage.statEngagement"),
          value: Number.isFinite(Number(result.engagement_rate_estimate))
            ? `${toDisplayNumber(Number(result.engagement_rate_estimate) * 100, 2)}%`
            : "-",
        },
        {
          label: t("instagramPage.statProfilePic"),
          value:
            result.has_profile_pic === null || result.has_profile_pic === undefined
              ? "-"
              : Number(result.has_profile_pic) > 0
              ? t("instagramPage.yes")
              : t("instagramPage.no"),
        },
        {
          label: t("instagramPage.statPrivate"),
          value:
            result.is_private === null || result.is_private === undefined
              ? "-"
              : result.is_private
              ? t("instagramPage.yes")
              : t("instagramPage.no"),
        },
        {
          label: t("instagramPage.statVerified"),
          value:
            result.is_verified === null || result.is_verified === undefined
              ? "-"
              : result.is_verified
              ? t("instagramPage.yes")
              : t("instagramPage.no"),
        },
      ]
    : [];

  return (
    <main
      className={`container pb-16 pt-10 instagram-page ${
        isRTL ? "text-right" : ""
      }`}
    >
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-card p-8 md:p-10 tilt-card relative overflow-hidden instagram-hero">
          <div className="scanline" />
          <img
            src={grid}
            alt=""
            className="pointer-events-none absolute inset-0 opacity-20 mix-blend-soft-light"
          />
          <img
            src={gradient}
            alt=""
            className="pointer-events-none absolute -right-32 -top-32 w-72 opacity-70"
          />
          <img
            src={smallSphere}
            alt=""
            className="pointer-events-none absolute -left-10 bottom-6 w-20 animate-pulse"
          />
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            {t("instagramPage.tag")}
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white neon-title instagram-hero-title">
            {t("instagramPage.title")}
          </h2>
          <p className="mt-3 text-sm text-white/60 instagram-hero-subtitle">
            {t("instagramPage.subtitle")}
          </p>
          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60">
                <img src={instagramIcon} alt="" className="h-5 w-5" />
              </span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="input-field pl-10"
                placeholder={t("instagramPage.inputPlaceholder")}
              />
            </div>
            <button
              className="btn-primary min-w-[150px] flex items-center justify-center gap-2"
              onClick={() => handleLookup()}
              disabled={loading}
            >
              {loading && (
                <img src={loading1} alt="" className="h-5 w-5 animate-spin opacity-90" />
              )}
              {loading
                ? t("analyze.loading")
                : t("instagramPage.analyzeBtn")}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-xs text-red-400">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/70">
            <span className="opacity-60">
              {t("instagramPage.samplesLabel")}:
            </span>
            {["real_maryam", "free_followers_24", "crypto_signal_ir"].map(
              (sample) => (
                <button
                  key={sample}
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 transition-colors hover:border-white hover:bg-white/10 instagram-sample-chip"
                  onClick={() => handleLookup(`@${sample}`)}
                >
                  @{sample}
                </button>
              )
            )}
          </div>
        </div>

        <div className="glass-card p-6 md:p-8 tilt-card relative overflow-hidden">
          <div className="scanline" />
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            {t("instagramPage.lastResult")}
          </p>
          {!result && (
            <p className="mt-4 text-sm text-white/50">
              {t("instagramPage.noResult")}
            </p>
          )}
          {result && (
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">
                  {toUsernameString(result.username ?? result.user_id, "Unknown")}
                </h3>
                <span
                  className={`badge ${
                    result.is_fake ? "badge-danger" : "badge-outline"
                  }`}
                >
                  {result.is_fake ? t("analyze.fake") : t("analyze.real")}
                </span>
              </div>
              {result.live_profile_data === false && (
                <p className="text-[11px] text-amber-300">
                  {result.live_profile_message || t("instagramPage.liveDataUnavailable")}
                </p>
              )}
              {result.full_name && (
                <p className="text-xs text-white/60">
                  {result.full_name}
                </p>
              )}
              <div className="meter" style={{ "--value": trustScore / 100 }}>
                <div className="meter-inner">
                  <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                    {t("analyze.trust")}
                  </span>
                  <span className="text-3xl font-semibold text-white">
                    {toFixed(trustScore, 0)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {trustLabel && (
                  <span className={`badge ${trustClass}`}>
                    {trustLabel}
                  </span>
                )}
                <span
                  className={`badge ${
                    result.risk_level === "HIGH"
                      ? "badge-danger"
                      : result.risk_level === "MEDIUM"
                      ? "badge-warning"
                      : "badge-outline"
                  }`}
                >
                  {t("instagramPage.riskLevelLabel")}:{" "}
                  {result.risk_level || "LOW"}
                </span>
                <span className="badge badge-outline">
                  {t("instagramPage.fakeScoreLabel")}:{" "}
                  {toFixed((result.fake_probability || 0) * 100, 1)}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {accountStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/15 bg-white/5 px-3 py-2"
                  >
                    <p className="text-[11px] text-white/50">{item.label}</p>
                    <p className="mt-1 text-sm font-medium text-white">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button
                  className="btn-outline px-3 py-1 text-[11px]"
                  onClick={() => sendFeedback("fake")}
                >
                  {t("instagramPage.feedbackFakeBtn")}
                </button>
                <button
                  className="btn-outline px-3 py-1 text-[11px]"
                  onClick={() => sendFeedback("real")}
                >
                  {t("instagramPage.feedbackRealBtn")}
                </button>
              </div>
              {feedbackStatus === "sent" && (
                <p className="mt-1 text-[11px] text-emerald-300">
                  {t("instagramPage.feedbackThanks")}
                </p>
              )}
              <button
                type="button"
                className="mt-2 inline-flex items-center rounded-full border border-white/30 px-3 py-1 text-[11px] text-white/80 hover:border-white hover:bg-white/10"
                onClick={async () => {
                  if (!result) return;
                  const lines = [];
                  const name = toUsernameString(
                    result.username ?? result.user_id,
                    "Unknown"
                  );
                  lines.push(`Account: ${name}`);
                  lines.push(
                    `Fake probability: ${toFixed(
                      (result.fake_probability || 0) * 100,
                      1
                    )}%`
                  );
                  lines.push(
                    `Trust score: ${toFixed(result.trust_score || 0, 0)} / 100`
                  );
                  lines.push(`Risk level: ${result.risk_level || "LOW"}`);
                  lines.push(`Followers: ${toDisplayNumber(result.followers)}`);
                  lines.push(`Following: ${toDisplayNumber(result.following)}`);
                  lines.push(`Posts: ${toDisplayNumber(result.posts)}`);
                  lines.push(
                    `Created year: ${toDisplayNumber(result.account_created_year)}`
                  );
                  lines.push(
                    `Avg likes: ${toDisplayNumber(result.avg_likes_recent, 1)}`
                  );
                  lines.push(
                    `Avg comments: ${toDisplayNumber(result.avg_comments_recent, 1)}`
                  );
                  if (riskReasons.length) {
                    lines.push("Reasons:");
                    riskReasons.slice(0, 4).forEach((r) => {
                      lines.push(`- ${r}`);
                    });
                  }
                  const text = lines.join("\n");
                  try {
                    await navigator.clipboard.writeText(text);
                    setFeedbackStatus("copied");
                  } catch {
                    setFeedbackStatus("copied");
                  }
                }}
              >
                {t("instagramPage.copyReport")}
              </button>
              {feedbackStatus === "copied" && (
                <p className="mt-1 text-[11px] text-emerald-300">
                  {t("instagramPage.copyReportDone")}
                </p>
              )}
              {riskReasons.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-white/70">
                  {riskReasons.slice(0, 4).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-white/60">
                {t("analyze.probSelected")}:{" "}
                <span className="text-white">
                  {toFixed((result.fake_probability || 0) * 100, 1)}%
                </span>
              </p>
              {typeof result.suspicious_keyword_score === "number" && (
                <p className="text-sm text-white/60">
                  {t("analyze.suspicious")}:{" "}
                  <span className="text-white">
                    {result.suspicious_keyword_score}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mt-10 glass-card p-6 md:p-8 tilt-card relative overflow-hidden">
        <div className="scanline" />
        <img
          src={grid}
          alt=""
          className="pointer-events-none absolute inset-0 opacity-10 mix-blend-soft-light"
        />
        <img
          src={smallSphere}
          alt=""
          className="pointer-events-none absolute -right-8 -top-6 w-16 opacity-80 animate-pulse"
        />
        <h3 className="text-xl font-semibold text-white">
          {t("instagramPage.historyTitle")}
        </h3>
        <div className="mt-4 space-y-3 text-sm text-white/70">
          {history.length === 0 && (
            <p>{t("instagramPage.historyEmpty")}</p>
          )}
          {history.map((item) => (
            <button
              key={item.id}
              type="button"
              className="history-item flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors"
              onClick={async () => {
                setError("");
                setLoading(true);
                try {
                  const user = await runLookup(toUsernameString(item.user));
                  setResult(user);
                  if (user) {
                    const updated = history.map((h) =>
                      h.id === item.id
                        ? {
                            ...h,
                            user: toUsernameString(h.user, "unknown"),
                            fake: user.is_fake,
                            prob: user.fake_probability || 0,
                            time: new Date().toLocaleTimeString(),
                          }
                        : { ...h, user: toUsernameString(h.user, "unknown") }
                    );
                    setHistory(updated);
                    try {
                      localStorage.setItem(
                        "instagram_history",
                        JSON.stringify(updated)
                      );
                    } catch {
                    }
                  }
                } catch (err) {
                  setError(
                    err.message === "Failed to fetch"
                      ? t("analyze.apiDown")
                      : err.message || "Something went wrong."
                  );
                } finally {
                  setLoading(false);
                }
              }}
            >
              <div>
                <p className="font-medium text-white">{toUsernameString(item.user)}</p>
                <p className="text-xs text-white/50">{item.time}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60">
                  {t("instagramPage.historyProb")}:{" "}
                  <span className="text-white">
                    {toFixed(item.prob * 100, 1)}%
                  </span>
                </p>
                <span
                  className={`badge ${
                    item.fake ? "badge-danger" : "badge-outline"
                  }`}
                >
                  {item.fake ? t("analyze.fake") : t("analyze.real")}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-card p-6 md:p-8 tilt-card relative overflow-hidden">
          <div className="scanline" />
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            {t("instagramPage.compareTitle")}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={compareA}
              onChange={(e) => setCompareA(e.target.value)}
              className="input-field"
              placeholder="@account_a"
            />
            <input
              value={compareB}
              onChange={(e) => setCompareB(e.target.value)}
              className="input-field"
              placeholder="@account_b"
            />
          </div>
          <button
            className="btn-outline mt-4"
            onClick={handleCompare}
            disabled={compareLoading}
          >
            {compareLoading
              ? t("analyze.loading")
              : t("instagramPage.compareBtn")}
          </button>
          {error && (
            <p className="mt-3 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="glass-card p-6 md:p-8 tilt-card relative overflow-hidden">
          <div className="scanline" />
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            {t("instagramPage.compareResultTitle")}
          </p>
          {!compareResultA && !compareResultB && (
            <p className="mt-4 text-sm text-white/50">
              {t("instagramPage.compareEmpty")}
            </p>
          )}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {compareResultA && (
              <div className="result-card">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">
                    {toUsernameString(
                      compareResultA.username ?? compareResultA.user_id,
                      "Unknown"
                    )}
                  </h4>
                  <span
                    className={`badge ${
                      compareResultA.is_fake ? "badge-danger" : "badge-outline"
                    }`}
                  >
                    {compareResultA.is_fake ? t("analyze.fake") : t("analyze.real")}
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/60">
                  {t("instagramPage.fakeScoreLabel")}:{" "}
                  {toFixed((compareResultA.fake_probability || 0) * 100, 1)}%
                </p>
                <p className="mt-1 text-xs text-white/60">
                  {t("analyze.trust")}:{" "}
                  {toFixed(compareResultA.trust_score || 0, 0)} / 100
                </p>
              </div>
            )}
            {compareResultB && (
              <div className="result-card">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">
                    {toUsernameString(
                      compareResultB.username ?? compareResultB.user_id,
                      "Unknown"
                    )}
                  </h4>
                  <span
                    className={`badge ${
                      compareResultB.is_fake ? "badge-danger" : "badge-outline"
                    }`}
                  >
                    {compareResultB.is_fake ? t("analyze.fake") : t("analyze.real")}
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/60">
                  {t("instagramPage.fakeScoreLabel")}:{" "}
                  {toFixed((compareResultB.fake_probability || 0) * 100, 1)}%
                </p>
                <p className="mt-1 text-xs text-white/60">
                  {t("analyze.trust")}:{" "}
                  {toFixed(compareResultB.trust_score || 0, 0)} / 100
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-card p-6 md:p-8 tilt-card relative overflow-hidden">
          <div className="scanline" />
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            {t("instagramPage.batchTitle")}
          </p>
          <textarea
            className="mt-4 h-32 w-full rounded-2xl border border-white/20 bg-n-7 p-3 text-xs text-white/80 outline-none transition-all duration-300 focus:border-white/60 focus:bg-n-6"
            placeholder={t("instagramPage.batchPlaceholder")}
            value={batchInput}
            onChange={(e) => setBatchInput(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary mt-4 min-w-[160px]"
            onClick={handleBatchAnalyze}
            disabled={batchLoading}
          >
            {batchLoading
              ? t("analyze.loading")
              : t("instagramPage.batchBtn")}
          </button>
          {batchError && (
            <p className="mt-3 text-xs text-red-400">
              {batchError}
            </p>
          )}
        </div>

        <div className="glass-card p-6 md:p-8 tilt-card relative overflow-hidden">
          <div className="scanline" />
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            {t("instagramPage.batchResultsTitle")}
          </p>
          <div className="mt-4 space-y-3 text-xs text-white/70">
            {batchResults.length === 0 && (
              <p>{t("instagramPage.historyEmpty")}</p>
            )}
            {batchResults.map((item) => (
              <div
                key={toUsernameString(item.username_input ?? item.username, "unknown")}
                className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-white">
                    {toUsernameString(item.username ?? item.username_input, "Unknown")}
                  </p>
                  {item.error && (
                    <p className="text-[11px] text-red-300">
                      {item.error}
                    </p>
                  )}
                </div>
                {!item.error && (
                  <div className="text-right">
                    <p>
                      {toFixed((item.fake_probability || 0) * 100, 1)}%
                    </p>
                    <span
                      className={`badge ${
                        item.is_fake ? "badge-danger" : "badge-outline"
                      }`}
                    >
                      {item.is_fake ? t("analyze.fake") : t("analyze.real")}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Instagram;

