# Travel Memory Tracker

A personal full-stack web application for logging and visualizing your travel memories on an interactive map. Built with React, Node.js, PostgreSQL, and Docker.

## Features

- 🗺️ **Interactive Map** - View all trips on a CARTO/Leaflet map with color-coded pins by trip type
- 📊 **Analytics Dashboard** - Visualize trips by year, decade, and type with Chart.js
- 🚗 **Trip Management** - Log Road Trips, Flights, and Cruises with dates, locations, and notes
- 👥 **Traveler Tracking** - Track who went on each trip (family members, friends)
- 📍 **Distance Tracking** - Automatic calculation of distance from your home location
- 📷 **Photo Storage** - Upload photos with EXIF data extraction
- 🔐 **User Authentication** - JWT-based auth for single-user personal deployment
- 🐳 **Docker Deployment** - Full-stack containerized setup with PostgreSQL

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js 20, Express.js |
| Database | PostgreSQL 15 |
| Maps | Leaflet.js with CARTO tiles |
| Charts | Chart.js with react-chartjs-2 |
| Auth | JWT + bcryptjs |
| Container | Docker Compose |

## Quick Start (Docker)

### Prerequisites
- Docker & Docker Compose installed

### 1. Configure Environment

```bash
# Copy and edit environment file
cp .env.example .env
```

Edit `.env` to set your home coordinates and secrets:

```env
# Home location (for distance calculations)
HOME_LATITUDE=35.4676
HOME_LONGITUDE=-97.5164

# Security (change these!)
JWT_SECRET=your-super-secret-jwt-key-here
POSTGRES_PASSWORD=your-db-password

# Database
POSTGRES_DB=travel_tracker
POSTGRES_USER=travel_user
```

### 2. Build & Run

```bash
docker-compose up --build -d
```

### 3. Access the App

Open http://localhost:3080

1. Click **"Create Account"** to register (first user becomes the account)
2. Login with your credentials
3. Start logging your travel memories!

## Development

### Local Development (without Docker)

```bash
# Install dependencies
cd backend && npm install && cd ..
npm install

# Start PostgreSQL (Docker or local)
docker-compose up postgres -d

# Set environment variables
export DATABASE_URL=postgresql://travel_user:travel_pass@localhost:5432/travel_tracker
export JWT_SECRET=dev-secret-key

# Run backend (in one terminal)
cd backend && npm run dev

# Run frontend (in another terminal)
npm run dev
```

### Project Structure

```
├── backend/
│   ├── src/
│   │   ├── server.js           # Express entry point
│   │   ├── routes/             # API routes (auth, trips, travelers, photos, analytics)
│   │   ├── middleware/         # Auth, upload middleware
│   │   └── utils/              # DB pool, calculations
│   └── database/
│       ├── schema.sql          # PostgreSQL schema
│       └── seed.sql            # Sample data
├── src/
│   ├── App.jsx                 # Main React app
│   ├── pages/                  # Dashboard, Trips, Analytics, Login
│   ├── components/             # Map, TripForm, Header, etc.
│   ├── context/                # Auth & Data context providers
│   └── utils/                  # API client, formatting
├── docker-compose.yml          # Full-stack deployment
├── Dockerfile                  # Frontend nginx container
└── nginx.conf                  # Reverse proxy config
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/trips` | List all trips |
| POST | `/api/trips` | Create trip |
| PUT | `/api/trips/:id` | Update trip |
| DELETE | `/api/trips/:id` | Delete trip |
| GET | `/api/travelers` | List travelers |
| POST | `/api/travelers` | Create traveler |
| GET | `/api/analytics` | Get trip statistics |
| POST | `/api/photos/:tripId` | Upload photo |

## Theme

The app uses an **Ocean Sunset** color palette:
- 🔵 Ocean Blue (#1E3A8A) - Headers, buttons
- 🟠 Sunset Orange (#FB923C) - Accents, Road Trip markers
- 🩷 Coral Pink (#F472B6) - Hover states
- 🩵 Ocean Teal (#14B8A6) - Flight markers

## Production Deployment

For deployment to a server:

```bash
# Configure environment
cp .env.example .env
nano .env  # Set production values (strong JWT_SECRET, passwords)

# Build and start
docker-compose up --build -d

# With reverse proxy (nginx/Caddy), point your domain to port 3080
```

## License

MIT - Personal use. Built for tracking family travel memories.
