import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Migration Integrity Script (FT-033)
 * -----------------------------------
 * Ensures that migration files follow the NNN_name.sql naming convention,
 * that there are no gaps in the sequence, and that no duplicate numbers exist.
 * It also checks that each migration has a Ticket: FT-XXX header for traceability.
 */

console.log('--- Migration Integrity Check ---');

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations');
const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.log('✅ No migration files found.');
  process.exit(0);
}

const errors = [];

files.forEach((file, index) => {
  const match = file.match(/^(\d{3})_.*\.sql$/);

  if (!match) {
    errors.push(
      `Invalid migration filename: "${file}". Expected format: NNN_name.sql (e.g., 001_initial.sql).`
    );
    return;
  }

  const currentNumber = parseInt(match[1], 10);

  if (currentNumber !== index + 1) {
    errors.push(
      `Sequence gap detected: "${file}" has number ${currentNumber}, but should be ${index + 1} based on its position.`
    );
  }

  // Traceability check: Each migration must reference a ticket
  const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
  if (!/Ticket:\s+FT-\d{3}/.test(content)) {
    errors.push(`Traceability missing: "${file}" does not contain a "Ticket: FT-XXX" header.`);
  }
});

if (errors.length > 0) {
  console.error('❌ Migration integrity check failed!');
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log(`✅ Successfully validated ${files.length} migrations in sequence.`);
  process.exit(0);
}
