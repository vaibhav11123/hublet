# Hublet - Real Estate Lead Matching Platform

##  Recent Updates Summary

###  URL Routing Implemented
React Router has been added to enable proper browser navigation:

#### Routes Structure:
- **`/`** - Home page with login options
- **`/auth/buyer`** - Buyer login/signup page
- **`/auth/seller`** - Seller login/signup page
- **`/admin`** - Admin dashboard (direct access)
- **`/buyer/:userId`** - Buyer dashboard with dynamic user ID
- **`/seller/:userId`** - Seller dashboard with dynamic user ID

#### Navigation Features:
 Browser back/forward buttons now work correctly
 Each page has its own URL
 Users can bookmark specific pages
 Logout properly returns to home page
 Back button from auth pages returns to home

---

##  Complete Feature Set

### 1. **Improved Buyer Interface**
-  Professional form with standard fields:
  - Basic info: Name, Email, Phone
  - Property preferences: Localities, Budget range, BHK, Amenities
  - Additional notes text box for special requirements
-  Form validation and error handling
-  Success messages with automatic match finding
-  Clean, modern UI with proper spacing

### 2. **Authentication System**
-  Separate signup/login pages for buyers and sellers
-  Toggle between login and signup modes
-  Email-based user lookup for login
-  Full registration form for new users
-  Role-specific fields (buyer vs seller)
-  Back button to return to home page

### 3. **Demo Database**
 **18 Sellers** across 3 cities:
- Mumbai: 6 sellers (Bandra, Andheri, Powai, Juhu, Worli, Malad)
- Hyderabad: 6 sellers (Hitech City, Gachibowli, Banjara Hills, Jubilee Hills, Madhapur, Kondapur)
- Delhi: 6 sellers (Connaught Place, Saket, Dwarka, Rohini, Vasant Kunj, Hauz Khas)

 **18 Properties** matching the seller locations:
- Various BHK options (1-4 BHK)
- Price range: ₹4Cr - ₹30Cr
- Multiple property types: Apartment, Villa, Penthouse, Studio
- Modern amenities: Parking, Gym, Pool, Security, Garden, Clubhouse, etc.

 **18 Buyers** with matching preferences:
- City-specific locality preferences
- Budget ranges matching available properties
- Varied BHK requirements
- Amenity preferences

 **10 Sample Leads** in various states

### 4. **Three View System**

#### Admin Dashboard (`/admin`)
- 6 comprehensive tabs:
  1. **Buyers** - All buyer data with preferences
  2. **Sellers** - All seller profiles with ratings
  3. **Properties** - Complete property listings
  4. **Leads** - Lead pipeline with states
  5. **Matches** - Property-buyer matches with scores
  6. **Logs** - Workflow events and system logs
- Summary statistics
- Real-time data updates
- Formatted date/time displays

#### Buyer Dashboard (`/buyer/:userId`)
- Professional preference form
- Property match cards with:
  - Match score breakdown (Location, Budget, Size, Amenities)
  - Property details (BHK, area, price)
  - Seller information
  - Amenity tags
- Responsive grid layout
- Refresh matches functionality

#### Seller Dashboard (`/seller/:userId`)
- Property management:
  - Add new properties
  - View all owned properties
  - Property cards with details
- Match viewing:
  - See interested buyers per property
  - Buyer contact information
  - Match scores
- Clean tabular match display

---

##  How to Use

### Starting the Application:

1. **Start Backend:**
   ```bash
   cd src/backend
   npm run dev
   ```
   Backend runs on: http://localhost:3000

2. **Start Frontend:**
   ```bash
   cd src/frontend
   npm run dev
   ```
   Frontend runs on: http://localhost:5173

3. **Access the Application:**
   - Open: http://localhost:5173
   - You'll see the home page with 3 login options

### Testing the Features:

#### As Admin:
1. Click " Login as Admin"
2. Browse all data across 6 tabs
3. Check statistics and logs
4. URL: http://localhost:5173/admin

#### As Buyer:
1. Click " Buyer Login / Signup"
2. Choose "Sign Up" for new user or "Login" for existing
3. **For demo, login with any of these emails:**
   - `buyer1@bandra.com`
   - `buyer2@andheri.com`
   - `buyer3@powai.com`
   - ... (up to buyer18)
4. Fill preference form with your requirements
5. Click "Update Preferences & Find Matches"
6. View matched properties with scores
7. URL: http://localhost:5173/buyer/[userId]

#### As Seller:
1. Click " Seller Login / Signup"
2. Choose "Sign Up" for new user or "Login" for existing
3. **For demo, login with any of these emails:**
   - `seller1@bandramalad.com`
   - `seller2@andherimarold.com`
   - ... (up to seller18)
4. Add new properties or view existing ones
5. See matched buyers for each property
6. URL: http://localhost:5173/seller/[userId]

---

##  Key Improvements

### Navigation:
-  Proper URL routing with React Router
-  Browser back/forward buttons work
-  Each page has unique URL
-  Can share/bookmark specific pages
-  Logout returns to home page properly

### User Experience:
-  Clean, professional forms
-  Proper validation and error messages
-  Success feedback
-  Loading states
-  Responsive design

### Data:
-  Realistic demo data
-  3 major cities covered
-  Varied price ranges
-  Multiple property types
-  Comprehensive amenities

---

##  Database Schema

The application uses SQLite with the following models:
- **Buyer** - User preferences and requirements
- **Seller** - Seller profiles and ratings
- **Property** - Property listings with details
- **Lead** - Buyer-property connections
- **Match** - Scored matches with breakdown
- **WorkflowEvent** - Audit logs

All array fields are stored as JSON strings for SQLite compatibility.

---

##  Technical Stack

- **Frontend:** React 18, TypeScript, Vite, React Router, Axios
- **Backend:** Node.js, Express, TypeScript, Prisma ORM
- **Database:** SQLite (development)
- **Styling:** Inline styles (CSS-in-JS approach)

---

##  Notes

- The authentication is simplified for demo purposes (email-based lookup)
- In production, implement proper password hashing and JWT tokens
- Add proper error boundaries and loading states
- Consider moving inline styles to CSS modules
- Add form validation libraries (e.g., Zod, React Hook Form)
- Implement proper state management (e.g., Redux, Zustand) for larger scale

---

##  All Requirements Completed

 Improved buyer frontend with standard form + text box
 Added signup and login pages with authentication
 Created 18 fake entries (buyers & sellers) across Mumbai, Hyderabad, Delhi
 Implemented proper URL routing
 Browser back button works correctly
 Logout bug fixed
 Clean navigation flow

**Enjoy exploring the Hublet platform! **
