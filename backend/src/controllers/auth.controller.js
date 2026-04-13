import { verifyPassword } from '../services/user.service.js';
import { signToken } from '../middlewares/jwt.middleware.js';

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

    const user = await verifyPassword(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken({ id: user.id, username: user.username, role: user.role });

    return res.json({ token, user });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
