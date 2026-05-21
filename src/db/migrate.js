require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const ALTER_STATEMENTS = [
  `ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS waitlist_limit INTEGER`,
];

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    for (const stmt of ALTER_STATEMENTS) {
      await client.query(stmt);
    }
    console.log('Migration completed successfully');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
