# Stock JSON data (not in Git)

The `stocks/` folder holds per-symbol JSON files used for local development and one-time DB seeding. These files are **not tracked in Git** because they are large (~140MB+) and bloat repository history.

## Local setup

1. Place JSON files in `server/data/stocks/` (e.g. `HPG.json`, `FPT.json`).
2. Seed Postgres (production source of truth for `/api/stocks-v2/*`):

```bash
cd server
vercel env pull .env.local   # if needed
npm run db:seed
```

## Production

Vercel serves stock data from **Postgres** (`stocks-v2` API). JSON files are not deployed from this repo.

## Legacy API

`/api/stocks/*` (GitHub-based) may still expect JSON in the repo on older deployments. Prefer `stocks-v2` endpoints backed by the database.
