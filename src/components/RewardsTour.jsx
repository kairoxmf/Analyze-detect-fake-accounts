import { useState, useEffect } from "react";
import { useI18n } from "../i18n.jsx";

const STORAGE_KEY = "rewards_tour_done";

const steps = [
  { id: "submit", target: "[data-tour='rewards-submit']", titleKey: "rewardsPage.tourSubmit", bodyKey: "rewardsPage.tourSubmitBody" },
  { id: "daily", target: "[data-tour='rewards-daily']", titleKey: "rewardsPage.tourDaily", bodyKey: "rewardsPage.tourDailyBody" },
  { id: "balance", target: "[data-tour='rewards-balance']", titleKey: "rewardsPage.tourBalance", bodyKey: "rewardsPage.tourBalanceBody" },
  { id: "clan", target: "[data-tour='rewards-clan']", titleKey: "rewardsPage.tourClan", bodyKey: "rewardsPage.tourClanBody" },
];

const stepDefaults = {
  submit: { title: "Submit Report", body: "Report fake accounts here. Each approved report earns a reward." },
  daily: { title: "Daily Challenge", body: "Get 3 approved reports today for a 10% bonus." },
  balance: { title: "Balance", body: "Track your earnings and withdraw when you reach the minimum." },
  clan: { title: "Clan", body: "Join or create a clan to compete with others." },
};
const defaults = { gotIt: "Got it", next: "Next", skip: "Skip" };

export function RewardsTour() {
  const { t } = useI18n();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [position, setPosition] = useState(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
      const timer = setTimeout(() => setActive(true), 1200);
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
  const d = s ? stepDefaults[s.id] : null;
  const title = s ? (t(s.titleKey) !== s.titleKey ? t(s.titleKey) : (d?.title || "")) : "";
  const body = s ? (t(s.bodyKey) !== s.bodyKey ? t(s.bodyKey) : (d?.body || "")) : "";

  if (!active || !position) return null;

  return (
    <div
      className="fixed z-[90] rounded-2xl border border-cyan-300/30 bg-slate-900/98 px-5 py-4 shadow-xl backdrop-blur-xl"
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
            {t("rewardsPage.tourSkip") !== "rewardsPage.tourSkip" ? t("rewardsPage.tourSkip") : defaults.skip}
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-3 py-1.5 text-xs font-semibold text-white"
          >
            {step >= steps.length - 1
              ? (t("rewardsPage.tourGotIt") !== "rewardsPage.tourGotIt" ? t("rewardsPage.tourGotIt") : defaults.gotIt)
              : (t("rewardsPage.tourNext") !== "rewardsPage.tourNext" ? t("rewardsPage.tourNext") : defaults.next)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RewardsTour;
