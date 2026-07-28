# API contract (v1 draft)

Base URL (prod): `https://<worker>.<account>.workers.dev` (custom domain later).  
All JSON. WebSocket messages are JSON text frames.

## REST

### `POST /v1/accounts/bootstrap`

Create or resume a lightweight mobile account (device-scoped until real login exists).

Request:

```json
{ "clientId": "uuid-from-install" }
```

Response:

```json
{
  "accountId": "acc_...",
  "accountToken": "...",
  "subscription": { "status": "none|active|grace|expired", "productId": null }
}
```

### `POST /v1/pair/start` (PC)

Headers: `Authorization: Bearer <pcBootstrapOrDeviceToken>` (first-time PC may mint device).

Request:

```json
{ "deviceId": "pc_uuid", "deviceName": "DESKTOP-HOME" }
```

Response:

```json
{ "code": "482193", "expiresIn": 120, "deviceId": "pc_uuid", "pcToken": "..." }
```

### `POST /v1/pair/claim` (mobile)

Headers: `Authorization: Bearer <accountToken>`  
Requires `subscription.status === active|grace`.

Request:

```json
{ "code": "482193" }
```

Response:

```json
{
  "deviceId": "pc_uuid",
  "deviceName": "DESKTOP-HOME",
  "mobileToken": "..."
}
```

Errors: `401`, `402 subscription_required`, `404 code_invalid_or_expired`.

### `GET /v1/me` (mobile)

Headers: account token.

Response: account, subscription, paired devices, online flags if known.

### `DELETE /v1/devices/:deviceId` (mobile)

Unlink PC from account; invalidates tokens for that device room.

### `POST /v1/webhooks/revenuecat`

RevenueCat server webhook. Verifies shared secret. Updates D1 subscription fields.

## WebSocket `GET /v1/ws`

Query: `role=pc|mobile&deviceId=&token=`  
Upgrade to WSS; joins `DeviceRoom` for `deviceId`.

### Client → server / server fan-out

| `type` | From | Payload |
|--------|------|---------|
| `status` | PC | Companion snapshot (stage, heroes, loop, discord, …) |
| `settings.set` | mobile | Partial settings patch |
| `command` | mobile | `{ id, name, args, expiresAt }` |
| `ack` | PC | `{ id, ok, error? }` |
| `presence` | PC / server | `{ online: bool, at }` |
| `hello` | either | role + protocol version |
| `ping` / `pong` | either | keepalive |

### Status snapshot (illustrative)

Aligned with companion/autosynth fields; exact shape will track `tbh-presence`:

```json
{
  "type": "status",
  "at": "2026-07-28T06:00:00Z",
  "gameRunning": true,
  "discordConnected": true,
  "stage": {
    "label": "Act 3 - Stage 5 (HELL, Lv 74)",
    "stageKey": 3305,
    "difficulty": "HELL",
    "stageSource": "live"
  },
  "heroes": [{ "name": "Ranger", "level": 80 }],
  "autoLoop": {
    "enabled": true,
    "step": "synthesis",
    "lastError": null
  }
}
```

### Commands (v1 candidates)

| `name` | Notes |
|--------|-------|
| `pause_loop` | Soft pause autosynth loop |
| `resume_loop` | Resume |
| `run_now` | Trigger loop cycle soon |
| `restart_game` | Dangerous — confirm in UI; short TTL |

Each command must be acked by PC or expire.

## Subscription gate matrix

| Action | Sub required |
|--------|----------------|
| Account bootstrap | no |
| Pair start (PC) | no |
| Pair claim (mobile) | **yes** |
| Mobile WS | **yes** |
| PC WS (already paired) | yes (account still active) |
| Settings / commands | **yes** |
