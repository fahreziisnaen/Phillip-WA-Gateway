import fs from 'fs-extra';
import path from 'path';

const LOG_FILE = process.env.LOG_FILE
  ? path.resolve(process.env.LOG_FILE)
  : path.join(process.cwd(), 'logs', 'messages.log');

const RETENTION_DAYS = 90; // 3 months

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

/**
 * Read logs with optional date range filter.
 *
 * @param {object} opts
 * @param {number} opts.limit  Max entries to return (applied after date filter, newest first)
 * @param {string|null} opts.from  ISO date string or YYYY-MM-DD — inclusive start
 * @param {string|null} opts.to    ISO date string or YYYY-MM-DD — inclusive end (full day)
 * @returns {{ logs: object[], stats: { total: number, success: number, failed: number } }}
 */
export async function getLogs({ limit = 2000, from = null, to = null } = {}) {
  try {
    const exists = await fs.pathExists(LOG_FILE);
    if (!exists) return { logs: [], stats: { total: 0, success: 0, failed: 0 } };

    const content = await fs.readFile(LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    let all = lines
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);

    // Apply date range filter
    if (from) {
      const fromTs = new Date(from).getTime();
      all = all.filter((l) => l.timestamp && new Date(l.timestamp).getTime() >= fromTs);
    }
    if (to) {
      // Include the entire `to` day (up to 23:59:59.999 UTC)
      const toDate = new Date(to);
      toDate.setUTCHours(23, 59, 59, 999);
      const toTs = toDate.getTime();
      all = all.filter((l) => l.timestamp && new Date(l.timestamp).getTime() <= toTs);
    }

    // Compute stats for the full filtered set (before limit)
    const stats = {
      total:   all.length,
      success: all.filter((l) => l.status === 'success').length,
      failed:  all.filter((l) => l.status === 'failed').length,
    };

    // Return last `limit` entries, newest first
    const logs = all.slice(-limit).reverse();

    return { logs, stats };
  } catch (err) {
    console.error('[log] Failed to read logs:', err.message);
    return { logs: [], stats: { total: 0, success: 0, failed: 0 } };
  }
}

/**
 * Remove log entries older than RETENTION_DAYS.
 * Called on server startup and once per day.
 */
export async function cleanOldLogs() {
  try {
    const exists = await fs.pathExists(LOG_FILE);
    if (!exists) return;

    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const content = await fs.readFile(LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    const kept = lines.filter((line) => {
      try {
        const { timestamp } = JSON.parse(line);
        return timestamp && new Date(timestamp).getTime() >= cutoff;
      } catch {
        return false; // drop malformed lines
      }
    });

    if (kept.length < lines.length) {
      const removed = lines.length - kept.length;
      await fs.writeFile(LOG_FILE, kept.length ? kept.join('\n') + '\n' : '', 'utf-8');
      console.log(`[log] Cleaned ${removed} entries older than ${RETENTION_DAYS} days (${kept.length} kept)`);
    }
  } catch (err) {
    console.error('[log] Failed to clean old logs:', err.message);
  }
}
