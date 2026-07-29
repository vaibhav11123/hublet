# TODO - Deferred Features

This document tracks features that were intentionally deferred from the initial prototype to maintain demo-readiness and clean architecture. Each item includes the reason for deferral and a suggested implementation approach.

---

##  Authentication & Authorization

### Current State
- No authentication implemented
- All API endpoints are public

### Why Deferred
- Adds significant complexity
- Not critical for prototype demo
- Can be layered on without major refactoring

### Suggested Implementation
- **JWT-based authentication**:
  - Use `jsonwebtoken` library
  - Add `/api/auth/login` and `/api/auth/register` endpoints
  - Implement middleware for route protection
- **Role-Based Access Control (RBAC)**:
  - Add `role` field to users (admin, buyer, seller)
  - Create authorization middleware
  - Restrict endpoints by role
- **Libraries**: `passport.js`, `jsonwebtoken`, `bcrypt`

---

##  ML-Based Matching

### Current State
- Rule-based matcher with weighted scoring
- Deterministic, transparent algorithm

### Why Deferred
- ML models require significant data
- Training/deployment infrastructure needed
- Rule-based is sufficient for demo

### Suggested Implementation
- **Data Collection Phase**:
  - Log all matches and user feedback
  - Track which matches led to leads
  - Collect click-through rates
- **Model Options**:
  - Collaborative filtering (user-item interactions)
  - Content-based filtering (property features)
  - Hybrid approach combining both
- **Integration**:
  - Implement ML matcher as new class implementing `Matcher` interface
  - Feature engineering from buyer intent + property data
  - A/B test against rule-based matcher
- **Tools**: Python + scikit-learn, TensorFlow, or PyTorch
  - Serve via REST API or gRPC
  - Use Redis for model caching

---

##  Advanced NLP Intent Parsing

### Current State
- Keyword-based regex parser
- Extracts: locality, BHK, budget, area, amenities

### Why Deferred
- NLP models are large and slow
- Requires training on real-estate domain data
- Regex works well enough for demo

### Suggested Implementation
- **Phase 1: Rule Improvement**
  - Expand regex patterns
  - Add synonym dictionaries
  - Handle variations in language
- **Phase 2: NLP Integration**
  - Use spaCy for entity recognition
  - Train custom NER model for real-estate entities
  - Extract structured data from unstructured text
- **Phase 3: LLM Integration** (optional)
  - Use OpenAI GPT or open-source LLMs
  - Structured output generation
  - Handle complex queries
- **Libraries**: spaCy, Hugging Face Transformers, OpenAI API

---

##  Comparative Market Analysis (CMA) Valuation

### Current State
- Properties have fixed prices
- No automated valuation

### Why Deferred
- Requires historical transaction data
- Complex domain-specific algorithms
- Not essential for matching demo

### Suggested Implementation
- **Data Requirements**:
  - Historical sale prices
  - Property characteristics
  - Location data (lat/long, nearby amenities)
  - Market trends
- **Algorithm Options**:
  - Hedonic pricing model (regression)
  - Comparable sales approach
  - Machine learning valuation model
- **Features to Consider**:
  - Square footage, BHK, age
  - Location (distance to amenities, schools, transit)
  - Market conditions (supply/demand)
- **Tools**: scikit-learn for regression, Zillow Zestimate as reference

---

## ️ Asynchronous Background Jobs

### Current State
- All operations are synchronous
- Matching runs on API request

### Why Deferred
- Adds infrastructure complexity
- Prototype scale doesn't require it
- Can be added without major refactoring

### Suggested Implementation
- **Use Cases**:
  - Periodic re-matching of all buyers
  - Email/SMS notifications
  - Data enrichment tasks
  - Report generation
- **Queue System Options**:
  - **BullMQ** (Redis-based, recommended)
  - **Agenda** (MongoDB-based)
  - **AWS SQS** (cloud-native)
- **Architecture**:
  - Separate worker processes
  - Job scheduling with cron
  - Retry logic for failures
  - Job monitoring dashboard
- **Implementation Steps**:
  1. Add BullMQ to backend
  2. Create job definitions (e.g., `matchBuyers`, `sendNotifications`)
  3. Move long-running tasks to queue
  4. Set up worker processes

---

##  Web Scraping & Data Ingestion

### Current State
- Properties entered manually via UI/API
- No automated data ingestion

### Why Deferred
- Legal and ethical considerations
- Complex parsing and normalization
- Not needed for prototype

### Suggested Implementation
- **Sources**:
  - Real-estate listing websites
  - Public MLS data (if available)
  - APIs from property platforms
- **Approach**:
  - Use `Puppeteer` or `Playwright` for dynamic sites
  - Respect robots.txt and rate limits
  - Implement deduplication logic
  - Normalize data to schema
- **Challenges**:
  - Anti-scraping measures
  - Data quality and consistency
  - Legal compliance
- **Alternatives**:
  - Partner with data providers
  - Use official APIs where available

---

##  Notifications System

### Current State
- No notifications on new matches
- State transitions not communicated

### Why Deferred
- Requires email/SMS infrastructure
- Adds external dependencies
- Demo doesn't require it

### Suggested Implementation
- **Channels**:
  - Email (transactional)
  - SMS (high-priority)
  - In-app notifications
  - Push notifications (mobile)
- **Triggers**:
  - New match found
  - Lead state transition
  - Property price change
  - Saved search alerts
- **Tools**:
  - **Email**: SendGrid, AWS SES, Nodemailer
  - **SMS**: Twilio, AWS SNS
  - **Push**: Firebase Cloud Messaging
- **Template System**:
  - Use Handlebars or Pug for email templates
  - Personalized content
  - Unsubscribe management

---

##  Advanced RBAC & Permissions

### Current State
- No user roles or permissions
- Everyone can access everything

### Why Deferred
- Complex permission matrix
- Not needed for single-user demo

### Suggested Implementation
- **Roles**:
  - `admin`: Full system access
  - `seller`: Manage own properties
  - `buyer`: View matches, manage preferences
  - `agent`: Act on behalf of buyers/sellers
- **Permissions**:
  - Create, Read, Update, Delete for each resource
  - Resource ownership checks
  - Scoped queries (users see only their data)
- **Implementation**:
  - Add `role` field to user model
  - Create middleware for role checks
  - Use libraries like `accesscontrol` or `casl`

---

##  Analytics & Reporting

### Current State
- Basic workflow event logging
- No aggregated metrics or dashboards

### Why Deferred
- Requires data visualization tools
- Analytics design is time-consuming
- Not critical for matching demo

### Suggested Implementation
- **Metrics to Track**:
  - Match conversion rates
  - Lead progression through states
  - Popular localities and price ranges
  - Seller performance
  - User engagement
- **Tools**:
  - **Backend**: PostgreSQL views, Prisma aggregations
  - **Visualization**: Chart.js, D3.js, or Recharts
  - **BI Tools**: Metabase, Grafana, Superset
- **Dashboards**:
  - Admin: System overview, user activity
  - Seller: Property views, match stats
  - Buyer: Saved searches, match history

---

##  Testing Infrastructure

### Current State
- No automated tests
- Manual testing only

### Why Deferred
- Tests slow down initial development
- Architecture needed to stabilize first

### Suggested Implementation
- **Unit Tests**:
  - Service layer methods
  - Matcher algorithm
  - State machine transitions
  - Use Jest or Vitest
- **Integration Tests**:
  - API endpoints
  - Database operations
  - Use Supertest + Jest
- **E2E Tests**:
  - User flows in browser
  - Use Playwright or Cypress
- **Coverage Goals**:
  - 80%+ for services
  - 100% for state machine
  - Critical paths fully covered

---

##  Deployment & DevOps

### Current State
- Local development only
- No CI/CD pipeline

### Why Deferred
- Not needed for prototype demo
- Infrastructure setup is time-intensive

### Suggested Implementation
- **Containerization**:
  - Docker for backend + frontend
  - Docker Compose for local multi-service setup
- **Hosting Options**:
  - **Backend**: AWS ECS, Render, Railway, Fly.io
  - **Database**: AWS RDS, Supabase, Neon
  - **Frontend**: Vercel, Netlify, Cloudflare Pages
- **CI/CD**:
  - GitHub Actions for automated testing
  - Deploy on push to `main`
  - Environment-based deployments (dev, staging, prod)
- **Monitoring**:
  - Application logs (Winston, Pino)
  - Error tracking (Sentry)
  - Uptime monitoring (UptimeRobot, Better Uptime)
  - APM (New Relic, DataDog)

---

##  Geospatial Features

### Current State
- Locality is a text field
- No distance calculations

### Why Deferred
- Requires geospatial database extensions
- Complex distance-based matching
- Not essential for initial demo

### Suggested Implementation
- **Database**:
  - Enable PostGIS extension in PostgreSQL
  - Store lat/long for properties
  - Use geospatial indexes
- **Features**:
  - Distance-based matching
  - "Properties near me"
  - Map visualization
  - Radius search
- **Tools**:
  - PostGIS for backend
  - Mapbox or Google Maps for frontend
  - Geocoding APIs for address → coordinates

---

##  Payment Integration

### Current State
- No payment processing
- No subscription model

### Why Deferred
- Adds significant compliance burden
- Not needed for lead matching demo

### Suggested Implementation
- **Use Cases**:
  - Seller listing fees
  - Premium buyer features
  - Subscription tiers
- **Payment Providers**:
  - Stripe (recommended for India)
  - Razorpay (India-specific)
  - PayPal
- **Implementation**:
  - Webhook handlers for payment events
  - Subscription management
  - Invoice generation
  - Compliance (PCI-DSS, data security)

---

##  Advanced Search & Filters

### Current State
- Basic filtering by locality, BHK, price
- No full-text search

### Why Deferred
- Full-text search requires indexing infrastructure
- Complex filter UI design

### Suggested Implementation
- **Backend**:
  - PostgreSQL full-text search
  - Or use Elasticsearch for advanced queries
- **Filters**:
  - Multiple localities (OR condition)
  - Price range sliders
  - Amenity checkboxes
  - Property type
  - Date listed
  - Sort options
- **UI**:
  - Filter sidebar
  - Search suggestions
  - Saved searches

---

##  Mobile App

### Current State
- Web-only interface
- Not mobile-optimized

### Why Deferred
- Mobile development is a separate effort
- API-first design allows future mobile app

### Suggested Implementation
- **Approach**:
  - React Native (code reuse from React)
  - Or native iOS/Android apps
- **Features**:
  - Push notifications
  - Location-based search
  - Camera for property photos
  - Offline support
- **Backend**: No changes needed, REST API already ready

---

##  Rate Limiting & Security

### Current State
- No rate limiting
- Basic error handling
- No input sanitization

### Why Deferred
- Not critical for closed demo
- Can be added as middleware

### Suggested Implementation
- **Rate Limiting**:
  - Use `express-rate-limit`
  - Per-IP and per-user limits
  - Different limits for different endpoints
- **Security Measures**:
  - Input validation with Zod or Joi
  - SQL injection prevention (Prisma handles this)
  - XSS protection with `helmet`
  - CORS configuration
  - HTTPS in production
- **Tools**: `helmet`, `express-rate-limit`, `express-validator`

---

##  Summary

All deferred features have clear extension points in the current architecture. The modular design ensures that adding these features won't require major refactoring. Prioritize based on user feedback and business needs.

**Next Sprint Priorities** (Based on Client Feedback):
1. Authentication & RBAC
2. Asynchronous job processing
3. Email notifications
4. Testing infrastructure
5. Deployment pipeline
