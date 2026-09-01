import { memo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { brainwaveSymbol, brainwaveWhiteSymbol } from "../assets";
import NotificationsDropdown from "./NotificationsDropdown";

const navLinkClass = ({ isActive }) =>
  `nav-link shrink-0 ${isActive ? "nav-link--active" : ""}`;

const NavDropdown = ({ label, icon, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`nav-link shrink-0 inline-flex items-center gap-1.5 ${open ? "nav-link--active" : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {icon}
        <span>{label}</span>
        <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 pt-1 min-w-[180px]">
          <div className="rounded-xl border border-white/15 bg-n-8/98 py-2 shadow-xl backdrop-blur-xl">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

const Navbar = memo(({ avgFake, theme = "dark", onToggleTheme, currentUser, onUserLogout, apiBase, userToken }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { lang, setLang, t } = useI18n();
  const adminPortalUrl =
    import.meta.env.VITE_ADMIN_PORTAL_URL || "http://localhost:5180/portal/login";
  const hasRisk = typeof avgFake === "number";
  const avgPercent = hasRisk ? (avgFake || 0) * 100 : 0;
  const riskLabel = t("nav.riskLabel");
  const logoSymbol = theme === "light" ? brainwaveSymbol : brainwaveWhiteSymbol;
  return (
    <header
      className={`site-header sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300 ${
        theme === "light"
          ? "bg-white/90 border-slate-200 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"
          : "bg-n-8/90 border-white/10 shadow-[0_0_30px_rgba(124,77,255,0.08)]"
      }`}
    >
      <div className="container flex flex-wrap items-center gap-2 py-2 md:py-2.5">
        <div className="flex shrink-0 items-center gap-2">
          <div className="nav-logo-wrap relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 transition-all duration-200 hover:border-purple-400/40">
            <img src={logoSymbol} alt="" className="h-5 w-5 object-contain" />
          </div>
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/45">
              Sentinel
            </p>
            <h1 className="text-sm font-bold tracking-tight text-white xl:text-base">
              {t("nav.brand")}
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="order-2 ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/5 lg:hidden"
          aria-label="Menu"
        >
          <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"} text-lg text-white/80`} />
        </button>
        <div className="order-2 ml-auto hidden shrink-0 items-center gap-1.5 lg:flex">
          <button
            type="button"
            onClick={onToggleTheme}
            className="nav-btn-theme inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/75 transition-all duration-200 hover:border-cyan-400/40 hover:bg-white/10"
            aria-label={theme === "light" ? t("nav.themeDark") : t("nav.themeLight")}
          >
            {theme === "light" ? (
              <i className="fa-solid fa-moon w-3.5 opacity-80" aria-hidden />
            ) : (
              <i className="fa-solid fa-sun w-3.5 opacity-80" aria-hidden />
            )}
            <span className="hidden 2xl:inline">
              {theme === "light" ? t("nav.themeDark") : t("nav.themeLight")}
            </span>
          </button>
          <NotificationsDropdown apiBase={apiBase} token={userToken} />
          <div className="relative inline-flex h-8 items-center">
            <i className="fa-solid fa-language absolute left-2.5 w-3.5 opacity-80 pointer-events-none text-white/80" aria-hidden />
            <select
              className="language-select nav-lang-select h-8 pl-7 pr-6 text-[11px]"
              value={lang}
              onChange={(event) => setLang(event.target.value)}
              aria-label={lang === "fa" ? "زبان" : lang === "ar" ? "اللغة" : lang === "tr" ? "Dil" : "Language"}
            >
              <option value="fa">FA</option>
              <option value="en">EN</option>
              <option value="ar">AR</option>
              <option value="tr">TR</option>
            </select>
          </div>
          {currentUser ? (
            <button
              type="button"
              onClick={onUserLogout}
              className="nav-btn-theme inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/75 transition-all duration-200 hover:border-rose-400/40 hover:bg-white/10"
            >
              <i className="fa-solid fa-right-from-bracket w-3.5 opacity-80" aria-hidden />
              <span className="hidden 2xl:inline">{currentUser?.username || t("nav.logout")}</span>
            </button>
          ) : (
            <NavLink to="/user/auth" className={navLinkClass}>
              <i className="fa-solid fa-right-to-bracket mr-1.5 w-4 opacity-80" />
              {t("nav.login")}
            </NavLink>
          )}
          <a
            href="/analyze"
            className="btn-primary nav-cta hidden 2xl:inline-flex h-8 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold"
            aria-label="Start analyzing"
          >
            <i className="fa-solid fa-magnifying-glass text-xs" />
            {t("nav.start")}
          </a>
        </div>

        <nav className={`order-3 w-full ${mobileMenuOpen ? "flex flex-col border-t border-white/10 pt-3 mt-2 gap-1 overflow-y-auto max-h-[70vh]" : "hidden"} lg:flex lg:flex-row lg:items-center lg:justify-center lg:gap-1 lg:overflow-visible lg:max-h-none lg:border-t-0 lg:pt-0 lg:mt-0`}>
          <NavLink to="/" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
            <i className="fa-solid fa-house mr-1.5 w-4 opacity-80" />
            {t("nav.home")}
          </NavLink>
          {mobileMenuOpen ? (
            <>
              <NavLink to="/analyze" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-file-csv mr-1.5 w-4 opacity-80" />
                {t("nav.analyze")}
              </NavLink>
              <NavLink to="/instagram" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-brands fa-instagram mr-1.5 w-4 opacity-80" />
                {t("nav.instagram")}
              </NavLink>
              <NavLink to="/ai-chat" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-robot mr-1.5 w-4 opacity-80" />
                {t("nav.aiChat")}
              </NavLink>
              <NavLink to="/rewards" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-gift mr-1.5 w-4 opacity-80" />
                {t("nav.rewards")}
              </NavLink>
              <NavLink to="/leaderboard" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-trophy mr-1.5 w-4 opacity-80" />
                {t("nav.leaderboard")}
              </NavLink>
              {currentUser && (
                <NavLink to="/my-reports" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                  <i className="fa-solid fa-list-check mr-1.5 w-4 opacity-80" />
                  {t("nav.myReports")}
                </NavLink>
              )}
              <NavLink to="/dashboard" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-chart-pie mr-1.5 w-4 opacity-80" />
                {t("nav.dashboard")}
              </NavLink>
              <NavLink to="/stats" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-chart-line mr-1.5 w-4 opacity-80" />
                {t("nav.stats")}
              </NavLink>
              <NavLink to="/compare" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-code-compare mr-1.5 w-4 opacity-80" />
                {t("nav.compare")}
              </NavLink>
              <NavLink to="/transparency" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-scale-balanced mr-1.5 w-4 opacity-80" />
                {t("nav.transparency")}
              </NavLink>
              <NavLink to="/user/panel" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-user mr-1.5 w-4 opacity-80" />
                {t("nav.userPanel")}
              </NavLink>
              <NavLink to="/faq" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-circle-question mr-1.5 w-4 opacity-80" />
                {t("nav.faq")}
              </NavLink>
              <NavLink to="/feedback" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-comment-dots mr-1.5 w-4 opacity-80" />
                {t("nav.feedback")}
              </NavLink>
              <NavLink to="/changelog" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-clock-rotate-left mr-1.5 w-4 opacity-80" />
                {t("nav.changelog")}
              </NavLink>
              <a href={adminPortalUrl} className={navLinkClass}>
                <i className="fa-solid fa-lock mr-1.5 w-4 opacity-80" />
                {t("nav.admin")}
              </a>
            </>
          ) : (
            <>
          <NavDropdown label={t("nav.groupAnalyze")} icon={<i className="fa-solid fa-magnifying-glass mr-1.5 w-4 opacity-80" />}>
            <NavLink to="/analyze" className={({ isActive }) => `block px-4 py-2.5 text-left text-sm transition hover:bg-white/10 ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white"}`} onClick={() => setMobileMenuOpen(false)}>
              <i className="fa-solid fa-file-csv mr-2 w-4 opacity-80" />
              {t("nav.analyze")}
            </NavLink>
            <NavLink to="/instagram" className={({ isActive }) => `block px-4 py-2.5 text-left text-sm transition hover:bg-white/10 ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white"}`} onClick={() => setMobileMenuOpen(false)}>
              <i className="fa-brands fa-instagram mr-2 w-4 opacity-80" />
              {t("nav.instagram")}
            </NavLink>
            <NavLink to="/ai-chat" className={({ isActive }) => `block px-4 py-2.5 text-left text-sm transition hover:bg-white/10 ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white"}`} onClick={() => setMobileMenuOpen(false)}>
              <i className="fa-solid fa-robot mr-2 w-4 opacity-80" />
              {t("nav.aiChat")}
            </NavLink>
          </NavDropdown>
          <NavDropdown label={t("nav.groupRewards")} icon={<i className="fa-solid fa-gift mr-1.5 w-4 opacity-80" />}>
            <NavLink to="/rewards" className={({ isActive }) => `block px-4 py-2.5 text-left text-sm transition hover:bg-white/10 ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white"}`} onClick={() => setMobileMenuOpen(false)}>
              <i className="fa-solid fa-gift mr-2 w-4 opacity-80" />
              {t("nav.rewards")}
            </NavLink>
            <NavLink to="/leaderboard" className={({ isActive }) => `block px-4 py-2.5 text-left text-sm transition hover:bg-white/10 ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white"}`} onClick={() => setMobileMenuOpen(false)}>
              <i className="fa-solid fa-trophy mr-2 w-4 opacity-80" />
              {t("nav.leaderboard")}
            </NavLink>
            {currentUser && (
              <NavLink to="/my-reports" className={({ isActive }) => `block px-4 py-2.5 text-left text-sm transition hover:bg-white/10 ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white"}`} onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-list-check mr-2 w-4 opacity-80" />
                {t("nav.myReports")}
              </NavLink>
            )}
          </NavDropdown>
          <NavLink to="/dashboard" className={navLinkClass} data-tour="dashboard" onClick={() => setMobileMenuOpen(false)}>
            <i className="fa-solid fa-chart-pie mr-1.5 w-4 opacity-80" />
            {t("nav.dashboard")}
          </NavLink>
          <NavDropdown label={t("nav.groupTools")} icon={<i className="fa-solid fa-screwdriver-wrench mr-1.5 w-4 opacity-80" />}>
            <NavLink to="/stats" className={({ isActive }) => `block px-4 py-2.5 text-left text-sm transition hover:bg-white/10 ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white"}`} onClick={() => setMobileMenuOpen(false)}>
              <i className="fa-solid fa-chart-line mr-2 w-4 opacity-80" />
              {t("nav.stats")}
            </NavLink>
            <NavLink to="/compare" className={({ isActive }) => `block px-4 py-2.5 text-left text-sm transition hover:bg-white/10 ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white"}`} onClick={() => setMobileMenuOpen(false)}>
              <i className="fa-solid fa-code-compare mr-2 w-4 opacity-80" />
              {t("nav.compare")}
            </NavLink>
          </NavDropdown>
          <NavDropdown label={t("nav.groupMore")} icon={<i className="fa-solid fa-ellipsis mr-1.5 w-4 opacity-80" />}>
            <NavLink to="/transparency" className={({ isActive }) => `block px-4 py-2.5 text-left text-sm transition hover:bg-white/10 ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white"}`} onClick={() => setMobileMenuOpen(false)}>
              <i className="fa-solid fa-scale-balanced mr-2 w-4 opacity-80" />
              {t("nav.transparency")}
            </NavLink>
            <NavLink to="/user/panel" className={({ isActive }) => `block px-4 py-2.5 text-left text-sm transition hover:bg-white/10 ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white"}`} onClick={() => setMobileMenuOpen(false)}>
              <i className="fa-solid fa-user mr-2 w-4 opacity-80" />
              {t("nav.userPanel")}
            </NavLink>
            <NavLink to="/faq" className={({ isActive }) => `block px-4 py-2.5 text-left text-sm transition hover:bg-white/10 ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white"}`} onClick={() => setMobileMenuOpen(false)}>
              <i className="fa-solid fa-circle-question mr-2 w-4 opacity-80" />
              {t("nav.faq")}
            </NavLink>
            <NavLink to="/feedback" className={({ isActive }) => `block px-4 py-2.5 text-left text-sm transition hover:bg-white/10 ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white"}`} onClick={() => setMobileMenuOpen(false)}>
              <i className="fa-solid fa-comment-dots mr-2 w-4 opacity-80" />
              {t("nav.feedback")}
            </NavLink>
            <NavLink to="/changelog" className={({ isActive }) => `block px-4 py-2.5 text-left text-sm transition hover:bg-white/10 ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white"}`} onClick={() => setMobileMenuOpen(false)}>
              <i className="fa-solid fa-clock-rotate-left mr-2 w-4 opacity-80" />
              {t("nav.changelog")}
            </NavLink>
            <a href={adminPortalUrl} className="block px-4 py-2.5 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-white">
              <i className="fa-solid fa-lock mr-2 w-4 opacity-80" />
              {t("nav.admin")}
            </a>
          </NavDropdown>
            </>
          )}
        </nav>

      </div>
      {hasRisk && (
        <div
          className={
            theme === "light"
              ? "border-t border-slate-200 bg-white/90"
              : "border-t border-white/10 bg-n-8/90"
          }
        >
          <div className="container py-1.5">
            <div className="flex items-center gap-3 text-xs text-white/70">
              <span className="whitespace-nowrap">{riskLabel}:</span>
              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-500"
                  style={{ width: `${Math.min(Math.max(avgPercent, 2), 100)}%` }}
                />
              </div>
              <span className="min-w-[3rem] text-right">
                {avgPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});

Navbar.displayName = "Navbar";

export default Navbar;
