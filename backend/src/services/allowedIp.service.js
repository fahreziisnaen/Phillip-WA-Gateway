import fs from 'fs-extra';
import path from 'path';

const IPS_FILE = path.join(process.cwd(), 'data', 'allowed-ips.json');

async function read() {
  await fs.ensureDir(path.dirname(IPS_FILE));
  if (!(await fs.pathExists(IPS_FILE))) return [];
  return fs.readJson(IPS_FILE);
}

async function write(entries) {
  await fs.writeJson(IPS_FILE, entries, { spaces: 2 });
}

export async function listAllowedIps() {
  return read();
}

/**
 * Check if an IP is in the whitelist.
 * Supports exact match, CIDR notation (e.g. 192.168.1.0/24),
 * and wildcard (e.g. 10.0.0.*).
 */
export async function isIpAllowed(ip) {
  const entries = await read();
  if (entries.length === 0) return false;

  // Normalize IPv6-mapped IPv4 (::ffff:192.168.1.1 → 192.168.1.1)
  const normalizedIp = ip.replace(/^::ffff:/, '');

  for (const entry of entries) {
    const pattern = entry.ip.replace(/^::ffff:/, '');

    // Exact match
    if (normalizedIp === pattern) return true;

    // Wildcard match (e.g. 192.168.1.*)
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '\\d+') + '$');
      if (regex.test(normalizedIp)) return true;
    }

    // CIDR match (e.g. 192.168.1.0/24)
    if (pattern.includes('/')) {
      if (matchCIDR(normalizedIp, pattern)) return true;
    }
  }

  return false;
}

function matchCIDR(ip, cidr) {
  try {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    if (isNaN(bits) || bits < 0 || bits > 32) return false;

    const ipNum = ipToInt(ip);
    const rangeNum = ipToInt(range);
    if (ipNum === null || rangeNum === null) return false;

    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

function ipToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const p of parts) {
    const n = parseInt(p, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    num = (num << 8) + n;
  }
  return num >>> 0;
}

/**
 * Add an allowed IP/CIDR/wildcard.
 * @param {string} ip     IP address, CIDR, or wildcard pattern
 * @param {string} label  Human-readable label (e.g. "PRTG Server")
 */
export async function addAllowedIp(ip, label = '') {
  if (!ip || typeof ip !== 'string' || !ip.trim()) {
    throw new Error('IP address wajib diisi');
  }

  const all = await read();
  const normalized = ip.trim();

  // Check duplicate
  if (all.some((e) => e.ip === normalized)) {
    throw new Error(`IP "${normalized}" sudah ada di whitelist`);
  }

  const entry = {
    ip: normalized,
    label: label?.trim() || '',
    createdAt: new Date().toISOString(),
  };
  all.push(entry);
  await write(all);
  return entry;
}

export async function removeAllowedIp(ip) {
  const all = await read();
  const normalized = ip.trim();
  const filtered = all.filter((e) => e.ip !== normalized);
  if (filtered.length === all.length) {
    throw new Error(`IP "${normalized}" tidak ditemukan di whitelist`);
  }
  await write(filtered);
}
