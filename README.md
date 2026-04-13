# WhatsApp Gateway

A production-ready middleware that lets external systems (monitoring tools, alert platforms, automation scripts) send WhatsApp messages via a simple HTTP API.

**Stack:** Node.js · Baileys · Express · BullMQ · Redis · React · Vite · TailwindCSS · Docker

---

## Architecture

```
External System (SolarWinds, etc)
      │  POST /send-message
      │  Authorization: Bearer <api-key>
      ▼
  Backend (Express)
      │  Auth middleware → validates API key
      │  ID normalizer  → converts to WhatsApp JID
      ▼
  Queue Service (BullMQ + Redis / direct fallback)
      │  retry up to 3×
      ▼
  Baileys (WhatsApp)
      │
      ▼
  WhatsApp Group / Personal
```

---

## Quick Start (Docker)

```bash
# 1. Enter the project directory
cd WA-Gateway

# 2. Create your environment file
cp .env.example .env
# Edit .env — set a strong JWT_SECRET

# 3. Build and launch
docker-compose up -d --build

# 4. Watch backend logs
docker-compose logs -f backend
```

Open the admin UI at **http://localhost:3001**, log in with `admin / admin123`, then go to **QR Code** and scan with your phone.

After scanning, go to **Settings → API Keys** to generate a key for SolarWinds.

---

## Local Development (without Docker)

### Prerequisites
- Node.js 20+
- Redis (optional — falls back to direct send if unavailable)

### Backend

```bash
cd backend
cp .env.example .env
# Set REDIS_HOST=localhost (or leave Redis off for direct mode)
npm install
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

The Vite dev server automatically proxies `/api/*` and `/socket.io/*` to the backend.

---

## First Login

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |

**Change the password immediately after first login** via Settings → Users.

---

## API Reference

### Authentication

`/send-message` uses **API key authentication** (managed via Settings → API Keys):

```
Authorization: Bearer <api-key>    ← SolarWinds Token mode / Postman
x-api-key: <api-key>               ← alternative (Postman / curl)
```

Dashboard routes (`/groups`, `/logs`, `/admin/*`) use **JWT** issued by `POST /auth/login`.

---

### `GET /health` — public
```json
{ "ok": true, "ts": 1712345678901 }
```

### `GET /status` — public
```json
{
  "status": "connected",
  "phone": "628123456789",
  "name": "Your Name"
}
```

### `GET /qr` — public
```json
{ "qr": "data:image/png;base64,..." }
```

### `POST /auth/login` — public
```json
// Request
{ "username": "admin", "password": "admin123" }

// Response
{ "token": "<jwt>", "user": { "id": "...", "username": "admin", "role": "admin" } }
```

---

### `POST /send-message` — API key required

**Request:**
```json
{
  "message": "🚨 *Device Down Alert*\n\n*Device:* Core-Switch-01\n*IP:* 10.10.10.1\n*Status:* DOWN",
  "id": "120363025600132873@g.us"
}
```

**Accepted `id` formats:**

| Format | Type | Example |
|--------|------|---------|
| Plain number | Personal | `628123456789` |
| `@c.us` suffix | Personal | `628123456789@c.us` |
| `@s.whatsapp.net` suffix | Personal | `628123456789@s.whatsapp.net` |
| `@g.us` suffix | Group | `120363025600132873@g.us` |

**Response (202):**
```json
{
  "success": true,
  "jobId": "42",
  "message": "Message queued successfully",
  "destination": "120363025600132873@g.us",
  "type": "group"
}
```

---

### `GET /groups` — JWT required
```json
[{ "id": "120363025600132873@g.us", "name": "Network Team" }]
```

### `GET /logs?limit=100` — JWT required
```json
[
  {
    "timestamp": "2026-04-13T10:00:00.000Z",
    "id": "120363025600132873@g.us",
    "message": "Device Down Alert",
    "status": "success",
    "error": null
  }
]
```

### `POST /reset-session` — JWT required
Deletes session files and forces a new QR login.

---

### Settings API — JWT required

**API Keys:**
```
GET    /admin/apikeys          List all keys (masked)
POST   /admin/apikeys          Create key  { "name": "SolarWinds Prod" }
DELETE /admin/apikeys/:id      Revoke key
```

**Users:**
```
GET    /admin/users            List all users
POST   /admin/users            Create user  { "username", "password" }
PUT    /admin/users/:id/password  Change password  { "password" }
DELETE /admin/users/:id        Delete user
```

---

## Example cURL

```bash
# Send to group
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wag_your_api_key_here" \
  -d '{
    "message": "🚨 *Alert:* Router01 is DOWN",
    "id": "120363025600132873@g.us"
  }'

# Send to personal number
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wag_your_api_key_here" \
  -d '{
    "message": "Test message",
    "id": "628123456789"
  }'
```

---

## SolarWinds Setup

1. In SolarWinds Alert Manager, create a new alert action → **HTTP POST**
2. URL: `http://<server-ip>:3000/send-message`
3. Authentication: **Token**
4. Token: paste the API key generated from **Settings → API Keys**
5. Body (Content-Type: application/json):
```json
{
  "message": "🚨 *Device Down Alert*\n\n*Device :* ${NodeName}\n*IP Address :* ${IP_Address}\n*Status :* DOWN",
  "id": "120363025600132873@g.us"
}
```

---

## Admin Dashboard

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/` | WhatsApp connection status, reset session |
| QR Code | `/qr` | Scan to link WhatsApp (auto-refreshes 30s) |
| Groups | `/groups` | Browse and copy Group IDs |
| Logs | `/logs` | Message history with success/fail status |
| Settings | `/settings` | Manage API keys and dashboard users |

---

## Project Structure

```
WA-Gateway/
├── backend/
│   ├── src/
│   │   ├── server.js                   # Express + Socket.IO entry point
│   │   ├── whatsapp.js                 # Baileys singleton (QR, send, groups)
│   │   ├── routes/index.js             # Route registration
│   │   ├── controllers/
│   │   │   ├── auth.controller.js      # POST /auth/login
│   │   │   ├── message.controller.js   # POST /send-message
│   │   │   ├── group.controller.js     # GET /groups
│   │   │   ├── status.controller.js    # GET /status
│   │   │   ├── log.controller.js       # GET /logs
│   │   │   ├── session.controller.js   # GET /qr, POST /reset-session
│   │   │   └── settings.controller.js  # /admin/users, /admin/apikeys
│   │   ├── services/
│   │   │   ├── queue.service.js        # BullMQ + Redis (falls back to direct)
│   │   │   ├── log.service.js          # NDJSON log file
│   │   │   ├── user.service.js         # User management (data/users.json)
│   │   │   └── apikey.service.js       # API key management (data/apikeys.json)
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js      # API key validation (Bearer / x-api-key)
│   │   │   ├── jwt.middleware.js       # JWT validation for dashboard routes
│   │   │   └── rateLimit.middleware.js # 100 req/min per IP
│   │   └── utils/idNormalizer.js       # WhatsApp JID normalisation
│   ├── data/                           # users.json, apikeys.json (git-ignored)
│   ├── sessions/                       # Baileys auth (git-ignored)
│   ├── logs/                           # Message logs (git-ignored)
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx                     # Routes + auth guard + Socket.IO
│   │   ├── context/AuthContext.jsx     # Login state + JWT storage
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── QRPage.jsx
│   │   │   ├── Groups.jsx
│   │   │   ├── Logs.jsx
│   │   │   └── Settings.jsx            # API Keys + Users management
│   │   ├── components/
│   │   │   ├── Layout.jsx              # Sidebar + logout
│   │   │   └── StatusBadge.jsx
│   │   └── services/api.js             # Axios + JWT interceptor
│   ├── nginx.conf
│   └── Dockerfile
├── sessions/
├── logs/
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Security Notes

- **API keys** for external integrations are managed via the Settings UI — keys are stored in `data/apikeys.json` and never exposed in full after creation.
- **Dashboard login** uses JWT (8-hour session). Set a strong `JWT_SECRET` in `.env`.
- `sessions/` and `data/` contain credentials — both are git-ignored.
- Keep port 3001 (dashboard) behind a VPN or firewall in production.

---

## .gitignore

```
.env
sessions/
data/
logs/
node_modules/
dist/
```

---

## Retry / Queue Behaviour

- **With Redis:** BullMQ queue, 3 attempts, exponential backoff (2 s → 4 s → 8 s)
- **Without Redis:** Direct in-process send, 3 attempts, same backoff — suitable for development

---

## License

MIT
