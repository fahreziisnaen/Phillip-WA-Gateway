import fs from 'fs-extra';
import path from 'path';

const ALIASES_FILE = path.join(process.cwd(), 'data', 'group-aliases.json');

async function read() {
  await fs.ensureDir(path.dirname(ALIASES_FILE));
  if (!(await fs.pathExists(ALIASES_FILE))) return [];
  return fs.readJson(ALIASES_FILE);
}

async function write(aliases) {
  await fs.writeJson(ALIASES_FILE, aliases, { spaces: 2 });
}

export async function listAliases() {
  return read();
}

/** Resolve alias name → JID, or null if not found. Case-insensitive. */
export async function resolveAlias(alias) {
  const all = await read();
  const found = all.find((a) => a.alias.toLowerCase() === alias.toLowerCase());
  return found?.jid ?? null;
}

/**
 * Create or update a group alias.
 * @param {string} alias   Short name (alphanumeric, _ -)
 * @param {string} jid     Group JID ending in @g.us
 * @param {string} label   Optional human-readable label
 */
export async function setAlias(alias, jid, label = '') {
  if (!/^[a-z0-9_-]+$/i.test(alias)) {
    throw new Error('Alias hanya boleh huruf, angka, underscore, dan tanda hubung');
  }
  if (!jid.endsWith('@g.us')) {
    throw new Error('JID harus berupa group JID yang diakhiri dengan @g.us');
  }

  const all = await read();
  const key = alias.toLowerCase();
  const idx = all.findIndex((a) => a.alias.toLowerCase() === key);

  if (idx >= 0) {
    all[idx] = { ...all[idx], alias: alias.toLowerCase(), jid, label: label || '' };
  } else {
    all.push({
      alias: alias.toLowerCase(),
      jid,
      label: label || '',
      createdAt: new Date().toISOString(),
    });
  }

  await write(all);
  return all[idx >= 0 ? idx : all.length - 1];
}

export async function deleteAlias(alias) {
  const all = await read();
  const key = alias.toLowerCase();
  const filtered = all.filter((a) => a.alias.toLowerCase() !== key);
  if (filtered.length === all.length) throw new Error(`Alias "${alias}" tidak ditemukan`);
  await write(filtered);
}
