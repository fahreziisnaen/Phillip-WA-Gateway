import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

import { initManager } from './services/waManager.js';
import { registerRoutes } from './routes/index.js';
import { rateLimitMiddleware } from './middlewares/rateLimit.middleware.js';
import { cleanOldLogs } from './services/log.service.js';

const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  console.log(`[ws] Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`[ws] Client disconnected: ${socket.id}`));
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(rateLimitMiddleware);
app.set('io', io);

registerRoutes(app);

const PORT = parseInt(process.env.PORT || '3000', 10);

httpServer.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
  initManager(io).catch((err) => {
    console.error('[server] Failed to init WhatsApp manager:', err);
  });

  // Clean logs older than 90 days on startup, then once every 24 hours
  cleanOldLogs();
  setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);
});
