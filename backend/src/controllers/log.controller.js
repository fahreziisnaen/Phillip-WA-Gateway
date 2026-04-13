import { getLogs } from '../services/log.service.js';

/**
 * GET /logs?limit=2000&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function getLogsController(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 2000, 5000);
    const from  = req.query.from  || null;
    const to    = req.query.to    || null;
    const result = await getLogs({ limit, from, to });
    return res.json(result);
  } catch (err) {
    console.error('[getLogs]', err);
    return res.status(500).json({ error: 'Failed to retrieve logs' });
  }
}
