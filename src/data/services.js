import { images } from "./images";

export const services = [
  {
    id: 1,
    title: "Commercial Construction",
    icon: "fa-building",
    description:
      "From office towers to retail centers, we deliver commercial spaces built for performance and longevity.",
    image: images.services[0],
  },
  {
    id: 2,
    title: "Residential Construction",
    icon: "fa-house",
    description:
      "Custom homes and residential developments crafted with precision and an eye for detail.",
    image: images.services[1],
  },
  {
    id: 3,
    title: "Industrial Construction",
    icon: "fa-industry",
    description:
      "Warehouses, manufacturing facilities, and distribution centers engineered for efficiency.",
    image: images.services[2],
  },
  {
    id: 4,
    title: "Renovation & Remodeling",
    icon: "fa-hammer",
    description:
      "Breathing new life into existing structures with expert renovation and restoration.",
    image: images.services[3],
  },
  {
    id: 5,
    title: "Construction Management",
    icon: "fa-clipboard-list",
    description:
      "Comprehensive project management ensuring timelines, budgets, and quality standards are met.",
    image: images.services[4],
  },
  {
    id: 6,
    title: "General Contracting",
    icon: "fa-hard-hat",
    description:
      "Full-service contracting with skilled crews, quality materials, and proven processes.",
    image: images.services[5],
  },
];

export const serviceStrip = [
  {
    icon: "fa-building",
    title: "Commercial Construction",
    description: "Office, retail & mixed-use developments",
  },
  {
    icon: "fa-house",
    title: "Residential Construction",
    description: "Custom homes & multi-family units",
  },
  {
    icon: "fa-industry",
    title: "Industrial Construction",
    description: "Warehouses & manufacturing facilities",
  },
  {
    icon: "fa-hammer",
    title: "Renovation & Remodeling",
    description: "Restoration & modernization projects",
  },
];

export const industries = [
  { name: "Commercial", icon: "fa-building", image: images.industries[0] },
  { name: "Residential", icon: "fa-house", image: images.industries[1] },
  { name: "Industrial", icon: "fa-industry", image: images.industries[2] },
  { name: "Healthcare", icon: "fa-hospital", image: images.industries[3] },
  { name: "Hospitality", icon: "fa-hotel", image: images.industries[4] },
  { name: "Retail", icon: "fa-store", image: images.industries[5] },
  { name: "Education", icon: "fa-graduation-cap", image: images.industries[6] },
  { name: "Infrastructure", icon: "fa-road", image: images.industries[7] },
];
