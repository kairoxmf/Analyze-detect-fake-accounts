// Centralized image system — all URLs in one place for easy editing.
// Pexels images: https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg
// Unsplash images: https://images.unsplash.com/photo-{id}

const px = (id, w = 1600) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;
const un = (id, w = 1600) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export const images = {
  hero: px(18078304, 1920),

  projects: [
    px(17097090), // Metro Office Complex
    px(7031604), // Luxury Villa
    px(2383650), // Global Logistics Warehouse
    px(14367420), // Heritage Building Renovation
    px(20273065), // Modern Healthcare Center
    px(1619660), // Downtown Tower
    px(2383649), // Industrial Manufacturing Facility
    px(8134821), // Luxury Residential Development
  ],

  services: [
    px(1816030), // Commercial Construction
    px(15422346), // Residential Construction
    px(37732218), // Industrial Construction
    un("photo-1568605114967-8130f3a36994"), // Renovation & Remodeling
    px(3818947), // Construction Management
    px(9964624), // General Contracting
  ],

  industries: [
    px(3137050), // Commercial
    px(37692742), // Residential
    px(32716845), // Industrial
    px(38173519), // Healthcare
    px(29214334), // Hospitality
    px(9458996), // Retail
    px(39759040), // Education
    px(14989317), // Infrastructure
  ],

  about: {
    large: px(12314551),
    small: px(11194902),
  },

  team: [
    px(38453564), // Michael Anderson
    px(39974547), // David Carter
    px(37842959), // James Wilson
    px(37118089), // Sophia Bennett
  ],

  cta: px(13319078, 1920),

  blog: [
    un("photo-1615103634730-df8aef6b2ff2"),
    un("photo-1668086342363-b9b712abc810"),
    un("photo-1504307651254-35680f356dfd"),
    un("photo-1615461502558-b6f7296dbe8e"),
    un("photo-1590846406792-0adc7f938f1d"),
    un("photo-1558618666-fcd25c85cd64"),
  ],

  statsBg: px(69483, 1920),
};
