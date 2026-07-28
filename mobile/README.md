# TBH Remote (Flutter)

Mobile client for pairing to TBH Companion and watching live status over the
Cloudflare relay.

## Run

```bash
flutter pub get
flutter run \
  --dart-define=API_BASE_URL=http://127.0.0.1:8787
```

On a physical device, use your machine's LAN IP instead of `127.0.0.1`, and run
`wrangler dev` with host binding as needed.

## Screens (v1 scaffold)

1. **Paywall** — subscription gate (RevenueCat TBD; dev unlock for local UI)
2. **Pair** — enter 6-digit code from the companion
3. **Status** — live WS status + pause/resume/run_now stubs

## Note on subscription

Server enforces subscription on `pair/claim` and mobile WebSocket. The paywall
"Dev: mark subscription active" only updates local prefs — for real E2E you
must set D1 `accounts.subscription_status = 'active'` (or send a RevenueCat
webhook) while developing.
