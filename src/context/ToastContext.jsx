import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, toasts, setToasts }}>
      {children}
      <ToastList toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastList({ toasts }) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-20 left-4 z-[100] flex flex-col gap-2 md:left-6"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2 rounded-xl border border-white/20 bg-n-8/95 px-4 py-3 text-sm text-white shadow-lg backdrop-blur-xl animate-toast-in"
        >
          <i
            className={
              t.type === "success"
                ? "fa-solid fa-circle-check text-emerald-400"
                : "fa-solid fa-circle-info text-cyan-400"
            }
          />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { addToast: () => {} };
  return ctx;
}
