# Postcards of Us Application - Server Specification Sheet

**Application Name:** Postcards of Us
**Repository:** https://github.com/yancmo1/travel-journal  
**Version:** 1.0.0  
**Date:** January 25, 2026

---

## 🎯 Application Overview

A full-stack family travel storybook with photo intelligence, EXIF data extraction, location clustering, and an analytics dashboard. Users can preserve trips, upload photos with automatic location extraction, and revisit their travel history.

---

## 🖥️ System Requirements

### Minimum Hardware Specifications
- **CPU:** 2 cores (4 recommended)
- **RAM:** 4 GB minimum (8 GB recommended)
- **Storage:** 50 GB minimum (plan for photo storage growth)
- **OS:** Linux (Ubuntu 20.04+ / Debian 11+ / RHEL 8+)

### Required Software
- **Docker:** Version 24.0.0 or newer
- **Docker Compose:** Version 2.20.0 or newer
- **Git:** Version 2.30.0 or newer
- **OpenSSL:** For secrets management

---

## 🏗️ Architecture

### Application Stack
```
┌─────────────────────────────────────┐
│  NGINX (Frontend - Port 80)         │
│  React + Vite Build                 │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│  Node.js Backend API (Port 4000)    │
│  Express.js REST API                │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│  PostgreSQL 15 (Port 5432)          │
│  Relational Database                │
└─────────────────────────────────────┘
```

### Services Overview
| Service | Technology | Internal Port | External Port |
|---------|-----------|---------------|---------------|
| Frontend | React 18 + Nginx | 80 | 3080 |
| Backend API | Node.js 20 + Express | 4000 | (internal) |
| Database | PostgreSQL 15 | 5432 | (internal) |

---

## 🔌 Technology Stack

### Frontend
- **Framework:** React 18.2.0
- **Build Tool:** Vite 5.0.0
- **UI Framework:** TailwindCSS 3.4.8
- **Charts:** Chart.js 4.4.0
- **Maps:** Leaflet 1.9.4
- **Web Server:** Nginx (Alpine)

### Backend
- **Runtime:** Node.js 20 (LTS)
- **Framework:** Express 4.18.2
- **Authentication:** JWT (jsonwebtoken 9.0.2)
- **Password Hashing:** bcryptjs 2.4.3
- **Image Processing:** Sharp 0.33.2
- **EXIF Extraction:** exifr 7.1.3
- **File Upload:** Multer 1.4.5

### Database
- **System:** PostgreSQL 15 (Alpine)
- **Driver:** node-postgres (pg) 8.11.3

---

## 📦 Installation Steps

### 1. System Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin

# Verify installations
docker --version
docker compose version
```

### 2. Clone Repository
```bash
git clone https://github.com/yancmo1/travel-journal.git
cd travel-journal
```

### 3. Configure Environment
```bash
# Method A: Decrypt existing secrets (if provided)
./scripts/secrets-manager.sh decrypt
# Enter the passkey when prompted

# Method B: Create new configuration
cp .env.example .env
nano .env  # Edit all values (see Configuration section below)
```

### 4. Deploy Application
```bash
# Option 1: One-command deployment (if encrypted secrets exist)
./scripts/secrets-manager.sh deploy

# Option 2: Manual deployment
chmod +x scripts/secrets-manager.sh
docker compose up --build -d
```

### 5. Verify Deployment
```bash
# Check service status
docker compose ps

# View logs
docker compose logs -f

# Test application
curl http://localhost:3080
curl http://localhost:3080/api/health
```

---

## ⚙️ Configuration

### Required Environment Variables

Create a `.env` file in the project root with the following:

```bash
# Database Configuration
POSTGRES_DB=travel_tracker
POSTGRES_USER=travel_user
POSTGRES_PASSWORD=<STRONG_PASSWORD_HERE>

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=<GENERATE_SECURE_JWT_SECRET>

# Home Location (for distance calculations)
# Default: Oklahoma City, OK
HOME_LATITUDE=35.4676
HOME_LONGITUDE=-97.5164

# Application Port (external)
APP_PORT=3080
```

### Generate Secure Secrets
```bash
# Generate JWT Secret
openssl rand -base64 32

# Generate Database Password
openssl rand -base64 24
```

---

## 🌐 Network Configuration

### Firewall Rules
```bash
# Allow HTTP
sudo ufw allow 3080/tcp

# Allow HTTPS (if using reverse proxy)
sudo ufw allow 443/tcp

# Allow SSH
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

### Port Mapping
- **3080** → Frontend (NGINX serving React app)
- **4000** → Backend API (internal, proxied through frontend)
- **5432** → PostgreSQL (internal only, not exposed)

### Reverse Proxy (Recommended)

#### Nginx Configuration Example
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 💾 Database Schema

### Tables
- **users** - Authentication and user profiles
- **travelers** - Family members/travel companions
- **trips** - Trip records with locations and dates
- **trip_travelers** - Many-to-many relationship
- **photos** - Photo metadata and EXIF data
- **location_clusters** - Intelligent location grouping

### Initial Data
- Demo user: `demo` / `demo123`
- Sample travelers and trips included

### Backup Strategy
```bash
# Backup database
docker compose exec postgres pg_dump -U travel_user travel_tracker > backup_$(date +%Y%m%d).sql

# Restore database
docker compose exec -T postgres psql -U travel_user travel_tracker < backup_20260125.sql
```

---

## 📁 Storage Requirements

### Data Volumes
- **postgres_data** - Database storage (grows with usage)
- **photo_storage** - Uploaded photos (plan 100MB-10GB+)

### Volume Locations
```bash
# View volume information
docker volume inspect travel-journal_postgres_data
docker volume inspect travel-journal_photo_storage

# Default location
/var/lib/docker/volumes/
```

### Storage Planning
- Initial: ~500 MB (application + database)
- Per 100 photos: ~200-500 MB (depends on resolution)
- Recommend: 50+ GB for production use

---

## 🔒 Security Considerations

### Secrets Management
- **Never commit** `.env` file to Git
- Use encrypted `.env.encrypted` for version control
- Rotate JWT secret every 90 days
- Use strong database passwords (20+ characters)

### Database Security
- Database is NOT exposed to external network
- Only accessible by backend container
- Use strong passwords
- Regular backups

### Application Security
- JWT authentication on all protected endpoints
- Password hashing with bcryptjs (10 rounds)
- CORS enabled for API security
- File upload validation (images only)
- SQL injection protection via parameterized queries

### SSL/TLS
Application runs HTTP internally. Use reverse proxy (Nginx/Apache) with Let's Encrypt for HTTPS:
```bash
sudo certbot --nginx -d yourdomain.com
```

---

## 🚀 API Endpoints

### Base URL
- Development: `http://localhost:3080/api`
- Production: `https://yourdomain.com/api`

### Endpoint Groups
| Group | Path | Description |
|-------|------|-------------|
| Health | `GET /api/health` | System status check |
| Auth | `POST /api/auth/login` | User authentication |
| Auth | `POST /api/auth/register` | User registration |
| Travelers | `GET /api/travelers` | List all travelers |
| Travelers | `POST /api/travelers` | Create traveler |
| Trips | `GET /api/trips` | List all trips |
| Trips | `POST /api/trips` | Create trip |
| Trips | `PUT /api/trips/:id` | Update trip |
| Trips | `DELETE /api/trips/:id` | Delete trip |
| Photos | `POST /api/photos/upload` | Upload photo |
| Photos | `GET /api/photos/trip/:id` | Get trip photos |
| Photos | `POST /api/photos/cluster` | Cluster by location |
| Analytics | `GET /api/analytics` | Get travel stats |

### Authentication
- Protected endpoints require JWT token
- Header: `Authorization: Bearer <token>`
- Token expiry: 24 hours

---

## 📊 Monitoring & Health

### Health Check Endpoint
```bash
curl http://localhost:3080/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-25T12:00:00.000Z",
  "database": "connected",
  "uptime": 86400
}
```

### Container Health
```bash
# Check container status
docker compose ps

# View resource usage
docker stats

# Check logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

### Log Files
```bash
# Backend logs
docker compose logs backend --tail=100 -f

# Database logs
docker compose logs postgres --tail=100 -f

# All services
docker compose logs --tail=100 -f
```

---

## 🔧 Maintenance Commands

### Start/Stop Services
```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart specific service
docker compose restart backend

# Rebuild and restart
docker compose up --build -d
```

### Updates & Upgrades
```bash
# Pull latest code
git pull origin main

# Rebuild containers
docker compose build --no-cache

# Deploy new version
docker compose up -d
```

### Database Maintenance
```bash
# Access database shell
docker compose exec postgres psql -U travel_user -d travel_tracker

# Run SQL file
docker compose exec -T postgres psql -U travel_user travel_tracker < script.sql

# Vacuum database
docker compose exec postgres psql -U travel_user -d travel_tracker -c "VACUUM ANALYZE;"
```

### Cleanup
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (CAUTION: May delete data)
docker volume prune

# Complete cleanup
docker system prune -a --volumes
```

---

## 🐛 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 3080
sudo lsof -i :3080

# Kill process
kill -9 <PID>
```

#### Database Connection Failed
```bash
# Check database is running
docker compose ps postgres

# View database logs
docker compose logs postgres

# Restart database
docker compose restart postgres
```

#### Permission Issues
```bash
# Fix volume permissions
sudo chown -R $(id -u):$(id -g) /var/lib/docker/volumes/travel-journal_*
```

#### Container Won't Start
```bash
# Check logs
docker compose logs <service-name>

# Remove and recreate
docker compose down
docker compose up -d --force-recreate
```

---

## 📞 Support Information

### Documentation
- **Repository:** https://github.com/yancmo1/travel-journal
- **README:** [README.md](README.md)
- **Deployment Guide:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **Photo Intelligence:** [PHOTO_INTELLIGENCE.md](PHOTO_INTELLIGENCE.md)

### Testing
```bash
# Run smoke tests
./scripts/smoke-test.sh
```

### Key Contacts
- **Developer:** [Your contact information]
- **Repository Owner:** yancmo1

---

## ✅ Pre-Launch Checklist

- [ ] Docker and Docker Compose installed
- [ ] Firewall rules configured
- [ ] `.env` file created with secure values
- [ ] JWT_SECRET generated (32+ characters)
- [ ] Database password is strong (20+ characters)
- [ ] HOME_LATITUDE and HOME_LONGITUDE set correctly
- [ ] Application deployed: `docker compose up -d`
- [ ] Health check passes: `curl http://localhost:3080/api/health`
- [ ] Can login with demo credentials
- [ ] Reverse proxy configured (for production)
- [ ] SSL certificate installed (for production)
- [ ] Backup strategy configured
- [ ] Monitoring/logging configured

---

## 📝 Notes

### Default Credentials
- **Demo User:** `demo` / `demo123`
- **Change or disable** in production!

### Performance Tuning
- Consider increasing container resources for high-traffic
- Add Redis for session caching (future enhancement)
- Use CDN for static assets (optional)

### Scaling Considerations
- Backend can be horizontally scaled
- Use external PostgreSQL for multi-container setup
- Consider object storage (S3) for photos at scale

---

**Document Version:** 1.0  
**Last Updated:** January 25, 2026  
**Deployment Complexity:** Medium  
**Estimated Setup Time:** 30-60 minutes
