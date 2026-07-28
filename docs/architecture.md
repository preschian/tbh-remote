# Architecture

## Goals

- Monitor TaskBarHero + TBH Companion mods from a phone, anywhere.
- No Tailscale / VPN / port-forward for end users.
- Subscription funds the relay; pairing code keeps auth simple for v1.
- Everything server-side on Cloudflare.

## High-level

```
┌─────────────────────┐         ┌──────────────────────────────┐         ┌──────────────┐
│  TbhCompanion (PC)  │  WSS    │  Cloudflare                   │  WSS    │  Flutter app │
│  push status        │────────►│  Worker (HTTP + upgrade)      │◄────────│  view status │
│  pull settings/cmds │         │  DeviceRoom Durable Object    │         │  set/settings│
│  send ack           │         │  D1 (accounts, devices, sub)  │         │  send cmds   │
└─────────────────────┘         │  KV (pairing codes, TTL)      │         └──────┬───────┘
                                │  Cron (cleanup)               │                │
                                └──────────────▲───────────────┘                │
                                               │ webhook                        │ IAP
                                               │                                ▼
                                               └──────── RevenueCat ◄── App Store / Play
```

## Cloudflare map

| Product | Use |
|---------|-----|
| Workers | REST: pair start/claim, `/me`, RevenueCat webhook; WS upgrade |
| Durable Object `DeviceRoom` | One instance per `deviceId`: last status, command queue, WS fan-out |
| D1 | Accounts, devices, tokens, subscription status |
| KV | Pairing codes (`code → deviceId`) with short TTL |
| Secrets | `REVENUECAT_WEBHOOK_SECRET`, future API keys |
| Cron Triggers | Expire stale sessions / cleanup |

## Auth: pairing code

1. PC calls `POST /pair/start` → server returns 6-digit code (TTL ~120s).
2. Companion shows the code in Status & Settings.
3. Mobile (subscription active) calls `POST /pair/claim` with the code.
4. Server binds `deviceId` to the mobile account and issues tokens.
5. Both sides connect `WSS /ws?role=pc|mobile&deviceId=&token=`.

Unpair: `DELETE /devices/:deviceId` (mobile) or local revoke on PC later.

## Subscription gate

- Subscription is attached to the **mobile account**, not the PC.
- Required for: pair claim, mobile WS connect, settings/commands.
- PC may still push status for an already-paired device while sub is active.
- On expiry: reject new pair / mobile WS; PC local features unchanged.
- Source of truth: RevenueCat webhook → D1 `accounts.subscription_status`.

## DeviceRoom (Durable Object)

Per `deviceId`:

- `lastStatus` — latest JSON from PC (last-write-wins).
- `pendingCommands[]` — mobile → PC, each with `id`, TTL, payload.
- `desiredSettings?` — optional patch until PC acks.
- WebSocket sessions tagged `pc` or `mobile`.
- Heartbeat / `presence` so mobile can show online/offline.

## Security notes

- Never expose the companion directly to the public internet.
- Tokens are bearer secrets; rotate on re-pair.
- Commands have short TTL; dangerous ones need mobile confirm + PC ack.
- Rate-limit pair start/claim and command enqueue per account/device.
- Store only telemetry needed for monitor/control — no save files / dumps.

## Relation to tbh-presence

| Concern | Repo |
|---------|------|
| Memory reader, Discord, BepInEx, tray UI | `tbh-presence` |
| Cloud client in the companion (WSS + pair UI) | `tbh-presence` (later) |
| Relay API, DO, billing webhook | **this repo** `workers/` |
| Mobile UI + IAP | **this repo** `mobile/` |
