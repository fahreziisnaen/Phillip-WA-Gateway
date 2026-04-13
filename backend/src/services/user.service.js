import fs from 'fs-extra';
import path from 'path';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

await fs.ensureDir(DATA_DIR);

async function readUsers() {
  if (!(await fs.pathExists(USERS_FILE))) return [];
  return fs.readJson(USERS_FILE);
}

async function writeUsers(users) {
  await fs.writeJson(USERS_FILE, users, { spaces: 2 });
}

// Create default admin on first run
async function ensureDefaultAdmin() {
  const users = await readUsers();
  if (users.length === 0) {
    const hashed = await bcrypt.hash('admin123', 10);
    await writeUsers([
      {
        id: randomBytes(8).toString('hex'),
        username: 'admin',
        password: hashed,
        role: 'admin',
        createdAt: new Date().toISOString(),
      },
    ]);
    console.log('[users] Default admin created → username: admin  password: admin123');
  }
}

await ensureDefaultAdmin();

function safe(user) {
  const { password, ...rest } = user;
  return rest;
}

export async function getAllUsers() {
  const users = await readUsers();
  return users.map(safe);
}

export async function findByUsername(username) {
  const users = await readUsers();
  return users.find((u) => u.username === username) ?? null;
}

export async function verifyPassword(username, password) {
  const user = await findByUsername(username);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password);
  return valid ? safe(user) : null;
}

export async function createUser(username, password) {
  const users = await readUsers();
  if (users.find((u) => u.username === username)) {
    throw new Error(`Username "${username}" already exists`);
  }
  const user = {
    id: randomBytes(8).toString('hex'),
    username,
    password: await bcrypt.hash(password, 10),
    role: 'admin',
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeUsers(users);
  return safe(user);
}

export async function changePassword(id, newPassword) {
  const users = await readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error('User not found');
  users[idx].password = await bcrypt.hash(newPassword, 10);
  await writeUsers(users);
}

export async function deleteUser(id) {
  const users = await readUsers();
  if (users.length <= 1) throw new Error('Cannot delete the last user');
  const filtered = users.filter((u) => u.id !== id);
  if (filtered.length === users.length) throw new Error('User not found');
  await writeUsers(filtered);
}
