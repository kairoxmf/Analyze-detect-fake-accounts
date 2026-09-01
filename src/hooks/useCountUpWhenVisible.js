import { useEffect, useState, useRef } from "react";

/**
 * Returns a number that counts up from 0 to value when visible becomes true.
 */
export function useCountUpWhenVisible(value, visible, duration = 800) {
  const [display, setDisplay] = useState(0);
  const animatedValueRef = useRef(null);

  useEffect(() => {
    const end = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    if (!visible) {
      setDisplay(end);
      animatedValueRef.current = null;
      return;
    }
    const shouldAnimate = animatedValueRef.current !== end;
    if (shouldAnimate) {
      animatedValueRef.current = end;
      setDisplay(0);
    }
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(Math.round(eased * end));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [visible, value, duration]);

  if (!visible) return Number.isFinite(value) ? Math.round(value) : 0;
  return display;
}
