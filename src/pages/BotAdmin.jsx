import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n.jsx";

const BotAdmin = () => {
  const { t } = useI18n();
  const [token, setToken] = useState(
    () => localStorage.getItem("admin_token") || ""
  );
  const [config, setConfig] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [supportSessions, setSupportSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportInput, setSupportInput] = useState("");
  const [supportLastId, setSupportLastId] = useState(0);
  const [operatorOnline, setOperatorOnline] = useState(false);
  const apiBase = useMemo(
    () => import.meta.env.VITE_API_URL || "http://localhost:5000",
    []
  );

  const fetchConfig = async (adminToken) => {
    setError("");
    try {
      const response = await fetch(`${apiBase}/bot/config`, {
        headers: { "X-Admin-Token": adminToken },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unauthorized");
      }
      const payload = await response.json();
      setConfig(payload.config);
    } catch (err) {
      setError(err.message || "Failed to load bot config.");
      setConfig(null);
    }
  };

  const fetchLogs = async (adminToken) => {
    try {
      const response = await fetch(`${apiBase}/bot/logs`, {
        headers: { "X-Admin-Token": adminToken },
      });
      if (!response.ok) return;
      const payload = await response.json();
      setLogs(payload.logs || []);
    } catch {
      setLogs([]);
    }
  };

  const saveConfig = async (nextConfig) => {
    setError("");
    try {
      const response = await fetch(`${apiBase}/bot/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token,
        },
        body: JSON.stringify(nextConfig),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unauthorized");
      }
      const payload = await response.json();
      setConfig(payload.config);
    } catch (err) {
      setError(err.message || "Failed to save config.");
    }
  };

  const adminHeaders = {
    "Content-Type": "application/json",
    "X-Admin-Token": token,
  };

  const pingOperator = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/support/operator/ping`, {
        method: "POST",
        headers: { "X-Admin-Token": token },
      });
      if (res.ok) setOperatorOnline(true);
    } catch {
      setOperatorOnline(false);
    }
  };

  const fetchSupportSessions = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${apiBase}/support/operator/sessions`, {
        headers: { "X-Admin-Token": token },
      });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      const sessions = payload.sessions || [];
      setSupportSessions(sessions);
      if (!activeSessionId && sessions.length > 0) {
        setActiveSessionId(sessions[0].id);
      }
    } catch {
      setSupportSessions([]);
    }
  };

  const fetchSupportMessages = async (sessionId, afterId = 0) => {
    if (!token || !sessionId) return;
    try {
      const response = await fetch(
        `${apiBase}/support/operator/session/${sessionId}/messages?after_id=${afterId}`,
        { headers: { "X-Admin-Token": token } }
      );
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      const incoming = Array.isArray(payload.messages) ? payload.messages : [];
      if (afterId === 0) {
        setSupportMessages(incoming);
      } else if (incoming.length > 0) {
        setSupportMessages((prev) => [...prev, ...incoming]);
      }
      if (incoming.length > 0) {
        const maxId = Math.max(...incoming.map((m) => Number(m.id) || 0));
        setSupportLastId((prev) => Math.max(prev, maxId));
      }
    } catch {
      // ignore
    }
  };

  const sendSupportReply = async () => {
    const msg = supportInput.trim();
    if (!msg || !activeSessionId) return;
    setSupportInput("");
    try {
      const response = await fetch(
        `${apiBase}/support/operator/session/${activeSessionId}/message`,
        {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify({ message: msg }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || "Failed to send support message.");
        return;
      }
      const sent = payload?.message;
      if (sent) {
        setSupportMessages((prev) => [...prev, sent]);
        setSupportLastId((prev) => Math.max(prev, Number(sent.id) || 0));
      }
      fetchSupportSessions();
    } catch {
      setError("Failed to send support message.");
    }
  };

  const setSessionStatus = async (status) => {
    if (!activeSessionId) return;
    try {
      await fetch(
        `${apiBase}/support/operator/session/${activeSessionId}/status`,
        {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify({ status }),
        }
      );
      fetchSupportSessions();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (token) {
      fetchConfig(token);
      fetchLogs(token);
      fetchSupportSessions();
      pingOperator();
    }
  }, [token]);

  useEffect(() => {
    if (!token || !activeSessionId) return;
    setSupportMessages([]);
    setSupportLastId(0);
    fetchSupportMessages(activeSessionId, 0);
  }, [token, activeSessionId]);

  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => {
      pingOperator();
      fetchSupportSessions();
      if (activeSessionId) {
        fetchSupportMessages(activeSessionId, supportLastId);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [token, activeSessionId, supportLastId]);

  return (
    <main className="container pb-16 pt-10">
      <section className="glass-card p-6 tilt-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">
              Bot Admin
            </p>
            <h2 className="text-2xl font-semibold text-white">
              {t("botAdmin.title")}
            </h2>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              className="input-field"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={t("admin.token")}
            />
            <button
              className="btn-primary"
              onClick={() => {
                localStorage.setItem("admin_token", token);
                fetchConfig(token);
                fetchLogs(token);
              }}
            >
              {t("botAdmin.load")}
            </button>
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-card p-6 tilt-card">
          <h3 className="text-xl font-semibold text-white">
            {t("botAdmin.botControls")}
          </h3>
          <div className="mt-5 space-y-4">
            <label className="flex items-center justify-between text-sm text-white/70">
              {t("botAdmin.groupMode")}
              <input
                type="checkbox"
                checked={!!config?.group_mode}
                onChange={(event) =>
                  setConfig({ ...config, group_mode: event.target.checked })
                }
              />
            </label>
            <label className="flex items-center justify-between text-sm text-white/70">
              {t("botAdmin.allowMentions")}
              <input
                type="checkbox"
                checked={!!config?.allow_mentions}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    allow_mentions: event.target.checked,
                  })
                }
              />
            </label>
            <label className="flex items-center justify-between text-sm text-white/70">
              {t("botAdmin.defaultLang")}
              <select
                className="input-field max-w-[140px]"
                value={config?.default_lang || "fa"}
                onChange={(event) =>
                  setConfig({ ...config, default_lang: event.target.value })
                }
              >
                <option value="fa">فارسی</option>
                <option value="en">English</option>
              </select>
            </label>
            <button
              className="btn-primary"
              onClick={() => saveConfig(config)}
              disabled={!config}
            >
              {t("botAdmin.save")}
            </button>
          </div>
        </div>

        <div className="glass-card p-6 tilt-card">
          <h3 className="text-xl font-semibold text-white">
            {t("botAdmin.activity")}
          </h3>
          <div className="mt-4 space-y-3">
            {logs.length === 0 && (
              <p className="text-sm text-white/50">{t("botAdmin.noLogs")}</p>
            )}
            {logs.map((item, idx) => (
              <div key={`${item.time}-${idx}`} className="text-sm text-white/70">
                <span className="text-white/40">{item.time}</span> ·{" "}
                <span className="text-white">{item.event}</span>{" "}
                {item.info ? `· ${item.info}` : ""}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-card p-6 tilt-card">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Online Support Sessions</h3>
            <span className={`text-xs ${operatorOnline ? "text-emerald-300" : "text-amber-300"}`}>
              {operatorOnline ? "Operator online" : "Operator reconnecting..."}
            </span>
          </div>
          <div className="mt-4 space-y-2 max-h-[420px] overflow-y-auto">
            {supportSessions.length === 0 && (
              <p className="text-sm text-white/50">No support sessions yet.</p>
            )}
            {supportSessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSessionId(s.id)}
                className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                  activeSessionId === s.id
                    ? "border-cyan-400/60 bg-cyan-500/10"
                    : "border-white/15 bg-white/5 hover:border-white/30"
                }`}
              >
                <p className="text-sm font-medium text-white">
                  {s.name || s.id}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {s.status?.toUpperCase()} · unread {s.unread || 0}
                </p>
                {s.last_message && (
                  <p className="text-xs text-white/50 mt-1 truncate">{s.last_message}</p>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 tilt-card">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Operator Chat</h3>
            <div className="flex gap-2">
              <button className="btn-outline px-3 py-1 text-xs" onClick={() => setSessionStatus("open")}>
                Re-open
              </button>
              <button className="btn-outline px-3 py-1 text-xs" onClick={() => setSessionStatus("closed")}>
                Close
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-2 h-[320px] overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-3">
            {activeSessionId === "" && (
              <p className="text-sm text-white/50">Select a session to start chat.</p>
            )}
            {supportMessages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  m.role === "operator"
                    ? "ml-auto bg-cyan-500/20 text-white"
                    : "mr-auto bg-white/10 text-white/90"
                }`}
              >
                <p>{m.content}</p>
                <p className="mt-1 text-[10px] text-white/45">{m.time}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="input-field flex-1"
              value={supportInput}
              onChange={(e) => setSupportInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendSupportReply()}
              placeholder="Type reply to user..."
              disabled={!activeSessionId}
            />
            <button
              className="btn-primary"
              onClick={sendSupportReply}
              disabled={!activeSessionId || !supportInput.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default BotAdmin;
