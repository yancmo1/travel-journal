-- Idempotent, family-specific journey seeds from confirmed conversation details.

INSERT INTO journeys (title, start_date, end_date, journey_type, summary, created_by)
SELECT
  'Mexican Riviera Cruise',
  DATE '2018-05-24',
  DATE '2018-06-01',
  'Cruise',
  'We toured Los Angeles and Hollywood before sailing to Mazatlán, Puerto Vallarta, and Cabo San Lucas.',
  (SELECT MIN(id) FROM users)
WHERE NOT EXISTS (
  SELECT 1 FROM journeys WHERE title = 'Mexican Riviera Cruise' AND start_date = DATE '2018-05-24'
);

INSERT INTO journeys (title, start_date, date_label, journey_type, summary, created_by)
SELECT
  'Tecumseh to Gallipolis Road Trip',
  DATE '2004-07-30',
  'July 2004 — arrival date still unknown',
  'Road Trip',
  'A family road trip from Tecumseh, Oklahoma to Gallipolis, Ohio, with memorable stops along the way.',
  (SELECT MIN(id) FROM users)
WHERE NOT EXISTS (
  SELECT 1 FROM journeys WHERE title = 'Tecumseh to Gallipolis Road Trip' AND start_date = DATE '2004-07-30'
);

INSERT INTO journeys (title, start_date, date_label, journey_type, summary, created_by)
SELECT
  'Return to Gallipolis',
  DATE '2005-08-04',
  'August 2005',
  'Road Trip',
  'Another family road trip from Tecumseh to Gallipolis.',
  (SELECT MIN(id) FROM users)
WHERE NOT EXISTS (
  SELECT 1 FROM journeys WHERE title = 'Return to Gallipolis' AND start_date = DATE '2005-08-04'
);

-- Keep the photo-backed duplicate when the import produced two copies.
UPDATE trips
SET
  location_name = 'Los Angeles & Hollywood',
  city = 'Los Angeles',
  start_date = DATE '2018-05-24',
  trip_type = 'Day Trip',
  notes = 'We toured Hollywood the day before the cruise.',
  journey_id = (SELECT id FROM journeys WHERE title = 'Mexican Riviera Cruise' AND start_date = DATE '2018-05-24' LIMIT 1),
  journey_order = 1
WHERE id = 24;

UPDATE trips
SET
  journey_id = (SELECT id FROM journeys WHERE title = 'Mexican Riviera Cruise' AND start_date = DATE '2018-05-24' LIMIT 1),
  journey_order = CASE id WHEN 25 THEN 2 WHEN 26 THEN 3 WHEN 27 THEN 4 END,
  trip_type = 'Cruise'
WHERE id IN (25, 26, 27);

UPDATE trips
SET
  journey_id = (SELECT id FROM journeys WHERE title = 'Tecumseh to Gallipolis Road Trip' AND start_date = DATE '2004-07-30' LIMIT 1),
  journey_order = CASE id WHEN 63 THEN 1 WHEN 64 THEN 2 END
WHERE id IN (63, 64);

INSERT INTO trips (
  location_name, city, state, country, date_label, date_precision, trip_type,
  notes, journey_id, journey_order, created_by
)
SELECT
  'Gallipolis, Ohio', 'Gallipolis', 'Ohio', 'United States',
  'July 2004 — exact arrival date unknown', 'unknown', 'Road Trip',
  'The destination of our 2004 road trip from Tecumseh.',
  (SELECT id FROM journeys WHERE title = 'Tecumseh to Gallipolis Road Trip' AND start_date = DATE '2004-07-30' LIMIT 1),
  3,
  (SELECT MIN(id) FROM users)
WHERE NOT EXISTS (
  SELECT 1 FROM trips
  WHERE journey_id = (
    SELECT id FROM journeys WHERE title = 'Tecumseh to Gallipolis Road Trip' AND start_date = DATE '2004-07-30' LIMIT 1
  )
  AND city = 'Gallipolis'
);

UPDATE trips
SET
  journey_id = (SELECT id FROM journeys WHERE title = 'Return to Gallipolis' AND start_date = DATE '2005-08-04' LIMIT 1),
  journey_order = 1
WHERE id = 65;
