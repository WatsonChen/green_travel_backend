require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const ALTER_STATEMENTS = [
  `ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS waitlist_limit INTEGER`,
  `ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS contract_text TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'credit_card'`,
  `CREATE TABLE IF NOT EXISTS form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    fields JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    signer_name VARCHAR(100),
    signature_data TEXT NOT NULL,
    contract_snapshot TEXT,
    signed_at TIMESTAMPTZ DEFAULT NOW()
  )`,
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
