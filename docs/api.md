# API contract (v1)

Base URL (prod): `https://<worker>.<account>.workers.dev`  
All JSON over HTTPS. **No WebSocket** in v1 — clients poll.

## Account & pairing

### `POST /v1/accounts/bootstrap`

```json
{ "clientId": "uuid-from-install" }
```

→ `{ accountId, accountToken, subscription: { status, productId } }`

### `POST /v1/pair/start` (PC)

```json
{ "deviceId": "pc_uuid", "deviceName": "DESKTOP-HOME" }
```

→ `{ code, expiresIn, deviceId, pcToken }`

### `POST /v1/pair/claim` (mobile)

Header: `Authorization: Bearer <accountToken>`  
Requires active/grace subscription.

```json
{ "code": "482193" }
```

→ `{ deviceId, deviceName, mobileToken }`

### `GET /v1/me` (mobile)

→ account, subscription, devices (includes `pcOnline`)

### `DELETE /v1/devices/:deviceId` (mobile)

Unlink + revoke tokens + clear status/commands.

### `POST /v1/webhooks/revenuecat`

RevenueCat webhook → updates `accounts.subscription_*`.

## Status / settings / commands

Auth: `Authorization: Bearer <pcToken|mobileToken|accountToken>` as noted.

### `PUT /v1/devices/:deviceId/status` (PC)

Body: arbitrary status JSON (stage, heroes, autoLoop, …).  
Also refreshes `last_seen_at` (drives `pcOnline`).

### `GET /v1/devices/:deviceId/status` (mobile)

```json
{
  "pcOnline": true,
  "updatedAt": "2026-07-28 06:00:00",
  "status": { "stage": { "label": "..." }, "autoLoop": { "enabled": true } },
  "desiredSettings": null
}
```

### `PUT /v1/devices/:deviceId/settings` (mobile)

Body: desired settings patch JSON (PC applies on next poll).

### `GET /v1/devices/:deviceId/settings` (PC)

→ `{ desiredSettings }` (also heartbeats `last_seen_at`)

### `POST /v1/devices/:deviceId/commands` (mobile)

```json
{ "name": "pause_loop", "args": null, "expiresInSec": 60, "id": "optional" }
```

→ `201 { id, name, expiresInSec }`

### `GET /v1/devices/:deviceId/commands` (PC)

→ `{ commands: [{ id, name, args, expiresAt, createdAt }] }`  
Pending, non-expired, unacked only.

### `POST /v1/devices/:deviceId/commands/:id/ack` (PC)

```json
{ "ok": true, "error": null }
```

## Suggested poll intervals

| Client | Endpoint | Interval |
|--------|----------|----------|
| PC | PUT status + GET commands | 2–5s |
| Mobile | GET status | 2–5s (foreground) |

## Subscription gate

| Action | Sub required |
|--------|----------------|
| Account bootstrap | no |
| Pair start (PC) | no |
| Pair claim / mobile status / commands / settings | **yes** |
| PC status/commands after paired | **yes** (linked account) |
