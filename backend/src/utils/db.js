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
  await query('ALTER TABLE trips ADD COLUMN IF NOT EXISTS city VARCHAR(100)');
  await query('ALTER TABLE trips ADD COLUMN IF NOT EXISTS date_label VARCHAR(100)');
  await query("ALTER TABLE trips ADD COLUMN IF NOT EXISTS date_precision VARCHAR(20) DEFAULT 'exact'");
  await query('ALTER TABLE trips ALTER COLUMN start_date DROP NOT NULL');
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

  // Keep the core family list available on both new and existing installations.
  await query(`
    INSERT INTO travelers (name, relationship)
    SELECT family.name, family.relationship
    FROM (VALUES
      ('Dawson', 'grandchild'),
      ('Luke', 'grandchild'),
      ('Charity', 'grandchild'),
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
