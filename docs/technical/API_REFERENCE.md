# API Reference

## Purpose & scope
Every HTTP endpoint the backend exposes, its required role, and what it does. All endpoints below are mounted at `/api/*` unless noted otherwise. Every route except `/api/auth/*`, `/health`, and `/debug-python` passes through the global `authenticateJwt` middleware (`src/backend/src/index.ts:147`) before reaching its specific role check. See [DATA_MODEL.md](./DATA_MODEL.md) for the shapes these endpoints read/write, and [KNOWN_ISSUES_AND_DESIGN_DECISIONS.md](./KNOWN_ISSUES_AND_DESIGN_DECISIONS.md) for the auth caveats flagged below.

## Auth — `src/backend/src/routes/auth.routes.ts` → `/api/auth` (all public, no JWT required)
| Method | Path | Purpose |
|---|---|---|
| POST | `/admin/login` | Admin login — checks `email`/`password` against `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars only, no DB record |
| POST | `/buyer/signup` | Create a buyer account (bcrypt-hashes password, parses `rawPreferences` via `KeywordIntentParser`) |
| POST | `/buyer/login` | Buyer login — bcrypt check, or `SUPER_PASSWORD` env fallback (see known issues) |
| POST | `/seller/signup` | Create a seller account |
| POST | `/seller/login` | Seller login — same bcrypt/`SUPER_PASSWORD` pattern as buyer |

## Buyers — `src/backend/src/routes/buyer.routes.ts` → `/api/buyers`
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/` | admin | Create a buyer |
| GET | `/` | admin | List all buyers |
| GET | `/localities-map` | admin | Geocoded buyer localities for the admin map view (inline handler in the route file, not a controller) |
| GET | `/:id` | self or admin | Get a buyer |
| PUT | `/:id` | self or admin | Update buyer preferences |
| DELETE | `/:id` | self or admin | Delete a buyer |

## Sellers — `src/backend/src/routes/seller.routes.ts` → `/api/sellers`
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/` | admin | Create a seller |
| GET | `/` | admin | List all sellers |
| GET | `/:id` | self or admin | Get a seller |
| PUT | `/:id` | self or admin | Update a seller |
| DELETE | `/:id` | self or admin | Delete a seller |
| POST | `/:id/rate` | buyer, admin | Rate a seller (0-5), feeds `trustScore` |
| POST | `/:id/contact` | buyer, admin | "Contact seller" — currently a stub, just `console.log`s, no real email dispatch |

## Properties — `src/backend/src/routes/property.routes.ts` → `/api/properties`
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/` | admin, seller (property-create access check) | Create a property listing |
| GET | `/map` | admin, buyer, seller | Lightweight geocoded listing for map views |
| GET | `/geocode` | admin, buyer, seller | Forward-geocode a free-text query |
| GET | `/reverse-geocode` | admin, buyer, seller | Coordinates → address |
| GET | `/nearby-places` | admin, buyer, seller | Overpass POIs (airport/bus/train/hospital) near a lat/lon |
| GET | `/` | admin, buyer, seller | List/filter properties |
| GET | `/:id` | admin, buyer, seller | Get a property |
| PUT | `/:id` | admin, owner seller | Update a property |
| DELETE | `/:id` | admin, owner seller | Delete a property |
| PUT | `/:id/mark-sold` | admin, owner seller | Sets `isActive = false` |

## Leads — `src/backend/src/routes/lead.routes.ts` → `/api/leads`
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/` | admin, buyer, seller (lead-create access check) | Create a lead |
| GET | `/` | admin, buyer, seller | List leads — auto-scoped in the controller to the caller's own buyer/seller records |
| GET | `/:id` | access-checked | Get a lead plus its event history |
| POST | `/:id/transition` | access-checked | Move a lead to its next state (validated by the state machine) |
| GET | `/:id/allowed-states` | access-checked | Which states this lead can legally move to next |

## Matches — `src/backend/src/routes/matching.routes.ts` → `/api/matches`
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/buyer/:buyerId/find` | admin, self buyer | Run the matcher for one buyer against all active properties |
| POST | `/property/:propertyId/find` | admin, owner seller | Run the matcher for one property against all buyers |
| POST | `/refresh-all` | admin | Re-run matching for every buyer in the database |
| GET | `/` | admin | List all matches |
| GET | `/buyer/:buyerId` | admin, self buyer | Stored matches for a buyer |
| GET | `/property/:propertyId` | admin, owner seller | Stored matches for a property |

## Workflow events — `src/backend/src/routes/workflow-event.routes.ts` → `/api/workflow-events`
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/` | admin | All logged events (audit feed) |
| GET | `/lead/:leadId` | access-checked | Event history for one lead |

## Notifications — `src/backend/src/routes/notification.routes.ts` → `/api/notifications`
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/?userId=&role=` | *(none — see known issues)* | List notifications for a user |
| PATCH | `/read-all` | *(none)* | Mark all notifications read for a user |
| PATCH | `/:id/read` | *(none)* | Mark one notification read |

These three carry no `requireRoles`/ownership check beyond the global JWT requirement — identity comes from a `userId`/`role` passed directly in the request, not derived from the token. See [KNOWN_ISSUES_AND_DESIGN_DECISIONS.md](./KNOWN_ISSUES_AND_DESIGN_DECISIONS.md).

## Analytics — `src/backend/src/routes/analytics.routes.ts` → `/api/analytics`
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/admin/overview` | admin | Top-level KPI totals, avg match score, active-inventory rate |
| GET | `/admin/pipeline` | admin | Lead conversion by stage, per-seller conversion, top localities |
| GET | `/admin/match-quality` | admin | Match-score distribution, per-seller average score, score trend |
| GET | `/admin/market-distribution` | admin | Price distribution by city/locality, city→locality→listing drilldown |
| GET | `/admin/demand-supply` | admin | BHK demand vs. supply, unmatched-demand hotspots, buyer budget distribution |
| GET | `/admin/sellers/:sellerId` | admin | Full analytics detail for one seller (admin "impersonation" view) |
| GET | `/seller/me/summary` | admin, seller | Seller's own KPI summary |
| GET | `/seller/me/listings` | admin, seller | Seller's own listings with match/budget-fit stats |
| GET | `/seller/me/budget-fit` | admin, seller | Listing price vs. matched buyer budget scatter data |
| GET | `/seller/me/match-trend` | admin, seller | Match count/score trend over time |

## Admin / seeding & repair tooling — `src/backend/src/routes/seed.routes.ts` → `/api/admin/seed` (all admin-only)
| Method | Path | Purpose |
|---|---|---|
| POST | `/demo-buyers` | Seed demo buyer accounts |
| POST | `/delete-all-buyers` | Delete all buyers (and their leads/matches) |
| POST | `/demo-sellers` | Seed demo seller accounts + their properties |
| POST | `/delete-all-sellers` | Delete all sellers (and their properties/leads/matches) |
| POST | `/demo-leads` | Convert existing high-score matches into demo leads, advanced through the state machine |
| POST | `/backfill-buyer-localities` | One-off repair: derive `metadata.localities` from `metadata.localityCoords` for buyers missing it |
| POST | `/migrate-demo-emails` | One-off repair: migrate `@demo.com` seeded accounts to `@gmail.com` |
| POST | `/reset-seller-trust` | Reset all sellers' trust scores |
| POST | `/reset-database` | Wipe and optionally reseed the entire database |
| POST | `/seed-all` | Seed buyers + sellers, refresh all matches, then seed leads — the one-shot demo bootstrap |
| GET | `/credentials` | View all logged demo account credentials (from `credentials-log.json`) |

## Routes mounted directly in `src/backend/src/index.ts` (not under `routes/`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Health check, used by Render |
| GET | `/debug-python` | **none** | Diagnostic dump of the Python/scraper environment — publicly reachable, outside `/api` entirely, so it isn't even covered by the global JWT check. See [KNOWN_ISSUES_AND_DESIGN_DECISIONS.md](./KNOWN_ISSUES_AND_DESIGN_DECISIONS.md). |
| GET | `/api/admin/scrapers` | admin | List available scraper implementations |
| POST | `/api/admin/trigger-scrape` | admin | Manually trigger a scrape for a city |
| POST | `/api/admin/fb-scrape` | **none beyond global JWT** | Run the Facebook-group scraper pipeline |
| GET | `/api/admin/fb-load-csv` | **none beyond global JWT** | Load a previously-scraped Facebook CSV |
| POST | `/api/admin/fb-save` | **none beyond global JWT** | Persist curated Facebook-scraped rows as Properties |

The three Facebook-scraper routes are under `/api/admin/*` but — unlike every other admin route in this document — carry no `requireRoles('admin')` check; any authenticated user (buyer or seller) can call them. Flagged in [KNOWN_ISSUES_AND_DESIGN_DECISIONS.md](./KNOWN_ISSUES_AND_DESIGN_DECISIONS.md).

---
*Last verified against commit `ce81d04`.*
