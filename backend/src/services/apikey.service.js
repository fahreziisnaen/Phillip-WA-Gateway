import fs from 'fs-extra';
import path from 'path';
import { randomBytes } from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const KEYS_FILE = path.join(DATA_DIR, 'apikeys.json');

await fs.ensureDir(DATA_DIR);

async function readKeys() {
  if (!(await fs.pathExists(KEYS_FILE))) return [];
  return fs.readJson(KEYS_FILE);
}

async function writeKeys(keys) {
  await fs.writeJson(KEYS_FILE, keys, { spaces: 2 });
}

/** Generate a prefixed random API key: wag_<48 hex chars> */
export function generateRawKey() {
  return 'wag_' + randomBytes(24).toString('hex');
}

export async function getAllKeys() {
  return readKeys();
}

/**
 * Create a new named API key.
 * Returns the full entry including the plaintext key (shown only once).
 */
export async function createKey(name) {
  const keys = await readKeys();
  const entry = {
    id: randomBytes(8).toString('hex'),
    name,
    key: generateRawKey(),
    createdAt: new Date().toISOString(),
    lastUsed: null,
  };
  keys.push(entry);
  await writeKeys(keys);
  return entry; // caller shows the key once, then it's accessible via list (masked)
}

export async function revokeKey(id) {
  const keys = await readKeys();
  const filtered = keys.filter((k) => k.id !== id);
  if (filtered.length === keys.length) throw new Error('API key not found');
  await writeKeys(filtered);
}

/**
 * Validate a Bearer token against:
 *   1. API_KEY env variable (backwards compat)
 *   2. Stored keys in data/apikeys.json
 */
export async function isValidKey(token) {
  if (!token) return false;

  // Backwards compat: env key still works
  if (process.env.API_KEY && token === process.env.API_KEY) return true;

  const keys = await readKeys();
  const found = keys.find((k) => k.key === token);
  if (found) {
    found.lastUsed = new Date().toISOString();
    await writeKeys(keys).catch(() => {}); // non-blocking, fire-and-forget
    return true;
  }

  return false;
}

/** Return a masked version of the key for display: wag_xxxx...xxxx */
export function maskKey(key) {
  if (!key || key.length < 12) return '***';
  return key.slice(0, 8) + '••••••••' + key.slice(-4);
}
