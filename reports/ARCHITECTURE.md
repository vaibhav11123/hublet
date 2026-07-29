# Hublet Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React + Vite)                    │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │  BuyerForm   │  │ SellerForm   │  │ PropertyForm │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                  │                     │
│         └──────────────────┼──────────────────┘                     │
│                            │                                        │
│                   ┌────────▼────────┐                              │
│                   │  MatchViewer    │                              │
│                   └────────┬────────┘                              │
│                            │                                        │
│                   ┌────────▼────────┐                              │
│                   │   API Client    │  (axios)                     │
│                   │   (client.ts)   │                              │
│                   └────────┬────────┘                              │
└────────────────────────────┼────────────────────────────────────────┘
                             │ HTTP REST API
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    BACKEND (Node.js + Express)                      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                        ROUTES                                │  │
│  │  /api/buyers  /api/sellers  /api/properties  /api/matches   │  │
│  └───────────────────────┬─────────────────────────────────────┘  │
│                          │                                          │
│  ┌───────────────────────▼─────────────────────────────────────┐  │
│  │                     CONTROLLERS                              │  │
│  │  BuyerCtrl  SellerCtrl  PropertyCtrl  MatchingCtrl LeadCtrl │  │
│  └───────────────────────┬─────────────────────────────────────┘  │
│                          │                                          │
│  ┌───────────────────────▼─────────────────────────────────────┐  │
│  │                      SERVICES                                │  │
│  │                                                              │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌────────────────┐     │  │
│  │  │  Buyer     │  │   Seller     │  │   Property     │     │  │
│  │  │  Service   │  │   Service    │  │   Service      │     │  │
│  │  └────────────┘  └──────────────┘  └────────────────┘     │  │
│  │                                                              │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌────────────────┐     │  │
│  │  │   Lead     │  │   Matching   │  │  WorkflowEvent │     │  │
│  │  │  Service   │  │   Service    │  │    Service     │     │  │
│  │  └─────┬──────┘  └──────┬───────┘  └────────────────┘     │  │
│  │        │                 │                                  │  │
│  └────────┼─────────────────┼──────────────────────────────────┘  │
│           │                 │                                      │
│  ┌────────▼─────────────────▼──────────────────────────────────┐  │
│  │                 DOMAIN LOGIC                                 │  │
│  │                                                              │  │
│  │  ┌──────────────────┐        ┌──────────────────┐          │  │
│  │  │  State Machine   │        │  Intent Parser   │          │  │
│  │  │  (LeadState)     │        │  (keyword-based) │          │  │
│  │  │                  │        │  [Pluggable]     │          │  │
│  │  │  NEW → ENRICHED  │        └──────────────────┘          │  │
│  │  │    → QUALIFIED   │                                       │  │
│  │  │    → NOTIFIED    │        ┌──────────────────┐          │  │
│  │  │    → CONTACTED   │        │   Matcher        │          │  │
│  │  │    → CLOSED      │        │  (rule-based)    │          │  │
│  │  │                  │        │  [Pluggable]     │          │  │
│  │  └──────────────────┘        │                  │          │  │
│  │                              │  • Location 35%  │          │  │
│  │                              │  • Budget 30%    │          │  │
│  │                              │  • Size 20%      │          │  │
│  │                              │  • Amenities 15% │          │  │
│  │                              └──────────────────┘          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      PRISMA ORM                              │  │
│  │                   (Type-Safe Database Access)                │  │
│  └───────────────────────────┬──────────────────────────────────┘  │
└────────────────────────────────┼───────────────────────────────────┘
                                 │
┌────────────────────────────────▼───────────────────────────────────┐
│                    POSTGRESQL DATABASE                             │
│                                                                    │
│  ┌────────┐  ┌────────┐  ┌───────────┐  ┌───────┐  ┌─────────┐  │
│  │ buyers │  │sellers │  │properties │  │ leads │  │ matches │  │
│  └────────┘  └────────┘  └───────────┘  └───────┘  └─────────┘  │
│                                                                    │
│  ┌──────────────────┐                                             │
│  │ workflow_events  │  (Audit Log)                                │
│  └──────────────────┘                                             │
│                                                                    │
│  Features:                                                         │
│  • UUIDs as primary keys                                          │
│  • JSONB for flexible metadata                                    │
│  • Indexes on searchable fields                                   │
│  • Foreign key constraints                                        │
└────────────────────────────────────────────────────────────────────┘


DATA FLOW EXAMPLE (Finding Matches):
═══════════════════════════════════════

1. User clicks "Find Matches" in MatchViewer
   ↓
2. Frontend calls: POST /api/matches/buyer/{id}/find
   ↓
3. MatchingController receives request
   ↓
4. MatchingService.findMatchesForBuyer() called
   ↓
5. Fetch buyer intent from database (via Prisma)
   ↓
6. Fetch all active properties from database
   ↓
7. For each property:
   → RuleBasedMatcher.score() calculates match score
   → Score breakdown: location, budget, size, amenities
   ↓
8. Filter properties with score ≥ minScore
   ↓
9. Sort by total score (descending)
   ↓
10. Store matches in database
    ↓
11. Log event to workflow_events table
    ↓
12. Return ranked matches to frontend
    ↓
13. MatchViewer displays results with score breakdown


EXTENSION POINTS (Pluggable Components):
════════════════════════════════════════

┌──────────────────────────────────────────────────────────┐
│ Interface: Matcher                                        │
│ Current: RuleBasedMatcher                                │
│ Future:  MLMatcher, HybridMatcher                        │
│                                                           │
│ score(buyerIntent, property) → MatchResult               │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Interface: IntentParser                                   │
│ Current: KeywordIntentParser                             │
│ Future:  NLPParser, LLMParser                            │
│                                                           │
│ parse(rawText) → ParsedIntent                            │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ State Machine                                             │
│ Enforced transitions with validation                     │
│ Guards prevent invalid state changes                     │
│ All transitions logged to workflow_events                │
└──────────────────────────────────────────────────────────┘


TECHNOLOGY STACK:
═════════════════

Frontend:
• React 18+
• TypeScript
• Vite (build tool)
• Axios (HTTP client)

Backend:
• Node.js 18+
• TypeScript
• Express.js
• Prisma ORM
• PostgreSQL 14+

Development:
• tsx (TypeScript execution)
• dotenv (environment config)
• CORS enabled
