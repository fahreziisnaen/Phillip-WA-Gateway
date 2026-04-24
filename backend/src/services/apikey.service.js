import { randomBytes } from 'crypto';
import db from './db.js';

export function generateRawKey() {
  return 'wag_' + randomBytes(24).toString('hex');
}

export function getAllKeys() {
  return db.prepare('SELECT * FROM api_keys ORDER BY created_at').all()
    .map((k) => ({ ...k, createdAt: k.created_at, lastUsed: k.last_used }));
}

export function createKey(name) {
  const entry = {
    id: randomBytes(8).toString('hex'),
    name,
    key: generateRawKey(),
    created_at: new Date().toISOString(),
    last_used: null,
  };
  db.prepare('INSERT INTO api_keys (id, name, key, created_at, last_used) VALUES (?, ?, ?, ?, ?)')
    .run(entry.id, entry.name, entry.key, entry.created_at, entry.last_used);
  return { ...entry, createdAt: entry.created_at, lastUsed: entry.last_used };
}

export function revokeKey(id) {
  const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
  if (result.changes === 0) throw new Error('API key not found');
}

export async function isValidKey(token) {
  if (!token) return false;
  if (process.env.API_KEY && token === process.env.API_KEY) return true;

  const row = db.prepare('SELECT id FROM api_keys WHERE key = ?').get(token);
  if (row) {
    db.prepare('UPDATE api_keys SET last_used = ? WHERE id = ?').run(new Date().toISOString(), row.id);
    return true;
  }
  return false;
}

export function maskKey(key) {
  if (!key || key.length < 12) return '***';
  return key.slice(0, 8) + '••••••••' + key.slice(-4);
}
