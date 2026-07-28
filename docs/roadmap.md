# Roadmap

## Phase 0 — Repo + contracts

- [x] Separate repo with docs
- [x] Workers scaffold on **Workers + D1** (no Durable Objects)
- [x] Flutter scaffold (pair / status / paywall)
- [ ] Wire companion HTTP client in `tbh-presence`

## Phase 1 — Pairing + status (MVP)

- [ ] Real D1 database ids + deploy
- [ ] `pair/start` + `pair/claim` end-to-end
- [ ] PC PUT status / mobile GET status polling
- [ ] Mobile live status screen

## Phase 2 — Subscription

- [ ] RevenueCat + `purchases_flutter`
- [ ] Webhook → D1 + server gates
- [ ] Paywall + restore

## Phase 3 — Control

- [ ] Settings PUT/GET
- [ ] Commands + ack (pause / resume / run_now)
- [ ] Online/offline from `last_seen_at`

## Phase 4 — Harden / optional realtime

- [ ] Rate limits, revoke, token rotation
- [ ] Custom domain, observability
- [ ] **Optional:** Durable Objects + WSS if polling feels too slow

## Out of scope (for now)

- Heavy account login
- Hosting game saves
- Public companion ports
