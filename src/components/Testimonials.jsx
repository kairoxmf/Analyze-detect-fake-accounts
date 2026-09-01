import { useI18n } from "../i18n";

const TESTIMONIALS = [
  {
    quote: "دقیق و سریع. بهترین ابزار برای تشخیص اکانت‌های فیک.",
    name: "علی",
    role: "مدیر امنیت",
    avatar: "A",
  },
  {
    quote: "The AI analysis is incredibly accurate. Saved us hours of manual review.",
    name: "Sarah",
    role: "Community Manager",
    avatar: "S",
  },
  {
    quote: "سیستم پاداش‌دهی عالیه. انگیزه می‌دهد بیشتر گزارش بدیم.",
    name: "رضا",
    role: "شکارچی",
    avatar: "R",
  },
];

const Testimonials = () => {
  const { t } = useI18n();

  return (
    <section className="container py-16">
      <h2 className="text-center text-2xl font-semibold text-white">
        {t("home.testimonialsTitle")}
      </h2>
      <p className="mt-2 text-center text-white/60">
        {t("home.testimonialsSubtitle")}
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((item, i) => (
          <div
            key={i}
            className="glass-card hover-lift p-6 tilt-card rounded-2xl border border-white/10"
          >
            <p className="text-white/80 italic">"{item.quote}"</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/30 text-cyan-200 font-semibold">
                {item.avatar}
              </div>
              <div>
                <p className="font-semibold text-white">{item.name}</p>
                <p className="text-xs text-white/50">{item.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Testimonials;
