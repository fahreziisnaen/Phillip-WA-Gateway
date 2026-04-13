import { isValidKey } from '../services/apikey.service.js';
import { addLog } from '../services/log.service.js';

/**
 * API key middleware for external integrations (SolarWinds, etc).
 *
 * Accepts:
 *   Authorization: Bearer <key>   ← SolarWinds Token mode
 *   x-api-key: <key>              ← Postman / manual testing
 *
 * All authentication failures are recorded in the message log.
 */
export async function authMiddleware(req, res, next) {
  let token = null;

  // 1. Bearer token
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // 2. x-api-key fallback
  if (!token) {
    token = req.headers['x-api-key'] || null;
  }

  const sourceIp =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (!token) {
    await addLog({
      sourceIp,
      id: req.body?.id ?? null,
      message: req.body?.message ?? null,
      status: 'failed',
      error: 'Unauthorized: No API key provided',
    });
    return res.status(401).json({
      error: 'Unauthorized: Provide Authorization: Bearer <token> or x-api-key header',
    });
  }

  const valid = await isValidKey(token);
  if (!valid) {
    await addLog({
      sourceIp,
      id: req.body?.id ?? null,
      message: req.body?.message ?? null,
      status: 'failed',
      error: 'Unauthorized: Invalid API key',
    });
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }

  next();
}
