# Agent guidelines — tbh-remote

## Scope

- This repo is the **cloud relay + mobile app** for TBH Companion remote monitor.
- Do **not** put Windows companion / BepInEx plugin code here; that stays in
  `tbh-presence`.
- Keep changes focused. Prefer small, reviewable increments along the roadmap
  in `docs/roadmap.md`.

## Stack

- **workers/** — Cloudflare Workers + Durable Objects + D1 + KV (TypeScript).
- **mobile/** — Flutter (iOS/Android). Subscription via RevenueCat
  (`purchases_flutter`) when wired.
- Auth v1: pairing codes only. Subscription gates pair + live WS.

## Conventions

- Conventional Commits: `feat|fix|docs|refactor|test|build|ci|chore`.
- Document API / event changes in `docs/api.md` when contracts change.
- Gate paid features on the **server** (Worker), never only on the client.
- Do not store game saves or memory dumps — status snapshots only.

## Verify

- Workers: `cd workers && npm test` and `npm run dev` for local smoke.
- Mobile: `cd mobile && flutter analyze` and `flutter test`.
- Full deploy/IAP verification needs Cloudflare + store credentials; say so if
  those are unavailable in the current environment.
