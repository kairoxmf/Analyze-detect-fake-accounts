import { useState } from "react";
import { site } from "../../data/site";
import ScrollReveal from "../ui/ScrollReveal";
import SectionLabel from "../ui/SectionLabel";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-navy-900 outline-none transition-all duration-300 focus:border-gold focus:bg-white";

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    projectType: "",
    location: "",
    budget: "",
    details: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const reset = () => {
    setSubmitted(false);
    setForm({
      name: "",
      email: "",
      phone: "",
      company: "",
      projectType: "",
      location: "",
      budget: "",
      details: "",
    });
  };

  const contactItems = [
    {
      icon: "fa-phone",
      label: "Phone",
      value: site.phone,
      href: `tel:${site.phone.replace(/[^\d]/g, "")}`,
    },
    {
      icon: "fa-envelope",
      label: "Email",
      value: site.email,
      href: `mailto:${site.email}`,
    },
    {
      icon: "fa-location-dot",
      label: "Address",
      value: site.address,
    },
  ];

  return (
    <section id="contact" className="py-20 lg:py-28 bg-cream">
      <div className="container-brc">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left: info */}
          <div>
            <ScrollReveal>
              <SectionLabel>GET IN TOUCH</SectionLabel>
            </ScrollReveal>
            <ScrollReveal delay="delay-1">
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-navy-900 mt-4 mb-6 leading-tight">
                Start Your Project With Us.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay="delay-2">
              <p className="text-navy-600 text-lg mb-8 max-w-md">
                Ready to bring your vision to life? Contact us today for a free
                consultation and quote.
              </p>
            </ScrollReveal>
            <ScrollReveal delay="delay-3">
              <div className="space-y-4">
                {contactItems.map((item) => {
                  const Tag = item.href ? "a" : "div";
                  return (
                    <Tag
                      key={item.label}
                      href={item.href}
                      className="flex items-center gap-4 group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-navy-900 group-hover:bg-gold flex items-center justify-center transition-all duration-300 shrink-0">
                        <i
                          className={`fa-solid ${item.icon} text-gold group-hover:text-navy-900 transition-colors duration-300`}
                        ></i>
                      </div>
                      <div>
                        <div className="text-xs text-navy-400 uppercase tracking-wider">
                          {item.label}
                        </div>
                        <div className="text-navy-900 font-semibold">
                          {item.value}
                        </div>
                      </div>
                    </Tag>
                  );
                })}
              </div>
            </ScrollReveal>
          </div>

          {/* Right: form */}
          <ScrollReveal delay="delay-2">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              {submitted ? (
                <div className="flex flex-col items-center justify-center text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-6">
                    <i className="fa-solid fa-check text-gold text-2xl"></i>
                  </div>
                  <h3 className="font-display font-bold text-xl text-navy-900 mb-2">
                    Thank You!
                  </h3>
                  <p className="text-navy-600 text-sm max-w-xs">
                    Your quote request has been received. We'll get back to you
                    within 24 hours.
                  </p>
                  <button onClick={reset} className="btn-outline-dark mt-6">
                    Send Another Request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-navy-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        required
                        className={inputClass}
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-navy-700 mb-2">
                        Email *
                      </label>
                      <input
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        required
                        className={inputClass}
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-navy-700 mb-2">
                        Phone
                      </label>
                      <input
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="(800) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-navy-700 mb-2">
                        Company
                      </label>
                      <input
                        name="company"
                        value={form.company}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="Company name"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-navy-700 mb-2">
                        Project Type
                      </label>
                      <select
                        name="projectType"
                        value={form.projectType}
                        onChange={handleChange}
                        className={inputClass}
                      >
                        <option value="">Select type</option>
                        <option>Commercial Construction</option>
                        <option>Residential Construction</option>
                        <option>Industrial Construction</option>
                        <option>Renovation & Remodeling</option>
                        <option>Construction Management</option>
                        <option>General Contracting</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-navy-700 mb-2">
                        Project Location
                      </label>
                      <input
                        name="location"
                        value={form.location}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="City, State"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-navy-700 mb-2">
                      Estimated Budget
                    </label>
                    <select
                      name="budget"
                      value={form.budget}
                      onChange={handleChange}
                      className={inputClass}
                    >
                      <option value="">Select budget</option>
                      <option>Under $100K</option>
                      <option>$100K - $500K</option>
                      <option>$500K - $1M</option>
                      <option>$1M - $5M</option>
                      <option>$5M+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-navy-700 mb-2">
                      Project Details
                    </label>
                    <textarea
                      name="details"
                      value={form.details}
                      onChange={handleChange}
                      rows={4}
                      className={inputClass}
                      placeholder="Tell us about your project..."
                    ></textarea>
                  </div>
                  <button type="submit" className="btn-gold w-full">
                    Request a Quote{" "}
                    <i className="fa-solid fa-arrow-right text-xs"></i>
                  </button>
                </form>
              )}
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
