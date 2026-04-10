import { sendMessage } from '../whatsapp.js';
import { addLog } from './log.service.js';

// ── Try to connect Redis / BullMQ ─────────────────────────────────────────────
// If Redis is not available, fall back to direct (in-process) sending with retry.

let enqueueMessage;

async function sendWithRetry(jid, message, originalId, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sendMessage(jid, message);
      await addLog({ id: originalId, message, status: 'success', error: null });
      console.log(`[queue:direct] Sent to ${jid} (attempt ${attempt})`);
      return `direct-${Date.now()}`;
    } catch (err) {
      lastErr = err;
      console.warn(`[queue:direct] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000 * attempt)); // 2s, 4s
      }
    }
  }
  await addLog({ id: originalId, message, status: 'failed', error: lastErr.message });
  throw lastErr;
}

try {
  // Dynamically import BullMQ + ioredis so failure doesn't crash the app
  const { Queue, Worker } = await import('bullmq');
  const { default: IORedis } = await import('ioredis');

  const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectTimeout: 3000,
    retryStrategy: () => null, // don't auto-retry on startup
  });

  // Test the connection before committing to BullMQ mode
  await connection.connect();
  await connection.ping();

  const messageQueue = new Queue('wa-messages', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });

  const worker = new Worker(
    'wa-messages',
    async (job) => {
      const { jid, message, originalId } = job.data;
      console.log(`[queue:bullmq] Processing job ${job.id} → ${jid}`);
      await sendMessage(jid, message);
      await addLog({ id: originalId, message, status: 'success', error: null });
    },
    { connection, concurrency: 3 }
  );

  worker.on('failed', async (job, err) => {
    console.error(`[queue:bullmq] Job ${job?.id} failed:`, err.message);
    if (job && job.attemptsMade >= (job.opts?.attempts ?? 3)) {
      await addLog({
        id: job.data.originalId,
        message: job.data.message,
        status: 'failed',
        error: err.message,
      });
    }
  });

  worker.on('error', (err) => console.error('[queue:bullmq] Worker error:', err.message));

  console.log('[queue] BullMQ + Redis mode active');

  enqueueMessage = async (jid, message, originalId) => {
    const job = await messageQueue.add('send', { jid, message, originalId });
    console.log(`[queue:bullmq] Enqueued job ${job.id} for ${jid}`);
    return job.id;
  };

} catch (err) {
  console.warn(`[queue] Redis not available (${err.message}) — using direct send mode`);

  enqueueMessage = async (jid, message, originalId) => {
    // Fire-and-forget with retry, don't block the HTTP response
    setImmediate(() => sendWithRetry(jid, message, originalId).catch(() => {}));
    return `direct-${Date.now()}`;
  };
}

export { enqueueMessage };
