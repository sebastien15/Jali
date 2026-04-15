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

| Skill | File |
|---|---|
| Deployment & hosting | `.claude/skills/deployment.md` |
| Routing conventions | `.claude/skills/routing.md` |

## Quick Rules

- **Guards**: every new backend route needs `auth:sanctum` + `permission:<x>` — see `context.md` §Guard Requirements
- **Theme colors**: always use `C.xxx` from `constants/theme.ts`, never raw hex
- **API instance**: always import from `lib/api.ts`, never create a new Axios instance
- **Roles**: use `ROLES` from `constants/roles.ts` and `isAdminRole()` helper

## Self-Update Rule

Keep this file ≤ 60 lines. Move any detail into `context.md` or `.claude/skills/`.
