import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'wa-gateway-default-secret-change-me';

if (!process.env.JWT_SECRET) {
  console.warn('[jwt] WARNING: JWT_SECRET is not set. Using default secret — set it in .env before deploying.');
}

/**
 * Protect dashboard admin routes with JWT.
 * Token is issued by POST /auth/login.
 *
 * Reads from: Authorization: Bearer <jwt>
 */
export function jwtMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Dashboard login required' });
  }

  const token = authHeader.slice(7).trim();

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Invalid token';
    return res.status(401).json({ error: `Unauthorized: ${message}` });
  }
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}
