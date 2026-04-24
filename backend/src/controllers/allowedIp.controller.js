import { listAllowedIps, addAllowedIp, removeAllowedIp } from '../services/allowedIp.service.js';

export async function listAllowedIpsController(req, res) {
  try {
    const ips = await listAllowedIps();
    res.json(ips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function addAllowedIpController(req, res) {
  const { ip, label } = req.body;
  if (!ip || typeof ip !== 'string' || !ip.trim()) {
    return res.status(400).json({ error: '`ip` wajib diisi' });
  }
  try {
    const entry = await addAllowedIp(ip.trim(), label?.trim() ?? '');
    res.json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function removeAllowedIpController(req, res) {
  const { ip } = req.params;
  try {
    await removeAllowedIp(decodeURIComponent(ip));
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}
