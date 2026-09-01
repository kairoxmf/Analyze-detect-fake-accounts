import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

const ForgotPassword = ({ apiBase }) => {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetLink, setResetLink] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    setResetLink("");
    try {
      const response = await fetch(`${apiBase}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("auth.forgotFailed"));
      setMessage(payload?.message || t("auth.forgotSent"));
      setResetLink(String(payload?.reset_link || ""));
    } catch (err) {
      setError(err?.message || t("auth.forgotFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container pb-16 pt-10">
      <section className="mx-auto max-w-xl glass-card p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-white/45">{t("auth.resetTag")}</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">{t("auth.forgotTitle")}</h2>
        <p className="mt-2 text-sm text-white/70">{t("auth.forgotSubtitle")}</p>
        <form className="mt-5 space-y-3" onSubmit={submit}>
          <input
            className="input-field"
            type="email"
            placeholder={t("auth.email")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? t("auth.loading") : t("auth.sendReset")}
          </button>
        </form>
        {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
        {resetLink && (
          <div className="mt-3 rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-3 text-xs text-cyan-200">
            <p className="mb-2">{t("auth.devResetLink")}</p>
            <a className="break-all underline hover:text-cyan-100" href={resetLink}>
              {resetLink}
            </a>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <Link to="/user/auth" className="mt-4 inline-block text-xs text-white/60 hover:text-cyan-300">
          {t("auth.backToLogin")}
        </Link>
      </section>
    </main>
  );
};

export default ForgotPassword;
