import { blog } from "../../data/content";
import ScrollReveal from "../ui/ScrollReveal";
import SectionLabel from "../ui/SectionLabel";

export default function Blog() {
  return (
    <section id="blog" className="py-20 lg:py-28 bg-white">
      <div className="container-brc">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <ScrollReveal>
              <SectionLabel>LATEST ARTICLES</SectionLabel>
            </ScrollReveal>
            <ScrollReveal delay="delay-1">
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-navy-900 mt-4 leading-tight">
                Insights & Industry News
              </h2>
            </ScrollReveal>
          </div>
          <ScrollReveal delay="delay-2">
            <a href="#blog" className="btn-outline-dark whitespace-nowrap">
              View All Articles <i className="fa-solid fa-arrow-right text-xs"></i>
            </a>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {blog.map((post, i) => (
            <ScrollReveal
              key={post.id}
              className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 border border-gray-50"
              delay={`delay-${(i % 3) + 1}`}
            >
              <div className="relative h-52 overflow-hidden">
                <img
                  src={post.image}
                  alt={post.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="absolute top-4 left-4 bg-navy-900 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded">
                  {post.category}
                </span>
              </div>
              <div className="p-6">
                <p className="text-navy-400 text-xs mb-3">{post.date}</p>
                <h3 className="font-display font-bold text-base text-navy-900 mb-3 group-hover:text-gold transition-colors leading-snug">
                  {post.title}
                </h3>
                <p className="text-navy-600 text-sm leading-relaxed mb-4">
                  {post.excerpt}
                </p>
                <div className="flex items-center gap-2 text-sm font-semibold text-gold">
                  Read More
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
