import { normalizeId } from '../utils/idNormalizer.js';
import { validateNumber, getFirstConnectedInstance, getInstance, getRecipientName } from '../services/waManager.js';
import { enqueueMessage } from '../services/queue.service.js';

/**
 * POST /send-message
 * Body: { id, message, from? }
 *
 * `from` = instance ID (e.g. "wa1"). If omitted, uses the first connected instance.
 */
export async function sendMessageController(req, res) {
  try {
    const { message, id, from } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: '`message` is required and must be a non-empty string' });
    }
    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({ error: '`id` is required and must be a non-empty string' });
    }

    // Resolve which WhatsApp instance to use
    let instance;
    if (from) {
      instance = getInstance(from.trim());
      if (!instance) {
        return res.status(404).json({ error: `Instance "${from}" not found` });
      }
      if (instance.status !== 'connected') {
        return res.status(503).json({
          error: `Instance "${from}" is not connected (status: ${instance.status})`,
        });
      }
    } else {
      instance = getFirstConnectedInstance();
      if (!instance) {
        return res.status(503).json({ error: 'No WhatsApp instance is connected' });
      }
    }

    // Normalize destination ID
    let normalised;
    try {
      normalised = normalizeId(id.trim());
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const { jid, isGroup } = normalised;

    // Validate personal numbers
    if (!isGroup) {
      let exists;
      try {
        exists = await validateNumber(instance.id, jid);
      } catch (err) {
        return res.status(503).json({ error: err.message });
      }
      if (!exists) {
        return res.status(422).json({
          error: `The number ${jid} is not registered on WhatsApp`,
        });
      }
    }

    // Capture source IP (respects X-Forwarded-For from reverse proxies)
    const sourceIp =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    // Resolve recipient display name (group subject or contact name from phone book)
    const recipientName = await getRecipientName(instance.id, jid, isGroup);

    const jobId = await enqueueMessage(instance.id, instance.phone, jid, recipientName, message.trim(), id.trim(), sourceIp);

    return res.status(202).json({
      success: true,
      jobId,
      message: 'Message queued successfully',
      destination: jid,
      type: isGroup ? 'group' : 'personal',
      sentFrom: instance.id,
      sentFromName: instance.name,
    });
  } catch (err) {
    console.error('[sendMessage]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
