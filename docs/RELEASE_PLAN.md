# Jali — Batch Release, Architecture & Rollout Migration Plan

> Status: agreed product and architectural direction; service readiness and public launch status must be assessed.
> Recorded and updated: 2026-10-06. No fixed release dates or automatic authorization to implement.
> Detailed design examples and future extraction criteria below are proposed guidance, not a finalized screen specification or proof of implementation.

## Purpose and scope

Grow one connected Jali app through complete transport-service batches. Begin with bookings arranged in advance, then introduce shared journeys, and later real-time nearby-driver dispatch. Reuse accounts, provider profiles, verification, support and other shared foundations without forcing every service into the same booking model.

This is a product and architecture rollout/migration plan, not a database migration specification. Existing code for later services should be preserved. Code presence, merged stories and historical checkboxes do not establish production readiness or public availability. The target architecture and UX described here require their own implementation audits and authorized tasks.

The original passenger scope covers car rentals, private drivers, private-car shared journeys, nearby rides, bus ticketing and later passenger fleet services. The owner subsequently added **cargo/freight as a distinct transport service**, including goods-vehicle booking and return-load opportunities. Its public batch is not yet assigned. Courier/parcel delivery, food delivery and unrelated non-transport services remain outside this plan; cargo does not silently activate those older backlog products.

## Initial free-platform policy

- Jali initially charges no platform commission, booking/service fee or subscription.
- Working interpretation: rental owners, drivers and freight carriers still charge their own rental prices, passenger fares and cargo quotes. Free use of Jali does not promise free cars, journeys or freight transport. If the owner intends to subsidize those costs too, record a separate funding decision.
- Suggested customer wording: "No Jali fees; transport prices are set by providers."
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
| Unassigned / TBD | Cargo / freight | A separately scoped goods-transport service with clear vehicle/load requirements, carrier quotes, confirmation, pickup and delivery evidence, cancellation and support. Return-load matching needs its own availability and route checks. This row does not assign a launch position or reorder Batches 1–4. |

Car rental is the first intended public batch, subject to a readiness audit. Start in a manageable area or corridor with enough real providers to fulfil bookings.

Bus ticketing may move earlier if a dependable agency is ready, but an AI must not silently reorder the plan: explain the opportunity and obtain or recognize explicit owner approval, then record the decision. The same rule applies when choosing cargo's eventual launch position.

Fleet tools can support rental owners, drivers or freight carriers from earlier batches. A later consumer fleet service is a separate product decision; internal multi-vehicle management does not need to wait for Batch 5.

## What a private shared journey means

Example: a driver is going to Gisenyi and offers three spare seats, with specified pickup and drop-off points along the route. Passengers can book the whole journey or an allowed part of it.

This is a scheduled shared journey/carpool, not automatic pooling of unrelated on-demand city rides. Fleet management means managing multiple vehicles and drivers, and is not the same service.

Capacity must be checked across overlapping route segments. A passenger leaving at stop B can free a seat for B-to-C, but A-to-C bookings still occupy that seat on both segments. Prevent double booking and make the pickup agreement unambiguous.

## Cargo as a separate service

The owner described booking goods-carrying vehicles, such as the utility trucks commonly used locally, with clearer fares and availability. Another use case is a vehicle carrying goods from Kabarondo to Kigali and returning empty: a compatible Kigali-to-Kabarondo load could use that return journey.

Cargo belongs to the transport platform but is not a passenger-seat booking or a parcel-courier product. Its service-owned workflow must accommodate load capacity and handling rather than reuse passenger seat counts.

Proposed scope to refine before selecting its batch:

- Dedicated vehicle/carrier booking with a clear quote and terms before confirmation.
- Load description, weight/dimensions or usable capacity, pickup/drop-off locations, time windows and relevant handling needs.
- Return-load listings or matching where direction, capacity, timing and permitted detours are compatible. A match is an opportunity, not a guaranteed carrier acceptance or discounted fare.
- Carrier/vehicle verification, pickup and delivery evidence, cancellation, support and clearly allocated responsibility for damaged or missing goods. Assess applicable operating, insurance and safety requirements before launch.
- Whole-vehicle jobs and return-load matching can be scoped separately. Multi-shipper consolidated loads, parcel networks and automatic dynamic pricing are not implicitly approved.

Adding cargo records an explicit owner-approved scope expansion; it does not establish readiness, choose its launch slot or authorize implementation.

## Architecture direction — modular now, selective extraction later

Use a **modular monolith backend and a modular frontend in the same Jali mobile app** as the initial direction. Service batches are product rollout boundaries; they do not require one deployed microservice or one installed app per service.

### Backend boundaries

Keep the existing Laravel backend initially, with explicit domain ownership for rental, scheduled driver hire, private shared journeys, nearby rides, bus ticketing and cargo. Share identity, authorization, notification delivery and other genuine foundations through defined contracts.

Proposed implementation guidance:

- Each domain owns its business rules, booking/job lifecycle, availability, pricing rules and data writes. Shared activity summaries or notification envelopes do not require one universal booking table or state machine.
- An initial shared database is compatible with this direction. Define logical ownership and controlled cross-module interfaces; do not let unrelated modules freely modify each other's records.
- Preserve the documented OpenAPI contract, security conventions and compatibility for existing clients. Architecture work is not a mandate to rewrite Laravel or discard existing features.
- Existing service folders are a starting point to audit, not proof that all domain boundaries, contracts or tests already exist.

### Modular frontend

Keep one Expo/React Native app with a shared shell and service-owned feature modules. Thin route entry files connect navigation to feature screens; each feature can own its screens, API access, hooks and tests, while common UI, authentication, localization and contract types stay shared.

Folder/module separation improves ownership and targeted testing. It does **not** by itself create independent native releases, automatic bundle splitting, operational isolation or a separately downloadable service. Native app changes still follow the applicable build and store-review workflow.

Separate customer, provider or operator apps may become worthwhile if their workflows, ownership or release needs justify them. That is a later product decision, not a prerequisite for cargo, more users or a modular backend. Multiple clients can use the same backend contracts.

### Growth and cloud deployment

User growth principally increases shared backend/API work; the native interface runs on each user's device. Frontend performance still matters because unnecessary requests, location updates and polling increase both device and backend load. Web/operator interfaces also need their own hosting and performance assessment.

Proposed scaling progression:

1. Measure latency, error rates, database queries, queue delay, device performance and operational load for the released services.
2. Optimize queries/indexes, caching, request volume and background processing where evidence shows a need.
3. Prepare appropriate stateless API instances, durable shared state/storage and independently scalable background workers; validate bottlenecks with representative load tests.
4. Extract a domain or workload only when measured scaling, reliability, security, deployment independence or team ownership benefits justify the additional complexity.

Possible future extraction candidates include presence/matching, notification delivery or a busy service domain; none is a committed microservice. Before extraction, define data ownership, API/event contracts, retries, idempotency, observability and failure handling. More users alone do not imply a service per vehicle category.

No cloud vendor, Kubernetes requirement, extraction date or supported user-count claim is agreed here.

## Unified account, modes and shared UX

The app should feel like one connected product across customer and provider use. A person can book transport and also provide one or more approved services through the same account.

Keep these concepts separate:

| Concept | Meaning and boundary |
|---|---|
| Account identity | The same authenticated person, profile and account history across modes. |
| Capabilities / permissions | Server-authorized actions, based on the relevant permissions, eligibility and verification. A UI switch never grants these. |
| Active persona / view mode | The customer-facing or provider-facing workspace currently being viewed. It changes presentation, not identity or permission. |
| Selected service | Rental, driver hire, shared journey, nearby ride, bus or cargo context. Selection is not authorization or operational availability. |
| Provider offered services | The services the person has deliberately configured and is approved to supply. Browsing another mode/service must not overwrite this configuration. |
| Operational availability | Service-specific commitments: dispatch online/offline status, rental calendars, scheduled driver availability or published departure/load capacity. It is not one universal driver toggle. |

Use a visible mode switch once the person has the relevant capability. "Book transport" / "Offer services" are illustrative labels; retain suitable current labels until the detailed UX is agreed. Becoming a provider still needs the appropriate onboarding and approval.

Switching to customer mode must not silently turn a provider offline, cancel work, lose an active booking or remove offered services. Going online/offline is a separate explicit control for services that use dispatch. Proposed UX: keep an active-job/booking indicator visible across modes, and explain any business-rule conflict before accepting incompatible work.

### Shared pages and routing

Keep one shared account/settings/support experience and canonical routes for genuinely shared pages. Do not duplicate settings and notification screens merely because the customer/provider views differ. Service workflows can have their own routes and details; shared routing does not mean identical screens for every service.

Proposed shared-surface contract:

- Account/profile, language, privacy, security and support remain shared.
- Provider-only settings appear when the account is eligible and the corresponding service is released; they do not create a second account-settings system.
- Activity can summarize customer bookings and provider jobs with clear service, role and status labels, then open the appropriate service-owned details.
- A common inbox can provide customer/provider/service filters. Notification preferences should distinguish booking/job updates, provider earnings, safety and optional marketing where applicable.
- Notification destinations must resolve the correct entity and service context, respect account ownership and capabilities, and work after a cold start. Do not rely only on whichever mode happens to be active.
- Mode changes do not mute active work. Respect device notification permission and user preferences; important status information must remain accessible in-app even when push notifications are disabled.

**Home · Activity · Inbox · Account is an illustrative navigation proposal, not an approved tab rename or redesign.** Agree the exact shared shell before implementation. Preserve familiar core destinations, positions and routes once established; avoid adding a new primary tab for every service.

## Additive releases without a disconnected app

The agreed intent is stable shared navigation and an additive experience as batches arrive, not a complete redesign with each release.

Proposed release UX guidance:

- Add ready services within the established Home/service selection surface. Preserve account history, shared settings and existing booking access.
- Keep shared visual patterns, headers, buttons, terminology and error/loading states consistent. Service-specific forms, prices and job states belong to their modules.
- Show services only where they are released and available for that account, region and supported app version. Avoid large collections of inactive placeholders.
- Introduce a new service with a small contextual notice if useful; do not reset account onboarding or preferences simply because another batch or mode exists.
- Keep permissions, provider eligibility and release availability separate. Proposed availability controls must apply to backend requests as well as navigation; hiding a card is not authorization.
- If a service stops taking new work, deliberately preserve access to existing bookings, active jobs, history and support.
- Keep compatible APIs for supported older app versions and define a safe update requirement only when necessary. Service flags must not conceal unreviewed functionality from store reviewers.

Do not fetch every service's data merely because its module exists. As authorized work, audit Home and shared-shell queries, deliberate prefetching, cache keys, list pagination, screen/app lifecycle and location/polling needs. Fetch active/eligible service data as needed; continue essential active-job processing even when its screen is not visible. A module boundary or hidden screen alone does not reduce request traffic.

## Rollout migration workflow — when implementation is authorized

1. Audit the chosen batch against current code, deployed configuration, existing stories and real provider operations. Separate implemented, planned, tested and publicly released status.
2. Define its complete customer/provider journey and any authorized shared prerequisites. Reuse existing work; do not rebuild or rewrite the backlog just to match the release order.
3. Agree the service boundary, shared-shell behavior and public availability for that release. Apply the modular direction incrementally with contract/regression tests; preserve data, existing routes and later-service code. Any gating, fee, API, schema, app or infrastructure changes are separate implementation work requiring task authorization.
4. Verify the zero-Jali-fee policy, inventory/availability, confirmation, cancellation and support flows. Label manually approved bookings as requests until accepted. Test account/mode/service transitions and shared notification destinations where relevant.
5. Test on real devices and in appropriate store test tracks; prepare accurate listing material, privacy disclosures, reviewer access and working backend services for the released scope.
6. Submit the selected service scope through the normal release/review process. Record what was actually enabled, tested and approved; retain a recovery plan for any eventual production change.
7. Review completed bookings/jobs, provider responsiveness, failures, cancellations, support workload and performance before choosing the next batch or proposing service extraction.

This document does not itself enable or disable services, run database migrations, alter prices, modify stories, provision infrastructure, submit store builds or deploy the app.

## Readiness gates

Advance based on evidence, not feature count or an invented calendar. Before a public batch launch, validate:

- The full customer and provider flow, including rejected, cancelled, unavailable and interrupted cases.
- Accurate availability/capacity and protection against conflicting bookings.
- Real provider supply, dependable responses and clearly stated confirmation timing.
- Provider verification, applicable operating requirements, customer safety, privacy and account controls.
- Consistent prices and zero Jali fees throughout the customer/provider experience.
- Accessible support, operational ownership, useful error handling and a tested production configuration.
- Device-test evidence and current store requirements for the exact submitted functionality.
- Relevant shared-mode transitions, permissions, notification destinations, older-client compatibility and measured performance under representative load.

No numeric success threshold or launch date has been agreed. Propose these with the owner during the relevant release-readiness review. Security, privacy, data-integrity fixes and authorized shared prerequisites are not postponed merely because they touch a later service.

## Apple App Store and Google Play approach

A focused, complete rental-first submission is a reasonable starting point; approval is not guaranteed. Apple requires a functional submission, accurate metadata and reviewer access to a working backend. Describe new services in later reviewed updates; do not conceal functionality from reviewers. Free pricing does not replace completeness or privacy obligations. See [Apple's review guidelines](https://developer.apple.com/app-store/review/guidelines/).

Prepare Android testing alongside iPhone testing rather than assuming Play approval is easier. For personal Play developer accounts created after November 13, 2023, the current requirement is a closed test with at least 12 testers continuously opted in for 14 days before applying for production access. See [Google's testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

Use [store_requirements.md](../store_requirements.md) as an existing working checklist, not proof of compliance. Recheck its claims, completion markers and the official policies before each submission. Policy references above were checked on 2026-10-06.

## AI guardrails and owner-approved deviations

Every agent must read this plan before work affecting public service scope, release sequencing, platform pricing, architectural boundaries or shared account/navigation/mode behavior.

1. Identify whether the requested work belongs to a batch, an authorized shared prerequisite, or an exception.
2. If it changes the order, introduces Jali fees, expands beyond the approved passenger-and-cargo scope, or materially changes the modular direction or shared UX, point to the relevant section and explain the deviation and its implications. Separately flag substantial service-scope changes. Cargo itself is already an owner-approved addition; its launch position remains open.
3. Honor a clear owner-approved change; do not repeatedly request approval already given. Ask only when the intended material change is ambiguous. The plan is a baseline to help the owner decide, not a prohibition on changing direction.
4. When documentation changes are authorized, record the revised decision here, including the date, scope and rationale. Preserve earlier decisions as history rather than silently rewriting them.
5. Stay within the current task. This plan is not standing authorization to implement later batches, redesign screens, activate services, provision infrastructure, deploy, change settings or edit/close/reprioritize backlog issues.

The dependency waves in the ride backlog describe implementation dependencies, not public service release order. Both task authorization and this plan apply. Existing project references continue to govern current code conventions, APIs and security; this document records the target product/architecture/UX direction and is not a claim that older technical plans or existing code already implement it.

## Related project references

- [Architecture migration runbook](ARCHITECTURE_MIGRATION_RUNBOOK.md) — code-audited execution tasks, compatibility, verification and recovery; separate from this governing policy.
- [Project context](../context.md) — technical reference and guards.
- [CLAUDE.md](../CLAUDE.md) and [AGENTS.md](../AGENTS.md) — AI entry points.
- [Ride-hailing architecture](../RIDE_HAILING_PLAN.md) — existing technical plan; verify against current code.
- [Product backlog](ride-hailing/USER_STORIES.md) — epics and stories grouped by the release tracks below; not a launch authorization.
- [Multi-agent guide](ride-hailing/AI_AGENTS_GUIDE.md) — coordination and implementation conventions.
- [API contract](api/README.md) — shared API source of truth.

## Decision log

| Date | Decision |
|---|---|
| 2026-10-06 | Owner approved recording the batch-release direction: rental → scheduled private drivers → private shared journeys → nearby own-car drivers → further passenger transport. Initial platform access has zero Jali fees. Service readiness and launch dates remain to be assessed; this change is documentation only. |
| 2026-10-06 | Owner subsequently added cargo/freight as its own transport service, with goods-vehicle booking and empty-return/return-load opportunities. This expands the original passenger-only scope; cargo's launch batch is TBD, and courier/parcel and food delivery remain excluded. |
| 2026-10-06 | Owner approved extending this same plan with the discussed architecture direction: modular Laravel backend and modular Expo frontend initially, shared foundations, cloud-ready incremental scaling and selective future extraction when justified. No mandatory microservice per service or separate app per batch. |
| 2026-10-06 | Owner approved documenting a connected customer/provider experience: one account, shared pages/routes, distinct permissions/view mode/service configuration/availability, and stable additive releases. Navigation labels and detailed UX examples remain proposals to finalize before implementation. |
| 2026-10-06 | Owner asked to align the backlog with this plan and the completed architecture migration. Stories are now grouped by release track (shared foundations, Batches 1–5+, cargo TBD, later, deferred, out of scope) with build status and owner module. Added epics E23 connected app & modular architecture (M06–M09), E24 car rental, E25 shared journeys, E26 bus ticketing, E27 cargo, E28 release readiness, plus S6.5–S6.6, S7.4 zero Jali fees and S21.13 deploy fix. Fee stories note the zero-fee policy; wallet, promo, referral, tipping, split fare, subscription, loyalty and family-wallet stories are deferred pending an owner decision; package delivery (E20) is out of scope. Existing story IDs and issue numbers are kept; GitHub issues are not changed by this entry. |
