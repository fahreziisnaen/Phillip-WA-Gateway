import { verifyPassword } from '../services/user.service.js';
import { signToken } from '../middlewares/jwt.middleware.js';
import { addAuditLog } from '../services/audit.service.js';
import { getSourceIp } from '../utils/request.utils.js';

/**
 * POST /auth/login
 * Body: { username, password }
 */
export async function loginController(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const ip = getSourceIp(req);
    const user = await verifyPassword(username, password);

    if (!user) {
      addAuditLog({ action: 'login.failure', details: { username }, ip });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    addAuditLog({ actor: user.username, actorId: user.id, action: 'login.success', ip });
    const token = signToken({ id: user.id, username: user.username, role: user.role });

    return res.json({ token, user });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
