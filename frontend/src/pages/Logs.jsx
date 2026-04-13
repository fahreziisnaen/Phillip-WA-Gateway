import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Smartphone,
  Globe,
  Users,
  Phone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { fetchLogs } from '../services/api.js';

const LIMITS = [50, 100, 200, 500];
const AUTO_REFRESH_MS = 15_000;

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(100);
  const [expanded, setExpanded] = useState(null); // expanded log index

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLogs(limit);
      setLogs(res.data);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to load logs.');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => {
    const timer = setInterval(loadLogs, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadLogs]);

  const successCount = logs.filter((l) => l.status === 'success').length;
  const failCount = logs.filter((l) => l.status === 'failed').length;
  const successRate = logs.length > 0 ? Math.round((successCount / logs.length) * 100) : 0;

  function fmt(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Message Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Auto-refreshes every 15 seconds</p>
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<BarChart3 className="w-4 h-4 text-gray-400" />} label="Total" value={logs.length} color="text-gray-900" />
        <StatCard icon={<CheckCircle2 className="w-4 h-4 text-green-500" />} label="Success" value={successCount} color="text-green-600" />
        <StatCard icon={<XCircle className="w-4 h-4 text-red-500" />} label="Failed" value={failCount} color="text-red-600" />
        <StatCard icon={<BarChart3 className="w-4 h-4 text-blue-500" />} label="Success Rate" value={`${successRate}%`} color="text-blue-600" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Log list */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && !logs.length && (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading logs…
          </div>
        )}

        {!loading && !logs.length && !error && (
          <div className="text-center py-14">
            <ScrollText className="w-12 h-12 mx-auto text-gray-200 mb-3" />
            <p className="text-gray-500 text-sm font-medium">No logs yet</p>
            <p className="text-gray-400 text-xs mt-1">Logs appear here after messages are sent via the API.</p>
          </div>
        )}

        {logs.length > 0 && (
          <ul className="divide-y divide-gray-50">
            {logs.map((log, idx) => {
              const isExpanded = expanded === idx;
              const isGroup = log.id?.endsWith('@g.us');
              const isPersonal = log.id?.endsWith('@s.whatsapp.net') || log.id?.endsWith('@c.us');
              const number = isPersonal
                ? log.id.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '')
                : null;

              return (
                <li key={idx}>
                  {/* ── Main row ── */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : idx)}
                    className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Status dot */}
                      <div className="flex-shrink-0 mt-0.5">
                        {log.status === 'success'
                          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                          : <XCircle className="w-4 h-4 text-red-500" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Row 1 — timestamp · source IP · instance */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                            <Clock className="w-3 h-3" />
                            {fmt(log.timestamp)}
                          </span>
                          {log.sourceIp && (
                            <span className="flex items-center gap-1 text-xs text-gray-400 font-mono whitespace-nowrap">
                              <Globe className="w-3 h-3" />
                              {log.sourceIp}
                            </span>
                          )}
                          {log.instanceId && (
                            <span className="flex items-center gap-1 text-xs whitespace-nowrap">
                              <Smartphone className="w-3 h-3 text-gray-400" />
                              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 text-xs">
                                {log.instanceId}
                              </code>
                              {log.instancePhone && (
                                <span className="text-gray-400 font-mono text-xs">+{log.instancePhone}</span>
                              )}
                            </span>
                          )}
                        </div>

                        {/* Row 2 — recipient + message preview */}
                        <div className="flex items-start gap-4 flex-wrap">
                          {/* Recipient */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isGroup
                              ? <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              : <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-gray-800">
                                {log.recipientName ?? (isGroup ? '—' : `+${number}`)}
                              </span>
                              {isGroup && (
                                <span className="ml-1.5 text-xs text-gray-400 font-mono truncate max-w-[160px] inline-block align-bottom" title={log.id}>
                                  {log.id}
                                </span>
                              )}
                              {isPersonal && log.recipientName && (
                                <span className="ml-1.5 text-xs text-gray-400 font-mono">+{number}</span>
                              )}
                            </div>
                          </div>

                          {/* Message preview */}
                          <p className="text-xs text-gray-500 truncate max-w-[300px]" title={log.message}>
                            {log.message || '—'}
                          </p>
                        </div>

                        {/* Error (inline, only if failed) */}
                        {log.status === 'failed' && log.error && (
                          <p className="text-xs text-red-500 bg-red-50 rounded px-2 py-1 inline-block">
                            {log.error}
                          </p>
                        )}
                      </div>

                      {/* Expand chevron */}
                      <div className="flex-shrink-0 text-gray-300 mt-0.5">
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4" />
                          : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  {/* ── Expanded detail ── */}
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                        <Detail label="Timestamp" value={fmt(log.timestamp)} />
                        <Detail label="Status">
                          {log.status === 'success'
                            ? <span className="text-xs font-medium text-green-700">Success</span>
                            : <span className="text-xs font-medium text-red-700">Failed</span>}
                        </Detail>
                        <Detail label="Source IP" value={log.sourceIp || '—'} mono />
                        <Detail label="Instance">
                          {log.instanceId
                            ? <span className="text-xs font-mono">{log.instanceId}{log.instancePhone ? ` (+${log.instancePhone})` : ''}</span>
                            : '—'}
                        </Detail>
                        <Detail label="Recipient">
                          <span className="text-xs">
                            {log.recipientName && <span className="font-semibold block">{log.recipientName}</span>}
                            <span className="font-mono text-gray-400">{log.id}</span>
                          </span>
                        </Detail>
                        {log.status === 'failed' && (
                          <Detail label="Error">
                            <span className="text-xs text-red-600 break-words">{log.error || '—'}</span>
                          </Detail>
                        )}
                      </div>
                      {/* Full message */}
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Message</p>
                        <pre className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-3 whitespace-pre-wrap break-words font-sans">
                          {log.message || '—'}
                        </pre>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Limit selector */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>Show:</span>
        {LIMITS.map((n) => (
          <button
            key={n}
            onClick={() => setLimit(n)}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              limit === n ? 'bg-wa-green text-white shadow-sm' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
          >
            {n}
          </button>
        ))}
        <span>entries</span>
      </div>
    </div>
  );
}

function Detail({ label, value, mono = false, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      {children ?? (
        <p className={`text-xs text-gray-700 ${mono ? 'font-mono' : ''}`}>{value}</p>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
