import { useState, useEffect } from "react";
import { useI18n } from "../i18n.jsx";

const STORAGE_KEY = "sentinel_tour_done";

const steps = [
  { id: "upload", target: "[data-tour='upload']", titleKey: "tour.uploadTitle", bodyKey: "tour.uploadBody" },
  { id: "demo", target: "[data-tour='demo']", titleKey: "tour.demoTitle", bodyKey: "tour.demoBody" },
  { id: "dashboard", target: "[data-tour='dashboard']", titleKey: "tour.dashboardTitle", bodyKey: "tour.dashboardBody" },
];

const defaults = {
  uploadTitle: "Upload CSV",
  uploadBody: "Drop a CSV file here or click to select. We analyze accounts for fake probability.",
  demoTitle: "Load Demo",
  demoBody: "Try with sample data without uploading your own file.",
  dashboardTitle: "Dashboard",
  dashboardBody: "View stats and filter results after analysis.",
  gotIt: "Got it",
  next: "Next",
  skip: "Skip",
};

export function FirstTimeTour() {
  const { t } = useI18n();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [position, setPosition] = useState(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
      const timer = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(timer);
    } catch {
      setActive(false);
    }
  }, []);

  useEffect(() => {
    if (!active || step >= steps.length) return;
    const selector = steps[step].target;
    const el = document.querySelector(selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPosition({ top: rect.top + rect.height + 8, left: rect.left, width: Math.max(rect.width, 280) });
    } else {
      setPosition({ top: 120, left: 24, width: 320 });
    }
  }, [active, step]);

  const handleNext = () => {
    if (step >= steps.length - 1) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {}
      setActive(false);
      return;
    }
    setStep((s) => s + 1);
  };

  const handleSkip = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setActive(false);
  };

  const s = steps[step];
  const titleKey = s?.titleKey?.replace("tour.", "");
  const bodyKey = s?.bodyKey?.replace("tour.", "");
  const title = s ? (t(s.titleKey) !== s.titleKey ? t(s.titleKey) : (defaults[titleKey] || "")) : "";
  const body = s ? (t(s.bodyKey) !== s.bodyKey ? t(s.bodyKey) : (defaults[bodyKey] || "")) : "";

  if (!active || !position) return null;

  return (
    <div
      className="fixed z-[90] rounded-2xl border border-white/20 bg-n-8/98 px-5 py-4 shadow-xl backdrop-blur-xl"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-white/70">{body}</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs text-white/50">
          {step + 1} / {steps.length}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10"
          >
            {t("tour.skip") !== "tour.skip" ? t("tour.skip") : defaults.skip}
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white"
          >
            {step >= steps.length - 1
              ?               (t("tour.gotIt") !== "tour.gotIt" ? t("tour.gotIt") : defaults.gotIt)
              : (t("tour.next") !== "tour.next" ? t("tour.next") : defaults.next)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FirstTimeTour;
