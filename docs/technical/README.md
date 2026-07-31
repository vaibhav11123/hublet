# Hublet — Technical Documentation

Hublet is a real-estate lead-matching platform: buyers describe what they're looking for (structured filters plus free-text intent), sellers list properties, and a rule-based matching engine scores every buyer against every property to surface ranked matches, which can progress through a lead pipeline to a closed deal.

**Current stack**: React + Vite frontend (deployed on Vercel), Express + TypeScript backend (deployed on Render), MongoDB Atlas via Prisma, a Python scraper subprocess for pulling real listings, and external integrations with Exa AI (locality market intelligence), Groq (LLM listing extraction), Apify/ZenRows (scraping infrastructure), and OpenStreetMap (geocoding).

## Contents

| Document | Covers |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System overview, component diagram, deployment topology, subsystem summaries |
| [DATA_MODEL.md](./DATA_MODEL.md) | Every database model, field, relation, and index; MongoDB-specific modeling choices |
| [API_REFERENCE.md](./API_REFERENCE.md) | Every backend endpoint, its required role, and its purpose |
| [MATCHING_AND_DATA_FLOW.md](./MATCHING_AND_DATA_FLOW.md) | End-to-end pipeline from buyer preferences to a scored match and a lead |
| [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) | Component inventory, routing, state management, API client layer, design system |
| [USER_FLOWS.md](./USER_FLOWS.md) | Buyer, seller, and admin journeys as sequence diagrams |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | How it's actually deployed today, and the complete environment variable reference |
| [KNOWN_ISSUES_AND_DESIGN_DECISIONS.md](./KNOWN_ISSUES_AND_DESIGN_DECISIONS.md) | Candid security notes, functional stubs, and deliberate tradeoffs |
| [CHANGELOG.md](./CHANGELOG.md) | Readable summary of the real commit history |

The exact matching-score formulas and weights are documented separately in [`docs/Matching_Algorithm_Report.md`](../Matching_Algorithm_Report.md) (kept as the single source of truth for that topic rather than duplicated here).

## How to use this documentation
Each file above is self-contained and cross-links to the others where relevant — start with whichever topic you need, not necessarily top-to-bottom. Every file ends with a "last verified against commit" line; if the current `git log` has moved well past that commit, treat the file as a starting point to re-verify rather than an absolute source of truth.

---
*Last verified against commit `ce81d04`.*
