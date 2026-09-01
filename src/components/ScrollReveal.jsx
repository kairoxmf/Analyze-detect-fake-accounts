import { useInView } from "../hooks/useInView";

/**
 * Wraps children and applies fade-in-up when they enter the viewport.
 */
export function ScrollReveal({ children, className = "", delay = 0 }) {
  const [ref, inView] = useInView({ threshold: 0.08, rootMargin: "0px 0px -30px 0px" });

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
