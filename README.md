# TBH Remote

Mobile monitor/control for [TBH Companion](https://github.com/preschian/tbh-presence),
with a Cloudflare **Workers + D1** relay (no Tailscale, no Durable Objects in v1).

```
Game + TbhCompanion (PC)  ──HTTP poll──►  Cloudflare Worker + D1  ◄──HTTP poll──  Flutter
```

## Repo layout

| Path | Role |
|------|------|
| [`docs/`](docs/) | Architecture, API, roadmap |
| [`workers/`](workers/) | Pairing, status, commands, billing gate |
| [`mobile/`](mobile/) | Flutter iOS/Android |

## Product rules (v1)

- Auth: **pairing code** (6 digits, short TTL)
- Access: **subscription** required to pair and use remote features
- Billing: RevenueCat → webhook → D1
- Transport: **HTTP polling** (add WebSocket/DO later only if needed)
- PC stays offline-first for Discord/mods

## Quick start

```bash
cd workers && npm install && npm run dev
cd mobile && flutter pub get && flutter run \
  --dart-define=API_BASE_URL=http://127.0.0.1:8787
```

## Related

- Companion: https://github.com/preschian/tbh-presence
