#  Hublet Demo Script

This guide walks you through demonstrating the Hublet prototype to your client.

## Prerequisites
- Backend running on `http://localhost:3000`
- Frontend running on `http://localhost:5173`
- PostgreSQL database set up and migrated

---

## Demo Flow (10-15 minutes)

### 1. Introduction (1 minute)
**What to say:**
> "Hublet is a real-estate lead matching platform that connects property buyers with relevant listings using intelligent scoring. Let me show you how it works."

**Show:** Open `http://localhost:5173` - the landing page with tabs

---

### 2. Create a Seller (2 minutes)

**Navigate to:** "Add Seller" tab

**What to say:**
> "First, let's add a property seller. The system tracks seller reputation through ratings and completed deals, which feeds into a trust score."

**Demo actions:**
1. Fill in:
   - Name: `Rajesh Kumar`
   - Email: `rajesh@propertyhub.com`
   - Phone: `+91 9876543210`
   - Seller Type: `Broker`
   - Rating: `4.5`
   - Completed Deals: `25`

2. Click "Create Seller"

3. **Point out:** The trust score is auto-calculated (should be ~73)

---

### 3. Add Properties (3 minutes)

**Navigate to:** "Add Property" tab

**What to say:**
> "Now let's add a few properties from this seller. Notice how we can specify amenities, location, and pricing."

**Demo actions - Property 1:**
1. Select seller: `Rajesh Kumar`
2. Fill in:
   - Title: `Spacious 2BHK in Indiranagar`
   - Locality: `Indiranagar`
   - Area: `1200`
   - BHK: `2`
   - Price: `6000000` (60 lakhs)
   - Amenities: `parking, gym, swimming pool`
   - Description: `Modern apartment with all amenities`

3. Click "Add Property"

**Demo actions - Property 2:**
1. Add another property:
   - Title: `Luxury 3BHK in Koramangala`
   - Locality: `Koramangala`
   - Area: `1500`
   - BHK: `3`
   - Price: `9000000` (90 lakhs)
   - Amenities: `parking, gym, garden, security`

**Demo actions - Property 3:**
1. Add one more:
   - Title: `Budget 2BHK in Whitefield`
   - Locality: `Whitefield`
   - Area: `1000`
   - BHK: `2`
   - Price: `4500000` (45 lakhs)
   - Amenities: `parking`

---

### 4. Create Buyer with Intent (3 minutes)

**Navigate to:** "Add Buyer" tab

**What to say:**
> "Here's the interesting part - buyers can describe what they want in natural language. Our system parses this to extract structured intent."

**Demo actions:**
1. Fill in:
   - Name: `Priya Sharma`
   - Email: `priya@example.com`
   - Phone: `+91 9123456789`
   - Property Preferences (free text):
     ```
     Looking for 2 BHK in Indiranagar or Koramangala, 
     budget 50 lakhs to 70 lakhs, minimum 1000 sqft, 
     need parking and gym facilities
     ```

2. Click "Create Buyer"

**Point out:**
> "The system automatically parsed the intent: extracted locations, BHK, budget range, area requirements, and amenities."

---

### 5. Find Matches (4 minutes)

**Navigate to:** "View Matches" tab

**What to say:**
> "Now let's see how our matching algorithm scores properties against Priya's requirements."

**Demo actions:**
1. Select buyer: `Priya Sharma`
2. Click "Find Matches"

**Wait for results to load...**

**Point out the results:**

1. **Top Match** (Indiranagar property):
   - Match Score: ~85-90%
   - Breakdown:
     - Location: 100% (exact match - Indiranagar)
     - Budget: 70-100% (within range)
     - Size: 100% (meets area + BHK)
     - Amenities: 100% (has parking + gym)

2. **Second Match** (Koramangala property):
   - Match Score: ~60-70%
   - Breakdown:
     - Location: 100% (exact match - Koramangala)
     - Budget: 0-40% (over budget)
     - Size: Lower (3BHK when 2BHK requested)
     - Amenities: 100%

3. **Third Match** (Whitefield property):
   - Match Score: ~40-50%
   - Breakdown:
     - Location: 0% (not in preferred localities)
     - Budget: 100% (within range)
     - Size: Good match
     - Amenities: 50% (only parking)

**What to say:**
> "Notice how the system ranks properties by overall match score, but provides a detailed breakdown. The Indiranagar property is the best match because it meets all criteria."

---

### 6. Explain the Scoring Algorithm (2 minutes)

**What to say:**
> "The current matching uses a rule-based algorithm with weighted scoring:
> - Location: 35% weight
> - Budget: 30% weight
> - Size/BHK: 20% weight
> - Amenities: 15% weight
>
> This is designed to be easily replaceable with a machine learning model as we collect more data on which matches convert to actual deals."

---

### 7. Show Additional Features (If Time Permits)

#### API Health Check
**Open browser console:**
```javascript
fetch('http://localhost:3000/health')
  .then(r => r.json())
  .then(console.log)
```

#### Show State Machine (Optional)
**What to say:**
> "The system also includes a lead state machine that tracks the progression of leads through stages: NEW → ENRICHED → QUALIFIED → NOTIFIED → CONTACTED → CLOSED. This ensures proper workflow and prevents invalid state transitions."

---

## Client Questions to Anticipate

### Q: "Can buyers specify multiple localities?"
**A:** Yes! The parser extracts multiple locations. Try: "Looking for property in Indiranagar, Koramangala, or HSR Layout"

### Q: "What if the free-text parsing misses something?"
**A:** Two approaches:
1. Buyers can also manually fill structured fields
2. We can enhance the parser with NLP/ML (noted in TODO.md)

### Q: "How do we prevent fake matches?"
**A:** 
- Seller trust scores (based on ratings + completed deals)
- All matches are logged for audit
- Can add verification workflows in future sprints

### Q: "Can we integrate with existing property portals?"
**A:** Yes - the architecture supports data ingestion via API or web scraping (deferred to TODO.md due to scope)

### Q: "What about notifications?"
**A:** Not in current prototype, but designed as extension point. Email/SMS notifications on new matches is in TODO.md

### Q: "How do we deploy this?"
**A:** Containerization with Docker + deployment to AWS/Azure is planned (TODO.md). Current setup is for development.

---

## Demo Tips

### Before the Demo
1.  Test the full flow once
2.  Clear the database or have clean test data
3.  Have both terminals running (backend + frontend)
4.  Browser zoom set to comfortable level
5.  Close unnecessary tabs

### During the Demo
- **Go slowly** - Let the client absorb each step
- **Highlight the parsing** - Most impressive feature
- **Show the score breakdown** - Explains the algorithm
- **Be ready to add more buyers/properties on the fly**
- **Have TODO.md open** - To discuss future features

### After the Demo
1. Walk through the architecture diagram (ARCHITECTURE.md)
2. Discuss next sprint priorities based on feedback
3. Show the TODO.md for roadmap
4. Ask for specific feedback on:
   - Matching algorithm accuracy
   - UI/UX improvements
   - Missing features that are critical
   - Integration requirements

---

## Backup Plan (If Something Breaks)

### Backend not responding
```bash
# Restart backend
cd backend
npm run dev
```

### Frontend not loading
```bash
# Restart frontend
cd frontend
npm run dev
```

### Database issues
```bash
# Reset and migrate
cd backend
npm run prisma:migrate
```

### Show API directly with curl
If UI breaks, demonstrate via API:
```bash
# Create buyer
curl -X POST http://localhost:3000/api/buyers \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","localities":["Indiranagar"],"bhk":2,"budgetMin":5000000,"budgetMax":7000000}'

# Find matches
curl -X POST "http://localhost:3000/api/matches/buyer/{id}/find?minScore=50"
```

---

## Post-Demo Follow-up

### Gather Feedback
- Which features are most valuable?
- What should we prioritize next?
- Any critical blockers?
- Budget/timeline constraints?

### Next Steps
1. Update TODO.md based on client priorities
2. Create sprint plan for Release 2
3. Set up staging environment if moving forward
4. Begin work on authentication/notifications if approved

---

**Good luck with your demo! **
