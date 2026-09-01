import { useI18n } from "../i18n.jsx";

const ReportPanel = ({ report }) => {
  const { t } = useI18n();

  if (!report) return null;

  return (
    <div className="glass-card p-6 tilt-card">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">
          {t("reports.title")}
        </h3>
        <div className="flex items-center gap-2">
          <span className="badge badge-outline">
            {t("reports.alerts")} {report?.summary?.alert_count || 0}
          </span>
          <span className="badge badge-outline">
            {t("reports.botnet")} {report?.botnet_attack_count || 0}
          </span>
          <span className="badge badge-outline">
            {t("reports.simulated")} {report?.simulated_attack_count || 0}
          </span>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">
            {t("reports.topAlerts")}
          </p>
          <div className="mt-3 space-y-2 text-sm text-white/70">
            {(report.alerts || []).length === 0 && (
              <p className="text-white/50">{t("reports.noAlerts")}</p>
            )}
            {(report.alerts || []).map((alert) => (
              <div key={alert.name} className="flex justify-between">
                <span>{alert.name}</span>
                <span>{alert.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">
            {t("reports.topRisky")}
          </p>
          <div className="mt-3 space-y-2 text-sm text-white/70">
            {(report.top_risky || []).length === 0 && (
              <p className="text-white/50">{t("reports.noData")}</p>
            )}
            {(report.top_risky || []).map((item) => (
              <div key={item.user} className="flex justify-between">
                <span>{item.user}</span>
                <span>{(item.fake_probability * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportPanel;
