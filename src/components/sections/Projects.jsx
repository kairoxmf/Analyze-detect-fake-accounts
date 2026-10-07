import { projects } from "../../data/projects";
import ScrollReveal from "../ui/ScrollReveal";
import SectionLabel from "../ui/SectionLabel";

export default function Projects() {
  return (
    <section id="projects" className="py-20 lg:py-28 bg-cream">
      <div className="container-brc">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <ScrollReveal>
              <SectionLabel>OUR PROJECTS</SectionLabel>
            </ScrollReveal>
            <ScrollReveal delay="delay-1">
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-navy-900 mt-4 leading-tight">
                Built with Precision.
                <br />
                Delivered with Pride.
              </h2>
            </ScrollReveal>
          </div>
          <ScrollReveal delay="delay-2">
            <a href="#contact" className="btn-outline-dark whitespace-nowrap">
              View All Projects <i className="fa-solid fa-arrow-right text-xs"></i>
            </a>
          </ScrollReveal>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {projects.map((project, i) => (
            <ScrollReveal
              key={project.id}
              className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1"
              delay={`delay-${(i % 4) + 1}`}
            >
              {/* Image */}
              <div className="relative h-56 overflow-hidden">
                <img
                  src={project.image}
                  alt={project.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-navy-950/0 group-hover:bg-navy-950/20 transition-all duration-500" />
                <span className="absolute top-4 left-4 bg-gold text-navy-900 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded">
                  {project.category}
                </span>
              </div>
              {/* Content */}
              <div className="p-6">
                <h3 className="font-display font-bold text-lg text-navy-900 mb-4 group-hover:text-gold transition-colors">
                  {project.name}
                </h3>
                <div className="space-y-2 text-sm text-navy-600">
                  <p className="flex items-center gap-2">
                    <i className="fa-solid fa-location-dot text-gold text-xs w-4"></i>
                    {project.location}
                  </p>
                  <p className="flex items-center gap-2">
                    <i className="fa-solid fa-expand text-gold text-xs w-4"></i>
                    {project.area}
                  </p>
                  <p className="flex items-center gap-2">
                    <i className="fa-solid fa-calendar text-gold text-xs w-4"></i>
                    {project.year}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm font-semibold text-navy-900 group-hover:text-gold transition-colors">
                  View Details
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
