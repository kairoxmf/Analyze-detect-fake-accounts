import { whyChooseUs } from "../../data/content";
import ScrollReveal from "../ui/ScrollReveal";
import SectionLabel from "../ui/SectionLabel";

export default function WhyChooseUs() {
  return (
    <section id="why-us" className="py-20 lg:py-28 bg-white">
      <div className="container-brc">
        <div className="text-center mb-16">
          <ScrollReveal>
            <SectionLabel>WHY CHOOSE US</SectionLabel>
          </ScrollReveal>
          <ScrollReveal delay="delay-1">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-navy-900 mt-4 leading-tight">
              Built on Experience.
              <br />
              Driven by Excellence.
            </h2>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {whyChooseUs.map((feature, i) => (
            <ScrollReveal
              key={feature.title}
              className="group p-6 rounded-xl border border-gray-100 hover:border-gold/30 hover:shadow-lg transition-all duration-300 bg-white"
              delay={`delay-${(i % 4) + 1}`}
            >
              <div className="w-14 h-14 rounded-xl bg-navy-900 group-hover:bg-gold flex items-center justify-center mb-5 transition-all duration-300">
                <i className={`fa-solid ${feature.icon} text-gold group-hover:text-navy-900 text-xl transition-colors duration-300`}></i>
              </div>
              <h3 className="font-display font-bold text-base text-navy-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-navy-600 text-sm leading-relaxed">{feature.text}</p>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
