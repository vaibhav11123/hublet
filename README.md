<div align="center">

# Hublet

**Real-estate lead matching, done right.**

Buyers describe what they want. Sellers list what they have. A scoring engine matches them — and every match is tracked from first contact to closed deal.

[**Live Demo →**](https://frontend-beta-sooty-87.vercel.app)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](#tech-stack)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](#tech-stack)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](#tech-stack)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](#tech-stack)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](#tech-stack)

</div>

---

## What it does

- **Understands intent, not just filters.** Buyers describe what they want in plain English *and* structured fields (budget, BHK, amenities) — a server-side parser reconciles both into one profile.
- **Scores every match, transparently.** A weighted rule engine (location · budget · size · amenities) ranks every buyer against every property, with a hard location gate so irrelevant matches never leak through.
- **Pulls real inventory.** A scraper pipeline ingests live listings from 99acres and Magicbricks, enriched with locality market intelligence (Exa AI) and nearby points of interest (OpenStreetMap).
- **Tracks the full deal lifecycle.** Leads move through a real state machine — `NEW → ENRICHED → QUALIFIED → NOTIFIED → CONTACTED → CLOSED` — with an audit trail at every step.
- **Gives admins the full picture.** Live analytics on demand/supply by city and BHK, match-quality distributions, seller trust scores, and lead conversion — all server-computed, not static mockups.

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18 · TypeScript · Vite · React Router 7 · Leaflet · Chart.js |
| Backend | Node.js · Express · TypeScript · Prisma |
| Database | MongoDB Atlas |
| Scraper | Python subprocess (Apify / ZenRows / Groq) |
| Enrichment | Exa AI (locality intel) · OpenStreetMap (geocoding, POIs) |
| Hosting | Render (backend) · Vercel (frontend) |

## Quick start

```bash
cd src
chmod +x setup.sh && ./setup.sh

# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173`. Full environment variable reference and deploy instructions: [`docs/technical/DEPLOYMENT.md`](docs/technical/DEPLOYMENT.md).

## Documentation

Everything about how this is built lives in [`docs/technical/`](docs/technical/README.md) — architecture, data model, API reference, matching algorithm, deployment, and a candid list of known issues and design tradeoffs. Start at the index; every doc cross-links to the others.

## Repository structure

```
.
├── src/
│   ├── backend/     Express + Prisma + MongoDB, Python scraper subprocess
│   ├── frontend/     React + Vite
│   └── setup.sh      One-command local setup
├── docs/
│   ├── technical/    Architecture, data model, API reference, deployment, known issues
│   └── Matching_Algorithm_Report.md
└── reports/          Historical snapshots — see reports/README.md
```

---

<div align="center">

See [`docs/technical/README.md`](docs/technical/README.md) for the full technical picture.

</div>
