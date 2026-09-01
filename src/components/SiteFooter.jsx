import { memo } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { stars, smallSphere } from "../assets";

const SiteFooter = memo(() => {
  const { t } = useI18n();
  return (
    <footer className="relative border-t border-white/10 py-10 overflow-hidden">
      <img
        src={stars}
        alt=""
        className="pointer-events-none absolute left-1/2 top-4 w-32 -translate-x-1/2 opacity-20"
      />
      <img
        src={smallSphere}
        alt=""
        className="pointer-events-none absolute bottom-6 right-10 w-12 opacity-30"
      />
      <div className="container relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {t("footer.title")}
          </h3>
          <p className="mt-2 text-sm text-white/50">
            {t("footer.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
          <Link to="/transparency" className="hover:text-cyan-300 transition">{t("transparency.title")}</Link>
          <Link to="/faq" className="hover:text-cyan-300 transition">{t("nav.faq")}</Link>
          <Link to="/feedback" className="hover:text-cyan-300 transition">{t("nav.feedback")}</Link>
          <Link to="/changelog" className="hover:text-cyan-300 transition">{t("nav.changelog")}</Link>
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span>Flask API</span>
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span>Behavioral + Graph ML</span>
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span>Explainable AI</span>
        </div>
      </div>
    </footer>
  );
});

SiteFooter.displayName = "SiteFooter";

export default SiteFooter;
