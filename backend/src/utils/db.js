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
  // Tables will be created via schema.sql on container init
  // This just tests the connection
  const result = await query('SELECT NOW()');
  console.log('Database connected at:', result.rows[0].now);
}

export default pool;
