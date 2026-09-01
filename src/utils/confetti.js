/**
 * Minimal confetti burst - no dependency.
 * Call fireConfetti() after analysis/demo complete.
 */
export function fireConfetti() {
  const colors = ["#7c4dff", "#38bdf8", "#f472b6", "#34d399", "#fbbf24"];
  const count = 50;
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.style.cssText = `
      position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:2px;
      background:${colors[i % colors.length]};
      animation:confetti-fall ${1.5 + Math.random()}s ease-out forwards;
      --tx:${(Math.random() - 0.5) * 400}px;
      --ty:${(Math.random() - 0.3) * 300}px;
      --r:${(Math.random() - 0.5) * 720}deg;
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  setTimeout(() => container.remove(), 3000);
}

const style = document.createElement("style");
style.textContent = `
  @keyframes confetti-fall {
    to {
      transform: translate(var(--tx), var(--ty)) rotate(var(--r));
      opacity: 0;
    }
  }
`;
if (!document.getElementById("confetti-style")) {
  style.id = "confetti-style";
  document.head.appendChild(style);
}
