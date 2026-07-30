# Ubuntu production deployment

This deployment keeps the application and photos on the Ubuntu machine, exposes
only the frontend through a named Cloudflare Tunnel, publishes application
images from GitHub Actions to GHCR, and backs up photos plus PostgreSQL dumps to
a private Cloudflare R2 bucket.

## What runs

| Service | Purpose | Internet exposure |
| --- | --- | --- |
| `frontend` | Nginx and the built React application | Cloudflare Tunnel only |
| `backend` | Express API and image processing | Private Docker network |
| `postgres` | PostgreSQL 15 | Private Docker network |
| shared `cloudflared` | Existing outbound tunnel connector | Outbound connections only |
| `watchtower` | Travel Journal-only automatic GHCR updater | None |

The frontend is also bound to `127.0.0.1:3080` for server-side health checks.
There is no reason to open ports 80, 443, 3080, 4000, or 5432 in the router or
Ubuntu firewall.

Production application sessions last 90 days by default. Configure the
Cloudflare Access application session for 30 days. Both sessions are remembered
by each browser independently; a new phone, tablet, or browser signs in once.

## 1. Publish the initial images

The workflow at `.github/workflows/publish-containers.yml` publishes:

- `ghcr.io/yancmo1/travel-journal-frontend:latest`
- `ghcr.io/yancmo1/travel-journal-backend:latest`

Push this deployment work to `main`, or run **Publish production containers**
from the GitHub Actions page. The workflow also publishes immutable
`sha-<commit>` tags for rollback.

New GHCR packages are private by default. Either make both packages public in
GitHub package settings, or keep them private and log the Ubuntu host in with a
fine-grained/classic token that can read packages:

```bash
sudo docker login ghcr.io -u yancmo1
```

For a private package, enter a GitHub personal access token with `read:packages`
when prompted. The Ubuntu host's shared Watchtower already uses root's Docker
credentials, so use `sudo docker login`.

## 2. Prepare the Ubuntu host

Install Docker Engine, the Compose plugin, Git, and OpenSSL. Then place the
repository at the path used by the included systemd unit:

```bash
sudo git clone https://github.com/yancmo1/travel-journal.git /opt/travel-journal
cd /opt/travel-journal
sudo cp .env.production.example .env.production
sudo chmod 600 .env.production
```

Generate independent secrets:

```bash
openssl rand -base64 36
openssl rand -base64 48
```

Use the first for `POSTGRES_PASSWORD` and the second for `JWT_SECRET`. Never
commit `.env.production`.

## 3. Create the Cloudflare Tunnel and privacy gate

In Cloudflare Zero Trust:

1. Go to **Networks > Connectors > Cloudflare Tunnels** and create a named
   tunnel, such as `travel-journal`.
2. Reuse the existing `yancmo.xyz` tunnel on the Ubuntu host.
3. Add `travel.yancmo.xyz` to `/home/yancmo/.cloudflared/config.yml`, routing it
   to `https://localhost:443` with `noTLSVerify: true`, then restart the shared
   `cloudflared` service.
4. Route the tunnel DNS record to the existing tunnel.
5. Under **Access controls > Applications**, add a self-hosted application for
   the entire hostname.
6. Add an Allow policy containing only your email and Amber's email. One-time
   PIN is a simple identity provider for this small audience.

Do not use an `Everyone` or "all valid emails" Allow rule. The app's registration
endpoint is intentionally available for family accounts, so Cloudflare Access
is the outer privacy boundary.

## 4. Create the R2 backup destination

Create a private bucket named `travel-journal-backups`. Create an R2 API token
with **Object Read & Write**, scoped only to that bucket. Put its Access Key ID
and Secret Access Key in `.env.production`.

Set:

```dotenv
RESTIC_REPOSITORY=s3:https://ACCOUNT_ID.r2.cloudflarestorage.com/travel-journal-backups
RESTIC_PASSWORD=a-third-independent-long-random-secret
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

The Restic password encrypts the backup data and metadata. Losing it makes the
repository unrecoverable, so store a copy in the family's password manager.

## 5. Start and verify

After filling every placeholder in `.env.production`:

```bash
cd /opt/travel-journal
sudo ./scripts/production-deploy.sh
curl --fail http://127.0.0.1:3080/api/health
sudo docker logs --tail=100 infra-new-cloudflared-1
```

`PHOTO_UID` and `PHOTO_GID` default to `1000`, matching the unprivileged
`node` user in the backend container. The deployment script applies that
ownership to the local photo directory so uploads work without running the app
as root.

Visit the public hostname, pass the Cloudflare Access login, and create the two
application accounts. Confirm a photo upload and thumbnail display before
calling the launch complete.

## 6. Enable nightly R2 backups

Test the first backup interactively:

```bash
cd /opt/travel-journal
sudo ./scripts/backup-to-r2.sh
```

Then install the included timer:

```bash
sudo cp deploy/travel-journal-backup.service /etc/systemd/system/
sudo cp deploy/travel-journal-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now travel-journal-backup.timer
systemctl list-timers travel-journal-backup.timer
```

The job keeps 14 days of local compressed database dumps. In R2, Restic retains
7 daily, 5 weekly, and 12 monthly snapshots. Photos remain primary on the
Ubuntu disk; R2 is an encrypted off-site backup rather than live photo serving.

## Deploys and rollback

Every push to `main` publishes `latest`. The stack's Watchtower polls every five
minutes and updates the frontend and backend containers in its `travel-journal`
scope. It uses anonymous access to the public Travel Journal packages, leaving
the host's separate GHCR login untouched. Database and `cloudflared` updates
remain deliberate.

To pin or roll back, set `IMAGE_TAG=sha-<commit>` in `.env.production`, then run:

```bash
sudo ./scripts/production-deploy.sh
```

To inspect the stack:

```bash
sudo docker compose --env-file .env.production \
  -f docker-compose.production.yml ps
sudo docker compose --env-file .env.production \
  -f docker-compose.production.yml logs --tail=200
```

## Restore drill

List snapshots without writing to the local disk:

```bash
sudo docker run --rm --env-file .env.production \
  restic/restic:latest snapshots
```

Restore into a new, empty staging directory first:

```bash
sudo mkdir -p /srv/travel-journal/restore-test
sudo docker run --rm --env-file .env.production \
  -v /srv/travel-journal/restore-test:/restore \
  restic/restic:latest restore latest --target /restore
```

The restored photo tree will be under `/restore/data/photos`. To restore the
database, choose a dump from `/restore/data/postgres-dumps`, stop the backend,
and pipe the decompressed SQL into `psql`:

```bash
sudo docker compose --env-file .env.production \
  -f docker-compose.production.yml stop backend
gunzip -c /srv/travel-journal/restore-test/data/postgres-dumps/CHOSEN.sql.gz |
  sudo docker compose --env-file .env.production \
    -f docker-compose.production.yml exec -T postgres \
    psql -U travel_user travel_tracker
sudo docker compose --env-file .env.production \
  -f docker-compose.production.yml start backend
```

Run this drill once before treating R2 as a verified backup.
