## Goal
Drivers set their own per-km rates (unlike Yego/Uber fixed tariffs), within guardrails set by the superadmin; the server computes and locks every quote.

**Release track:** Batch 4 — Nearby drivers with their own cars and fares · **Owner module:** `Modules/Pricing`, `Modules/NearbyRides` · `features/nearby-rides`

## Stories
- S2.1 — Driver sets own per-km rates with live preview (wave 1, ✅ built)
- S2.2 — Superadmin configures pricing guardrails & commission (wave 1, ✅ built)
- S2.3 — Server-side fare quote and price lock (wave 1, ✅ built)

## Done when
- [ ] All stories in this epic are closed
- [ ] CI is green and the app builds with EAS

Architecture: `RIDE_HAILING_PLAN.md` · release order: `docs/RELEASE_PLAN.md`
