import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wifi, WifiOff, Loader2, Phone, User, Smartphone, ArrowRight, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import StatusBadge from '../components/StatusBadge.jsx';

export default function Dashboard({ instances = [] }) {
  const connectedCount = instances.filter((i) => i.status === 'connected').length;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Instances" value={instances.length} color="text-gray-900" />
        <StatCard label="Connected" value={connectedCount} color="text-green-600" />
        <StatCard
          label="Offline"
          value={instances.length - connectedCount}
          color={instances.length - connectedCount > 0 ? 'text-red-500' : 'text-gray-400'}
        />
      </div>

      {/* Instance cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">WhatsApp Instances</h2>
          <Link
            to="/instances"
            className="text-xs text-wa-teal hover:underline flex items-center gap-1"
          >
            Manage <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {instances.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <Smartphone className="w-10 h-10 mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">No instances yet.</p>
            <Link
              to="/instances"
              className="inline-block mt-2 text-sm font-medium text-wa-teal hover:underline"
            >
              Add your first WhatsApp →
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {instances.map((inst) => (
            <div
              key={inst.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <div
                className={`px-5 py-3 flex items-center gap-3 border-b border-gray-100 ${
                  inst.status === 'connected' ? 'bg-green-50'
                  : inst.status === 'connecting' ? 'bg-yellow-50'
                  : 'bg-gray-50'
                }`}
              >
                {inst.status === 'connected'
                  ? <Wifi className="w-4 h-4 text-green-600" />
                  : inst.status === 'connecting'
                  ? <Loader2 className="w-4 h-4 text-yellow-600 animate-spin" />
                  : <WifiOff className="w-4 h-4 text-gray-400" />}
                <span className="font-medium text-gray-800 text-sm">{inst.name}</span>
                <code className="text-xs text-gray-400 bg-white/60 px-1.5 py-0.5 rounded ml-1">
                  {inst.id}
                </code>
                <div className="ml-auto">
                  <StatusBadge status={inst.status} />
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                <Row
                  icon={<Phone className="w-3.5 h-3.5 text-gray-400" />}
                  label="Phone"
                  value={inst.phone ? `+${inst.phone}` : '—'}
                  mono
                />
                <Row
                  icon={<User className="w-3.5 h-3.5 text-gray-400" />}
                  label="Name"
                  value={inst.waName ?? '—'}
                />
              </div>
              {inst.status !== 'connected' && (
                <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100">
                  <Link
                    to="/instances"
                    className="text-xs text-wa-teal hover:underline"
                  >
                    → Scan QR to connect
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* API Docs */}
      <ApiDocs instances={instances} />
    </div>
  );
}

function ApiDocs({ instances = [] }) {
  const [format, setFormat] = useState('json');
  const [expanded, setExpanded] = useState(true);
  const exampleInstance = instances.find((i) => i.status === 'connected')?.id ?? 'wa1';

  // ── Contoh kirim ke nomor personal ──
  const jsonExample = `{
  "id": "628123456789",
  "message": "Hello World!",
  "from": "${exampleInstance}"
}`;

  const formExample = `id=628123456789&message=Hello%20World!&from=${exampleInstance}`;

  // ── Contoh kirim ke group via alias ──
  const jsonAliasExample = `{
  "id": "alert-it",
  "message": "Server down!",
  "from": "${exampleInstance}"
}`;

  const formAliasExample = `id=alert-it&message=Server%20down!&from=${exampleInstance}`;

  const curlJson = `curl -X POST https://yourdomain.com/send-message \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '${jsonExample}'`;

  const curlForm = `curl -X POST https://yourdomain.com/send-message \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -H "x-api-key: YOUR_API_KEY" \\
  --data-urlencode "id=628123456789" \\
  --data-urlencode "message=Hello World!" \\
  --data-urlencode "from=${exampleInstance}"`;

  const jsJson = `fetch('/send-message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY',
  },
  body: JSON.stringify({
    id: '628123456789',
    message: 'Hello World!',
    from: '${exampleInstance}',
  }),
});`;

  const jsForm = `fetch('/send-message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'x-api-key': 'YOUR_API_KEY',
  },
  body: new URLSearchParams({
    id: '628123456789',
    message: 'Hello World!',
    from: '${exampleInstance}',
  }),
});`;

  const phpJson = `$ch = curl_init('https://yourdomain.com/send-message');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Content-Type: application/json',
  'x-api-key: YOUR_API_KEY',
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
  'id'      => '628123456789',
  'message' => 'Hello World!',
  'from'    => '${exampleInstance}',
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);`;

  const phpForm = `$ch = curl_init('https://yourdomain.com/send-message');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'x-api-key: YOUR_API_KEY',
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
  'id'      => '628123456789',
  'message' => 'Hello World!',
  'from'    => '${exampleInstance}',
]));
// Content-Type: application/x-www-form-urlencoded
// dikirim otomatis oleh cURL saat POSTFIELDS berupa string
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);`;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">API Reference</span>
          <span className="text-[10px] font-mono bg-wa-green/10 text-wa-teal px-2 py-0.5 rounded-full">
            POST /send-message
          </span>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* Auth info */}
          <div className="px-5 py-4 bg-amber-50 border-b border-amber-100">
            <p className="text-xs font-semibold text-amber-800 mb-2">Authentication</p>
            <p className="text-xs text-amber-700 mb-3">
              Gunakan salah satu metode berikut (diproses berurutan):
            </p>
            <div className="space-y-2.5">
              {/* Method 1 - IP Whitelist */}
              <div className="bg-white/70 rounded-lg px-3 py-2 border border-amber-200/60">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded">1</span>
                  <span className="text-xs font-semibold text-amber-900">IP Whitelist</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">tanpa API key</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Jika IP pengirim sudah di-whitelist, request langsung diizinkan tanpa API key.
                  Ideal untuk <strong>PRTG</strong>, Zabbix, atau sistem yang tidak bisa set custom header.
                </p>
              </div>
              {/* Methods 2-3 - Headers */}
              <div className="bg-white/70 rounded-lg px-3 py-2 border border-amber-200/60">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded">2–3</span>
                  <span className="text-xs font-semibold text-amber-900">HTTP Header</span>
                </div>
                <div className="space-y-1">
                  <CodeLine label="Bearer" code="Authorization: Bearer YOUR_API_KEY" />
                  <CodeLine label="API Key" code="x-api-key: YOUR_API_KEY" />
                </div>
              </div>
              {/* Method 4 - Body field */}
              <div className="bg-white/70 rounded-lg px-3 py-2 border border-amber-200/60">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded">4</span>
                  <span className="text-xs font-semibold text-amber-900">Body Field</span>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">form-urlencoded</span>
                </div>
                <p className="text-[11px] text-amber-700 mb-1">
                  Tambahkan field <code className="bg-amber-100 px-1 rounded font-mono">apikey</code> di body request:
                </p>
                <CodeLine label="Body" code="apikey=YOUR_API_KEY&id=628...&message=Hello" />
              </div>
              {/* Method 5 - Query param */}
              <div className="bg-white/70 rounded-lg px-3 py-2 border border-amber-200/60">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded">5</span>
                  <span className="text-xs font-semibold text-amber-900">Query Parameter</span>
                </div>
                <CodeLine label="URL" code="POST /send-message?apikey=YOUR_API_KEY" />
              </div>
            </div>
            <p className="text-xs text-amber-600 mt-3">
              API key dikelola di <Link to="/settings" className="underline font-medium">Settings → API Keys</Link>.
              IP whitelist di <Link to="/settings" className="underline font-medium">Settings → Allowed IPs</Link>.
            </p>
          </div>

          {/* Fields */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-700 mb-3">Body Fields</p>
            <div className="space-y-2">
              <FieldRow name="id" type="string" required desc='Nomor WhatsApp (e.g. "628123456789"), Group JID (e.g. "120363...@g.us"), atau Group Alias (e.g. "alert-it"). Alias dibuat di Settings → Group Aliases.' />
              <FieldRow name="message" type="string" required desc="Isi pesan yang akan dikirim." />
              <FieldRow name="from" type="string" required={false} desc={`Instance ID yang digunakan untuk mengirim. Jika kosong, pakai instance pertama yang connected.`} />
              <FieldRow name="apikey" type="string" required={false} desc='API key (alternatif jika tidak bisa set header). Bisa juga dikirim via query param ?apikey=xxx. Tidak perlu jika IP sudah di-whitelist.' />
            </div>
          </div>

          {/* Group Alias info */}
          <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100">
            <p className="text-xs font-semibold text-emerald-800 mb-1 flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 bg-emerald-200 rounded text-center leading-4 text-emerald-700 text-[10px] font-bold">#</span>
              Group Alias
            </p>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Daripada menggunakan Group JID yang panjang, Anda bisa membuat <strong>alias pendek</strong> untuk setiap grup.
              Cukup gunakan nama alias (misalnya <code className="bg-emerald-100 px-1 rounded font-mono">alert-it</code>) sebagai
              nilai field <code className="bg-emerald-100 px-1 rounded font-mono">id</code>. Server akan otomatis me-resolve alias
              ke Group JID yang sesuai.
            </p>
            <p className="text-xs text-emerald-600 mt-1.5">
              Kelola alias di <Link to="/settings" className="underline font-medium">Settings → Group Aliases</Link> atau
              langsung dari halaman <Link to="/groups" className="underline font-medium">Groups</Link> (tombol Set Alias).
            </p>
          </div>

          {/* Format tabs */}
          <div className="px-5 pt-4 pb-2 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-700">Contoh Request</p>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                <button
                  onClick={() => setFormat('json')}
                  className={`px-3 py-1.5 transition-colors ${
                    format === 'json'
                      ? 'bg-wa-teal text-white'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  JSON
                </button>
                <button
                  onClick={() => setFormat('form')}
                  className={`px-3 py-1.5 transition-colors border-l border-gray-200 ${
                    format === 'form'
                      ? 'bg-wa-teal text-white'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Form URL Encoded
                </button>
              </div>
            </div>

            {/* Format explanation */}
            {format === 'json' ? (
              <div className="mb-3 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                Set header <code className="bg-blue-100 px-1 rounded font-mono">Content-Type: application/json</code> dan kirim body sebagai objek JSON.
              </div>
            ) : (
              <div className="mb-3 text-xs text-gray-500 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                Set header <code className="bg-purple-100 px-1 rounded font-mono">Content-Type: application/x-www-form-urlencoded</code> dan kirim body sebagai key=value yang di-encode (sama seperti form HTML biasa).
              </div>
            )}

            {/* Raw body preview — personal number */}
            <p className="text-[11px] text-gray-400 font-medium mb-1">Raw Body — Kirim ke Nomor</p>
            <CodeBlock code={format === 'json' ? jsonExample : formExample} />

            {/* Raw body preview — group alias */}
            <p className="text-[11px] text-emerald-500 font-medium mt-3 mb-1">Raw Body — Kirim ke Group (via Alias)</p>
            <CodeBlock code={format === 'json' ? jsonAliasExample : formAliasExample} />

            {/* cURL */}
            <p className="text-[11px] text-gray-400 font-medium mt-3 mb-1">cURL</p>
            <CodeBlock code={format === 'json' ? curlJson : curlForm} />

            {/* JavaScript */}
            <p className="text-[11px] text-gray-400 font-medium mt-3 mb-1">JavaScript (fetch)</p>
            <CodeBlock code={format === 'json' ? jsJson : jsForm} />

            {/* PHP */}
            <p className="text-[11px] text-gray-400 font-medium mt-3 mb-1">PHP (cURL)</p>
            <CodeBlock code={format === 'json' ? phpJson : phpForm} />

            {/* PRTG example */}
            {format === 'form' && (
              <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5">
                <p className="text-[11px] font-semibold text-orange-800 mb-1">💡 Contoh untuk PRTG HTTP Push / Notification</p>
                <p className="text-[11px] text-orange-700 mb-2 leading-relaxed">
                  PRTG tidak bisa set custom header. Gunakan salah satu cara:
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-orange-600 font-medium mb-0.5">Opsi A: IP Whitelist (tanpa API key)</p>
                    <CodeBlock code={`id=alert-it&message=[%sitename] %device %sensor %status`} />
                  </div>
                  <div>
                    <p className="text-[10px] text-orange-600 font-medium mb-0.5">Opsi B: API key di body</p>
                    <CodeBlock code={`apikey=YOUR_API_KEY&id=alert-it&message=[%sitename] %device %sensor %status`} />
                  </div>
                  <div>
                    <p className="text-[10px] text-orange-600 font-medium mb-0.5">Opsi C: API key di URL query</p>
                    <CodeBlock code={`URL: https://yourdomain.com/send-message?apikey=YOUR_API_KEY
Body: id=alert-it&message=[%sitename] %device %sensor %status`} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Response */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">Contoh Response</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-green-600 font-medium mb-1">202 Accepted</p>
                <CodeBlock code={`{
  "success": true,
  "jobId": "42",
  "message": "Message queued",
  "destination": "6281234@s.whatsapp.net",
  "type": "personal",
  "sentFrom": "${exampleInstance}"
}`} />
              </div>
              <div>
                <p className="text-[11px] text-red-500 font-medium mb-1">4xx Error</p>
                <CodeBlock code={`{
  "error": "\`id\` is required and must
be a non-empty string"
}`} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 rounded-lg px-3 py-2.5 text-[11px] overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
        title="Copy"
      >
        {copied
          ? <Check className="w-3 h-3 text-green-400" />
          : <Copy className="w-3 h-3 text-gray-300" />}
      </button>
    </div>
  );
}

function CodeLine({ label, code }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-amber-600 font-medium w-20 shrink-0">{label}</span>
      <code className="text-[11px] font-mono bg-white border border-amber-200 px-2 py-0.5 rounded text-amber-900">
        {code}
      </code>
    </div>
  );
}

function FieldRow({ name, type, required, desc }) {
  return (
    <div className="flex gap-3 text-xs">
      <div className="shrink-0 w-20">
        <code className="font-mono font-semibold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">
          {name}
        </code>
      </div>
      <div className="flex items-start gap-2 min-w-0">
        <span className="text-gray-400 shrink-0">{type}</span>
        {required
          ? <span className="text-red-500 text-[10px] font-semibold shrink-0">required</span>
          : <span className="text-gray-400 text-[10px] shrink-0">optional</span>}
        <span className="text-gray-500 leading-relaxed">{desc}</span>
      </div>
    </div>
  );
}

function Row({ icon, label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5">
      <span className="text-xs text-gray-500 flex items-center gap-1.5">
        {icon}{label}
      </span>
      <span className={`text-xs text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
