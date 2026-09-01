import { useCountUpWhenVisible } from "../hooks/useCountUpWhenVisible";

/**
 * Displays a number that counts up when visible.
 */
export default function CountUp({ value, visible = true, duration = 800, className = "" }) {
  const display = useCountUpWhenVisible(value, visible, duration);
  return <span className={className}>{display}</span>;
}
