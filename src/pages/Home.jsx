import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n.jsx";
import { gradient, grid, smallSphere, stars } from "../assets";
import { ScrollReveal } from "../components/ScrollReveal";
import LiveStats from "../components/LiveStats";
import Testimonials from "../components/Testimonials";

const HERO_ICONS = [
  "fa-database",
  "fa-camera",
  "fa-house",
  "fa-gear",
  "fa-cloud",
  "fa-sack-dollar",
  "fa-chart-line",
  "fa-wifi",
  "fa-shield-halved",
  "fa-magnifying-glass",
  "fa-user-secret",
  "fa-code",
];

const Home = ({ apiBase }) => {
  const { t } = useI18n();
  const [activeSlide, setActiveSlide] = useState(0);
  const slides = ["csv", "instagram", "dashboard"];
  useEffect(() => {
    const id = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);
  const highlights = [
    { title: t("home.highlight1Title"), text: t("home.highlight1Text") },
    { title: t("home.highlight2Title"), text: t("home.highlight2Text") },
    { title: t("home.highlight3Title"), text: t("home.highlight3Text") },
  ];
  const features = [
    t("home.feature1"),
    t("home.feature2"),
    t("home.feature3"),
    t("home.feature4"),
    t("home.feature5"),
  ];

  return (
    <main>
      {/* Hero — full viewport like the reference */}
      <section className="relative -mt-24 flex min-h-[100vh] flex-col justify-between px-6 pt-12 pb-4 md:px-10 md:-mt-28 md:pt-14 lg:-mt-32 lg:pt-16 lg:flex-row lg:items-center lg:gap-8">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-widest text-white/70">
            <i className="fa-solid fa-shield-halved opacity-80" />
            {t("home.heroBadge")}
          </div>
          <h1 className="mt-3 text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
            {t("home.heroTitleBefore")}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              {t("home.heroTitleHighlight")}
            </span>
            {t("home.heroTitleAfter")}
          </h1>
          <p className="mt-3 text-base text-white/70 md:text-lg">
            {t("home.heroSubline")}
          </p>
          <div className="mt-5 flex flex-wrap gap-4">
            <Link
              to="/analyze"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-all hover:border-white/50 hover:bg-white/15"
            >
              <i className="fa-solid fa-file-csv" />
              {t("home.ctaPrimary")}
            </Link>
            <Link
              to="/instagram"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-transparent px-6 py-3 text-sm font-semibold text-white transition-all hover:border-white/50 hover:bg-white/10"
            >
              <i className="fa-brands fa-instagram" />
              {t("home.ctaInstagram")}
            </Link>
          </div>
        </div>

        {/* Right: icon globe */}
        <div className="relative z-10 mt-5 flex justify-center lg:mt-0 lg:flex-1 lg:justify-end">
          <div className="relative h-44 w-44 md:h-56 md:w-56 lg:h-64 lg:w-64">
            {HERO_ICONS.map((icon, i) => {
              const angle = (i / HERO_ICONS.length) * 2 * Math.PI - Math.PI / 2;
              const r = 48;
              const x = 50 + r * Math.cos(angle);
              const y = 50 + r * Math.sin(angle);
              return (
                <div
                  key={icon}
                  className="absolute flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/60 transition-colors hover:border-cyan-400/50 hover:text-cyan-300"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <i className={`fa-solid ${icon} text-sm`} />
                </div>
              );
            })}
            <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/30 bg-cyan-500/10 flex items-center justify-center">
              <i className="fa-solid fa-brain text-2xl text-cyan-300" />
            </div>
          </div>
        </div>

        <LiveStats apiBase={apiBase} />
        {/* Scroll indicator */}
        <a
          href="#grid-shine"
          className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/40 bg-black/30 px-3 py-2 text-white/80 shadow-lg transition hover:border-white/60 hover:text-white"
          aria-label="Scroll down"
        >
          <i className="fa-solid fa-chevron-down block text-lg" />
        </a>
      </section>

      {/* Grid-shine cards — below the fold */}
      <section id="grid-shine" className="container pt-16 pb-8">
        <ScrollReveal>
        <div className="home-hero hover-lift relative overflow-hidden rounded-[36px] border border-white/10 bg-white/5 px-6 py-16 shadow-[0_0_80px_rgba(124,77,255,0.35)] md:px-12 tilt-card">
          <div className="hero-grid" />
          <div className="grid-shine" />
          <div className="orb orb--one" />
          <div className="orb orb--two" />
          <div className="orb orb--three" />
          <div className="relative z-10 grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-white/50">
                {t("home.tag")}
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-white md:text-5xl neon-title">
                {t("home.title")}
              </h2>
              <p className="mt-5 text-base text-white/60 md:text-lg">
                {t("home.subtitle")}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/analyze" className="btn-primary">
                  {t("home.ctaPrimary")}
                </Link>
                <Link to="/dashboard" className="btn-outline">
                  {t("home.ctaSecondary")}
                </Link>
              </div>
            </div>
            <div className="neo-card tilt-card">
              <div className="scanline" />
              <div className="orbit" />
              <div className="flex items-center justify-between">
                <span className="text-sm uppercase tracking-[0.2em] text-white/50">
                  {t("home.liveScan")}
                </span>
                <span className="badge-live badge-pulse">{t("home.online")}</span>
              </div>
              <div className="mt-6 space-y-4">
                {activeSlide === 0 && (
                  <div className="space-y-3">
                    {highlights.map((item) => (
                      <div key={item.title} className="glow-card">
                        <h3 className="text-lg font-semibold text-white">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-sm text-white/60">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {activeSlide === 1 && (
                  <div className="glow-card">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/50">
                      Instagram · Demo
                    </p>
                    <h3 className="mt-3 text-lg font-semibold text-white">
                      @demo_insta_account
                    </h3>
                    <div className="mt-4 meter" style={{ "--value": 0.35 }}>
                      <div className="meter-inner">
                        <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                          Trust Score
                        </span>
                        <span className="text-3xl font-semibold text-white">
                          65
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-white/60">
                      Fake probability:{" "}
                      <span className="text-white">35.0%</span>
                    </p>
                  </div>
                )}
                {activeSlide === 2 && (
                  <div className="glow-card">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/50">
                      Dashboard · Demo
                    </p>
                    <h3 className="mt-3 text-lg font-semibold text-white">
                      40 accounts · 13 fake
                    </h3>
                    <div className="mt-4 h-2 w-full rounded-full bg-white/10">
                      <div className="h-2 w-[32%] rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-500" />
                    </div>
                    <p className="mt-3 text-xs text-white/60">
                      Avg fake probability:{" "}
                      <span className="text-white">32.1%</span>
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 pt-2">
                  {slides.map((slide, index) => (
                    <button
                      key={slide}
                      type="button"
                      className={`h-1.5 w-4 rounded-full transition-all ${
                        activeSlide === index
                          ? "bg-white"
                          : "bg-white/30 hover:bg-white/60"
                      }`}
                      onClick={() => setActiveSlide(index)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        </ScrollReveal>

        <ScrollReveal delay={100}>
        <section className="container mt-12">
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <div className="glass-card hover-lift p-8 relative overflow-hidden tilt-card">
              <div className="scanline" />
              <img
                src={stars}
                alt=""
                className="pointer-events-none absolute right-6 top-6 w-24 opacity-25"
              />
              <img
                src={grid}
                alt=""
                className="pointer-events-none absolute inset-0 opacity-15 mix-blend-soft-light"
              />
              <img
                src={gradient}
                alt=""
                className="pointer-events-none absolute -right-24 -top-16 w-64 opacity-70"
              />
              <h3 className="text-2xl font-semibold text-white">
                {t("home.pipelineTitle")}
              </h3>
              <p className="mt-3 text-white/60">{t("home.pipelineBody")}</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {features.map((feature, index) => (
                  <div
                    key={feature}
                    className="relative feature-pill group"
                  >
                    {feature}
                    <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 hidden w-64 rounded-2xl border border-white/15 bg-n-8/95 p-3 text-xs text-white/70 shadow-xl group-hover:block">
                      {t(`home.feature${index + 1}Hint`)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card hover-lift p-8 relative overflow-hidden tilt-card">
              <div className="scanline" />
              <img
                src={grid}
                alt=""
                className="pointer-events-none absolute inset-0 opacity-10 mix-blend-soft-light"
              />
              <img
                src={smallSphere}
                alt=""
                className="pointer-events-none absolute -left-8 bottom-4 w-16 opacity-80 animate-pulse"
              />
              <h3 className="text-2xl font-semibold text-white">
                {t("home.howTitle")}
              </h3>
              <ol className="mt-4 space-y-4 text-sm text-white/60">
                <li>{t("home.step1")}</li>
                <li>{t("home.step2")}</li>
                <li>{t("home.step3")}</li>
                <li>{t("home.step4")}</li>
              </ol>
              <Link to="/analyze" className="btn-primary mt-6 inline-flex">
                {t("home.startNow")}
              </Link>
            </div>
          </div>
        </section>
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <Testimonials />
        </ScrollReveal>
      </section>
    </main>
  );
};

export default Home;
