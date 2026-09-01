import { useI18n } from "../i18n";
import { Link } from "react-router-dom";

const Transparency = () => {
  const { t } = useI18n();

  return (
    <main className="container py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-white">{t("transparency.title")}</h1>
        <p className="mt-4 text-white/70">{t("transparency.subtitle")}</p>
        <div className="mt-8 space-y-6 glass-card p-8">
          <section>
            <h2 className="text-xl font-semibold text-cyan-200">{t("transparency.rewardCalc")}</h2>
            <p className="mt-2 text-sm text-white/70">{t("transparency.rewardCalcDesc")}</p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-white/60">
              <li>{t("transparency.rewardBase")}</li>
              <li>{t("transparency.rewardFirst")}</li>
              <li>{t("transparency.rewardDaily")}</li>
              <li>{t("transparency.rewardLucky")}</li>
              <li>{t("transparency.rewardCombo")}</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-cyan-200">{t("transparency.qualityScore")}</h2>
            <p className="mt-2 text-sm text-white/70">{t("transparency.qualityScoreDesc")}</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-cyan-200">{t("transparency.verified")}</h2>
            <p className="mt-2 text-sm text-white/70">{t("transparency.verifiedDesc")}</p>
          </section>
        </div>
        <p className="mt-6 text-center">
          <Link to="/rewards" className="btn-outline">
            {t("transparency.backToRewards")}
          </Link>
        </p>
      </div>
    </main>
  );
};

export default Transparency;
