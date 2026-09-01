import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { fireConfetti } from "../utils/confetti";
import { sounds } from "../utils/sounds";
import RewardsTour from "../components/RewardsTour";

const makeSoftNotificationSound = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 740;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
    window.setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {
  }
};

const radarPolygonPoints = (radar) => {
  const keys = ["behavior", "engagement", "account_age", "network", "content"];
  const center = 100;
  const maxRadius = 78;
  const step = (Math.PI * 2) / keys.length;
  return keys
    .map((key, idx) => {
      const val = Math.max(0, Math.min(100, Number(radar?.[key] || 0)));
      const radius = (val / 100) * maxRadius;
      const angle = -Math.PI / 2 + idx * step;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      return `${x},${y}`;
    })
    .join(" ");
};

const RewardsPanel = ({ apiBase, token }) => {
  const { t } = useI18n();
  const tr = useCallback(
    (key, vars = {}) => {
      let text = String(t(key) || "");
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replaceAll(`{${k}}`, String(v));
      });
      return text;
    },
    [t]
  );
  const [displayName, setDisplayName] = useState("");
  const [nickname, setNickname] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [data, setData] = useState(null);
  const lastUserIdRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [balancePulse, setBalancePulse] = useState(false);
  const [rewardDelta, setRewardDelta] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showSeasonCelebration, setShowSeasonCelebration] = useState(false);
  const [showLuckyWheel, setShowLuckyWheel] = useState(false);
  const [luckyWheelAmount, setLuckyWheelAmount] = useState(0);
  const [dailyWheelSpinning, setDailyWheelSpinning] = useState(false);
  const [dailyWheelRotation, setDailyWheelRotation] = useState(0);
  const [dailyWheelResult, setDailyWheelResult] = useState(null);
  const [seasonCountdown, setSeasonCountdown] = useState("");
  const [leaderboard, setLeaderboard] = useState({ weekly: [], monthly: [], hall_of_fame: [] });
  const [leaderboardTab, setLeaderboardTab] = useState("weekly");
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [clanName, setClanName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [showJoinClanModal, setShowJoinClanModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [clanSearchQuery, setClanSearchQuery] = useState("");
  const [clanChatText, setClanChatText] = useState("");
  const [clanChatItems, setClanChatItems] = useState([]);
  const prevAvailableRef = useRef(0);
  const lastNotifIdRef = useRef(0);
  const celebratedSeasonNotifRef = useRef(new Set());
  const celebratedLuckyBoxRef = useRef(new Set());
  const lastClanChatIdRef = useRef(0);
  const prevLevelRef = useRef(0);
  const [form, setForm] = useState({
    suspect_username: "",
    platform: "instagram",
    evidence: "",
    note: "",
  });

  const fetchDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (!token) return;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const response = await fetch(`${apiBase}/rewards/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || t("rewardsPage.loadFailed"));
        setData(payload);
      } catch (err) {
        setError(err?.message || t("rewardsPage.loadFailed"));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [apiBase, t, token]
  );

  const registerUser = useCallback(async () => {
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/rewards/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ display_name: displayName, nickname }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("rewardsPage.saveProfileFailed"));
      localStorage.setItem("reward_display_name", displayName);
      await fetchDashboard();
      setMessage(t("rewardsPage.profileSaved"));
    } catch (err) {
      setError(err?.message || t("rewardsPage.saveProfileFailed"));
    }
  }, [apiBase, displayName, nickname, fetchDashboard, t, token]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/rewards/leaderboard`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Failed to load leaderboard.");
      setLeaderboard({
        weekly: Array.isArray(payload?.weekly) ? payload.weekly : [],
        monthly: Array.isArray(payload?.monthly) ? payload.monthly : [],
        hall_of_fame: Array.isArray(payload?.hall_of_fame) ? payload.hall_of_fame : [],
        clans: Array.isArray(payload?.clans) ? payload.clans : [],
      });
    } catch {
    }
  }, [apiBase]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${apiBase}/rewards/notifications?after_id=${lastNotifIdRef.current}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const incoming = items.slice(-10).reverse();
      if (incoming.length > 0) {
        setNotifications((prev) => [...incoming, ...prev].slice(0, 30));
        setNotifOpen(true);
        makeSoftNotificationSound();
        const seasonRewards = incoming.filter((x) => String(x?.type || "") === "season_reward");
        for (const sr of seasonRewards) {
          const id = sr?.id ?? sr?.time;
          if (id && !celebratedSeasonNotifRef.current.has(id)) {
            celebratedSeasonNotifRef.current.add(id);
            setShowSeasonCelebration(true);
            try {
              fireConfetti();
              window.setTimeout(() => fireConfetti(), 380);
            } catch {}
            window.setTimeout(() => setShowSeasonCelebration(false), 4200);
            break;
          }
        }
        const luckyBoxes = incoming.filter((x) => String(x?.type || "") === "lucky_box");
        for (const lb of luckyBoxes) {
          const id = lb?.id ?? lb?.time;
          if (id && !celebratedLuckyBoxRef.current.has(id)) {
            celebratedLuckyBoxRef.current.add(id);
            const amt = Number(lb?.meta?.amount_usd || 0) || parseInt(String(lb?.title || "0").replace(/\D/g, ""), 10) || 0;
            setLuckyWheelAmount(amt);
            setShowLuckyWheel(true);
            try {
              fireConfetti();
              window.setTimeout(() => fireConfetti(), 400);
              window.setTimeout(() => fireConfetti(), 800);
            } catch {}
            window.setTimeout(() => setShowLuckyWheel(false), 4500);
            break;
          }
        }
      }
      lastNotifIdRef.current = Math.max(
        Number(payload?.latest_id || 0),
        ...items.map((x) => Number(x?.id || 0))
      );
    } catch {
    }
  }, [apiBase, token]);

  const fetchClanChat = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${apiBase}/rewards/clan/chat?after_id=${lastClanChatIdRef.current}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const items = Array.isArray(payload?.items) ? payload.items : [];
      if (items.length > 0) {
        setClanChatItems((prev) => [...prev, ...items].slice(-80));
      }
      lastClanChatIdRef.current = Math.max(
        Number(payload?.latest_id || 0),
        ...items.map((x) => Number(x?.id || 0))
      );
    } catch {
    }
  }, [apiBase, token]);

  useEffect(() => {
    if (!token) return;
    fetchDashboard();
    fetchLeaderboard();
    fetchNotifications();
    fetchClanChat();
    const id = window.setInterval(() => {
      fetchDashboard({ silent: true });
      fetchLeaderboard();
      fetchNotifications();
      fetchClanChat();
    }, 5000);
    return () => window.clearInterval(id);
  }, [token, fetchDashboard, fetchLeaderboard, fetchNotifications, fetchClanChat]);

  const submitReport = async (event) => {
    event.preventDefault();
    if (!token) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/rewards/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("rewardsPage.reportFailed"));
      setForm((prev) => ({ ...prev, suspect_username: "", evidence: "", note: "" }));
      setMessage(t("rewardsPage.reportSubmitted"));
      await fetchDashboard();
    } catch (err) {
      setError(err?.message || t("rewardsPage.reportFailed"));
    }
  };

  const requestWithdraw = async () => {
    if (!token) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/rewards/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          method: "USDT",
          wallet_address: walletAddress,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("rewardsPage.withdrawFailed"));
      localStorage.setItem("reward_wallet_address", walletAddress);
      if (user?.id) localStorage.setItem("reward_user_id", String(user.id));
      setMessage(t("rewardsPage.withdrawSubmitted"));
      await fetchDashboard();
    } catch (err) {
      setError(err?.message || t("rewardsPage.withdrawFailed"));
    }
  };

  const user = data?.user_reward || {};
  const reportReward = Number(data?.report_reward_usd || 25);
  const minWithdraw = Number(data?.min_withdraw_usd || 250);
  const available = Number(user?.available_usd || 0);
  const canWithdraw = available >= minWithdraw && walletAddress.trim().length > 4;

  const claims = useMemo(() => data?.claims || [], [data]);
  const withdrawals = useMemo(() => data?.withdrawals || [], [data]);
  const timeline = useMemo(() => data?.timeline || [], [data]);
  const gamification = useMemo(() => data?.gamification || {}, [data]);
  const challenge = useMemo(() => data?.weekly_challenge || {}, [data]);
  const verificationQuest = useMemo(() => gamification?.verification_quest || {}, [gamification]);
  const clanData = useMemo(() => data?.clans || {}, [data]);
  const season = useMemo(() => data?.season || {}, [data]);
  const dailyChallenge = useMemo(() => data?.daily_challenge || {}, [data]);
  const activeEvents = useMemo(() => data?.active_events || {}, [data]);
  const clanRival = useMemo(() => data?.clan_rival || null, [data]);
  const hunterOfDay = useMemo(() => data?.hunter_of_day || null, [data]);
  const seasonStory = useMemo(() => (data?.gamification_config?.season_story || "").trim(), [data]);
  const goldenHour = useMemo(() => {
    const h = data?.gamification_config?.golden_hour;
    if (h == null || h === "") return false;
    return new Date().getUTCHours() === Number(h);
  }, [data?.gamification_config?.golden_hour]);
  const luckyWheelProgress = useMemo(() => {
    const approved = Number(user?.approved_claims || 0);
    const everyN = Number(data?.gamification_config?.lucky_wheel_every_n || 5) || 5;
    const remainder = approved % everyN;
    const remaining = remainder === 0 ? everyN : everyN - remainder;
    const nextAt = approved + remaining;
    return { approved, everyN, remaining, nextAt };
  }, [user?.approved_claims, data?.gamification_config?.lucky_wheel_every_n]);
  const smartNotifClan = useMemo(() => {
    const current = clanData?.current;
    const rival = clanRival;
    if (!current?.id || !rival) return null;
    const currPoints = Number(current.weekly_points || 0);
    const rivalPoints = Number(rival.weekly_points || 0);
    const gap = rivalPoints - currPoints;
    if (gap > 0 && gap <= 100) return gap;
    return null;
  }, [clanData?.current, clanRival]);
  const referralCode = useMemo(() => data?.user_reward?.referral_code || "", [data]);
  const userTitle = useMemo(() => data?.user_reward?.title || "", [data]);
  const heatmap = useMemo(() => data?.heatmap || { hours: [], weekdays: [] }, [data]);
  const riskRadar = useMemo(() => data?.risk_radar || {}, [data]);
  const progressChart = useMemo(() => data?.progress_chart || { labels: [], values: [] }, [data]);
  const personalGoals = useMemo(() => data?.personal_goals || {}, [data]);
  const luckyDayToday = useMemo(() => !!data?.lucky_day_today, [data?.lucky_day_today]);
  const duels = useMemo(() => data?.duels || { active: null, history: [] }, [data?.duels]);
  const predictions = useMemo(() => data?.predictions || { current: null, history: [] }, [data?.predictions]);
  const reactions = useMemo(() => data?.reactions || [], [data?.reactions]);
  const annualHallOfFame = useMemo(() => data?.annual_hall_of_fame || [], [data?.annual_hall_of_fame]);
  const flashChallenges = useMemo(() => data?.flash_challenges || [], [data?.flash_challenges]);
  const hiddenMissions = useMemo(() => data?.hidden_missions || [], [data?.hidden_missions]);
  const dailyRandomChallenge = useMemo(() => data?.daily_random_challenge || {}, [data?.daily_random_challenge]);
  const storyQuests = useMemo(() => data?.story_quests || [], [data?.story_quests]);
  const hiddenAchievements = useMemo(() => data?.hidden_achievements || [], [data?.hidden_achievements]);
  const weekComparison = useMemo(() => data?.week_comparison || {}, [data?.week_comparison]);
  const aiPrediction = useMemo(() => data?.ai_prediction || {}, [data?.ai_prediction]);
  useEffect(() => {
    const endAt = season?.end_at;
    if (!endAt) {
      setSeasonCountdown("");
      return;
    }
    const tick = () => {
      try {
        const end = new Date(endAt).getTime();
        const now = Date.now();
        const diff = end - now;
        if (diff <= 0) {
          setSeasonCountdown(t("rewardsPage.seasonEnded"));
          return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (d > 0) {
          setSeasonCountdown(tr("rewardsPage.seasonCountdownDays", { days: d, hours: h, min: m, sec: s }));
        } else if (h > 0) {
          setSeasonCountdown(tr("rewardsPage.seasonCountdownHours", { hours: h, min: m, sec: s }));
        } else {
          setSeasonCountdown(tr("rewardsPage.seasonCountdownMin", { min: m, sec: s }));
        }
      } catch {
        setSeasonCountdown("");
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [season?.end_at, t, tr]);

  useEffect(() => {
    const uid = String(user?.id || "");
    if (!uid) return;
    if (lastUserIdRef.current !== uid) {
      lastUserIdRef.current = uid;
      const storedUserId = localStorage.getItem("reward_user_id") || "";
      if (storedUserId !== uid) {
        setDisplayName(user?.display_name || "");
        setNickname(user?.nickname || "");
        setWalletAddress("");
      } else {
        setDisplayName(user?.display_name || localStorage.getItem("reward_display_name") || "");
        setNickname(user?.nickname || "");
        setWalletAddress(localStorage.getItem("reward_wallet_address") || "");
      }
    } else {
      setDisplayName((prev) => (prev === "" && user?.display_name ? user.display_name : prev));
      setNickname((prev) => (prev === "" && user?.nickname ? user.nickname : prev));
    }
  }, [user?.id, user?.display_name, user?.nickname]);

  useEffect(() => {
    const cid = String(clanData?.current?.id || "");
    if (!cid) {
      setClanChatItems([]);
      lastClanChatIdRef.current = 0;
      return;
    }
    setClanChatItems([]);
    lastClanChatIdRef.current = 0;
    fetchClanChat();
  }, [clanData?.current?.id, fetchClanChat]);
  const badgeRaw = String(gamification?.badge || "Rookie");
  const badgeLabel = useCallback(
    (raw) =>
      ({
        Rookie: t("rewardsPage.badgeRookie"),
        "Rising Hunter": t("rewardsPage.badgeRisingHunter"),
        "Pro Hunter": t("rewardsPage.badgeProHunter"),
        "Elite Hunter": t("rewardsPage.badgeEliteHunter"),
        Legend: t("rewardsPage.badgeLegend"),
      }[String(raw || "")] || raw),
    [t]
  );
  const missionTitle = useCallback(
    (m) =>
      ({
        m1: t("rewardsPage.missionM1"),
        m2: t("rewardsPage.missionM2"),
        m3: t("rewardsPage.missionM3"),
      }[String(m?.id || "")] || m?.title || ""),
    [t]
  );
  const timelineTypeLabel = useCallback(
    (type) =>
      ({
        claim_submitted: t("rewardsPage.timelineClaimSubmitted"),
        claim_pending: t("rewardsPage.timelineClaimPending"),
        claim_approved: t("rewardsPage.timelineClaimApproved"),
        claim_rejected: t("rewardsPage.timelineClaimRejected"),
        reward_added: t("rewardsPage.timelineRewardAdded"),
        withdraw_requested: t("rewardsPage.timelineWithdrawRequested"),
        withdraw_completed: t("rewardsPage.timelineWithdrawCompleted"),
        withdraw_rejected: t("rewardsPage.timelineWithdrawRejected"),
        season_reward: t("rewardsPage.timelineSeasonReward"),
        admin_notification: t("rewardsPage.adminNotification"),
        referral_bonus: t("rewardsPage.referralBonus"),
        hunter_of_day: t("rewardsPage.hunterOfDayNotif"),
        lucky_box: t("rewardsPage.luckyBox"),
      }[String(type || "")] || type),
    [t]
  );

  const notificationDisplayText = useCallback(
    (item) => {
      const typesWithCustomTitle = ["admin_notification", "referral_bonus", "hunter_of_day", "lucky_box"];
      if (typesWithCustomTitle.includes(String(item?.type || "")) && item?.title) {
        return item.title;
      }
      return timelineTypeLabel(item?.type) || item?.title || "";
    },
    [timelineTypeLabel]
  );
  const statusLabel = useCallback(
    (status) =>
      ({
        approved: t("rewardsPage.statusApproved"),
        rejected: t("rewardsPage.statusRejected"),
        pending: t("rewardsPage.statusPending"),
        paid: t("rewardsPage.statusPaid"),
      }[String(status || "").toLowerCase()] || status),
    [t]
  );

  const createClan = async () => {
    if (!token || clanName.trim().length < 3) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/rewards/clan/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: clanName.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("rewardsPage.clanCreateFailed"));
      setClanName("");
      setMessage(t("rewardsPage.clanCreated"));
      await fetchDashboard();
      await fetchLeaderboard();
    } catch (err) {
      setError(err?.message || t("rewardsPage.clanCreateFailed"));
    }
  };

  const joinClan = async (code) => {
    const inviteCode = ((code ?? joinCode) || "").trim();
    if (!token || inviteCode.length < 2) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/rewards/clan/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invite_code: inviteCode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("rewardsPage.clanJoinFailed"));
      setJoinCode("");
      setShowJoinClanModal(false);
      setClanSearchQuery("");
      setMessage(payload?.pending ? t("rewardsPage.clanJoinRequestSent") : t("rewardsPage.clanJoined"));
      await fetchDashboard();
      await fetchLeaderboard();
    } catch (err) {
      setError(err?.message || t("rewardsPage.clanJoinFailed"));
    }
  };

  const leaveClan = async () => {
    if (!token) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/rewards/clan/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("rewardsPage.clanLeaveFailed"));
      setMessage(t("rewardsPage.clanLeft"));
      await fetchDashboard();
      await fetchLeaderboard();
    } catch (err) {
      setError(err?.message || t("rewardsPage.clanLeaveFailed"));
    }
  };

  const deleteClan = async () => {
    if (!token || !window.confirm(t("rewardsPage.deleteClanConfirm"))) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/rewards/clan/delete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("rewardsPage.clanDeleteFailed"));
      setMessage(t("rewardsPage.clanDeleted"));
      await fetchDashboard();
      await fetchLeaderboard();
    } catch (err) {
      setError(err?.message || t("rewardsPage.clanDeleteFailed"));
    }
  };

  const kickMember = async (memberId) => {
    if (!token || !memberId) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/rewards/clan/kick`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ member_id: memberId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("rewardsPage.clanKickFailed"));
      setMessage(t("rewardsPage.clanMemberKicked"));
      await fetchDashboard();
      await fetchLeaderboard();
    } catch (err) {
      setError(err?.message || t("rewardsPage.clanKickFailed"));
    }
  };

  const setClanPrivacy = async (isPrivate) => {
    if (!token) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/rewards/clan/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_private: isPrivate }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("rewardsPage.clanSettingsFailed"));
      setMessage(t("rewardsPage.clanSettingsSaved"));
      await fetchDashboard();
    } catch (err) {
      setError(err?.message || t("rewardsPage.clanSettingsFailed"));
    }
  };

  const approveJoinRequest = async (userId) => {
    if (!token || !userId) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/rewards/clan/join/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("rewardsPage.clanApproveFailed"));
      setMessage(t("rewardsPage.clanRequestApproved"));
      await fetchDashboard();
      await fetchLeaderboard();
    } catch (err) {
      setError(err?.message || t("rewardsPage.clanApproveFailed"));
    }
  };

  const rejectJoinRequest = async (userId) => {
    if (!token || !userId) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/rewards/clan/join/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("rewardsPage.clanRejectFailed"));
      setMessage(t("rewardsPage.clanRequestRejected"));
      await fetchDashboard();
    } catch (err) {
      setError(err?.message || t("rewardsPage.clanRejectFailed"));
    }
  };

  const copyInviteCode = () => {
    const code = clanData?.current?.invite_code || "";
    if (!code) return;
    try {
      navigator.clipboard.writeText(code);
      setMessage(t("rewardsPage.inviteCodeCopied"));
      window.setTimeout(() => setMessage(""), 2000);
    } catch {
      setMessage(t("rewardsPage.inviteCodeCopyFailed"));
    }
  };

  const copyReferralCode = () => {
    if (!referralCode) return;
    try {
      navigator.clipboard.writeText(referralCode);
      setMessage(t("rewardsPage.shareSuccess"));
      window.setTimeout(() => setMessage(""), 2000);
    } catch {
      setMessage(t("rewardsPage.inviteCodeCopyFailed"));
    }
  };

  const shareAchievement = (text) => {
    const shareText = text || `${user?.display_name || "User"} - ${badgeLabel(badgeRaw)}`;
    const url = window.location.href;
    const full = `${shareText}\n${url}`;
    try {
      navigator.clipboard.writeText(full);
      setMessage(t("rewardsPage.shareSuccess"));
      window.setTimeout(() => setMessage(""), 2000);
    } catch {
      setMessage(t("rewardsPage.inviteCodeCopyFailed"));
    }
  };

  const sendClanMessage = async () => {
    if (!token || !clanChatText.trim()) return;
    try {
      const response = await fetch(`${apiBase}/rewards/clan/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: clanChatText.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("rewardsPage.clanChatSendFailed"));
      setClanChatText("");
      await fetchClanChat();
    } catch (err) {
      setError(err?.message || t("rewardsPage.clanChatSendFailed"));
    }
  };

  const createDuel = async (opponentId) => {
    if (!token || !opponentId) return;
    setError("");
    try {
      const response = await fetch(`${apiBase}/rewards/duel/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ opponent_id: opponentId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Failed to create duel");
      setMessage("Duel challenge sent!");
      await fetchDashboard();
    } catch (err) {
      setError(err?.message || "Failed");
    }
  };

  const acceptDuel = async (duelId) => {
    if (!token || !duelId) return;
    setError("");
    try {
      const response = await fetch(`${apiBase}/rewards/duel/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ duel_id: duelId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Failed to accept duel");
      setMessage("Duel accepted!");
      await fetchDashboard();
    } catch (err) {
      setError(err?.message || "Failed");
    }
  };

  const submitPrediction = async (clanId, predictedPoints) => {
    if (!token || !clanId || predictedPoints == null) return;
    setError("");
    try {
      const response = await fetch(`${apiBase}/rewards/prediction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clan_id: clanId, predicted_points: Number(predictedPoints) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Failed to submit prediction");
      setMessage("Prediction submitted!");
      await fetchDashboard();
    } catch (err) {
      setError(err?.message || "Failed");
    }
  };

  const addReaction = async (targetUserId, targetType, targetId, reactionType) => {
    if (!token || !targetUserId || !targetId) return;
    try {
      await fetch(`${apiBase}/rewards/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_user_id: targetUserId, target_type: targetType, target_id: targetId, reaction_type: reactionType }),
      });
      await fetchDashboard();
    } catch {
    }
  };

  const updatePersonalGoals = async (goals) => {
    if (!token) return;
    setError("");
    try {
      const response = await fetch(`${apiBase}/rewards/personal-goals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(goals),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Failed");
      setMessage("Goals updated!");
      await fetchDashboard();
    } catch (err) {
      setError(err?.message || "Failed");
    }
  };

  useEffect(() => {
    const lvl = Number(gamification?.level || 1);
    const prev = prevLevelRef.current;
    if (prev > 0 && lvl > prev) {
      try {
        sounds.levelUp();
        fireConfetti();
        window.setTimeout(() => fireConfetti(), 300);
        window.setTimeout(() => fireConfetti(), 600);
      } catch {}
    }
    prevLevelRef.current = lvl;
  }, [gamification?.level]);

  useEffect(() => {
    const prev = Number(prevAvailableRef.current || 0);
    if (available > prev) {
      const delta = available - prev;
      setRewardDelta(delta);
      setBalancePulse(true);
      setShowCelebration(true);
      try {
        fireConfetti();
        window.setTimeout(() => fireConfetti(), 380);
      } catch {
      }
      const timer = window.setTimeout(() => {
        setBalancePulse(false);
        setRewardDelta(0);
        setShowCelebration(false);
      }, 3200);
      prevAvailableRef.current = available;
      return () => window.clearTimeout(timer);
    }
    prevAvailableRef.current = available;
  }, [available]);

  return (
    <main className="container rewards-page pb-16 pt-10">
      <RewardsTour />
      <button
        type="button"
        onClick={() => setNotifOpen((v) => !v)}
        className="rewards-notif-btn fixed right-4 top-24 z-[65] inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs text-white/80 backdrop-blur hover:border-cyan-300/60 hover:text-cyan-200"
      >
        <i className="fa-solid fa-bell w-4" aria-hidden />
        {t("rewardsPage.notificationsButton")} {notifications.length > 0 ? `(${notifications.length})` : ""}
      </button>
      {notifOpen && (
        <aside className="rewards-notif-panel fixed right-4 top-36 z-[65] w-[320px] max-h-[340px] overflow-y-auto rounded-2xl border border-cyan-300/30 bg-slate-900/95 p-3 shadow-xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">{t("rewardsPage.realtimeCenter")}</p>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white"
              onClick={() => setNotifications([])}
            >
              <i className="fa-solid fa-trash-can w-3.5" aria-hidden />
              {t("rewardsPage.clear")}
            </button>
          </div>
          <div className="space-y-2">
            {notifications.length === 0 && (
              <p className="text-xs text-white/50">{t("rewardsPage.noNewNotifications")}</p>
            )}
            {notifications.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-2 animate-in fade-in duration-300">
                <p className="text-sm text-white">{notificationDisplayText(item)}</p>
                <p className="mt-1 text-[11px] text-white/50">{item.time}</p>
              </div>
            ))}
          </div>
        </aside>
      )}
      {showCelebration && rewardDelta > 0 && !showSeasonCelebration && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-[70] -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="rounded-2xl border border-emerald-300/40 bg-emerald-400/15 px-5 py-3 text-center shadow-[0_0_40px_rgba(16,185,129,0.35)] backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/90">
              {t("rewardsPage.celebrationTag")}
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-100">
              {tr("rewardsPage.celebrationBody", { amount: rewardDelta })}
            </p>
          </div>
        </div>
      )}
      {smartNotifClan != null && (
        <div className="fixed left-1/2 top-20 z-[64] -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="rounded-xl border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-center shadow-lg backdrop-blur">
            <p className="text-sm text-cyan-100">
              <i className="fa-solid fa-bolt mr-1.5" aria-hidden />
              {tr("rewardsPage.smartNotifClanClose", { points: smartNotifClan })}
            </p>
          </div>
        </div>
      )}
      {showLuckyWheel && (
        <div className="pointer-events-none fixed inset-0 z-[72] flex items-center justify-center">
          <div className="animate-in fade-in zoom-in-95 duration-300 rounded-3xl border-2 border-amber-400/70 bg-gradient-to-b from-amber-500/30 via-amber-600/25 to-amber-700/30 px-10 py-8 text-center shadow-[0_0_80px_rgba(251,191,36,0.5)] backdrop-blur-xl">
            <div className="mb-4 inline-flex h-20 w-20 animate-spin items-center justify-center rounded-full border-4 border-amber-300/60 border-t-amber-100 bg-amber-400/20">
              <i className="fa-solid fa-gift text-3xl text-amber-200" aria-hidden />
            </div>
            <p className="text-lg font-bold uppercase tracking-[0.35em] text-amber-200">
              {t("rewardsPage.luckyWheelTitle")}
            </p>
            <p className="mt-3 text-3xl font-black text-amber-100">
              +${luckyWheelAmount}
            </p>
            <p className="mt-1 text-sm text-amber-200/90">{t("rewardsPage.luckyWheelSub")}</p>
          </div>
        </div>
      )}
      {showSeasonCelebration && (
        <div className="pointer-events-none fixed inset-0 z-[71] flex items-center justify-center">
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl border-2 border-amber-300/60 bg-gradient-to-b from-amber-400/25 to-amber-600/20 px-8 py-5 text-center shadow-[0_0_60px_rgba(251,191,36,0.4)] backdrop-blur-xl">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-amber-200">
              {t("rewardsPage.seasonCelebrationTag")}
            </p>
            <p className="mt-2 text-lg font-semibold text-amber-100">
              {t("rewardsPage.seasonCelebrationBody")}
            </p>
          </div>
        </div>
      )}
      {showJoinClanModal && (
        <div className="fixed inset-0 z-[68] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowJoinClanModal(false)}>
          <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl border border-cyan-300/30 bg-slate-900/98 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-lg font-semibold text-white">{t("rewardsPage.joinClan")}</h4>
              <button type="button" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => setShowJoinClanModal(false)} aria-label="Close">
                <i className="fa-solid fa-xmark w-5" />
              </button>
            </div>
            <input
              type="text"
              className="input-field mb-3 w-full"
              placeholder={t("rewardsPage.searchClans")}
              value={clanSearchQuery}
              onChange={(e) => setClanSearchQuery(e.target.value)}
            />
            <div className="max-h-[280px] space-y-2 overflow-y-auto">
              {(leaderboard?.clans || [])
                .map((c, origIdx) => ({ clan: c, rank: origIdx + 1 }))
                .filter(({ clan }) => !clanSearchQuery.trim() || String(clan?.name || "").toLowerCase().includes(clanSearchQuery.trim().toLowerCase()))
                .map(({ clan, rank }) => (
                  <div key={clan.id || rank} className="result-card flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        #{rank} {clan.name}
                        {clan.is_private && <span className="ml-1.5 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] text-amber-200">{t("rewardsPage.private")}</span>}
                      </p>
                      <p className="text-xs text-white/60">
                        {tr("rewardsPage.clanMeta", { members: clan.member_count || 0, weekly: clan.weekly_points || 0 })}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary shrink-0 px-3 py-1.5 text-xs"
                      onClick={() => joinClan(clan.invite_code || "")}
                      disabled={!clan.invite_code}
                    >
                      <i className="fa-solid fa-user-plus mr-1.5 w-3.5" aria-hidden />
                      {clan.is_private ? t("rewardsPage.requestToJoin") : t("rewardsPage.joinClan")}
                    </button>
                  </div>
                ))}
              {(leaderboard?.clans || []).filter((c) => !clanSearchQuery.trim() || String(c?.name || "").toLowerCase().includes(clanSearchQuery.trim().toLowerCase())).length === 0 && (
                <p className="py-4 text-center text-sm text-white/50">{t("rewardsPage.noClansMatch")}</p>
              )}
            </div>
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="mb-2 text-xs text-white/50">{t("rewardsPage.orEnterInviteCode")}</p>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder={t("rewardsPage.inviteCode")}
                />
                <button type="button" className="btn-outline shrink-0" onClick={() => joinClan()}>
                  {t("rewardsPage.joinClan")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showInviteModal && clanData?.current?.is_owner && (
        <div className="fixed inset-0 z-[68] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowInviteModal(false)}>
          <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-200 rounded-2xl border border-cyan-300/30 bg-slate-900/98 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-lg font-semibold text-white">{t("rewardsPage.inviteUsers")}</h4>
              <button type="button" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => setShowInviteModal(false)} aria-label="Close">
                <i className="fa-solid fa-xmark w-5" />
              </button>
            </div>
            <p className="mb-3 text-sm text-white/70">{t("rewardsPage.inviteUsersHint")}</p>
            <div className="flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 p-3">
              <code className="flex-1 font-mono text-sm text-cyan-100">{clanData.current.invite_code || "-"}</code>
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-2 px-3 py-1.5 text-sm"
                onClick={() => { copyInviteCode(); setShowInviteModal(false); }}
              >
                <i className="fa-solid fa-copy w-4" aria-hidden />
                {t("rewardsPage.copyInviteCode")}
              </button>
            </div>
          </div>
        </div>
      )}
      <section className="glass-card p-6">
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">{t("rewardsPage.tag")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold text-white">{t("rewardsPage.title")}</h2>
          <span className="rounded-full border border-amber-300/40 bg-amber-300/20 px-3 py-1 text-xs font-semibold text-amber-100">
            {badgeLabel(badgeRaw)}
          </span>
          {userTitle && (
            <span className="rounded-full border border-cyan-300/40 bg-cyan-300/20 px-3 py-1 text-xs font-semibold text-cyan-100">
              {userTitle}
            </span>
          )}
          {activeEvents?.double_reward && (
            <span className="rounded-full border border-fuchsia-300/40 bg-fuchsia-300/20 px-3 py-1 text-xs font-semibold text-fuchsia-100">
              {t("rewardsPage.activeEventDouble")}
            </span>
          )}
          {goldenHour && (
            <span className="rounded-full border border-amber-400/60 bg-amber-400/30 px-3 py-1 text-xs font-semibold text-amber-100 animate-pulse">
              {t("rewardsPage.goldenHour")}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-white/70">
          {tr("rewardsPage.subtitle", { reportReward, minWithdraw })}
        </p>
        <Link to="/transparency" className="mt-2 inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200">
          <i className="fa-solid fa-scale-balanced" aria-hidden />
          {t("nav.transparency")}
        </Link>
        {seasonStory && (
          <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
            <i className="fa-solid fa-book-open mr-2" aria-hidden />
            {seasonStory}
          </p>
        )}
        {hunterOfDay?.is_me && (
          <div className="mt-3 rounded-xl border-2 border-amber-400/60 bg-amber-400/20 px-4 py-3 text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-200">
              <i className="fa-solid fa-trophy mr-2" aria-hidden />
              {t("rewardsPage.hunterOfDay")}
            </p>
            <p className="mt-1 text-lg font-semibold text-amber-100">{t("rewardsPage.hunterOfDayYou")}</p>
          </div>
        )}
        {hunterOfDay && !hunterOfDay.is_me && (
          <p className="mt-2 text-sm text-white/60">
            <i className="fa-solid fa-star mr-1.5" aria-hidden />
            {t("rewardsPage.hunterOfDayToday")}: {hunterOfDay.display_name}
          </p>
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className={`stat-card relative transition-all duration-500 ${balancePulse ? "ring-2 ring-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.35)] scale-[1.02]" : ""}`} data-tour="rewards-balance">
            <p>{t("rewardsPage.available")}</p>
            <h4>${available}</h4>
            {balancePulse && rewardDelta > 0 && (
              <span className="absolute -top-2 right-3 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-bold text-black animate-bounce">
                +${rewardDelta}
              </span>
            )}
          </div>
          <div className="stat-card stat-card--accent">
            <p>{t("rewardsPage.lifetimeEarned")}</p>
            <h4>${Number(user?.lifetime_earned_usd || 0)}</h4>
          </div>
          <div className="stat-card">
            <p>{t("rewardsPage.withdrawn")}</p>
            <h4>${Number(user?.withdrawn_usd || 0)}</h4>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            className="input-field"
            placeholder={t("rewardsPage.displayName")}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <input
            className="input-field"
            placeholder={t("rewardsPage.nickname")}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
          <button className="btn-outline md:col-span-2" onClick={registerUser}>
            {t("rewardsPage.saveProfile")}
          </button>
        </div>
        {referralCode && (
          <div className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-400/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-200">{t("rewardsPage.referralTitle")}</p>
            <p className="mt-1 text-sm text-white/80">{t("rewardsPage.referralHint")}</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-black/30 px-3 py-2 font-mono text-sm text-cyan-100">{referralCode}</code>
              <button type="button" className="btn-primary px-3 py-2 text-sm" onClick={copyReferralCode}>
                <i className="fa-solid fa-copy mr-1.5" aria-hidden />
                {t("rewardsPage.referralCopy")}
              </button>
            </div>
          </div>
        )}
        {loading && <p className="mt-3 text-xs text-white/60">{t("rewardsPage.refreshing")}</p>}
        {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      </section>

      <section className="mt-8 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="stat-card">
          <p>{t("rewardsPage.level")}</p>
          <h4>{Number(gamification?.level || 1)}</h4>
        </div>
        <div className="stat-card stat-card--accent">
          <p>{t("rewardsPage.xp")}</p>
          <h4>{Number(gamification?.xp || 0)}</h4>
        </div>
        <div className="stat-card">
          <p>{t("rewardsPage.league")}</p>
          <h4 className="capitalize">{String(gamification?.league || "bronze")}</h4>
        </div>
        <div className="stat-card">
          <p>{t("rewardsPage.dailyStreak")}</p>
          <h4>{tr("rewardsPage.daysCount", { count: Number(gamification?.streak_days || 0) })}</h4>
        </div>
        <div className="stat-card">
          <p>{t("rewardsPage.trustScore")}</p>
          <h4>{Number(gamification?.trust_score || 0).toFixed(1)}%</h4>
        </div>
        {gamification?.verified && (
          <div className="stat-card border-emerald-400/50 bg-emerald-400/10">
            <p>{t("rewardsPage.verified")}</p>
            <h4><i className="fa-solid fa-check-circle text-emerald-400" /></h4>
          </div>
        )}
      </section>

      {(weekComparison?.this_week != null || weekComparison?.last_week != null) && (
        <section className="mt-6 glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.weekComparison")}</h3>
          <p className="mt-2 text-sm text-white/70">
            {Number(weekComparison.change_pct || 0) >= 0
              ? tr("rewardsPage.weekBetter", { pct: weekComparison.change_pct })
              : tr("rewardsPage.weekWorse", { pct: Math.abs(weekComparison.change_pct || 0) })}
          </p>
          <p className="mt-1 text-xs text-white/50">This week: ${weekComparison.this_week ?? 0} · Last week: ${weekComparison.last_week ?? 0}</p>
        </section>
      )}

      {aiPrediction?.predicted_month_end_usd != null && (
        <section className="mt-6 glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.aiPrediction")}</h3>
          <p className="mt-2 text-sm text-cyan-200">
            {tr("rewardsPage.aiPredictionText", { amount: aiPrediction.predicted_month_end_usd, days: aiPrediction.days_left ?? 0 })}
          </p>
        </section>
      )}

      {Object.keys(dailyRandomChallenge).length > 0 && (
        <section className="mt-6 glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.dailyRandomChallenge")}</h3>
          <p className="mt-2 text-sm text-white/70">{dailyRandomChallenge.title}</p>
          <div className="mt-2 flex items-center gap-2">
            {(() => {
              const target = dailyRandomChallenge.target_reports ?? dailyRandomChallenge.target_streak ?? dailyRandomChallenge.target_today ?? dailyRandomChallenge.target_trust ?? 90;
              const progress = dailyRandomChallenge.progress ?? 0;
              const pct = Math.min(100, (progress / Math.max(1, target)) * 100);
              return (
                <>
                  <div className="h-2 flex-1 rounded-full bg-white/10">
                    <div className={`h-2 rounded-full ${dailyRandomChallenge.done ? "bg-emerald-400" : "bg-cyan-400"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-white/60">{progress}/{target}</span>
                </>
              );
            })()}
          </div>
          {dailyRandomChallenge.done && <p className="mt-2 text-sm text-emerald-300"><i className="fa-solid fa-trophy mr-1" />+${dailyRandomChallenge.bonus_usd ?? 0} bonus!</p>}
        </section>
      )}

      {storyQuests?.length > 0 && (
        <section className="mt-6 glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.storyQuests")}</h3>
          <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2">
            {storyQuests.map((s) => (
              <div key={s.id} className={`result-card ${s.done ? "border-emerald-400/40" : ""}`}>
                <p className="text-sm text-white">{t(`rewardsPage.storyQuest${s.id}`)}</p>
                <p className="text-xs text-white/50">{s.progress}/{s.target} · {t(`rewardsPage.${s.reward_key || "storyQuestReward1"}`)}</p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                  <div className={`h-1.5 rounded-full ${s.done ? "bg-emerald-400" : "bg-cyan-400"}`} style={{ width: `${Math.min(100, (s.progress / Math.max(1, s.target)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {hiddenAchievements?.length > 0 && (
        <section className="mt-6 glass-card p-6 border-amber-400/30">
          <h3 className="text-xl font-semibold text-amber-200">{t("rewardsPage.hiddenAchievements")}</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {hiddenAchievements.map((a) => (
              <span key={a.id} className="rounded-full border border-amber-400/50 bg-amber-400/20 px-3 py-1.5 text-sm text-amber-100">
                <i className="fa-solid fa-lock-open mr-1" />{a.title}
              </span>
            ))}
          </div>
        </section>
      )}

      {luckyDayToday && (
        <section className="mt-6 glass-card p-6 rounded-xl border-2 border-amber-400/50 bg-amber-400/10">
          <h3 className="text-xl font-semibold text-amber-100">
            <i className="fa-solid fa-star mr-2 text-amber-400" aria-hidden />
            {t("rewardsPage.luckyDay")}
          </h3>
          <p className="mt-2 text-sm text-amber-200/90">{t("rewardsPage.luckyDayDesc")}</p>
        </section>
      )}

      <section className="mt-6 glass-card p-6" data-tour="rewards-lucky">
        <h3 className="text-xl font-semibold text-white">
          <i className="fa-solid fa-gift mr-2 text-amber-400" aria-hidden />
          {t("rewardsPage.luckyWheelTitle")}
        </h3>
        <p className="mt-2 text-sm text-white/70">{t("rewardsPage.luckyWheelDesc")}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-400/15 px-4 py-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-300/60 bg-amber-400/30">
              <i className="fa-solid fa-gift text-2xl text-amber-200" aria-hidden />
            </div>
            <div>
              <p className="text-xs text-amber-200/80">{t("rewardsPage.luckyWheelProgress")}</p>
              <p className="text-lg font-bold text-amber-100">
                {luckyWheelProgress.remaining} / {luckyWheelProgress.everyN}
              </p>
              <p className="text-xs text-white/60">
                {tr("rewardsPage.luckyWheelNext", { next: luckyWheelProgress.nextAt })}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs text-white/50">{t("rewardsPage.luckyWheelReward")}</p>
            <p className="text-sm font-semibold text-amber-200">$2 – $15</p>
          </div>
        </div>
      </section>

      <section className="mt-6 glass-card p-6">
        <h3 className="text-xl font-semibold text-white">{t("rewardsPage.dailyWheel")}</h3>
        <p className="mt-2 text-sm text-white/70">{t("rewardsPage.dailyWheelDesc")}</p>
        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1">
              <div className="h-0 w-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-amber-400" />
            </div>
            <div
              className="h-40 w-40 rounded-full border-4 border-amber-400/60 shadow-[0_0_30px_rgba(251,191,36,0.3)] transition-transform duration-[4000ms] ease-out"
              style={{
                transform: `rotate(${dailyWheelRotation}deg)`,
              }}
            >
              <svg viewBox="0 0 100 100" className="h-full w-full">
                {[1, 2, 3, 4, 5, 1, 2, 3].map((amt, i) => {
                  const startAngle = (i / 8) * 360;
                  const endAngle = ((i + 1) / 8) * 360;
                  const rad1 = (startAngle - 90) * (Math.PI / 180);
                  const rad2 = (endAngle - 90) * (Math.PI / 180);
                  const x1 = 50 + 45 * Math.cos(rad1);
                  const y1 = 50 + 45 * Math.sin(rad1);
                  const x2 = 50 + 45 * Math.cos(rad2);
                  const y2 = 50 + 45 * Math.sin(rad2);
                  const d = `M 50 50 L ${x1} ${y1} A 45 45 0 0 1 ${x2} ${y2} Z`;
                  const colors = ["#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f"];
                  return (
                    <path
                      key={i}
                      d={d}
                      fill={colors[(amt - 1) % 5]}
                      fillOpacity={0.85}
                      stroke="rgba(251,191,36,0.5)"
                      strokeWidth={0.5}
                    />
                  );
                })}
                {[1, 2, 3, 4, 5, 1, 2, 3].map((amt, i) => {
                  const angle = ((i + 0.5) / 8) * 360 - 90;
                  const rad = angle * (Math.PI / 180);
                  const x = 50 + 28 * Math.cos(rad);
                  const y = 50 + 28 * Math.sin(rad);
                  return (
                    <text
                      key={`t${i}`}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize={8}
                      fontWeight="bold"
                    >
                      ${amt}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary disabled:opacity-60"
            disabled={dailyWheelSpinning || !token}
            onClick={async () => {
              if (!token) return;
              setDailyWheelSpinning(true);
              setError("");
              setDailyWheelResult(null);
              try {
                const r = await fetch(`${apiBase}/rewards/daily-wheel`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({}),
                });
                const p = await r.json().catch(() => ({}));
                if (!r.ok) {
                  setError(p?.error === "already_spun_today" ? t("rewardsPage.dailyWheelAlready") : p?.error || "Failed");
                  setDailyWheelSpinning(false);
                  return;
                }
                const amount = p.amount_usd ?? 1;
                const segmentIndex = [1, 2, 3, 4, 5, 1, 2, 3].indexOf(amount);
                const fullSpins = 5 * 360;
                const landAngle = 45 * segmentIndex + 22.5;
                const finalRotation = fullSpins + landAngle;
                setDailyWheelRotation((prev) => prev + finalRotation);
                await new Promise((res) => setTimeout(res, 400));
                sounds.success();
                fireConfetti();
                setDailyWheelResult(amount);
                setMessage(tr("rewardsPage.dailyWheelWon", { amount }));
                await fetchDashboard();
                document.querySelector("[data-tour='rewards-balance']")?.scrollIntoView({ behavior: "smooth", block: "center" });
              } catch (e) {
                setError(e?.message || "Failed");
              } finally {
                setDailyWheelSpinning(false);
              }
            }}
          >
            {dailyWheelSpinning ? (
              <>
                <i className="fa-solid fa-spinner fa-spin mr-2" />
                {t("rewardsPage.dailyWheelSpin")}...
              </>
            ) : (
              <>
                <i className="fa-solid fa-rotate mr-2" />
                {t("rewardsPage.dailyWheelSpin")}
              </>
            )}
          </button>
          {dailyWheelResult != null && (
            <div className="text-center">
              <p className="text-lg font-bold text-amber-300">
                {tr("rewardsPage.dailyWheelWon", { amount: dailyWheelResult })}
              </p>
              <p className="mt-1 text-sm text-emerald-300/90">
                {t("rewardsPage.dailyWheelAdded")}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 glass-card p-6">
        <h3 className="text-xl font-semibold text-white">{t("rewardsPage.easterEgg")}</h3>
        <p className="mt-2 text-sm text-white/70">{t("rewardsPage.easterEggDesc")}</p>
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            placeholder="Code"
            className="input-field flex-1 max-w-[180px]"
            id="easter-egg-input"
          />
          <button
            type="button"
            className="btn-outline"
            onClick={async () => {
              const code = document.getElementById("easter-egg-input")?.value?.trim();
              if (!code || !token) return;
              try {
                const r = await fetch(`${apiBase}/rewards/easter-egg`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ code }),
                });
                const p = await r.json().catch(() => ({}));
                if (!r.ok) {
                  setError(p?.error === "already_redeemed" ? t("rewardsPage.easterEggRedeemed") : p?.error === "invalid_code" ? t("rewardsPage.easterEggInvalid") : p?.error || "Failed");
                  return;
                }
                sounds.success();
                setMessage(tr("rewardsPage.easterEggWon", { amount: p.amount_usd ?? 0 }));
                document.getElementById("easter-egg-input").value = "";
                await fetchDashboard();
              } catch (e) {
                setError(e?.message || "Failed");
              }
            }}
          >
            {t("rewardsPage.easterEggRedeem")}
          </button>
        </div>
      </section>

      <section className="mt-6 glass-card p-6">
        <h3 className="text-xl font-semibold text-white">{t("rewardsPage.missions")}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(gamification?.missions || []).map((m) => {
            const progressPct = Math.min(100, Math.round((Number(m.progress || 0) / Math.max(Number(m.target || 1), 1)) * 100));
            return (
              <div key={m.id} className="result-card">
                <p className="text-sm text-white">{missionTitle(m)}</p>
                <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${m.done ? "bg-emerald-400" : "bg-cyan-400"}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-white/60">{m.progress}/{m.target}</p>
              </div>
            );
          })}
        </div>
      </section>

      {Number(gamification?.streak_freeze_remaining || 0) > 0 && (
        <section className="mt-6 glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.streakFreeze")}</h3>
          <p className="mt-2 text-sm text-white/70">{tr("rewardsPage.streakFreezeRemaining", { count: gamification?.streak_freeze_remaining || 0 })}</p>
          <button
            type="button"
            className="btn-outline mt-3"
            onClick={async () => {
              const d = new Date();
              const yesterday = new Date(d);
              yesterday.setDate(yesterday.getDate() - 1);
              const dateStr = yesterday.toISOString().slice(0, 10);
              try {
                const r = await fetch(`${apiBase}/rewards/streak-freeze`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ date: dateStr }),
                });
                const p = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(p?.error || "Failed");
                setMessage("Streak freeze used!");
                await fetchDashboard();
              } catch (e) {
                setError(e?.message || "Failed");
              }
            }}
          >
            Use for yesterday
          </button>
        </section>
      )}

      {progressChart?.labels?.length > 0 && (
        <section className="mt-6 glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.progressChart")}</h3>
          <div className="mt-4 flex h-24 items-end gap-0.5">
            {(progressChart.values || []).slice(-14).map((v, i) => {
              const vals = progressChart.values || [];
              const maxVal = Math.max(1, ...vals.map((x) => Number(x) || 0));
              const pct = maxVal > 0 ? (Number(v) / maxVal) * 80 : 0;
              return (
                <div
                  key={i}
                  className="flex-1 min-w-[4px] rounded-t bg-cyan-400/60 transition-all hover:bg-cyan-400"
                  style={{ height: `${Math.max(4, pct)}%` }}
                  title={`${progressChart.labels?.[(progressChart.labels?.length || 0) - 14 + i] || ""}: $${v}`}
                />
              );
            })}
          </div>
          <p className="mt-2 text-xs text-white/50">Last 14 days · $ earned per day</p>
        </section>
      )}

      {Object.keys(personalGoals || {}).length > 0 && (
        <section className="mt-6 glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.personalGoals")}</h3>
          <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2">
            {["weekly_reports", "monthly_reports", "weekly_usd", "monthly_usd"].map((k) => {
              const g = personalGoals[k];
              if (!g || !g.target) return null;
              const pct = Math.min(100, Math.round((Number(g.progress || 0) / Math.max(Number(g.target || 1), 1)) * 100));
              return (
                <div key={k} className="result-card">
                  <p className="text-sm text-white">{k.replace(/_/g, " ")}: {g.progress}/{g.target}</p>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                    <div className={`h-2 rounded-full ${g.done ? "bg-emerald-400" : "bg-cyan-400"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-6 glass-card p-6">
        <h3 className="text-xl font-semibold text-white">{t("rewardsPage.duelTitle")}</h3>
        {duels?.active ? (
          <div className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-400/10 p-4">
            <p className="text-sm text-white">
              {duels.active.status === "pending"
                ? t("rewardsPage.duelPending") + (duels.active.user_b === user?.id ? " " : "")
                : `Active duel · Scores: ${duels.active.scores?.[duels.active.user_a] || 0} vs ${duels.active.scores?.[duels.active.user_b] || 0}`}
            </p>
            {duels.active.status === "pending" && String(duels.active.user_b) === String(user?.id) && (
              <button type="button" className="btn-primary mt-3" onClick={() => acceptDuel(duels.active.id)}>
                {t("rewardsPage.duelAccept")}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                const id = window.prompt("Enter opponent user ID (or referral code):");
                if (id) createDuel(id.trim());
              }}
            >
              {t("rewardsPage.duelCreate")}
            </button>
          </div>
        )}
      </section>

      <section className="mt-6 glass-card p-6">
        <h3 className="text-xl font-semibold text-white">{t("rewardsPage.predictionTitle")}</h3>
        <p className="mt-2 text-sm text-white/70">{t("rewardsPage.predictionHint")}</p>
        {predictions?.current ? (
          <p className="mt-2 text-sm text-cyan-200">Your prediction: {predictions.current.predicted_points} pts</p>
        ) : clanData?.current?.id && (
          <div className="mt-4 flex gap-2">
            <input
              type="number"
              min="0"
              placeholder="Points"
              className="input-field w-24"
              id="prediction-points"
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const pts = parseInt(document.getElementById("prediction-points")?.value || "0", 10);
                if (pts >= 0) submitPrediction(clanData.current.id, pts);
              }}
            >
              Submit
            </button>
          </div>
        )}
      </section>

      <section className="mt-6 glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">{t("rewardsPage.achievementsTitle")}</h3>
            <p className="mt-1 text-sm text-white/60">{t("rewardsPage.achievementsHint")}</p>
          </div>
          <div className="flex gap-2">
            {(referralCode || user?.id) && (
              <Link
                to={`/profile/${referralCode || user?.id}`}
                className="btn-outline inline-flex items-center gap-2"
              >
                <i className="fa-solid fa-user w-4" aria-hidden />
                {t("rewardsPage.publicProfile")}
              </Link>
            )}
            <button
              type="button"
              className="btn-outline inline-flex items-center gap-2"
              onClick={() => shareAchievement()}
            >
              <i className="fa-solid fa-share-nodes w-4" aria-hidden />
              {t("rewardsPage.shareAchievement")}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-amber-300/40 bg-amber-300/20 px-3 py-1.5 text-sm font-semibold text-amber-100">
            {badgeLabel(badgeRaw)}
          </span>
          {(gamification?.special_badges || []).map((b) => (
            <span key={b} className="rounded-full border border-cyan-300/40 bg-cyan-300/20 px-3 py-1.5 text-sm font-semibold text-cyan-100">
              {badgeLabel(b)}
            </span>
          ))}
          {userTitle && (
            <span className="rounded-full border border-fuchsia-300/40 bg-fuchsia-300/20 px-3 py-1.5 text-sm font-semibold text-fuchsia-100">
              {userTitle}
            </span>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-6" data-tour="rewards-daily">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.dailyChallengeTitle")}</h3>
          <p className="mt-2 text-sm text-white/70">
            {dailyChallenge.done
              ? t("rewardsPage.dailyChallengeDone")
              : tr("rewardsPage.dailyChallengeProgress", {
                  progress: dailyChallenge.progress ?? 0,
                  target: dailyChallenge.target ?? 3,
                  bonus: dailyChallenge.bonus_pct ?? 10,
                })}
          </p>
          <div className="mt-3 h-2 w-full rounded-full bg-white/10">
            <div
              className={`h-2 rounded-full ${dailyChallenge.done ? "bg-emerald-400" : "bg-cyan-400"}`}
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    (Number(dailyChallenge.progress || 0) / Math.max(Number(dailyChallenge.target || 3), 1)) * 100
                  )
                )}%`,
              }}
            />
          </div>
          {dailyChallenge.first_report_done_today && (
            <p className="mt-2 text-xs text-emerald-300">
              <i className="fa-solid fa-check mr-1" aria-hidden />
              {t("rewardsPage.firstReportBonus")}
            </p>
          )}
        </div>
        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.challengeTitle")}</h3>
          <p className="mt-2 text-sm text-white/70">
            {tr("rewardsPage.challengeApproved", {
              count: Number(challenge?.approved_progress || 0),
              target: Number(challenge?.target_approved || 5),
            })}
          </p>
          <p className="mt-1 text-sm text-white/70">
            {tr("rewardsPage.challengeAccuracy", {
              accuracy: Number(challenge?.accuracy || 0).toFixed(1),
              target: Number(challenge?.target_accuracy || 80),
            })}
          </p>
          <div className="mt-3 h-2 w-full rounded-full bg-white/10">
            <div
              className={`h-2 rounded-full ${challenge?.done ? "bg-emerald-400" : "bg-cyan-400"}`}
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    (Number(challenge?.approved_progress || 0) / Math.max(Number(challenge?.target_approved || 5), 1)) *
                      100
                  )
                )}%`,
              }}
            />
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-sm text-white">{t("rewardsPage.verificationQuest")}</p>
            <p className="mt-1 text-xs text-white/60">
              {tr("rewardsPage.verificationProgress", {
                progress: Number(verificationQuest?.progress || 0),
                target: Number(verificationQuest?.target || 4),
                trust: Number(gamification?.trust_score || 0).toFixed(1),
              })}
            </p>
            {verificationQuest?.fast_lane && (
              <p className="mt-2 text-xs font-semibold text-emerald-300">{t("rewardsPage.fastLaneActive")}</p>
            )}
          </div>
        </div>

        <div className="glass-card p-6" data-tour="rewards-clan">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.clanTitle")}</h3>
          {clanData?.current?.id ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-white">{clanData.current.name}</p>
              <p className="text-xs text-white/60">
                {tr("rewardsPage.clanMeta", {
                  members: clanData.current.member_count || 0,
                  weekly: clanData.current.weekly_points || 0,
                })}
              </p>
              {clanRival && (
                <div className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-200/90">{t("rewardsPage.clanRivalTitle")}</p>
                  <p className="mt-1 text-sm text-white">{clanRival.name}</p>
                  <p className="mt-0.5 text-xs text-white/60">{t("rewardsPage.clanRivalHint")}</p>
                  <p className="mt-1 text-xs text-white/50">
                    {tr("rewardsPage.clanMeta", {
                      members: clanRival.member_count || 0,
                      weekly: clanRival.weekly_points || 0,
                    })}
                  </p>
                </div>
              )}
              {clanData.current.is_owner && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn-primary inline-flex items-center gap-2 px-3 py-1.5 text-sm"
                      onClick={() => setShowInviteModal(true)}
                    >
                      <i className="fa-solid fa-user-plus w-4" aria-hidden />
                      {t("rewardsPage.inviteUsers")}
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={!!clanData.current.is_private}
                        onChange={(e) => setClanPrivacy(e.target.checked)}
                        className="h-4 w-4 rounded border-white/30"
                      />
                      <span className="text-xs text-white/80">{t("rewardsPage.clanPrivate")}</span>
                    </label>
                  </div>
                  {(clanData.current.join_requests || []).length > 0 && (
                    <div className="space-y-2 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-200/90">{t("rewardsPage.joinRequests")}</p>
                      {(clanData.current.join_requests || []).map((r) => (
                        <div key={r.user_id} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/15 px-2 py-1.5">
                          <p className="truncate text-sm text-white">{r.display_name || `User ${String(r.user_id).slice(0, 8)}`}</p>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              className="rounded px-2 py-0.5 text-xs text-emerald-300 hover:bg-emerald-400/20"
                              onClick={() => approveJoinRequest(r.user_id)}
                            >
                              <i className="fa-solid fa-check mr-1 w-3" aria-hidden />
                              {t("rewardsPage.approve")}
                            </button>
                            <button
                              type="button"
                              className="rounded px-2 py-0.5 text-xs text-rose-300 hover:bg-rose-400/20"
                              onClick={() => rejectJoinRequest(r.user_id)}
                            >
                              <i className="fa-solid fa-xmark mr-1 w-3" aria-hidden />
                              {t("rewardsPage.reject")}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/80">{t("rewardsPage.clanMembers")}</p>
                {(clanData.current.members || []).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/15 px-2 py-1.5">
                    <p className="truncate text-sm text-white">{m.display_name || `User ${String(m.id).slice(0, 8)}`}</p>
                    {clanData.current.is_owner && String(m.id) !== String(user?.id) && (
                      <button
                        type="button"
                        className="shrink-0 rounded px-2 py-0.5 text-xs text-rose-300 hover:bg-rose-400/20"
                        onClick={() => kickMember(m.id)}
                      >
                        <i className="fa-solid fa-user-minus mr-1 w-3" aria-hidden />
                        {t("rewardsPage.kickMember")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {clanData.current.is_owner && (
                  <button
                    type="button"
                    className="btn-outline inline-flex items-center gap-2 border-rose-400/40 text-rose-300 hover:bg-rose-400/20"
                    onClick={deleteClan}
                  >
                    <i className="fa-solid fa-trash-can w-4" aria-hidden />
                    {t("rewardsPage.deleteClan")}
                  </button>
                )}
                <button type="button" className="btn-outline inline-flex items-center gap-2" onClick={leaveClan}>
                  <i className="fa-solid fa-right-from-bracket w-4" aria-hidden />
                  {t("rewardsPage.leaveClan")}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="input-field"
                  value={clanName}
                  onChange={(event) => setClanName(event.target.value)}
                  placeholder={t("rewardsPage.clanName")}
                />
                <button type="button" className="btn-primary inline-flex items-center justify-center gap-2" onClick={createClan}>
                  <i className="fa-solid fa-plus w-4" aria-hidden />
                  {t("rewardsPage.createClan")}
                </button>
              </div>
              <button
                type="button"
                className="btn-outline inline-flex w-full items-center justify-center gap-2 md:w-auto"
                onClick={() => setShowJoinClanModal(true)}
              >
                <i className="fa-solid fa-user-plus w-4" aria-hidden />
                {t("rewardsPage.joinClan")}
              </button>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {(leaderboard?.clans || []).slice(0, 5).map((clan, idx) => (
              <div key={clan.id || idx} className="result-card flex items-center justify-between">
                <p className="text-sm text-white">
                  #{idx + 1} {clan.name}
                </p>
                <p className="text-xs text-emerald-300">${Number(clan.weekly_points || 0)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.seasonTitle")}</h3>
          <p className="mt-2 text-sm text-white/70">
            {tr("rewardsPage.seasonRange", { start: season?.start_at || "-", end: season?.end_at || "-" })}
          </p>
          {seasonCountdown && (
            <div className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/90">{t("rewardsPage.seasonCountdownLabel")}</p>
              <p className="mt-1 font-mono text-sm font-semibold text-cyan-100">{seasonCountdown}</p>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {(season?.leaderboard || []).slice(0, 6).map((row, idx) => (
              <div key={`${row.id}-${idx}`} className="result-card flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">
                    #{idx + 1} {row.name}
                  </p>
                  <p className="text-xs text-white/60">
                    {tr("rewardsPage.seasonMembers", { members: row.member_count || 0 })}
                  </p>
                </div>
                <p className="text-sm text-emerald-300">${Number(row.season_points || 0)}</p>
              </div>
            ))}
            {(season?.leaderboard || []).length === 0 && (
              <p className="text-sm text-white/50">{t("rewardsPage.noSeasonData")}</p>
            )}
          </div>
          {!!season?.history?.length && (
            <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">{t("rewardsPage.seasonRewardsHistory")}</p>
              {season.history.slice(0, 2).map((h, idx) => (
                <p key={`${h.season_key}-${idx}`} className="mt-1 text-xs text-white/70">
                  {h.season_key} · {(h.top_clans || []).map((c) => `${c.clan_name} #${c.rank}`).join(" | ")}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.clanChatTitle")}</h3>
          {!clanData?.current?.id ? (
            <p className="mt-2 text-sm text-white/60">{t("rewardsPage.clanChatJoinHint")}</p>
          ) : (
            <>
              <div className="mt-3 max-h-[240px] space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-3">
                {clanChatItems.length === 0 && (
                  <p className="text-xs text-white/60">{t("rewardsPage.clanChatEmpty")}</p>
                )}
                {clanChatItems.map((msg) => (
                  <div key={msg.id} className="rounded-lg border border-white/10 bg-black/15 px-2 py-1.5">
                    <p className="text-xs font-semibold text-cyan-200">{msg.display_name}</p>
                    <p className="text-sm text-white/90">{msg.text}</p>
                    <p className="mt-1 text-[10px] text-white/50">{msg.time}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="input-field"
                  value={clanChatText}
                  onChange={(event) => setClanChatText(event.target.value)}
                  placeholder={t("rewardsPage.clanChatPlaceholder")}
                />
                <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={sendClanMessage}>
                  <i className="fa-solid fa-paper-plane w-4" aria-hidden />
                  {t("rewardsPage.send")}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.heatmapTitle")}</h3>
          <div className="mt-4 grid grid-cols-12 gap-1">
            {(heatmap?.hours || []).slice(0, 24).map((v, idx) => (
              <div key={idx} className="rounded bg-white/5 p-1 text-center text-[10px] text-white/70">
                <div
                  className="mx-auto h-8 w-4 rounded"
                  style={{
                    backgroundColor: `rgba(34,211,238,${Math.min(0.9, 0.15 + Number(v || 0) / 10)})`,
                  }}
                />
                {idx}
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1">
            {(heatmap?.weekdays || []).slice(0, 7).map((v, idx) => (
              <div key={`d-${idx}`} className="rounded bg-white/5 p-2 text-center text-xs text-white/70">
                <p>{idx + 1}</p>
                <p className="mt-1 text-cyan-200">{v}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.radarTitle")}</h3>
          <div className="mt-4 flex items-center justify-center">
            <svg width="220" height="220" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="78" fill="none" stroke="rgba(255,255,255,0.15)" />
              <circle cx="100" cy="100" r="52" fill="none" stroke="rgba(255,255,255,0.12)" />
              <circle cx="100" cy="100" r="26" fill="none" stroke="rgba(255,255,255,0.1)" />
              <polygon
                points={radarPolygonPoints(riskRadar)}
                fill="rgba(34,211,238,0.25)"
                stroke="rgba(34,211,238,0.9)"
                strokeWidth="2"
              />
            </svg>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/70">
            <p>{t("rewardsPage.radarBehavior")}: {Number(riskRadar?.behavior || 0)}</p>
            <p>{t("rewardsPage.radarEngagement")}: {Number(riskRadar?.engagement || 0)}</p>
            <p>{t("rewardsPage.radarAge")}: {Number(riskRadar?.account_age || 0)}</p>
            <p>{t("rewardsPage.radarNetwork")}: {Number(riskRadar?.network || 0)}</p>
            <p className="col-span-2">{t("rewardsPage.radarContent")}: {Number(riskRadar?.content || 0)}</p>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
        <form className="glass-card p-6" onSubmit={submitReport} data-tour="rewards-submit">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.reportTitle")}</h3>
          <div className="mt-4 space-y-3">
            <input
              className="input-field"
              placeholder="@username"
              value={form.suspect_username}
              onChange={(event) => setForm((prev) => ({ ...prev, suspect_username: event.target.value }))}
              required
            />
            <select
              className="input-field"
              value={form.platform}
              onChange={(event) => setForm((prev) => ({ ...prev, platform: event.target.value }))}
            >
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="telegram">Telegram</option>
              <option value="x">X / Twitter</option>
            </select>
            <input
              className="input-field"
              placeholder={t("rewardsPage.evidence")}
              value={form.evidence}
              onChange={(event) => setForm((prev) => ({ ...prev, evidence: event.target.value }))}
            />
            <textarea
              className="input-field min-h-[110px]"
              placeholder={t("rewardsPage.note")}
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            />
            <button type="submit" className="btn-primary">
              {t("rewardsPage.submitReport")}
            </button>
          </div>
        </form>

        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.withdrawTitle")}</h3>
          <p className="mt-2 text-sm text-white/60">
            {tr("rewardsPage.withdrawHint", { minWithdraw })}
          </p>
          <div className="mt-4 space-y-3">
            <input
              className="input-field"
              placeholder={t("rewardsPage.wallet")}
              value={walletAddress}
              onChange={(event) => setWalletAddress(event.target.value)}
            />
            <button type="button" className="btn-primary" onClick={requestWithdraw} disabled={!canWithdraw}>
              {t("rewardsPage.submitWithdraw")}
            </button>
            {!canWithdraw && (
              <p className="text-xs text-white/50">
                {tr("rewardsPage.withdrawNeed", { available, minWithdraw })}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 glass-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.leaderboardTitle")}</h3>
          {["weekly", "monthly", "hall_of_fame"].map((tab) => (
            <button
              key={tab}
              className={`rounded-full border px-3 py-1 text-xs transition ${leaderboardTab === tab ? "border-cyan-300 bg-cyan-400/20 text-cyan-100" : "border-white/20 text-white/60 hover:text-white"}`}
              onClick={() => setLeaderboardTab(tab)}
            >
              {tab === "hall_of_fame" ? t("rewardsPage.tabHallOfFame") : tab === "weekly" ? t("rewardsPage.tabWeekly") : t("rewardsPage.tabMonthly")}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {(leaderboard?.[leaderboardTab] || []).slice(0, 10).map((row, idx) => (
            <div key={`${row.user_id}-${idx}`} className="result-card flex items-center justify-between">
              <div>
                <p className="text-sm text-white">
                  #{idx + 1} {row.display_name}
                </p>
                <p className="text-xs text-white/60">
                  {badgeLabel(row.badge)} · {tr("rewardsPage.levelShort", { level: row.level })} · {tr("rewardsPage.trustShort", { trust: Number(row.trust_score || 0).toFixed(1) })}
                </p>
              </div>
              <p className="text-sm text-emerald-300">
                {leaderboardTab === "weekly" && `$${Number(row.weekly_earned_usd || 0)}`}
                {leaderboardTab === "monthly" && `$${Number(row.monthly_earned_usd || 0)}`}
                {leaderboardTab === "hall_of_fame" && `$${Number(row.lifetime_earned_usd || 0)}`}
              </p>
            </div>
          ))}
          {(leaderboard?.[leaderboardTab] || []).length === 0 && (
            <p className="text-sm text-white/50">{t("rewardsPage.noLeaderboardData")}</p>
          )}
        </div>
        {annualHallOfFame?.length > 0 && (
          <div className="mt-6 border-t border-white/10 pt-4">
            <h4 className="text-sm font-semibold text-amber-200/90">Annual Hall of Fame (Top 10)</h4>
            <div className="mt-2 space-y-1">
              {annualHallOfFame.slice(0, 10).map((row, idx) => (
                <div key={`${row.user_id}-${row.year}-${idx}`} className="flex justify-between text-sm text-white/80">
                  <span>#{idx + 1} {row.display_name || row.user_id}</span>
                  <span>${row.lifetime_earned ?? row.lifetime_earned_usd ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-8 glass-card p-6">
        <h3 className="text-xl font-semibold text-white">{t("rewardsPage.timelineTitle")}</h3>
        <div className="mt-4 space-y-3">
          {timeline.length === 0 && <p className="text-sm text-white/50">{t("rewardsPage.noTimelineItems")}</p>}
          {timeline.slice(0, 30).map((item) => (
            <div
              key={`${item.type}-${item.time}-${item.title}`}
              className="result-card border-l-2 border-cyan-400/40 pl-4 animate-in fade-in slide-in-from-left-2 duration-300"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-white">{notificationDisplayText(item)}</p>
                <span className={`badge ${item.status === "approved" || item.status === "paid" ? "badge-success" : item.status === "rejected" ? "badge-danger" : "badge-warning"}`}>
                  {timelineTypeLabel(item.type)}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/60">{item.time}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.claimHistory")}</h3>
          <div className="mt-4 space-y-3">
            {claims.length === 0 && <p className="text-sm text-white/50">{t("rewardsPage.noClaims")}</p>}
            {claims.map((item) => (
              <div key={item.id} className="result-card">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white">@{item.suspect_username}</p>
                  <span className={`badge ${item.status === "approved" ? "badge-success" : item.status === "rejected" ? "badge-danger" : "badge-warning"}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/60">
                  {item.created_at} · {t("rewardsPage.reward")}: ${Number(item.reward_usd || 0)}
                </p>
                {!!item.ai_signals?.length && (
                  <div className="mt-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 p-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                      {t("rewardsPage.explainableTitle")}
                    </p>
                    <div className="mt-1 space-y-1">
                      {item.ai_signals.slice(0, 3).map((sig, idx) => (
                        <p key={`${item.id}-${idx}`} className="text-xs text-white/80">
                          {sig.label}: {Number(sig.value || 0)}%
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {item.review_note && <p className="mt-2 text-xs text-white/70">{t("rewardsPage.adminNote")}: {item.review_note}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold text-white">{t("rewardsPage.withdrawHistory")}</h3>
          <div className="mt-4 space-y-3">
            {withdrawals.length === 0 && <p className="text-sm text-white/50">{t("rewardsPage.noWithdrawals")}</p>}
            {withdrawals.map((item) => (
              <div key={item.id} className="result-card">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white">${Number(item.amount_usd || 0)}</p>
                  <span className={`badge ${item.status === "paid" ? "badge-success" : item.status === "rejected" ? "badge-danger" : "badge-warning"}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/60">{item.created_at}</p>
                {item.review_note && <p className="mt-2 text-xs text-white/70">{t("rewardsPage.adminNote")}: {item.review_note}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default RewardsPanel;
