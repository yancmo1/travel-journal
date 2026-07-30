import 'dotenv/config';
import { backfillPhotoLocations } from '../src/services/locationBackfill.js';
import pool from '../src/utils/db.js';

try {
  const result = await backfillPhotoLocations();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
