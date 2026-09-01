import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const NotificationsDropdown = ({ apiBase, token }) => {
  const base = apiBase || import.meta.env.VITE_API_URL || "/api";
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !open) return;
    setLoading(true);
    fetch(`${base}/rewards/notifications`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [base, token, open]);

  if (!token) return null;

  return (
    <div className="relative">
      <button
        type="button"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white/80 transition hover:bg-white/10"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <i className="fa-solid fa-bell" />
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/20 bg-n-8/95 py-2 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
              <span className="text-sm font-semibold text-white">Notifications</span>
              <Link to="/rewards" className="text-xs text-cyan-400 hover:underline" onClick={() => setOpen(false)}>
                View all
              </Link>
            </div>
            {loading ? (
              <div className="p-4 text-center text-white/50">
                <i className="fa-solid fa-spinner fa-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="p-4 text-center text-sm text-white/50">No new notifications</div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {items.slice(0, 10).map((n) => (
                  <div key={n.id} className="border-b border-white/5 px-4 py-3 last:border-0">
                    <p className="text-sm text-white/90">{n.title || n.message || "—"}</p>
                    <p className="mt-1 text-xs text-white/50">{n.time || n.created_at ? new Date(n.time || n.created_at).toLocaleString() : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationsDropdown;
