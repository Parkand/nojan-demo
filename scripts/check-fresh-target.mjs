import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));

// Existing process environment takes precedence over the local .env.
dotenv.config({ path: envPath, quiet: true, override: false });

function fail(message) {
  console.error(`BLOCKED: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const mode = args[0];

if (args.length !== 1 || !['test', 'production'].includes(mode)) {
  fail('Use exactly one mode: test or production.');
}

const raw = process.env.DATABASE_URL;
if (!raw) {
  fail('DATABASE_URL is missing.');
}

let target;
let database;

try {
  target = new URL(raw);
  database = decodeURIComponent(target.pathname.slice(1));
} catch {
  fail('DATABASE_URL cannot be parsed. Its value will not be printed.');
}

if (target.protocol !== 'mysql:') {
  fail('Only mysql connections are allowed.');
}

if (!target.hostname || target.hash) {
  fail('Invalid connection target.');
}

const expected =
  mode === 'test' ? 'nozhan_migration_test' : 'nozhan_prod';

if (database !== expected) {
  fail(`Database name must be exactly ${expected}.`);
}

if (mode === 'test') {
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

  if (!localHosts.has(target.hostname)) {
    fail('Test mode requires a local host.');
  }
}

console.log(`Target name check passed: ${expected}`);
console.log(`Mode: ${mode}`);
console.log('No database connection or migration was performed.');

if (mode === 'production') {
  console.log(
    'Production host identity and deployment approval are still required.'
  );
}
