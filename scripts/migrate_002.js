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

const sqlFile = path.join(__dirname, '..', 'migrations', '002_api_client.sql');
let sqlContent = fs.readFileSync(sqlFile, 'utf8');

async function runMigration() {
  console.log('Applying 002_api_client.sql...');
  
  // Remove comment lines
  const cleanSql = sqlContent
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  // Split on semicolons
  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    try {
      await sql.query(stmt);
      console.log('✓ Executed:', stmt.substring(0, 50).replace(/\s+/g, ' ') + '...');
    } catch (err) {
      console.error('Error executing:', stmt.substring(0, 50), err.message);
      throw err;
    }
  }

  console.log('All migration statements applied successfully!');
}

runMigration().catch(console.error);
