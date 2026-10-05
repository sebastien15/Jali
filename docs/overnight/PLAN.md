# Jali — Overnight Production-Readiness Plan

Branch: `overnight-fixes` (local only, nothing pushed). One commit per fix, descriptive messages.
Local env: PHP 8.2 (XAMPP) + SQLite, Node 22. No Docker.

## Roles

| Role | Job | Output |
|---|---|---|
| Architect | Map every user story per role (user, driver, admin, superadmin), map mobile screen → API → controller → model, spot design gaps | `docs/overnight/USER_STORIES.md` |
| Tester | Rebuild backend test suite around user stories; typecheck + run mobile in web mode against local API; log every defect | `backend/tests/Feature/*`, `docs/overnight/DEFECTS.md` |
| Developer | Fix defects one by one, severity order, each with its own commit + a test proving it | commits on `overnight-fixes` |

## Phases

1. **Setup** — deps, SQLite, migrations, seeders, baseline tests. *(done)*
2. **Understand** — architect maps user stories; backend + mobile audits run in parallel (read-only).
3. **Test baseline** — replace stale tests with user-story feature tests; mobile `tsc --noEmit`.
4. **Fix loop** — Critical → High → Medium. Security & money bugs first. Re-run full suite after each fix.
5. **E2E check** — run API + Expo web, click through main flows per role, screenshot breakage.
6. **Release checklist** — what only the owner can do (keys, PHP 8.3+ server, store accounts, real-device test).
7. **Morning report** — `docs/overnight/REPORT.md`.

## Severity

- **Critical** — security hole, data loss, money wrong, app crash on main flow
- **High** — user story broken
- **Medium** — wrong edge-case behaviour, bad validation, i18n gaps
- **Low** — polish (logged, fixed only if time)
