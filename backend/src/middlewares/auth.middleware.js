import { isValidKey } from '../services/apikey.service.js';

/**
 * API key middleware for external integrations (SolarWinds, etc).
 *
 * Accepts:
 *   Authorization: Bearer <key>   ← SolarWinds Token mode
 *   x-api-key: <key>              ← Postman / manual testing
 *
 * Keys are managed via the Settings page in the admin dashboard.
 * The API_KEY env variable also works for backwards compatibility.
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

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: Provide Authorization: Bearer <token> or x-api-key header',
    });
  }

  const valid = await isValidKey(token);
  if (!valid) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }

  next();
}
