const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('./db');

async function main() {
  const directory = path.resolve(__dirname, '../migrations');
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    await pool.query(fs.readFileSync(path.join(directory, file), 'utf8'));
  }
  await pool.end();
}
main().catch((error) => { console.error(error); process.exit(1); });

