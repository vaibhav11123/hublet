# Frontend Architecture

## Purpose & scope
How the React frontend is structured, routed, and styled — components, API access patterns, state management, and the design system. For the three main user journeys traced through this structure, see [USER_FLOWS.md](./USER_FLOWS.md).

## Stack
React 18 + TypeScript, built with Vite. `react-router-dom` v7 for routing. `axios` for HTTP. `leaflet` + `react-leaflet` for maps. `chart.js` + `react-chartjs-2` for analytics charts. `lucide-react` for icons. No test files, no state-management library (Redux/Zustand/Context), no CSS framework — styling is hand-rolled CSS.

## Routing
Real `react-router-dom` v7 routing, `BrowserRouter` (`src/App.tsx`). Routes: `/`, `/auth/:userType`, `/admin`, `/admin/analytics`, `/admin/analytics/sellers/:sellerId`, `/buyer/:userId`, `/seller/:userId`, `/seller/:userId/analytics`. Each protected route is a small wrapper component that reads the stored auth session and `<Navigate>`s away on a role/id mismatch — there is no centralized `PrivateRoute`/context guard, each wrapper re-implements the same check inline.

Within `AdminDashboard`, the many sub-views (Buyers/Sellers/Properties/Leads/Matches/Event Logs/Property Map/Buyer Map/scraper tools/settings) are **not** separate routes — they're a single `useState<TabType>` tab switcher. This means admin sub-views aren't deep-linkable or bookmarkable; refreshing the page or sharing a URL always lands back on the default tab.

## Pages & components

| Component | Role | Responsibility |
|---|---|---|
| `App.tsx` | — | Route tree + auth-guard wrapper components |
| `AuthPage.tsx` | public | Single component handling all six login/signup flows (admin/buyer/seller × login/signup) |
| `BuyerDashboard.tsx` | buyer | Preferences editor + match results + map view |
| `BuyerForm.tsx` | buyer | Structured + free-text preference form, embeds `LocationPicker` |
| `SellerDashboard.tsx` | seller | Listing management + matched-buyer viewing |
| `PropertyForm.tsx` | seller/admin | Create/edit a property, embeds `LocationPicker`, auto-fetches nearby places |
| `AdminDashboard.tsx` | admin | The largest component (~750 lines) — sidebar SPA covering data management, scraper tools, and both map tabs |
| `LocationPicker.tsx` | shared | Reusable Leaflet map picker (single or multi-marker), geocodes through the backend |
| `MapSearchBar.tsx` | shared | Debounced location search box, queries public Nominatim directly, pans a passed-in map instance |
| `NotificationBell.tsx` | buyer/seller | Polls notifications every 30s |
| `AdminAnalyticsPage.tsx` | admin | Admin analytics dashboards (KPIs, charts, drilldowns) |
| `SellerAnalyticsPage.tsx` | seller (or admin impersonating) | Seller-scoped analytics dashboard |
| `src/components/analytics/*` | shared | `FilterBar`, `ChartCard`, `AnalyticsStates`, `DrilldownPanel`, `ExportControls` — building blocks for both analytics pages |

**Not reachable from any route** (built, but orphaned — see [KNOWN_ISSUES_AND_DESIGN_DECISIONS.md](./KNOWN_ISSUES_AND_DESIGN_DECISIONS.md)): `MapPicker.tsx` (an alternate, declarative-API location picker), `PropertyExplorer.tsx` (a standalone filterable property map), `MatchViewer.tsx` (a generic buyer-picker match viewer), and `SellerForm.tsx` (a bare-bones seller-creation form calling `sellerApi.create` directly — superseded by `AuthPage.tsx`'s seller signup flow). An `App.tsx.backup` file also exists alongside the real `App.tsx`.

## API client layer
`src/api/client.ts` is the intended single client: grouped API objects per resource (`authApi`, `buyerApi`, `sellerApi`, `propertyApi`, `matchingApi`, `leadApi`), base URL from `VITE_API_BASE_URL` (falls back to `http://localhost:3000/api`), auth token read from `localStorage` (`hublet_auth_token`) both at instance creation and via a request interceptor that re-reads it on every call. A separate `src/api/analytics.ts` wraps the analytics endpoints with a shared `AnalyticsEnvelope<T>` response type and filter-building helper.

In practice, several components bypass this shared client and call `axios`/`fetch` directly with their own duplicated `API_BASE_URL` constant and manual `localStorage` reads (`BuyerDashboard.tsx`, `SellerDashboard.tsx`, `LocationPicker.tsx`, `PropertyExplorer.tsx`). This is inconsistent enough that at least one call path (`BuyerDashboard`'s match-fetching) sends no auth header at all. Worth knowing before extending any of these components.

## State management
No global store. The closest thing to shared state is the auth session, which lives in `localStorage` (`getAuthSession`/`setAuthSession`/`clearAuthSession` in `client.ts`) rather than React context — every component that needs the current user re-reads `localStorage` directly rather than subscribing to anything. Beyond that:
- Each dashboard (`BuyerDashboard`, `SellerDashboard`, `AdminDashboard`) owns all its own fetching state via `useState`/`useEffect`, with no shared cache between them.
- Forms notify parents via callback props (`onPreferencesUpdated`, `onSuccess`) rather than a store.
- The two analytics pages use custom hooks (`useAdminAnalytics`, `useSellerAnalytics`) that are thin `useState` + `useEffect` + `Promise.all` fetch-aggregators, not a general-purpose store.
- Theme (`hublet_theme`) and a couple of small UI preferences are also persisted straight to `localStorage`.

## Maps
Four separate Leaflet integrations exist, all against the public OSM tile server:
- `LocationPicker.tsx` — the "real" one, embedded in `BuyerForm` and `PropertyForm`; imperative `L.map()` API; geocodes through the backend.
- `MapPicker.tsx` — an alternate, declarative `react-leaflet` (`<MapContainer>`) implementation that calls Nominatim directly from the browser instead of through the backend. Orphaned/unused.
- `PropertyExplorer.tsx` — standalone full-map property browser with filters. Orphaned/unused.
- `AdminDashboard.tsx`'s "Property Map" and "Buyer Map" tabs, and `BuyerDashboard.tsx`'s own map tab (colour-codes matched vs. unmatched properties client-side).

All four duplicate the same Leaflet default-icon-fix boilerplate independently rather than sharing it from one place.

## Design system
A genuine, single-sourced Material Design 3 implementation in `src/m3-design-system.css` (imported once globally in `main.tsx`): CSS custom properties for color tokens, elevation, shape/corner radii, and an 8pt spacing scale, with a `[data-theme="dark"]` override block toggled by setting `data-theme` on the document root (persisted to `localStorage` as `hublet_theme`). Class naming follows two conventions — `m3-*` for structural/component classes, `md-*` for the typography scale — used consistently via literal `className` strings throughout the app (no CSS-in-JS, no Tailwind).

One inconsistency worth knowing: the two analytics pages use a **separate** stylesheet, `src/components/analytics/analytics.css`, with its own `analytics-*`-prefixed classes not integrated into the `m3-` system.

---
*Last verified against commit `b5d6462`.*
