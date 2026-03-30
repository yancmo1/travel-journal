# GHCR Deployment Guide

This guide explains how to deploy the Travel Journal app using pre-built images from GitHub Container Registry (GHCR).

## Prerequisites

- Docker and Docker Compose installed on your server
- GitHub account with access to the repository
- Personal Access Token (PAT) with `read:packages` permission (for private repos)

## Setup

### 1. Authenticate with GHCR

For public images (no authentication needed):
```bash
# No authentication required
docker-compose -f docker-compose.ghcr.yml up -d
```

For private images:
```bash
# Create a Personal Access Token (PAT) at: https://github.com/settings/tokens
# Required scope: read:packages

# Login to GHCR
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your production values
nano .env
```

Required environment variables:
```env
# Database
POSTGRES_DB=travel_tracker
POSTGRES_USER=travel_user
POSTGRES_PASSWORD=your_secure_password_here

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_key_here

# Home location for distance calculations
HOME_LATITUDE=35.4676
HOME_LONGITUDE=-97.5164
```

### 3. Deploy

```bash
# Pull latest images and start services
docker-compose -f docker-compose.ghcr.yml pull
docker-compose -f docker-compose.ghcr.yml up -d
```

### 4. Verify Deployment

```bash
# Check container status
docker-compose -f docker-compose.ghcr.yml ps

# Check logs
docker-compose -f docker-compose.ghcr.yml logs -f

# Test API health
curl http://localhost:4000/api/health

# Access the app
# Open http://localhost:3080 in your browser
```

## Image Tags

The GitHub Actions workflow creates the following tags:

- `main` - Latest build from main branch (recommended for production)
- `latest` - Same as main
- `sha-<commit>` - Specific commit hash
- `v1.0.0` - Semantic version tags

To use a specific version:
```yaml
# In docker-compose.ghcr.yml
backend:
  image: ghcr.io/yancmo1/travel-journal-backend:v1.0.0
frontend:
  image: ghcr.io/yancmo1/travel-journal-frontend:v1.0.0
```

## Updating

```bash
# Pull latest images
docker-compose -f docker-compose.ghcr.yml pull

# Restart services
docker-compose -f docker-compose.ghcr.yml up -d
```

## With Secrets Manager

You can use the secrets manager with GHCR deployment:

```bash
# Encrypt your .env
./scripts/secrets-manager.sh encrypt

# Deploy with encrypted secrets
./scripts/secrets-manager.sh decrypt && docker-compose -f docker-compose.ghcr.yml up -d
```

## Troubleshooting

### Error: "pull access denied"

**Solution:** Login to GHCR with your GitHub credentials:
```bash
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### Error: "manifest unknown"

**Cause:** Images haven't been built yet.

**Solution:**
1. Push code to main branch to trigger GitHub Actions
2. Or manually trigger the workflow: Actions → "Build and Push to GHCR" → Run workflow
3. Wait for the workflow to complete
4. Then pull images and deploy

### Error: "Backend container keeps restarting"

**Cause:** Backend can't connect to database or healthcheck failing.

**Solution:**
```bash
# Check logs
docker-compose -f docker-compose.ghcr.yml logs backend

# Common fixes:
# 1. Wait for PostgreSQL to be ready (auto-handled by depends_on)
# 2. Check DATABASE_URL environment variable
# 3. Ensure .env file has correct POSTGRES_PASSWORD
```

### Error: "No such image"

**Cause:** Images need to be built first.

**Solution:** Trigger GitHub Actions workflow:
1. Go to: https://github.com/yancmo1/travel-journal/actions
2. Select "Build and Push to GHCR" workflow
3. Click "Run workflow"
4. Wait for completion
5. Then deploy

## Building Images Locally vs GHCR

**Local Build** (builds from source):
```bash
docker-compose up --build -d
```

**GHCR** (uses pre-built images):
```bash
docker-compose -f docker-compose.ghcr.yml up -d
```

Advantages of GHCR:
- ✅ Faster deployment (no build time)
- ✅ Consistent images across environments
- ✅ Automatic builds on push to main
- ✅ Version tagging and rollback support

## Making Images Public

To make your images publicly accessible (no authentication required):

1. Go to: https://github.com/yancmo1?tab=packages
2. Click on your package (travel-journal-backend or travel-journal-frontend)
3. Package settings → Change visibility → Public
4. Repeat for both frontend and backend packages

## Clean Up

```bash
# Stop and remove containers
docker-compose -f docker-compose.ghcr.yml down

# Remove volumes (WARNING: deletes database and photos)
docker-compose -f docker-compose.ghcr.yml down -v

# Remove images
docker rmi ghcr.io/yancmo1/travel-journal-frontend:main
docker rmi ghcr.io/yancmo1/travel-journal-backend:main
```
