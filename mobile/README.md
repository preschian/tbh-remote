# TBH Remote (Flutter)

Mobile client for pairing to TBH Companion and polling live status from the
Cloudflare Worker + D1 relay.

## Run

```bash
flutter pub get
flutter run \
  --dart-define=API_BASE_URL=http://127.0.0.1:8787
```

On a physical device, use your machine's LAN IP instead of `127.0.0.1`.

## Screens (v1)

1. **Paywall** — subscription gate (RevenueCat TBD; dev unlock for local UI)
2. **Pair** — enter 6-digit code from the companion
3. **Status** — HTTP poll every 3s + enqueue commands

## Note on subscription

Server enforces subscription on pair claim and remote APIs. Dev unlock only
updates local prefs — for real E2E set D1 `subscription_status = 'active'`
(or send a RevenueCat webhook).
