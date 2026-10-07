import { stats } from "../../data/content";
import { images } from "../../data/images";
import { useCountUp } from "../../hooks/useCountUp";
import ScrollReveal from "../ui/ScrollReveal";

function CtaStat({ value, suffix, label }) {
  const { ref, count } = useCountUp(value);
  return (
    <div ref={ref} className="text-center">
      <div className="font-display font-extrabold text-3xl lg:text-4xl text-gold mb-1">
        {count}
        {suffix}
      </div>
      <div className="text-white/60 text-xs uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

export default function CTA() {
  return (
    <section className="relative py-20 lg:py-28 overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={images.cta}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-navy-950/85" />
      </div>

      <div className="container-brc relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <div>
            <ScrollReveal>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white leading-tight mb-6">
                Let's Build Something
                <br />
                Extraordinary Together.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay="delay-1">
              <p className="text-white/70 text-lg mb-8 max-w-lg">
                From concept to completion, we are committed to turning your
                vision into reality.
              </p>
            </ScrollReveal>
            <ScrollReveal delay="delay-2">
              <a href="#contact" className="btn-gold">
                Start Your Project{" "}
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </a>
            </ScrollReveal>
          </div>

          {/* Right: stats */}
          <ScrollReveal delay="delay-3" className="grid grid-cols-2 gap-6">
            {stats.map((stat) => (
              <CtaStat key={stat.label} {...stat} />
            ))}
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
