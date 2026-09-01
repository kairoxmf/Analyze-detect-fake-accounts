import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n";

const ResetPassword = ({ apiBase }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!token) {
      setError(t("auth.invalidResetLink"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("auth.resetFailed"));
      setMessage(t("auth.resetSuccess"));
      setTimeout(() => navigate("/user/auth"), 1200);
    } catch (err) {
      setError(err?.message || t("auth.resetFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container pb-16 pt-10">
      <section className="mx-auto max-w-xl glass-card p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-white/45">{t("auth.resetTag")}</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">{t("auth.resetTitle")}</h2>
        <p className="mt-2 text-sm text-white/70">{t("auth.resetSubtitle")}</p>
        <form className="mt-5 space-y-3" onSubmit={submit}>
          <input
            className="input-field"
            type="password"
            placeholder={t("auth.newPassword")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <input
            className="input-field"
            type="password"
            placeholder={t("auth.confirmPassword")}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? t("auth.loading") : t("auth.resetBtn")}
          </button>
        </form>
        {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <Link to="/user/auth" className="mt-4 inline-block text-xs text-white/60 hover:text-cyan-300">
          {t("auth.backToLogin")}
        </Link>
      </section>
    </main>
  );
};

export default ResetPassword;
