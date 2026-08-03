# Postcards of Us To-Do

This list is intentionally small and prioritized. We can check items off as we go; no item is committed automatically.

## Next up

- [ ] Stabilize the live Cloudflare beta: run authenticated workflow checks,
      verify both primary phones, and review logs, backups, and usage.
- [x] Run a live end-to-end check: sign in as Amber, add a memory, search a landmark, select a grandkid, upload a photo, edit it, and view the photo full-screen.
- [x] Verify the first R2 backup and complete a small restore drill so the backup is proven, not just configured.
- [x] Add Google Places guardrails: cache repeated searches, debounce requests, and set a billing budget alert.
- [x] Fix the memory form's initial `0.0000, 0.0000` coordinate display before a location is selected.
- [ ] Show the selected landmark's business name and address clearly after a Google Places result is chosen.
- [ ] Test the main workflows on both your phone and Amber's phone.
- [ ] Rotate or revoke the retired Ubuntu GHCR credential after the rollback
      window, if it is no longer needed.

## Photo controls

- [x] Preview selected photos before saving.
- [x] Remove selected photos before saving.
- [x] Show a basic upload progress bar and success state.
- [x] Choose a cover photo for each memory.
- [x] Add captions to saved photos.
- [x] Rotate and reorder photos.
- [x] Replace alert-only upload failures with clear inline errors and retry guidance.

## Data and maintenance

- [x] Use Cleanup to review duplicate memories, missing places, and incomplete dates.
- [x] Confirm Dawson, Luke, Charity, Adalynn, and Elayna appear correctly in every traveler filter.
- [x] Add a dedicated People page for renaming, adding, deactivating, and correcting relationships.
- [x] Add person-based filtering from the People page and All Places page.
- [x] Document the private production environment and the simple deploy/recovery commands.

## Reliability and mobile

- [x] Add an automated post-deploy smoke test that creates a temporary memory, uploads a photo, verifies it, and cleans up.
- [x] Add backup visibility: last successful R2 backup, last database dump, photo storage use, and a stale-backup warning.
- [x] Increase mobile touch targets and make camera/photo-library uploads effortless.
- [x] Add installable home-screen app behavior (PWA).

## Later improvements

- [x] Add stronger search across memories, notes, people, and landmarks.
- [x] Add an export/import safety net for the family’s memory data.
- [x] Add bulk photo tagging or bulk editing only after the core workflow feels effortless.
- [x] Add a timeline view and “On this day” memories.
- [x] Add journey cover photos.
- [x] Add printable or downloadable family travel books.
- [x] Add private share links for selected journeys.
- [ ] Add optional social login for account creation and sign-in (Google, Facebook, Apple, and other widely used providers) after the beta.

## Completed recently

- [x] Google Places landmark search with Nominatim fallback.
- [x] Photo metadata suggestions for dates and GPS locations.
- [x] Zoomable memory photos.
- [x] Smaller photo uploader that lets saved photos lead.
- [x] Grandkid traveler entries.
- [x] GHCR publishing and Ubuntu deployment refresh.
