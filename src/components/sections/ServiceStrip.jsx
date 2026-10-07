import { serviceStrip } from "../../data/services";
import ScrollReveal from "../ui/ScrollReveal";

export default function ServiceStrip() {
  return (
    <div className="relative z-20 bg-navy-900 border-t border-white/5">
      <div className="container-brc py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0">
          {serviceStrip.map((item, i) => (
            <ScrollReveal
              key={item.title}
              as="div"
              className={`group flex items-start gap-4 lg:px-8 ${
                i < serviceStrip.length - 1
                  ? "lg:border-r lg:border-white/10"
                  : ""
              }`}
              delay={`delay-${i + 1}`}
            >
              <i
                className={`fa-solid ${item.icon} text-gold text-2xl mt-1 transition-all duration-300 group-hover:scale-110 group-hover:text-gold-light`}
              ></i>
              <div>
                <h3 className="text-white font-semibold text-base mb-1 transition-transform duration-300 group-hover:translate-x-1">
                  {item.title}
                </h3>
                <p className="text-white/50 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </div>
  );
}
