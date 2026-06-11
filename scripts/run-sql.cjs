// Dev utility: run a SQL file or inline SQL against the remote Supabase DB.
// Usage: node scripts/run-sql.cjs path/to/query.sql
//        node scripts/run-sql.cjs --sql "select 1"
const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
if (!supabaseUrl) {
  console.error('Missing VITE_SUPABASE_URL in .env');
  process.exit(1);
}
const projectId = new URL(supabaseUrl).hostname.split('.')[0];

const pool = new Pool({
  host: `db.${projectId}.supabase.co`,
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'postgres',
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/run-sql.cjs <file.sql> | --sql "<query>"');
    process.exit(1);
  }
  const sql = arg === '--sql' ? process.argv[3] : fs.readFileSync(arg, 'utf8');
  const client = await pool.connect();
  try {
    const result = await client.query(sql);
    const results = Array.isArray(result) ? result : [result];
    for (const r of results) {
      if (r.rows && r.rows.length) {
        console.table(r.rows);
      } else {
        console.log(`${r.command ?? 'OK'} (${r.rowCount ?? 0} rows)`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('SQL error:', e.message);
  process.exit(1);
});
