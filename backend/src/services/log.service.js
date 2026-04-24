import db from './db.js';

const RETENTION_DAYS = 90;

const stmtInsert = db.prepare(`
  INSERT INTO message_logs
    (timestamp, source_ip, instance_id, instance_phone, recipient_id, recipient_name, message, status, error)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export function addLog({ instanceId = null, instancePhone = null, id, recipientName = null, message, status, error, sourceIp = null }) {
  const timestamp = new Date().toISOString();
  try {
    stmtInsert.run(timestamp, sourceIp, instanceId, instancePhone, id ?? null, recipientName, message, status, error ?? null);
  } catch (err) {
    console.error('[log] Failed to write log entry:', err.message);
  }
  return { timestamp, sourceIp, instanceId, instancePhone, id, recipientName, message, status, error: error ?? null };
}

export function getLogs({ limit = 2000, from = null, to = null } = {}) {
  const conditions = [];
  const params = [];

  if (from) {
    conditions.push('timestamp >= ?');
    params.push(new Date(from).toISOString());
  }
  if (to) {
    const toDate = new Date(to);
    toDate.setUTCHours(23, 59, 59, 999);
    conditions.push('timestamp <= ?');
    params.push(toDate.toISOString());
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) as failed
    FROM message_logs ${where}
  `).get(...params);

  const logs = db.prepare(`
    SELECT timestamp, source_ip as sourceIp, instance_id as instanceId,
           instance_phone as instancePhone, recipient_id as id,
           recipient_name as recipientName, message, status, error
    FROM message_logs ${where}
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(...params, limit);

  return {
    logs,
    stats: { total: stats.total ?? 0, success: stats.success ?? 0, failed: stats.failed ?? 0 },
  };
}

export function cleanOldLogs() {
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const result = db.prepare('DELETE FROM message_logs WHERE timestamp < ?').run(cutoff);
    if (result.changes > 0) {
      console.log(`[log] Cleaned ${result.changes} entries older than ${RETENTION_DAYS} days`);
    }
  } catch (err) {
    console.error('[log] Failed to clean old logs:', err.message);
  }
}
