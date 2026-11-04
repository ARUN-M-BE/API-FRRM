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
  console.log('Adding database_type column to projects table...');
  await sql.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS database_type TEXT NOT NULL DEFAULT 'postgres';`);
  console.log('✓ Column database_type ready.');
}

run().catch(console.error);

