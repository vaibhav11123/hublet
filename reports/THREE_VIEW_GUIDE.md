# Three View System - User Guide

##  Hublet Platform Views

The Hublet platform now features three distinct role-based views with a simple login system.

---

##  Login Screen

When you first load the application, you'll see a login screen with three options:

1. ** Login as Admin** - Full administrative access
2. ** Login as Buyer** - Buyer-focused property matching
3. ** Login as Seller** - Seller dashboard for property management

**Note:** This is a demo prototype with mock authentication. In production, this would be replaced with proper user authentication.

---

## 1.  Admin View

### Overview
Complete administrative dashboard with full visibility into all platform data.

### Features

#### **Tabbed Interface:**
- **Buyers Tab**: View all registered buyers
  - Name, email, phone
  - Preferred localities and BHK
  - Budget range
  - Required amenities
  - Registration date

- **Sellers Tab**: View all registered sellers
  - Name, email, phone
  - Seller type (owner/broker/agent)
  - Rating (1-5 stars)
  - Completed deals count
  - Trust score (algorithm-calculated)
  - Registration date

- **Properties Tab**: View all listed properties
  - Title, locality, property type
  - BHK, area (sq ft)
  - Price in lakhs
  - Amenities list
  - Seller information
  - Active/Inactive status
  - Creation date

- **Leads Tab**: View all buyer-property leads
  - Buyer name and email
  - Property title and locality
  - Lead state (NEW, ENRICHED, QUALIFIED, NOTIFIED, CONTACTED, CLOSED)
  - Match score
  - Created and updated timestamps

- **Matches Tab**: View all generated matches
  - Buyer and property details
  - Overall match score
  - Score breakdown (Location, Budget, Size, Amenities)
  - Match creation date

- **Logs Tab**: Complete workflow event logs
  - Timestamp
  - Event type (LEAD_CREATED, STATE_TRANSITION, MATCH_GENERATED, ERROR, INVALID_TRANSITION)
  - State transitions (from → to)
  - Event descriptions
  - Color-coded by event type

#### **Summary Statistics:**
Real-time counts displayed at the bottom:
- Total Buyers
- Total Sellers
- Total Properties
- Total Leads
- Total Matches
- Event Logs Count

### Use Cases
- Monitor platform activity
- Audit all transactions and state changes
- Analyze matching effectiveness
- Review seller performance metrics
- Track buyer preferences trends

---

## 2.  Buyer View

### Overview
Personalized dashboard for buyers to manage preferences and view property matches.

### Features

#### **Preference Management:**
- **Free-Text Input**: Natural language preference entry
  - Example: "I want a 3 BHK apartment in Koramangala with gym and swimming pool, budget 50-70 lakhs"
- **Intent Parsing**: Automatic extraction of:
  - Localities
  - BHK requirements
  - Budget range
  - Required amenities
- **Update Button**: Updates preferences and triggers new match search

#### **Match Discovery:**
- **Refresh Matches**: Manually trigger matching algorithm
- **Scrollable Grid Layout**: Visual property cards
- **Match Score Badge**: Color-coded by match quality
  - Green (80%+): Excellent match
  - Orange (60-79%): Good match
  - Blue (<60%): Fair match

#### **Property Cards Display:**
Each match shows:
- **Match Score**: Overall percentage
- **Property Details**:
  - Title
  - Location and property type
  - BHK and area
  - Price in lakhs
- **Amenities**: First 4 amenities shown, +N more indicator
- **Score Breakdown**: Individual component scores
  -  Location score
  -  Budget fit score
  -  Size match score
  -  Amenities match score
- **Seller Information**:
  - Name
  - Rating (star display)
  - Trust score
  - Contact details (email, phone)
- **Contact Button**: Direct seller contact action

#### **Empty State:**
- Helpful message when no matches exist
- Prompts to update preferences

### Workflow
1. Enter preferences in natural language
2. Click "Update Preferences & Find Matches"
3. System parses intent and finds matching properties
4. Browse matches in scrollable grid
5. Review match breakdown
6. Contact sellers for interesting properties

---

## 3.  Seller View

### Overview
Dashboard for sellers to manage their property listings and view interested buyers.

### Features

#### **Property Management:**
- **Add New Property Button**: Toggle property creation form
- **Property Form**: (Existing PropertyForm component)
  - Title, description
  - Locality, address
  - Area, BHK, price
  - Amenities selection
  - Property type

#### **Property Listings:**
- **Grid Layout**: All seller's properties displayed
- Each property card shows:
  - Title
  - Location
  - BHK and area
  - Price in lakhs
  - Active/Inactive status (color-coded)
  - "View Matches" button

#### **Match Viewing:**
- **Click "View Matches"**: Fetch buyers interested in that property
- **Match Table**: Shows all matched buyers
  - Buyer name
  - Email address
  - Phone number
  - Match score percentage

#### **Features:**
- Add multiple properties
- Track which properties get most interest
- View buyer details for follow-up
- See match scores to prioritize leads

### Workflow
1. Add properties via form
2. View all listed properties
3. Click "View Matches" on any property
4. See list of interested buyers with match scores
5. Contact high-scoring buyers directly

---

##  Navigation

### Header Bar (All Views)
- **Platform Name**:  Hublet
- **User Context**: Shows current role and user name
- **Logout Button**: Return to login screen

---

##  API Endpoints Used

### Admin View:
- `GET /api/buyers` - All buyers
- `GET /api/sellers` - All sellers
- `GET /api/properties` - All properties
- `GET /api/leads` - All leads
- `GET /api/matches` - All matches
- `GET /api/workflow-events` - Event logs

### Buyer View:
- `GET /api/matches/buyer/:buyerId` - Buyer's matches
- `POST /api/matches/buyer/:buyerId/find` - Trigger matching
- `POST /api/buyers/:buyerId/parse-intent` - Update preferences

### Seller View:
- `GET /api/properties` - All properties (filtered by seller)
- `POST /api/properties` - Create new property
- `GET /api/matches/property/:propertyId` - Property matches

---

##  Key Benefits of Three-View System

### Separation of Concerns
- **Admin**: Platform oversight and analytics
- **Buyer**: Focused property discovery experience
- **Seller**: Lead management and property listing

### Role-Based Access
- Each user sees only relevant features
- Simplified interfaces reduce cognitive load
- Clear user journeys

### Scalability
- Easy to add new roles (e.g., broker, agent manager)
- Can implement granular permissions
- Supports multi-tenancy

---

##  Demo Tips

### For Admin Demo:
1. Show all 6 tabs
2. Highlight the summary statistics
3. Demonstrate log viewing for audit trail
4. Point out trust score calculation

### For Buyer Demo:
1. Enter natural language preferences
2. Show match score breakdown
3. Emphasize visual property cards
4. Demonstrate contact flow

### For Seller Demo:
1. Add a new property
2. Show properties grid
3. Click "View Matches"
4. Highlight buyer lead information

---

##  Future Enhancements

### Authentication:
- Real user signup/login
- Email verification
- Password reset
- OAuth integration

### Admin View:
- Filters and search
- Export data (CSV/Excel)
- Advanced analytics charts
- User management (ban/suspend)

### Buyer View:
- Save favorite properties
- Property comparison tool
- Virtual tour integration
- Chat with seller

### Seller View:
- Property analytics (views, clicks)
- Bulk property upload
- Price suggestions based on market
- Lead scoring

---

##  Technical Notes

### State Management:
- React useState hooks
- Role stored in local state
- Can be upgraded to Context API or Redux

### Styling:
- Inline styles for rapid prototyping
- Should be moved to CSS modules for production
- Responsive design considerations needed

### Data Flow:
- All API calls through axios
- Error handling in place
- Loading states implemented

### Security Considerations (Production):
- Implement JWT authentication
- Add role-based route guards
- Secure API endpoints
- Input validation and sanitization
- HTTPS enforcement

---

##  Learning Outcomes

This three-view system demonstrates:
1. Role-based access control (RBAC)
2. Separation of concerns in UI design
3. Reusable component architecture
4. RESTful API integration
5. State management in React
6. User experience optimization per role

---

##  Support

For issues or questions about the three-view system:
1. Check the main README.md
2. Review API documentation
3. Examine component source code
4. Check browser console for errors

---

**Built with ️ for DASS Spring 2026 Project**
