import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";

const UserAuth = ({ apiBase, onAuthSuccess }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordStrength = useMemo(() => {
    const p = String(password || "");
    let score = 0;
    if (p.length >= 6) score += 1;
    if (p.length >= 10) score += 1;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score += 1;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score += 1;
    if (score <= 1) return { label: t("auth.weak"), width: "25%", color: "bg-rose-400" };
    if (score <= 3) return { label: t("auth.medium"), width: "60%", color: "bg-amber-300" };
    return { label: t("auth.strong"), width: "100%", color: "bg-emerald-400" };
  }, [password, t]);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          ...(mode === "register" ? { email } : {}),
          password,
          ...(mode === "register" ? { display_name: displayName } : {}),
          ...(mode === "register" && referralCode ? { referral_code: referralCode } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("auth.failed"));
      onAuthSuccess?.(payload?.token || "", payload?.user || null);
      navigate("/user/panel");
    } catch (err) {
      const msg = String(err?.message || "").toLowerCase();
      const isNetworkError = !msg || msg.includes("fetch") || msg.includes("network") || msg.includes("failed to fetch");
      setError(isNetworkError ? t("analyze.apiDown") : (err?.message || t("auth.failed")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container pb-16 pt-10">
      <section className="group relative mx-auto max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-n-8/90 p-6 shadow-[0_14px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -left-20 top-12 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl transition-transform duration-700 group-hover:scale-125" />
        <div className="pointer-events-none absolute -right-20 bottom-10 h-44 w-44 rounded-full bg-fuchsia-500/20 blur-3xl transition-transform duration-700 group-hover:scale-125" />

        <p className="text-xs uppercase tracking-[0.35em] text-white/45">{t("auth.tag")}</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">
          {mode === "register" ? t("auth.registerTitle") : t("auth.loginTitle")}
        </h2>
        <p className="mt-2 text-sm text-white/70">
          {t("auth.subtitle")}
        </p>

        <div className="mt-5 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              mode === "login"
                ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_8px_20px_rgba(34,211,238,0.3)]"
                : "text-white/70 hover:text-white"
            }`}
            onClick={() => setMode("login")}
          >
            <i className="fa-solid fa-right-to-bracket mr-1.5" />
            {t("auth.loginTab")}
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              mode === "register"
                ? "bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white shadow-[0_8px_20px_rgba(217,70,239,0.25)]"
                : "text-white/70 hover:text-white"
            }`}
            onClick={() => setMode("register")}
          >
            <i className="fa-solid fa-user-plus mr-1.5" />
            {t("auth.registerTab")}
          </button>
        </div>

        <form className="mt-5 space-y-3" onSubmit={submit}>
          {mode === "register" && (
            <>
              <input
                className="input-field"
                placeholder={t("auth.displayName")}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
              <input
                className="input-field"
                type="email"
                placeholder={t("auth.email")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <input
                className="input-field"
                placeholder={t("auth.referralCode")}
                value={referralCode}
                onChange={(event) => setReferralCode(event.target.value)}
              />
            </>
          )}
          <input
            className="input-field"
            placeholder={t("auth.username")}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <div className="relative">
            <input
              className="input-field w-full pr-10"
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.password")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
            </button>
          </div>
          {mode === "register" && password.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                  style={{ width: passwordStrength.width }}
                />
              </div>
              <p className="text-[11px] text-white/70">
                {t("auth.passwordStrength")}: {passwordStrength.label}
              </p>
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? t("auth.loading") : mode === "register" ? t("auth.registerBtn") : t("auth.loginBtn")}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <button
          type="button"
          className="mt-4 text-sm text-cyan-300 hover:text-cyan-200"
          onClick={() => setMode((prev) => (prev === "register" ? "login" : "register"))}
        >
          {mode === "register"
            ? t("auth.hasAccount")
            : t("auth.noAccount")}
        </button>
        {mode === "login" && (
          <div className="mt-2">
            <Link to="/user/forgot-password" className="text-xs text-white/60 hover:text-cyan-300">
              {t("auth.forgot")}
            </Link>
          </div>
        )}
      </section>
    </main>
  );
};

export default UserAuth;
