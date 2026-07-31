# Hublet - Real Estate Lead Matching Platform

A real-estate lead matching and market-intelligence platform demonstrating clean, modular architecture. For the full technical picture (architecture, data model, API reference, deployment, known issues), see [`docs/technical/README.md`](../docs/technical/README.md) — this file is a lighter getting-started guide.

## Features

- **Buyer Intent Capture**: structured filters + free-text intent, parsed server-side
- **Seller & Property Management**: seller profiles, property listings, and a scraper pipeline for pulling real listings
- **Rule-Based Matching**: deterministic weighted scoring — location (35%), budget (30%), size/BHK (20%), amenities (15%), with a hard location-score gate (see [`docs/technical/MATCHING_AND_DATA_FLOW.md`](../docs/technical/MATCHING_AND_DATA_FLOW.md))
- **Lead Lifecycle State Machine**: enforced linear transitions (`NEW → ENRICHED → QUALIFIED → NOTIFIED → CONTACTED → CLOSED`)
- **Authentication**: JWT-based, three roles (admin/buyer/seller) — see [`docs/technical/API_REFERENCE.md`](../docs/technical/API_REFERENCE.md)
- **Audit Logging**: all workflow events, state transitions, and matches logged
- **Admin Analytics**: server-side aggregated dashboards
- **REST API**: full CRUD for buyers, sellers, properties, leads, and matches
- **React Frontend**: forms for data entry, match viewing, and analytics dashboards

### Architecture Highlights
- **Modular Service Layer**: clean separation of concerns
- **Pluggable Matchers**: interface-based design for easy ML replacement later
- **MongoDB via Prisma**: flexible metadata stored as JSON-serialized strings (a deliberate MongoDB-era modeling choice — see [`docs/technical/DATA_MODEL.md`](../docs/technical/DATA_MODEL.md))
- **Indexed Queries**: optimized for common search patterns
- **State Machine Guards**: invalid transitions automatically rejected

---

## Tech Stack

### Backend
- **Node.js** with **TypeScript**
- **Express.js** for the REST API
- **MongoDB Atlas** as the datastore
- **Prisma ORM** for type-safe database access
- **Python subprocess** for the scraper pipeline

### Frontend
- **React** with **TypeScript**
- **Vite** for fast development
- **Axios** for API calls

---

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- A MongoDB Atlas cluster (or any MongoDB instance)
- Python 3 (for the scraper pipeline)
- Git

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and set your DATABASE_URL to a real MongoDB Atlas connection string:
# DATABASE_URL="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/hublet?retryWrites=true&w=majority"

# Generate the Prisma client
npm run prisma:generate

# Sync the schema to MongoDB (Prisma's migrate commands aren't supported for MongoDB — use db push)
npx prisma db push

# Start the backend server
npm run dev
```

Backend will run on `http://localhost:3000`. Full environment variable reference: [`docs/technical/DEPLOYMENT.md`](../docs/technical/DEPLOYMENT.md).

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the frontend dev server
npm run dev
```

Frontend will run on `http://localhost:5173`.

### 3. Access the Application

- **Frontend**: http://localhost:5173
- **API Health Check**: http://localhost:3000/health

---

## API Documentation

The full endpoint list (every route, method, required role) is in [`docs/technical/API_REFERENCE.md`](../docs/technical/API_REFERENCE.md). Quick taste:

| Resource | Base path |
|---|---|
| Auth | `/api/auth/{admin,buyer,seller}/{login,signup}` |
| Buyers | `/api/buyers` |
| Sellers | `/api/sellers` |
| Properties | `/api/properties` |
| Matches | `/api/matches` |
| Leads | `/api/leads` |
| Analytics | `/api/analytics` |

All endpoints except `/api/auth/*`, `/health`, and `/debug-python` require a JWT bearer token — sign up/log in first to get one.

---

## Usage Flow

### 1. Sign up a seller
```json
POST /api/auth/seller/signup
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "yourpassword",
  "sellerType": "owner"
}
```

### 2. Add a property (with the returned JWT as a bearer token)
```json
POST /api/properties
{
  "sellerId": "<seller-id>",
  "title": "Spacious 2BHK in Indiranagar",
  "locality": "Indiranagar",
  "area": 1200,
  "bhk": 2,
  "price": 5000000,
  "amenities": ["parking", "gym", "swimming pool"]
}
```

### 3. Sign up a buyer with free-text intent
```json
POST /api/auth/buyer/signup
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "yourpassword",
  "rawPreferences": "Looking for 2 BHK in Indiranagar, budget 50 to 70 lakhs, need parking and gym"
}
```

### 4. Find matches
```bash
POST /api/matches/buyer/<buyer-id>/find
```
Parses the buyer's free-text intent (if provided), geocodes their locality, scores all active properties, stores matches with a full score breakdown, and returns ranked results. Full pipeline: [`docs/technical/MATCHING_AND_DATA_FLOW.md`](../docs/technical/MATCHING_AND_DATA_FLOW.md).

---

## Repository layout

```
backend/
  src/
    controllers/      # HTTP request handlers
    services/         # Business logic (matching, geocoding, scraping, notifications)
    matchers/         # Matching algorithms (pluggable)
    parsers/          # Free-text intent parsing
    workflows/         # Lead state machine
    middleware/        # Auth + access-control checks
    routes/            # API route definitions
    db/                 # Prisma client
  scraper/              # Python scraper pipeline (Apify/ZenRows/Groq-backed)

frontend/
  src/
    components/        # React components
    pages/              # Analytics dashboard pages
    api/                 # API client
```

---

## Notes

- Matching algorithm is rule-based by design, documented in its own source as a placeholder for an eventual ML-based replacement.
- Full list of known issues, security-relevant caveats, and functional stubs: [`docs/technical/KNOWN_ISSUES_AND_DESIGN_DECISIONS.md`](../docs/technical/KNOWN_ISSUES_AND_DESIGN_DECISIONS.md).
