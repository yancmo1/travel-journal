# Hosting plan for Tracing Time

## Recommended first home

Run the existing Docker application on the always-on Ubuntu machine and connect
`travel.yancmo.xyz` through a named Cloudflare Tunnel.

Why this fits:

- the application already runs as three Docker services;
- the current database is about 8 MB;
- the current photo library is about 112 MB;
- the Ubuntu machine provides far more storage than free app-hosting volumes;
- Cloudflare Tunnel does not require opening an inbound router port;
- keeping the Mac as the development machine avoids tying the family site to a
  laptop that sleeps or leaves home.

## Photo growth

Continue using the Ubuntu disk initially. New uploads are resized to a maximum
of 1600 px plus a thumbnail. Add Cloudflare R2 as the off-site photo store or
backup when desired. Its current Standard free tier includes 10 GB-month of
storage, which is ample for experimenting with many thousands of optimized
family photos.

## Backups before public launch

Use two copies outside the running containers:

1. a nightly PostgreSQL dump;
2. a nightly copy of the photo directory;
3. one off-site destination, such as R2 or another machine.

Test a restore before treating the site as the permanent family archive.

## Why not move everything to a free app provider now?

The current application needs an always-running Node service, PostgreSQL, image
processing, and persistent photo storage. Typical free application plans have
small or temporary disks, sleep when idle, or provide too little memory for the
complete Docker stack. A Workers/D1/R2 version could fit a generous free tier,
but it would require replacing the existing Express/PostgreSQL backend and image
pipeline. That is a later optimization rather than the shortest route to a
reliable family site.
