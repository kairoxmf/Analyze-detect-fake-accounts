import { useI18n } from "../i18n.jsx";

const CHANGELOG = [
  { version: "2025.2.24", date: "2025-02-24", items: ["Stats page with charts", "Dashboard search, filter, sort", "My Reports list", "FAQ page", "Leaderboard", "PDF export", "Compare two accounts", "Notifications", "Changelog page", "Feedback form"] },
  { version: "2025.2.20", date: "2025-02-20", items: ["PWA support", "Responsive layout", "Story Quests i18n", "Compact navbar"] },
  { version: "2025.2.15", date: "2025-02-15", items: ["Rewards gamification", "Lucky Wheel", "Clan system", "Leaderboard API"] },
  { version: "2025.2.01", date: "2025-02-01", items: ["Instagram analysis", "CSV upload", "Dashboard", "User auth"] },
];

const Changelog = () => {
  const { t } = useI18n();

  return (
    <main className="container pb-16 pt-10 changelog-page">
      <h1 className="text-2xl font-bold text-white md:text-3xl">
        {t("changelog.title") || "Changelog"}
      </h1>
      <p className="mt-2 text-white/60">
        {t("changelog.subtitle") || "What's new in Sentinel."}
      </p>

      <section className="mt-8 space-y-4">
        {CHANGELOG.map((release) => (
          <div key={release.version} className="glass-card p-6 tilt-card relative overflow-hidden">
            <div className="flex flex-wrap items-center gap-4">
              <span className="rounded-full bg-purple-500/20 px-3 py-1 text-sm font-semibold text-purple-300">
                v{release.version}
              </span>
              <span className="text-sm text-white/50">{release.date}</span>
            </div>
            <ul className="mt-4 space-y-2">
              {release.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-white/80">
                  <i className="fa-solid fa-check mt-1 text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
};

export default Changelog;
