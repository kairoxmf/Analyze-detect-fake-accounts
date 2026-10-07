import { partners } from "../../data/content";
import ScrollReveal from "../ui/ScrollReveal";

export default function TrustedPartners() {
  return (
    <section className="py-16 bg-white border-y border-gray-100">
      <div className="container-brc">
        <div className="text-center mb-10">
          <ScrollReveal>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-navy-400">
              TRUSTED BY
            </span>
          </ScrollReveal>
          <ScrollReveal delay="delay-1">
            <h2 className="font-display font-bold text-2xl text-navy-900 mt-3">
              Building Strong Relationships
            </h2>
          </ScrollReveal>
        </div>
        <ScrollReveal
          delay="delay-2"
          className="flex flex-wrap items-center justify-center gap-8 lg:gap-16"
        >
          {partners.map((name) => (
            <div
              key={name}
              className="font-display font-bold text-xl lg:text-2xl text-navy-300 hover:text-navy-700 transition-colors duration-300 cursor-default"
            >
              {name}
            </div>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
