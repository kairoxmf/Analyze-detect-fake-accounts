import { useEffect, useState, useRef } from "react";

/**
 * Trigger animation when element enters viewport.
 * @param {Object} opts - { threshold: 0.1, rootMargin: '0px' }
 * @returns [ref, inView]
 */
export function useInView(opts = {}) {
  const [inView, setInView] = useState(false);
  const ref = useRef(null);
  const { threshold = 0.1, rootMargin = "0px 0px -40px 0px" } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold, rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);

  return [ref, inView];
}
