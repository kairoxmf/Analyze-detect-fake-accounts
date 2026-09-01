import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n.jsx";

const Login = ({ onLogin, redirectTo = "/portal/admin" }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    const ok = await onLogin(token.trim());
    if (ok) {
      navigate(redirectTo);
    } else {
      setError("Invalid token.");
    }
  };

  return (
    <main className="container pb-16 pt-10 login-page">
      <section className="glass-card p-8 tilt-card relative overflow-hidden">
        <div className="scanline" />
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">
              {t("login.tag")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white neon-title">
              {t("login.title")}
            </h2>
            <p className="mt-4 text-sm text-white/60">{t("login.subtitle")}</p>
            <ul className="mt-6 space-y-3 text-sm text-white/60">
              <li>{t("login.point1")}</li>
              <li>{t("login.point2")}</li>
              <li>{t("login.point3")}</li>
            </ul>
          </div>
          <form className="glass-card p-6" onSubmit={handleSubmit}>
            <h3 className="text-xl font-semibold text-white">
              {t("login.formTitle")}
            </h3>
            <p className="mt-2 text-xs text-white/50">
              {t("login.formHint")}
            </p>
            <div className="mt-6 space-y-4">
              <input
                className="input-field"
                placeholder={t("login.tokenPlaceholder")}
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
              <button className="btn-primary w-full" type="submit">
                {t("login.submit")}
              </button>
            </div>
            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          </form>
        </div>
      </section>
    </main>
  );
};

export default Login;
