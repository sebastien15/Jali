## Goal
Finish the architecture migration (runbook M06–M09) so every service plugs into one app: server-side service availability, a customer/provider mode switch that never changes server state, one Activity and Inbox for both personas, provider availability that survives navigation, and a deploy pipeline that works every time.

**Release track:** Shared foundations & connected app · **Owner module:** `core/*`, `Modules/Identity`, `Modules/Notifications`, `Modules/Providers`, CI/deploy

## Stories
- S23.1 — Server-side service availability (M06) (wave 2, ⬜ todo)
- S23.2 — Service registry and gated queries in the app (M06) (wave 3, ⬜ todo)
- S23.3 — Customer/provider mode switch (wave 4, 🟡 partial)
- S23.4 — One Activity for bookings and jobs (M07) (wave 4, ⬜ todo)
- S23.5 — Notification taps open the right screen, always (M07) (wave 2, ⬜ todo)
- S23.6 — In-app inbox (M07) (wave 3, ⬜ todo)
- S23.7 — Provider availability that survives navigation (M08) (wave 1, ⬜ todo)
- S23.8 — Request and polling budget (M08) (wave 4, ⬜ todo)
- S23.9 — Split the shared BookingSheet per service (wave 1, ⬜ todo)
- S23.10 — Provider screens move to shared provider infrastructure (wave 1, 🟡 partial)
- S23.11 — Mobile test harness (wave 1, ⬜ todo)
- S23.12 — Staging rehearsal and recovery (M09) (wave 2, ⬜ todo)

## Done when
- [ ] All stories in this epic are closed
- [ ] CI is green and the app builds with EAS

Architecture: `docs/ARCHITECTURE_MIGRATION_RUNBOOK.md` · release order: `docs/RELEASE_PLAN.md`
