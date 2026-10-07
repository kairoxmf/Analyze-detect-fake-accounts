import { site } from "../../data/site";
import { images } from "../../data/images";

export default function Hero() {
  return (
    <section
      id="home"
      className="relative min-h-[88vh] flex items-center overflow-hidden"
    >
      {/* Background image */}
      <div className="absolute inset-0 hero-img-anim">
        <img
          src={images.hero}
          alt="Modern commercial construction project under development"
          className="w-full h-full object-cover"
          fetchpriority="high"
        />
      </div>

      {/* Gradient overlay — dark on left for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-navy-950/95 via-navy-950/75 to-navy-950/20" />

      {/* Content */}
      <div className="container-brc relative z-10 pt-28 pb-20">
        <div className="max-w-2xl">
          <span
            className="hero-anim block text-sm font-semibold uppercase tracking-[0.2em] text-gold mb-6"
            style={{ animationDelay: "0.1s" }}
          >
            WE BUILD YOUR VISION
          </span>
          <h1
            className="hero-anim font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.1] mb-6"
            style={{ animationDelay: "0.2s" }}
          >
            Building Structures.
            <br />
            <span className="text-gold">Building Trust.</span>
          </h1>
          <p
            className="hero-anim text-lg text-white/80 mb-8 max-w-xl leading-relaxed"
            style={{ animationDelay: "0.3s" }}
          >
            {site.positioning}
          </p>
          <div
            className="hero-anim flex flex-wrap gap-4"
            style={{ animationDelay: "0.4s" }}
          >
            <a href="#services" className="btn-gold">
              Our Services <i className="fa-solid fa-arrow-right text-xs"></i>
            </a>
            <a href="#projects" className="btn-outline-light">
              View Projects <i className="fa-solid fa-arrow-right text-xs"></i>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom fade into service strip */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-navy-900 to-transparent z-[5]" />
    </section>
  );
}
