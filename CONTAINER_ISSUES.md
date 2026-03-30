# Container Startup Issues - Analysis & Fixes

## Issues Identified

### 1. ❌ CRITICAL: Backend Healthcheck Missing wget
**Problem:** The backend Dockerfile uses `node:20-alpine` which doesn't include `wget` or `curl` by default, but `docker-compose.yml` line 38 uses wget for healthcheck.

**Impact:** Container healthcheck will fail, causing Docker to mark the backend as unhealthy and potentially restart it repeatedly.

**Location:**
- `backend/Dockerfile` - No wget/curl installation
- `docker-compose.yml:38` - Healthcheck uses wget

**Fix:** Install wget in the backend Dockerfile

### 2. ⚠️ Historical: No GHCR Configuration
**Problem (original state):** Previously, there was no GitHub Container Registry (ghcr.io) configuration in the project. If you tried to pull a pre-built image from GHCR, it wouldn't work because:
- There was no GitHub Actions workflow to build and push images
- There were no references to ghcr.io in the primary `docker-compose.yml`
- Images were built locally only

**Current note:** This has since been addressed via `.github/workflows/docker-publish.yml` and `docker-compose.ghcr.yml`, which provide GHCR build/publish support.

**Impact (original state):** If you tried to use `docker pull ghcr.io/yancmo1/travel-journal:tag`, it would not exist.

**Fix:** Either:
- Option A: Build locally with `docker-compose up --build`
- Option B: Use or adapt the GitHub Actions workflow to push to GHCR (workflow provided below)

### 3. ⚠️ Network Configuration
**Problem:** The nginx config proxies to `http://backend:4000` which requires Docker Compose networking to resolve the hostname.

**Impact:** If running containers individually or with incorrect network configuration, frontend can't reach backend.

**Fix:** Always use `docker-compose up` to ensure proper networking.

### 4. ⚠️ Environment Variables
**Problem:** Missing `.env` file will cause containers to use default values, which may not work on your server.

**Impact:**
- Weak default passwords
- Wrong home coordinates
- Database connection failures

**Fix:** Create proper `.env` file or use secrets-manager.sh

### 5. ⚠️ Photo Storage Permissions
**Problem:** The backend creates `/app/media/travel-photos` but may lack write permissions depending on Docker user.

**Impact:** Photo uploads will fail with permission errors.

**Fix:** Ensure volume has proper permissions or use named volumes (already done in docker-compose.yml)

## Recommended Fixes

### Priority 1: Fix Backend Healthcheck

Update `backend/Dockerfile` to install wget:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies for Sharp, HEIF support, and healthcheck
RUN apk add --no-cache vips-dev build-base python3 libheif libheif-dev wget

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Create photo storage directory
RUN mkdir -p /app/media/travel-photos

EXPOSE 4000

CMD ["node", "src/server.js"]
```

### Priority 2: Setup GHCR (Optional)

If you want to use GitHub Container Registry, create `.github/workflows/docker-publish.yml`:

```yaml
name: Build and Push to GHCR

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME_FRONTEND: ${{ github.repository }}-frontend
  IMAGE_NAME_BACKEND: ${{ github.repository }}-backend

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata (frontend)
        id: meta-frontend
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME_FRONTEND }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - name: Build and push frontend
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: ${{ steps.meta-frontend.outputs.tags }}
          labels: ${{ steps.meta-frontend.outputs.labels }}

      - name: Extract metadata (backend)
        id: meta-backend
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME_BACKEND }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - name: Build and push backend
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          file: ./backend/Dockerfile
          push: true
          tags: ${{ steps.meta-backend.outputs.tags }}
          labels: ${{ steps.meta-backend.outputs.labels }}
```

### Priority 3: Deployment Script for GHCR

Create `docker-compose.ghcr.yml` for using pre-built images:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-travel_tracker}
      POSTGRES_USER: ${POSTGRES_USER:-travel_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-travel_pass}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./backend/database/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-travel_user} -d ${POSTGRES_DB:-travel_tracker}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: ghcr.io/yancmo1/travel-journal-backend:main
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER:-travel_user}:${POSTGRES_PASSWORD:-travel_pass}@postgres:5432/${POSTGRES_DB:-travel_tracker}
      - JWT_SECRET=${JWT_SECRET:-change_this_to_a_secure_secret_key}
      - PHOTO_STORAGE_PATH=/app/media/travel-photos
      - HOME_LATITUDE=${HOME_LATITUDE:-35.4676}
      - HOME_LONGITUDE=${HOME_LONGITUDE:-97.5164}
      - PORT=4000
      - NODE_ENV=production
    volumes:
      - photo_storage:/app/media/travel-photos
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:4000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    image: ghcr.io/yancmo1/travel-journal-frontend:main
    restart: unless-stopped
    ports:
      - "3080:80"
    depends_on:
      - backend
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  photo_storage:
```

## Debugging Commands

```bash
# Check container logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres

# Check container status
docker-compose ps

# Check healthcheck status
docker inspect travel-journal-backend-1 | grep -A 10 Health

# Test backend directly
curl http://localhost:4000/api/health

# Shell into backend container
docker-compose exec backend sh

# Check if wget is available (in backend container)
docker-compose exec backend which wget
docker-compose exec backend wget --version
```

## Common Startup Failures

1. **Backend restarts repeatedly** → Healthcheck failing (missing wget)
2. **"connection refused" errors** → Backend not started yet, increase healthcheck interval
3. **Database connection errors** → PostgreSQL not ready, check depends_on condition
4. **404 on API calls** → Nginx proxy configuration or backend not running
5. **Permission denied on /app/media** → Volume permission issues

## Next Steps

1. Apply the backend Dockerfile fix (add wget)
2. Rebuild images: `docker-compose up --build -d`
3. Check logs: `docker-compose logs -f`
4. If using GHCR, set up GitHub Actions workflow
5. Ensure `.env` file exists with proper values
