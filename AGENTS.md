# Built Right Construction — Base44 Dev Environment

## What This App Is
A premium construction company marketing website built with Vite + React + Tailwind CSS.
Single-page site with smooth-scroll navigation, scroll-reveal animations, count-up stats,
and a functional contact/quote form (client-side only, no backend).

## Running The App
```bash
docker compose -f docker-compose.base44.yml up -d
```
- **Vite dev server** runs inside `node:22-slim` on port 5173, mapped to host port 3000.
- `npm install` runs on container startup (dependencies in a named volume).
- Source is bind-mounted — edits hot-reload live.
- No backend, no database, no secrets required.

## Architecture
- `src/App.jsx` — page composition (all sections imported here).
- `src/data/` — centralized content: `site.js` (company info), `images.js` (all image URLs), `projects.js`, `services.js`, `content.js` (team, blog, stats, partners, features).
- `src/components/layout/` — Header (with TopBar), Footer.
- `src/components/sections/` — Hero, ServiceStrip, Projects, About, Services, Industries, WhyChooseUs, Stats, CTA, TrustedPartners, Team, Blog, Contact.
- `src/components/ui/` — ScrollReveal (IntersectionObserver wrapper), SectionLabel, Button.
- `src/hooks/` — useScrollReveal, useCountUp (viewport-triggered animations).

## Images
All image URLs are centralized in `src/data/images.js` using Pexels and Unsplash CDN URLs.
To replace any image, edit the URL in that file. All IDs were verified via curl (HTTP 200).

## Key Config
- `tailwind.config.js` — custom colors: `navy` (#061A33), `gold` (#F2B51D), `cream` (#F7F8FA). Fonts: Inter (body), Montserrat (display).
- `vite.config.js` — `server.host: true`, `allowedHosts: true` for preview environment.
- `index.html` — Google Fonts (Inter + Montserrat), Font Awesome 6 CDN.

## Legacy Files
The repo was originally a "Brainwave/Sentinel" fake-account-detection tool. Old files
(`src/i18n.jsx`, `src/pages/`, `src/components/design/`, `backend/`, `login.html`, etc.)
remain in the repo but are **not imported** by the new app. They can be safely deleted.

## Verification
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200
- All 37 images load from Pexels/Unsplash CDNs (verified).
- 8 project cards, 8 industry cards, 4 team members, 6 blog posts render.
- Contact form submits with client-side success state.
