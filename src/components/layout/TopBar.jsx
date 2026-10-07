import { site } from "../../data/site";

export default function TopBar({ scrolled }) {
  return (
    <div
      className={`bg-navy-950 text-white/70 text-xs overflow-hidden transition-all duration-300 ${
        scrolled ? "h-0 opacity-0" : "h-10 opacity-100"
      }`}
    >
      <div className="container-brc h-full flex items-center justify-between">
        <div className="hidden md:flex items-center gap-6">
          {site.topBar.left.map((text) => (
            <span key={text} className="flex items-center gap-2 whitespace-nowrap">
              <i className="fa-solid fa-circle-check text-gold text-[10px]"></i>
              {text}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4 ml-auto">
          <a
            href={`tel:${site.phone.replace(/[^\d]/g, "")}`}
            className="flex items-center gap-2 hover:text-gold transition-colors"
          >
            <i className="fa-solid fa-phone text-gold text-[10px]"></i>
            {site.phone}
          </a>
          <div className="hidden md:flex items-center gap-3">
            {site.social.map((s) => (
              <a
                key={s.name}
                href={s.url}
                aria-label={s.name}
                className="hover:text-gold transition-colors"
              >
                <i className={`fa-brands fa-${s.icon}`}></i>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
