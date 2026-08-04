# Journey structure notes

## The model to preserve

A journey is the actual vacation or travel event. A journey can contain several
memories or stops. Photo-derived locations should not automatically become
independent memories without user confirmation.

Example:

- Journey: Mexican Riviera Cruise, May 2018
  - Los Angeles / Hollywood — May 24, 2018 — toured Hollywood the day before embarkation
  - Cruise embarkation — May 25, 2018
  - Mazatlán — May 29, 2018
  - Puerto Vallarta — May 31, 2018
  - Cabo San Lucas — June 1, 2018

- Journey: Tecumseh to Gallipolis Road Trip, July 2004
  - Origin: Tecumseh, Oklahoma
  - Gateway Arch, St. Louis, Missouri — July 30, 2004
  - Busler's Truck Stop Giant Santa, Haubstadt, Indiana — July 31, 2004
    - Confirmed by the user from the photo identification
    - The statue stood at a truck stop just south of the I-64 and US 41
      interchange near Evansville in 2004
  - Destination: Gallipolis, Ohio — arrival date still unknown

## Existing records that need review

- Los Angeles appears twice as records 14 and 24. Record 24 has a linked photo.
- Mazatlán appears twice as records 15 and 25. Record 25 has a linked photo.
- London / Westminster appears in multiple records spanning December 2019 and
  January 2020.
- Many `Unknown Location` records retain dates and geotagged photos and should
  be investigated before removal.

## Date handling

Do not invent a full date when only a year, approximate year, or no date is
known. The future journey editor should support:

- exact date or date range;
- year only;
- approximate year;
- unknown date;
- planned/future travel.

## Photo handling

Keep a small display image only when a memory benefits from it. Preserve the
original EXIF-derived date and coordinates in the database, while generating a
lower-resolution display copy for the site.
