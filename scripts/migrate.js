const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const { Agent, setGlobalDispatcher } = require('undici');
const { neon } = require('@neondatabase/serverless');

function customLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  dns.resolve4(hostname, (err, addresses) => {
    if (err || !addresses || addresses.length === 0) {
      return dns.lookup(hostname, options, callback);
    }
    if (options && options.all) {
      return callback(null, addresses.map((ip) => ({ address: ip, family: 4 })));
    }
    callback(null, addresses[0], 4);
  });
}

const dispatcher = new Agent({
  connect: { lookup: customLookup },
});

setGlobalDispatcher(dispatcher);

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

let databaseUrl = '';
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^DATABASE_URL=["']?(.*?)["']?$/);
  if (match) {
    databaseUrl = match[1];
    break;
  }
}

const sql = neon(databaseUrl, { fetchOptions: { dispatcher } });

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT UNIQUE NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS apis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    columns JSONB NOT NULL,
    check_url TEXT,
    is_up BOOLEAN DEFAULT true,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, name, version)
  )`,
  `CREATE TABLE IF NOT EXISTS api_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
    status_code INT,
    latency_ms INT,
    checked_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS notify_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('telegram','slack','discord','email')),
    target TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_api_checks_api_id ON api_checks(api_id)`,
  `CREATE INDEX IF NOT EXISTS idx_api_checks_checked_at ON api_checks(checked_at)`
];

async function migrate() {
  console.log('Connecting to Neon PostgreSQL...');
  for (const stmt of STATEMENTS) {
    const preview = stmt.trim().substring(0, 45).replace(/\s+/g, ' ');
    console.log(`Executing: ${preview}...`);
    await sql.query(stmt);
  }

  console.log('All migrations applied successfully!');

  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log('Created tables in Neon:', tables.map((t) => t.table_name));
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
