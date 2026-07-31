# Known Issues & Design Decisions

## Purpose & scope
A candid, verified list of deliberate tradeoffs and unresolved issues in the current codebase — the section that makes this documentation set trustworthy rather than promotional. Every item below was confirmed by reading the actual current source, not inferred.

## Security-relevant items

### Universal password bypass for buyers and sellers
`isSuperPassword()` (`src/backend/src/controllers/auth.controller.ts:19-22`) compares a submitted login password against the `SUPER_PASSWORD` environment variable. Both `buyerLogin` and `sellerLogin` accept a login if *either* the bcrypt hash matches *or* the submitted password equals `SUPER_PASSWORD` (`auth.controller.ts:164,268`: `if (!isPasswordValid && !isSuperPassword(password))`). In other words, one shared password logs into **any** buyer or seller account, regardless of that account's actual password. This is a deliberate demo/QA convenience (lets an admin or tester access any seeded account without knowing its individual password) and does not apply to admin login, which checks only `ADMIN_EMAIL`/`ADMIN_PASSWORD`. **This would need to be removed or heavily restricted before any real user data is stored.**

### Three admin-path scraper routes have no role check
`POST /api/admin/fb-scrape`, `GET /api/admin/fb-load-csv`, and `POST /api/admin/fb-save` (`src/backend/src/index.ts:210,274,294`) sit under `/api/admin/*` but, unlike every other admin route, carry no `requireRoles('admin')` middleware — only the blanket JWT check applied globally. Any authenticated buyer or seller can trigger a Facebook-group scrape or persist scraped listings.

### `/debug-python` is public and leaks internal paths
`GET /debug-python` (`src/backend/src/index.ts:109-141`) is registered *before* the global JWT middleware and outside `/api` entirely, so it's reachable by anyone with no authentication. It returns the server's working directory, resolved Python interpreter path, scraper directory existence checks, and `sys.path` — not secret values (no API keys/credentials are printed), but real internal filesystem structure that's useful reconnaissance for an attacker and shouldn't be public.

### Notifications trust caller-supplied identity
`NotificationController` (backing `/api/notifications/*`) reads `userId`/`role` from the query string or request body rather than deriving identity from the verified JWT (`src/backend/src/routes/notification.routes.ts` has no `requireRoles`/ownership middleware at all). A buyer could pass another user's `userId` and read their notifications.

## Functional stubs (work as demos, not as real features)

- **`Seller.contactSeller`** (`src/backend/src/controllers/seller.controller.ts`) only `console.log`s the contact attempt — no real email or message is sent to the seller.
- **Match/lead notification emails** (`src/backend/src/services/email.service.ts`) fall back to a console-log mock unless `SMTP_USER` is explicitly configured to something other than the placeholder default — in most environments (including this project's default setup) these emails are never actually sent.

## Frontend housekeeping

- Four fully-built components are not referenced by any route or parent: `MapPicker.tsx`, `PropertyExplorer.tsx`, `MatchViewer.tsx`, and `SellerForm.tsx`. Likely earlier iterations superseded by `LocationPicker.tsx`, the map/match views embedded directly in `BuyerDashboard`/`AdminDashboard`, and `AuthPage.tsx`'s seller signup flow, respectively.
- `src/frontend/src/App.tsx.backup` exists alongside the real `App.tsx` — a leftover from an in-progress or rolled-back change.
- Several components bypass the shared `src/api/client.ts` and call `axios`/`fetch` directly with their own duplicated base-URL constant and manual `localStorage` token reads, which is why at least one call path currently sends no auth header at all (see [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md)).

## Deferred / open work

- **99acres Apify scraper's city-to-URL mapping is unreliable.** Live testing (documented in this project's development history) showed the hardcoded numeric city IDs return data for the wrong city, or malformed near-empty listings, depending on the exact URL format. 99acres' own city-ID scheme appears to have changed multiple times and is inconsistent across sources, including the scraping actor's own bundled example. This is open, deferred work.
- The matching algorithm (`RuleBasedMatcher`) is explicitly commented in its own source as "a placeholder that can be replaced with ML-based matching later" — a deliberate, simple first implementation rather than an oversight. See [MATCHING_AND_DATA_FLOW.md](./MATCHING_AND_DATA_FLOW.md).

## Design decisions worth understanding (not bugs)

- **Location score is a hard gate, not just a weighted component.** `RuleBasedMatcher` forces `totalScore = 0` for any property scoring below 25 on location, regardless of how well budget/size/amenities fit (`src/backend/src/matchers/rule-based-matcher.ts`). A buyer with no geocoded locality data therefore receives zero matches, full stop — this is not a partial-credit degradation, it's a hard exclusion. Worth knowing when debugging "why does this buyer have no matches."
- **A `Match` does not imply a `Lead`.** Leads are only created via an explicit API call or automatically when the *scraper* pipeline generates a match scoring ≥70 — bulk re-matching (`POST /api/matches/refresh-all`) never creates leads by itself. See [MATCHING_AND_DATA_FLOW.md](./MATCHING_AND_DATA_FLOW.md).
- **MongoDB modeling avoids native enums and arrays** in favor of `String` fields with documented valid values and JSON-serialized strings, respectively — a deliberate simplicity/portability tradeoff carried over from this project's earlier SQLite phase, kept after the move to MongoDB. See [DATA_MODEL.md](./DATA_MODEL.md).

---
*Last verified against commit `b5d6462`.*
