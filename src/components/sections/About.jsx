import { images } from "../../data/images";
import { site } from "../../data/site";
import ScrollReveal from "../ui/ScrollReveal";
import SectionLabel from "../ui/SectionLabel";

const highlights = [
  { icon: "fa-medal", text: "30+ Years of Excellence" },
  { icon: "fa-shield-halved", text: "Safety First Always" },
  { icon: "fa-users", text: "250+ Skilled Professionals" },
  { icon: "fa-handshake", text: "Client-Focused Approach" },
];

export default function About() {
  return (
    <section id="about" className="py-20 lg:py-28 bg-white overflow-hidden">
      <div className="container-brc">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Images — asymmetric composition */}
          <div className="relative">
            <ScrollReveal className="reveal-clip-right">
              <img
                src={images.about.large}
                alt="Construction professionals at work on site"
                loading="lazy"
                className="w-full h-[420px] lg:h-[480px] object-cover rounded-xl shadow-lg"
              />
            </ScrollReveal>
            <ScrollReveal
              className="reveal-clip-left absolute -bottom-8 -right-4 w-44 h-44 lg:w-60 lg:h-60 rounded-xl overflow-hidden shadow-xl border-4 border-white hidden sm:block"
              delay="delay-3"
            >
              <img
                src={images.about.small}
                alt="Construction project detail"
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </ScrollReveal>
            {/* Gold accent bar */}
            <div className="absolute -top-4 -left-4 w-24 h-24 border-l-4 border-t-4 border-gold rounded-tl-xl hidden lg:block" />
          </div>

          {/* Text content */}
          <div>
            <ScrollReveal>
              <SectionLabel>ABOUT BUILT RIGHT</SectionLabel>
            </ScrollReveal>
            <ScrollReveal delay="delay-1">
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-navy-900 mt-4 mb-6 leading-tight">
                Building More Than Structures.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay="delay-2">
              <p className="text-navy-600 text-lg leading-relaxed mb-8">
                Built Right Construction delivers high-quality commercial,
                residential and industrial construction solutions with a
                commitment to safety, precision and client satisfaction.
              </p>
            </ScrollReveal>
            <ScrollReveal delay="delay-3">
              <div className="grid grid-cols-2 gap-6 mb-8">
                {highlights.map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                      <i className={`fa-solid ${item.icon} text-gold`}></i>
                    </div>
                    <span className="text-navy-700 text-sm font-medium">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollReveal>
            <ScrollReveal delay="delay-4">
              <a href="#contact" className="btn-gold">
                Learn More About Us{" "}
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </a>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
