# Jali Ride & Hire-a-Driver — User Stories

> Backlog for the on-demand products described in `RIDE_HAILING_PLAN.md`.
> Each story has acceptance criteria and becomes one GitHub issue (`scripts/create-ride-issues.sh`).

**11 epics · 48 stories**

Labels: `epic`, `user-story`, `ride-hailing`, `phase-0/1/2`, plus area (`backend`, `mobile`, `admin`, `ux`, `payments`, `pricing`, `safety`, `security`, `international`).

## E0 — Foundations for on-demand rides  `phase-0`

Fix driver data that is silently lost today, persist driver mode, add ride permissions and a reusable push service, so the new products are built on solid ground.

| ID | Story | Labels |
|---|---|---|
| [S0.1](stories/S0.1-fix-driver-setup-data-is-silently-discarded.md) | Fix: driver setup data is silently discarded | phase-0, bug, backend, mobile |
| [S0.2](stories/S0.2-driver-mode-survives-app-restarts.md) | Driver mode survives app restarts | phase-0, mobile |
| [S0.3](stories/S0.3-seed-ride-hailing-permissions.md) | Seed ride-hailing permissions | phase-0, backend, security |
| [S0.4](stories/S0.4-reusable-push-notification-service.md) | Reusable push notification service | phase-0, backend, tech-debt |

## E1 — Driver onboarding & verification  `phase-1`

Any verified person — taxi/moto driver or private car owner — can sign up to drive, upload documents and vehicles, and be approved by an admin.

| ID | Story | Labels |
|---|---|---|
| [S1.1](stories/S1.1-become-a-driver-and-choose-services.md) | Become a driver and choose services | phase-1, mobile, backend |
| [S1.2](stories/S1.2-upload-driver-documents.md) | Upload driver documents | phase-1, mobile, backend, security |
| [S1.3](stories/S1.3-register-my-vehicles.md) | Register my vehicles | phase-1, mobile, backend |
| [S1.4](stories/S1.4-admin-verification-queue-for-drivers.md) | Admin verification queue for drivers | phase-1, admin, backend, mobile |

## E2 — Driver-set pricing  `phase-1`

Drivers set their own per-km rates (unlike Yego/Uber fixed tariffs), within guardrails set by the superadmin; the server computes and locks every quote.

| ID | Story | Labels |
|---|---|---|
| [S2.1](stories/S2.1-driver-sets-own-per-km-rates-with-live-preview.md) | Driver sets own per-km rates with live preview | phase-1, mobile, backend, pricing |
| [S2.2](stories/S2.2-superadmin-configures-pricing-guardrails--commissi.md) | Superadmin configures pricing guardrails & commission | phase-1, admin, backend, pricing |
| [S2.3](stories/S2.3-server-side-fare-quote-and-price-lock.md) | Server-side fare quote and price lock | phase-1, backend, pricing |

## E3 — Rider: discover nearby drivers & request a ride  `phase-1`

Riders enter a destination, see nearby drivers with *their* price for this trip (DiDi-style), and request one driver or broadcast to all.

| ID | Story | Labels |
|---|---|---|
| [S3.1](stories/S3.1-where-to---start-a-ride-from-home.md) | "Where to?" — start a ride from Home | phase-1, mobile, ux |
| [S3.2](stories/S3.2-see-nearby-drivers-with-their-own-price.md) | See nearby drivers with their own price | phase-1, mobile, backend, pricing |
| [S3.3](stories/S3.3-map-of-nearby-drivers.md) | Map of nearby drivers | phase-2, mobile, ux |
| [S3.4](stories/S3.4-request-a-specific-driver.md) | Request a specific driver | phase-1, mobile, backend |
| [S3.5](stories/S3.5-send-request-to-all-nearby-drivers.md) | Send request to all nearby drivers | phase-2, mobile, backend |
| [S3.6](stories/S3.6-fare-estimate-before-choosing.md) | Fare estimate before choosing | phase-1, mobile, backend, pricing |

## E4 — Live trip experience  `phase-1`

From accept to rating, both sides see the same live status, with PIN-verified pickup, fair cancellation rules, payment confirmation and history.

| ID | Story | Labels |
|---|---|---|
| [S4.1](stories/S4.1-track-my-driver-until-pickup.md) | Track my driver until pickup | phase-1, mobile, backend |
| [S4.2](stories/S4.2-start-the-trip-with-a-pin.md) | Start the trip with a PIN | phase-1, mobile, backend, security |
| [S4.3](stories/S4.3-cancellation-rules-and-fees.md) | Cancellation rules and fees | phase-1, mobile, backend |
| [S4.4](stories/S4.4-complete-trip-and-confirm-payment.md) | Complete trip and confirm payment | phase-1, mobile, backend, payments |
| [S4.5](stories/S4.5-two-way-rating.md) | Two-way rating | phase-1, mobile, backend |
| [S4.6](stories/S4.6-ride-history-in-trips-tab.md) | Ride history in Trips tab | phase-1, mobile, backend |

## E5 — Driver app: online mode & earnings  `phase-1`

Drivers go online, receive and accept requests, navigate, and track earnings and commission owed.

| ID | Story | Labels |
|---|---|---|
| [S5.1](stories/S5.1-go-online--offline.md) | Go online / offline | phase-1, mobile, backend |
| [S5.2](stories/S5.2-receive-and-accept-ride-requests.md) | Receive and accept ride requests | phase-1, mobile, backend |
| [S5.3](stories/S5.3-navigate-to-pickup-and-destination.md) | Navigate to pickup and destination | phase-1, mobile |
| [S5.4](stories/S5.4-earnings-and-commission-dashboard.md) | Earnings and commission dashboard | phase-1, mobile, backend, payments |

## E6 — Hire a Driver  `phase-2`

Customers find and book a verified private driver to drive *their own* car — by the hour, day or trip.

| ID | Story | Labels |
|---|---|---|
| [S6.1](stories/S6.1-driver-sets-hire-a-driver-rates-and-skills.md) | Driver sets hire-a-driver rates and skills | phase-2, mobile, backend, pricing |
| [S6.2](stories/S6.2-driver-availability-calendar.md) | Driver availability calendar | phase-2, mobile, backend |
| [S6.3](stories/S6.3-find-and-book-a-driver-for-my-car.md) | Find and book a driver for my car | phase-2, mobile, backend |
| [S6.4](stories/S6.4-hire-lifecycle-accept-check-in-check-out-overtime.md) | Hire lifecycle: accept, check-in, check-out, overtime | phase-2, mobile, backend |

## E7 — Payments, receipts & commission  `phase-1`

Cash and MoMo at launch, commission ledger and driver payouts, then in-app MoMo and international cards.

| ID | Story | Labels |
|---|---|---|
| [S7.1](stories/S7.1-cash-and-momo-payment-to-driver-launch.md) | Cash and MoMo payment to driver (launch) | phase-1, payments, mobile, backend |
| [S7.2](stories/S7.2-commission-ledger-settlement-and-driver-payouts.md) | Commission ledger, settlement and driver payouts | phase-1, payments, backend, admin |
| [S7.3](stories/S7.3-in-app-momo-and-international-card-payments.md) | In-app MoMo and international card payments | phase-2, payments, international |

## E8 — Safety & trust  `phase-1`

Riders, drivers and families trust Jali: trip sharing, SOS, audit trail and quality monitoring.

| ID | Story | Labels |
|---|---|---|
| [S8.1](stories/S8.1-share-my-trip.md) | Share my trip | phase-2, mobile, backend, safety |
| [S8.2](stories/S8.2-sos-emergency-button.md) | SOS emergency button | phase-2, mobile, backend, safety |
| [S8.3](stories/S8.3-ride-audit-trail.md) | Ride audit trail | phase-1, backend, admin, safety |
| [S8.4](stories/S8.4-flag-low-rated-or-high-cancel-drivers.md) | Flag low-rated or high-cancel drivers | phase-1, backend, admin, safety |

## E9 — International experience — feels like Uber/DiDi  `phase-1`

A visitor who uses Uber or DiDi at home opens Jali in Kigali and instantly knows what to do: familiar flow, their language, their phone number, their card, email receipts, airport pickup.

| ID | Story | Labels |
|---|---|---|
| [S9.1](stories/S9.1-familiar-uber-didi-style-ride-flow-ux-benchmark.md) | Familiar Uber/DiDi-style ride flow (UX benchmark) | phase-1, ux, mobile, international |
| [S9.2](stories/S9.2-language-international-phone-numbers-and-email-log.md) | Language, international phone numbers and email login | phase-1, mobile, backend, international |
| [S9.3](stories/S9.3-sign-in-with-apple.md) | Sign in with Apple | phase-1, mobile, backend, international |
| [S9.4](stories/S9.4-show-prices-in-my-home-currency-too.md) | Show prices in my home currency too | phase-1, mobile, international |
| [S9.5](stories/S9.5-in-app-chat-with-quick-translated-phrases.md) | In-app chat with quick, translated phrases | phase-2, mobile, backend, international |
| [S9.6](stories/S9.6-email-receipts-for-every-trip.md) | Email receipts for every trip | phase-1, backend, international, payments |
| [S9.7](stories/S9.7-airport-pickup-at-kigali-international-airport.md) | Airport pickup at Kigali International Airport | phase-2, mobile, backend, international |

## E10 — Admin operations for rides  `phase-1`

Admins can watch live operations, investigate rides, resolve disputes and see ride analytics.

| ID | Story | Labels |
|---|---|---|
| [S10.1](stories/S10.1-live-operations-view.md) | Live operations view | phase-1, admin, mobile, backend |
| [S10.2](stories/S10.2-rides-list-detail-and-dispute-handling.md) | Rides list, detail and dispute handling | phase-1, admin, mobile, backend |
| [S10.3](stories/S10.3-ride-analytics.md) | Ride analytics | phase-1, admin, backend, analytics |
