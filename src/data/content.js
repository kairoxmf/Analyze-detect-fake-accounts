import { images } from "./images";

export const stats = [
  { value: 30, suffix: "+", label: "Years Experience" },
  { value: 500, suffix: "+", label: "Projects Completed" },
  { value: 250, suffix: "+", label: "Skilled Professionals" },
  { value: 100, suffix: "%", label: "Safety Commitment" },
];

export const whyChooseUs = [
  { icon: "fa-medal", title: "30+ Years Experience", text: "Three decades of proven excellence in construction." },
  { icon: "fa-shield-halved", title: "Safety First", text: "Uncompromising safety standards on every site." },
  { icon: "fa-users", title: "Experienced Professionals", text: "Skilled teams with deep industry expertise." },
  { icon: "fa-cubes", title: "Quality Materials", text: "Premium materials sourced from trusted suppliers." },
  { icon: "fa-eye", title: "Transparent Process", text: "Clear communication and full visibility at every stage." },
  { icon: "fa-clock", title: "On-Time Delivery", text: "Reliable schedules with consistent on-time completion." },
  { icon: "fa-certificate", title: "Certified Professionals", text: "Licensed, bonded, and fully insured crews." },
  { icon: "fa-handshake", title: "Client-Focused Approach", text: "Your vision drives everything we build." },
];

export const team = [
  { name: "Michael Anderson", role: "Chief Executive Officer", image: images.team[0] },
  { name: "David Carter", role: "Project Director", image: images.team[1] },
  { name: "James Wilson", role: "Senior Construction Manager", image: images.team[2] },
  { name: "Sophia Bennett", role: "Architectural Project Manager", image: images.team[3] },
];

export const blog = [
  {
    id: 1,
    title: "The Future of Sustainable Construction",
    excerpt:
      "Exploring green building practices and sustainable materials shaping the industry's future.",
    date: "Jan 15, 2026",
    category: "Sustainability",
    image: images.blog[0],
  },
  {
    id: 2,
    title: "How Technology Is Changing Construction",
    excerpt:
      "From BIM to drones, technology is revolutionizing how we plan and build.",
    date: "Jan 08, 2026",
    category: "Technology",
    image: images.blog[1],
  },
  {
    id: 3,
    title: "Construction Safety Best Practices",
    excerpt:
      "Essential safety protocols every construction site should implement.",
    date: "Dec 20, 2025",
    category: "Safety",
    image: images.blog[2],
  },
  {
    id: 4,
    title: "Modern Architectural Trends",
    excerpt:
      "The design movements redefining commercial and residential spaces.",
    date: "Dec 12, 2025",
    category: "Architecture",
    image: images.blog[3],
  },
  {
    id: 5,
    title: "Managing Large-Scale Projects",
    excerpt:
      "Strategies for coordinating complex, multi-phase construction programs.",
    date: "Dec 05, 2025",
    category: "Management",
    image: images.blog[4],
  },
  {
    id: 6,
    title: "Building for the Future",
    excerpt:
      "How resilient design principles create structures that last generations.",
    date: "Nov 28, 2025",
    category: "Design",
    image: images.blog[5],
  },
];

export const partners = ["AECOM", "Turner", "DPR Construction", "Clark Construction", "Skanska"];
