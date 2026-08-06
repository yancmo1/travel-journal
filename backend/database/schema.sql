-- Postcards of Us Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(254) UNIQUE,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  site_admin BOOLEAN NOT NULL DEFAULT FALSE,
  home_latitude DECIMAL(10, 8),
  home_longitude DECIMAL(11, 8),
  home_label VARCHAR(255),
  home_icon VARCHAR(40) NOT NULL DEFAULT 'h',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Persistent browser sessions. Store only a hash of the opaque cookie token.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Travelers table (family members who go on trips)
CREATE TABLE IF NOT EXISTS travelers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  relationship VARCHAR(50) DEFAULT 'other', -- 'husband', 'wife', 'child', 'grandchild', 'other'
  is_active BOOLEAN DEFAULT true,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Journeys group individual place memories into one larger trip.
CREATE TABLE IF NOT EXISTS journeys (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  start_date DATE,
  end_date DATE,
  date_label VARCHAR(100),
  journey_type VARCHAR(50) DEFAULT 'Other',
  summary TEXT,
  cover_photo_id INT,
  share_token VARCHAR(64) UNIQUE,
  share_expires_at TIMESTAMP,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  location_name VARCHAR(255) NOT NULL,
  place_name VARCHAR(255),
  formatted_address VARCHAR(500),
  city VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  country VARCHAR(100),
  state VARCHAR(100),
  start_date DATE,
  end_date DATE,
  date_label VARCHAR(100),
  date_precision VARCHAR(20) DEFAULT 'exact',
  trip_type VARCHAR(50) DEFAULT 'Other', -- 'Road Trip', 'Flight', 'Cruise', 'Day Trip', 'Other'
  notes TEXT,
  journey_id INT REFERENCES journeys(id) ON DELETE SET NULL,
  journey_order INT,
  home_distance_miles DECIMAL(10, 2),
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trip-Travelers junction table (many-to-many)
CREATE TABLE IF NOT EXISTS trip_travelers (
  trip_id INT REFERENCES trips(id) ON DELETE CASCADE,
  traveler_id INT REFERENCES travelers(id) ON DELETE CASCADE,
  PRIMARY KEY (trip_id, traveler_id)
);

-- Photos table
CREATE TABLE IF NOT EXISTS photos (
  id SERIAL PRIMARY KEY,
  trip_id INT REFERENCES trips(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  thumbnail_path VARCHAR(500),
  file_size INT,
  mime_type VARCHAR(50),
  date_taken TIMESTAMP,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_cover BOOLEAN NOT NULL DEFAULT false,
  rotation INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trips_start_date ON trips(start_date);
CREATE INDEX IF NOT EXISTS idx_trips_location ON trips(location_name);
CREATE INDEX IF NOT EXISTS idx_trips_type ON trips(trip_type);
CREATE INDEX IF NOT EXISTS idx_trips_journey_id ON trips(journey_id);
CREATE INDEX IF NOT EXISTS idx_trips_created_by ON trips(created_by);
CREATE INDEX IF NOT EXISTS idx_journeys_created_by ON journeys(created_by);
CREATE INDEX IF NOT EXISTS idx_travelers_created_by ON travelers(created_by);
CREATE INDEX IF NOT EXISTS idx_photos_trip_id ON photos(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_travelers_trip ON trip_travelers(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_travelers_traveler ON trip_travelers(traveler_id);

ALTER TABLE journeys
  ADD CONSTRAINT journeys_cover_photo_id_fkey
  FOREIGN KEY (cover_photo_id) REFERENCES photos(id) ON DELETE SET NULL;
