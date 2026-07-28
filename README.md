# TBH Remote

Mobile monitor/control for [TBH Companion](https://github.com/preschian/tbh-presence)
(TaskBarHero Discord presence + auto-synth mods), with a Cloudflare relay so users
do **not** need Tailscale or LAN access.

```
Game + TbhCompanion (PC)  ──WSS──►  Cloudflare  ◄──WSS──  Flutter mobile
                                      │
                              Workers + Durable Objects
                              D1 + KV + RevenueCat webhook
```

## Repo layout

| Path | Role |
|------|------|
| [`docs/`](docs/) | Architecture, API contract, roadmap |
| [`workers/`](workers/) | Cloudflare relay (pairing, status, commands, billing gate) |
| [`mobile/`](mobile/) | Flutter iOS/Android app (pair, live status, subscription) |

PC-side cloud client will live in `tbh-presence` later; this repo owns the cloud
+ mobile surface.

## Product rules (v1)

- Auth: **pairing code** (6 digits, short TTL). No heavy login yet.
- Access: **subscription required** to pair and use live monitor/control.
- Billing: App Store / Play via **RevenueCat** → webhook → D1.
- Transport: **WebSocket** per device room (Durable Object).
- Offline-first on PC: Discord presence and mods keep working if cloud is down.

## Quick start

### Workers

```bash
cd workers
npm install
npm run dev          # http://localhost:8787
```

Needs a Cloudflare account for D1/KV/DO when deploying (`npm run deploy`).

### Mobile

```bash
cd mobile
flutter pub get
flutter run
```

Point the app at your Worker URL in `mobile/lib/config.dart`.

## Related

- Companion (Windows): https://github.com/preschian/tbh-presence
