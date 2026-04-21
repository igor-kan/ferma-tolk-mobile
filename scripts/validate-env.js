import { validateServerEnv } from '../api/_config.js';

/**
 * CI/CD Environment Validation Script (FT-033)
 * -------------------------------------------
 * Validates that all required server-side environment variables are present.
 * Fails the process if any are missing, ensuring that misconfigured deployments
 * are caught early in the pipeline.
 */

console.log('--- CI/CD Environment Validation ---');

const result = validateServerEnv('all');

if (result.ok) {
  console.log('✅ All required environment variables are present.');
  process.exit(0);
} else {
  console.error('❌ Environment validation failed!');
  console.error(result.message);
  process.exit(1);
}
