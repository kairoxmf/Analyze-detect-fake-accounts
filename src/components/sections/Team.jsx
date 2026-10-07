import { team } from "../../data/content";
import ScrollReveal from "../ui/ScrollReveal";
import SectionLabel from "../ui/SectionLabel";

export default function Team() {
  return (
    <section id="team" className="py-20 lg:py-28 bg-cream">
      <div className="container-brc">
        <div className="text-center mb-16">
          <ScrollReveal>
            <SectionLabel>OUR TEAM</SectionLabel>
          </ScrollReveal>
          <ScrollReveal delay="delay-1">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-navy-900 mt-4">
              Meet the Experts
            </h2>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {team.map((member, i) => (
            <ScrollReveal key={member.name} className="group" delay={`delay-${i + 1}`}>
              <div className="relative h-80 rounded-xl overflow-hidden mb-5 shadow-sm group-hover:shadow-xl transition-all duration-500">
                <img
                  src={member.image}
                  alt={member.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
              <h3 className="font-display font-bold text-lg text-navy-900">
                {member.name}
              </h3>
              <p className="text-gold text-sm font-medium">{member.role}</p>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
