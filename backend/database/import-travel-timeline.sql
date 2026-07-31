-- Idempotent import of the researched travel timeline.
-- Run against an existing database after the normal schema is present.

WITH source_rows(location_name, city, state, country, start_date, end_date, trip_type, notes) AS (
  VALUES
    ('Las Vegas, NV', 'Las Vegas', 'Nevada', 'United States', DATE '2011-02-24', DATE '2011-02-28', 'Flight', 'Travelocity 510275801537; New York-New York Hotel & Casino; UA735/UA717 and AA1722/AA1576.'),
    ('Cancun, Mexico', 'Cancun', 'Quintana Roo', 'Mexico', DATE '2011-05-25', DATE '2011-05-29', 'Flight', 'Travelocity 310817110426; Barceló Tucancun Beach All Inclusive; OKC–IAH–CUN.'),
    ('Las Vegas, NV', 'Las Vegas', 'Nevada', 'United States', DATE '2012-06-17', DATE '2012-06-20', 'Flight', 'Southwest Vacations L91TN004; Planet Hollywood Resort and Casino; four travelers.'),
    ('Tulsa, OK', 'Tulsa', 'Oklahoma', 'United States', DATE '2013-10-04', DATE '2013-10-05', 'Hotel', 'Courtyard Tulsa Downtown; confirmation 83698922.'),
    ('Branson, MO', 'Branson', 'Missouri', 'United States', DATE '2013-10-17', DATE '2013-10-18', 'Other', 'Bluegreen Ozark Mountains vacation; account 9028137; Radisson Hotel–Branson.'),
    ('Minneapolis, MN', 'Minneapolis', 'Minnesota', 'United States', DATE '2014-09-08', DATE '2014-09-10', 'Flight', 'Southwest Vacations W992Q004; confirmation F9XGNU; OKC–MDW–MSP.'),
    ('Fort Walton Beach, FL', 'Fort Walton Beach', 'Florida', 'United States', DATE '2015-05-31', DATE '2015-06-05', 'Hotel', 'Emerald Coast Inn and Suites; Travelocity 113149635023.'),
    ('Kansas City, MO', 'Kansas City', 'Missouri', 'United States', DATE '2015-09-13', DATE '2015-09-14', 'Hotel', 'Fairfield Inn & Suites Kansas City Liberty; Travelocity 121125246188.'),
    ('St. Robert, MO', 'St. Robert', 'Missouri', 'United States', DATE '2015-10-13', DATE '2015-10-15', 'Hotel', 'Super 8 St Robert/Ft Leonard Wood Area; Travelocity 121608670668.'),
    ('Texas City, TX', 'Texas City', 'Texas', 'United States', DATE '2016-02-13', DATE '2016-02-14', 'Hotel', 'Motel 6 Texas City; Travelocity 7149912154994; likely pre-cruise.'),
    ('Carnival Magic', 'Port Canaveral', 'Florida', 'United States', DATE '2016-02-14', DATE '2016-02-21', 'Cruise', 'Eastern Caribbean; Carnival booking 6V3KN6.'),
    ('Lewisville, TX', 'Lewisville', 'Texas', 'United States', DATE '2017-02-17', DATE '2017-02-18', 'Hotel', 'Country Inn & Suites by Carlson; Travelocity 7245117152228.'),
    ('Minneapolis, MN', 'Minneapolis', 'Minnesota', 'United States', DATE '2017-05-31', DATE '2017-06-01', 'Flight', 'Travelocity 7264735278770; DL4541 outbound and DL4448 return; completion unverified.'),
    ('Texas City, TX', 'Texas City', 'Texas', 'United States', DATE '2017-06-10', DATE '2017-06-11', 'Hotel', 'Best Western Mainland Inn & Suites; Travelocity 7240406080766; likely pre-cruise.'),
    ('Carnival Breeze', 'Galveston', 'Texas', 'United States', DATE '2017-06-11', DATE '2017-06-18', 'Cruise', 'Czm Plus - Ex W Cari; Carnival booking 9S9QW7.'),
    ('Los Angeles / Long Beach', 'Los Angeles', 'California', 'United States', DATE '2018-05-25', DATE '2018-06-02', 'Flight', 'Travelocity 7292138801249; AS4024 outbound; AA2425/AA3596 return; supports Carnival Splendor.'),
    ('Carnival Splendor', 'Long Beach', 'California', 'United States', DATE '2018-05-26', DATE '2018-06-02', 'Cruise', 'Mexican Riviera; Carnival booking 7LP4J5.'),
    ('Durant, OK', 'Durant', 'Oklahoma', 'United States', DATE '2018-11-12', DATE '2018-11-15', 'Hotel', 'Holiday Inn Express; confirmation 45020657; needs grouping.'),
    ('Durant, OK', 'Durant', 'Oklahoma', 'United States', DATE '2018-12-16', DATE '2018-12-19', 'Hotel', 'Holiday Inn Express; confirmation 41726182; needs grouping.'),
    ('St. Paul, MN rental', 'St. Paul', 'Minnesota', 'United States', DATE '2019-06-09', DATE '2019-06-11', 'Road Trip', 'Expedia itinerary 7438317554159 and Hertz receipt; needs grouping.'),
    ('Gainesville, TX', 'Gainesville', 'Texas', 'United States', DATE '2019-06-17', DATE '2019-06-19', 'Hotel', 'Holiday Inn Express; confirmation 41164025; needs grouping.'),
    ('Gainesville, TX', 'Gainesville', 'Texas', 'United States', DATE '2019-06-25', DATE '2019-06-26', 'Hotel', 'Holiday Inn Express; confirmation 45360902; needs grouping.'),
    ('Carnival Vista', 'Galveston', 'Texas', 'United States', DATE '2019-09-21', DATE '2019-09-28', 'Cruise', 'Western Caribbean; Carnival booking 8BLX13.'),
    ('Montego Bay / Negril', 'Negril', NULL, 'Jamaica', DATE '2021-02-19', DATE '2021-02-24', 'Flight', 'Travelocity 72033481871202; Couples Swept Away; booking-status conflict.'),
    ('Miami', 'Miami', 'Florida', 'United States', DATE '2021-02-26', DATE '2021-03-06', 'Flight', 'Travelocity 7528938585261; Hotel St Augustine; flight/hotel later canceled or changed.'),
    ('Carnival Dream', 'Galveston', 'Texas', 'United States', DATE '2022-05-29', DATE '2022-06-04', 'Cruise', 'Western Caribbean; Carnival booking J42SC1.'),
    ('Mardi Gras', 'Port Canaveral', 'Florida', 'United States', DATE '2023-04-15', DATE '2023-04-22', 'Cruise', 'Exotic Eastern Caribbean; Carnival booking M15CL0.'),
    ('Pittsburgh, PA', 'Pittsburgh', 'Pennsylvania', 'United States', DATE '2024-03-28', DATE '2024-04-02', 'Road Trip', 'Delta HCQT8K; Budget 47152075US5; HIE Monaca reservation 40727684.'),
    ('Carnival Dream', 'Galveston', 'Texas', 'United States', DATE '2024-09-01', DATE '2024-09-07', 'Cruise', 'Western Caribbean; Carnival booking X5X2X0.'),
    ('Miami / Carnival Horizon', 'Miami', 'Florida', 'United States', DATE '2025-04-11', DATE '2025-04-20', 'Cruise', 'Carnival booking M7PJ58; Hampton Inn pre-cruise hotel 786843038.'),
    ('Carnival Jubilee', 'Galveston', 'Texas', 'United States', DATE '2025-11-08', DATE '2025-11-15', 'Cruise', 'Western Caribbean; Carnival booking DM17K0.'),
    ('Galveston area', 'Galveston', 'Texas', 'United States', DATE '2026-02-20', DATE '2026-02-22', 'Hotel', 'Best Western Plus Galveston Suites; Priceline 272-423-693-97; needs grouping.'),
    ('Carnival Breeze', 'Galveston', 'Texas', 'United States', DATE '2026-03-27', DATE '2026-04-02', 'Cruise', 'Western Caribbean; Carnival booking NQ01N8; Alvin pre-cruise hotel and parking.'),
    ('Seattle / Voyager of the Seas', 'Seattle', 'Washington', 'United States', DATE '2026-06-04', DATE '2026-06-12', 'Cruise', 'Royal Caribbean reservation 3107069; Alaska cruise.'),
    ('Pittsburgh, PA', 'Pittsburgh', 'Pennsylvania', 'United States', DATE '2026-10-10', DATE '2026-10-17', 'Road Trip', 'American GZMCJZ; rental 398356688; planned, verify active booking.'),
    ('Carnival Venezia', 'Cape Canaveral', 'Florida', 'United States', DATE '2027-02-20', DATE '2027-03-07', 'Cruise', 'Carnival booking JG18X9; American LLEQFH; planned.'),
    ('Carnival Breeze', 'Galveston', 'Texas', 'United States', DATE '2027-09-04', DATE '2027-09-11', 'Cruise', 'Western Caribbean; Carnival booking XF26P4; planned.'),
    ('Carnival Breeze', 'Galveston', 'Texas', 'United States', DATE '2028-01-03', DATE '2028-01-15', 'Cruise', 'Southern Caribbean; Carnival booking VD52S9; planned.')
)
INSERT INTO trips (
  location_name, city, state, country, start_date, end_date, trip_type, notes, created_by
)
SELECT
  s.location_name, s.city, s.state, s.country, s.start_date, s.end_date, s.trip_type, s.notes,
  COALESCE((SELECT id FROM users WHERE username = 'yancmo' LIMIT 1), (SELECT MIN(id) FROM users))
FROM source_rows s
WHERE NOT EXISTS (
  SELECT 1 FROM trips t
  WHERE t.location_name = s.location_name
    AND t.start_date = s.start_date
    AND COALESCE(t.end_date, DATE '9999-12-31') = COALESCE(s.end_date, DATE '9999-12-31')
);

INSERT INTO trip_travelers (trip_id, traveler_id)
SELECT t.id, tr.id
FROM trips t
JOIN travelers tr ON tr.name IN ('Yancy', 'Amber')
WHERE t.notes LIKE ANY (ARRAY[
  'Travelocity %', 'Southwest Vacations %', 'Courtyard Tulsa%', 'Bluegreen %',
  'Emerald Coast%', 'Fairfield Inn%', 'Super 8%', 'Motel 6%', 'Eastern Caribbean%',
  'Country Inn%', 'Best Western%', 'Czm Plus%', 'Travelocity 729%', 'Mexican Riviera%',
  'Holiday Inn%', 'Expedia itinerary%', 'Western Caribbean%', 'Couples Swept%',
  'Travelocity 752%', 'Exotic Eastern%', 'Delta HC%', 'Carnival booking%',
  'Royal Caribbean%', 'American GZ%', 'Carnival booking JG%', 'Southern Caribbean%'
])
ON CONFLICT DO NOTHING;
