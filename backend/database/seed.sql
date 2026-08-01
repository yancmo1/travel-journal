-- Seed data for Postcards of Us

-- Default travelers (the couple)
INSERT INTO travelers (name, relationship) VALUES 
  ('Yancy', 'husband'),
  ('Amber', 'wife'),
  ('Josh', 'child'),
  ('Jonathan', 'child'),
  ('Aden', 'child'),
  ('Charity', 'grandchild'),
  ('Dawson', 'grandchild'),
  ('Luke', 'grandchild'),
  ('Adalynn', 'grandchild'),
  ('Elayna', 'grandchild')
ON CONFLICT DO NOTHING;

-- Sample trips from the PRD
INSERT INTO trips (location_name, latitude, longitude, country, state, start_date, end_date, trip_type, notes, home_distance_miles) VALUES
  ('Las Vegas, NV', 36.1699, -115.1398, 'United States', 'Nevada', '2001-06-15', '2001-06-18', 'Flight', 'Got married! 💒', 1086),
  ('San Antonio, TX', 29.4241, -98.4936, 'United States', 'Texas', '2005-07-10', '2005-07-14', 'Road Trip', 'Family trip with kids - visited the Alamo and River Walk', 452),
  ('Branson, MO', 36.6437, -93.2185, 'United States', 'Missouri', '2008-06-20', '2008-06-25', 'Road Trip', 'Family trip with kids - Silver Dollar City, shows, and fun!', 262),
  ('Orlando, FL - Disney World', 28.3772, -81.5707, 'United States', 'Florida', '2010-03-15', '2010-03-22', 'Flight', 'The big Disney trip! Magic Kingdom, Epcot, and all the parks', 1156),
  ('Columbus, OH', 39.9612, -82.9988, 'United States', 'Ohio', '2012-08-05', '2012-08-10', 'Road Trip', 'Family trip with kids - visiting relatives and exploring Ohio', 817),
  ('Destin, FL', 30.3935, -86.4958, 'United States', 'Florida', '2015-06-28', '2015-07-05', 'Road Trip', 'Beach vacation! Beautiful white sand beaches', 767),
  ('Cancun, Mexico', 21.1619, -86.8515, 'Mexico', 'Quintana Roo', '2018-02-10', '2018-02-17', 'Flight', 'Beach vacation - all-inclusive resort', 1173),
  ('Cancun, Mexico', 21.1619, -86.8515, 'Mexico', 'Quintana Roo', '2022-01-15', '2022-01-22', 'Flight', 'Anniversary beach trip - returned to our favorite spot', 1173)
ON CONFLICT DO NOTHING;

-- Link travelers to trips (all trips include both partners for now)
INSERT INTO trip_travelers (trip_id, traveler_id) 
SELECT t.id, tr.id 
FROM trips t, travelers tr 
WHERE tr.relationship IN ('husband', 'wife')
ON CONFLICT DO NOTHING;
