import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "./i18n";
import Navbar from "./components/Navbar";
import SiteFooter from "./components/SiteFooter";
import SecurityTips from "./components/SecurityTips";
import ChatBot from "./components/ChatBot";
import FirstTimeTour from "./components/FirstTimeTour";
import Home from "./pages/Home";
import Analyze from "./pages/Analyze";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import BotAdmin from "./pages/BotAdmin";
import Login from "./pages/Login";
import Instagram from "./pages/Instagram";
import ClaudeChat from "./pages/ClaudeChat";
import RewardsPanel from "./pages/RewardsPanel";
import UserAuth from "./pages/UserAuth";
import UserPanel from "./pages/UserPanel";
import PublicProfile from "./pages/PublicProfile";
import Transparency from "./pages/Transparency";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Stats from "./pages/Stats";
import FAQ from "./pages/FAQ";
import Changelog from "./pages/Changelog";
import Feedback from "./pages/Feedback";
import Leaderboard from "./pages/Leaderboard";
import MyReports from "./pages/MyReports";
import Compare from "./pages/Compare";
import { ToastProvider } from "./context/ToastContext";
import { fireConfetti } from "./utils/confetti";
import { maybeNotifyAnalysisDone } from "./utils/notifyWhenDone";
import { pushUpload, pushLookup } from "./utils/analysisHistory";

const ExternalRedirect = ({ to }) => {
  useEffect(() => {
    if (!to) return;
    window.location.replace(to);
  }, [to]);
  return null;
};

const ProtectedRoute = ({ token, children }) => {
  if (!token) return <Navigate to="/user/auth" replace />;
  return children;
};

const App = () => {
  const { lang } = useI18n();
  const appRole = import.meta.env.VITE_APP_ROLE || "site";
  const isPortalApp = appRole === "portal";
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorHints, setErrorHints] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [analysisMeta, setAnalysisMeta] = useState({
    fileName: "",
    modelType: "",
    analyzedAt: "",
  });
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("sentinel_theme");
    if (stored) return stored;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
    return "dark";
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const location = useLocation();

  const onToggleTheme = useCallback(
    () => setTheme((prev) => (prev === "light" ? "dark" : "light")),
    []
  );

  const apiBase = useMemo(
    () =>
      import.meta.env.VITE_API_URL ||
      (import.meta.env.DEV ? "/api" : "http://localhost:5000"),
    []
  );
  const adminPortalBase = useMemo(
    () => import.meta.env.VITE_ADMIN_PORTAL_URL || "http://localhost:5180",
    []
  );
  const supportPortalBase = useMemo(
    () => import.meta.env.VITE_SUPPORT_PORTAL_URL || "http://localhost:5181",
    []
  );
  const portalKind = useMemo(
    () => import.meta.env.VITE_PORTAL_KIND || "admin",
    []
  );
  const portalHome = useMemo(
    () =>
      import.meta.env.VITE_PORTAL_HOME ||
      (portalKind === "support" ? "/portal/support" : "/portal/admin"),
    [portalKind]
  );
  const [adminToken, setAdminToken] = useState(
    () => localStorage.getItem("admin_token") || ""
  );
  const [userToken, setUserToken] = useState(
    () => localStorage.getItem("user_token") || ""
  );
  const [currentUser, setCurrentUser] = useState(null);

  const trackUserActivity = useCallback(
    async (event, detail = {}) => {
      if (!userToken) return;
      try {
        await fetch(`${apiBase}/user/activity`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ event, detail }),
        });
      } catch {
      }
    },
    [apiBase, userToken]
  );

  const avgFake = useMemo(() => {
    if (summary?.avg_fake_probability != null) {
      return summary.avg_fake_probability;
    }
    if (!results.length) return null;
    const total =
      results.reduce((acc, r) => acc + (r.fake_probability || 0), 0) /
      results.length;
    return total;
  }, [summary, results]);

  useEffect(() => {
    try {
      localStorage.setItem("sentinel_theme", theme);
    } catch {
    }
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty(
        "color-scheme",
        theme === "light" ? "light" : "dark"
      );
      document.body.dataset.theme = theme;
    }
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const m = new Date().getMonth();
    const season = m >= 2 && m <= 4 ? "spring" : m >= 5 && m <= 7 ? "summer" : m >= 8 && m <= 10 ? "fall" : "winter";
    document.body.dataset.season = season;
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        const modal = document.querySelector("[role='dialog']");
        if (modal) {
          const close = modal.querySelector("[aria-label='Close'], .modal-close, button");
          if (close) close.click();
        }
      }
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        const analyzeLink = document.querySelector("a[href='/analyze']");
        if (analyzeLink) analyzeLink.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const THROTTLE_MS = 40; // smooth tilt, minimal lag
    let raf = null;
    let lastRun = 0;

    const handleMove = (event) => {
      const now = Date.now();
      if (now - lastRun < THROTTLE_MS && raf !== null) return;
      lastRun = now;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const cards = document.querySelectorAll(".tilt-card");
        if (cards.length === 0) {
          raf = null;
          return;
        }
        const x = event.clientX;
        const y = event.clientY;
        cards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          const inside =
            x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
          if (!inside) {
            card.style.setProperty("--rx", "0deg");
            card.style.setProperty("--ry", "0deg");
            card.style.setProperty("--mx", "50%");
            card.style.setProperty("--my", "50%");
            return;
          }
          const cx = (x - rect.left) / rect.width - 0.5;
          const cy = (y - rect.top) / rect.height - 0.5;
          card.style.setProperty("--rx", `${(-cy * 8).toFixed(2)}deg`);
          card.style.setProperty("--ry", `${(cx * 10).toFixed(2)}deg`);
          card.style.setProperty("--mx", `${(cx + 0.5) * 100}%`);
          card.style.setProperty("--my", `${(cy + 0.5) * 100}%`);
        });
        raf = null;
      });
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const handleUpload = useCallback(
    (file) => {
      if (!file) return;
      setLoading(true);
      setError("");
      setErrorHints([]);
      setSelectedUser(null);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);
      const xhr = new XMLHttpRequest();
      const url = `${apiBase}/upload_csv`;

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        } else {
          setUploadProgress((p) => Math.min(p + 10, 90));
        }
      });

      xhr.addEventListener("load", () => {
        setUploadProgress(100);
        if (xhr.status >= 200 && xhr.status < 300) {
          let payload = null;
          try {
            payload = JSON.parse(xhr.responseText);
          } catch {
            setError("Invalid response.");
            setLoading(false);
            setUploadProgress(0);
            return;
          }
          try {
            setResults(payload.results || []);
            setSummary(payload.summary || null);
            setAnalysisMeta({
              fileName: payload?.analysis_meta?.file_name || file.name,
              modelType: payload?.analysis_meta?.model_type || "Model",
              analyzedAt: payload?.analysis_meta?.analyzed_at || "",
            });
            // Prevent non-critical UI effects from showing a fake API error.
            try {
              fireConfetti();
            } catch {}
            try {
              pushUpload(file.name, { rows: (payload.results || []).length });
            } catch {}
            try {
              trackUserActivity("upload_csv", {
                file: file.name,
                rows: (payload.results || []).length,
              });
            } catch {}
            try {
              maybeNotifyAnalysisDone(
                "Analysis complete",
                "Your CSV results are ready."
              );
            } catch {}
            setError("");
            setErrorHints([]);
          } catch {
            setError("Could not apply analysis data.");
          }
        } else {
          try {
            const payload = JSON.parse(xhr.responseText);
            setErrorHints(payload?.suggestions || []);
            setError(payload?.error || "Upload failed.");
          } catch {
            setError("Upload failed.");
          }
        }
        setLoading(false);
        setUploadProgress(0);
      });

      xhr.addEventListener("error", () => {
        setError("Network error.");
        setLoading(false);
        setUploadProgress(0);
      });
      xhr.addEventListener("abort", () => {
        setLoading(false);
        setUploadProgress(0);
      });

      xhr.open("POST", url);
      xhr.send(formData);
    },
    [apiBase, trackUserActivity]
  );

  const handleLookup = useCallback(
    async (username) => {
      if (!username) return;
      setLoading(true);
      setError("");
      setErrorHints([]);

      try {
        const response = await fetch(`${apiBase}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setErrorHints(payload?.suggestions || []);
          throw new Error(payload?.error || "User analysis failed.");
        }

        const payload = await response.json();
        const result =
          payload?.result !== undefined
            ? payload.result
            : payload && payload.result && typeof payload.result === "object"
            ? payload.result
            : payload;
        setSelectedUser(result);
        if (result && username) pushLookup(username.trim(), { isFake: result.is_fake });
        if (result && username) {
          trackUserActivity("lookup_username", {
            username: username.trim(),
            is_fake: !!result.is_fake,
          });
        }
      } catch (err) {
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [apiBase, trackUserActivity]
  );

  const handleDemo = useCallback(async () => {
    setLoading(true);
    setError("");
    setSelectedUser(null);
    try {
      const response = await fetch(`${apiBase}/demo`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Demo load failed.");
      }
      const payload = await response.json();
      setResults(payload.results || []);
      setSummary(payload.summary || null);
      setAnalysisMeta({
        fileName: payload?.analysis_meta?.file_name || "demo",
        modelType: payload?.analysis_meta?.model_type || "Model",
        analyzedAt: payload?.analysis_meta?.analyzed_at || "",
      });
      fireConfetti();
      pushUpload("demo", { rows: (payload.results || []).length });
      trackUserActivity("load_demo", { rows: (payload.results || []).length });
      maybeNotifyAnalysisDone("Demo loaded", "Your demo results are ready.");
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [apiBase, trackUserActivity]);

  const handleLogin = async (token) => {
    if (!token) return false;
    try {
      const response = await fetch(`${apiBase}/admin/summary`, {
        headers: { "X-Admin-Token": token },
      });
      if (!response.ok) return false;
      localStorage.setItem("admin_token", token);
      setAdminToken(token);
      return true;
    } catch {
      return false;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setAdminToken("");
  };

  const fetchCurrentUser = useCallback(async (token) => {
    if (!token) {
      setCurrentUser(null);
      return;
    }
    try {
      const response = await fetch(`${apiBase}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        localStorage.removeItem("user_token");
        setUserToken("");
        setCurrentUser(null);
        return;
      }
      const payload = await response.json();
      setCurrentUser(payload?.user || null);
    } catch {
      setCurrentUser(null);
    }
  }, [apiBase]);

  useEffect(() => {
    if (userToken) fetchCurrentUser(userToken);
    else setCurrentUser(null);
  }, [userToken, fetchCurrentUser]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "user_token") {
        setUserToken(e.newValue || "");
        if (!e.newValue) setCurrentUser(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleUserAuthSuccess = useCallback((token, user) => {
    const prevUserId = currentUser?.id;
    const newUserId = user?.id;
    if (!prevUserId || !newUserId || String(prevUserId) !== String(newUserId)) {
      localStorage.removeItem("reward_display_name");
      localStorage.removeItem("reward_wallet_address");
      localStorage.removeItem("reward_user_id");
    }
    localStorage.setItem("user_token", token);
    setUserToken(token);
    setCurrentUser(user || null);
  }, [currentUser?.id]);

  const handleUserLogout = useCallback(async () => {
    try {
      if (userToken) {
        await fetch(`${apiBase}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${userToken}` },
        });
      }
    } catch {
    } finally {
      localStorage.removeItem("user_token");
      setUserToken("");
      setCurrentUser(null);
    }
  }, [apiBase, userToken]);

  if (isPortalApp) {
    return (
      <ToastProvider>
        <div
          className={
            theme === "light"
              ? "min-h-screen theme-light text-slate-900"
              : "min-h-screen theme-dark text-n-1"
          }
          dir={lang === "fa" || lang === "ar" ? "rtl" : "ltr"}
          style={{ background: "transparent" }}
        >
          <Routes>
            <Route path="/" element={<Navigate to={portalHome} replace />} />
            <Route
              path="/portal/login"
              element={<Login onLogin={handleLogin} redirectTo={portalHome} />}
            />
            <Route
              path="/portal/admin"
              element={
                portalKind === "support" ? (
                  <Navigate to="/portal/support" replace />
                ) : (
                  adminToken ? (
                    <Admin onLogout={handleLogout} />
                  ) : (
                    <Login onLogin={handleLogin} redirectTo={portalHome} />
                  )
                )
              }
            />
            <Route
              path="/portal/support"
              element={
                portalKind === "admin" ? (
                  <Navigate to="/portal/admin" replace />
                ) : (
                  adminToken ? (
                    <BotAdmin />
                  ) : (
                    <Login onLogin={handleLogin} redirectTo={portalHome} />
                  )
                )
              }
            />
            <Route path="*" element={<Navigate to={portalHome} replace />} />
          </Routes>
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
    <div
      className={
        theme === "light"
          ? "min-h-screen theme-light text-slate-900"
          : "min-h-screen theme-dark text-n-1"
      }
      dir={lang === "fa" || lang === "ar" ? "rtl" : "ltr"}
      style={{ background: "transparent" }}
    >
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div
        className="fixed inset-0 h-full w-full pointer-events-none overflow-hidden"
        style={{ zIndex: -2 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-n-8 via-n-9 to-n-8" aria-hidden />
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          title="Background"
        >
          <source src="/videos/galaxy.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="app-grid" />
      <Navbar
        avgFake={avgFake}
        theme={theme}
        onToggleTheme={onToggleTheme}
        currentUser={currentUser}
        onUserLogout={handleUserLogout}
        apiBase={apiBase}
        userToken={userToken}
      />
      <SecurityTips />

      <button
        type="button"
        className="fixed bottom-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-400 to-fuchsia-500 text-xs font-semibold text-white shadow-[0_0_30px_rgba(124,77,255,0.7)] md:hidden"
        onClick={() => {
          const languages = ["fa", "en", "ar", "tr"];
          const currentIndex = Math.max(languages.indexOf(lang), 0);
          const next = languages[(currentIndex + 1) % languages.length];
          try {
            localStorage.setItem("sentinel_lang", next);
          } catch {
          }
          window.location.reload();
        }}
      >
        {lang.toUpperCase()}
      </button>

      <div id="main-content" tabIndex={-1}>
      <Routes>
        <Route path="/" element={<Home apiBase={apiBase} />} />
        <Route
          path="/analyze"
          element={
            <Analyze
              results={results}
              summary={summary}
              loading={loading}
              error={error}
              errorHints={errorHints}
              selectedUser={selectedUser}
              analysisMeta={analysisMeta}
              uploadProgress={uploadProgress}
              onUpload={handleUpload}
              onLookup={handleLookup}
              onLoadDemo={handleDemo}
            />
          }
        />
        <Route path="/instagram" element={<Instagram />} />
        <Route path="/ai-chat" element={<ClaudeChat apiBase={apiBase} />} />
        <Route
          path="/user/auth"
          element={
            <UserAuth apiBase={apiBase} onAuthSuccess={handleUserAuthSuccess} />
          }
        />
        <Route path="/user/forgot-password" element={<ForgotPassword apiBase={apiBase} />} />
        <Route path="/user/reset-password" element={<ResetPassword apiBase={apiBase} />} />
        <Route
          path="/user/panel"
          element={
            <ProtectedRoute token={userToken}>
              <UserPanel
                apiBase={apiBase}
                token={userToken}
                currentUser={currentUser}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rewards"
          element={
            <ProtectedRoute token={userToken}>
              <RewardsPanel apiBase={apiBase} token={userToken} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:identifier"
          element={<PublicProfile apiBase={apiBase} />}
        />
        <Route path="/transparency" element={<Transparency />} />
        <Route path="/stats" element={<Stats apiBase={apiBase} />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/feedback" element={<Feedback apiBase={apiBase} />} />
        <Route path="/leaderboard" element={<Leaderboard apiBase={apiBase} />} />
        <Route path="/compare" element={<Compare apiBase={apiBase} />} />
        <Route
          path="/my-reports"
          element={
            <ProtectedRoute token={userToken}>
              <MyReports apiBase={apiBase} token={userToken} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={<Dashboard summary={summary} results={results} analysisMeta={analysisMeta} />}
        />
        <Route
          path="/portal/login"
          element={
            isPortalApp ? (
              <Login onLogin={handleLogin} />
            ) : (
              <ExternalRedirect to={`${adminPortalBase}/portal/login`} />
            )
          }
        />
        <Route
          path="/portal/admin"
          element={
            isPortalApp ? (
              adminToken ? (
                <Admin onLogout={handleLogout} />
              ) : (
                <Login onLogin={handleLogin} />
              )
            ) : (
              <ExternalRedirect to={`${adminPortalBase}/portal/admin`} />
            )
          }
        />
        <Route
          path="/portal/support"
          element={
            isPortalApp ? (
              adminToken ? (
                <BotAdmin />
              ) : (
                <Login onLogin={handleLogin} />
              )
            ) : (
              <ExternalRedirect to={`${supportPortalBase}/portal/support`} />
            )
          }
        />
      </Routes>
      </div>

      <SiteFooter />
      <ChatBot apiBase={apiBase} theme={theme} />
      {location.pathname === "/analyze" && <FirstTimeTour />}
    </div>
    </ToastProvider>
  );
};

export default App;
