# TBH Remote — Cloudflare Worker

Stateless Worker + **D1** relay (no Durable Objects).

PC and mobile exchange status/commands over HTTP; clients poll every few seconds.

## Setup

1. `npx wrangler d1 create tbh-remote` and paste the id into `wrangler.jsonc`
2. `npm install`
3. `npm run db:migrate:local`
4. `npm run dev`

Optional:

```bash
echo -n "your-secret" | npx wrangler secret put REVENUECAT_WEBHOOK_SECRET
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local Worker + D1 |
| `npm run deploy` | Deploy |
| `npm test` | Vitest |
| `npm run cf-typegen` | Regenerate types |

See `../docs/api.md`.
