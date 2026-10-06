# Jali Ride & Hire-a-Driver — User Stories

> Full backlog for the on-demand products described in `RIDE_HAILING_PLAN.md` — the best features of Uber, DiDi, Bolt, inDrive, Careem and Grab, plus Jali's own driver-set pricing.
> Each story has acceptance criteria and is tracked as a GitHub issue (column *Issue*; epics are parent issues with the stories as sub-issues).

**23 epics · 129 stories · 15 dependency waves**

| Level | Phase label | Stories | Meaning |
|---|---|---|---|
| 1 — MVP | `phase-0`, `phase-1` | 50 | Rides work end-to-end, safely, in one city |
| 2 — Uber parity | `phase-2` | 63 | Everything a visitor expects from Uber/DiDi/Bolt |
| 3 — Beyond | `phase-3` | 16 | Subscriptions, loyalty, fleets, partners, delivery, web |

Working with several AI agents? Read `AI_AGENTS_GUIDE.md` first. Every UI story must pass `UX_QUALITY_CHECKLIST.md`.

## Build order — dependency waves

Stories in the same wave don't depend on each other and can be built **in parallel**. A story can start once everything in its *Depends on* list is merged.

- **Wave 1** (17): [S0.1](stories/S0.1-fix-driver-setup-data-is-silently-discarded.md), [S0.3](stories/S0.3-seed-ride-hailing-permissions.md), [S0.4](stories/S0.4-reusable-push-notification-service.md), [S3.1](stories/S3.1-where-to-start-a-ride-from-home.md), [S9.2](stories/S9.2-language-international-phone-numbers-and-email-log.md), [S9.3](stories/S9.3-sign-in-with-apple.md), [S15.6](stories/S15.6-delete-my-account-and-export-my-data.md), [S15.7](stories/S15.7-dark-mode-and-accessibility.md), [S16.2](stories/S16.2-help-centre-with-trip-specific-help.md), [S21.1](stories/S21.1-crash-reporting-and-performance-monitoring.md), [S21.2](stories/S21.2-backend-monitoring-and-alerts.md), [S21.3](stories/S21.3-automated-checks-on-every-pull-request.md), [S21.7](stories/S21.7-rate-limiting-and-abuse-protection.md), [S21.8](stories/S21.8-data-protection-compliance.md), [S21.9](stories/S21.9-api-contract-openapi-as-source-of-truth.md), [S21.11](stories/S21.11-backups-and-disaster-recovery.md), [S21.12](stories/S21.12-performance-on-low-end-android.md)
- **Wave 2** (13): [S0.2](stories/S0.2-driver-mode-survives-app-restarts.md), [S1.1](stories/S1.1-become-a-driver-and-choose-services.md), [S1.3](stories/S1.3-register-my-vehicles.md), [S2.2](stories/S2.2-superadmin-configures-pricing-guardrails-commissio.md), [S9.1](stories/S9.1-familiar-uber-didi-style-ride-flow-ux-benchmark.md), [S10.4](stories/S10.4-service-areas-cities-geofences.md), [S11.5](stories/S11.5-saved-places-with-labels-and-driver-notes.md), [S12.3](stories/S12.3-reliable-notifications.md), [S15.4](stories/S15.4-notification-preferences.md), [S15.8](stories/S15.8-first-time-onboarding.md), [S16.3](stories/S16.3-support-tickets-and-live-chat-with-an-agent.md), [S19.4](stories/S19.4-partner-api.md), [S21.10](stories/S21.10-feature-flags-and-remote-config.md)
- **Wave 3** (4): [S1.2](stories/S1.2-upload-driver-documents.md), [S2.1](stories/S2.1-driver-sets-own-per-km-rates-with-live-preview.md), [S11.4](stories/S11.4-suggested-pickup-points-and-landmarks.md), [S22.2](stories/S22.2-segmented-push-campaigns.md)
- **Wave 4** (3): [S1.4](stories/S1.4-admin-verification-queue-for-drivers.md), [S2.3](stories/S2.3-server-side-fare-quote-and-price-lock.md), [S17.7](stories/S17.7-document-expiry-reminders.md)
- **Wave 5** (4): [S5.1](stories/S5.1-go-online-offline.md), [S6.1](stories/S6.1-driver-sets-hire-a-driver-rates-and-skills.md), [S11.1](stories/S11.1-road-based-distance-and-eta.md), [S17.10](stories/S17.10-driver-training-and-quiz.md)
- **Wave 6** (7): [S3.2](stories/S3.2-see-nearby-drivers-with-their-own-price.md), [S6.2](stories/S6.2-driver-availability-calendar.md), [S10.1](stories/S10.1-live-operations-view.md), [S17.6](stories/S17.6-fatigue-limit.md), [S18.1](stories/S18.1-driver-selfie-check-before-going-online.md), [S21.4](stories/S21.4-staging-environment-with-simulated-drivers.md), [S21.6](stories/S21.6-fraud-prevention.md)
- **Wave 7** (8): [S3.3](stories/S3.3-map-of-nearby-drivers.md), [S3.4](stories/S3.4-request-a-specific-driver.md), [S3.6](stories/S3.6-fare-estimate-before-choosing.md), [S6.3](stories/S6.3-find-and-book-a-driver-for-my-car.md), [S13.5](stories/S13.5-ride-preferences.md), [S13.6](stories/S13.6-women-only-option.md), [S13.9](stories/S13.9-child-seat-wheelchair-friendly-and-pet-friendly-ve.md), [S21.5](stories/S21.5-load-testing.md)
- **Wave 8** (15): [S3.5](stories/S3.5-send-request-to-all-nearby-drivers.md), [S4.3](stories/S4.3-cancellation-rules-and-fees.md), [S5.2](stories/S5.2-receive-and-accept-ride-requests.md), [S6.4](stories/S6.4-hire-lifecycle-accept-check-in-check-out-overtime.md), [S8.3](stories/S8.3-ride-audit-trail.md), [S9.4](stories/S9.4-show-prices-in-my-home-currency-too.md), [S11.2](stories/S11.2-route-line-on-the-map.md), [S13.1](stories/S13.1-schedule-a-ride-in-advance.md), [S13.2](stories/S13.2-book-a-ride-for-someone-else.md), [S13.3](stories/S13.3-multiple-stops.md), [S13.7](stories/S13.7-hourly-ride-with-driver-s-car.md), [S13.8](stories/S13.8-on-demand-intercity-rides.md), [S17.1](stories/S17.1-demand-heatmap-for-drivers.md), [S20.1](stories/S20.1-send-a-package.md), [S22.4](stories/S22.4-web-booking-page.md)
- **Wave 9** (13): [S4.1](stories/S4.1-track-my-driver-until-pickup.md), [S5.3](stories/S5.3-navigate-to-pickup-and-destination.md), [S9.7](stories/S9.7-airport-pickup-at-kigali-international-airport.md), [S10.2](stories/S10.2-rides-list-detail-and-dispute-handling.md), [S13.10](stories/S13.10-wait-save-priority-pickup.md), [S14.1](stories/S14.1-rider-offers-a-price-drivers-accept-or-counter.md), [S17.2](stories/S17.2-destination-filter-going-home.md), [S17.5](stories/S17.5-airport-and-venue-queue.md), [S17.9](stories/S17.9-next-trip-before-finishing-the-current-one.md), [S18.6](stories/S18.6-rider-verification-for-driver-safety.md), [S19.3](stories/S19.3-hotel-and-concierge-booking.md), [S20.2](stories/S20.2-delivery-pin-for-recipient.md), [S20.3](stories/S20.3-package-categories-and-prohibited-items.md)
- **Wave 10** (9): [S4.2](stories/S4.2-start-the-trip-with-a-pin.md), [S8.1](stories/S8.1-share-my-trip.md), [S8.2](stories/S8.2-sos-emergency-button.md), [S9.5](stories/S9.5-in-app-chat-with-quick-translated-phrases.md), [S11.6](stories/S11.6-describe-or-photograph-my-pickup-spot.md), [S11.7](stories/S11.7-live-eta-countdown.md), [S12.1](stories/S12.1-websockets-with-laravel-reverb.md), [S12.2](stories/S12.2-recover-trip-state-after-network-loss-or-app-kill.md), [S16.1](stories/S16.1-masked-phone-calls.md)
- **Wave 11** (8): [S4.4](stories/S4.4-complete-trip-and-confirm-payment.md), [S11.3](stories/S11.3-smooth-moving-car-on-the-map.md), [S15.5](stories/S15.5-report-a-lost-item.md), [S18.2](stories/S18.2-trip-anomaly-detection.md), [S18.3](stories/S18.3-audio-recording-during-the-trip.md), [S18.4](stories/S18.4-trusted-contacts-auto-share.md), [S18.5](stories/S18.5-driving-behaviour-alerts.md), [S18.7](stories/S18.7-safety-toolkit.md)
- **Wave 12** (7): [S4.5](stories/S4.5-two-way-rating.md), [S4.6](stories/S4.6-ride-history-in-trips-tab.md), [S7.1](stories/S7.1-cash-and-momo-payment-to-driver-launch.md), [S7.2](stories/S7.2-commission-ledger-settlement-and-driver-payouts.md), [S9.6](stories/S9.6-email-receipts-for-every-trip.md), [S10.3](stories/S10.3-ride-analytics.md), [S13.4](stories/S13.4-change-destination-during-the-trip.md)
- **Wave 13** (9): [S5.4](stories/S5.4-earnings-and-commission-dashboard.md), [S7.3](stories/S7.3-in-app-momo-and-international-card-payments.md), [S8.4](stories/S8.4-flag-low-rated-or-high-cancel-drivers.md), [S14.2](stories/S14.2-promo-codes.md), [S15.1](stories/S15.1-favourite-drivers.md), [S15.2](stories/S15.2-business-profile-and-expense-reports.md), [S17.3](stories/S17.3-driver-incentives-and-quests.md), [S19.1](stories/S19.1-fleet-owner-portal.md), [S22.3](stories/S22.3-in-app-store-rating-prompt.md)
- **Wave 14** (6): [S14.3](stories/S14.3-referral-program.md), [S14.6](stories/S14.6-jali-wallet.md), [S17.4](stories/S17.4-driver-levels-and-rewards.md), [S17.8](stories/S17.8-instant-cashout-to-momo.md), [S19.2](stories/S19.2-jali-for-business.md), [S22.1](stories/S22.1-deep-links-and-sharing.md)
- **Wave 15** (6): [S14.4](stories/S14.4-tipping.md), [S14.5](stories/S14.5-split-fare.md), [S14.7](stories/S14.7-jali-pass-subscription.md), [S14.8](stories/S14.8-loyalty-points-and-member-levels.md), [S15.3](stories/S15.3-family-profile.md), [S16.4](stories/S16.4-fare-review-and-refunds.md)

## E0 — Foundations for on-demand rides  `phase-0` · [#4](https://github.com/sebastien15/Jali/issues/4)

Fix driver data that is silently lost today, persist driver mode, add ride permissions and a reusable push service, so the new products are built on solid ground.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S0.1](stories/S0.1-fix-driver-setup-data-is-silently-discarded.md) | [#27](https://github.com/sebastien15/Jali/issues/27) | Fix: driver setup data is silently discarded | 1 | — | — |
| [S0.2](stories/S0.2-driver-mode-survives-app-restarts.md) | [#28](https://github.com/sebastien15/Jali/issues/28) | Driver mode survives app restarts | 2 | S0.1 | — |
| [S0.3](stories/S0.3-seed-ride-hailing-permissions.md) | [#29](https://github.com/sebastien15/Jali/issues/29) | Seed ride-hailing permissions | 1 | — | — |
| [S0.4](stories/S0.4-reusable-push-notification-service.md) | [#30](https://github.com/sebastien15/Jali/issues/30) | Reusable push notification service | 1 | — | — |

## E1 — Driver onboarding & verification  `phase-1` · [#5](https://github.com/sebastien15/Jali/issues/5)

Any verified person — taxi/moto driver or private car owner — can sign up to drive, upload documents and vehicles, and be approved by an admin.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S1.1](stories/S1.1-become-a-driver-and-choose-services.md) | [#32](https://github.com/sebastien15/Jali/issues/32) | Become a driver and choose services | 2 | S0.1, S0.3 | — |
| [S1.2](stories/S1.2-upload-driver-documents.md) | [#31](https://github.com/sebastien15/Jali/issues/31) | Upload driver documents | 3 | S1.1 | — |
| [S1.3](stories/S1.3-register-my-vehicles.md) | [#33](https://github.com/sebastien15/Jali/issues/33) | Register my vehicles | 2 | S0.1 | — |
| [S1.4](stories/S1.4-admin-verification-queue-for-drivers.md) | [#34](https://github.com/sebastien15/Jali/issues/34) | Admin verification queue for drivers | 4 | S1.2, S0.4 | — |

## E2 — Driver-set pricing  `phase-1` · [#6](https://github.com/sebastien15/Jali/issues/6)

Drivers set their own per-km rates (unlike Yego/Uber fixed tariffs), within guardrails set by the superadmin; the server computes and locks every quote.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S2.1](stories/S2.1-driver-sets-own-per-km-rates-with-live-preview.md) | [#35](https://github.com/sebastien15/Jali/issues/35) | Driver sets own per-km rates with live preview | 3 | S1.3, S2.2 | — |
| [S2.2](stories/S2.2-superadmin-configures-pricing-guardrails-commissio.md) | [#36](https://github.com/sebastien15/Jali/issues/36) | Superadmin configures pricing guardrails & commission | 2 | S0.3 | — |
| [S2.3](stories/S2.3-server-side-fare-quote-and-price-lock.md) | [#37](https://github.com/sebastien15/Jali/issues/37) | Server-side fare quote and price lock | 4 | S2.1 | — |

## E3 — Rider: discover nearby drivers & request a ride  `phase-1` · [#7](https://github.com/sebastien15/Jali/issues/7)

Riders enter a destination, see nearby drivers with *their* price for this trip (DiDi-style), and request one driver or broadcast to all.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S3.1](stories/S3.1-where-to-start-a-ride-from-home.md) | [#38](https://github.com/sebastien15/Jali/issues/38) | "Where to?" — start a ride from Home | 1 | — | — |
| [S3.2](stories/S3.2-see-nearby-drivers-with-their-own-price.md) | [#39](https://github.com/sebastien15/Jali/issues/39) | See nearby drivers with their own price | 6 | S2.3, S5.1 | inDrive (driver offers) |
| [S3.3](stories/S3.3-map-of-nearby-drivers.md) | [#40](https://github.com/sebastien15/Jali/issues/40) | Map of nearby drivers | 7 | S3.2 | Uber, DiDi, Bolt |
| [S3.4](stories/S3.4-request-a-specific-driver.md) | [#41](https://github.com/sebastien15/Jali/issues/41) | Request a specific driver | 7 | S3.2, S0.4 | — |
| [S3.5](stories/S3.5-send-request-to-all-nearby-drivers.md) | [#42](https://github.com/sebastien15/Jali/issues/42) | Send request to all nearby drivers | 8 | S3.4 | inDrive |
| [S3.6](stories/S3.6-fare-estimate-before-choosing.md) | [#43](https://github.com/sebastien15/Jali/issues/43) | Fare estimate before choosing | 7 | S3.2 | Uber, Bolt |

## E4 — Live trip experience  `phase-1` · [#8](https://github.com/sebastien15/Jali/issues/8)

From accept to rating, both sides see the same live status, with PIN-verified pickup, fair cancellation rules, payment confirmation and history.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S4.1](stories/S4.1-track-my-driver-until-pickup.md) | [#44](https://github.com/sebastien15/Jali/issues/44) | Track my driver until pickup | 9 | S3.4, S5.2 | — |
| [S4.2](stories/S4.2-start-the-trip-with-a-pin.md) | [#45](https://github.com/sebastien15/Jali/issues/45) | Start the trip with a PIN | 10 | S4.1 | Uber (PIN verification) |
| [S4.3](stories/S4.3-cancellation-rules-and-fees.md) | [#46](https://github.com/sebastien15/Jali/issues/46) | Cancellation rules and fees | 8 | S3.4 | — |
| [S4.4](stories/S4.4-complete-trip-and-confirm-payment.md) | [#47](https://github.com/sebastien15/Jali/issues/47) | Complete trip and confirm payment | 11 | S4.2 | — |
| [S4.5](stories/S4.5-two-way-rating.md) | [#48](https://github.com/sebastien15/Jali/issues/48) | Two-way rating | 12 | S4.4 | — |
| [S4.6](stories/S4.6-ride-history-in-trips-tab.md) | [#49](https://github.com/sebastien15/Jali/issues/49) | Ride history in Trips tab | 12 | S4.4 | — |

## E5 — Driver app: online mode & earnings  `phase-1` · [#9](https://github.com/sebastien15/Jali/issues/9)

Drivers go online, receive and accept requests, navigate, and track earnings and commission owed.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S5.1](stories/S5.1-go-online-offline.md) | [#50](https://github.com/sebastien15/Jali/issues/50) | Go online / offline | 5 | S1.4, S2.1 | — |
| [S5.2](stories/S5.2-receive-and-accept-ride-requests.md) | [#51](https://github.com/sebastien15/Jali/issues/51) | Receive and accept ride requests | 8 | S5.1, S3.4 | — |
| [S5.3](stories/S5.3-navigate-to-pickup-and-destination.md) | [#52](https://github.com/sebastien15/Jali/issues/52) | Navigate to pickup and destination | 9 | S5.2 | — |
| [S5.4](stories/S5.4-earnings-and-commission-dashboard.md) | [#53](https://github.com/sebastien15/Jali/issues/53) | Earnings and commission dashboard | 13 | S7.2 | — |

## E6 — Hire a Driver  `phase-2` · [#10](https://github.com/sebastien15/Jali/issues/10)

Customers find and book a verified private driver to drive *their own* car — by the hour, day or trip.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S6.1](stories/S6.1-driver-sets-hire-a-driver-rates-and-skills.md) | [#54](https://github.com/sebastien15/Jali/issues/54) | Driver sets hire-a-driver rates and skills | 5 | S1.4 | — |
| [S6.2](stories/S6.2-driver-availability-calendar.md) | [#55](https://github.com/sebastien15/Jali/issues/55) | Driver availability calendar | 6 | S6.1 | — |
| [S6.3](stories/S6.3-find-and-book-a-driver-for-my-car.md) | [#56](https://github.com/sebastien15/Jali/issues/56) | Find and book a driver for my car | 7 | S6.2 | Chauffeur services |
| [S6.4](stories/S6.4-hire-lifecycle-accept-check-in-check-out-overtime.md) | [#57](https://github.com/sebastien15/Jali/issues/57) | Hire lifecycle: accept, check-in, check-out, overtime | 8 | S6.3 | — |

## E7 — Payments, receipts & commission  `phase-1` · [#11](https://github.com/sebastien15/Jali/issues/11)

Cash and MoMo at launch, commission ledger and driver payouts, then in-app MoMo and international cards.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S7.1](stories/S7.1-cash-and-momo-payment-to-driver-launch.md) | [#58](https://github.com/sebastien15/Jali/issues/58) | Cash and MoMo payment to driver (launch) | 12 | S4.4 | — |
| [S7.2](stories/S7.2-commission-ledger-settlement-and-driver-payouts.md) | [#59](https://github.com/sebastien15/Jali/issues/59) | Commission ledger, settlement and driver payouts | 12 | S4.4 | — |
| [S7.3](stories/S7.3-in-app-momo-and-international-card-payments.md) | [#60](https://github.com/sebastien15/Jali/issues/60) | In-app MoMo and international card payments | 13 | S7.1 | — |

## E8 — Safety & trust  `phase-1` · [#12](https://github.com/sebastien15/Jali/issues/12)

Riders, drivers and families trust Jali: trip sharing, SOS, audit trail and quality monitoring.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S8.1](stories/S8.1-share-my-trip.md) | [#61](https://github.com/sebastien15/Jali/issues/61) | Share my trip | 10 | S4.1 | Uber, Bolt |
| [S8.2](stories/S8.2-sos-emergency-button.md) | [#62](https://github.com/sebastien15/Jali/issues/62) | SOS emergency button | 10 | S4.1 | Uber, Bolt, DiDi |
| [S8.3](stories/S8.3-ride-audit-trail.md) | [#63](https://github.com/sebastien15/Jali/issues/63) | Ride audit trail | 8 | S3.4 | — |
| [S8.4](stories/S8.4-flag-low-rated-or-high-cancel-drivers.md) | [#64](https://github.com/sebastien15/Jali/issues/64) | Flag low-rated or high-cancel drivers | 13 | S4.5 | — |

## E9 — International experience — feels like Uber/DiDi  `phase-1` · [#13](https://github.com/sebastien15/Jali/issues/13)

A visitor who uses Uber or DiDi at home opens Jali in Kigali and instantly knows what to do: familiar flow, their language, their phone number, their card, email receipts, airport pickup.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S9.1](stories/S9.1-familiar-uber-didi-style-ride-flow-ux-benchmark.md) | [#65](https://github.com/sebastien15/Jali/issues/65) | Familiar Uber/DiDi-style ride flow (UX benchmark) | 2 | S3.1 | — |
| [S9.2](stories/S9.2-language-international-phone-numbers-and-email-log.md) | [#66](https://github.com/sebastien15/Jali/issues/66) | Language, international phone numbers and email login | 1 | — | — |
| [S9.3](stories/S9.3-sign-in-with-apple.md) | [#67](https://github.com/sebastien15/Jali/issues/67) | Sign in with Apple | 1 | — | — |
| [S9.4](stories/S9.4-show-prices-in-my-home-currency-too.md) | [#68](https://github.com/sebastien15/Jali/issues/68) | Show prices in my home currency too | 8 | S3.6 | — |
| [S9.5](stories/S9.5-in-app-chat-with-quick-translated-phrases.md) | [#69](https://github.com/sebastien15/Jali/issues/69) | In-app chat with quick, translated phrases | 10 | S4.1 | Uber (translated messages) |
| [S9.6](stories/S9.6-email-receipts-for-every-trip.md) | [#70](https://github.com/sebastien15/Jali/issues/70) | Email receipts for every trip | 12 | S4.4 | — |
| [S9.7](stories/S9.7-airport-pickup-at-kigali-international-airport.md) | [#71](https://github.com/sebastien15/Jali/issues/71) | Airport pickup at Kigali International Airport | 9 | S13.1, S11.4 | Uber Reserve |

## E10 — Admin operations for rides  `phase-1` · [#14](https://github.com/sebastien15/Jali/issues/14)

Admins can watch live operations, investigate rides, resolve disputes and see ride analytics.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S10.1](stories/S10.1-live-operations-view.md) | [#72](https://github.com/sebastien15/Jali/issues/72) | Live operations view | 6 | S5.1 | — |
| [S10.2](stories/S10.2-rides-list-detail-and-dispute-handling.md) | [#73](https://github.com/sebastien15/Jali/issues/73) | Rides list, detail and dispute handling | 9 | S8.3 | — |
| [S10.3](stories/S10.3-ride-analytics.md) | [#74](https://github.com/sebastien15/Jali/issues/74) | Ride analytics | 12 | S4.4 | — |
| [S10.4](stories/S10.4-service-areas-cities-geofences.md) | [#75](https://github.com/sebastien15/Jali/issues/75) | Service areas, cities & geofences | 2 | S0.3 | — |

## E11 — Maps, places & routing  `phase-2` · [#15](https://github.com/sebastien15/Jali/issues/15)

Road-accurate distance and ETA, route lines, smooth car movement and pickup points that work in a city with few formal addresses.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S11.1](stories/S11.1-road-based-distance-and-eta.md) | [#76](https://github.com/sebastien15/Jali/issues/76) | Road-based distance and ETA | 5 | S2.3 | — |
| [S11.2](stories/S11.2-route-line-on-the-map.md) | [#77](https://github.com/sebastien15/Jali/issues/77) | Route line on the map | 8 | S3.3, S11.1 | — |
| [S11.3](stories/S11.3-smooth-moving-car-on-the-map.md) | [#78](https://github.com/sebastien15/Jali/issues/78) | Smooth moving car on the map | 11 | S3.3, S12.1 | Uber |
| [S11.4](stories/S11.4-suggested-pickup-points-and-landmarks.md) | [#79](https://github.com/sebastien15/Jali/issues/79) | Suggested pickup points and landmarks | 3 | S3.1, S10.4 | Uber, Bolt |
| [S11.5](stories/S11.5-saved-places-with-labels-and-driver-notes.md) | [#80](https://github.com/sebastien15/Jali/issues/80) | Saved places with labels and driver notes | 2 | S3.1 | — |
| [S11.6](stories/S11.6-describe-or-photograph-my-pickup-spot.md) | [#81](https://github.com/sebastien15/Jali/issues/81) | Describe or photograph my pickup spot | 10 | S4.1 | — |
| [S11.7](stories/S11.7-live-eta-countdown.md) | [#82](https://github.com/sebastien15/Jali/issues/82) | Live ETA countdown | 10 | S11.1, S4.1 | Uber |

## E12 — Realtime infrastructure  `phase-2` · [#16](https://github.com/sebastien15/Jali/issues/16)

Instant, reliable updates for riders and drivers via WebSockets, with recovery after network loss or app restarts.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S12.1](stories/S12.1-websockets-with-laravel-reverb.md) | [#83](https://github.com/sebastien15/Jali/issues/83) | WebSockets with Laravel Reverb | 10 | S4.1 | — |
| [S12.2](stories/S12.2-recover-trip-state-after-network-loss-or-app-kill.md) | [#84](https://github.com/sebastien15/Jali/issues/84) | Recover trip state after network loss or app kill | 10 | S4.1 | — |
| [S12.3](stories/S12.3-reliable-notifications.md) | [#85](https://github.com/sebastien15/Jali/issues/85) | Reliable notifications | 2 | S0.4 | — |

## E13 — More ways to ride  `phase-2` · [#17](https://github.com/sebastien15/Jali/issues/17)

Every ride option people expect from Uber, Bolt, DiDi and inDrive: scheduled, for others, multi-stop, hourly, intercity, preferences.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S13.1](stories/S13.1-schedule-a-ride-in-advance.md) | [#86](https://github.com/sebastien15/Jali/issues/86) | Schedule a ride in advance | 8 | S3.4 | Uber Reserve, Bolt |
| [S13.2](stories/S13.2-book-a-ride-for-someone-else.md) | [#87](https://github.com/sebastien15/Jali/issues/87) | Book a ride for someone else | 8 | S3.4 | Uber |
| [S13.3](stories/S13.3-multiple-stops.md) | [#88](https://github.com/sebastien15/Jali/issues/88) | Multiple stops | 8 | S2.3, S3.4 | Uber, Bolt |
| [S13.4](stories/S13.4-change-destination-during-the-trip.md) | [#89](https://github.com/sebastien15/Jali/issues/89) | Change destination during the trip | 12 | S4.4 | Uber |
| [S13.5](stories/S13.5-ride-preferences.md) | [#90](https://github.com/sebastien15/Jali/issues/90) | Ride preferences | 7 | S3.2 | Uber Comfort |
| [S13.6](stories/S13.6-women-only-option.md) | [#91](https://github.com/sebastien15/Jali/issues/91) | Women-only option | 7 | S3.2, S1.2 | DiDi Mujer, Bolt (some markets) |
| [S13.7](stories/S13.7-hourly-ride-with-driver-s-car.md) | [#92](https://github.com/sebastien15/Jali/issues/92) | Hourly ride with driver's car | 8 | S6.1, S3.4 | Uber Hourly |
| [S13.8](stories/S13.8-on-demand-intercity-rides.md) | [#93](https://github.com/sebastien15/Jali/issues/93) | On-demand intercity rides | 8 | S3.4, S11.1 | inDrive Intercity |
| [S13.9](stories/S13.9-child-seat-wheelchair-friendly-and-pet-friendly-ve.md) | [#94](https://github.com/sebastien15/Jali/issues/94) | Child seat, wheelchair-friendly and pet-friendly vehicles | 7 | S1.3, S3.2 | Careem (child seat), Uber Pet, Uber WAV |
| [S13.10](stories/S13.10-wait-save-priority-pickup.md) | [#95](https://github.com/sebastien15/Jali/issues/95) | Wait & save / priority pickup | 9 | S3.5 | Uber Wait & Save, Lyft Priority Pickup |

## E14 — Pricing, offers, wallet & rewards  `phase-2` · [#18](https://github.com/sebastien15/Jali/issues/18)

Rider price offers, promos, referrals, tipping, split fare, Jali Wallet, subscription and loyalty.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S14.1](stories/S14.1-rider-offers-a-price-drivers-accept-or-counter.md) | [#96](https://github.com/sebastien15/Jali/issues/96) | Rider offers a price, drivers accept or counter | 9 | S3.5 | inDrive |
| [S14.2](stories/S14.2-promo-codes.md) | [#97](https://github.com/sebastien15/Jali/issues/97) | Promo codes | 13 | S2.3, S7.2 | all |
| [S14.3](stories/S14.3-referral-program.md) | [#98](https://github.com/sebastien15/Jali/issues/98) | Referral program | 14 | S14.2 | all |
| [S14.4](stories/S14.4-tipping.md) | [#99](https://github.com/sebastien15/Jali/issues/99) | Tipping | 15 | S14.6 | Uber |
| [S14.5](stories/S14.5-split-fare.md) | [#100](https://github.com/sebastien15/Jali/issues/100) | Split fare | 15 | S14.6 | Uber |
| [S14.6](stories/S14.6-jali-wallet.md) | [#101](https://github.com/sebastien15/Jali/issues/101) | Jali Wallet | 14 | S7.3 | GrabPay, Careem Pay |
| [S14.7](stories/S14.7-jali-pass-subscription.md) | [#102](https://github.com/sebastien15/Jali/issues/102) | Jali Pass subscription | 15 | S14.6 | Uber One, Careem Plus |
| [S14.8](stories/S14.8-loyalty-points-and-member-levels.md) | [#103](https://github.com/sebastien15/Jali/issues/103) | Loyalty points and member levels | 15 | S14.6 | DiDi Rewards, GrabRewards |

## E15 — Rider account & convenience  `phase-2` · [#19](https://github.com/sebastien15/Jali/issues/19)

Favourites, business and family profiles, lost items, accessibility, onboarding and store-mandated account controls.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S15.1](stories/S15.1-favourite-drivers.md) | [#104](https://github.com/sebastien15/Jali/issues/104) | Favourite drivers | 13 | S4.5 | — |
| [S15.2](stories/S15.2-business-profile-and-expense-reports.md) | [#105](https://github.com/sebastien15/Jali/issues/105) | Business profile and expense reports | 13 | S9.6 | Uber business profile |
| [S15.3](stories/S15.3-family-profile.md) | [#106](https://github.com/sebastien15/Jali/issues/106) | Family profile | 15 | S14.6 | Uber Family |
| [S15.4](stories/S15.4-notification-preferences.md) | [#107](https://github.com/sebastien15/Jali/issues/107) | Notification preferences | 2 | S0.4 | — |
| [S15.5](stories/S15.5-report-a-lost-item.md) | [#108](https://github.com/sebastien15/Jali/issues/108) | Report a lost item | 11 | S16.1 | Uber |
| [S15.6](stories/S15.6-delete-my-account-and-export-my-data.md) | [#109](https://github.com/sebastien15/Jali/issues/109) | Delete my account and export my data | 1 | — | — |
| [S15.7](stories/S15.7-dark-mode-and-accessibility.md) | [#110](https://github.com/sebastien15/Jali/issues/110) | Dark mode and accessibility | 1 | — | — |
| [S15.8](stories/S15.8-first-time-onboarding.md) | [#111](https://github.com/sebastien15/Jali/issues/111) | First-time onboarding | 2 | S3.1 | — |

## E16 — Communication & customer support  `phase-2` · [#20](https://github.com/sebastien15/Jali/issues/20)

Masked calls, help centre, support tickets, live agent chat, fare reviews and refunds.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S16.1](stories/S16.1-masked-phone-calls.md) | [#112](https://github.com/sebastien15/Jali/issues/112) | Masked phone calls | 10 | S4.1 | Uber, Bolt |
| [S16.2](stories/S16.2-help-centre-with-trip-specific-help.md) | [#113](https://github.com/sebastien15/Jali/issues/113) | Help centre with trip-specific help | 1 | — | Uber |
| [S16.3](stories/S16.3-support-tickets-and-live-chat-with-an-agent.md) | [#114](https://github.com/sebastien15/Jali/issues/114) | Support tickets and live chat with an agent | 2 | S16.2 | — |
| [S16.4](stories/S16.4-fare-review-and-refunds.md) | [#115](https://github.com/sebastien15/Jali/issues/115) | Fare review and refunds | 15 | S14.6, S10.2 | — |

## E17 — Driver tools & growth  `phase-2` · [#21](https://github.com/sebastien15/Jali/issues/21)

Demand heatmap, destination filter, incentives, queues, fatigue limits, instant cashout and training — what keeps drivers loyal.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S17.1](stories/S17.1-demand-heatmap-for-drivers.md) | [#116](https://github.com/sebastien15/Jali/issues/116) | Demand heatmap for drivers | 8 | S3.4 | Uber, Bolt |
| [S17.2](stories/S17.2-destination-filter-going-home.md) | [#117](https://github.com/sebastien15/Jali/issues/117) | Destination filter — going home | 9 | S5.2 | Uber |
| [S17.3](stories/S17.3-driver-incentives-and-quests.md) | [#118](https://github.com/sebastien15/Jali/issues/118) | Driver incentives and quests | 13 | S7.2 | Uber Quests |
| [S17.4](stories/S17.4-driver-levels-and-rewards.md) | [#119](https://github.com/sebastien15/Jali/issues/119) | Driver levels and rewards | 14 | S17.3 | Uber Pro |
| [S17.5](stories/S17.5-airport-and-venue-queue.md) | [#120](https://github.com/sebastien15/Jali/issues/120) | Airport and venue queue | 9 | S10.4, S5.2 | Uber airport queue |
| [S17.6](stories/S17.6-fatigue-limit.md) | [#121](https://github.com/sebastien15/Jali/issues/121) | Fatigue limit | 6 | S5.1 | Uber |
| [S17.7](stories/S17.7-document-expiry-reminders.md) | [#122](https://github.com/sebastien15/Jali/issues/122) | Document expiry reminders | 4 | S1.2 | — |
| [S17.8](stories/S17.8-instant-cashout-to-momo.md) | [#123](https://github.com/sebastien15/Jali/issues/123) | Instant cashout to MoMo | 14 | S7.2, S7.3 | — |
| [S17.9](stories/S17.9-next-trip-before-finishing-the-current-one.md) | [#124](https://github.com/sebastien15/Jali/issues/124) | Next trip before finishing the current one | 9 | S5.2 | Uber |
| [S17.10](stories/S17.10-driver-training-and-quiz.md) | [#125](https://github.com/sebastien15/Jali/issues/125) | Driver training and quiz | 5 | S1.4 | — |

## E18 — Advanced safety  `phase-2` · [#22](https://github.com/sebastien15/Jali/issues/22)

Identity checks, anomaly detection, audio recording, driving-behaviour alerts and a safety toolkit.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S18.1](stories/S18.1-driver-selfie-check-before-going-online.md) | [#126](https://github.com/sebastien15/Jali/issues/126) | Driver selfie check before going online | 6 | S1.2, S5.1 | Uber Real-Time ID Check |
| [S18.2](stories/S18.2-trip-anomaly-detection.md) | [#127](https://github.com/sebastien15/Jali/issues/127) | Trip anomaly detection | 11 | S4.2, S11.1 | Uber RideCheck |
| [S18.3](stories/S18.3-audio-recording-during-the-trip.md) | [#128](https://github.com/sebastien15/Jali/issues/128) | Audio recording during the trip | 11 | S4.2 | DiDi, Uber |
| [S18.4](stories/S18.4-trusted-contacts-auto-share.md) | [#129](https://github.com/sebastien15/Jali/issues/129) | Trusted contacts auto-share | 11 | S8.1 | — |
| [S18.5](stories/S18.5-driving-behaviour-alerts.md) | [#130](https://github.com/sebastien15/Jali/issues/130) | Driving behaviour alerts | 11 | S4.2 | Uber |
| [S18.6](stories/S18.6-rider-verification-for-driver-safety.md) | [#131](https://github.com/sebastien15/Jali/issues/131) | Rider verification for driver safety | 9 | S5.2 | — |
| [S18.7](stories/S18.7-safety-toolkit.md) | [#132](https://github.com/sebastien15/Jali/issues/132) | Safety toolkit | 11 | S8.1, S8.2 | Uber Safety Toolkit |

## E19 — Fleets & business partners  `phase-3` · [#23](https://github.com/sebastien15/Jali/issues/23)

Fleet owners, company accounts, hotel concierge booking and a partner API.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S19.1](stories/S19.1-fleet-owner-portal.md) | [#133](https://github.com/sebastien15/Jali/issues/133) | Fleet owner portal | 13 | S1.3, S7.2 | Bolt Fleet |
| [S19.2](stories/S19.2-jali-for-business.md) | [#134](https://github.com/sebastien15/Jali/issues/134) | Jali for Business | 14 | S15.2 | Uber for Business |
| [S19.3](stories/S19.3-hotel-and-concierge-booking.md) | [#135](https://github.com/sebastien15/Jali/issues/135) | Hotel and concierge booking | 9 | S13.2 | Uber Central |
| [S19.4](stories/S19.4-partner-api.md) | [#136](https://github.com/sebastien15/Jali/issues/136) | Partner API | 2 | S21.9 | Uber API |

## E20 — Jali Send — package delivery  `phase-3` · [#24](https://github.com/sebastien15/Jali/issues/24)

Send packages across the city by moto or car with proof of delivery.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S20.1](stories/S20.1-send-a-package.md) | [#137](https://github.com/sebastien15/Jali/issues/137) | Send a package | 8 | S3.4 | Uber Connect, Bolt Send, inDrive Courier |
| [S20.2](stories/S20.2-delivery-pin-for-recipient.md) | [#138](https://github.com/sebastien15/Jali/issues/138) | Delivery PIN for recipient | 9 | S20.1 | — |
| [S20.3](stories/S20.3-package-categories-and-prohibited-items.md) | [#139](https://github.com/sebastien15/Jali/issues/139) | Package categories and prohibited items | 9 | S20.1 | — |

## E21 — Platform quality, security & compliance  `phase-1` · [#25](https://github.com/sebastien15/Jali/issues/25)

Monitoring, CI, staging with simulated drivers, load tests, fraud prevention, data protection and an API contract that allows a future Rust backend.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S21.1](stories/S21.1-crash-reporting-and-performance-monitoring.md) | [#140](https://github.com/sebastien15/Jali/issues/140) | Crash reporting and performance monitoring | 1 | — | — |
| [S21.2](stories/S21.2-backend-monitoring-and-alerts.md) | [#141](https://github.com/sebastien15/Jali/issues/141) | Backend monitoring and alerts | 1 | — | — |
| [S21.3](stories/S21.3-automated-checks-on-every-pull-request.md) | [#142](https://github.com/sebastien15/Jali/issues/142) | Automated checks on every pull request | 1 | — | — |
| [S21.4](stories/S21.4-staging-environment-with-simulated-drivers.md) | [#143](https://github.com/sebastien15/Jali/issues/143) | Staging environment with simulated drivers | 6 | S5.1 | — |
| [S21.5](stories/S21.5-load-testing.md) | [#144](https://github.com/sebastien15/Jali/issues/144) | Load testing | 7 | S3.2 | — |
| [S21.6](stories/S21.6-fraud-prevention.md) | [#145](https://github.com/sebastien15/Jali/issues/145) | Fraud prevention | 6 | S5.1 | — |
| [S21.7](stories/S21.7-rate-limiting-and-abuse-protection.md) | [#146](https://github.com/sebastien15/Jali/issues/146) | Rate limiting and abuse protection | 1 | — | — |
| [S21.8](stories/S21.8-data-protection-compliance.md) | [#147](https://github.com/sebastien15/Jali/issues/147) | Data protection compliance | 1 | — | — |
| [S21.9](stories/S21.9-api-contract-openapi-as-source-of-truth.md) | [#148](https://github.com/sebastien15/Jali/issues/148) | API contract (OpenAPI) as source of truth | 1 | — | — |
| [S21.10](stories/S21.10-feature-flags-and-remote-config.md) | [#149](https://github.com/sebastien15/Jali/issues/149) | Feature flags and remote config | 2 | S0.3 | — |
| [S21.11](stories/S21.11-backups-and-disaster-recovery.md) | [#150](https://github.com/sebastien15/Jali/issues/150) | Backups and disaster recovery | 1 | — | — |
| [S21.12](stories/S21.12-performance-on-low-end-android.md) | [#151](https://github.com/sebastien15/Jali/issues/151) | Performance on low-end Android | 1 | — | — |

## E22 — Growth & marketing  `phase-3` · [#26](https://github.com/sebastien15/Jali/issues/26)

Deep links, campaigns, app-store ratings and a web booking page.

| ID | Issue | Story | Wave | Depends on | Inspired by |
|---|---|---|---|---|---|
| [S22.1](stories/S22.1-deep-links-and-sharing.md) | [#152](https://github.com/sebastien15/Jali/issues/152) | Deep links and sharing | 14 | S14.2 | — |
| [S22.2](stories/S22.2-segmented-push-campaigns.md) | [#153](https://github.com/sebastien15/Jali/issues/153) | Segmented push campaigns | 3 | S15.4 | — |
| [S22.3](stories/S22.3-in-app-store-rating-prompt.md) | [#154](https://github.com/sebastien15/Jali/issues/154) | In-app store rating prompt | 13 | S4.5 | — |
| [S22.4](stories/S22.4-web-booking-page.md) | [#155](https://github.com/sebastien15/Jali/issues/155) | Web booking page | 8 | S3.4, S21.9 | — |
