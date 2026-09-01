import { useState } from "react";
import { useI18n } from "../i18n.jsx";

const Compare = ({ apiBase }) => {
  const { t } = useI18n();
  const base = apiBase || import.meta.env.VITE_API_URL || "/api";
  const [user1, setUser1] = useState("");
  const [user2, setUser2] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  const analyze = async (username) => {
    const r = await fetch(`${base}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.replace(/^@/, "").trim() }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || "Analysis failed");
    }
    return r.json();
  };

  const handleCompare = async (e) => {
    e.preventDefault();
    const u1 = user1.replace(/^@/, "").trim();
    const u2 = user2.replace(/^@/, "").trim();
    if (!u1 || !u2) {
      setError(t("compare.enterBoth") || "Enter both usernames.");
      return;
    }
    if (u1 === u2) {
      setError(t("compare.sameUser") || "Enter two different usernames.");
      return;
    }
    setError("");
    setLoading(true);
    setResults(null);
    try {
      const [r1, r2] = await Promise.all([
        analyze(u1).then((d) => d.result || d),
        analyze(u2).then((d) => d.result || d),
      ]);
      setResults({ user1: r1, user2: r2, username1: u1, username2: u2 });
    } catch (err) {
      setError(err.message || "Failed to analyze.");
    } finally {
      setLoading(false);
    }
  };

  const ScoreCard = ({ label, data }) => {
    if (!data) return null;
    const prob = (data.fake_probability ?? 0) * 100;
    const trust = data.trust_score ?? (100 - prob);
    return (
      <div className="glass-card p-6 tilt-card">
        <p className="text-sm uppercase tracking-widest text-white/50">{label}</p>
        <p className="mt-2 text-xl font-bold text-white">@{data.username || data.user_id || "—"}</p>
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs text-white/50">{t("compare.fakeProb") || "Fake Probability"}</p>
            <p className={`text-2xl font-bold ${prob > 50 ? "text-rose-400" : "text-emerald-400"}`}>{prob.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-white/50">{t("compare.trustScore") || "Trust Score"}</p>
            <p className="text-2xl font-bold text-cyan-400">{trust.toFixed(0)}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="container pb-16 pt-10 compare-page">
      <h1 className="text-2xl font-bold text-white md:text-3xl">
        {t("compare.title") || "Compare Two Accounts"}
      </h1>
      <p className="mt-2 text-white/60">
        {t("compare.subtitle") || "Compare Instagram accounts side by side."}
      </p>

      <form onSubmit={handleCompare} className="mt-8 flex flex-wrap gap-4">
        <input
          type="text"
          className="input-field w-48"
          placeholder="@username1"
          value={user1}
          onChange={(e) => setUser1(e.target.value)}
        />
        <input
          type="text"
          className="input-field w-48"
          placeholder="@username2"
          value={user2}
          onChange={(e) => setUser2(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-code-compare" />}
          <span className="ml-2">{t("compare.compare") || "Compare"}</span>
        </button>
      </form>
      {error && <p className="mt-4 text-rose-400">{error}</p>}

      {results && (
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <ScoreCard label={results.username1} data={results.user1} />
          <ScoreCard label={results.username2} data={results.user2} />
        </section>
      )}
    </main>
  );
};

export default Compare;
