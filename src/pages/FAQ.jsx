import { useState } from "react";
import { useI18n } from "../i18n.jsx";

const FAQ = () => {
  const { t } = useI18n();
  const [openId, setOpenId] = useState(null);

  const items = [
    { id: "q1", q: t("faq.q1"), a: t("faq.a1") },
    { id: "q2", q: t("faq.q2"), a: t("faq.a2") },
    { id: "q3", q: t("faq.q3"), a: t("faq.a3") },
    { id: "q4", q: t("faq.q4"), a: t("faq.a4") },
    { id: "q5", q: t("faq.q5"), a: t("faq.a5") },
    { id: "q6", q: t("faq.q6"), a: t("faq.a6") },
    { id: "q7", q: t("faq.q7"), a: t("faq.a7") },
    { id: "q8", q: t("faq.q8"), a: t("faq.a8") },
  ];

  return (
    <main className="container pb-16 pt-10 faq-page">
      <h1 className="text-2xl font-bold text-white md:text-3xl">
        {t("faq.title")}
      </h1>
      <p className="mt-2 text-white/60">
        {t("faq.subtitle")}
      </p>

      <section className="mt-8 space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="glass-card overflow-hidden tilt-card"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between p-6 text-left text-white transition-colors hover:bg-white/5"
              onClick={() => setOpenId(openId === item.id ? null : item.id)}
              aria-expanded={openId === item.id}
            >
              <span className="font-semibold">{item.q}</span>
              <i className={`fa-solid fa-chevron-down text-white/60 transition-transform ${openId === item.id ? "rotate-180" : ""}`} />
            </button>
            {openId === item.id && (
              <div className="border-t border-white/10 px-6 py-4 text-white/70">
                {item.a}
              </div>
            )}
          </div>
        ))}
      </section>
    </main>
  );
};

export default FAQ;
