import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useI18n } from "../i18n";

const badgeLabels = {
  Rookie: "Rookie",
  "Rising Hunter": "Rising Hunter",
  "Pro Hunter": "Pro Hunter",
  "Elite Hunter": "Elite Hunter",
  Legend: "Legend",
};

const PublicProfile = ({ apiBase }) => {
  const { t } = useI18n();
  const { identifier } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!identifier) {
      setError("Invalid profile");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${apiBase}/rewards/profile/public/${encodeURIComponent(identifier)}`);
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setError(payload?.error || "Profile not found");
          setProfile(null);
          return;
        }
        setProfile(payload);
        setError("");
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load profile");
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBase, identifier]);

  const badgeLabel = (raw) => badgeLabels[String(raw || "")] || raw;

  if (loading) {
    return (
      <main className="container pb-16 pt-10">
        <div className="glass-card p-8 text-center">
          <p className="text-white/70">{t("userPanelPage.loading")}</p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="container pb-16 pt-10">
        <div className="glass-card p-8 text-center">
          <p className="text-rose-300">{error}</p>
          <Link to="/rewards" className="mt-4 inline-block text-cyan-300 hover:text-cyan-200">
            {t("nav.rewards")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container pb-16 pt-10">
      <section className="glass-card p-8 max-w-xl mx-auto">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">{t("rewardsPage.achievementsTitle")}</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          {profile.display_name}
          {profile.title && (
            <span className="ml-2 text-lg font-normal text-cyan-200">({profile.title})</span>
          )}
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-amber-300/40 bg-amber-300/20 px-3 py-1.5 text-sm font-semibold text-amber-100">
            {badgeLabel(profile.badge)}
          </span>
          {(profile.special_badges || []).map((b) => (
            <span key={b} className="rounded-full border border-cyan-300/40 bg-cyan-300/20 px-3 py-1.5 text-sm font-semibold text-cyan-100">
              {badgeLabel(b)}
            </span>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">{t("rewardsPage.level")}</p>
            <p className="text-xl font-bold text-white">{profile.level}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">{t("rewardsPage.xp")}</p>
            <p className="text-xl font-bold text-white">{profile.xp}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">{t("rewardsPage.approvedReports")}</p>
            <p className="text-xl font-bold text-white">{profile.approved_claims}</p>
          </div>
          {profile.clan_name && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/50">{t("rewardsPage.clanTitle")}</p>
              <p className="text-lg font-semibold text-white">{profile.clan_name}</p>
            </div>
          )}
        </div>
        <div className="mt-6">
          <Link to="/rewards" className="text-cyan-300 hover:text-cyan-200">
            ← {t("nav.rewards")}
          </Link>
        </div>
      </section>
    </main>
  );
};

export default PublicProfile;
