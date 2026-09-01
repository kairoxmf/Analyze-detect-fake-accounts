import { useMemo, useState } from "react";
import { useI18n } from "../i18n";

const ClaudeChat = ({ apiBase }) => {
  const { t } = useI18n();
  const [messages, setMessages] = useState([
    { role: "assistant", content: t("aiChat.welcome") },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/chat/claude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || t("aiChat.error"));
      }
      const reply = String(payload?.message || "").trim() || t("aiChat.empty");
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err?.message || t("aiChat.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container ai-chat-page py-10">
      <section className="ai-chat-shell group relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-n-8/85 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(56,189,248,0.18)]">
        <div className="pointer-events-none absolute -left-20 top-1/3 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl transition-transform duration-700 group-hover:scale-125" />
        <div className="pointer-events-none absolute -right-20 -top-10 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl transition-transform duration-700 group-hover:scale-125" />

        <div className="mb-4 animate-in fade-in duration-500">
          <h2 className="text-2xl font-semibold text-white">{t("aiChat.title")}</h2>
          <p className="mt-1 text-sm text-white/70">{t("aiChat.subtitle")}</p>
        </div>

        <div className="ai-chat-messages mb-4 h-[420px] overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-4 transition-colors duration-300 hover:border-cyan-400/30">
          {messages.map((msg, idx) => (
            <div
              key={`${msg.role}-${idx}`}
              className={`mb-3 flex animate-in slide-in-from-bottom-1 fade-in duration-300 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`ai-chat-bubble max-w-[85%] rounded-xl px-3 py-2 text-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                  msg.role === "user"
                    ? "ai-chat-bubble--user bg-cyan-500/20 text-cyan-100 shadow-[0_6px_20px_rgba(34,211,238,0.14)] hover:bg-cyan-500/25"
                    : "ai-chat-bubble--assistant bg-violet-500/20 text-violet-100 shadow-[0_6px_20px_rgba(139,92,246,0.14)] hover:bg-violet-500/25"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
              <span>{t("aiChat.thinking")}</span>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:240ms]" />
            </div>
          )}
        </div>

        {error && (
          <p className="mb-3 rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-300 animate-in fade-in duration-300">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={t("aiChat.placeholder")}
            className="ai-chat-input flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-all duration-300 placeholder:text-white/35 focus:-translate-y-0.5 focus:border-cyan-400/70 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.16)]"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="ai-chat-send rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(34,211,238,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_14px_34px_rgba(34,211,238,0.35)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {t("aiChat.send")}
          </button>
        </div>
      </section>
    </main>
  );
};

export default ClaudeChat;
