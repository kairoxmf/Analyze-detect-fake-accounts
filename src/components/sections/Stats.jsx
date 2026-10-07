import { stats } from "../../data/content";
import { images } from "../../data/images";
import { useCountUp } from "../../hooks/useCountUp";

function StatItem({ value, suffix, label }) {
  const { ref, count } = useCountUp(value);
  return (
    <div className="text-center" ref={ref}>
      <div className="font-display font-extrabold text-4xl lg:text-5xl text-gold mb-2">
        {count}
        {suffix}
      </div>
      <div className="text-white/70 text-sm font-medium uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

export default function Stats() {
  return (
    <section className="relative py-20 lg:py-28 overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={images.statsBg}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-navy-950/90" />
      </div>
      <div className="container-brc relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <StatItem key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
}
