/**
 * API Key authentication middleware.
 *
 * Accepts key dari 2 sumber:
 *   1. Header Authorization: Bearer <key>  → SolarWinds Token mode
 *   2. Header x-api-key: <key>             → Postman / testing
 */
export function authMiddleware(req, res, next) {
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    console.warn('[auth] WARNING: API_KEY is not set. Requests are unauthenticated.');
    return next();
  }

  // 1. Bearer token (SolarWinds)
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === expectedKey) return next();
    return res.status(401).json({ error: 'Unauthorized: Invalid Bearer token' });
  }

  // 2. x-api-key (Postman / manual testing)
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    if (apiKey === expectedKey) return next();
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }

  return res.status(401).json({ error: 'Unauthorized: Provide Authorization: Bearer <token> or x-api-key header' });
}
