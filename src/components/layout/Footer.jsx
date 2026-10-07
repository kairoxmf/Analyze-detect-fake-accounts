import { site } from "../../data/site";

export default function Footer() {
  return (
    <footer className="bg-navy-950 text-white">
      <div className="container-brc py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Col 1: Brand */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <i className="fa-solid fa-building text-gold text-2xl"></i>
              <div className="leading-none">
                <div className="font-display font-extrabold text-lg">{site.name}</div>
                <div className="font-display font-semibold text-[10px] tracking-[0.15em]">
                  {site.nameSecond}
                </div>
              </div>
            </div>
            <p className="text-white/60 text-sm mb-6 leading-relaxed">
              {site.positioning}
            </p>
            <div className="flex items-center gap-3">
              {site.social.map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  aria-label={s.name}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-gold hover:text-navy-900 transition-all duration-300"
                >
                  <i className={`fa-brands fa-${s.icon}`}></i>
                </a>
              ))}
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h3 className="font-display font-semibold text-base mb-6">Quick Links</h3>
            <ul className="space-y-3">
              {site.footerLinks.quickLinks.map((link) => (
                <li key={link.title}>
                  <a
                    href={link.url}
                    className="text-white/60 text-sm hover:text-gold transition-colors"
                  >
                    {link.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Services */}
          <div>
            <h3 className="font-display font-semibold text-base mb-6">Services</h3>
            <ul className="space-y-3">
              {site.footerLinks.services.map((link) => (
                <li key={link.title}>
                  <a
                    href={link.url}
                    className="text-white/60 text-sm hover:text-gold transition-colors"
                  >
                    {link.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Contact + Quote */}
          <div>
            <h3 className="font-display font-semibold text-base mb-6">Contact Us</h3>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-3 text-white/60 text-sm">
                <i className="fa-solid fa-phone text-gold w-4"></i>
                {site.phone}
              </li>
              <li className="flex items-center gap-3 text-white/60 text-sm">
                <i className="fa-solid fa-envelope text-gold w-4"></i>
                {site.email}
              </li>
              <li className="flex items-start gap-3 text-white/60 text-sm">
                <i className="fa-solid fa-location-dot text-gold w-4 mt-1"></i>
                {site.address}
              </li>
            </ul>
            <div className="bg-navy-800 rounded-xl p-5">
              <p className="text-white/80 text-sm mb-4">Ready to start your project?</p>
              <a href="#contact" className="btn-gold w-full">
                Request a Quote
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-footer */}
      <div className="border-t border-white/10">
        <div className="container-brc py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/50 text-sm">
            © 2026 Built Right Construction. All Rights Reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-white/50 text-sm hover:text-gold transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-white/50 text-sm hover:text-gold transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
