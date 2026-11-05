const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const { Agent, setGlobalDispatcher } = require('undici');
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

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

async function run() {
  console.log('Running migration 004 for API Explorer & Real-Time Monitoring...');

  await sql.query(`ALTER TABLE api_checks ADD COLUMN IF NOT EXISTS error_message TEXT;`);
  await sql.query(`ALTER TABLE api_checks ADD COLUMN IF NOT EXISTS endpoint TEXT;`);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS alert_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      api_id UUID REFERENCES apis(id) ON DELETE CASCADE,
      api_name TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('FAILURE', 'RECOVERY', 'DEGRADED')),
      status_code INT,
      latency_ms INT,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await sql.query(`CREATE INDEX IF NOT EXISTS idx_alert_events_user_id ON alert_events(user_id);`);
  await sql.query(`CREATE INDEX IF NOT EXISTS idx_alert_events_created_at ON alert_events(created_at DESC);`);

  console.log('✓ Migration 004 completed successfully.');
}

run().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
