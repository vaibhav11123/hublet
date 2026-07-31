# Deployment

## Purpose & scope
How Hublet is actually deployed today — not a generic guide, but the real topology, the real build steps, and every environment variable actually in use. See [ARCHITECTURE.md](./ARCHITECTURE.md) for how these pieces fit together conceptually.

## Topology
- **Frontend** (`src/frontend/`) — deployed to **Vercel** as a static Vite build (`vite build`, output `dist/`).
- **Backend** (`src/backend/`) — deployed to **Render** as a single Node web service.
- **Database** — **MongoDB Atlas** (free-tier cluster), accessed via Prisma from the backend.
- **Scraper** — not a separately deployed service; it's a Python subprocess the backend spawns on demand (manual trigger or the 6-hourly cron job), using a `.venv` bootstrapped at server startup.

## Backend deploy (Render)

Configuration lives in `render.yaml` at the repo root:

```yaml
buildCommand: |
  npm install --include=dev
  npm run build
  npx prisma db push
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r scraper/requirements.txt
startCommand: npm run start
```

Each build step exists for a specific, previously-broken reason:
- **`npm install --include=dev`** — without `--include=dev`, `npm install` silently skips all devDependencies whenever `NODE_ENV=production` is set (which this service does, for the running process). That includes `typescript` itself, so the next step would fall through to `npx` auto-fetching an arbitrary, far-newer TypeScript version from the registry — which broke the build with a `moduleResolution` error unrelated to anything in this codebase.
- **`npm run build`** — runs `prisma generate && tsc`. Must run explicitly; `npm run start` (`node dist/index.js`) has nothing to execute without it.
- **`npx prisma db push`**, not `prisma migrate deploy` — Prisma's `migrate` commands are not supported against a MongoDB datasource at all (it errors immediately with "provider not supported"). `db push` is the correct MongoDB-compatible way to sync the schema (indexes/collections), with no migration history.

**MongoDB Atlas Network Access**: Render's outbound IPs aren't fixed/published for free-tier services, so Atlas's IP allowlist (Network Access) must include `0.0.0.0/0` ("allow from anywhere") for the backend to reach the database at all — without this, `prisma db push` and every subsequent query fail with a server-selection timeout that looks like a connectivity bug but is actually a firewall rule.

## Frontend deploy (Vercel)
Standard Vite project, no special build configuration needed beyond one environment variable:
- `VITE_API_BASE_URL` — must point at the deployed backend's `/api` path (e.g. `https://hublet.onrender.com/api`). If unset, the frontend defaults to `http://localhost:3000/api` (`src/frontend/src/api/client.ts`), which only works for whoever has a local backend running — every other visitor gets a broken app with no working API calls.

The backend's `CORS_ORIGIN` env var must in turn include the deployed frontend's origin (supports exact matches, comma-separated lists, and `*.domain` glob patterns — see `src/backend/src/index.ts`'s CORS setup) or the browser will block every request with a CORS error regardless of how correct `VITE_API_BASE_URL` is.

This project's Vercel project is **not Git-connected** — it's deployed by running `vercel --prod` from `src/frontend` directly, not by pushing to `main`. Pushing frontend changes to GitHub does **not** redeploy the live site; a fresh `vercel --prod` run is required. `src/frontend/vercel.json` adds a catch-all rewrite (`/(.*)` → `/index.html`) so that direct loads of client-side routes (e.g. `/auth/admin`, `/buyer/:id`) don't 404 against Vercel's static file server — without it, only the root path loads and everything else needs a client-side navigation to have already happened first.

## Environment variables (complete reference)

| Variable | Required? | Purpose |
|---|---|---|
| `DATABASE_URL` | **Required** | MongoDB Atlas connection string (`mongodb+srv://...`) — the schema's provider is MongoDB, not SQLite/Postgres, despite what `.env.example`'s header comment still says |
| `PORT` | Optional (local only) | Local dev server port; Render sets this itself |
| `NODE_ENV` | Required | `production` on Render; affects Prisma log verbosity and a few conditional behaviors |
| `JWT_SECRET` | Required | Signs/verifies auth tokens |
| `JWT_EXPIRES_IN` | Optional | Token lifetime, defaults to `24h` (also accepts a legacy typo'd `JWT_EXPRESS_IN` as a fallback) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Required | The only credentials for admin login — no database record backs the admin account |
| `SUPER_PASSWORD` | Required | Universal fallback password for *any* buyer/seller login — see [KNOWN_ISSUES_AND_DESIGN_DECISIONS.md](./KNOWN_ISSUES_AND_DESIGN_DECISIONS.md) |
| `BASE_URL` | Optional | This backend's own public URL, used in startup logs/utility scripts |
| `CORS_ORIGIN` | Required | Comma-separated allowed frontend origins, supports `*.domain` globs |
| `MONGODB_URI`, `MONGODB_DB_NAME` | Only for the raw-driver migration script | Used exclusively by `src/backend/src/scripts/migrate-to-mongo.ts` via `src/db/mongo.ts` — not the main Prisma connection |
| `APIFY_TOKEN`, `APIFY_TOKEN_FB` | Optional | Apify-backed scrapers (99acres/Magicbricks) and the Facebook-group pipeline |
| `ZENROWS_API_KEY` | Optional | ZenRows-backed 99acres scraper variant |
| `GROQ_API_KEY` (or `_1`/`_2`), `GROQ_BASE_URL`, `GROQ_MODEL` | Optional | LLM extraction for the Facebook-group scraper |
| `EXA_API_KEY` | Optional | Locality market-intelligence enrichment (`locality-intel.service.ts`) — enrichment silently no-ops if absent, doesn't block matching |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `FRONTEND_URL` | Optional | Real match-notification emails; falls back to a console-log mock if `SMTP_USER` is unset |
| `PYTHON_PATH` | Required on Render | Python executable used to spawn the scraper subprocess |
| `SCRAPER` | Optional | Default scraper name for the cron job, falls back to `magicbricks-direct` |
| `VITE_API_BASE_URL` (frontend) | Required for a working deployed frontend | Points the frontend at the deployed backend's API |

## Deploying from scratch (order matters)
1. Create the MongoDB Atlas cluster, add `0.0.0.0/0` to Network Access, get the connection string.
2. Deploy the backend to Render pointing at this repo, root directory `src/backend`, using the build/start commands above; set every "Required" env var from the table.
3. Once the backend is live, note its public URL.
4. Deploy the frontend to Vercel, set `VITE_API_BASE_URL` to `<backend URL>/api`.
5. Once the frontend is live, update the backend's `CORS_ORIGIN` to include the frontend's URL, and redeploy the backend (env var changes on Render require a fresh deploy to take effect — a plain restart does not reliably pick up new values).

## CI/CD
There is no automated build/test/deploy pipeline for the application itself. Render auto-deploys on push to `main` via its own Git integration, reading `render.yaml`. Vercel does **not** — see the Git-connection note above; frontend deploys are a manual `vercel --prod`. `.github/workflows/` does exist, but for unrelated purposes: `snapshot-integrity.yml`/`weekly-snapshot.yml` (course-submission tooling) and `demo-keepalive.yml` (a scheduled `/health` ping every 10 minutes during a specific demo window, added to work around Render's free-tier cold-start after 15 minutes idle — self-limiting via an in-job date check, safe to delete once the demo window has passed). None of these drive an actual deploy.

---
*Last verified against commit `ce81d04`.*
