# Legacy site freeze

`travel.yancmo.xyz` is frozen as the legacy family journal beginning August 1,
2026. The live site remains available as a migration source and recovery safety
net, but it must not receive normal Postcards of Us deployments.

## Repository boundary

- Frozen snapshot: Git tag `legacy-travel-yancmo-freeze-2026-08-01`
- New product work: branch `codex/postcards`
- New deployments must use the Postcards hostname and separate image/release
  identifiers.

The production deployment script refuses to target `travel.yancmo.xyz` unless
`ALLOW_LEGACY_DEPLOY=true` is supplied explicitly. That override is reserved for
an emergency repair to the legacy site.

The GitHub Actions container workflow is manual-only and requires an explicit
legacy-release confirmation. Normal pushes do not update the watched `latest`
container tags.

## One-time check on the legacy server

Before publishing new Postcards container images, pin the legacy deployment to
the immutable image tag that it currently runs and stop automatic image updates.
Record that tag with the server backup notes. Do not delete its PostgreSQL data
or photo directory until the Postcards migration has been verified and backed
up independently.

## Migration rule

Treat the legacy database and photo directory as read-only migration inputs.
Take a fresh database dump and file backup immediately before the final import,
then leave the legacy site available until record counts, photos, login, and
shared journeys have been verified on the new server.
