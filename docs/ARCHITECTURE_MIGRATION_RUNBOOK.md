# Jali — Architecture Migration Runbook

> Governing policy: [RELEASE_PLAN.md](RELEASE_PLAN.md). This runbook implements that direction; it does not change release order, fees, cargo's TBD batch or the unapproved navigation examples.
> Prepared: 2026-10-06. Source audit: [commit ea4f9b13cadf423f0b2235b9927f3ad94190a583](https://github.com/sebastien15/Jali/tree/ea4f9b13cadf423f0b2235b9927f3ad94190a583), on the documentation branch targeting `develop`.
> Status: execution specification, not an implementation report. Migration tasks below are not started by this documentation change. No application tests, production inspection, data migration, infrastructure provisioning or deployment were performed.
> Re-audit drift before execution. Repository code/configuration is not evidence of deployed behavior or launch readiness.

## 1. Scope, authority and completion

Read [AGENTS.md](../AGENTS.md), [context.md](../context.md), [CLAUDE.md](../CLAUDE.md), the governing plan and task-relevant project guides before implementing. Honor current task authorization and existing user changes.

Select and record the execution scope before coding:

| Scope | Includes | Does not imply |
|---|---|---|
| A — structural migration | Modularize existing backend and mobile functionality; preserve URLs, data, models, API behavior and compatible facades; add meaningful regression/boundary tests. M00–M04. | New service functionality, public service activation or a new tab design. |
| B — connected-app foundations | Unified session and pure customer/provider view state; service access controls; shared activity/notification coordination; approved shared pages; lifecycle/performance checks. M05–M08 after their dependencies and decisions. | Free rides, automatic provider approval, background tracking or an implemented cargo service. |
| C — service completion | Separately selected release-batch features: rental reservations, segment seats, cargo workflows and other missing capabilities. | Every backlog story or all services launching together. |
| D — operational rollout | Separately authorized staging/production changes, schema/configuration application and release activation; measured cloud growth or later extraction. M09 and explicit operational tasks. | Permission from a code PR to merge to production, dispatch deployment or submit stores. |

An instruction to “finish the migration” must name A, A+B, or selected additional work. Do not silently interpret it as all future services or microservices. Complete the selected scope against evidence, not folder count. Pending product choices must be recorded explicitly; they need not stop unrelated structural tasks.

Do not edit the policy to resolve an implementation inconvenience. Explain a material deviation and obtain or recognize owner approval. Do not change or close backlog issues, take a story, message another chat, provision infrastructure or deploy solely because this runbook names a task.

## 2. Baseline audit and known migration risks

The audit covered the recursive repository tree and selected routes, controllers, models, domain services, layouts, session/query/push/presence code, manifests, tests and workflows. It was not a line-by-line review of every file. Admin agency/trip internals, production schemas/configuration, external integrations and real operations must be checked before changing them.

### Confirmed code seams

| Existing source | Observed seam | Required treatment |
|---|---|---|
| `backend/app/Http/Controllers/BookingController.php` | One dispatcher handles `bus/private/rental/trip`; driver-role history differs from customer history. With no owned rental/private listings, the driver query has no inner ownership conditions. | Add ownership regression tests, including a zero-listing driver. Never preserve unintended exposure as “compatibility.” Introduce separate customer/provider projections without trusting a client persona. |
| Same controller; `backend/app/Models/Booking.php` | Client supplies `price/service_fee`; reference lookup depends on missing title. It writes `trip_departure_id`, absent from the model's fillable list. No date/segment inventory reservation is shown in this path. | Structural extraction does not fix booking correctness. Record separate authorized price/reference, departure and reservation tasks; do not declare rental/seat booking launch-ready. |
| `CarRentalController.php`; `CarRental.php`; `Vehicle.php` | Rental catalogue and active driver vehicles are different resources. Rental update accepts status/notes not represented in the reviewed rental model/schema. | Keep separate IDs/tables and response mappings; verify persistence before any available/rented/maintenance claim. Do not merge cars by plate. |
| `Services/Hire/*`; `Services/Rides/*` | Hire imports ride settings/rating and nearby-driver display helpers; safety also uses nearby display. | Extract shared pricing-policy/provider-reputation/display contracts before severing domain imports. |
| `mobile/lib/DriverModeContext.tsx` | `setDriverType` PATCHes a one-element offered-services array; selection and provider configuration are coupled. | Make selection view-only; deliberate offered-service edits preserve the full intended set and report server errors. |
| `mobile/app/(tabs)/_layout.tsx`; `app/driver/setup.tsx` | Mode provider and push coordination are tab-scoped, but standalone driver setup consumes that context. | Root-scope authenticated coordination and test direct/cold links, without moving route files or merging admin navigation. |
| `mobile/app/_layout.tsx`; `lib/api.ts`; profile/admin logout | Query persistence is global. Customer teardown does not purge all private query state; 401 clears stored token but not the in-memory token. | One account-isolated session teardown must cover logout, 401, deletion, account change and late responses. |
| `drive.tsx`; `useDriverPresence.ts`; `ActiveRideBanner.tsx` | Header availability is duplicated; heartbeat lifetime is tied to Drive mounting; driver recovery uses a customer permission gate. | Coordinate real availability independently of visual mode; prove active-work recovery and lifecycle behavior. |
| `lib/usePushPermission.ts`; profile screen | Live tap routing exists; cold-start/login intent handling and durable inbox are not demonstrated. Notification menu is a no-op. | Preserve legacy payloads; build shared resolver first. New inbox/preferences need their own contracts and tests. |
| `backend/app/Http/Controllers/AuthController.php` | Email login permits token issuance after failed password verification when the account has no password. | Record an explicit security prerequisite with invalid/null-password regression tests. Do not enshrine this behavior in compatibility tests or treat this document as a fix. |
| `backend/app/Models/User.php`; role seeder | Single `role_id`; driver has ride/hire customer permission but not all legacy booking permissions; model has no hidden-field exclusions. | Audit customer access for providers and raw-model serialization. Preserve role schema initially; no UI-controlled role changes or broad production reseeding. |
| `BookingTest/BusTest/DriverTest/TicketTest.php`; mobile manifest | Several legacy tests are homepage smoke tests; no mobile unit/E2E harness was found. | Add successful/negative migration tests before movement; a file named “Test” is not lifecycle coverage. |

Admin booking/location/station scoping and analytics also require negative ownership tests before their adapters change. Existing code uses both location-based and legacy station/trip-derived scope; do not expand an admin's access during extraction.

### References that conflict or may be stale

- `.claude/skills/stack-mobile.md` favors query gating; `ux-patterns.md` favors parallel visible-tab prefetch. Apply the governing release policy: only released/eligible service queries, with deliberate bounded prefetch of accessible services. Do not modify those guides in this task.
- Context/backend guides prescribe protected non-auth routes, while current routing contains public catalogues and tokenized share endpoints. Preserve audited existing access during structural steps; new restricted APIs require authentication, permissions and ownership checks. Any public-access change needs an explicit contract/security decision.
- Context contains older technical descriptions; for example current OTP code is more developed than its historical TODO. Verify against the pinned code, not completion markers.
- Infrastructure user-count thresholds/vendor suggestions are not load-test evidence or a committed cloud plan. Deployment guide host/document-root claims are historical, not a new live security assessment.

## 3. Target layout and ownership

The paths below are the runbook's technical target, not directories claimed to exist. Use existing Composer `App\\ => app/` and mobile `@/*` configuration; do not introduce a framework rewrite.

```text
backend/app/Modules/<Owner>/
  Application/       use cases, business rules and domain-owned queries
  Contracts/         narrow interfaces and immutable input/result types
  Infrastructure/    existing-DB, external-service and compatibility adapters

mobile/features/<service>/
  screens/           service screens, outside Expo's route discovery tree
  components/
  hooks/
  api/
  index.ts           public feature exports

mobile/core/
  session/           identity, capabilities, view preferences, teardown
  service-catalog/   release/access descriptors and navigation choices
  navigation/        shared screens, route registry, composition roots
  notifications/     notification coordination and shared surfaces

mobile/app/**         existing route files/layouts retained as thin wrappers
mobile/lib/**         stable shared infrastructure/compatibility facades first
backend/app/Models/** existing model namespaces/tables retained first
```

Create only folders/classes justified by the current task. A reserved Cargo boundary does not require empty executable files, a tab, a fake API or a placeholder release.

### Backend current → owner map

Paths below are relative to `backend/`; current controllers remain transport adapters initially.

| Target owner | Existing sources to extract/adapt | Contracts to preserve |
|---|---|---|
| `Rentals` | `CarRentalController`, `CarRental`, rental branch of `BookingController` | `/car-rentals`, `/driver/cars/**`, rental generic booking; `price` ↔ `priceDay`. |
| `DriverHire` | `HireController`, `DriverHireController`, `DriverHireSettingsController`; `Services/Hire/{HireService,HireQuote,HireAvailability,HirePresenter}`; hire models | `/driver-hire/**`, `/driver/hires`, `/driver/hire-settings`, `/driver/availability`; current states, locked quotes and time handling. |
| `SharedJourneys` | `PrivateSeatController`, `PrivateSeat`, private booking branch, private driver stats/trips queries | `/private-seats`, `/driver/listings/**`, `/driver/stats`, `/driver/trips`; no implicit intermediate-stop implementation. |
| `NearbyRides` | Ride/presence/rates/customer/driver/admin controllers; ride/fare/search/dispatch/presenter services and ride models | `/rides/**`, `/driver/presence`, `/driver/rates`, `/driver/ride-requests`, admin ride operations; existing state/event/PIN/privacy rules. |
| `Bus` | Bus/trip-search, agency/trip/station/ticket operations; `Bus`, `AgencyRoute`, `TripDeparture`, legacy `Trip`; bus/trip booking branches | `/buses`, `/trips`, `/stations`, ratings, tickets and operator routes. Audit individual admin operations before moving. |
| `Identity` | Auth/current-user, `User/Role/Permission`, middleware | Existing login/token APIs; `/me.roles` string and `permissions[]`; existing `role_id`. |
| `Providers` / `Fleet` | Profile/onboarding/verification/documents, `DriverProfile/DriverDocument`, `VehicleController/Vehicle`, eligibility/onboarding/rating helpers | Full offered-services set, verification state, authenticated private document access, `/driver/vehicles/**`; distinct from rental cars. |
| `Payments` | `Services/Payments/DriverLedger`, earnings/settlement/payout/cashout controllers/models | Shared ledger and monetary invariants; no rewriting historical earnings, fees or debts. |
| `Notifications` / `Safety` / `Locations` | Push/token/SMS adapters; safety actions; reusable geo/place/display dependencies | Existing `screen,id` payloads, lazy push binding, ride-specific safety ownership, approved document/location privacy. |
| `LegacyBookings` | Generic booking/admin booking/analytics adapters over `Booking` | One temporary writer/orchestrator for generic `bookings`; service-owned handlers for each type's rules. Do not merge Ride/Hire/Cargo into this table. |
| `ServiceAccess` | New shared policy adapter over existing settings, permissions and eligibility | New intake/discovery controls, separate from access to owned historical/active work. |
| `Cargo` | No cargo implementation identified in audited tree/routes | Reserved ownership only. Design/build is Scope C; launch batch TBD. |

Do not move entire `Services/Rides` into NearbyRides blindly. Provider eligibility/reputation, pricing settings used by hire, generic display, geography and money are shared seams. Ride-specific fare/state/dispatch logic remains domain-owned.

### Frontend current → target map

Paths are relative to `mobile/`. Extract one feature at a time; current route URLs and query parameters remain stable.

| Existing files/branches | Target |
|---|---|
| `app/(tabs)/index.tsx`, shared search/mode header | `core/navigation/screens/HomeScreen.tsx`; compose feature exports and service catalogue, not one giant shared data hook. |
| `app/(tabs)/drive.tsx`, shared driver header/summary | `core/navigation/screens/ProviderDashboardScreen.tsx`; feature-owned job/cards and shared provider context. |
| `app/(tabs)/trips.tsx` | `core/navigation/screens/ActivityScreen.tsx`; compose generic bookings, ride/hire histories and explicitly scoped provider views. |
| `app/(tabs)/profile.tsx`; `lib/DriverModeContext.tsx`, `ProtectedRoute.tsx` | Shared account/session screen and compatibility adapters in `core/session`. |
| `RentalResults`, `RentalCard`, rental booking-sheet branch, `app/driver/fleet.tsx`, rental driver action branch | `features/rentals`. |
| `app/hire/**`, `app/driver/hire/[id].tsx`, `hire-settings.tsx`, `HireRequestsCard/HireHistory/HireDriverBar`, `lib/hire.ts` | `features/driver-hire`. |
| `PrivateResults/PrivateCard`, private booking-sheet branch, `app/driver/listing.tsx`, private listings action branch | `features/shared-journeys`. |
| `app/ride/**`, `app/driver/ride/[id].tsx`, `rates.tsx`, `DriversMap/RideHistory/IncomingRequests/OnlineToggleCard`, ride-specific library functions | `features/nearby-rides`. |
| `BusResults/AgencyFilterBar/BusCard/TripCard/TripBookingSheet`, bus filters and booking-sheet branch | `features/bus`. |
| `app/driver/setup.tsx`, `onboarding.tsx`, `vehicles.tsx`, `earnings.tsx` and common provider/account forms | Shared provider infrastructure behind `core/session/provider` facades initially; service subforms use feature exports. |
| `lib/usePushPermission.ts`, future inbox/preferences | `core/notifications`; destination resolution through shared navigation. |
| `app/(admin)/**`, `components/admin/**` | Retain admin presentation/guards; reuse session/contracts, not the customer/provider tab shell. |
| `lib/api/queryClient/queryKeys/apiSchema/firebase/i18n`, theme/roles/locales, generic UI/pickers/offline/upload | Retain stable shared infrastructure. One Axios instance, query client, schema and theme/i18n setup. |
| No cargo screens found | Reserved `features/cargo`; no implied feature implementation. |

Generic `callPhone/openNavigation` currently exported from `lib/rides.ts` are used by hire: move implementation to shared platform/navigation actions while keeping the old exports temporarily. Generic Stars/ReasonSheet/safety UI must not become nearby-rides-only merely because of their current folder.

## 4. Dependency and compatibility contracts

### Boundary rules

1. A service imports another service only through that owner's explicit `Contracts/` or frontend `index.ts`, not internal implementation/models for new cross-domain writes.
2. Shared session, permissions, money, provider reputation, notification delivery and service-access policy have one owner and explicit consumers. Do not duplicate them into each service.
3. Frontend core session/catalog/notifications must not import service internals. Home, provider dashboard, activity and a declared feature registry are composition roots allowed to import public feature exports.
4. Controllers/routes and old library/service facades can delegate to targets during transition. They must not become a bypass for forbidden domain dependencies.
5. Keep one authoritative write path per operation. Extract first, delegate second, remove duplicated old implementation only after callers and tests use the new path.
6. Add a reviewed dependency manifest and automated checks: proposed `backend/tests/Feature/Architecture/ModuleBoundaryTest.php` and `mobile/scripts/check-module-boundaries.mjs`. Check resolved imports/aliases and known facade exemptions, not just folder existence. These checks do not exist yet.

### Contracts to establish in M02/M05–M07

| Contract | Required behavior |
|---|---|
| Provider access | Inputs are server identity, permissions, full offered-services set and verification/eligibility. Output distinguishes allowed configuration, discovery and offering; a client persona is never a security input. |
| Legacy booking dispatcher | Keep `type=bus/private/rental/trip` and `reference_id` meanings. Per-type handler supplies rules; LegacyBookings coordinates existing persistence/audit. Existing safe payload/response shapes remain until explicitly corrected. |
| Pricing policy | Shared policy interface adapts current `platform_settings['rides']` including hire settings. Preserve snapshots and separate Jali fee/commission from provider price, deposit/overtime/cancellation. |
| Provider reputation/display | Preserve union of ride/hire ratings and provider profile updates through domain read ports; don't reset ratings or import NearbyDrivers internals from hire/safety. |
| Money recording | Domain completion calls one Payments interface with a stable source type/id and intended entry; define duplicate/retry behavior before asynchronous/concurrent execution. Never claim exactly-once from a folder move. |
| Availability/conflicts | Read service-specific rental calendars, hire schedules, departures and nearby presence. Define a shared conflict-check port before enabling simultaneous overlapping work; do not equate all availability with “online.” |
| Notifications | Transport failure does not roll back a valid booking. Preserve old `screen,id`; new durable feed/dispatch requires explicit schema, retention, deduplication and access contracts. |
| Activity projection | Read customer ownership and provider assignment separately. Preserve entity types/IDs/statuses; do not write domain lifecycle state from a unified feed. |

Capture exact DTO fields, HTTP status/error bodies and existing callers in each task's evidence before extracting. [OpenAPI/AsyncAPI](api/README.md) remains the contract source of truth; this document does not replace schemas with an undocumented interface.

### Non-negotiable compatibility

- Preserve all existing route files, URLs, route parameters, middleware and safe API fields during structural moves. Do not change arrays to paginated envelopes, rename fields, or switch public/auth access as incidental optimization.
- Keep `App\Models` classes/table names and factories initially. Audit bindings/imports, listeners, commands, route binding and persisted/queued class references before any later namespace change.
- Preserve explicit `driver_presence` table with `user_id` primary key/non-incrementing, `driver_availability`, and append-oriented `driver_ledger`.
- Preserve Booking IDs/type/reference meaning; Ride/Hire state names, quote snapshots and events; driver-document privacy and existing photo/ticket access.
- Keep `App\Services\PushService` lazy binding in `AppServiceProvider` or update all consumers atomically behind a tested facade.
- Keep `rides:expire-presence`, `rides:expire-requests`, `hires:expire-requests` names and minute scheduling. They mutate state; don't execute them as read-only diagnostics.
- Never reproduce insecure access, unvalidated prices or broken persistence merely to match an old fixture. Fixes are distinct authorized changes with tests and compatibility explanation.
- Exact tab labels/order remain current. `Home/Activity/Inbox/Account` is not authorization to rename Home/Trips/Drive/Profile or add an Inbox tab.

## 5. Session, persona and service-access specification

### Six independent sources of state

| State | Authority | Allowed mutation |
|---|---|---|
| Identity | Sanctum session + canonical `/me` | Login/logout/account actions only. |
| Capabilities | Server permissions, verification and eligibility | Server approval/configuration; never UI mode selection. |
| Persona | Account-scoped customer/provider view preference | Explicit view switch only; no backend profile, role, online or booking mutation. |
| Selected service | Account-scoped display/filter preference | Explicit selection; preserve separate preferred customer/provider service if useful. |
| Offered services | Full server-owned provider configuration set | Deliberate onboarding/settings action, followed by server validation/refetch. |
| Availability | Each domain's authoritative operational state | Explicit availability/calendar/job actions; never persona change. |

M05 should retain `useDriverMode()` as a transitional adapter: `driverMode` maps to view persona; `driverType` maps to selected service; setters become view-only. Audit every caller together because old `setDriverType` currently means a server mutation.

Retain current provider values `ride/hire/private_seat/rental` in stored/API configuration. Internal catalogue IDs may be `nearby-rides/driver-hire/shared-journeys/rentals/bus/cargo`; translate explicitly at boundaries. Do not replace database/API strings as a naming cleanup.

### Hydration and teardown protocol

1. Resolve stored token, then canonical server identity/capabilities; hydrate private state only for the confirmed account. Do not use Firebase display state alone as the permission authority.
2. Mount shared session/view/notification coordination above authenticated tab and standalone driver/hire/ride routes. Retain admin guards and login navigation.
3. New view storage proposal: `jali_view_state_v1:<userId>`. Inventory exact old keys in M00. Read old mode/type once as view defaults; never use migration to overwrite server services or turn a driver on/off.
4. Scope private persistence to account and schema version. Purge/unsubscribe the old global private cache before account changes; cancel in-flight requests and use a session generation guard so late responses cannot repopulate it.
5. Use one teardown for customer/admin logout, 401, deletion and account replacement: clear in-memory/persisted token, view state, private queries/persister, pending notification intents and authenticated listeners. Local cleanup runs even if server logout fails. Do not clear device language without a recorded product rule.
6. Do not persist sensitive PINs, document data or unrestricted private payloads simply because Query supports persistence. Define an allowlist/redaction and schema-version invalidation.
7. Refresh/revalidate capabilities after approval/config changes, foreground recovery and permission errors. Infinite freshness is not permission revocation protection.
8. Unknown/denied capability state disables privileged/new actions, but must not delete owned history. Offline display never grants server authority.

### New service-access contract — implement only in M06

Use one server resolver shared by navigation and backend intake checks. Proposed authenticated endpoint: `GET /me/service-access` (additive OpenAPI task, not an existing endpoint).

Its versioned response should include `version` and `services[]`, each with:

- stable `id`;
- `discoverable` and `accepting_new_requests`;
- `can_configure` and `can_offer`, resolved from permission/verification rather than persona;
- machine-readable `reason_code` for unavailable actions;
- `minimum_app_version` only if a supported-version policy requires it.

Server configuration must distinguish published/discoverable scope from accepting new work. Inventory actual current availability before introducing controls: do not infer deployed state from this repository. Apply the resolver to all new-intake paths, including generic booking type branches; UI hiding alone is insufficient. Reading/completing/cancelling owned existing work still follows ownership and valid state transitions.

Compatibility defaults must be explicit: preserve the pre-migration authorized state for existing clients while gating unsupported future services; missing/unknown catalogue data cannot enable cargo or new privileged actions. Stage controls without changing public availability; activation/config changes remain Scope D. Define geographic eligibility/app-version rules only when selected; do not invent launch areas.

### Cross-service job conflicts — decision before simultaneous offering

View selection never cancels work. Before allowing concurrent service offers, agree provider/vehicle conflict rules, authoritative start/end intervals, timezone, holds/expiry, atomic reservation and cancellation release. Current hire availability queries hire jobs; ride busy checks ride jobs. Neither proves a shared reservation guard.

A provider with `["ride","hire","private_seat","rental"]` must retain every service through switches/restarts/new-phone recovery. Prevent conflicting commitments by server rules, not by restricting the account to one visual driver type.

## 6. Shared routes, activity and notifications

Keep current `/login` and `/admin-login` distinct; route groups are not URL namespaces. Keep `/ride/:id`, `/driver/ride/:id`, `/hire/:id`, `/driver/hire/:id`, `/driver/setup`, `/driver/fleet` and `/driver/listing` and their parameters. Record every admin/detail URL in M00.

Create one route registry with allowlisted entity types/actions, validated IDs and feature public entry points. Existing `routeForNotification` becomes a tested compatibility facade; never navigate directly from an arbitrary payload URL.

Notification processing specification:

1. Normalize legacy `{screen,id}` and any reviewed new versioned payload to an allowlisted internal intent.
2. Receive foreground taps and the last response on cold start; deduplicate by notification/action identity.
3. Wait for router and session readiness. If signed out, retain a bounded pending intent for login; discard it on account replacement/logout.
4. Fetch/resolve the entity using authenticated APIs; validate participant ownership and required capability. Client labels do not grant access.
5. Route to the server-resolved customer/provider/admin detail. Do not silently alter role, offered services, online state or accepted jobs.
6. Show a safe unavailable/denied/deleted result for stale entities; avoid redirect loops and private details for another account.
7. Acknowledge/clear handled responses. Push permission refusal leaves activity/in-app status accessible.

SDK-specific implementation must match installed dependencies; [Expo SDK 54 notification APIs](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/) document last-response retrieval/clearing. Test native development/release builds as appropriate; don't use a web mock to claim push delivery works.

Shared Activity must expose customer bookings and provider assignments without the current role-only history substitution. Preserve the old `/bookings` contract; introduce an additive projection in M07, proposed as `GET /me/activity?persona=customer|provider&service=<catalogue-id>&cursor=<opaque-cursor>`. Persona here is a requested projection, not an authorization grant.

Freeze and document this new contract before implementation: response `{data: ActivityItem[], next_cursor: string|null}`; each item has `entity_type`, `entity_id`, `service_id`, `participant_role`, original domain `status`, `title` and `occurred_at`. Use deterministic ordering/tie-breaking; distinguish bookings/rides/hires even when numeric IDs coincide. Only include entities owned by, assigned to or legitimately managed by the authenticated person. Never return PINs/private documents through the summary. The route registry derives destination from entity/participant context rather than a payload-supplied URL. Keep the feature-owned detail authoritative and retain history when intake closes.

Proposed durable notification contracts for M07 are `GET /me/notifications` (bounded cursor feed), `PATCH /me/notifications/{id}/read` (idempotent owner-only read state) and `GET/PUT /me/notification-preferences`. Define a server-generated notification ID, stable source-event deduplication key, user ownership, service/category, message/template data, entity context, created/read timestamps, preference defaults and retention rule in OpenAPI and the reviewed additive migration. Keep notification history separate from push tokens/delivery attempts; never store credentials or trip PINs in the feed. Unknown preference fields are rejected; OS permission is independent. These are target contracts, not endpoints/tables already present, and exact page UX/retention remains the decision gate below.

For shared settings/inbox, finalize the exact routes, sections, preference categories and retention rule before M07 implementation. Keep current Profile access and tab order as the default. A notification settings toggle is not a separate provider account. A durable inbox requires backend storage/access/read-state; push transport logs or an empty menu are not an inbox.

## 7. Ordered task ledger

All statuses begin **not started**. Expand each row into a small implementation PR with exact changed paths, acceptance criteria, tests and recovery evidence. Structural task order is not public service activation.

| ID | Dependencies | Deliverable / principal paths | Acceptance evidence |
|---|---|---|---|
| M00 | Explicit execution scope | Audit current checkout/drift; routes/imports/storage/API/schema/config inventories and decision record. | Baseline SHA, preserved user changes, scope A/B/C/D, actual versions, known-risk list, non-production branch and agreed verification environment. |
| M01 | M00 | Reproducible dependencies; backend test safety and missing characterization; mobile harness; boundary-test scaffolding. | Existing commands reproduced or failures recorded; successful/negative legacy flows; account/view fixtures; no production DB or live side effects. |
| M02 | M01 | Backend shared contracts, provider/settings/money/push seams, LegacyBookings dispatcher and ownership manifest. | No schema/URL/model-namespace changes; one writer; safe response/middleware parity; shared dependencies explicit. |
| M03-Rental | M02 | Rental controller/booking logic → `Modules/Rentals`. | Catalogue/owner CRUD/priceDay mappings and generic booking parity; incomplete reservation/status lifecycle remains a tracked launch gate. |
| M03-Hire | M02, M03-Rental | Hire logic → `Modules/DriverHire`; shared ports replace ride-internal dependencies. | Quotes, calendar/timezone, acceptance/cancel/overtime/privacy/expiry tests; no hidden customer/service loss. |
| M03-Shared | M02, M03-Hire | Private-seat logic → `Modules/SharedJourneys`. | Owned listings/booking references/history preserved; no claim that stop-segment capacity now exists. |
| M03-Rides | M02, M03-Shared | Ride/state/dispatch/presence logic → `Modules/NearbyRides`; generic helpers shared. | Existing ride/PIN/privacy/price/event/presence tests; retries/concurrency risks recorded; expiry commands unchanged. |
| M03-Bus | M02, M03-Rides | Bus/operator/departure adapters → `Modules/Bus`; legacy booking compatibility. | Old/new departure/reference persistence, station/location scope, tickets and upgrade fixtures; no legacy Trip deletion without evidence. |
| M04-Rental | M01, M03-Rental | Rental screens/hooks/API → `features/rentals`; old route/component facades. | Route/payload/visual parity, owned inventory, booking invalidation and typecheck. |
| M04-Hire | M04-Rental, M03-Hire | Hire screens/hooks/API → `features/driver-hire`. | Customer/provider lifecycle, quote/availability/error/parameter parity; no nearby-rides internal imports. |
| M04-Shared | M04-Hire, M03-Shared | Private screens/hooks/API → `features/shared-journeys`. | Existing listing/edit/search/booking behavior and keys preserved. |
| M04-Rides | M04-Shared, M03-Rides | Nearby ride screens/hooks/API → `features/nearby-rides`. | Rider/provider/detail/PIN/map/safety flows, route parity and shared generic UI. |
| M04-Bus | M04-Rides, M03-Bus | Bus catalogue/filter/booking → `features/bus`. | Stations/departures/quantity/names/date/payment behavior and types retained. |
| M05 | M01; may run before independent M03/M04 moves | Root shared session; canonical identity; account-isolated teardown/persistence; pure persona/service selection. | Six-state contract, full service-set preservation, direct setup context, logout/401/deletion/account-switch and late-response tests. |
| M06 | M02, M05 | Server service-access resolver + additive contract; frontend registry/gated queries. | Navigation and backend agree; disabled intake denies new work but preserves owned work; old-client defaults documented; no production activation. |
| M07 | M05, M06, relevant M03/M04 tasks; shared-page decisions | Shared activity projections, active-work indicator, root notification resolver, approved shared settings/inbox contracts/screens. | Both-persona history, cold/login/duplicate/invalid/unauthorized taps, common preferences/inbox evidence, no unapproved tab redesign. |
| M08 | M05–M07, M03/M04 relevant paths | Presence lifecycle and duplicate display consolidation; focused/prefetch/poll/cache/list/map optimization. | Real device/network traces, no all-service request fanout, foreground mode changes don't stop intended availability; background policy explicit. |
| M09 | Selected A/B tasks green; operational authorization for any staging/deploy action | Compatibility, data reconciliation, staging/load/recovery rehearsal; deployment-hardening proposal before production. | Selected scope's definition of done, independent review, recorded residual risks, recovery proof and explicit activation/deployment status. |

If strict serial ordering blocks useful independent work, record the technical dependency adjustment in the task log; do not silently change the public sequence. Backend and frontend domain tasks can proceed in parallel after shared contracts are frozen. Assign one writer for API schemas, shared state, route registries and query keys; other agents propose changes through that owner.

Cargo implementation is not an M03/M04 “move.” Create a separate Scope C design/build task after choosing its batch and specifying carrier/load/quote/job/return-load rules. Segment inventory, complete rental date reservations and automatic ride pooling similarly require their own scoped implementation.

### Per-task execution protocol

1. Read the policy, this runbook, applicable guides, source callers and relevant stories. Rebase the inventory to the real implementation SHA.
2. Name exact files and invariants; write meaningful tests/fixtures before relocation. Security tests assert the desired safe outcome, not unsafe historical behavior.
3. Extract implementation behind existing facades in a small patch. Keep one active code path; avoid simultaneous API/schema/UX redesign.
4. Run affected checks, full relevant suites and contract/boundary checks. Inspect generated schema and import/route diffs.
5. Demonstrate rollback/compatibility for the step. Capture commands/results, device evidence where needed, and unresolved launch gates.
6. Open/review the implementation PR against the authorized non-production branch. Mark implemented, staging-validated and publicly activated separately; never infer deployment permission from completion.

## 8. Verification commands and test environment safety

These commands are documented for future authorized implementation in a checked-out repository; they were **not run** while creating this document.

Before any tests/migrations: use a disposable developer/CI environment, a verified test database, sandbox/faked external services and no production credentials. Resolve cached Laravel configuration only in that disposable checkout. Add a fail-fast environment/database assertion before any `RefreshDatabase` or reset executes.

Current `backend/phpunit.xml` forces SQLite `:memory:`; setting a MySQL environment variable alone does not override that. Current CI migrates a disposable MySQL fixture, then behavior tests run under the forced SQLite configuration. A green suite is not MySQL concurrency evidence. M01 must add a separate isolated MySQL test configuration and record the actual driver/database in test output.

| Working directory | Existing command | Meaning / limitation |
|---|---|---|
| `backend` | `composer install --prefer-dist --no-interaction --no-progress` | Install locked dependencies including dev tools in the disposable environment. CI uses PHP 8.3. |
| `backend` | `composer dump-autoload` | Validate namespace/autoload updates; not a behavioral test. |
| `backend` | `php artisan route:list --path=api --json` | Capture endpoint/middleware inventory for before/after comparison. |
| `backend` | `php artisan test` | Existing PHPUnit suite, primarily SQLite under current config. |
| `backend` | `php artisan test --filter=ApiContractTest` | Current in-process documented-operation/route/schema checks; not a remote extracted-service harness. |
| `backend` | `php artisan test --filter=HireDriverTest` | Existing hire tests; extend for new cross-service/access rules. |
| `backend` | `php artisan test --filter=RideLifecycleTest` | Existing ride lifecycle tests; not full multi-host/concurrency proof. |
| `docs/api` | `npx -y @redocly/cli@1 lint openapi.yaml` | Existing spec-lint workflow command. |
| `mobile` | `npm run api:types` | Writes generated `lib/apiSchema.ts`; inspect/commit intended diff. |
| `mobile` | `npm run typecheck` | Existing strict TypeScript check. |
| `mobile` | `npm run api:mock` | Starts Prism for development; not an acceptance test. |

Pint is installed; a future formatting check can use `vendor/bin/pint --test` with platform-appropriate invocation. It is not currently an existing CI gate.

M01 must reconcile mobile manifest/lockfile/SDK-compatible packages. Mobile Checks currently uses `npm install --ignore-scripts` with a lockfile mismatch comment; Android uses `npm ci --legacy-peer-deps`. Do not announce reproducible installs until one tested strategy is committed.

Proposed mobile harness: SDK-compatible `jest-expo` + Jest and React Native Testing Library; resolve/pin dependencies without upgrading Expo/React incidentally. [Expo's testing guide](https://docs.expo.dev/develop/unit-testing/) supports that approach. Add a non-watch `test:ci` script and documented component/session/navigation mocks; only then can the runbook use `npm run test:ci`. Native device flows remain required alongside mocked tests. No Jest/E2E script or harness exists in the audited mobile manifest.

Current OpenAPI prefix checks omit legacy `/car-rentals`, `/private-seats`, `/buses`, `/bookings` and `/tickets`. Extend specs/coverage with each authorized touched endpoint; don't infer complete app coverage from ApiContractTest. Remote service extraction later requires a separate network-contract harness with controlled fixtures.

### Required acceptance matrix

For every applicable selected scope, record pass/fail/not-applicable with test names and evidence:

- Customer, verified multi-service provider, unverified/suspended/revoked provider, admin/superadmin and unrelated account.
- Driver with no listings sees no unrelated bookings; provider customer purchases remain visible; station/location restrictions remain effective.
- Persona/service switches never mutate offered services, identity, online/calendar state or accepted work.
- Logout while offline/server error, 401, deletion, account switch, restart and delayed responses cannot reveal a previous account's private cache or intents.
- Old URLs/parameters, cold `/driver/setup`, legacy push payloads and supported older app versions.
- Foreground/background/cold/login notification taps, duplicates, invalid IDs, stale/deleted records and insufficient ownership/permission.
- New-intake disabled while owned active/history/cancellation/completion/support access remains valid.
- Full relevant booking/job lifecycle, errors/timeouts/rejections/cancellation, locked prices and zero-platform-fee evidence for the selected release.
- Provider/vehicle overlapping commitments, double booking, acceptance/completion races and retry idempotency on isolated production-like MySQL—not only sequential SQLite.
- Network/location permission loss, foreground mode/tab changes, background/resume, battery/polling and low-connectivity devices.
- Fresh install and sanitized upgrade data, interrupted backfill/retry, reconciliation and compatible code rollback.
- Existing Ride/Hire/Safety/Payments/Onboarding/RateLimit/Push tests preserved; missing rental/shared/bus successes explicitly covered.

## 9. Data, configuration and zero-fee migration rules

### Structural moves first

Scope A should not require table renames, ID changes or backfills. Keep data ownership logical while retaining existing storage adapters. If a structural task unexpectedly needs a schema change, split it out and explain why.

Never replay/edit existing migrations, including `2026_04_16_000001_restructure_trips_to_agency_routes_and_departures.php`. The hire-table migration `2026_10_06_000001_create_driver_hire_tables.php` skips existing tables: reconcile actual sanitized columns/indexes with migration expectations rather than trusting migration-history rows alone.

For each genuinely required additive change:

1. Specify affected tables/columns, defaults/nullability, indexes, ownership and old/new client compatibility.
2. Test fresh installation and upgrade from a sanitized representative fixture on the intended DB engine.
3. If backfill is needed, implement a reviewed resumable/idempotent command with dry-run, deterministic cursor/checkpoints and reconciliation. No such generic migration command is claimed to exist.
4. Compare row counts, keys/relationships, active bookings, configuration/services and monetary totals before/after; retain the report, not production PII.
5. Keep compatible schema after code rollback where possible. Delay destructive cleanup until older clients, queued jobs and rollback window are demonstrably covered.

Do not run `migrate:fresh`, broad production seeders or blind `migrate:rollback` as a migration recipe. Do not rerun `RolesAndPermissionsSeeder` unreviewed: it uses `sync` and can replace assigned permissions. Any missing customer capability for providers needs targeted, reviewed permission changes, not UI impersonation or a multi-role schema rewrite.

### Zero-platform-fee gate, separate from relocation

The governing policy is zero Jali commission/service/subscription fees initially, while provider prices remain. Current `RideSettings` defaults include ride commission 8%, flat service fee 200, and hire commission 10%/service fee 500; persisted `platform_settings['rides']` overrides defaults. This is source-code evidence, not a report of deployed charges.

Audit server and saved configuration, not just defaults:

- `Services/Rides/{RideSettings,FareService,RideService,RidePresenter}`;
- `Services/Hire/{HireQuote,HireService,HirePresenter}`;
- generic booking, driver earnings, ledger and analytics paths;
- `mobile/lib/serviceFee.ts`, previews, totals, receipts and provider earnings/debt blockers.

A future authorized fee task must state effective-from behavior and prove new quotes/completions have zero Jali fees. Keep historical rate snapshots, ledgers and debts intact unless a separate explicit accounting decision governs them. Provider cancellation/overtime/deposits are not automatically removed. Review side effects of admin settings updates, including rate-guardrail revalidation.

## 10. Deployment, cloud growth and recovery

### Current workflow hazards

`.github/workflows/deploy-backend.yml` can run on a `main` push touching backend/workflow paths or manual dispatch. It overwrites files and runs forced migrations; the audited workflow has no declared protected-environment approval, successful-test dependency or atomic rollback procedure. `build-android.yml` runs on every `main` push, including documentation changes; building an APK is not store submission.

Therefore use the authorized non-production branch for implementation. Merging backend changes to `main` may be a deployment action. Do not dispatch workflows or merge to production merely to finish the checklist. Production rollout needs separate authority and a reviewed deployment-hardening task.

Before any authorized production migration, prove:

- controlled release artifact and test gates; backup and restore rehearsal;
- deployment ownership/approval and health checks;
- schema/worker/scheduler/app-version compatibility;
- recovery trigger, responsible person and tested procedure;
- preservation of active work and safe new-intake controls.

The deployment workflow writes `CACHE_DRIVER`, whereas Laravel cache config reads `CACHE_STORE`; queue configuration in the workflow is synchronous. Reconcile actual resolved staging configuration rather than asserting deployed cache/queue behavior from variable names.

### Cloud-ready checks, not a cloud migration mandate

Measure first. If multi-instance deployment is later selected, explicitly address shared durable uploads/private documents, cache/lock/queue state, scheduler leadership and DB capacity. Keep private documents behind authenticated owner/reviewer access; do not move every file to a public CDN.

Preserve expiry work with a single scheduler leader or proven shared-lock/idempotency strategy. When queuing side effects, define transaction/after-commit behavior, retries/deduplication, timeout versus retry settings, failed-job handling and compatible worker restart. Do not claim current synchronous PushService is already a durable queue/inbox.

Record representative endpoint latency/errors, query counts/slow queries, queue age/depth, scheduler delay, CPU/memory/storage and real-device request/battery traces. Agree workload and release-specific budgets in M00/M09; no invented user-count threshold, cloud vendor or Kubernetes requirement.

Microservice extraction remains separate future work: measured benefit, owner/data boundary, identity-compatible APIs/events, remote contract tests, failure/retry/observability and rehearsed routing rollback. Finishing this modular migration does not require extracting any service.

### Recovery specification

Each step must identify its previous known-good code artifact and compatible configuration/schema. In staging, rehearse reversing the code change while retaining additive data, restoring a backup to a separate recovery environment, and resuming scheduler/workers without duplicate financial or notification effects.

Trigger recovery review for unauthorized exposure, lost active work, incorrect prices/ledger, corrupted relationships, unacceptable measured failures or client breakage. During an incident, use only authorized operational controls. Stop new intake where appropriate while preserving owned jobs/history/support; do not delete records to “reset” service.

Prefer compatible code rollback or forward repair. Destructive down migrations, debt rewrites, storage deletions and public-service deactivation are explicit decisions, not automatic consequences of failing a test. Record actual recovery outcome before claiming a tested rollback.

## 11. Evidence record and multi-agent handoff

For every task, use this template in its PR or authorized migration log:

```text
Task ID / selected scope:
Status: not started | in progress | implemented | staging validated | publicly activated
Execution authority / prohibited operational actions:
Baseline SHA / implementation SHA / drift:
Owner / reviewers / dependencies:
Exact old -> new paths and allowed dependency changes:
Preserved URLs, schemas, model/table names, storage and state invariants:
Authorized behavior changes / decision references:
Commands actually run, environment/DB driver and results:
Test names / fixtures / device and native-link evidence:
Data/config reconciliation:
Recovery procedure and rehearsal result:
Known failures / untested areas / remaining launch gates:
Next authorized task:
```

Do not check off planned tests or infer evidence from code inspection. A new agent reads the latest log and actual branch before continuing; do not redo completed tasks or overwrite unrelated edits. Shared-contract changes need one designated writer and review across affected domains. Parallel agents can own independent modules, but cannot silently redesign the shared shell or activate another service.

## 12. Open decisions and definition of done

Record these at the relevant task boundary, not by guessing:

| Decision | When needed |
|---|---|
| Selected migration scope, implementation branch/environment, supported app versions and test/load budgets | M00, before implementation. |
| Exact shared settings/inbox routes, categories, account/device preference policy and retention | Before M07 shared-page work. Current tabs/routes remain the safe structural default. |
| Cross-service provider/vehicle scheduling/conflict and background availability policy | Before M08 changes or simultaneous multi-service offering. No automatic offline-on-persona rule. |
| Rental reservation lifecycle, shared route-segment inventory and cargo design/batch | Scope C before building/activating the selected service. |
| Production permissions/configuration/fee effective-from changes, infrastructure and recovery approvals | Scope D before any operational change. |

Scope A is complete only when all selected existing domains use defined modular business/query ownership behind preserved routes/model/storage facades, forbidden dependencies/duplicate writers are removed, meaningful tests and boundary checks pass, and data/API parity is evidenced. Security/privacy/correctness defects that prevent safe migration or its required tests must be resolved through distinct authorized prerequisite PRs, not waived as historical behavior. Remaining service-product gaps (such as rental reservations or segment seats) stay explicit launch blockers; structural completion does not claim those features. Cargo's absence must remain explicit.

Scope A+B additionally requires proven account isolation and six-state separation, consistent frontend/backend service access, both-persona history, root notification/active-work recovery, selected shared-page implementation and measured lifecycle/performance acceptance. Any excluded shared page or unresolved capability must be named in the authorized scope; do not report it as “100% migrated.”

Operational completion is a separate status requiring the selected staging/recovery/release evidence and authority. Architecture completion is not a claim that every transport service is ready or publicly launched. No documentation can guarantee correctness without implementation and recorded verification.

## Related references

- [Release and architecture policy](RELEASE_PLAN.md) — governing product direction, unchanged except this runbook link.
- [Project context](../context.md), [CLAUDE.md](../CLAUDE.md), [AGENTS.md](../AGENTS.md).
- [API contract and commands](api/README.md), [OpenAPI](api/openapi.yaml), [AsyncAPI](api/asyncapi.yaml).
- [Existing ride technical plan](../RIDE_HAILING_PLAN.md), [ride stories](ride-hailing/USER_STORIES.md), [multi-agent guide](ride-hailing/AI_AGENTS_GUIDE.md), [UX checklist](ride-hailing/UX_QUALITY_CHECKLIST.md).
- [Mobile guide](../.claude/skills/stack-mobile.md), [backend guide](../.claude/skills/stack-backend.md), [routing](../.claude/skills/routing.md), [UX patterns](../.claude/skills/ux-patterns.md), [infrastructure](../.claude/skills/stack-infra.md), [deployment notes](../.claude/skills/deployment.md). Apply the conflict/drift checks above; these are not proof of runtime configuration.
