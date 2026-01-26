# Travel Memory Tracker - MVP Product Requirements Document

## Project Overview
A web application for a married couple to log, track, and visualize all the places they've traveled together since 2001. The app should provide an interactive map with location pins, travel analytics, and a simple interface for adding memories.

## Target Deployment
- **Docker Container** on Ubuntu server
- **Backend Required**: Node.js/Express API + PostgreSQL database
- **Photo Storage**: Server filesystem (external media drive recommended)
- **Requirements**: Mobile-responsive, multi-user capable

## Core Features (MVP)

### 1. Trip Entry & Management
**User can add new trips with:**
- Location (city, state/country) - with autocomplete/search
- Start date and optional end date
- Trip type (dropdown: Road Trip, Flight, Cruise, Day Trip, Other)
- **Travelers** (checkboxes: You, Wife, Kids - with ability to add/remove kids)
- Notes/memories (text area, optional)
- Photos (upload multiple files)

**User can:**
- Edit existing trips
- Delete trips
- View list of all trips in chronological order
- Filter trips by who attended

### 2. Interactive Map Visualization
**Map Requirements:**
- Display all visited locations as pins/markers
- Use a free mapping library (Leaflet.js or Mapbox GL JS)
- Clicking a pin shows trip details (date, notes, type)
- Visual differentiation by trip type (color-coded pins)
- Zoom/pan capabilities
- Option to show/hide travel routes between locations (lines connecting pins in chronological order)

### 3. Analytics Dashboard
**Display the following metrics:**
- Total trips taken (all time)
- Total unique locations visited
- **Trip duration statistics:**
  - Average trip length
  - Longest trip
  - Shortest trip
  - Total days traveled
- **Distance analytics:**
  - Miles from home (calculate from Oklahoma City)
  - Miles traveled this year
  - Miles traveled this decade (2020-2029, etc.)
  - Miles traveled all time
  - Furthest destination from home
- **Trip frequency:**
  - Trips per year (bar chart)
  - Trips per decade
  - Busiest travel year
- **Traveler breakdowns:**
  - Just the couple vs. family trips
  - Trips with each child
  - "Empty nester" trips (after kids)
- Breakdown by trip type (pie chart)
- Timeline view showing trips per year
- Countries and states/provinces visited (count)
- **Fun analytics:**
  - "Travel streak" - consecutive years with trips
  - Most visited destination
  - Decade comparison (which decade traveled most)
  - Month/season analysis (when do you travel most?)
  - "Passport stats" - international vs domestic percentage

### 4. Data Storage
**Requirements:**
- **Backend API**: Node.js/Express with PostgreSQL database
- **Photo storage**: Server filesystem (mount external media drive)
  - Path: `/media/travel-photos/` (configurable)
  - Organize by trip ID: `/media/travel-photos/{trip-id}/`
  - Store thumbnails separately for performance
- **Database schema**: Trips, Locations, Photos, Travelers
- **Authentication**: Simple login for couple (2 user accounts)
- **Backup**: Database export/import functionality
- **Docker volumes** for data persistence

## Initial Data to Populate

The app should allow easy bulk import or have sample data for testing. Initial trips to include:

1. **Las Vegas, NV** - 2001 - "Got married!"
2. **San Antonio, TX** - [Date TBD] - "Family trip with kids"
3. **Branson, MO** - [Date TBD] - "Family trip with kids"
4. **Disney World, Orlando, FL** - [Date TBD] - "Family trip with kids"
5. **Ohio** - [Date TBD] - "Family trip with kids"
6. **Destin, FL** - [Date TBD] - "Family trip with kids"
7. **Cancun, Mexico** - [Date TBD] - "Beach vacation" (multiple entries)
8. **Cruise destinations** - [Dates TBD] - "Cruise" (user will add specific ports)

## Technical Specifications

### Technology Stack
- **Frontend**: React with Vite, Tailwind CSS
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL
- **Mapping**: Leaflet.js (free, no API key needed)
- **Geocoding**: Nominatim (OpenStreetMap, free) for location search
- **Charts**: Recharts for analytics
- **Photo Processing**: Sharp (server-side image optimization)
- **EXIF Reading**: exifr (server-side)
- **Authentication**: JWT tokens with bcrypt
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx (optional, for HTTPS)

### Design System - Ocean Sunset Theme
**Color Palette:**
- **Primary**: Deep Ocean Blue `#1E3A8A` (sky blue at dusk)
- **Secondary**: Sunset Orange `#FB923C` (warm sunset glow)
- **Accent**: Coral Pink `#F472B6` (sunset reflections)
- **Sunrise Yellow**: `#FCD34D` (morning sun)
- **Ocean Teal**: `#14B8A6` (tropical waters)
- **Sky Gradient**: `#60A5FA` to `#3B82F6` (clear blue sky)
- **Neutral**: Soft Sand `#F5F5F4` (beach sand)
- **Dark**: Deep Navy `#0F172A` (night sky)
- **Success**: Ocean Green `#10B981`

**Usage:**
- Headers/Navigation: Deep Ocean Blue with Sunset Orange accents
- Buttons: Gradient from Sunset Orange to Coral Pink
- Map pins: Color-coded by trip type using palette
- Cards: White/Sand with subtle Ocean Teal borders
- Analytics charts: Multi-color using full palette
- Background: Subtle gradient from Sky Blue to Soft Sand

### Data Schema (PostgreSQL)

**Users Table:**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Travelers Table:**
```sql
CREATE TABLE travelers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  relationship VARCHAR(50), -- 'husband', 'wife', 'child'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Trips Table:**
```sql
CREATE TABLE trips (
  id SERIAL PRIMARY KEY,
  location_name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  country VARCHAR(100),
  state VARCHAR(100),
  start_date DATE NOT NULL,
  end_date DATE,
  trip_type VARCHAR(50), -- 'Road Trip', 'Flight', 'Cruise', etc.
  notes TEXT,
  home_distance_miles DECIMAL(10, 2), -- distance from Oklahoma City
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Trip_Travelers Table (many-to-many):**
```sql
CREATE TABLE trip_travelers (
  trip_id INT REFERENCES trips(id) ON DELETE CASCADE,
  traveler_id INT REFERENCES travelers(id),
  PRIMARY KEY (trip_id, traveler_id)
);
```

**Photos Table:**
```sql
CREATE TABLE photos (
  id SERIAL PRIMARY KEY,
  trip_id INT REFERENCES trips(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL, -- /media/travel-photos/{trip-id}/{filename}
  thumbnail_path VARCHAR(500),
  file_size INT,
  mime_type VARCHAR(50),
  date_taken TIMESTAMP,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Key Calculations
- **Distance between locations**: Use Haversine formula for great-circle distance
- **Distance unit**: Miles (US preference)
- **Decade grouping**: 2000-2009, 2010-2019, 2020-2029, etc.

## User Interface Requirements

### Pages/Views
1. **Dashboard (Home)**
   - Analytics summary cards at top
   - Map in main area
   - Quick "Add Trip" button

2. **Add/Edit Trip Form**
   - Modal or separate page
   - Location search with autocomplete
   - Date pickers
   - Trip type dropdown
   - Notes textarea
   - Save/Cancel buttons

3. **Trip List View**
   - Sortable/filterable table or cards
   - Sort by: date, location, type
   - Filter by: year, trip type, country
   - Search functionality

4. **Analytics Page**
   - Detailed charts and statistics
   - Year-over-year comparisons
   - Fun facts (furthest trip, most visited place, etc.)

### Design Guidelines
- Ocean sunset theme with warm, inviting colors
- Clean, modern interface suitable for a couple tracking memories
- Easy to use on desktop and mobile devices
- Large, readable fonts
- Intuitive navigation
- Photo-centric design showcasing travel memories
- Gradient backgrounds evoking sunrise/sunset over ocean

## Functional Requirements

### Must Have (P0)
- User authentication (login for couple)
- Add/edit/delete trips
- Track who attended each trip (travelers)
- Interactive map with pins
- **Enhanced analytics:**
  - Duration stats (avg, longest, shortest trip)
  - Distance from home (Oklahoma City)
  - Trips per year and per decade
  - Traveler breakdowns (couple vs family trips)
  - Fun stats (travel streaks, most visited, etc.)
- Database-backed storage (PostgreSQL)
- Photo upload with server-side storage
- Responsive design
- **PRO: Photo upload with EXIF metadata extraction**
- **PRO: Automatic trip creation from photo GPS/date data**
- **PRO: Smart photo clustering by location and time**

### Should Have (P1)
- Location autocomplete/search
- Trip type filtering
- Routes/lines between locations on map
- Timeline visualization
- "Fun facts" analytics

### Nice to Have (P2)
- Print-friendly trip list
- Share individual trips (generate link)
- Dark mode
- Weather data for past trips

## Pro Features (Enhanced Version)

### Photo Intelligence System
**Automatic Trip Creation from Photos:**
- Drag-and-drop or select multiple photos to upload
- Extract EXIF metadata from images:
  - GPS coordinates (latitude/longitude)
  - Date/time taken
  - Camera/device information
- Automatically reverse-geocode coordinates to location names
- Group photos by location and date proximity (smart clustering)
- Suggest new trip entries based on photo metadata
- User can review and confirm/edit before saving

**Photo Storage:**
- Multiple photos per trip
- Server-side storage on external media drive
- Photo compression and thumbnail generation (Sharp library)
- Automatic EXIF extraction on upload
- Organized by trip: `/media/travel-photos/{trip-id}/original/` and `/media/travel-photos/{trip-id}/thumbnails/`
- Photo gallery view for each trip
- Lightbox viewer with navigation
- Original photo download option

**Smart Features:**
- Detect duplicate locations and offer to merge
- Timeline view with photos
- "Photo map" mode showing thumbnails on map pins
- Bulk import: Upload 50+ photos and let the app create trips automatically
- Missing metadata handling: Manual date/location entry for photos without EXIF

### Pro Feature Implementation Notes

**EXIF Reading:**
- Use `exifr` library on server-side (Node.js)
- Read GPS coordinates (GPSLatitude, GPSLongitude)
- Extract DateTimeOriginal
- Handle various image formats (JPEG, PNG, HEIC with conversion)

**Photo Storage Strategy:**
```javascript
// Server-side file storage
- Base path: /media/travel-photos/ (external drive mount)
- Structure: /{trip-id}/original/{filename}
- Thumbnails: /{trip-id}/thumbnails/{filename}
- Generate 3 sizes: thumbnail (200px), medium (800px), original
- Database stores only file paths and metadata
```

**Reverse Geocoding:**
- Use Nominatim (OpenStreetMap) for GPS → Location name
- Implement request throttling (1 req/sec limit)
- Cache geocoding results to avoid repeat lookups
- Fallback to coordinates if geocoding fails

**Photo Clustering Algorithm:**
```
1. Sort photos by timestamp
2. Group photos within 24 hours and 10 miles of each other
3. Suggest trip with date range and location centroid
4. Allow user to adjust grouping sensitivity
```

**Data Schema Update:**
```sql
-- See PostgreSQL schema above for complete structure
-- Photos linked to trips via trip_id foreign key
-- Travelers linked to trips via trip_travelers junction table
```

**UI Additions for Pro:**
- "Upload Photos" button on dashboard
- Photo processing progress bar
- Review screen: "We found 3 trips in your photos"
- Photo gallery component for each trip
- Settings: Photo quality, storage preference, auto-import toggle

## Success Criteria
- User can add all historical trips in under 30 minutes
- Bulk photo upload suggests trips automatically
- Map displays all locations accurately with beautiful ocean-themed markers
- Analytics calculate correctly with fun insights
- Site loads in under 3 seconds
- Works on mobile Safari and Chrome
- Data persists in PostgreSQL database
- Photos stored reliably on external drive
- Can handle 1000+ photos without performance issues
- Docker container deploys successfully on Ubuntu server
- Backup/restore functionality works flawlessly

## Development Notes for AI Agent

### Build Instructions
1. Create a single-page application (SPA) that can be deployed as static files
2. Use React for component structure and state management
3. Implement Leaflet.js for mapping (no API key required)
4. Use OpenStreetMap Nominatim for geocoding (respect rate limits: 1 req/sec)
5. Store all data in localStorage with JSON format
6. Make the UI fully responsive (mobile-first approach)
7. Include sample data for testing
8. Add clear instructions in README for deployment to Cloudflare Pages
9. Include data import/export functionality from day one
10. Use Tailwind CSS for styling to keep bundle size small

### Code Structure
```
travel-tracker/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── README.md
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map.jsx (interactive map with ocean theme)
│   │   │   ├── TripForm.jsx (add/edit trip form)
│   │   │   ├── TripList.jsx (list/grid view)
│   │   │   ├── Analytics.jsx (dashboard with fun stats)
│   │   │   ├── PhotoUploader.jsx (drag-drop upload)
│   │   │   ├── PhotoGallery.jsx (lightbox viewer)
│   │   │   ├── PhotoProcessor.jsx (EXIF extraction & suggestions)
│   │   │   ├── TravelerSelector.jsx (who went on trip)
│   │   │   ├── Header.jsx (navigation)
│   │   │   └── Login.jsx (authentication)
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── TripsPage.jsx
│   │   │   ├── AnalyticsPage.jsx
│   │   │   └── UploadPage.jsx
│   │   ├── utils/
│   │   │   ├── api.js (Axios API client)
│   │   │   ├── calculations.js (distance, duration, analytics)
│   │   │   └── auth.js (JWT token management)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css (Tailwind + custom ocean theme)
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js (login/register)
│   │   │   ├── trips.js (CRUD operations)
│   │   │   ├── photos.js (upload, EXIF extraction)
│   │   │   ├── analytics.js (statistics calculations)
│   │   │   └── travelers.js (manage family members)
│   │   ├── middleware/
│   │   │   ├── auth.js (JWT verification)
│   │   │   └── upload.js (Multer config)
│   │   ├── utils/
│   │   │   ├── db.js (PostgreSQL connection)
│   │   │   ├── exifReader.js (extract GPS & dates)
│   │   │   ├── imageProcessor.js (Sharp - resize, thumbnails)
│   │   │   ├── photoClustering.js (group photos into trips)
│   │   │   ├── geocoding.js (reverse geocode)
│   │   │   └── calculations.js (distance from home)
│   │   ├── database/
│   │   │   ├── schema.sql (table definitions)
│   │   │   └── seed.sql (initial data)
│   │   └── server.js (Express app)
│   ├── package.json
│   └── .env.example
│
└── media/ (external drive mount point)
    └── travel-photos/
        ├── {trip-id}/
        │   ├── original/
        │   └── thumbnails/
```

### Docker Configuration

**docker-compose.yml structure:**
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    environment:
      POSTGRES_DB: travel_tracker
      POSTGRES_USER: travel_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    
  backend:
    build: ./backend
    volumes:
      - /path/to/external/drive/travel-photos:/app/media/travel-photos
    environment:
      DATABASE_URL: postgresql://travel_user:${DB_PASSWORD}@postgres:5432/travel_tracker
      JWT_SECRET: ${JWT_SECRET}
      PHOTO_STORAGE_PATH: /app/media/travel-photos
    depends_on:
      - postgres
    
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

**Environment Variables (.env):**
```
DB_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret_key
HOME_LATITUDE=35.4676  # Oklahoma City
HOME_LONGITUDE=-97.5164
PHOTO_STORAGE_PATH=/path/to/external/drive/travel-photos
```

### Continue with the following features

- Add backend API for multi-device sync
- Cloud photo storage with CDN (Cloudflare R2)
- Collaborative editing (share with family)
- Trip planning mode (future trips)
- Integration with Google Photos API
- Print photo book feature
- Social sharing capabilities
- AI-powered photo tagging and search
- Video support with thumbnail extraction
- Face recognition for "Who was there" tracking

## Questions for User (to refine before build)

**ANSWERED:**
- ✅ Preferred color scheme or theme? **Ocean sunset palette (blues, oranges, corals, teals)**
- ✅ Any specific analytics you want to see? **Duration, miles from home, trips per year/decade, fun analytics**
- ✅ Do you want to track who went on each trip? **YES - track couple vs. family trips**

**ADDITIONAL NOTES:**
- Home location: **Oklahoma City, Oklahoma** (for distance calculations)
- Photo storage: **External media drive on server**
- Deployment: **Docker container on Ubuntu server**
- This PRD is ready for **Claude Opus** to build the complete project

---

**This PRD provides everything needed to build the app. Start development with the core features (map, trip entry, basic analytics). Once all featureas are implemented with tried and true features you will build and start a docker container.**