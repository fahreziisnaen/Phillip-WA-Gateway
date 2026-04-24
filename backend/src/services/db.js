import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync } from 'fs';
import fs from 'fs-extra';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(process.cwd(), 'data', 'gateway.db');

mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// WAL mode: better concurrent read performance; foreign keys on
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    username   TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    key        TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    last_used  TEXT
  );

  CREATE TABLE IF NOT EXISTS instances (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS group_aliases (
    alias      TEXT PRIMARY KEY,
    jid        TEXT NOT NULL,
    label      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS allowed_ips (
    ip         TEXT PRIMARY KEY,
    label      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS message_logs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp      TEXT NOT NULL,
    source_ip      TEXT,
    instance_id    TEXT,
    instance_phone TEXT,
    recipient_id   TEXT,
    recipient_name TEXT,
    message        TEXT,
    status         TEXT NOT NULL,
    error          TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON message_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_logs_status    ON message_logs(status);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    actor     TEXT,
    actor_id  TEXT,
    action    TEXT NOT NULL,
    details   TEXT,
    ip        TEXT
  );
`);

// ── Default admin (runs once on first start) ──────────────────────────────────

const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  db.prepare('INSERT INTO users (id, username, password, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(
      randomBytes(8).toString('hex'),
      'admin',
      bcrypt.hashSync('admin123', 10),
      'admin',
      new Date().toISOString(),
    );
  console.log('[db] Default admin created → username: admin  password: admin123');
}

// ── One-time migration from legacy JSON files ─────────────────────────────────

export async function migrateFromJsonFiles() {
  const DATA_DIR = path.join(process.cwd(), 'data');
  const LOG_FILE = process.env.LOG_FILE
    ? path.resolve(process.env.LOG_FILE)
    : path.join(process.cwd(), 'logs', 'messages.log');

  // Users
  const usersFile = path.join(DATA_DIR, 'users.json');
  if (await fs.pathExists(usersFile)) {
    const users = await fs.readJson(usersFile).catch(() => []);
    const ins = db.prepare('INSERT OR IGNORE INTO users (id, username, password, role, created_at) VALUES (?, ?, ?, ?, ?)');
    for (const u of users) ins.run(u.id, u.username, u.password, u.role ?? 'admin', u.createdAt ?? new Date().toISOString());
    await fs.rename(usersFile, usersFile + '.migrated');
    console.log(`[db] Migrated ${users.length} user(s) from JSON`);
  }

  // API Keys
  const keysFile = path.join(DATA_DIR, 'apikeys.json');
  if (await fs.pathExists(keysFile)) {
    const keys = await fs.readJson(keysFile).catch(() => []);
    const ins = db.prepare('INSERT OR IGNORE INTO api_keys (id, name, key, created_at, last_used) VALUES (?, ?, ?, ?, ?)');
    for (const k of keys) ins.run(k.id, k.name, k.key, k.createdAt ?? new Date().toISOString(), k.lastUsed ?? null);
    await fs.rename(keysFile, keysFile + '.migrated');
    console.log(`[db] Migrated ${keys.length} API key(s) from JSON`);
  }

  // Instances
  const instancesFile = path.join(DATA_DIR, 'instances.json');
  if (await fs.pathExists(instancesFile)) {
    const instances = await fs.readJson(instancesFile).catch(() => []);
    const ins = db.prepare('INSERT OR IGNORE INTO instances (id, name) VALUES (?, ?)');
    for (const i of instances) ins.run(i.id, i.name);
    await fs.rename(instancesFile, instancesFile + '.migrated');
    console.log(`[db] Migrated ${instances.length} instance(s) from JSON`);
  }

  // Group Aliases
  const aliasesFile = path.join(DATA_DIR, 'group-aliases.json');
  if (await fs.pathExists(aliasesFile)) {
    const aliases = await fs.readJson(aliasesFile).catch(() => []);
    const ins = db.prepare('INSERT OR IGNORE INTO group_aliases (alias, jid, label, created_at) VALUES (?, ?, ?, ?)');
    for (const a of aliases) ins.run(a.alias, a.jid, a.label ?? '', a.createdAt ?? new Date().toISOString());
    await fs.rename(aliasesFile, aliasesFile + '.migrated');
    console.log(`[db] Migrated ${aliases.length} group alias(es) from JSON`);
  }

  // Allowed IPs
  const ipsFile = path.join(DATA_DIR, 'allowed-ips.json');
  if (await fs.pathExists(ipsFile)) {
    const ips = await fs.readJson(ipsFile).catch(() => []);
    const ins = db.prepare('INSERT OR IGNORE INTO allowed_ips (ip, label, created_at) VALUES (?, ?, ?)');
    for (const e of ips) ins.run(e.ip, e.label ?? '', e.createdAt ?? new Date().toISOString());
    await fs.rename(ipsFile, ipsFile + '.migrated');
    console.log(`[db] Migrated ${ips.length} allowed IP(s) from JSON`);
  }

  // Message logs (JSONL)
  if (await fs.pathExists(LOG_FILE)) {
    const content = await fs.readFile(LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const ins = db.prepare(`
      INSERT INTO message_logs
        (timestamp, source_ip, instance_id, instance_phone, recipient_id, recipient_name, message, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((entries) => {
      for (const l of entries) ins.run(
        l.timestamp ?? new Date().toISOString(),
        l.sourceIp ?? null, l.instanceId ?? null, l.instancePhone ?? null,
        l.id ?? null, l.recipientName ?? null, l.message ?? null,
        l.status ?? 'unknown', l.error ?? null,
      );
    });
    const parsed = lines.map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
    insertMany(parsed);
    await fs.rename(LOG_FILE, LOG_FILE + '.migrated');
    console.log(`[db] Migrated ${parsed.length} log entry/entries from JSONL`);
  }
}

export default db;
