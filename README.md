# Hublet — Real Estate Lead Matching Platform

A real-estate lead-matching and market-intelligence platform: buyers describe what they're looking for (structured filters plus free-text intent), sellers list properties, and a rule-based matching engine scores every buyer against every property to surface ranked matches that progress through a lead pipeline.

---

## Project Overview

- Buyer intent capture (structured + free-text, parsed server-side)
- Seller & property management, including a scraper pipeline for real listings
- Rule-based matching with weighted scoring (location/budget/size/amenities)
- Lead lifecycle state machine with a full audit trail
- Admin analytics dashboards
- REST API (Express + Prisma + MongoDB) + React frontend

**For complete technical documentation — architecture, data model, API reference, deployment, known issues — see [`docs/technical/README.md`](docs/technical/README.md).**

---

## Quick Start

```bash
# Navigate to source directory
cd src

# Run the setup script
chmod +x setup.sh
./setup.sh

# Start backend (Terminal 1)
cd backend && npm run dev

# Start frontend (Terminal 2)
cd frontend && npm run dev

# Open browser at http://localhost:5173
```

Full environment variable reference and deployment instructions: [`docs/technical/DEPLOYMENT.md`](docs/technical/DEPLOYMENT.md).

---

## Repository Structure

```
.
├── src/
│   ├── backend/          # Node.js + Express + MongoDB (Prisma) + Python scraper subprocess
│   ├── frontend/          # React + Vite
│   └── setup.sh          # Automated setup script
├── docs/
│   ├── technical/        # Architecture, data model, API reference, deployment, known issues
│   └── Matching_Algorithm_Report.md  # Exact matching-score formulas and weights
├── reports/               # Historical snapshots — see reports/README.md
└── README.md              # This file
```

---
*For the full technical picture, start at [`docs/technical/README.md`](docs/technical/README.md).*
