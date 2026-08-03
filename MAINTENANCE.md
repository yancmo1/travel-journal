# Postcards of Us maintenance

This is the short rollback/archive checklist for the former private Ubuntu
deployment. The
full architecture and first-time setup are documented in
[PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md).

## Routine checks

Run these commands on the Ubuntu host only during an owner-approved rollback,
archive, or recovery operation:

```bash
ssh ubuntumac-ip
cd /opt/travel-journal
sudo docker compose --env-file .env.production \
  -f docker-compose.production.yml ps
curl --fail http://127.0.0.1:3080/api/health
```

For recent application logs:

```bash
sudo docker compose --env-file .env.production \
  -f docker-compose.production.yml logs --tail=200 backend frontend
```

After an image update, run the dedicated smoke test with the pre-created test
account. It creates one temporary memory, uploads the bundled sample photo,
reads it back, and deletes the memory plus its photo directory on exit:

```bash
cd /opt/travel-journal
SMOKE_TEST_USERNAME=travel-journal-smoke \
SMOKE_TEST_PASSWORD='use-the-test-account-password' \
./scripts/post-deploy-smoke-test.sh
```

In the app, use **Cleanup** to review possible duplicates, missing dates,
missing places, memories without photos, and memories not assigned to a
journey. Use **People** to correct names and relationships, deactivate old
entries, and jump to that person’s memories in **All Places & Memories**.

## Deploy the current published images

The GitHub Actions workflow publishes `latest` and immutable `sha-<commit>`
images to GHCR. Watchtower normally updates the Postcards of Us containers
within five minutes. To apply or pin a release immediately:

```bash
cd /opt/travel-journal
sudo ./scripts/production-deploy.sh
```

For a rollback, set `IMAGE_TAG=sha-<commit>` in the private
`.env.production`, then run the same command. Do not commit that file.

## Backup and recovery

Start a backup manually when validating storage or before a risky maintenance
operation:

```bash
cd /opt/travel-journal
sudo ./scripts/backup-to-r2.sh
```

The nightly systemd timer is the normal backup path. For recovery, restore the
latest Restic snapshot into a new staging directory first, verify the photo tree
and database dump, then follow the database restore commands in
[PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md#restore-drill). Never
restore over the live photo directory as the first step.

Each successful backup writes a small status file under
`${DATA_ROOT}/maintenance/`. The Dashboard reads it through the authenticated
maintenance endpoint and shows the last R2 backup, last database dump, photo
storage use, and a stale warning after `BACKUP_STALE_AFTER_HOURS` (30 hours by
default).

For the best phone experience, open the site in Safari or Chrome, choose the
browser’s **Add to Home Screen** action, and use the app icon from then on.
Photo upload offers separate camera and library actions on small screens.

## Credentials

Keep `.env.production`, the Restic password, and the GHCR credential outside
Git. The Ubuntu GHCR credential rotation remains a separate security task: the
safe sequence is to create a fine-grained package-read token, replace the host
credential, verify a pull, and revoke the old token. Do not revoke the current
credential until the replacement pull has succeeded.
