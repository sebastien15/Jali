# Jali — Batch Release & Rollout Migration Plan

> Status: agreed product direction; service readiness and public launch status must be assessed.
> Recorded: 2026-10-06. No fixed release dates or automatic authorization to implement.

## Purpose and scope

Grow one Jali app through complete passenger-transport service batches. Begin with bookings arranged in advance, then introduce shared journeys, and later real-time nearby-driver dispatch. Reuse accounts, provider profiles, bookings, verification, support and other shared foundations.

This is a product rollout/migration plan, not a database migration specification. Existing code for later services should be preserved. Code presence, merged stories and historical checkboxes do not establish production readiness or public availability.

Passenger transport only: car rentals, private drivers, private-car shared journeys, nearby rides, bus ticketing and later passenger fleet services. Courier, parcel delivery, food delivery and unrelated non-transport services are outside this launch plan, even where older backlog documents contain them.

## Initial free-platform policy

- Jali initially charges no platform commission, booking/service fee or subscription.
- Working interpretation: rental owners and drivers still charge their own rental prices and transport fares. Free use of Jali does not promise free cars or journeys. If the owner intends to subsidize those costs too, record a separate funding decision.
- Suggested customer wording: "No Jali fees; rental prices and fares are set by providers."
- Do not introduce platform monetization without an explicit owner-approved decision.
- Provider deposits, overtime and cancellation terms must be clearly explained where applicable; they must not disguise a Jali platform fee.
- Budget for hosting, maps, messaging, verification and support during the zero-revenue platform period.

Before a free launch, audit both saved runtime settings and fee calculation paths. The repository has contained nonzero defaults/calculations in [RideSettings.php](../backend/app/Services/Rides/RideSettings.php) and [serviceFee.ts](../mobile/lib/serviceFee.ts). Validate quotes, booking totals, receipts, provider earnings, commission ledgers and debt-based restrictions. This is a future launch check, not a claim about deployed charges or an instruction to change settings now.

## Agreed release sequence

| Batch | Public service | Minimum complete experience to validate |
|---|---|---|
| 1 | Car rental | Browse real cars; choose dates/duration; see clear prices and terms; request and receive owner confirmation; cancel; arrange handover and return; reach support. Availability must be accurate. |
| 2 | Scheduled private drivers | First, hire a verified driver for the customer's own car: availability, hourly/daily rates, vehicle/transmission compatibility, acceptance, start/end, overtime, cancellation and support. Scheduled car-and-driver packages may follow within this batch when explicitly selected and ready. |
| 3 | Private shared journeys / station seats | Driver publishes route, departure, seats, fares and permitted pickup/drop-off points; passenger requests a seat and receives confirmation; both can see trip details and cancellation rules. Validate capacity for each route segment. |
| 4 | Nearby drivers with their own cars and fares | See genuinely available drivers and their prices; request a ride; receive timely acceptance or a clear timeout/no-driver result; track progress; start/end safely; cancel, rate and obtain support. |
| 5+ | Bus ticketing and further passenger transport services | Reliable operator departures, seat inventory, ticket confirmation, cancellation/support and appropriate operator tools. Further fleet and transport products need their own scoped readiness checks. Their internal order is not yet fixed. |

Car rental is the first intended public batch, subject to a readiness audit. Start in a manageable area or corridor with enough real providers to fulfil bookings.

Bus ticketing may move earlier if a dependable agency is ready, but an AI must not silently reorder the plan: explain the opportunity and obtain or recognize explicit owner approval, then record the decision.

Fleet tools can support rental owners or drivers from earlier batches. A later consumer fleet service is a separate product decision; internal multi-vehicle management does not need to wait for Batch 5.

## What a private shared journey means

Example: a driver is going to Gisenyi and offers three spare seats, with specified pickup and drop-off points along the route. Passengers can book the whole journey or an allowed part of it.

This is a scheduled shared journey/carpool, not automatic pooling of unrelated on-demand city rides. Fleet management means managing multiple vehicles and drivers, and is not the same service.

Capacity must be checked across overlapping route segments. A passenger leaving at stop B can free a seat for B-to-C, but A-to-C bookings still occupy that seat on both segments. Prevent double booking and make the pickup agreement unambiguous.

## Rollout migration workflow — when implementation is authorized

1. Audit the chosen batch against current code, deployed configuration, existing stories and real provider operations. Separate implemented, planned, tested and publicly released status.
2. Define its complete customer/provider journey and any authorized shared prerequisites. Reuse existing work; do not rebuild or rewrite the backlog just to match the release order.
3. Propose the public service boundaries, navigation and configuration for that release. Any gating, fee, API, schema or app changes are separate implementation work requiring task authorization. Preserve existing data and later-service code.
4. Verify the zero-Jali-fee policy, inventory/availability, confirmation, cancellation and support flows. Label manually approved bookings as requests until accepted.
5. Test on real devices and in appropriate store test tracks; prepare accurate listing material, privacy disclosures, reviewer access and working backend services for the released scope.
6. Submit the selected service scope through the normal release/review process. Record what was actually enabled, tested and approved; retain a recovery plan for any eventual production change.
7. Review completed bookings, provider responsiveness, failures, cancellations and support workload before choosing the next batch.

This document does not itself enable or disable services, run database migrations, alter prices, modify stories, submit store builds or deploy the app.

## Readiness gates

Advance based on evidence, not feature count or an invented calendar. Before a public batch launch, validate:

- The full customer and provider flow, including rejected, cancelled, unavailable and interrupted cases.
- Accurate availability/capacity and protection against conflicting bookings.
- Real provider supply, dependable responses and clearly stated confirmation timing.
- Provider verification, applicable operating requirements, customer safety, privacy and account controls.
- Consistent prices and zero Jali fees throughout the customer/provider experience.
- Accessible support, operational ownership, useful error handling and a tested production configuration.
- Device-test evidence and current store requirements for the exact submitted functionality.

No numeric success threshold or launch date has been agreed. Propose these with the owner during the relevant release-readiness review. Security, privacy, data-integrity fixes and authorized shared prerequisites are not postponed merely because they touch a later service.

## Apple App Store and Google Play approach

A focused, complete rental-first submission is a reasonable starting point; approval is not guaranteed. Apple requires a functional submission, accurate metadata and reviewer access to a working backend. Describe new services in later reviewed updates; do not conceal functionality from reviewers. Free pricing does not replace completeness or privacy obligations. See [Apple's review guidelines](https://developer.apple.com/app-store/review/guidelines/).

Prepare Android testing alongside iPhone testing rather than assuming Play approval is easier. For personal Play developer accounts created after November 13, 2023, the current requirement is a closed test with at least 12 testers continuously opted in for 14 days before applying for production access. See [Google's testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

Use [store_requirements.md](../store_requirements.md) as an existing working checklist, not proof of compliance. Recheck its claims, completion markers and the official policies before each submission. Policy references above were checked on 2026-10-06.

## AI guardrails and owner-approved deviations

Every agent must read this plan before work affecting public service scope, release sequencing or platform pricing.

1. Identify whether the requested work belongs to a batch, an authorized shared prerequisite, or an exception.
2. If it changes the order, introduces Jali fees, expands beyond passenger transport, or materially changes service scope, point to the relevant section and explain the deviation and its implications.
3. Honor a clear owner-approved change; do not repeatedly request approval already given. Ask only when the intended material change is ambiguous. The plan is a baseline to help the owner decide, not a prohibition on changing direction.
4. When documentation changes are authorized, record the revised decision here, including the date, scope and rationale. Do not silently rewrite the baseline.
5. Stay within the current task. This plan is not standing authorization to implement later batches, deploy, launch services, change settings or edit/close/reprioritize backlog issues.

The dependency waves in the ride backlog describe implementation dependencies, not public service release order. Both the task authorization and this rollout plan apply. Architecture, API and security conventions remain governed by the existing project references.

## Related project references

- [Project context](../context.md) — technical reference and guards.
- [CLAUDE.md](../CLAUDE.md) and [AGENTS.md](../AGENTS.md) — AI entry points.
- [Ride-hailing architecture](../RIDE_HAILING_PLAN.md) — existing technical plan; verify against current code.
- [Ride user stories](ride-hailing/USER_STORIES.md) — existing backlog; not a launch authorization.
- [Multi-agent guide](ride-hailing/AI_AGENTS_GUIDE.md) — coordination and implementation conventions.
- [API contract](api/README.md) — shared API source of truth.

## Decision log

| Date | Decision |
|---|---|
| 2026-10-06 | Owner approved recording the batch-release direction: rental → scheduled private drivers → private shared journeys → nearby own-car drivers → further passenger transport. Initial platform access has zero Jali fees. Service readiness and launch dates remain to be assessed; this change is documentation only. |
