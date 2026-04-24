import { listAliases, setAlias, deleteAlias } from '../services/groupAlias.service.js';

export async function listGroupAliasesController(req, res) {
  try {
    const aliases = await listAliases();
    res.json(aliases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function setGroupAliasController(req, res) {
  const { alias, jid, label } = req.body;
  if (!alias || typeof alias !== 'string' || !alias.trim()) {
    return res.status(400).json({ error: '`alias` is required' });
  }
  if (!jid || typeof jid !== 'string' || !jid.trim()) {
    return res.status(400).json({ error: '`jid` is required' });
  }
  try {
    const result = await setAlias(alias.trim(), jid.trim(), label?.trim() ?? '');
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteGroupAliasController(req, res) {
  const { alias } = req.params;
  try {
    await deleteAlias(alias);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}
