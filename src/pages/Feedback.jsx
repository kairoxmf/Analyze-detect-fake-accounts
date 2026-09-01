import { useState } from "react";
import { useI18n } from "../i18n.jsx";

const Feedback = ({ apiBase }) => {
  const { t } = useI18n();
  const base = apiBase || import.meta.env.VITE_API_URL || "/api";
  const token = localStorage.getItem("user_token");
  const [type, setType] = useState("suggestion");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!message.trim() || message.length < 5) {
      setError(t("feedback.errorShort") || "Message must be at least 5 characters.");
      return;
    }
    setLoading(true);
    try {
      const body = { type, message: message.trim(), email: email.trim() };
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`${base}/feedback/form`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setSent(true);
        setMessage("");
        setEmail("");
      } else {
        setError(data.error || "Failed to send.");
      }
    } catch {
      setError(t("feedback.errorNetwork") || "Network error.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <main className="container pb-16 pt-10 feedback-page">
        <div className="glass-card p-12 text-center">
          <i className="fa-solid fa-circle-check text-5xl text-emerald-400" />
          <h2 className="mt-4 text-xl font-semibold text-white">{t("feedback.thanks") || "Thank you!"}</h2>
          <p className="mt-2 text-white/60">{t("feedback.thanksMsg") || "Your feedback has been sent."}</p>
          <button
            type="button"
            className="btn-primary mt-6"
            onClick={() => setSent(false)}
          >
            {t("feedback.sendAnother") || "Send another"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="container pb-16 pt-10 feedback-page">
      <h1 className="text-2xl font-bold text-white md:text-3xl">
        {t("feedback.title") || "Feedback"}
      </h1>
      <p className="mt-2 text-white/60">
        {t("feedback.subtitle") || "Suggestions or bug reports? We'd love to hear from you."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 max-w-xl glass-card p-6 tilt-card">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60">{t("feedback.type") || "Type"}</label>
            <select
              className="input-field mt-2 w-full"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="suggestion">{t("feedback.suggestion") || "Suggestion"}</option>
              <option value="bug">{t("feedback.bug") || "Bug Report"}</option>
              <option value="other">{t("feedback.other") || "Other"}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/60">{t("feedback.message") || "Message"}</label>
            <textarea
              className="input-field mt-2 w-full min-h-[120px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("feedback.messagePlaceholder") || "Describe your feedback..."}
              required
            />
          </div>
          {!token && (
            <div>
              <label className="block text-sm font-medium text-white/60">{t("feedback.email") || "Email (optional)"}</label>
              <input
                type="email"
                className="input-field mt-2 w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          )}
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-paper-plane" />}
            <span className="ml-2">{t("feedback.send") || "Send"}</span>
          </button>
        </div>
      </form>
    </main>
  );
};

export default Feedback;
