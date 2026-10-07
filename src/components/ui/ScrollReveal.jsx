import { useEffect, useRef } from "react";

/**
 * Wrapper component for scroll-triggered reveal animations.
 * Props:
 *   className: base animation class (reveal, reveal-left, reveal-right, reveal-scale, reveal-clip-right, reveal-clip-left)
 *   delay: stagger class (delay-1 .. delay-6)
 *   as: element type (default "div")
 */
export default function ScrollReveal({
  children,
  className = "reveal",
  delay = "",
  as: Tag = "div",
  ...props
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("revealed");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("revealed");
          observer.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`${className} ${delay}`} {...props}>
      {children}
    </Tag>
  );
}
