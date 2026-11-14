import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = new URL('../prisma/schema.prisma', import.meta.url);
const target = new URL('../database/fresh/schema.prisma', import.meta.url);
const lock = new URL(
  '../database/fresh/migrations/migration_lock.toml',
  import.meta.url
);
const baseline = new URL(
  '../database/fresh/migrations/00000000000000_fresh_install/migration.sql',
  import.meta.url
);

try {
  await access(lock);
  await access(baseline);

  const schema = await readFile(source, 'utf8');

  const notice =
    '// GENERATED FILE — DO NOT EDIT OR COMMIT.\n' +
    '// Source of truth: prisma/schema.prisma\n\n';

  await writeFile(target, notice + schema, 'utf8');

  console.log(`Prepared: ${fileURLToPath(target)}`);
  console.log('No database connection or migration was performed.');
} catch (error) {
  console.error('Schema preparation failed:', error.message);
  process.exitCode = 1;
}