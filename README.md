# Phillip WA Gateway

WhatsApp Gateway middleware for **Phillip Securities Hong Kong** — lets external systems (monitoring tools, alert platforms, automation scripts) send WhatsApp messages via a simple HTTP API.

**Stack:** Node.js · Baileys · Express · BullMQ · Redis · SQLite · React · Vite · TailwindCSS · nginx · Docker

---

## Architecture

```
External System (SolarWinds, PRTG, etc.)
      │  POST /send-message
      │  Authorization: Bearer <api-key>
      ▼
  Backend :3000 (Express)
      │  Auth middleware  → validates API key / IP whitelist
      │  ID normalizer   → converts to WhatsApp JID
      │  getRecipientName → resolves display name
      ▼
  Queue Service (BullMQ + Redis)
      │  3 attempts, exponential backoff (2s → 4s → 8s)
      │  falls back to in-process direct send if Redis unavailable
      ▼
  Baileys (WhatsApp Web)
      │  multi-device session per instance
      ▼
  WhatsApp Group / Personal

  ─────────────────────────────────────────────────────
  SQLite Database (gateway.db)
      │  users, API keys, instances, group aliases,
      │  allowed IPs, message logs
      └  persisted via Docker named volume (db_data)

  ─────────────────────────────────────────────────────
  Admin Dashboard :3001 (React + nginx)
      │  nginx proxies /api/*      → backend:3000
      │  nginx proxies /socket.io/ → backend:3000 (WebSocket)
      └  real-time status via Socket.IO events

  ─────────────────────────────────────────────────────
  SQLite Web :3002 (coleifer/sqlite-web)
      └  read/write browser UI for gateway.db (password-protected)
```

---

## Quick Start (Docker)

### 1. Generate a secure `.env`

```bash
cp .env.example .env
```

Open `.env` and fill in the two required secrets. Use the commands below to generate them:

```bash
# JWT_SECRET — signs all admin session tokens
openssl rand -hex 32

# SQLITE_WEB_PASSWORD — login password for the database browser on :3002
openssl rand -base64 16
```

Paste the output of each command into the corresponding variable in `.env`.

Your `.env` should look like this when complete:

```env
JWT_SECRET=a3f8d2e1c7b94f0e2d6a1b8c4e3f5a7d9e2b1c4f6a8d3e5f7b2c9a1d4f6e8b3
SQLITE_WEB_PASSWORD=Xk9mP2rLqN4wT7vA
```

> `API_KEY` is optional — leave it blank and create API keys from the dashboard after first login.

### 2. Launch all services

```bash
docker compose up -d --build
```

### 3. Verify startup

```bash
docker compose logs -f backend
```

| Service | URL | Notes |
|---------|-----|-------|
| Admin dashboard | http://localhost:3001 | Login: `admin` / `admin123` |
| Backend API | http://localhost:3000 | Direct API access |
| Database browser | http://localhost:3002 | Login with `SQLITE_WEB_PASSWORD` |

> **Change the default admin password immediately** — Settings → Users → change password.

---

## First-Time Setup

1. Log in at **http://localhost:3001** (`admin` / `admin123`)
2. Go to **Settings → Users** → change your password
3. Go to **Instances** → click **Add Instance**
4. Scan the QR code that appears with WhatsApp (Settings → Linked Devices → Link a Device)
5. Once connected, go to **Groups** to find and copy Group IDs or set Aliases
6. Go to **Settings → API Keys** → generate a key for SolarWinds or any external system

---

## Local Development (without Docker)

**Prerequisites:** Node.js 20+, Redis (optional — falls back to direct send if unavailable)

### Backend

```bash
cd backend
npm install
# Copy and fill in .env (set REDIS_HOST=localhost, DB_PATH=./data/gateway.db)
cp ../.env.example .env
npm run dev
# → http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3001
```

The Vite dev server proxies `/api/*` and `/socket.io/*` to `http://localhost:3000` automatically.

---

## API Reference

### Authentication

| Route | Auth required |
|-------|--------------|
| `POST /send-message` | Multi-Auth (see below) |
| `/instances/*`, `/logs`, `/admin/*` | JWT — `Authorization: Bearer <jwt>` (issued by `/auth/login`) |
| `/health`, `/status`, `/auth/login` | None |

For `POST /send-message`, authentication is checked in the following order:

1. **IP Whitelist** — no API key needed if the sender IP is whitelisted (supports single IP, CIDR, wildcard)
2. **HTTP Header** — `Authorization: Bearer <key>`
3. **HTTP Header** — `x-api-key: <key>`
4. **Body Field** — `apikey=<key>` (for `application/x-www-form-urlencoded` or systems that cannot set custom headers)

> **Rate limiting:** All endpoints (except `/health`) are limited to **100 requests per minute per IP**.

---

### `GET /health` — public

```json
{ "ok": true, "ts": 1712345678901 }
```

---

### `GET /status` — public (legacy)

Returns status of all instances. Kept for backwards compatibility.

```json
{
  "status": "connected",
  "phone": "628111000111",
  "name": "Your Name",
  "instances": [
    {
      "id": "wa1",
      "name": "WhatsApp 1",
      "status": "connected",
      "phone": "628111000111",
      "waName": "Your Name"
    }
  ]
}
```

`status`, `phone`, `name` reflect the **first** instance. Use `GET /instances` for full multi-instance data.

---

### `POST /auth/login` — public

**Request:**
```json
{ "username": "admin", "password": "admin123" }
```

**Response (200):**
```json
{
  "token": "<jwt — valid 8 hours>",
  "user": { "id": "a1b2c3d4", "username": "admin", "role": "admin" }
}
```

---

### `POST /send-message` — Multi-Auth supported

Accepts both `application/json` and `application/x-www-form-urlencoded`.

**Request (JSON):**
```json
{
  "message": "🚨 *Device Down Alert*\n\n*Device:* Core-Switch-01\n*IP:* 10.10.10.1\n*Status:* DOWN",
  "id": "alert-it",
  "from": "wa1"
}
```

**Request (Form URL-Encoded):**
```
id=alert-it&message=Hello%20World&apikey=YOUR_API_KEY
```

| Field | Required | Description |
|-------|----------|-------------|
| `message` | Yes | Text to send. Supports WhatsApp markdown: `*bold*`, `_italic_`, `~strikethrough~` |
| `id` | Yes | Recipient — see accepted formats below |
| `from` | No | Instance ID to send from (e.g. `wa1`). Defaults to the first connected instance. |
| `apikey` | No | API key (alternative to headers). Not required if the IP is whitelisted. |

**Accepted `id` formats:**

| Format | Type | Example |
|--------|------|---------|
| Plain number | Personal | `628123456789` |
| `@c.us` suffix | Personal (legacy) | `628123456789@c.us` |
| `@s.whatsapp.net` suffix | Personal | `628123456789@s.whatsapp.net` |
| `@g.us` suffix | Group | `120363025600132873@g.us` |
| Group Alias | Group | `alert-it` (configured in Settings) |

**Response (202 Accepted):**
```json
{
  "success": true,
  "jobId": "42",
  "message": "Message queued successfully",
  "destination": "120363025600132873@g.us",
  "type": "group",
  "sentFrom": "wa1",
  "sentFromName": "WhatsApp 1"
}
```

**Error responses:**

| Code | Reason |
|------|--------|
| 400 | Missing/invalid `message` or `id`, invalid ID format |
| 401 | Missing or invalid API key |
| 404 | Instance `from` not found |
| 422 | Personal number not registered on WhatsApp |
| 503 | No connected WhatsApp instance available |

---

### `GET /instances` — JWT required

```json
[
  {
    "id": "wa1",
    "name": "WhatsApp 1",
    "status": "connected",
    "phone": "628111000111",
    "waName": "Your Name"
  }
]
```

`status` values: `"connected"` | `"connecting"` | `"disconnected"`

---

### `POST /instances` — JWT required

**Request:**
```json
{ "id": "wa2", "name": "WhatsApp 2" }
```

> `id` is automatically lowercased and must only contain letters, numbers, `_`, or `-`.

**Response (201):**
```json
{ "success": true, "id": "wa2", "name": "WhatsApp 2" }
```

After creation, the instance starts connecting and a QR code becomes available via the dashboard and `GET /instances/:id/qr`.

---

### `GET /instances/:id/qr` — JWT required

Returns QR code while the instance is waiting to be scanned.

```json
{ "qr": "data:image/png;base64,..." }
```

Returns `404` if the instance is already connected or QR hasn't been generated yet.

> The admin dashboard also receives QR updates in real time via the `instance_status` Socket.IO event — no polling required.

---

### `POST /instances/:id/reset` — JWT required

Disconnects the instance, wipes all session files, and triggers a new QR code.

```json
{ "success": true, "message": "Instance reset. Scan new QR to reconnect." }
```

---

### `DELETE /instances/:id` — JWT required

```json
{ "success": true }
```

---

### `GET /instances/:id/groups` — JWT required

```json
[
  { "id": "120363025600132873@g.us", "name": "Network Team" },
  { "id": "120363099887700123@g.us", "name": "NOC Alerts" }
]
```

---

### `GET /logs` — JWT required

Query params: `limit` (default 2000, max 5000), `from` (YYYY-MM-DD), `to` (YYYY-MM-DD)

```json
{
  "logs": [
    {
      "timestamp": "2026-04-13T10:00:00.000Z",
      "sourceIp": "192.168.1.10",
      "instanceId": "wa1",
      "instancePhone": "628111000111",
      "id": "120363025600132873@g.us",
      "recipientName": "Network Team",
      "message": "Device Down Alert",
      "status": "success",
      "error": null
    }
  ],
  "stats": { "total": 120, "success": 118, "failed": 2 }
}
```

Logs are retained for **90 days**. Older entries are cleaned up automatically on startup and daily.

---

### `GET /admin/users` — JWT required

```json
[
  { "id": "a1b2c3d4", "username": "admin", "role": "admin", "createdAt": "2026-04-13T08:00:00.000Z" }
]
```

Password hashes are never returned.

---

### `POST /admin/users` — JWT required

**Request:** `{ "username": "ops", "password": "securepassword" }`
> Password must be at least **6 characters**.

**Response (201):** `{ "id": "e5f6g7h8", "username": "ops", "role": "admin", "createdAt": "..." }`

---

### `PUT /admin/users/:id/password` — JWT required

**Request:** `{ "password": "newpassword" }` → **Response:** `{ "success": true }`

---

### `DELETE /admin/users/:id` — JWT required

`{ "success": true }`

> Cannot delete your own account or the last remaining user.

---

### `GET /admin/apikeys` — JWT required

Key values are masked — only the first 8 and last 4 characters visible.

```json
[
  {
    "id": "abc12345",
    "name": "SolarWinds Prod",
    "keyMasked": "wag_1234••••••••5678",
    "createdAt": "2026-04-13T08:00:00.000Z",
    "lastUsed": "2026-04-13T10:00:00.000Z"
  }
]
```

---

### `POST /admin/apikeys` — JWT required

**Request:** `{ "name": "SolarWinds Prod" }`

**Response (201):** Full key returned **only once** — copy it immediately.

```json
{
  "id": "abc12345",
  "name": "SolarWinds Prod",
  "key": "wag_a1b2c3d4e5f6...48hexchars",
  "createdAt": "2026-04-13T08:00:00.000Z",
  "lastUsed": null
}
```

Key format: `wag_` prefix + 48 random hex characters.

---

### `DELETE /admin/apikeys/:id` — JWT required

`{ "success": true }`

---

## Real-Time Updates (Socket.IO)

The backend emits Socket.IO events for all state changes. The dashboard subscribes to these and updates without polling.

| Event | When | Payload |
|-------|------|---------|
| `instances_init` | On socket connect | Array of all instances with current status and QR |
| `instance_status` | On any state change | Single instance object (includes `qr` when available) |
| `instance_added` | New instance created | Instance object |
| `instance_removed` | Instance deleted | `{ id }` |

**`instance_status` payload:**
```json
{
  "id": "wa1",
  "name": "WhatsApp 1",
  "status": "connecting",
  "phone": null,
  "waName": null,
  "qr": "data:image/png;base64,..."
}
```

`qr` is `null` when connected or not yet generated.

---

## Example cURL

```bash
# Send to a group via alias
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wag_your_api_key_here" \
  -d '{"message": "🚨 *Alert:* Router01 is DOWN", "id": "alert-it"}'

# Send to a personal number via a specific instance
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -H "x-api-key: wag_your_api_key_here" \
  -d '{"message": "Test message", "id": "628123456789", "from": "wa1"}'

# Send via form-urlencoded (no custom headers — useful for legacy systems)
curl -X POST http://localhost:3000/send-message \
  -d "apikey=wag_your_api_key_here&id=alert-it&message=Hello"

# Get JWT (dashboard login)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

---

## SolarWinds Setup

1. In SolarWinds Alert Manager, create a new alert action → **HTTP POST**
2. URL: `http://<server-ip>:3000/send-message`
3. Authentication: **Token** → paste the key from **Settings → API Keys**
4. Content-Type: `application/json`
5. Body:
```json
{
  "message": "🚨 *Device Down Alert*\n\n*Device :* ${NodeName}\n*IP Address :* ${IP_Address}\n*Status :* DOWN",
  "id": "120363025600132873@g.us"
}
```

> Copy your Group ID from the **Groups** page in the admin dashboard.
> To send from a specific WhatsApp account, add `"from": "wa1"` to the body.

---

## Admin Dashboard

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Overview of all instances — status, phone, WhatsApp name |
| Instances | `/instances` | Add/remove instances, scan QR (real-time via socket), reset session |
| Groups | `/groups` | Browse and search group IDs per connected instance, set/edit Aliases |
| Logs | `/logs` | Message history — status, source IP, instance, recipient, message preview |
| Docs | `/docs` | Interactive API documentation and request examples |
| Settings | `/settings` | API Keys, Group Aliases, Allowed IPs (Whitelist), and Users |

---

## Multi-Instance

Multiple WhatsApp accounts run simultaneously. Each instance has its own independent Baileys session in `sessions/<id>/`.

- Add instances from the **Instances** page — provide an ID (e.g. `wa2`) and a display name
- Instance IDs are always lowercased automatically
- QR modal opens automatically after adding — scan to link that account
- Use `"from": "<instance-id>"` in the API body to route through a specific account
- If `from` is omitted, the first connected instance is used
- Instance metadata persists across restarts in the SQLite database

---

## Data Storage

All application data is stored in a **SQLite database** (`gateway.db`) persisted via a Docker named volume (`db_data`).

| Table | Data |
|-------|------|
| `users` | Admin dashboard accounts (bcrypt-hashed passwords) |
| `api_keys` | Named API keys for external integrations |
| `instances` | Registered WhatsApp instance metadata |
| `group_aliases` | Short name → Group JID mappings |
| `allowed_ips` | IP whitelist (single IP, CIDR, wildcard) |
| `message_logs` | All send attempts with status (90-day retention) |

WhatsApp session credentials are stored separately in `sessions/<id>/` (Baileys multi-file auth state) and persisted via a bind mount.

### Database Browser (SQLite Web)

A web-based database browser is included and runs at **http://localhost:3002**.

```bash
# Start the database browser (starts automatically with docker compose up)
docker compose up -d sqlite-web

# Access at:
#   http://localhost:3002
#   Login with the password set in SQLITE_WEB_PASSWORD
```

---

## Queue Behaviour

| Mode | Condition | Behaviour |
|------|-----------|-----------|
| BullMQ + Redis | Redis reachable on startup | Jobs queued, 3 attempts, exponential backoff (2s → 4s → 8s) |
| Direct (fallback) | Redis unavailable | Send immediately in-process, same 3-attempt backoff |

The app detects Redis availability at startup automatically.

---

## Project Structure

```
WA-Gateway/
├── backend/
│   ├── src/
│   │   ├── server.js                    # Express + Socket.IO entry point
│   │   ├── routes/index.js              # All route registrations
│   │   ├── controllers/
│   │   │   ├── auth.controller.js       # POST /auth/login
│   │   │   ├── message.controller.js    # POST /send-message
│   │   │   ├── instance.controller.js   # /instances/* CRUD + QR + groups
│   │   │   ├── status.controller.js     # GET /status (legacy)
│   │   │   ├── log.controller.js        # GET /logs
│   │   │   ├── groupAlias.controller.js # /admin/group-aliases CRUD
│   │   │   ├── allowedIp.controller.js  # /admin/allowed-ips CRUD
│   │   │   └── settings.controller.js   # /admin/users, /admin/apikeys
│   │   ├── services/
│   │   │   ├── db.js                    # SQLite init, schema, JSON migration
│   │   │   ├── waManager.js             # Multi-instance Baileys manager
│   │   │   ├── queue.service.js         # BullMQ + Redis with direct-send fallback
│   │   │   ├── log.service.js           # Message logs (SQLite)
│   │   │   ├── user.service.js          # Users (SQLite, bcrypt)
│   │   │   ├── apikey.service.js        # API keys (SQLite)
│   │   │   ├── groupAlias.service.js    # Group aliases (SQLite)
│   │   │   └── allowedIp.service.js     # IP whitelist (SQLite, CIDR/wildcard)
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js       # API key validation (Bearer / x-api-key / body)
│   │   │   ├── jwt.middleware.js        # JWT validation + signToken()
│   │   │   └── rateLimit.middleware.js  # 100 req/min per IP
│   │   └── utils/idNormalizer.js        # Converts any ID format → WhatsApp JID
│   ├── .dockerignore
│   └── Dockerfile                       # Multi-stage: builder (native addons) → slim runtime
├── frontend/
│   ├── src/
│   │   ├── App.jsx                      # Routes, auth guard, Socket.IO listeners
│   │   ├── context/AuthContext.jsx      # Login state, JWT in localStorage
│   │   ├── services/
│   │   │   ├── api.js                   # Axios instance with JWT interceptor
│   │   │   └── socket.js               # Socket.IO singleton
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Instances.jsx            # QR modal with real-time socket updates
│   │   │   ├── Groups.jsx               # Group browser with alias display/edit
│   │   │   ├── Logs.jsx
│   │   │   ├── Docs.jsx
│   │   │   └── Settings.jsx
│   │   └── components/
│   │       ├── Layout.jsx               # Sidebar + Phillip Securities branding
│   │       └── StatusBadge.jsx
│   ├── nginx.conf                       # SPA fallback + /api/* + /socket.io/ proxy
│   └── Dockerfile                       # Multi-stage: Vite build → nginx:alpine
├── sessions/                            # Baileys session files — bind-mounted
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Security Notes

- **Secrets** — `JWT_SECRET` and `SQLITE_WEB_PASSWORD` must be set before deployment; both accept output from `openssl rand`
- **Default credentials** — change `admin` / `admin123` immediately after first login
- **API keys** — stored bcrypt-hashed in SQLite, accessible only inside the Docker volume
- **Passwords** — bcrypt-hashed (cost 10), never stored in plaintext
- **JWT sessions** — expire after 8 hours; set a strong `JWT_SECRET` (32+ random bytes)
- **Rate limiting** — 100 requests/minute/IP on all non-health endpoints
- **SQLite Web** — exposed on port 3002; protect with a strong `SQLITE_WEB_PASSWORD` and firewall the port to internal network only in production
- **sessions/** — git-ignored; never commit Baileys session files
- **Production** — firewall ports `3001` (admin UI) and `3002` (database browser) to your internal network; only port `3000` (API) needs to be reachable by external systems

---

## License

MIT
