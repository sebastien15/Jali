# Jali — Project CLAUDE.md

> **Read `context.md` first — it is the authoritative project reference.**
> This file is a TOC only. Detailed docs live in `context.md` and `.claude/skills/`.

## Package Root

```
Jali/
├── mobile/          React Native (Expo SDK 54, Expo Router v6, NativeWind v4)
├── backend/         Laravel 11 REST API (Sanctum, SQLite dev / MySQL prod)
├── context.md       ← FULL reference: routes, auth flow, API, models, guards
└── CLAUDE.md        ← this file (TOC only, ≤60 lines)
```

## Skills Index

| Skill | Stack | File |
|---|---|---|
| React Native patterns & optimization | Mobile | `.claude/skills/stack-mobile.md` |
| UX patterns (skeleton, prefetch, location, auth) | Mobile | `.claude/skills/ux-patterns.md` |
| Laravel patterns & optimization | Backend | `.claude/skills/stack-backend.md` |
| Server, DB, CDN, Redis, scaling | Infra | `.claude/skills/stack-infra.md` |
| Routing conventions | Mobile | `.claude/skills/routing.md` |
| Deployment & hosting URLs | Infra | `.claude/skills/deployment.md` |
| TanStack migration plan | Mobile | `TANSTACK_PLAN.md` |
| Ride-hailing & hire-a-driver plan | Full stack | `RIDE_HAILING_PLAN.md` |
| Ride-hailing user stories (backlog) | Full stack | `docs/ride-hailing/USER_STORIES.md` |
| Multi-agent rules for ride stories | Full stack | `docs/ride-hailing/AI_AGENTS_GUIDE.md` |
| API contract (OpenAPI, source of truth) | Full stack | `docs/api/README.md` |

## Quick Rules

- **Guards**: every new backend route needs `auth:sanctum` + `permission:<x>` — see `context.md` §Guard Requirements
- **Theme colors**: always use `C.xxx` from `constants/theme.ts`, never raw hex
- **API instance**: always import from `lib/api.ts`, never create a new Axios instance
- **API contract**: change `docs/api/openapi.yaml` in the same PR as the endpoint; use types from `lib/apiSchema.ts`
- **Roles**: use `ROLES` from `constants/roles.ts` and `isAdminRole()` helper

## Self-Update Rule

Keep this file ≤ 60 lines. Move any detail into `context.md` or `.claude/skills/`.
