# Jali API contract

`openapi.yaml` is the **source of truth** for the HTTP API between the mobile app
and the backend. `asyncapi.yaml` describes the realtime (WebSocket) events.

Why: several people and AI agents build backend and mobile in parallel, and the
backend may later be rewritten (e.g. in Rust) service by service. As long as an
implementation passes the contract tests, the app doesn't notice the switch.

## Rules
1. Change the contract **in the same PR** as the code that implements it.
2. New operations start with `x-jali-status: planned`; remove it when implemented.
   The backend test fails if a planned operation already exists, or if an
   implemented one is missing.
3. Never remove or rename a response field the app uses; add new ones instead.
4. Every route under the contract prefixes (`/me`, `/driver/profile`, `/driver/rates`,
   `/driver/presence`, `/driver/ride-requests`, `/rides`, `/admin/settings/rides`)
   must be documented.

## Tools
| Command | What it does |
|---|---|
| `cd docs/api && npx @redocly/cli@1 lint openapi.yaml` | Lint the spec |
| `cd backend && php artisan test --filter=ApiContractTest` | Routes ↔ spec and real responses validated against the JSON schemas |
| `cd mobile && npm run api:types` | Regenerate `mobile/lib/apiSchema.ts` (commit the result) |
| `cd mobile && npm run api:mock` | Fake API on http://127.0.0.1:4010 from the examples/schemas (Prism) — build screens before the backend exists |

In mobile code, use the generated types:

```ts
import type { components } from "@/lib/apiSchema";
type NearbyDriver = components["schemas"]["NearbyDriver"];
```

## Switching a backend service later
Point a reverse proxy route (e.g. `/api/rides/nearby`) at the new service, run the
contract tests against it, and keep the Sanctum-compatible bearer token (or move
both implementations to JWT first).
