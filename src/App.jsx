import Header from "./components/layout/Header";
import Hero from "./components/sections/Hero";
import ServiceStrip from "./components/sections/ServiceStrip";
import Projects from "./components/sections/Projects";
import About from "./components/sections/About";
import Services from "./components/sections/Services";
import Industries from "./components/sections/Industries";
import WhyChooseUs from "./components/sections/WhyChooseUs";
import Stats from "./components/sections/Stats";
import CTA from "./components/sections/CTA";
import TrustedPartners from "./components/sections/TrustedPartners";
import Team from "./components/sections/Team";
import Blog from "./components/sections/Blog";
import Contact from "./components/sections/Contact";
import Footer from "./components/layout/Footer";

export default function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-gold focus:text-navy-900 focus:rounded focus:font-semibold"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <ServiceStrip />
        <Projects />
        <About />
        <Services />
        <Industries />
        <WhyChooseUs />
        <Stats />
        <CTA />
        <TrustedPartners />
        <Team />
        <Blog />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
