import fs from 'fs-extra';
import path from 'path';

const LOG_FILE = process.env.LOG_FILE
  ? path.resolve(process.env.LOG_FILE)
  : path.join(process.cwd(), 'logs', 'messages.log');

await fs.ensureDir(path.dirname(LOG_FILE));

export async function addLog({ instanceId = null, instancePhone = null, id, recipientName = null, message, status, error, sourceIp = null }) {
  const log = {
    timestamp: new Date().toISOString(),
    sourceIp,
    instanceId,
    instancePhone,
    id,
    recipientName,
    message,
    status,
    error: error ?? null,
  };
  try {
    await fs.appendFile(LOG_FILE, JSON.stringify(log) + '\n', 'utf-8');
  } catch (err) {
    console.error('[log] Failed to write log entry:', err.message);
  }
  return log;
}

export async function getLogs(limit = 100) {
  try {
    const exists = await fs.pathExists(LOG_FILE);
    if (!exists) return [];
    const content = await fs.readFile(LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const logs = lines.map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
    return logs.slice(-limit).reverse();
  } catch (err) {
    console.error('[log] Failed to read logs:', err.message);
    return [];
  }
}
