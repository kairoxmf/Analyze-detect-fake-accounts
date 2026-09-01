import { useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "../i18n.jsx";

const SESSION_KEY = "support_session_id";

const ChatBot = ({ apiBase, theme = "dark" }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY) || "");
  const [lastMessageId, setLastMessageId] = useState(0);
  const [operatorOnline, setOperatorOnline] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, messages, loading]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId;
    const response = await fetch(`${apiBase}/support/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.session_id) {
      throw new Error(payload?.error || t("chat.error"));
    }
    const sid = payload.session_id;
    setSessionId(sid);
    localStorage.setItem(SESSION_KEY, sid);
    setOperatorOnline(!!payload.operator_online);
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [{ role: "assistant", content: t("chat.welcome") }];
    });
    return sid;
  }, [apiBase, sessionId, t]);

  const pullMessages = useCallback(async () => {
    try {
      const sid = await ensureSession();
      const response = await fetch(
        `${apiBase}/support/session/${sid}/messages?after_id=${lastMessageId}`
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      setOperatorOnline(!!payload.operator_online);
      const incoming = Array.isArray(payload.messages) ? payload.messages : [];
      if (incoming.length > 0) {
        const mapped = incoming.map((m) => ({
          role: m.role === "operator" ? "assistant" : "user",
          content: m.content || "",
          id: m.id,
        }));
        setMessages((prev) => [...prev, ...mapped]);
        const maxId = Math.max(...incoming.map((m) => Number(m.id) || 0));
        setLastMessageId((prev) => Math.max(prev, maxId));
      }
    } catch {
      // silent polling failure
    }
  }, [apiBase, ensureSession, lastMessageId]);

  useEffect(() => {
    if (!open) return;
    let timer = null;
    pullMessages();
    timer = setInterval(() => {
      pullMessages();
    }, 2500);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [open, pullMessages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError("");
    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const sid = await ensureSession();
      const response = await fetch(`${apiBase}/support/session/${sid}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || t("chat.error"));
      }
      const msgId = Number(payload?.message?.id || 0);
      if (msgId) {
        setLastMessageId((prev) => Math.max(prev, msgId));
      }
      pullMessages();
    } catch (err) {
      setError(err.message || t("chat.error"));
    } finally {
      setLoading(false);
    }
  };

  const isLight = theme === "light";
  const panelBg = isLight ? "bg-white/95 border-slate-200" : "bg-n-8/95 border-white/15";
  const inputBg = isLight ? "bg-slate-100 text-slate-900" : "bg-white/10 text-white";
  const bubbleUser = isLight
    ? "bg-slate-200 text-slate-900 hover:bg-slate-300/80"
    : "bg-white/15 text-white";
  const bubbleBot = isLight
    ? "bg-slate-100 text-slate-800 border border-slate-200 hover:border-slate-300"
    : "bg-white/10 text-white border border-white/10";

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2">
      {open && (
        <div
          className={`relative flex flex-col w-[min(100vw-2rem,22rem)] max-h-[30rem] rounded-2xl border shadow-xl overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95 ${panelBg}`}
        >
          <div className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.28),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.26),transparent_38%)]" />
          <div className="flex items-center justify-between gap-2 border-b border-inherit px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full animate-pulse ${
                  operatorOnline ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" : "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]"
                }`}
              />
              <span className="font-semibold text-sm">{t("chat.title")}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg transition-all duration-200 hover:bg-black/10 dark:hover:bg-white/10 hover:rotate-90"
                aria-label={t("chat.close")}
              >
                <i className="fa-solid fa-times w-4 h-4" />
              </button>
            </div>
          </div>
          <div
            ref={listRef}
            className="relative flex-1 overflow-y-auto p-3 space-y-3 min-h-[12rem] max-h-[18rem] backdrop-blur-[1px]"
          >
            <p className="text-[11px] text-white/55 px-1">
              {operatorOnline ? t("chat.operatorOnline") : t("chat.operatorOffline")}
            </p>
            {messages.length === 0 && !loading && (
              <p className="text-sm opacity-60 text-center py-4">
                {t("chat.startSupport")}
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[85%]">
                  <div
                    className={`mb-1 text-[10px] uppercase tracking-[0.12em] ${
                      msg.role === "user" ? "text-cyan-300 text-right" : "text-violet-300 text-left"
                    }`}
                  >
                    {msg.role === "user" ? t("chat.userLabel") : t("chat.supportLabel")}
                  </div>
                  <div
                    className={`rounded-xl px-3 py-2 text-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                      msg.role === "user"
                        ? `${bubbleUser} shadow-[0_4px_16px_rgba(56,189,248,0.15)]`
                        : `${bubbleBot} shadow-[0_4px_16px_rgba(124,77,255,0.12)]`
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className={`rounded-xl px-3 py-2 text-sm opacity-90 inline-flex items-center gap-2 ${bubbleBot}`}>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
                  </span>
                  <span>{t("chat.thinking")}</span>
                </div>
              </div>
            )}
            {error && (
              <p className="text-xs text-rose-400 px-2">{error}</p>
            )}
          </div>
          <div className="p-3 border-t border-inherit flex gap-2 bg-black/5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder={t("chat.placeholder")}
              className={`flex-1 rounded-xl px-3 py-2 text-sm outline-none placeholder:opacity-60 border border-transparent transition-all duration-200 focus:border-cyan-400/70 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.12)] ${inputBg}`}
              disabled={loading}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="rounded-xl px-4 py-2 text-sm font-medium bg-gradient-to-r from-purple-500 to-cyan-400 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:opacity-95 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(56,189,248,0.32)] active:translate-y-0"
            >
              {t("chat.send")}
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-cyan-400 to-fuchsia-500 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-[0_0_35px_rgba(124,77,255,0.6)] hover:rotate-6 active:scale-95"
        aria-label={open ? t("chat.close") : t("chat.open")}
      >
        <span className="absolute inset-0 rounded-full animate-ping bg-cyan-400/20" />
        <i className="fa-solid fa-comments w-5 h-5" />
      </button>
    </div>
  );
};

export default ChatBot;
