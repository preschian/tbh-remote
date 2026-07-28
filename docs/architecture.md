# Architecture

## Goals

- Monitor TaskBarHero + TBH Companion mods from a phone, anywhere.
- No Tailscale / VPN / port-forward for end users.
- Subscription funds the relay; pairing code keeps auth simple for v1.
- Everything server-side on Cloudflare — **Workers + D1 only** (no Durable Objects).

## High-level

```
┌─────────────────────┐         ┌──────────────────────────────┐         ┌──────────────┐
│  TbhCompanion (PC)  │  HTTP   │  Cloudflare Worker           │  HTTP   │  Flutter app │
│  PUT status         │────────►│  D1: accounts, devices,      │◄────────│  GET status  │
│  GET commands       │  poll   │       status, commands,      │  poll   │  POST cmds   │
│  POST ack           │         │       pairing codes          │         │  PUT settings│
└─────────────────────┘         │  RevenueCat webhook          │         └──────┬───────┘
                                └──────────────▲───────────────┘                │
                                               │ webhook                        │ IAP
                                               └──────── RevenueCat ◄── App Store / Play
```

## Why no Durable Objects?

DO is great for live WebSocket rooms and strong per-device coordination. For v1
monitor/control, **HTTP + D1 polling** is enough:

| | Workers + D1 | + Durable Objects + WSS |
|--|--------------|-------------------------|
| Latency | ~2–5s poll | Near-instant |
| Complexity | Lower | Higher |
| Cost / ops | Simpler | Extra DO class + hibernation |
| Fan-out | Not needed (1 PC, few phones) | Built-in |

Add DO later only if you need true push (live wave ticks, multi-watcher fan-out).

## Cloudflare map

| Product | Use |
|---------|-----|
| Workers | All REST routes + RevenueCat webhook |
| D1 | Accounts, tokens, devices, pairing codes, last status, command queue |
| Secrets | `REVENUECAT_WEBHOOK_SECRET` |

## Auth: pairing code

1. PC `POST /v1/pair/start` → 6-digit code (TTL ~120s) in D1.
2. Companion shows the code.
3. Mobile (sub active) `POST /v1/pair/claim`.
4. Both use bearer tokens on subsequent HTTP calls.

## Subscription gate

- Attached to the **mobile account**.
- Required for pair claim, mobile status/commands/settings.
- Paired PC routes also require the linked account still active.
- Expiry does not affect local Discord/mods on the PC.

## Polling contract (typical)

- PC: `PUT .../status` every ~3s while game/companion runs; `GET .../commands` same cadence; ack when done.
- Mobile: `GET .../status` every ~3s while screen open.
- `pcOnline`: `devices.last_seen_at` within ~20s.

## Security notes

- Never expose the companion directly to the public internet.
- Hash tokens at rest; revoke on unpair.
- Commands have short TTL; dangerous ones need mobile confirm.
- Status snapshots only — no save files / memory dumps.

## Relation to tbh-presence

| Concern | Repo |
|---------|------|
| Memory reader, Discord, BepInEx, tray UI | `tbh-presence` |
| Cloud HTTP client in the companion | `tbh-presence` (later) |
| Relay API + billing webhook | **this repo** `workers/` |
| Mobile UI + IAP | **this repo** `mobile/` |
