import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n.jsx";

const COOLDOWN_HOURS = 6;

const SecurityTips = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const tips = useMemo(() => t("tips.list"), [t]);
  const tip = useMemo(() => {
    if (!Array.isArray(tips) || tips.length === 0) return "";
    const index = Math.floor(Math.random() * tips.length);
    return tips[index];
  }, [tips]);

  useEffect(() => {
    const last = Number(localStorage.getItem("tip_dismissed_at") || 0);
    const hours = (Date.now() - last) / (1000 * 60 * 60);
    if (hours >= COOLDOWN_HOURS) {
      setOpen(true);
    }
  }, []);

  const dismiss = (hours) => {
    localStorage.setItem("tip_dismissed_at", String(Date.now() + hours * 3600000));
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="security-overlay">
      <div className="security-modal tilt-card">
        <div className="scanline" />
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">
          {t("tips.tag")}
        </p>
        <h3 className="mt-2 text-2xl font-semibold text-white neon-title">
          {t("tips.title")}
        </h3>
        <p className="mt-3 text-sm text-white/70">{tip}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={() => dismiss(12)}>
            {t("tips.gotIt")}
          </button>
          <button className="btn-outline" onClick={() => dismiss(2)}>
            {t("tips.remind")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecurityTips;
