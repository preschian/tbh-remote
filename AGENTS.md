# Agent guidelines — tbh-remote

## Scope

- Cloud relay + mobile app for TBH Companion remote monitor.
- Windows companion / BepInEx stay in `tbh-presence`.
- v1 transport is **Workers + D1 HTTP polling** — do not reintroduce Durable
  Objects unless product needs true push/WebSockets.

## Stack

- `workers/` — Cloudflare Workers + D1 (TypeScript)
- `mobile/` — Flutter; RevenueCat later
- Auth: pairing codes; subscription gates pair + remote APIs

## Conventions

- Conventional Commits
- Update `docs/api.md` when routes change
- Gate paid features on the server
- No game saves / memory dumps in the relay

## Verify

- `cd workers && npm test && npx tsc --noEmit`
- `cd mobile && flutter analyze && flutter test`
