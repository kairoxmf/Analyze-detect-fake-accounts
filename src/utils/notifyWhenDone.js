/**
 * Show browser notification when analysis completes and tab is in background.
 */
export function maybeNotifyAnalysisDone(title = "Analysis complete", body = "Your results are ready.") {
  if (typeof document === "undefined" || !document.hidden) return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: "/vite.svg" });
    } catch {}
    return;
  }
  if (Notification.permission !== "denied") {
    Notification.requestPermission().then((p) => {
      if (p === "granted") {
        try {
          new Notification(title, { body, icon: "/vite.svg" });
        } catch {}
      }
    });
  }
}
