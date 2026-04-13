import { authMiddleware } from '../middlewares/auth.middleware.js';
import { jwtMiddleware } from '../middlewares/jwt.middleware.js';

import { loginController } from '../controllers/auth.controller.js';
import { sendMessageController } from '../controllers/message.controller.js';
import { getLogsController } from '../controllers/log.controller.js';
import { getStatusController } from '../controllers/status.controller.js';
import {
  listInstancesController,
  getInstanceStatusController,
  getInstanceQRController,
  addInstanceController,
  removeInstanceController,
  resetInstanceController,
  getInstanceGroupsController,
} from '../controllers/instance.controller.js';
import {
  getUsersController,
  createUserController,
  changePasswordController,
  deleteUserController,
  getKeysController,
  createKeyController,
  revokeKeyController,
} from '../controllers/settings.controller.js';

export function registerRoutes(app) {
  // ── Public ──────────────────────────────────────────────────────────────────
  app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));
  app.post('/auth/login', loginController);

  // Legacy single-instance status/qr (returns first instance)
  app.get('/status', getStatusController);

  // ── API key protected (external systems) ────────────────────────────────────
  app.post('/send-message', authMiddleware, sendMessageController);

  // ── JWT protected (dashboard) ────────────────────────────────────────────────

  // Instances
  app.get('/instances', jwtMiddleware, listInstancesController);
  app.post('/instances', jwtMiddleware, addInstanceController);
  app.get('/instances/:id/status', jwtMiddleware, getInstanceStatusController);
  app.get('/instances/:id/qr', jwtMiddleware, getInstanceQRController);
  app.post('/instances/:id/reset', jwtMiddleware, resetInstanceController);
  app.delete('/instances/:id', jwtMiddleware, removeInstanceController);
  app.get('/instances/:id/groups', jwtMiddleware, getInstanceGroupsController);

  // Logs
  app.get('/logs', jwtMiddleware, getLogsController);

  // Users
  app.get('/admin/users', jwtMiddleware, getUsersController);
  app.post('/admin/users', jwtMiddleware, createUserController);
  app.put('/admin/users/:id/password', jwtMiddleware, changePasswordController);
  app.delete('/admin/users/:id', jwtMiddleware, deleteUserController);

  // API Keys
  app.get('/admin/apikeys', jwtMiddleware, getKeysController);
  app.post('/admin/apikeys', jwtMiddleware, createKeyController);
  app.delete('/admin/apikeys/:id', jwtMiddleware, revokeKeyController);

  // ── 404 ─────────────────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
  });
}
