const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const { Agent, setGlobalDispatcher } = require('undici');
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

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

function hashPassword(password, salt) {
  const derived = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');
  return derived.toString('hex');
}

async function seed() {
  console.log('Seeding Neon database...');
  const email = 'admin@api-frrm.com';
  const password = 'AdminPassword123!';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);

  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  let userId;
  if (existing.length === 0) {
    const inserted = await sql`
      INSERT INTO users (email, password_hash, password_salt)
      VALUES (${email}, ${hash}, ${salt})
      RETURNING id
    `;
    userId = inserted[0].id;
    console.log('✓ Created default admin user with ID:', userId);
  } else {
    userId = existing[0].id;
    console.log('✓ Default admin user already exists with ID:', userId);
  }

  // Create demo project: store_api
  const projName = 'store_api';
  const existingProj = await sql`SELECT id, api_key FROM projects WHERE name = ${projName}`;
  let apiKey;
  if (existingProj.length === 0) {
    apiKey = 'frrm_' + crypto.randomBytes(24).toString('hex');
    await sql.query(`CREATE SCHEMA IF NOT EXISTS store_api`);
    const insertedProj = await sql`
      INSERT INTO projects (user_id, name, api_key)
      VALUES (${userId}, ${projName}, ${apiKey})
      RETURNING id
    `;
    const projId = insertedProj[0].id;

    // Create demo products table in store_api schema
    await sql.query(`
      CREATE TABLE IF NOT EXISTS store_api.products_v1 (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        title TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        in_stock BOOLEAN DEFAULT true
      )
    `);

    const colDefs = JSON.stringify([
      { name: 'title', type: 'text', required: true },
      { name: 'price', type: 'float', required: true },
      { name: 'in_stock', type: 'bool', default: true },
    ]);

    await sql`
      INSERT INTO apis (project_id, name, version, columns, check_url)
      VALUES (${projId}, 'products', 'v1', ${colDefs}, 'https://httpbin.org/status/200')
    `;

    // Insert sample product
    await sql.query(`
      INSERT INTO store_api.products_v1 (title, price, in_stock)
      VALUES ('Mechanical Gaming Keyboard', 89.99, true)
    `);

    console.log('✓ Created demo project "store_api"');
    console.log('✓ Created demo table "store_api.products_v1" with sample data');
    console.log('✓ Demo project API Key:', apiKey);
  } else {
    apiKey = existingProj[0].api_key;
    console.log('✓ Demo project "store_api" already exists with API Key:', apiKey);
  }

  console.log('\n======================================');
  console.log('DEFAULT LOGIN CREDENTIALS:');
  console.log('Email:    admin@api-frrm.com');
  console.log('Password: AdminPassword123!');
  console.log('API Key: ', apiKey);
  console.log('======================================\n');
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
