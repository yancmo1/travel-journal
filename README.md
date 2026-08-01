# Postcards of Us

## Public product planning

This repository contains the technical implementation of **Postcards of Us**,
a private family travel storybook. For the plain-language business vision and
the plan for an invite-only beta and eventual public sales, see:

- [Public README](PUBLIC_README.md)
- [Public Sales PRD](PUBLIC_SALES_PRD.md)

A private family storybook for revisiting travel memories, grouping individual
stops into complete journeys, and keeping storage-friendly photo copies.

## Features

- ✦ **Daily Memory** - Open the site to a different memory and swipe through more
- 🧳 **Journeys** - Group stops and memories into cruises, road trips, and vacations
- 🗺️ **Interactive Map** - View all remembered places and journey routes
- 📍 **Easy Place Entry** - City, state, and landmark suggestions with automatic map coordinates
- 🚗 **Memory Management** - Add exact, approximate, year-only, or unknown dates
- ✓ **Cleanup Mode** - Find duplicates and missing details, edit quickly, and safely remove selected memories
- 👥 **Traveler Tracking** - Track who went on each trip (family members, friends)
- 📷 **Smaller Photo Copies** - Store a 1600px display image and thumbnail while retaining EXIF details
- 🧭 **GPS Backfill** - Recover missing place names from coordinates already stored with photos
- 🔐 **User Authentication** - JWT-based auth for single-user personal deployment
- 🐳 **Docker Deployment** - Full-stack containerized setup with PostgreSQL

## Production hosting

The supported family deployment uses Ubuntu, GHCR, Cloudflare Tunnel, local
photo storage, and encrypted R2 backups. See
[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) for the complete runbook.

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

Public registration is closed by default for the invite-only beta. Restore an
existing database or provision the initial account as an operator, then sign in
with those credentials. Do not enable registration for unrelated households
until tenant isolation is complete.

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
│   │   ├── routes/             # API routes (auth, journeys, memories, travelers, photos)
│   │   ├── middleware/         # Auth, upload middleware
│   │   └── utils/              # DB pool, calculations
│   └── database/
│       ├── schema.sql          # PostgreSQL schema
│       └── seed.sql            # Sample data
├── src/
│   ├── App.jsx                 # Main React app
│   ├── pages/                  # Memories, Journeys, All Places, Login
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
| POST | `/api/auth/register` | Create account when operator-enabled; closed by default |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/trips` | List all trips |
| POST | `/api/trips` | Create trip |
| PUT | `/api/trips/:id` | Update trip |
| DELETE | `/api/trips/:id` | Delete trip |
| POST | `/api/trips/bulk-delete` | Delete confirmed memories and their saved photo directories |
| GET | `/api/journeys` | List complete journeys |
| POST | `/api/journeys` | Create a journey and assign memories |
| PUT | `/api/journeys/:id` | Update a journey and its memories |
| DELETE | `/api/journeys/:id` | Delete a journey without deleting its memories |
| GET | `/api/travelers` | List travelers |
| POST | `/api/travelers` | Create traveler |
| GET | `/api/analytics` | Get trip statistics |
| POST | `/api/photos/:tripId` | Upload photo |
| GET | `/api/photos/:tripId` | List a memory's photos |
| DELETE | `/api/photos/:id` | Delete a saved photo copy |
| GET | `/api/photos/location-backfill` | Count GPS-backed memories missing place names |
| POST | `/api/photos/location-backfill` | Safely fill only blank or unknown places |

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
