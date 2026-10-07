import { industries } from "../../data/services";
import ScrollReveal from "../ui/ScrollReveal";
import SectionLabel from "../ui/SectionLabel";

export default function Industries() {
  return (
    <section id="industries" className="py-20 lg:py-28 bg-cream">
      <div className="container-brc">
        <div className="text-center mb-16">
          <ScrollReveal>
            <SectionLabel>INDUSTRIES WE SERVE</SectionLabel>
          </ScrollReveal>
          <ScrollReveal delay="delay-1">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-navy-900 mt-4 max-w-3xl mx-auto leading-tight">
              Expertise Across Every Sector
            </h2>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {industries.map((industry, i) => (
            <ScrollReveal
              key={industry.name}
              className="group relative h-56 rounded-xl overflow-hidden cursor-pointer"
              delay={`delay-${(i % 4) + 1}`}
            >
              <img
                src={industry.image}
                alt={industry.name}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/40 to-transparent transition-all duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <i className={`fa-solid ${industry.icon} text-gold text-xl mb-2 block`}></i>
                <h3 className="font-display font-bold text-white text-lg">
                  {industry.name}
                </h3>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
