import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { fireConfetti } from "../utils/confetti";

/**
 * Listens for Ctrl+Shift+S and shows a secret message.
 */
export default function EasterEgg() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key?.toLowerCase() === "s") {
        e.preventDefault();
        setShow(true);
        fireConfetti();
        setTimeout(() => setShow(false), 2500);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
      role="dialog"
      aria-label="Easter egg"
    >
      <div className="rounded-2xl border-2 border-cyan-400/60 bg-n-8/98 px-8 py-6 text-center shadow-[0_0_60px_rgba(34,211,238,0.3)] animate-in zoom-in-95 duration-300">
        <p className="text-2xl font-bold text-cyan-300">{t("home.easterEggTitle")}</p>
        <p className="mt-2 text-white/90">{t("home.easterEggMessage")}</p>
      </div>
    </div>
  );
}
