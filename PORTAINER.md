# 🐳 Deploying Travel Journal in Portainer

[Portainer](https://www.portainer.io/) lets you manage Docker stacks through a web UI.  
The fastest way to deploy Travel Journal is the **Repository** method, which clones this repo directly inside Portainer so that all SQL initialization files are available automatically.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Portainer CE / BE | Any recent version (2.x+) |
| Docker host | Linux host with Docker Engine |
| Internet access | To pull images from GHCR |

---

## Method 1 – Repository Deployment (Recommended)

This is the recommended method. Portainer clones the repository, so the database initialization SQL files are available automatically.

### Step 1 – Open Portainer and go to Stacks

1. Log in to your Portainer instance.
2. In the left sidebar click **Stacks** → **+ Add stack**.

### Step 2 – Choose "Repository" as the build method

Select the **Repository** tab at the top of the "Add stack" page.

![Repository tab in Portainer](https://portainer-io-assets.sfo2.cdn.digitaloceanspaces.com/documentation/portainer-ce/stacks/add-stack-git.png)

### Step 3 – Fill in the form

| Field | Value |
|---|---|
| **Name** | `travel-journal` (or any name you prefer) |
| **Repository URL** | `https://github.com/yancmo1/travel-journal` |
| **Repository reference** | `refs/heads/main` |
| **Compose path** | `docker-compose.portainer.yml` |
| **Automatic updates** | *(optional)* Enable if you want auto-pull on new commits |

### Step 4 – Set environment variables

Scroll down to the **Environment variables** section and add the following:

| Variable | Example value | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | `MyStr0ngP@ssword!` | **Required.** Database password |
| `JWT_SECRET` | *(output of `openssl rand -base64 32`)* | **Required.** JWT signing secret |
| `HOME_LATITUDE` | `35.4676` | Your home latitude (for distance calculations) |
| `HOME_LONGITUDE` | `-97.5164` | Your home longitude |
| `APP_PORT` | `3080` | Host port the UI is exposed on |

> **Tip:** Generate a strong JWT secret with:
> ```bash
> openssl rand -base64 32
> ```

### Step 5 – Deploy

Click **Deploy the stack**. Portainer will:
1. Clone the repository.
2. Pull the pre-built images from GHCR.
3. Start PostgreSQL, initialize the schema, then start the backend and frontend.

### Step 6 – Access the app

Open `http://<your-docker-host>:<APP_PORT>` (default: `http://<host>:3080`).

1. Click **Create Account** to register your user.
2. Log in and start logging your travel memories!

---

## Method 2 – Web Editor (Custom Stack File)

Use this method if you prefer to paste the compose file directly into Portainer without connecting a repository.

> ⚠️ **Note:** Because the database init SQL files aren't available when using the Web Editor, you must supply the schema manually **or** let Portainer clone a repository (Method 1). If you use this method the database tables will not exist until you exec into the postgres container and run the schema SQL manually (see [Troubleshooting](#troubleshooting) below).

### Steps

1. In Portainer go to **Stacks** → **+ Add stack**.
2. Select the **Web editor** tab.
3. Give the stack a name (e.g. `travel-journal`).
4. Paste the following compose YAML:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: travel_tracker
      POSTGRES_USER: travel_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U travel_user -d travel_tracker"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: ghcr.io/yancmo1/travel-journal/backend:latest
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgresql://travel_user:${POSTGRES_PASSWORD}@postgres:5432/travel_tracker
      - JWT_SECRET=${JWT_SECRET}
      - PHOTO_STORAGE_PATH=/app/media/travel-photos
      - HOME_LATITUDE=${HOME_LATITUDE:-35.4676}
      - HOME_LONGITUDE=${HOME_LONGITUDE:--97.5164}
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
    image: ghcr.io/yancmo1/travel-journal/frontend:latest
    restart: unless-stopped
    ports:
      - "${APP_PORT:-3080}:80"
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  photo_storage:
```

5. Add the same **Environment variables** as shown in Method 1 (Step 4).
6. Click **Deploy the stack**.
7. After the stack is running, apply the database schema manually — see [Applying the Schema Manually](#applying-the-schema-manually) below.

---

## Applying the Schema Manually

If you used the Web Editor and the database tables don't exist yet:

1. In Portainer, navigate to **Containers** and find the `postgres` container.
2. Click **Exec Console** → `/bin/sh` → **Connect**.
3. Run:

```sh
psql -U travel_user -d travel_tracker
```

4. Paste the contents of [`backend/database/schema.sql`](backend/database/schema.sql) and press **Enter**.
5. Type `\q` to exit.

---

## Updating the Stack

### Repository method (Method 1)
Click **Stacks** → `travel-journal` → **Pull and redeploy**.

### Web Editor method (Method 2)
Re-paste the updated compose YAML and click **Update the stack**.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Frontend shows blank page | Backend not ready | Wait ~30 s and refresh; check backend container logs |
| `connection refused` on `/api/*` | Backend healthcheck failing | Check `DATABASE_URL` env var and postgres logs |
| Database tables missing | Schema not applied | Follow [Applying the Schema Manually](#applying-the-schema-manually) |
| Port 3080 already in use | Port conflict | Set `APP_PORT` to a free port (e.g. `3090`) in env vars |
| Image pull fails | GHCR rate limit or network | Ensure the Docker host has internet access; retry |

### Viewing logs in Portainer

1. Go to **Stacks** → `travel-journal`.
2. Click on any service name to open its container.
3. Click **Logs** to tail the output.

---

## Volumes & Persistence

| Volume | Contents |
|---|---|
| `travel-journal_postgres_data` | All database data |
| `travel-journal_photo_storage` | Uploaded travel photos |

These volumes persist across stack restarts and updates.  
Back them up before performing a full stack removal.

---

## Environment Variable Reference

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | *(required – no default)* | PostgreSQL password |
| `JWT_SECRET` | *(required – no default)* | JWT signing secret |
| `HOME_LATITUDE` | `35.4676` | Home latitude for distance calculations |
| `HOME_LONGITUDE` | `-97.5164` | Home longitude for distance calculations |
| `APP_PORT` | `3080` | Host port the Travel Journal UI is served on |
