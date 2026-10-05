#!/usr/bin/env bash
# Creates the Jali Ride user stories as GitHub issues (epics first, then stories linked to them).
# Usage: scripts/create-ride-issues.sh [owner/repo]   (requires: gh auth login)
set -euo pipefail
REPO="${1:-sebastien15/Jali}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/docs/ride-hailing/stories"

ensure_label() { gh label create "$1" --repo "$REPO" --color "$2" --force >/dev/null; }
for l in epic:5319e7 user-story:0e8a16 ride-hailing:0055cc phase-0:c5def5 phase-1:bfd4f2 phase-2:d4c5f9 \
         backend:1d76db mobile:009e8e admin:7c3aed ux:fbca04 payments:00a63e pricing:ff5c00 \
         safety:b60205 security:b60205 international:0e8a16 analytics:c2e0c6 bug:d73a4a tech-debt:cccccc; do
  ensure_label "${l%%:*}" "${l##*:}"
done

declare -A EPIC_NUM
create() { # title labels file -> prints issue number
  local url; url=$(gh issue create --repo "$REPO" --title "$1" --label "$2" --body-file "$3")
  echo "${url##*/}"
}

EPIC_NUM[E0]=$(create "[Epic] E0 — Foundations for on-demand rides" "epic,ride-hailing,phase-0" "$DIR/E0-epic.md"); echo "#${EPIC_NUM[E0]} [Epic] E0 — Foundations for on-demand rides"
EPIC_NUM[E1]=$(create "[Epic] E1 — Driver onboarding & verification" "epic,ride-hailing,phase-1" "$DIR/E1-epic.md"); echo "#${EPIC_NUM[E1]} [Epic] E1 — Driver onboarding & verification"
EPIC_NUM[E2]=$(create "[Epic] E2 — Driver-set pricing" "epic,ride-hailing,phase-1" "$DIR/E2-epic.md"); echo "#${EPIC_NUM[E2]} [Epic] E2 — Driver-set pricing"
EPIC_NUM[E3]=$(create "[Epic] E3 — Rider: discover nearby drivers & request a ride" "epic,ride-hailing,phase-1" "$DIR/E3-epic.md"); echo "#${EPIC_NUM[E3]} [Epic] E3 — Rider: discover nearby drivers & request a ride"
EPIC_NUM[E4]=$(create "[Epic] E4 — Live trip experience" "epic,ride-hailing,phase-1" "$DIR/E4-epic.md"); echo "#${EPIC_NUM[E4]} [Epic] E4 — Live trip experience"
EPIC_NUM[E5]=$(create "[Epic] E5 — Driver app: online mode & earnings" "epic,ride-hailing,phase-1" "$DIR/E5-epic.md"); echo "#${EPIC_NUM[E5]} [Epic] E5 — Driver app: online mode & earnings"
EPIC_NUM[E6]=$(create "[Epic] E6 — Hire a Driver" "epic,ride-hailing,phase-2" "$DIR/E6-epic.md"); echo "#${EPIC_NUM[E6]} [Epic] E6 — Hire a Driver"
EPIC_NUM[E7]=$(create "[Epic] E7 — Payments, receipts & commission" "epic,ride-hailing,phase-1" "$DIR/E7-epic.md"); echo "#${EPIC_NUM[E7]} [Epic] E7 — Payments, receipts & commission"
EPIC_NUM[E8]=$(create "[Epic] E8 — Safety & trust" "epic,ride-hailing,phase-1" "$DIR/E8-epic.md"); echo "#${EPIC_NUM[E8]} [Epic] E8 — Safety & trust"
EPIC_NUM[E9]=$(create "[Epic] E9 — International experience — feels like Uber/DiDi" "epic,ride-hailing,phase-1" "$DIR/E9-epic.md"); echo "#${EPIC_NUM[E9]} [Epic] E9 — International experience — feels like Uber/DiDi"
EPIC_NUM[E10]=$(create "[Epic] E10 — Admin operations for rides" "epic,ride-hailing,phase-1" "$DIR/E10-epic.md"); echo "#${EPIC_NUM[E10]} [Epic] E10 — Admin operations for rides"
tmp=$(mktemp); { cat "$DIR/S0.1-fix-driver-setup-data-is-silently-discarded.md"; echo; echo "Part of #${EPIC_NUM[E0]}"; } > "$tmp"
n=$(create "S0.1 Fix: driver setup data is silently discarded" "user-story,ride-hailing,phase-0,bug,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S0.1 Fix: driver setup data is silently discarded"
gh issue comment "${EPIC_NUM[E0]}" --repo "$REPO" --body "- [ ] #$n S0.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S0.2-driver-mode-survives-app-restarts.md"; echo; echo "Part of #${EPIC_NUM[E0]}"; } > "$tmp"
n=$(create "S0.2 Driver mode survives app restarts" "user-story,ride-hailing,phase-0,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S0.2 Driver mode survives app restarts"
gh issue comment "${EPIC_NUM[E0]}" --repo "$REPO" --body "- [ ] #$n S0.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S0.3-seed-ride-hailing-permissions.md"; echo; echo "Part of #${EPIC_NUM[E0]}"; } > "$tmp"
n=$(create "S0.3 Seed ride-hailing permissions" "user-story,ride-hailing,phase-0,backend,security" "$tmp"); rm -f "$tmp"; echo "#$n S0.3 Seed ride-hailing permissions"
gh issue comment "${EPIC_NUM[E0]}" --repo "$REPO" --body "- [ ] #$n S0.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S0.4-reusable-push-notification-service.md"; echo; echo "Part of #${EPIC_NUM[E0]}"; } > "$tmp"
n=$(create "S0.4 Reusable push notification service" "user-story,ride-hailing,phase-0,backend,tech-debt" "$tmp"); rm -f "$tmp"; echo "#$n S0.4 Reusable push notification service"
gh issue comment "${EPIC_NUM[E0]}" --repo "$REPO" --body "- [ ] #$n S0.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S1.1-become-a-driver-and-choose-services.md"; echo; echo "Part of #${EPIC_NUM[E1]}"; } > "$tmp"
n=$(create "S1.1 Become a driver and choose services" "user-story,ride-hailing,phase-1,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S1.1 Become a driver and choose services"
gh issue comment "${EPIC_NUM[E1]}" --repo "$REPO" --body "- [ ] #$n S1.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S1.2-upload-driver-documents.md"; echo; echo "Part of #${EPIC_NUM[E1]}"; } > "$tmp"
n=$(create "S1.2 Upload driver documents" "user-story,ride-hailing,phase-1,mobile,backend,security" "$tmp"); rm -f "$tmp"; echo "#$n S1.2 Upload driver documents"
gh issue comment "${EPIC_NUM[E1]}" --repo "$REPO" --body "- [ ] #$n S1.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S1.3-register-my-vehicles.md"; echo; echo "Part of #${EPIC_NUM[E1]}"; } > "$tmp"
n=$(create "S1.3 Register my vehicles" "user-story,ride-hailing,phase-1,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S1.3 Register my vehicles"
gh issue comment "${EPIC_NUM[E1]}" --repo "$REPO" --body "- [ ] #$n S1.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S1.4-admin-verification-queue-for-drivers.md"; echo; echo "Part of #${EPIC_NUM[E1]}"; } > "$tmp"
n=$(create "S1.4 Admin verification queue for drivers" "user-story,ride-hailing,phase-1,admin,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S1.4 Admin verification queue for drivers"
gh issue comment "${EPIC_NUM[E1]}" --repo "$REPO" --body "- [ ] #$n S1.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S2.1-driver-sets-own-per-km-rates-with-live-preview.md"; echo; echo "Part of #${EPIC_NUM[E2]}"; } > "$tmp"
n=$(create "S2.1 Driver sets own per-km rates with live preview" "user-story,ride-hailing,phase-1,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S2.1 Driver sets own per-km rates with live preview"
gh issue comment "${EPIC_NUM[E2]}" --repo "$REPO" --body "- [ ] #$n S2.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S2.2-superadmin-configures-pricing-guardrails--commissi.md"; echo; echo "Part of #${EPIC_NUM[E2]}"; } > "$tmp"
n=$(create "S2.2 Superadmin configures pricing guardrails & commission" "user-story,ride-hailing,phase-1,admin,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S2.2 Superadmin configures pricing guardrails & commission"
gh issue comment "${EPIC_NUM[E2]}" --repo "$REPO" --body "- [ ] #$n S2.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S2.3-server-side-fare-quote-and-price-lock.md"; echo; echo "Part of #${EPIC_NUM[E2]}"; } > "$tmp"
n=$(create "S2.3 Server-side fare quote and price lock" "user-story,ride-hailing,phase-1,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S2.3 Server-side fare quote and price lock"
gh issue comment "${EPIC_NUM[E2]}" --repo "$REPO" --body "- [ ] #$n S2.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S3.1-where-to---start-a-ride-from-home.md"; echo; echo "Part of #${EPIC_NUM[E3]}"; } > "$tmp"
n=$(create "S3.1 \"Where to?\" — start a ride from Home" "user-story,ride-hailing,phase-1,mobile,ux" "$tmp"); rm -f "$tmp"; echo "#$n S3.1 \"Where to?\" — start a ride from Home"
gh issue comment "${EPIC_NUM[E3]}" --repo "$REPO" --body "- [ ] #$n S3.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S3.2-see-nearby-drivers-with-their-own-price.md"; echo; echo "Part of #${EPIC_NUM[E3]}"; } > "$tmp"
n=$(create "S3.2 See nearby drivers with their own price" "user-story,ride-hailing,phase-1,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S3.2 See nearby drivers with their own price"
gh issue comment "${EPIC_NUM[E3]}" --repo "$REPO" --body "- [ ] #$n S3.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S3.3-map-of-nearby-drivers.md"; echo; echo "Part of #${EPIC_NUM[E3]}"; } > "$tmp"
n=$(create "S3.3 Map of nearby drivers" "user-story,ride-hailing,phase-2,mobile,ux" "$tmp"); rm -f "$tmp"; echo "#$n S3.3 Map of nearby drivers"
gh issue comment "${EPIC_NUM[E3]}" --repo "$REPO" --body "- [ ] #$n S3.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S3.4-request-a-specific-driver.md"; echo; echo "Part of #${EPIC_NUM[E3]}"; } > "$tmp"
n=$(create "S3.4 Request a specific driver" "user-story,ride-hailing,phase-1,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S3.4 Request a specific driver"
gh issue comment "${EPIC_NUM[E3]}" --repo "$REPO" --body "- [ ] #$n S3.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S3.5-send-request-to-all-nearby-drivers.md"; echo; echo "Part of #${EPIC_NUM[E3]}"; } > "$tmp"
n=$(create "S3.5 Send request to all nearby drivers" "user-story,ride-hailing,phase-2,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S3.5 Send request to all nearby drivers"
gh issue comment "${EPIC_NUM[E3]}" --repo "$REPO" --body "- [ ] #$n S3.5" >/dev/null
tmp=$(mktemp); { cat "$DIR/S3.6-fare-estimate-before-choosing.md"; echo; echo "Part of #${EPIC_NUM[E3]}"; } > "$tmp"
n=$(create "S3.6 Fare estimate before choosing" "user-story,ride-hailing,phase-1,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S3.6 Fare estimate before choosing"
gh issue comment "${EPIC_NUM[E3]}" --repo "$REPO" --body "- [ ] #$n S3.6" >/dev/null
tmp=$(mktemp); { cat "$DIR/S4.1-track-my-driver-until-pickup.md"; echo; echo "Part of #${EPIC_NUM[E4]}"; } > "$tmp"
n=$(create "S4.1 Track my driver until pickup" "user-story,ride-hailing,phase-1,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S4.1 Track my driver until pickup"
gh issue comment "${EPIC_NUM[E4]}" --repo "$REPO" --body "- [ ] #$n S4.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S4.2-start-the-trip-with-a-pin.md"; echo; echo "Part of #${EPIC_NUM[E4]}"; } > "$tmp"
n=$(create "S4.2 Start the trip with a PIN" "user-story,ride-hailing,phase-1,mobile,backend,security" "$tmp"); rm -f "$tmp"; echo "#$n S4.2 Start the trip with a PIN"
gh issue comment "${EPIC_NUM[E4]}" --repo "$REPO" --body "- [ ] #$n S4.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S4.3-cancellation-rules-and-fees.md"; echo; echo "Part of #${EPIC_NUM[E4]}"; } > "$tmp"
n=$(create "S4.3 Cancellation rules and fees" "user-story,ride-hailing,phase-1,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S4.3 Cancellation rules and fees"
gh issue comment "${EPIC_NUM[E4]}" --repo "$REPO" --body "- [ ] #$n S4.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S4.4-complete-trip-and-confirm-payment.md"; echo; echo "Part of #${EPIC_NUM[E4]}"; } > "$tmp"
n=$(create "S4.4 Complete trip and confirm payment" "user-story,ride-hailing,phase-1,mobile,backend,payments" "$tmp"); rm -f "$tmp"; echo "#$n S4.4 Complete trip and confirm payment"
gh issue comment "${EPIC_NUM[E4]}" --repo "$REPO" --body "- [ ] #$n S4.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S4.5-two-way-rating.md"; echo; echo "Part of #${EPIC_NUM[E4]}"; } > "$tmp"
n=$(create "S4.5 Two-way rating" "user-story,ride-hailing,phase-1,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S4.5 Two-way rating"
gh issue comment "${EPIC_NUM[E4]}" --repo "$REPO" --body "- [ ] #$n S4.5" >/dev/null
tmp=$(mktemp); { cat "$DIR/S4.6-ride-history-in-trips-tab.md"; echo; echo "Part of #${EPIC_NUM[E4]}"; } > "$tmp"
n=$(create "S4.6 Ride history in Trips tab" "user-story,ride-hailing,phase-1,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S4.6 Ride history in Trips tab"
gh issue comment "${EPIC_NUM[E4]}" --repo "$REPO" --body "- [ ] #$n S4.6" >/dev/null
tmp=$(mktemp); { cat "$DIR/S5.1-go-online--offline.md"; echo; echo "Part of #${EPIC_NUM[E5]}"; } > "$tmp"
n=$(create "S5.1 Go online / offline" "user-story,ride-hailing,phase-1,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S5.1 Go online / offline"
gh issue comment "${EPIC_NUM[E5]}" --repo "$REPO" --body "- [ ] #$n S5.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S5.2-receive-and-accept-ride-requests.md"; echo; echo "Part of #${EPIC_NUM[E5]}"; } > "$tmp"
n=$(create "S5.2 Receive and accept ride requests" "user-story,ride-hailing,phase-1,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S5.2 Receive and accept ride requests"
gh issue comment "${EPIC_NUM[E5]}" --repo "$REPO" --body "- [ ] #$n S5.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S5.3-navigate-to-pickup-and-destination.md"; echo; echo "Part of #${EPIC_NUM[E5]}"; } > "$tmp"
n=$(create "S5.3 Navigate to pickup and destination" "user-story,ride-hailing,phase-1,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S5.3 Navigate to pickup and destination"
gh issue comment "${EPIC_NUM[E5]}" --repo "$REPO" --body "- [ ] #$n S5.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S5.4-earnings-and-commission-dashboard.md"; echo; echo "Part of #${EPIC_NUM[E5]}"; } > "$tmp"
n=$(create "S5.4 Earnings and commission dashboard" "user-story,ride-hailing,phase-1,mobile,backend,payments" "$tmp"); rm -f "$tmp"; echo "#$n S5.4 Earnings and commission dashboard"
gh issue comment "${EPIC_NUM[E5]}" --repo "$REPO" --body "- [ ] #$n S5.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S6.1-driver-sets-hire-a-driver-rates-and-skills.md"; echo; echo "Part of #${EPIC_NUM[E6]}"; } > "$tmp"
n=$(create "S6.1 Driver sets hire-a-driver rates and skills" "user-story,ride-hailing,phase-2,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S6.1 Driver sets hire-a-driver rates and skills"
gh issue comment "${EPIC_NUM[E6]}" --repo "$REPO" --body "- [ ] #$n S6.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S6.2-driver-availability-calendar.md"; echo; echo "Part of #${EPIC_NUM[E6]}"; } > "$tmp"
n=$(create "S6.2 Driver availability calendar" "user-story,ride-hailing,phase-2,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S6.2 Driver availability calendar"
gh issue comment "${EPIC_NUM[E6]}" --repo "$REPO" --body "- [ ] #$n S6.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S6.3-find-and-book-a-driver-for-my-car.md"; echo; echo "Part of #${EPIC_NUM[E6]}"; } > "$tmp"
n=$(create "S6.3 Find and book a driver for my car" "user-story,ride-hailing,phase-2,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S6.3 Find and book a driver for my car"
gh issue comment "${EPIC_NUM[E6]}" --repo "$REPO" --body "- [ ] #$n S6.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S6.4-hire-lifecycle-accept-check-in-check-out-overtime.md"; echo; echo "Part of #${EPIC_NUM[E6]}"; } > "$tmp"
n=$(create "S6.4 Hire lifecycle: accept, check-in, check-out, overtime" "user-story,ride-hailing,phase-2,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S6.4 Hire lifecycle: accept, check-in, check-out, overtime"
gh issue comment "${EPIC_NUM[E6]}" --repo "$REPO" --body "- [ ] #$n S6.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S7.1-cash-and-momo-payment-to-driver-launch.md"; echo; echo "Part of #${EPIC_NUM[E7]}"; } > "$tmp"
n=$(create "S7.1 Cash and MoMo payment to driver (launch)" "user-story,ride-hailing,phase-1,payments,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S7.1 Cash and MoMo payment to driver (launch)"
gh issue comment "${EPIC_NUM[E7]}" --repo "$REPO" --body "- [ ] #$n S7.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S7.2-commission-ledger-settlement-and-driver-payouts.md"; echo; echo "Part of #${EPIC_NUM[E7]}"; } > "$tmp"
n=$(create "S7.2 Commission ledger, settlement and driver payouts" "user-story,ride-hailing,phase-1,payments,backend,admin" "$tmp"); rm -f "$tmp"; echo "#$n S7.2 Commission ledger, settlement and driver payouts"
gh issue comment "${EPIC_NUM[E7]}" --repo "$REPO" --body "- [ ] #$n S7.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S7.3-in-app-momo-and-international-card-payments.md"; echo; echo "Part of #${EPIC_NUM[E7]}"; } > "$tmp"
n=$(create "S7.3 In-app MoMo and international card payments" "user-story,ride-hailing,phase-2,payments,international" "$tmp"); rm -f "$tmp"; echo "#$n S7.3 In-app MoMo and international card payments"
gh issue comment "${EPIC_NUM[E7]}" --repo "$REPO" --body "- [ ] #$n S7.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S8.1-share-my-trip.md"; echo; echo "Part of #${EPIC_NUM[E8]}"; } > "$tmp"
n=$(create "S8.1 Share my trip" "user-story,ride-hailing,phase-2,mobile,backend,safety" "$tmp"); rm -f "$tmp"; echo "#$n S8.1 Share my trip"
gh issue comment "${EPIC_NUM[E8]}" --repo "$REPO" --body "- [ ] #$n S8.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S8.2-sos-emergency-button.md"; echo; echo "Part of #${EPIC_NUM[E8]}"; } > "$tmp"
n=$(create "S8.2 SOS emergency button" "user-story,ride-hailing,phase-2,mobile,backend,safety" "$tmp"); rm -f "$tmp"; echo "#$n S8.2 SOS emergency button"
gh issue comment "${EPIC_NUM[E8]}" --repo "$REPO" --body "- [ ] #$n S8.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S8.3-ride-audit-trail.md"; echo; echo "Part of #${EPIC_NUM[E8]}"; } > "$tmp"
n=$(create "S8.3 Ride audit trail" "user-story,ride-hailing,phase-1,backend,admin,safety" "$tmp"); rm -f "$tmp"; echo "#$n S8.3 Ride audit trail"
gh issue comment "${EPIC_NUM[E8]}" --repo "$REPO" --body "- [ ] #$n S8.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S8.4-flag-low-rated-or-high-cancel-drivers.md"; echo; echo "Part of #${EPIC_NUM[E8]}"; } > "$tmp"
n=$(create "S8.4 Flag low-rated or high-cancel drivers" "user-story,ride-hailing,phase-1,backend,admin,safety" "$tmp"); rm -f "$tmp"; echo "#$n S8.4 Flag low-rated or high-cancel drivers"
gh issue comment "${EPIC_NUM[E8]}" --repo "$REPO" --body "- [ ] #$n S8.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S9.1-familiar-uber-didi-style-ride-flow-ux-benchmark.md"; echo; echo "Part of #${EPIC_NUM[E9]}"; } > "$tmp"
n=$(create "S9.1 Familiar Uber/DiDi-style ride flow (UX benchmark)" "user-story,ride-hailing,phase-1,ux,mobile,international" "$tmp"); rm -f "$tmp"; echo "#$n S9.1 Familiar Uber/DiDi-style ride flow (UX benchmark)"
gh issue comment "${EPIC_NUM[E9]}" --repo "$REPO" --body "- [ ] #$n S9.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S9.2-language-international-phone-numbers-and-email-log.md"; echo; echo "Part of #${EPIC_NUM[E9]}"; } > "$tmp"
n=$(create "S9.2 Language, international phone numbers and email login" "user-story,ride-hailing,phase-1,mobile,backend,international" "$tmp"); rm -f "$tmp"; echo "#$n S9.2 Language, international phone numbers and email login"
gh issue comment "${EPIC_NUM[E9]}" --repo "$REPO" --body "- [ ] #$n S9.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S9.3-sign-in-with-apple.md"; echo; echo "Part of #${EPIC_NUM[E9]}"; } > "$tmp"
n=$(create "S9.3 Sign in with Apple" "user-story,ride-hailing,phase-1,mobile,backend,international" "$tmp"); rm -f "$tmp"; echo "#$n S9.3 Sign in with Apple"
gh issue comment "${EPIC_NUM[E9]}" --repo "$REPO" --body "- [ ] #$n S9.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S9.4-show-prices-in-my-home-currency-too.md"; echo; echo "Part of #${EPIC_NUM[E9]}"; } > "$tmp"
n=$(create "S9.4 Show prices in my home currency too" "user-story,ride-hailing,phase-1,mobile,international" "$tmp"); rm -f "$tmp"; echo "#$n S9.4 Show prices in my home currency too"
gh issue comment "${EPIC_NUM[E9]}" --repo "$REPO" --body "- [ ] #$n S9.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S9.5-in-app-chat-with-quick-translated-phrases.md"; echo; echo "Part of #${EPIC_NUM[E9]}"; } > "$tmp"
n=$(create "S9.5 In-app chat with quick, translated phrases" "user-story,ride-hailing,phase-2,mobile,backend,international" "$tmp"); rm -f "$tmp"; echo "#$n S9.5 In-app chat with quick, translated phrases"
gh issue comment "${EPIC_NUM[E9]}" --repo "$REPO" --body "- [ ] #$n S9.5" >/dev/null
tmp=$(mktemp); { cat "$DIR/S9.6-email-receipts-for-every-trip.md"; echo; echo "Part of #${EPIC_NUM[E9]}"; } > "$tmp"
n=$(create "S9.6 Email receipts for every trip" "user-story,ride-hailing,phase-1,backend,international,payments" "$tmp"); rm -f "$tmp"; echo "#$n S9.6 Email receipts for every trip"
gh issue comment "${EPIC_NUM[E9]}" --repo "$REPO" --body "- [ ] #$n S9.6" >/dev/null
tmp=$(mktemp); { cat "$DIR/S9.7-airport-pickup-at-kigali-international-airport.md"; echo; echo "Part of #${EPIC_NUM[E9]}"; } > "$tmp"
n=$(create "S9.7 Airport pickup at Kigali International Airport" "user-story,ride-hailing,phase-2,mobile,backend,international" "$tmp"); rm -f "$tmp"; echo "#$n S9.7 Airport pickup at Kigali International Airport"
gh issue comment "${EPIC_NUM[E9]}" --repo "$REPO" --body "- [ ] #$n S9.7" >/dev/null
tmp=$(mktemp); { cat "$DIR/S10.1-live-operations-view.md"; echo; echo "Part of #${EPIC_NUM[E10]}"; } > "$tmp"
n=$(create "S10.1 Live operations view" "user-story,ride-hailing,phase-1,admin,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S10.1 Live operations view"
gh issue comment "${EPIC_NUM[E10]}" --repo "$REPO" --body "- [ ] #$n S10.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S10.2-rides-list-detail-and-dispute-handling.md"; echo; echo "Part of #${EPIC_NUM[E10]}"; } > "$tmp"
n=$(create "S10.2 Rides list, detail and dispute handling" "user-story,ride-hailing,phase-1,admin,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S10.2 Rides list, detail and dispute handling"
gh issue comment "${EPIC_NUM[E10]}" --repo "$REPO" --body "- [ ] #$n S10.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S10.3-ride-analytics.md"; echo; echo "Part of #${EPIC_NUM[E10]}"; } > "$tmp"
n=$(create "S10.3 Ride analytics" "user-story,ride-hailing,phase-1,admin,backend,analytics" "$tmp"); rm -f "$tmp"; echo "#$n S10.3 Ride analytics"
gh issue comment "${EPIC_NUM[E10]}" --repo "$REPO" --body "- [ ] #$n S10.3" >/dev/null
echo "Done."
