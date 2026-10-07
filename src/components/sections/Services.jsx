import { services } from "../../data/services";
import ScrollReveal from "../ui/ScrollReveal";
import SectionLabel from "../ui/SectionLabel";

export default function Services() {
  return (
    <section id="services" className="py-20 lg:py-28 bg-white">
      <div className="container-brc">
        <div className="text-center mb-16">
          <ScrollReveal>
            <SectionLabel>OUR SERVICES</SectionLabel>
          </ScrollReveal>
          <ScrollReveal delay="delay-1">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-navy-900 mt-4 max-w-3xl mx-auto leading-tight">
              Comprehensive Construction Solutions
            </h2>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, i) => (
            <ScrollReveal
              key={service.id}
              className="group relative rounded-xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 h-80"
              delay={`delay-${(i % 3) + 1}`}
            >
              <div className="absolute inset-0">
                <img
                  src={service.image}
                  alt={service.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <i className={`fa-solid ${service.icon} text-gold text-2xl mb-3 block`}></i>
                <h3 className="font-display font-bold text-xl text-white mb-2">
                  {service.title}
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  {service.description}
                </p>
                <div className="flex items-center gap-2 text-sm font-semibold text-gold mt-4">
                  Learn More
                  <i className="fa-solid fa-arrow-right text-xs transition-transform duration-300 group-hover:translate-x-1"></i>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
