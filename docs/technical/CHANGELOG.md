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

## 2026-07-31 — Demo-readiness fix + enrichment round
A live rehearsal (simulating a brand-new buyer/seller/admin user against the deployed site) produced a diagnostic report of 7 issues; a follow-up live-data audit found 3 more data-completeness gaps. Every item below was tested locally (or dry-run against production for data changes) before being committed, deployed, and re-verified against the live site — see each commit for its own before/after/verification detail. A final full re-test (mirroring the original rehearsal) confirmed everything below actually works together for a real user, not just in isolation, and caught one additional regression along the way (see `f748cda`).

**`145701d`** — Fixed a match-creation race condition: `findMatchesForBuyer`/`findMatchesForProperty` used a non-atomic `findUnique()` → `create()` sequence, so concurrent calls for the same buyer/property pair could both see "no existing match" and race to `create()`, tripping the `Match_buyerId_propertyId_key` unique constraint. Replaced with `prisma.match.upsert()`.

**`4ec4cbe`** — Found a **fourth** instance of the recurring locality-dropping bug (see "Reading this changelog" below): `updateBuyer` rebuilt its update payload from parsed free-text intent but never forwarded `parsedIntent.localities`, unlike `createBuyer`. Buyers who updated their preferences (rather than being created fresh) had stale/empty `metadata.localityCoords` and, because of the matcher's hard location-score gate, received zero matches after updating.

**`d0f406e`** — `LocationPicker`'s map search and reverse-geocode handlers only `console.error`'d on failure with no user-facing feedback. A concurrency test (firing 8 simultaneous geocode requests) found the underlying cause was a global 1-req/sec Nominatim rate limit that serializes concurrent requests rather than failing them — so the fix is scoped to a visible error banner only; client-side retry would have made the queuing worse. Also hardened `handleSearch` to treat a successful-but-empty response as a failure.

**`49c8080`** — `nearby-places.ts`'s `OVERPASS_ENDPOINTS` had 2 mirrors but still hit sustained rate-limiting. Live-tested several candidate public mirrors before adding any — most either failed to connect or (one case) returned HTTP 200 with what was clearly a toy/incomplete dataset (empty results for real, well-tagged OSM places). Added two working endpoints instead: specific backend nodes of the same official `overpass-api.de` installation, reachable directly when its load-balanced front door is busy.

**`b7dbf3e`** — `BuyerForm.tsx` already had `minBudget`/`maxBudget`/`bhk`/`amenities` in state and read by its submit handler, but no `<input>` elements existed to set them — only the free-text box and map were rendered. Added the missing structured inputs.

**`39fca87`** — `Property.metadata.city` was never set by `createProperty`, the scraper pipeline, or any seed script, so every property-side city aggregation (price-by-city, city filters) showed "unknown" for all 71 properties. Also found that `getCityForProperty` and the analytics city filter read `.city` directly off `property.metadata`/`property.seller.metadata` — both raw JSON strings in this Mongo-backed schema — so the fallback chain silently never worked for **any** property, not just scraper-sourced ones. Added `deriveCityFromLocality()` (comma-format match → no-comma city-slug → `sourceUrl` substring fallback → seller-metadata fallback → explicitly-logged-unresolved) used both at property-creation time and in a one-off backfill for all 71 existing properties.

**`59b8421`** — Enrichment: all 49 sellers had `completedDeals=0`/`trustScore=0`, rendering a red "untrustworthy" badge for every single seller. Backfilled plausible `completedDeals` (varied by `sellerType`) and let the app's own `SellerService.calculateTrustScore`/`updateSeller` compute the real `trustScore` — no formula reimplementation. Resulting spread: 23 green / 26 yellow / 0 red (red turns out to be mathematically unreachable given this dataset's rating floor and the formula's 70/30 weighting — a property of the real data, not a flaw in the backfill).

**`9d12598`** — The 99acres scraper's `CITY_URL_MAP` had wrong numeric city IDs for Mumbai (returned Pune-area listings) and Chennai (returned Faridabad-area listings). Researched current IDs across multiple independent, actively-maintained scraper integrations, then confirmed each candidate with a live Apify test run before writing it into the map.

**`e66b945`** — `AdminAnalyticsPage.tsx`'s KPI trend text was 100% hardcoded literals ("12% vs last period", "Stable", etc.) regardless of real data. Added real last-7-days-vs-prior-7-days trend computation per KPI in `analytics.service.ts`.

**`e2ffb31`**, **`3fbc28f`** — Enrichment: 55/71 properties were missing `metadata.nearbyPlaces`, and 6/71 were missing `metadata.coordinates` entirely (both gaps traced to properties whose creation predated the `39fca87` city-derivation fix, or whose locality strings never geocoded cleanly). Backfilled nearby-places for all 49 properties that already had coordinates (0 needed a synthetic fallback, even after hitting live 429/504s the `49c8080` mirrors recovered from); backfilled coordinates for the remaining 6 via re-geocoding with a synthetic city-center fallback where Nominatim genuinely has no match (verified directly against Nominatim, not just our own code), then fetched their nearby-places in the same pass.

**`c00c158`** — The deployed Vercel frontend 404'd on any direct load of a client-side route (e.g. `/auth/admin`, `/buyer/:id`) — the classic SPA-on-static-host gap, since Vercel had no rule to serve `index.html` for unknown paths. Added `src/frontend/vercel.json` with a catch-all rewrite.

**`48834b7`** — Added a GitHub Actions workflow pinging `/health` every 10 minutes to prevent Render free-tier cold-starts during the demo window, self-limiting via an in-job date check so it doesn't need to be remembered and deleted the instant the window passes.

**`f748cda`** — Found during the final re-test (not part of the original list): `4ec4cbe`'s locality-merge fix built its metadata update from `req.body.metadata` (empty on a free-text-only update) rather than the buyer's existing stored metadata, so `BuyerService.updateBuyer`'s full-column-overwrite silently wiped any other metadata field — most visibly `city` — every time a buyer updated their preferences. This is the locality-metadata-clobbering pattern's **fifth** occurrence (see below). Fixed by fetching and merging onto the buyer's existing metadata first; the one real buyer record affected during this session's own testing was repaired.

**`16d1a6b`** — Found during the final re-test (not part of the original list): none of `App.tsx`'s login-success/logout `navigate()` calls used `{ replace: true }`, so every role transition pushed a new browser-history entry. Once a tab had visited a role-scoped route (e.g. `/buyer/:userId`), it stayed reachable via Back even after logging in as a different role — landing on it tripped that route's guard, which looked like an unrelated session getting yanked to the wrong login page while `localStorage` stayed untouched. Reproduced live against the deployed site (buyer login → logout → admin login → Back ×3 landed on the buyer login page with the admin session still in `localStorage`) before and after the fix. Fixed by adding `replace: true` to the 5 relevant navigations.

**`ce81d04`** — Found during the final re-test (not part of the original list): the 99acres scraper parsers fabricated placeholder listings (`"Property in "` title, `price: 0`) instead of skipping malformed source data, and one field sometimes leaked raw Python dict-repr text into `description` when 99acres' Apify actor returned a dict-shaped field instead of a plain string. Fixed both parsers to skip (return `None`) rather than fabricate, added dict-vs-string extraction, and hardened `schema.py`'s string coercer as defense-in-depth. The 3 known-bad production records were audited (no dependent Leads/Matches) and deleted.

## Reading this changelog
A recurring pattern across many entries: the same underlying shape of bug — metadata being overwritten/rebuilt from scratch instead of merged onto what's already there — surfaced independently at least five times (a live controller and a seed script for locality data on creation, a frontend read path, property-side city derivation, and finally the buyer-update path clobbering city while fixing locality). This is why [KNOWN_ISSUES_AND_DESIGN_DECISIONS.md](./KNOWN_ISSUES_AND_DESIGN_DECISIONS.md) exists as a living document — some classes of bug take more than one fix to fully eliminate, and it's worth tracking that explicitly rather than assuming the first (or fourth) fix caught everything.

---
*Last verified against commit `ce81d04`.*
