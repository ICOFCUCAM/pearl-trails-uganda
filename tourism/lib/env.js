/**
 * Server-side credential loading.
 *
 * These keys exist only inside the Node build scripts. Nothing in this module
 * is ever imported by page-rendering code that writes markup, and no key is
 * ever written into the generated HTML — the audit in scripts/validate.mjs
 * greps the built pages to prove it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_FILE = resolve(process.cwd(), '.env');

let fileEnv = null;

/** Minimal dotenv reader — no dependency, no export side effects. */
function loadEnvFile() {
  if (fileEnv) return fileEnv;
  fileEnv = {};
  let raw;
  try {
    raw = readFileSync(ENV_FILE, 'utf8');
  } catch {
    return fileEnv;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) fileEnv[key] = value;
  }
  return fileEnv;
}

function read(name) {
  const fromProcess = process.env[name];
  if (fromProcess && fromProcess.trim()) return fromProcess.trim();
  const fromFile = loadEnvFile()[name];
  return fromFile && fromFile.trim() ? fromFile.trim() : null;
}

/**
 * Provider credentials. Either may be null — the resolver degrades rather than
 * throwing, so a missing Unsplash key simply promotes Pexels, and missing both
 * leaves every record unresolved with a stated reason.
 */
export function getCredentials() {
  return {
    unsplash: read('UNSPLASH_ACCESS_KEY'),
    pexels: read('PEXELS_API_KEY'),
  };
}

/** A redacted view, safe to print in logs and reports. */
export function describeCredentials() {
  const { unsplash, pexels } = getCredentials();
  return {
    unsplash: unsplash ? `set (${unsplash.slice(0, 4)}…)` : 'missing',
    pexels: pexels ? `set (${pexels.slice(0, 4)}…)` : 'missing',
  };
}
