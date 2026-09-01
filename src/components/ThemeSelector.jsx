import { useCallback, useEffect, useState } from "react";

const THEMES = [
  { id: "dark", label: "Dark", icon: "fa-moon" },
  { id: "light", label: "Light", icon: "fa-sun" },
  { id: "winter", label: "Winter", icon: "fa-snowflake" },
  { id: "spring", label: "Spring", icon: "fa-leaf" },
  { id: "summer", label: "Summer", icon: "fa-sun" },
  { id: "fall", label: "Fall", icon: "fa-wind" },
  { id: "neon", label: "Neon", icon: "fa-bolt" },
];

const ThemeSelector = ({ value, onChange, compact = false }) => {
  const [open, setOpen] = useState(false);
  const current = THEMES.find((t) => t.id === value) || THEMES[0];

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.dataset.themeOverride = value || "";
    const isDark = ["dark", "winter", "neon"].includes(value) || !value;
    document.documentElement.style.setProperty("color-scheme", isDark ? "dark" : "light");
  }, [value]);

  const handleSelect = useCallback(
    (id) => {
      onChange?.(id);
      setOpen(false);
    },
    [onChange]
  );

  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          aria-label="Select theme"
        >
          <i className={`fa-solid ${current.icon}`} />
          <span>{current.label}</span>
          <i className={`fa-solid fa-chevron-down text-xs transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-xl border border-white/20 bg-slate-900/95 py-1 shadow-xl backdrop-blur">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelect(t.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                    value === t.id ? "bg-cyan-500/20 text-cyan-200" : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  <i className={`fa-solid ${t.icon} w-4`} />
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => handleSelect(t.id)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
            value === t.id
              ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
              : "border-white/20 text-white/70 hover:border-white/40 hover:text-white"
          }`}
        >
          <i className={`fa-solid ${t.icon}`} />
          {t.label}
        </button>
      ))}
    </div>
  );
};

export default ThemeSelector;
