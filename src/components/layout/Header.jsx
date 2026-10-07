import { useState, useEffect } from "react";
import { site } from "../../data/site";
import TopBar from "./TopBar";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      <TopBar scrolled={scrolled} />

      <div
        className={`bg-white transition-shadow duration-300 ${
          scrolled ? "shadow-md" : ""
        }`}
      >
        <div className="container-brc">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <a href="#home" className="flex items-center gap-3 shrink-0">
              <i className="fa-solid fa-building text-gold text-2xl"></i>
              <div className="leading-none">
                <div className="font-display font-extrabold text-navy-900 text-lg tracking-tight">
                  {site.name}
                </div>
                <div className="font-display font-semibold text-navy-900 text-[10px] tracking-[0.15em]">
                  {site.nameSecond}
                </div>
              </div>
            </a>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {site.nav.map((item) => (
                <a
                  key={item.title}
                  href={item.url}
                  className="relative px-3 py-2 text-sm font-medium text-navy-700 hover:text-gold transition-colors duration-200 group"
                >
                  {item.title}
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gold scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
                </a>
              ))}
            </nav>

            {/* CTA + mobile toggle */}
            <div className="flex items-center gap-4">
              <a href="#contact" className="btn-gold hidden sm:inline-flex">
                Get a Quote
              </a>
              <button
                className="lg:hidden text-navy-900 text-2xl w-10 h-10 flex items-center justify-center"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle navigation menu"
                aria-expanded={mobileOpen}
              >
                <i className={`fa-solid ${mobileOpen ? "fa-xmark" : "fa-bars"}`}></i>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <nav className="lg:hidden bg-white border-t border-gray-100">
            <div className="container-brc py-4 flex flex-col gap-1">
              {site.nav.map((item) => (
                <a
                  key={item.title}
                  href={item.url}
                  onClick={() => setMobileOpen(false)}
                  className="py-3 px-2 text-sm font-medium text-navy-700 hover:text-gold transition-colors"
                >
                  {item.title}
                </a>
              ))}
              <a
                href="#contact"
                onClick={() => setMobileOpen(false)}
                className="btn-gold mt-2"
              >
                Get a Quote
              </a>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
