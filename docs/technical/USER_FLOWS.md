# User Flows

## Purpose & scope
Three complete, real (not idealized) user journeys — buyer, seller, admin — each traced from the actual frontend component through the actual backend route to the actual database write. See [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) and [API_REFERENCE.md](./API_REFERENCE.md) for the pieces referenced here, and [MATCHING_AND_DATA_FLOW.md](./MATCHING_AND_DATA_FLOW.md) for what happens after a buyer's preferences are saved.

## Buyer flow

```mermaid
sequenceDiagram
    participant U as Buyer (browser)
    participant FE as Frontend (AuthPage / BuyerForm / BuyerDashboard)
    participant API as Backend API
    participant DB as MongoDB

    U->>FE: Visit /auth/buyer, sign up or log in
    FE->>API: POST /api/auth/buyer/signup or /login
    API->>DB: Create/verify Buyer record
    API-->>FE: JWT + user info
    FE->>FE: Store token in localStorage, navigate to /buyer/:userId
    FE->>API: GET /api/buyers/:id, GET /api/matches/buyer/:id
    U->>FE: Fill preferences (budget, BHK, amenities, free-text, map localities)
    FE->>API: PUT /api/buyers/:id  (includes rawPreferences)
    API->>API: Parse free text, geocode localities, save
    API->>API: Fire-and-forget: run matching for this buyer
    FE->>API: POST /api/matches/buyer/:id/find
    API-->>FE: Ranked matches with score breakdown
    FE-->>U: Render match cards (score, nearby places, Local Insights)
```

The buyer never triggers geocoding or matching directly — both happen server-side as a consequence of saving preferences. The frontend's "Local Insights" and "Nearby Places" blocks are pure display of data the backend already computed and stored on the property; no extra request happens per match card.

## Seller flow

```mermaid
sequenceDiagram
    participant U as Seller (browser)
    participant FE as Frontend (AuthPage / PropertyForm / SellerDashboard)
    participant API as Backend API
    participant DB as MongoDB

    U->>FE: Visit /auth/seller, sign up or log in
    FE->>API: POST /api/auth/seller/signup or /login
    API->>DB: Create/verify Seller record
    API-->>FE: JWT + user info
    FE->>FE: Navigate to /seller/:userId
    U->>FE: Click "Add Property", fill form, pick location on map
    FE->>API: GET /api/properties/nearby-places (auto-fetched after location pick)
    U->>FE: Submit
    FE->>API: POST /api/properties
    API->>API: Geocode address, fetch nearby places, save
    API->>API: Fire-and-forget: run matching for this property
    U->>FE: Click "View Matches" on a listing
    FE->>API: GET /api/matches/property/:id
    API-->>FE: Matched buyers with score breakdown
    U->>FE: Click "Mark as Sold"
    FE->>API: PUT /api/properties/:id/mark-sold
    API->>DB: Set isActive = false
```

## Admin flow

```mermaid
sequenceDiagram
    participant U as Admin (browser)
    participant FE as Frontend (AuthPage / AdminDashboard / AdminAnalyticsPage)
    participant API as Backend API
    participant DB as MongoDB

    U->>FE: Visit /auth/admin, log in
    FE->>API: POST /api/auth/admin/login  (env-credential check, no DB lookup)
    API-->>FE: JWT (no userId — admin token)
    FE->>FE: Navigate to /admin
    U->>FE: Use sidebar tabs (Buyers/Sellers/Properties/Leads/Matches/Maps/Scrapers)
    FE->>API: GET /api/buyers, /api/sellers, /api/properties, /api/leads, /api/matches, etc.
    U->>FE: Click "Seed Demo Buyers/Sellers", or trigger a scrape
    FE->>API: POST /api/admin/seed/demo-buyers  (or /demo-sellers, /trigger-scrape, ...)
    API->>DB: Bulk-create records, run matching, seed leads
    U->>FE: Click "View Analytics"
    FE->>FE: Navigate to /admin/analytics
    FE->>API: 5 parallel calls: GET /api/analytics/admin/overview, /pipeline, /match-quality, /market-distribution, /demand-supply
    API-->>FE: Aggregated metrics (computed entirely server-side)
    FE-->>U: KPI cards, charts, drilldown tables
```

Admin sub-view navigation (Buyers vs. Sellers vs. Properties, etc.) is local component state, not routing — see [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) for why that means these views aren't individually linkable.

---
*Last verified against commit `ce81d04`.*
