#  Hublet User Guide

Complete guide to using the Hublet real estate platform with step-by-step instructions for all user roles.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Admin Dashboard](#admin-dashboard)
- [Buyer Workflow](#buyer-workflow)
- [Seller Workflow](#seller-workflow)
- [Demo Data Reference](#demo-data-reference)
- [Matching Algorithm](#matching-algorithm)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### First Time Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd project-monorepo-team-46
   ```

2. **Set up backend**

   ```bash
   cd src/backend
   npm install
   npx prisma generate
   npx prisma migrate dev
   npx tsx prisma/seed.ts
   ```

3. **Set up frontend**

   ```bash
   cd ../frontend
   npm install
   ```

4. **Start both servers**

   Terminal 1 (Backend):

   ```bash
   cd src/backend
   npm run dev
   ```

   Terminal 2 (Frontend):

   ```bash
   cd src/frontend
   npm run dev
   ```

5. **Open the application**

   Navigate to: `http://localhost:5173`

---

## Admin Dashboard

### Accessing Admin View

1. Go to `http://localhost:5173`
2. Click **"Login as Admin"** button on the home page
3. You'll be redirected to `/admin`

### Admin Features

#### View All Buyers

- **Location:** Top section of admin dashboard
- **Information Displayed:**
  - Name, email, phone
  - Preferred localities (click to expand)
  - Budget range
  - BHK requirements
  - Desired amenities
  - Additional notes

#### View All Sellers

- **Location:** Below buyers section
- **Information Displayed:**
  - Name, email, phone
  - Seller type (Agent, Builder, Owner)
  - Rating (0-5 stars)
  - Trust score percentage

#### View All Properties

- **Location:** Below sellers section
- **Information Displayed:**
  - Title and description
  - Location (city + locality)
  - Price in Crores
  - Size (BHK)
  - Area in sq ft
  - Available amenities
  - Seller information (name, email, phone)

#### View All Leads

- **Location:** Below properties section
- **Information Displayed:**
  - Lead ID and status (NEW, ENRICHED, QUALIFIED, etc.)
  - Buyer name, email, phone
  - Property title and location
  - Property price
  - Created date

#### View Match Summary

- **Location:** Below leads section
- **Information Displayed:**
  - Buyer name
  - Property title and price
  - Match score percentage
  - Score breakdown (Location, Budget, Size, Amenities)
  - Notes about the match quality

#### View Workflow Events (Audit Log)

- **Location:** Bottom of admin dashboard
- **Information Displayed:**
  - Event type (BUYER_CREATED, MATCH_FOUND, LEAD_CREATED, etc.)
  - Entity type and ID
  - Timestamp
  - Additional metadata
- **Purpose:** Complete audit trail of all system operations

### Admin Dashboard Usage Tips

- All data is read-only for admins
- Use the workflow events to trace any operation in the system
- Match scores above 50% indicate good potential leads
- Check lead status to understand pipeline health

---

## Buyer Workflow

### 1. Sign Up as a Buyer

1. Go to `http://localhost:5173`
2. Click **"Buyer Login/Signup"**
3. On the auth page, click **"Sign up"** tab
4. Fill in the signup form:
   - **Name:** Your full name
   - **Email:** Valid email (used for login)
   - **Phone:** Contact number
   - **Localities:** Comma-separated list (e.g., "Bandra, Andheri, Powai")
   - **Min Budget:** Minimum price in Crores
   - **Max Budget:** Maximum price in Crores
   - **BHK:** Select from 1, 2, 3, or 4 BHK
   - **Amenities:** Comma-separated (e.g., "Parking, Gym, Pool")
5. Click **"Sign Up"**
6. You'll be redirected to your buyer dashboard at `/buyer/:userId`

### 2. Login as an Existing Buyer

1. Go to `http://localhost:5173`
2. Click **"Buyer Login/Signup"**
3. Stay on the **"Login"** tab
4. Enter your registered email
5. Click **"Login"**
6. You'll be redirected to your dashboard

**Demo Buyer Emails:**

- `buyer1@bandra.com` through `buyer6@...` (Mumbai)
- `buyer7@hitechcity.com` through `buyer12@...` (Hyderabad)
- `buyer13@cp.com` through `buyer18@...` (Delhi)

### 3. Update Your Preferences

Once logged in, you'll see a form to update your preferences:

#### Standard Fields

- **Name:** Update your name
- **Email:** Update your email
- **Phone:** Update your phone number
- **Localities:** Comma-separated list of preferred areas
- **Min Budget:** Minimum price you're willing to pay (Crores)
- **Max Budget:** Maximum price you're willing to pay (Crores)
- **BHK:** Select 1, 2, 3, or 4 BHK
- **Amenities:** Comma-separated list (e.g., "Parking, Gym, Swimming Pool, Garden")

#### Additional Notes (Text Box)

Use this large text box to provide natural language descriptions:

- Specific requirements not captured in the form
- Preferred floor level
- Facing preferences (North, South, etc.)
- Proximity requirements (near school, metro, etc.)
- Timeline constraints
- Any other custom requirements

**Example:**

```
I prefer properties on floors 5-10, facing east or north. Must be within 
1km of a metro station. Looking to move by June 2026. Open to slightly 
higher prices if the property has a balcony and good natural light.
```

### 4. Find Property Matches

1. After updating your preferences, click **"Update Preferences"**
2. The system will automatically trigger the matching algorithm
3. Matched properties will appear below the form
4. Each match shows:
   - Property title, location, price
   - Property details (BHK, area, amenities)
   - **Match score percentage**
   - Score breakdown:
     - Location score (35% weight)
     - Budget score (30% weight)
     - Size score (20% weight)
     - Amenities score (15% weight)
   - Seller contact information (name, email, phone)

### 5. View Match Details

- Properties are sorted by match score (highest first)
- Only properties with 50%+ match score are displayed
- Green text highlights the match quality
- Contact sellers directly using the provided information

### 6. Return to Home

- Click the **"Back to Home"** button to logout
- You'll be redirected to the landing page

---

## Seller Workflow

### 1. Sign Up as a Seller

1. Go to `http://localhost:5173`
2. Click **"Seller Login/Signup"**
3. On the auth page, click **"Sign up"** tab
4. Fill in the signup form:
   - **Name:** Your full name
   - **Email:** Valid email (used for login)
   - **Phone:** Contact number
   - **Seller Type:** Choose from Agent, Builder, or Owner
5. Click **"Sign Up"**
6. You'll be redirected to your seller dashboard at `/seller/:userId`

### 2. Login as an Existing Seller

1. Go to `http://localhost:5173`
2. Click **"Seller Login/Signup"**
3. Stay on the **"Login"** tab
4. Enter your registered email
5. Click **"Login"**
6. You'll be redirected to your dashboard

**Demo Seller Emails:**

- `seller1@bandra.com` through `seller6@...` (Mumbai)
- `seller7@hitechcity.com` through `seller12@...` (Hyderabad)
- `seller13@cp.com` through `seller18@...` (Delhi)

### 3. Add a New Property

On your seller dashboard, you'll see a form to add properties:

#### Property Form Fields

- **Title:** Property name/title (e.g., "Luxury 3BHK in Bandra West")
- **Description:** Detailed property description
- **City:** City name (e.g., Mumbai, Hyderabad, Delhi)
- **Locality:** Specific area (e.g., Bandra, Gachibowli, Saket)
- **Price:** Property price in Crores (e.g., 5.5 for ₹5.5 Crores)
- **BHK:** Select 1, 2, 3, or 4 BHK
- **Area:** Property area in square feet
- **Amenities:** Comma-separated list (e.g., "Parking, Gym, Pool, Security")

#### After Filling the Form

1. Click **"Add Property"**
2. The property will be added to your listings
3. The form will clear, ready for another property
4. The new property appears in "Your Properties" section below

### 4. View Your Properties

Below the add property form, you'll see all your listed properties:

- Property title and description
- Location (city + locality)
- Price in Crores
- Size (BHK) and area
- Amenities list

### 5. View Matched Buyers

For each property, you'll see a list of matched buyers:

#### Match Information

- Buyer name, email, phone
- **Match score percentage**
- Score breakdown (Location, Budget, Size, Amenities)
- Match quality notes

#### Using Match Data

- Contact high-scoring buyers (70%+ matches) first
- Use the score breakdown to understand buyer alignment
- Multiple buyers per property indicates high demand
- No matches? Consider adjusting price or amenities

### 6. Return to Home

- Click the **"Back to Home"** button to logout
- You'll be redirected to the landing page

---

## Demo Data Reference

### Mumbai Properties (6 properties)

| Locality | Property | Seller Email | Buyer Email |
|----------|----------|--------------|-------------|
| Bandra | Luxury 3BHK | seller1@bandra.com | buyer1@bandra.com |
| Andheri | Modern 2BHK | seller2@andheri.com | buyer2@andheri.com |
| Powai | Premium 4BHK | seller3@powai.com | buyer3@powai.com |
| Juhu | Beachside 3BHK | seller4@juhu.com | buyer4@juhu.com |
| Worli | High-rise 2BHK | seller5@worli.com | buyer5@worli.com |
| Malad | Spacious 3BHK | seller6@malad.com | buyer6@malad.com |

### Hyderabad Properties (6 properties)

| Locality | Property | Seller Email | Buyer Email |
|----------|----------|--------------|-------------|
| Hitech City | Tech Hub 2BHK | seller7@hitechcity.com | buyer7@hitechcity.com |
| Gachibowli | IT Park 3BHK | seller8@gachibowli.com | buyer8@gachibowli.com |
| Banjara Hills | Luxury Villa 4BHK | seller9@banjarahills.com | buyer9@banjarahills.com |
| Jubilee Hills | Premium 3BHK | seller10@jubileehills.com | buyer10@jubileehills.com |
| Madhapur | Modern 2BHK | seller11@madhapur.com | buyer11@madhapur.com |
| Kondapur | Spacious 3BHK | seller12@kondapur.com | buyer12@kondapur.com |

### Delhi Properties (6 properties)

| Locality | Property | Seller Email | Buyer Email |
|----------|----------|--------------|-------------|
| Connaught Place | Central 2BHK | seller13@cp.com | buyer13@cp.com |
| Saket | Modern 3BHK | seller14@saket.com | buyer14@saket.com |
| Dwarka | Affordable 2BHK | seller15@dwarka.com | buyer15@dwarka.com |
| Rohini | Family 3BHK | seller16@rohini.com | buyer16@rohini.com |
| Vasant Kunj | Luxury 4BHK | seller17@vasantkunj.com | buyer17@vasantkunj.com |
| Hauz Khas | Premium 3BHK | seller18@hauzkhas.com | buyer18@hauzkhas.com |

### Price Ranges

- **Mumbai:** ₹4 Cr - ₹25 Cr
- **Hyderabad:** ₹5 Cr - ₹20 Cr
- **Delhi:** ₹6 Cr - ₹30 Cr

### Common Amenities

- Parking
- Gym
- Swimming Pool
- Security
- Garden
- Club House

---

## Matching Algorithm

### How Matching Works

When a buyer updates their preferences, the system:

1. Fetches all properties from the database
2. Calculates a match score for each property
3. Returns properties with score ≥ 50%
4. Logs the match event in the audit trail

### Score Calculation

The match score is a weighted combination of four factors:

#### 1. Location Score (35% weight)

- Checks if property locality is in buyer's preferred localities
- **100%** if locality matches exactly
- **0%** if no match

**Example:**

```
Buyer localities: ["Bandra", "Andheri", "Powai"]
Property locality: "Bandra"
→ Location score: 100% → Weighted: 35%
```

#### 2. Budget Score (30% weight)

- Compares property price against buyer's budget range
- **100%** if price is within budget
- **Decreases linearly** as price deviates from budget

**Formula:**

```
If price within [minBudget, maxBudget]:
  score = 100%
Else if price < minBudget:
  score = max(0, 100 - (minBudget - price) / minBudget * 100)
Else if price > maxBudget:
  score = max(0, 100 - (price - maxBudget) / maxBudget * 100)
```

**Example:**

```
Buyer budget: ₹5 Cr - ₹10 Cr
Property price: ₹7 Cr
→ Budget score: 100% → Weighted: 30%

Property price: ₹12 Cr (20% over budget)
→ Budget score: 80% → Weighted: 24%
```

#### 3. Size Score (20% weight)

- Compares property BHK with buyer's requirement
- **100%** if exact match
- **75%** if difference is 1 BHK
- **50%** if difference is 2 BHK
- **25%** if difference is 3 BHK

**Example:**

```
Buyer BHK: 3
Property BHK: 3
→ Size score: 100% → Weighted: 20%

Property BHK: 2 (1 BHK difference)
→ Size score: 75% → Weighted: 15%
```

#### 4. Amenities Score (15% weight)

- Counts how many of buyer's desired amenities the property has
- **Score = (matching amenities / total buyer amenities) * 100**

**Example:**

```
Buyer amenities: ["Parking", "Gym", "Pool", "Security"]
Property amenities: ["Parking", "Gym", "Security", "Garden"]
Matching: 3 out of 4
→ Amenities score: 75% → Weighted: 11.25%
```

### Final Match Score

```
Final Score = (Location × 0.35) + (Budget × 0.30) + (Size × 0.20) + (Amenities × 0.15)
```

**Example:**

```
Location: 100% × 0.35 = 35%
Budget: 100% × 0.30 = 30%
Size: 75% × 0.20 = 15%
Amenities: 75% × 0.15 = 11.25%

Final Score = 91.25% (Excellent match!)
```

### Match Quality Interpretation

- **90-100%:** Excellent match - Highly recommended
- **75-89%:** Very good match - Strong fit
- **60-74%:** Good match - Worth considering
- **50-59%:** Decent match - May have trade-offs
- **Below 50%:** Not shown to buyer

---

## API Reference

### Base URL

- **Backend:** `http://localhost:3000`
- **API Base:** `http://localhost:3000/api`

### Buyer Endpoints

#### Get All Buyers

```http
GET /api/buyers
```

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "localities": ["Bandra", "Andheri"],
    "minBudget": 5,
    "maxBudget": 10,
    "bhk": 3,
    "amenities": ["Parking", "Gym"],
    "additionalNotes": "Near metro station",
    "createdAt": "2026-01-01T00:00:00Z"
  }
]
```

#### Get Buyer by ID

```http
GET /api/buyers/:id
```

#### Create Buyer

```http
POST /api/buyers
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "localities": ["Bandra", "Andheri"],
  "minBudget": 5,
  "maxBudget": 10,
  "bhk": 3,
  "amenities": ["Parking", "Gym"],
  "additionalNotes": "Near metro station"
}
```

#### Update Buyer

```http
PUT /api/buyers/:id
Content-Type: application/json

{
  "localities": ["Powai", "Bandra"],
  "minBudget": 7,
  "maxBudget": 12
}
```

#### Login Buyer (by Email)

```http
POST /api/buyers/login
Content-Type: application/json

{
  "email": "john@example.com"
}
```

### Seller Endpoints

#### Get All Sellers

```http
GET /api/sellers
```

#### Get Seller by ID

```http
GET /api/sellers/:id
```

#### Create Seller

```http
POST /api/sellers
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "9876543210",
  "sellerType": "Agent"
}
```

#### Login Seller (by Email)

```http
POST /api/sellers/login
Content-Type: application/json

{
  "email": "jane@example.com"
}
```

### Property Endpoints

#### Get All Properties

```http
GET /api/properties
```

#### Get Property by ID

```http
GET /api/properties/:id
```

#### Create Property

```http
POST /api/properties
Content-Type: application/json

{
  "title": "Luxury 3BHK",
  "description": "Modern apartment in prime location",
  "city": "Mumbai",
  "locality": "Bandra",
  "price": 7.5,
  "bhk": 3,
  "area": 1500,
  "amenities": ["Parking", "Gym", "Pool"],
  "sellerId": "seller-uuid"
}
```

### Match Endpoints

#### Get Matches for Buyer

```http
GET /api/matches/buyer/:buyerId
```

**Response:**

```json
[
  {
    "propertyId": "uuid",
    "propertyTitle": "Luxury 3BHK",
    "propertyLocation": "Bandra, Mumbai",
    "propertyPrice": 7.5,
    "matchScore": 91.25,
    "locationScore": 100,
    "budgetScore": 100,
    "sizeScore": 75,
    "amenitiesScore": 75,
    "sellerName": "Jane Smith",
    "sellerEmail": "jane@example.com",
    "sellerPhone": "9876543210"
  }
]
```

#### Trigger Match Finding

```http
POST /api/matches/buyer/:buyerId/find
```

This endpoint recalculates matches for the given buyer.

#### Get Matches for Seller

```http
GET /api/matches/seller/:sellerId
```

Returns buyers matched with the seller's properties.

### Lead Endpoints

#### Get All Leads

```http
GET /api/leads
```

#### Get Lead by ID

```http
GET /api/leads/:id
```

### Workflow Event Endpoints

#### Get All Workflow Events

```http
GET /api/workflow-events
```

**Response:**

```json
[
  {
    "id": "uuid",
    "eventType": "BUYER_CREATED",
    "entityType": "Buyer",
    "entityId": "buyer-uuid",
    "timestamp": "2026-01-01T00:00:00Z",
    "metadata": "{\"name\":\"John Doe\"}"
  }
]
```

---

## Troubleshooting

### Common Issues

#### 1. White Screen on Frontend

**Symptom:** Browser shows blank white screen

**Solution:**

```bash
# Check browser console for errors
# Ensure both servers are running

# Terminal 1 - Backend
cd src/backend
npm run dev

# Terminal 2 - Frontend
cd src/frontend
npm run dev
```

#### 2. Port Already in Use

**Symptom:** Error: "Port 3000 is already in use"

**Solution:**

```bash
# Kill the process using the port
lsof -ti:3000 | xargs kill -9

# Restart the backend
npm run dev
```

#### 3. Database Not Found

**Symptom:** Error: "Cannot find database file"

**Solution:**

```bash
cd src/backend
npx prisma migrate dev
npx tsx prisma/seed.ts
```

#### 4. No Matches Found

**Symptom:** Buyer sees "No matches found"

**Possible causes:**

- Budget too low/high for available properties
- Localities don't match any properties
- BHK requirement doesn't match
- All properties scored below 50%

**Solution:**

- Check demo data matches your city
- Adjust budget range
- Add more localities
- Try flexible BHK requirements

#### 5. Login Not Working

**Symptom:** "User not found" error

**Solution:**

- Ensure you're using a valid demo email (see Demo Data Reference)
- Or sign up as a new user first
- Check that the backend is running

#### 6. Navigation Back Button Not Working

**Symptom:** Back button takes you to unexpected pages

**Solution:**

- This should be fixed with React Router
- If issue persists, use the "Back to Home" buttons in the UI
- Avoid using browser back button during signup/login flow

#### 7. Amenities Not Matching

**Symptom:** Properties with amenities not showing up

**Cause:** Amenity strings must match exactly (case-sensitive)

**Solution:**

Use standard amenities:

- Parking
- Gym
- Swimming Pool (not "Pool")
- Security
- Garden
- Club House

---

## Additional Resources

- **Architecture Details:** `reports/ARCHITECTURE.md`
- **Implementation Notes:** `reports/IMPLEMENTATION_COMPLETE.md`
- **Migration Guide:** `reports/SQLITE_MIGRATION.md`
- **Technical Docs:** `src/README.md`

---

## Support

For bugs or feature requests, please open an issue on the repository.

**Course:** DASS Spring 2026  
**Institution:** IIIT Hyderabad  
**Team:** Team 46

---

**Last Updated:** January 2026
