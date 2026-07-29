# Hublet - Real Estate Lead Matching Platform

A minimal, demo-ready prototype of a real-estate lead matching and market-intelligence platform. This prototype demonstrates core flows with clean, modular architecture.

##  Features

### Implemented 
- **Buyer Intent Capture**: Submit property preferences (structured + free-text)
- **Seller & Property Management**: Create seller profiles and property listings
- **Rule-Based Matching**: Deterministic weighted scoring algorithm
  - Location matching (35%)
  - Budget matching (30%)
  - Size/BHK matching (20%)
  - Amenities matching (15%)
- **Lead Lifecycle State Machine**: Enforced state transitions (NEW → ENRICHED → QUALIFIED → NOTIFIED → CONTACTED → CLOSED)
- **Audit Logging**: All workflow events, state transitions, and matches logged
- **Basic Intent Parser**: Keyword-based extraction from free-text queries
- **REST API**: Full CRUD operations for buyers, sellers, properties, leads, and matches
- **Minimal UI**: React forms for data entry and match viewing

### Architecture Highlights
- **Modular Service Layer**: Clean separation of concerns
- **Pluggable Matchers**: Interface-based design for easy ML replacement
- **JSONB Storage**: Flexible metadata in PostgreSQL
- **Indexed Queries**: Optimized for common search patterns
- **State Machine Guards**: Invalid transitions automatically rejected

---

##  Tech Stack

### Backend
- **Node.js** with **TypeScript**
- **Express.js** for REST API
- **PostgreSQL** with JSONB fields
- **Prisma ORM** for type-safe database access

### Frontend
- **React** with **TypeScript**
- **Vite** for fast development
- **Axios** for API calls

---

##  Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- Git

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and set your DATABASE_URL:
# DATABASE_URL="postgresql://user:password@localhost:5432/hublet?schema=public"

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start the backend server
npm run dev
```

Backend will run on `http://localhost:3000`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the frontend dev server
npm run dev
```

Frontend will run on `http://localhost:5173`

### 3. Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:5173
- **API Health Check**: http://localhost:3000/health

---

##  API Documentation

### Buyers

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/buyers` | Create a new buyer |
| GET | `/api/buyers` | Get all buyers |
| GET | `/api/buyers/:id` | Get buyer by ID |
| PUT | `/api/buyers/:id` | Update buyer |
| DELETE | `/api/buyers/:id` | Delete buyer |

### Sellers

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sellers` | Create a new seller |
| GET | `/api/sellers` | Get all sellers |
| GET | `/api/sellers/:id` | Get seller by ID |
| PUT | `/api/sellers/:id` | Update seller |
| DELETE | `/api/sellers/:id` | Delete seller |

### Properties

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/properties` | Create a new property |
| GET | `/api/properties` | Get all properties (with filters) |
| GET | `/api/properties/:id` | Get property by ID |
| PUT | `/api/properties/:id` | Update property |
| DELETE | `/api/properties/:id` | Delete property |

### Matching

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/matches/buyer/:buyerId/find` | Find matches for a buyer |
| GET | `/api/matches/buyer/:buyerId` | Get existing matches for a buyer |
| POST | `/api/matches/property/:propertyId/find` | Find matches for a property |
| GET | `/api/matches/property/:propertyId` | Get existing matches for a property |

### Leads

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/leads` | Create a new lead |
| GET | `/api/leads` | Get all leads (with filters) |
| GET | `/api/leads/:id` | Get lead by ID |
| POST | `/api/leads/:id/transition` | Transition lead to new state |
| GET | `/api/leads/:id/allowed-states` | Get allowed next states |

---

##  Usage Flow

### 1. Create a Seller
```json
POST /api/sellers
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+91 9876543210",
  "sellerType": "owner",
  "rating": 4.5,
  "completedDeals": 10
}
```

### 2. Add a Property
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

### 3. Create a Buyer with Intent
```json
POST /api/buyers
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "rawPreferences": "Looking for 2 BHK in Indiranagar, budget 50 to 70 lakhs, need parking and gym"
}
```

### 4. Find Matches
```bash
POST /api/matches/buyer/<buyer-id>/find?minScore=50
```

The system will:
- Parse the buyer's intent (if raw text provided)
- Score all active properties
- Store matches with detailed breakdown
- Return ranked results

---

##  Testing the Prototype

### Using the UI (Recommended)
1. Open http://localhost:5173
2. Navigate through tabs:
   - **Add Buyer**: Enter buyer details and preferences
   - **Add Seller**: Create seller profiles
   - **Add Property**: List properties
   - **View Matches**: Select a buyer and find matches

### Using curl

```bash
# Health check
curl http://localhost:3000/health

# Create a buyer
curl -X POST http://localhost:3000/api/buyers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Buyer",
    "email": "test@example.com",
    "localities": ["Indiranagar", "Koramangala"],
    "bhk": 2,
    "budgetMin": 4000000,
    "budgetMax": 7000000
  }'
```

---

##  Database Schema

The system uses PostgreSQL with the following main tables:

- **buyers**: Buyer profiles with structured + unstructured intent
- **sellers**: Seller profiles with reputation scores
- **properties**: Property listings with JSONB metadata
- **leads**: Lead records with state machine
- **matches**: Scored matches between buyers and properties
- **workflow_events**: Audit log of all system events

All tables use UUIDs as primary keys and include proper indexes for performance.

---

##  Architecture

```
backend/
  src/
    controllers/      # HTTP request handlers
    services/         # Business logic
    matchers/         # Matching algorithms (pluggable)
    parsers/          # Intent parsing (replaceable)
    workflows/        # State machine logic
    routes/           # API route definitions
    db/               # Database client

frontend/
  src/
    components/       # React components
    api/              # API client
```

### Key Design Patterns
- **Service Layer**: Controllers delegate to services
- **Strategy Pattern**: Matcher interface allows algorithm swapping
- **State Machine**: Enforced lead lifecycle transitions
- **Repository Pattern**: Prisma ORM abstracts data access

---

##  Next Steps

See [TODO.md](../TODO.md) for planned features and enhancements.

---

##  Notes

- This is a **demo prototype**, not production-ready
- No authentication/authorization implemented yet
- Matching algorithm is rule-based (ML replacement planned)
- Intent parser is keyword-based (NLP replacement planned)
- No background job processing yet
- No monitoring/alerting configured

---

##  License

This project is for educational purposes as part of the DASS Spring 2026 course.
