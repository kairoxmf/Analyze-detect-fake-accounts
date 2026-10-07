export default function SectionLabel({ children, className = "" }) {
  return (
    <span
      className={`inline-block text-xs font-semibold uppercase tracking-[0.2em] text-gold ${className}`}
    >
      {children}
    </span>
  );
}
