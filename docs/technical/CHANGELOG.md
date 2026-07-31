# Changelog

## Purpose & scope
A readable summary of this repository's real commit history — what changed, why, and how each change was verified. Generated from `git log`; see the actual commits for full detail (each commit message documents its own before/after verification).

## Before this repository's git history: PostgreSQL → SQLite → MongoDB
This project's version control was only initialized once it had already reached MongoDB — the two earlier migrations aren't in `git log` at all. The PostgreSQL → SQLite phase is documented in `reports/SQLITE_MIGRATION.md` (JSON-string workarounds for SQLite's lack of native arrays, the `dev.db` file, etc.); the subsequent SQLite → MongoDB migration is not separately documented, but its result is what [DATA_MODEL.md](./DATA_MODEL.md) describes today — including schema comments like "stored as JSON strings for SQLite" that are leftovers from that phase and no longer reflect the reasoning for the current MongoDB setup.

## 2026-07-29 — Initial commit
**`7dc3439`** — Baseline snapshot: working app on MongoDB Atlas, seeded demo data (buyers/sellers/properties/matches), and Exa AI locality-intelligence enrichment wired into the matching pipeline.

**`2b95772`** — Fixed locality data being silently dropped at buyer creation and signup. `buyer.controller.ts` and `auth.controller.ts` both destructured a `localities` field from the request body but never forwarded it to the service layer. The impact was more severe than a missing display field: the matcher hard-discards any match scoring below 25 on location, and location scoring requires geocoded coordinates derived from that locality data — so affected buyers received **zero matches**, not just lower-quality ones. Fixed by merging the incoming locality data into `metadata.localities`/`metadata.localityText`, triggering the existing geocoding path.

## 2026-07-30 — Data completeness pass
**`17e7773`** — Seeded demo `Lead` records from existing high-score `Match` rows, since nothing in the seed/demo flow had ever created a `Lead` before — every lead-dependent chart and metric (conversion funnel, per-seller conversion rate) was empty by omission, not by a bug.

**`09c3e51`** — Expanded the synthetic seed dataset from 5 to 10 cities, roughly doubling buyers/sellers/properties, to give the analytics views (market distribution, demand/supply) more realistic geographic breadth.

**`c4c2b49`** — Found and fixed the same locality-dropping bug's twin, this time in the seed script itself (`seed-demo-buyers.ts`) rather than the live controllers — plus a one-off backfill for buyers already created before the fix.

**`6c170e0`** — Found a third, independent instance of the same underlying issue: the admin dashboard's Buyers table was reading a `b.localities` field that never existed anywhere in the API response (the real data lives nested under `metadata`, matching the convention used everywhere else in the app). Fixed the read path.

**`4863a55`** — Fixed two deploy-breaking bugs in `render.yaml` found while first setting up the Render deployment: it used `prisma migrate deploy` (unsupported for MongoDB) instead of `prisma db push`, and it never actually ran `tsc`, so every deploy would have built "successfully" and then crashed on start.

**`2052016`** — Added Vercel CLI's auto-generated `.gitignore` for the frontend.

## 2026-07-31 — Deployment hardening & data cleanup
**`c6acb21`** — Found and fixed a second `render.yaml` bug, uncovered only once real deploys were attempted: `NODE_ENV=production` (needed at runtime) was also suppressing `npm install`'s devDependency installation at *build* time, silently skipping TypeScript itself and causing `npx` to fetch an unrelated, much newer TypeScript version that broke on a removed config option. Fixed with `npm install --include=dev`.

**`b5d6462`** — Migrated all seeded demo account emails from `@demo.com` to `@gmail.com`, both in the seed script source (so future re-seeds use the new domain) and via a one-off migration against the live database, keeping the admin credentials log in sync.

## Reading this changelog
A recurring pattern across several entries: the same underlying data issue (locality information not reaching where it needed to) surfaced independently in three unrelated places (a live controller, a seed script, and a frontend read path) before being fully closed out. This is why [KNOWN_ISSUES_AND_DESIGN_DECISIONS.md](./KNOWN_ISSUES_AND_DESIGN_DECISIONS.md) exists as a living document — some classes of bug take more than one fix to fully eliminate, and it's worth tracking that explicitly rather than assuming the first fix caught everything.

---
*Last verified against commit `b5d6462`.*
