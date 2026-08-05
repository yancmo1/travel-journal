import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export async function initDatabase() {
  const result = await query('SELECT NOW()');
  console.log('Database connected at:', result.rows[0].now);

  // Small, idempotent upgrades for installations created with the original schema.
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254)');
  await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS site_admin BOOLEAN NOT NULL DEFAULT FALSE');
  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash VARCHAR(64) PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)');
  await query(`
    CREATE TABLE IF NOT EXISTS bug_reports (
      id UUID PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      title VARCHAR(120) NOT NULL,
      details TEXT NOT NULL,
      request_id VARCHAR(120),
      page VARCHAR(200),
      url VARCHAR(500),
      app_version VARCHAR(40),
      user_agent VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC)');
  await query('ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS screenshot BYTEA');
  await query('ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS screenshot_filename VARCHAR(160)');
  await query('ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS screenshot_mime_type VARCHAR(80)');
  await query('ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS github_issue_id BIGINT');
  await query('ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS github_issue_number INTEGER');
  await query('ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS github_issue_url VARCHAR(500)');
  await query('ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS github_issue_created_at TIMESTAMP');
  await query('ALTER TABLE trips ADD COLUMN IF NOT EXISTS city VARCHAR(100)');
  await query('ALTER TABLE trips ADD COLUMN IF NOT EXISTS date_label VARCHAR(100)');
  await query("ALTER TABLE trips ADD COLUMN IF NOT EXISTS date_precision VARCHAR(20) DEFAULT 'exact'");
  await query('ALTER TABLE trips ALTER COLUMN start_date DROP NOT NULL');
  await query('ALTER TABLE travelers ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id)');
  await query(`
    CREATE TABLE IF NOT EXISTS journeys (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      start_date DATE,
      end_date DATE,
      date_label VARCHAR(100),
      journey_type VARCHAR(50) DEFAULT 'Other',
      summary TEXT,
      created_by INT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query('ALTER TABLE trips ADD COLUMN IF NOT EXISTS journey_id INT REFERENCES journeys(id) ON DELETE SET NULL');
  await query('ALTER TABLE trips ADD COLUMN IF NOT EXISTS journey_order INT');
  await query('CREATE INDEX IF NOT EXISTS idx_trips_journey_id ON trips(journey_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_trips_created_by ON trips(created_by)');
  await query('CREATE INDEX IF NOT EXISTS idx_journeys_created_by ON journeys(created_by)');
  await query('CREATE INDEX IF NOT EXISTS idx_travelers_created_by ON travelers(created_by)');
  await query('ALTER TABLE journeys ADD COLUMN IF NOT EXISTS cover_photo_id INT');
  await query('ALTER TABLE journeys ADD COLUMN IF NOT EXISTS share_token VARCHAR(64)');
  await query('ALTER TABLE journeys ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMP');
  await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_journeys_share_token ON journeys(share_token) WHERE share_token IS NOT NULL');
  await query('ALTER TABLE photos ADD COLUMN IF NOT EXISTS caption TEXT');
  await query('ALTER TABLE photos ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0');
  await query('ALTER TABLE photos ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT false');
  await query('ALTER TABLE photos ADD COLUMN IF NOT EXISTS rotation INTEGER NOT NULL DEFAULT 0');
  await query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY uploaded_at NULLS LAST, id) - 1 AS position
      FROM photos
    )
    UPDATE photos
    SET sort_order = ranked.position
    FROM ranked
    WHERE photos.id = ranked.id
      AND (SELECT COUNT(DISTINCT sort_order) FROM photos) <= 1
  `);

  // Bring the original placeholder names forward without breaking their memory links.
  await query(`
    UPDATE travelers
    SET name = 'Yancy', relationship = 'husband'
    WHERE LOWER(name) = 'you'
      AND NOT EXISTS (SELECT 1 FROM travelers WHERE LOWER(name) = 'yancy')
  `);
  await query(`
    UPDATE travelers
    SET name = 'Amber', relationship = 'wife'
    WHERE LOWER(name) = 'wife'
      AND NOT EXISTS (SELECT 1 FROM travelers WHERE LOWER(name) = 'amber')
  `);
  await query(`
    UPDATE travelers
    SET name = 'Josh', relationship = 'child'
    WHERE LOWER(name) = 'test child'
      AND NOT EXISTS (SELECT 1 FROM travelers WHERE LOWER(name) = 'josh')
  `);

  // Keep the core family list available on both new and existing installations.
  await query(`
    INSERT INTO travelers (name, relationship)
    SELECT family.name, family.relationship
    FROM (VALUES
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
    ) AS family(name, relationship)
    WHERE NOT EXISTS (
      SELECT 1
      FROM travelers existing
      WHERE LOWER(existing.name) = LOWER(family.name)
    )
  `);
}

export default pool;
