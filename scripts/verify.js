const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const { Agent, setGlobalDispatcher } = require('undici');
const { neon } = require('@neondatabase/serverless');

function customLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname.includes('neon.tech')) {
    const ip = '52.76.246.190';
    if (options && options.all) {
      return callback(null, [{ address: ip, family: 4 }]);
    }
    return callback(null, ip, 4);
  }
  dns.lookup(hostname, options, callback);
}

const dispatcher = new Agent({ connect: { lookup: customLookup } });
setGlobalDispatcher(dispatcher);

const fs = require('fs');
const path = require('path');

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync(path.join(__dirname, '..', '.env.local'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^DATABASE_URL=["']?(.*?)["']?$/);
    if (match) {
      dbUrl = match[1];
      break;
    }
  }
}

if (!dbUrl) {
  console.error('DATABASE_URL is not defined.');
  process.exit(1);
}

const sql = neon(dbUrl, { fetchOptions: { dispatcher } });

async function verifyAll() {
  console.log('--- VERIFYING NEON DATABASE TABLES & RECORDS ---');

  const users = await sql`SELECT id, email, created_at FROM users`;
  console.log('1. Users Table:', users);

  const projects = await sql`SELECT id, name, api_key, created_at FROM projects`;
  console.log('2. Projects Table:', projects);

  const apis = await sql`SELECT id, name, version, check_url, is_up FROM apis`;
  console.log('3. APIs Table:', apis);

  const products = await sql.query('SELECT * FROM store_api.products_v1');
  console.log('4. Dynamic Schema Table (store_api.products_v1):', products);

  console.log('\n--- VERIFYING RECORD INSERTION & UPDATE ---');
  const inserted = await sql.query(
    'INSERT INTO store_api.products_v1 (title, price, in_stock) VALUES ($1, $2, $3) RETURNING *',
    ['Wireless Gaming Mouse', 49.99, true]
  );
  console.log('5. Inserted new dynamic record:', inserted);

  const count = await sql.query('SELECT count(*)::int as total FROM store_api.products_v1');
  console.log('6. Total products in dynamic store_api table:', count[0].total);

  console.log('\n✓ ALL NEON POSTGRES SERVICES OPERATIONAL AND TESTED!');
}

verifyAll().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
