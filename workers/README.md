# TBH Remote — Cloudflare Worker

Relay for pairing, live status, commands, and RevenueCat webhooks.

## Setup

1. Create D1 + KV in the Cloudflare dashboard (or `wrangler d1 create` / `wrangler kv namespace create`).
2. Replace placeholder ids in `wrangler.jsonc`.
3. `npm install`
4. `npm run db:migrate:local`
5. `npm run dev`

Optional secret:

```bash
echo -n "your-secret" | wrangler secret put REVENUECAT_WEBHOOK_SECRET
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local Worker + DO |
| `npm run deploy` | Deploy |
| `npm test` | Vitest |
| `npm run cf-typegen` | Regenerate `Env` types from wrangler |

See `../docs/api.md` for the HTTP/WS contract.
