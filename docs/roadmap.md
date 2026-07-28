# Roadmap

## Phase 0 — Repo + contracts (current)

- [x] Separate repo with docs (architecture, API, roadmap)
- [x] Workers scaffold (routes + DeviceRoom stub + D1 schema)
- [x] Flutter scaffold (pair / status / paywall placeholders)
- [ ] Wire companion cloud client in `tbh-presence` (separate PR later)

## Phase 1 — Pairing + status (MVP)

- [ ] D1 migrations live; KV pairing codes with TTL
- [ ] `pair/start` + `pair/claim` end-to-end
- [ ] DeviceRoom WSS: PC pushes `status`, mobile displays
- [ ] Mobile: bootstrap account, enter code, live status screen

## Phase 2 — Subscription

- [ ] RevenueCat products + `purchases_flutter`
- [ ] Webhook → D1 subscription status
- [ ] Server gate on claim + mobile WS (`402`)
- [ ] Paywall screen; restore purchases

## Phase 3 — Control

- [ ] `settings.set` + PC apply/ack
- [ ] Commands: pause / resume / run_now (+ ack + TTL)
- [ ] Online/offline presence on mobile

## Phase 4 — Harden

- [ ] Rate limits, revoke device, token rotation
- [ ] Custom domain, observability, basic audit
- [ ] Multi-device policy (v1: 1 PC per account)
- [ ] Dangerous command confirmations

## Out of scope (for now)

- Full account login (Google/Apple/Discord) — pairing is enough for v1
- Hosting game files / saves
- Exposing companion HTTP on the public internet
