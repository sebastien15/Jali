# Deployment & Hosting

## Production Server

- Host: `https://jali.stoka.rw` (LiteSpeed Web Server)
- Backend deployed at: `/backend/` subdirectory on the server
- **Current API base URL**: `https://jali.stoka.rw/backend/public/api`

## Known Issue — Webserver Root

The LiteSpeed document root currently points to the project root instead of `backend/public/`.
This means:
- Source code (`routes/`, `app/`, `config/`) is **publicly browsable** — security risk
- The URL is ugly (`/backend/public/api` instead of `/api`)

**Fix**: Change LiteSpeed virtual host document root to `backend/public/`.
After fix, update `mobile/.env.production` and `mobile/lib/api.ts` PROD_URL to `https://jali.stoka.rw/api`.

## Mobile Env Files

| File | APP_ENV | API URL |
|---|---|---|
| `mobile/.env` | `dev` | `
/api` |
| `mobile/.env.production` | `prod` | `https://jali.stoka.rw/backend/public/api` |
| `mobile/lib/api.ts` PROD_URL fallback | — | `https://jali.stoka.rw/backend/public/api` |

## Backend Stack (Production)

- PHP/Laravel 11 via LiteSpeed
- Firebase credentials: `backend/storage/app/firebase-credentials.json`
- Database: MySQL in prod (set via `.env` `DB_CONNECTION`)
