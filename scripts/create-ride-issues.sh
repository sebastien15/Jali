#!/usr/bin/env bash
# Creates the Jali Ride user stories as GitHub issues (epics first, then stories linked to them).
# Generated from docs/ride-hailing/stories — do not edit by hand.
# Usage: scripts/create-ride-issues.sh [owner/repo]   (requires: gh auth login)
# NOTE: sebastien15/Jali already has these issues (#4-#155, see scripts/ride_backlog/issues.json).
#       Only run this against a fresh repository or fork.
set -euo pipefail
REPO="${1:-sebastien15/Jali}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/docs/ride-hailing/stories"

ensure_label() { gh label create "$1" --repo "$REPO" --color "$2" --force >/dev/null; }
for l in epic:5319e7 user-story:0e8a16 ride-hailing:0055cc phase-0:c5def5 phase-1:bfd4f2 phase-2:d4c5f9 phase-3:e4e669 \
         backend:1d76db mobile:009e8e admin:7c3aed ux:fbca04 payments:00a63e pricing:ff5c00 \
         safety:b60205 security:b60205 international:0e8a16 analytics:c2e0c6 bug:d73a4a tech-debt:cccccc; do
  ensure_label "${l%%:*}" "${l##*:}"
done
for w in $(seq 1 15); do ensure_label "wave-$w" ededed; done

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
EPIC_NUM[E11]=$(create "[Epic] E11 — Maps, places & routing" "epic,ride-hailing,phase-2" "$DIR/E11-epic.md"); echo "#${EPIC_NUM[E11]} [Epic] E11 — Maps, places & routing"
EPIC_NUM[E12]=$(create "[Epic] E12 — Realtime infrastructure" "epic,ride-hailing,phase-2" "$DIR/E12-epic.md"); echo "#${EPIC_NUM[E12]} [Epic] E12 — Realtime infrastructure"
EPIC_NUM[E13]=$(create "[Epic] E13 — More ways to ride" "epic,ride-hailing,phase-2" "$DIR/E13-epic.md"); echo "#${EPIC_NUM[E13]} [Epic] E13 — More ways to ride"
EPIC_NUM[E14]=$(create "[Epic] E14 — Pricing, offers, wallet & rewards" "epic,ride-hailing,phase-2" "$DIR/E14-epic.md"); echo "#${EPIC_NUM[E14]} [Epic] E14 — Pricing, offers, wallet & rewards"
EPIC_NUM[E15]=$(create "[Epic] E15 — Rider account & convenience" "epic,ride-hailing,phase-2" "$DIR/E15-epic.md"); echo "#${EPIC_NUM[E15]} [Epic] E15 — Rider account & convenience"
EPIC_NUM[E16]=$(create "[Epic] E16 — Communication & customer support" "epic,ride-hailing,phase-2" "$DIR/E16-epic.md"); echo "#${EPIC_NUM[E16]} [Epic] E16 — Communication & customer support"
EPIC_NUM[E17]=$(create "[Epic] E17 — Driver tools & growth" "epic,ride-hailing,phase-2" "$DIR/E17-epic.md"); echo "#${EPIC_NUM[E17]} [Epic] E17 — Driver tools & growth"
EPIC_NUM[E18]=$(create "[Epic] E18 — Advanced safety" "epic,ride-hailing,phase-2" "$DIR/E18-epic.md"); echo "#${EPIC_NUM[E18]} [Epic] E18 — Advanced safety"
EPIC_NUM[E19]=$(create "[Epic] E19 — Fleets & business partners" "epic,ride-hailing,phase-3" "$DIR/E19-epic.md"); echo "#${EPIC_NUM[E19]} [Epic] E19 — Fleets & business partners"
EPIC_NUM[E20]=$(create "[Epic] E20 — Jali Send — package delivery" "epic,ride-hailing,phase-3" "$DIR/E20-epic.md"); echo "#${EPIC_NUM[E20]} [Epic] E20 — Jali Send — package delivery"
EPIC_NUM[E21]=$(create "[Epic] E21 — Platform quality, security & compliance" "epic,ride-hailing,phase-1" "$DIR/E21-epic.md"); echo "#${EPIC_NUM[E21]} [Epic] E21 — Platform quality, security & compliance"
EPIC_NUM[E22]=$(create "[Epic] E22 — Growth & marketing" "epic,ride-hailing,phase-3" "$DIR/E22-epic.md"); echo "#${EPIC_NUM[E22]} [Epic] E22 — Growth & marketing"
tmp=$(mktemp); { cat "$DIR/S0.1-fix-driver-setup-data-is-silently-discarded.md"; echo; echo "Part of #${EPIC_NUM[E0]}"; } > "$tmp"
n=$(create "S0.1 Fix: driver setup data is silently discarded" "user-story,ride-hailing,phase-0,wave-1,bug,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S0.1 Fix: driver setup data is silently discarded"
gh issue comment "${EPIC_NUM[E0]}" --repo "$REPO" --body "- [ ] #$n S0.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S0.2-driver-mode-survives-app-restarts.md"; echo; echo "Part of #${EPIC_NUM[E0]}"; } > "$tmp"
n=$(create "S0.2 Driver mode survives app restarts" "user-story,ride-hailing,phase-0,wave-2,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S0.2 Driver mode survives app restarts"
gh issue comment "${EPIC_NUM[E0]}" --repo "$REPO" --body "- [ ] #$n S0.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S0.3-seed-ride-hailing-permissions.md"; echo; echo "Part of #${EPIC_NUM[E0]}"; } > "$tmp"
n=$(create "S0.3 Seed ride-hailing permissions" "user-story,ride-hailing,phase-0,wave-1,backend,security" "$tmp"); rm -f "$tmp"; echo "#$n S0.3 Seed ride-hailing permissions"
gh issue comment "${EPIC_NUM[E0]}" --repo "$REPO" --body "- [ ] #$n S0.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S0.4-reusable-push-notification-service.md"; echo; echo "Part of #${EPIC_NUM[E0]}"; } > "$tmp"
n=$(create "S0.4 Reusable push notification service" "user-story,ride-hailing,phase-0,wave-1,backend,tech-debt" "$tmp"); rm -f "$tmp"; echo "#$n S0.4 Reusable push notification service"
gh issue comment "${EPIC_NUM[E0]}" --repo "$REPO" --body "- [ ] #$n S0.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S1.1-become-a-driver-and-choose-services.md"; echo; echo "Part of #${EPIC_NUM[E1]}"; } > "$tmp"
n=$(create "S1.1 Become a driver and choose services" "user-story,ride-hailing,phase-1,wave-2,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S1.1 Become a driver and choose services"
gh issue comment "${EPIC_NUM[E1]}" --repo "$REPO" --body "- [ ] #$n S1.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S1.2-upload-driver-documents.md"; echo; echo "Part of #${EPIC_NUM[E1]}"; } > "$tmp"
n=$(create "S1.2 Upload driver documents" "user-story,ride-hailing,phase-1,wave-3,mobile,backend,security" "$tmp"); rm -f "$tmp"; echo "#$n S1.2 Upload driver documents"
gh issue comment "${EPIC_NUM[E1]}" --repo "$REPO" --body "- [ ] #$n S1.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S1.3-register-my-vehicles.md"; echo; echo "Part of #${EPIC_NUM[E1]}"; } > "$tmp"
n=$(create "S1.3 Register my vehicles" "user-story,ride-hailing,phase-1,wave-2,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S1.3 Register my vehicles"
gh issue comment "${EPIC_NUM[E1]}" --repo "$REPO" --body "- [ ] #$n S1.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S1.4-admin-verification-queue-for-drivers.md"; echo; echo "Part of #${EPIC_NUM[E1]}"; } > "$tmp"
n=$(create "S1.4 Admin verification queue for drivers" "user-story,ride-hailing,phase-1,wave-4,admin,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S1.4 Admin verification queue for drivers"
gh issue comment "${EPIC_NUM[E1]}" --repo "$REPO" --body "- [ ] #$n S1.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S2.1-driver-sets-own-per-km-rates-with-live-preview.md"; echo; echo "Part of #${EPIC_NUM[E2]}"; } > "$tmp"
n=$(create "S2.1 Driver sets own per-km rates with live preview" "user-story,ride-hailing,phase-1,wave-3,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S2.1 Driver sets own per-km rates with live preview"
gh issue comment "${EPIC_NUM[E2]}" --repo "$REPO" --body "- [ ] #$n S2.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S2.2-superadmin-configures-pricing-guardrails-commissio.md"; echo; echo "Part of #${EPIC_NUM[E2]}"; } > "$tmp"
n=$(create "S2.2 Superadmin configures pricing guardrails & commission" "user-story,ride-hailing,phase-1,wave-2,admin,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S2.2 Superadmin configures pricing guardrails & commission"
gh issue comment "${EPIC_NUM[E2]}" --repo "$REPO" --body "- [ ] #$n S2.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S2.3-server-side-fare-quote-and-price-lock.md"; echo; echo "Part of #${EPIC_NUM[E2]}"; } > "$tmp"
n=$(create "S2.3 Server-side fare quote and price lock" "user-story,ride-hailing,phase-1,wave-4,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S2.3 Server-side fare quote and price lock"
gh issue comment "${EPIC_NUM[E2]}" --repo "$REPO" --body "- [ ] #$n S2.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S3.1-where-to-start-a-ride-from-home.md"; echo; echo "Part of #${EPIC_NUM[E3]}"; } > "$tmp"
n=$(create "S3.1 \"Where to?\" — start a ride from Home" "user-story,ride-hailing,phase-1,wave-1,mobile,ux" "$tmp"); rm -f "$tmp"; echo "#$n S3.1 \"Where to?\" — start a ride from Home"
gh issue comment "${EPIC_NUM[E3]}" --repo "$REPO" --body "- [ ] #$n S3.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S3.2-see-nearby-drivers-with-their-own-price.md"; echo; echo "Part of #${EPIC_NUM[E3]}"; } > "$tmp"
n=$(create "S3.2 See nearby drivers with their own price" "user-story,ride-hailing,phase-1,wave-6,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S3.2 See nearby drivers with their own price"
gh issue comment "${EPIC_NUM[E3]}" --repo "$REPO" --body "- [ ] #$n S3.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S3.3-map-of-nearby-drivers.md"; echo; echo "Part of #${EPIC_NUM[E3]}"; } > "$tmp"
n=$(create "S3.3 Map of nearby drivers" "user-story,ride-hailing,phase-2,wave-7,mobile,ux" "$tmp"); rm -f "$tmp"; echo "#$n S3.3 Map of nearby drivers"
gh issue comment "${EPIC_NUM[E3]}" --repo "$REPO" --body "- [ ] #$n S3.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S3.4-request-a-specific-driver.md"; echo; echo "Part of #${EPIC_NUM[E3]}"; } > "$tmp"
n=$(create "S3.4 Request a specific driver" "user-story,ride-hailing,phase-1,wave-7,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S3.4 Request a specific driver"
gh issue comment "${EPIC_NUM[E3]}" --repo "$REPO" --body "- [ ] #$n S3.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S3.5-send-request-to-all-nearby-drivers.md"; echo; echo "Part of #${EPIC_NUM[E3]}"; } > "$tmp"
n=$(create "S3.5 Send request to all nearby drivers" "user-story,ride-hailing,phase-2,wave-8,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S3.5 Send request to all nearby drivers"
gh issue comment "${EPIC_NUM[E3]}" --repo "$REPO" --body "- [ ] #$n S3.5" >/dev/null
tmp=$(mktemp); { cat "$DIR/S3.6-fare-estimate-before-choosing.md"; echo; echo "Part of #${EPIC_NUM[E3]}"; } > "$tmp"
n=$(create "S3.6 Fare estimate before choosing" "user-story,ride-hailing,phase-1,wave-7,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S3.6 Fare estimate before choosing"
gh issue comment "${EPIC_NUM[E3]}" --repo "$REPO" --body "- [ ] #$n S3.6" >/dev/null
tmp=$(mktemp); { cat "$DIR/S4.1-track-my-driver-until-pickup.md"; echo; echo "Part of #${EPIC_NUM[E4]}"; } > "$tmp"
n=$(create "S4.1 Track my driver until pickup" "user-story,ride-hailing,phase-1,wave-9,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S4.1 Track my driver until pickup"
gh issue comment "${EPIC_NUM[E4]}" --repo "$REPO" --body "- [ ] #$n S4.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S4.2-start-the-trip-with-a-pin.md"; echo; echo "Part of #${EPIC_NUM[E4]}"; } > "$tmp"
n=$(create "S4.2 Start the trip with a PIN" "user-story,ride-hailing,phase-1,wave-10,mobile,backend,security" "$tmp"); rm -f "$tmp"; echo "#$n S4.2 Start the trip with a PIN"
gh issue comment "${EPIC_NUM[E4]}" --repo "$REPO" --body "- [ ] #$n S4.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S4.3-cancellation-rules-and-fees.md"; echo; echo "Part of #${EPIC_NUM[E4]}"; } > "$tmp"
n=$(create "S4.3 Cancellation rules and fees" "user-story,ride-hailing,phase-1,wave-8,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S4.3 Cancellation rules and fees"
gh issue comment "${EPIC_NUM[E4]}" --repo "$REPO" --body "- [ ] #$n S4.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S4.4-complete-trip-and-confirm-payment.md"; echo; echo "Part of #${EPIC_NUM[E4]}"; } > "$tmp"
n=$(create "S4.4 Complete trip and confirm payment" "user-story,ride-hailing,phase-1,wave-11,mobile,backend,payments" "$tmp"); rm -f "$tmp"; echo "#$n S4.4 Complete trip and confirm payment"
gh issue comment "${EPIC_NUM[E4]}" --repo "$REPO" --body "- [ ] #$n S4.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S4.5-two-way-rating.md"; echo; echo "Part of #${EPIC_NUM[E4]}"; } > "$tmp"
n=$(create "S4.5 Two-way rating" "user-story,ride-hailing,phase-1,wave-12,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S4.5 Two-way rating"
gh issue comment "${EPIC_NUM[E4]}" --repo "$REPO" --body "- [ ] #$n S4.5" >/dev/null
tmp=$(mktemp); { cat "$DIR/S4.6-ride-history-in-trips-tab.md"; echo; echo "Part of #${EPIC_NUM[E4]}"; } > "$tmp"
n=$(create "S4.6 Ride history in Trips tab" "user-story,ride-hailing,phase-1,wave-12,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S4.6 Ride history in Trips tab"
gh issue comment "${EPIC_NUM[E4]}" --repo "$REPO" --body "- [ ] #$n S4.6" >/dev/null
tmp=$(mktemp); { cat "$DIR/S5.1-go-online-offline.md"; echo; echo "Part of #${EPIC_NUM[E5]}"; } > "$tmp"
n=$(create "S5.1 Go online / offline" "user-story,ride-hailing,phase-1,wave-5,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S5.1 Go online / offline"
gh issue comment "${EPIC_NUM[E5]}" --repo "$REPO" --body "- [ ] #$n S5.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S5.2-receive-and-accept-ride-requests.md"; echo; echo "Part of #${EPIC_NUM[E5]}"; } > "$tmp"
n=$(create "S5.2 Receive and accept ride requests" "user-story,ride-hailing,phase-1,wave-8,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S5.2 Receive and accept ride requests"
gh issue comment "${EPIC_NUM[E5]}" --repo "$REPO" --body "- [ ] #$n S5.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S5.3-navigate-to-pickup-and-destination.md"; echo; echo "Part of #${EPIC_NUM[E5]}"; } > "$tmp"
n=$(create "S5.3 Navigate to pickup and destination" "user-story,ride-hailing,phase-1,wave-9,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S5.3 Navigate to pickup and destination"
gh issue comment "${EPIC_NUM[E5]}" --repo "$REPO" --body "- [ ] #$n S5.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S5.4-earnings-and-commission-dashboard.md"; echo; echo "Part of #${EPIC_NUM[E5]}"; } > "$tmp"
n=$(create "S5.4 Earnings and commission dashboard" "user-story,ride-hailing,phase-1,wave-13,mobile,backend,payments" "$tmp"); rm -f "$tmp"; echo "#$n S5.4 Earnings and commission dashboard"
gh issue comment "${EPIC_NUM[E5]}" --repo "$REPO" --body "- [ ] #$n S5.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S6.1-driver-sets-hire-a-driver-rates-and-skills.md"; echo; echo "Part of #${EPIC_NUM[E6]}"; } > "$tmp"
n=$(create "S6.1 Driver sets hire-a-driver rates and skills" "user-story,ride-hailing,phase-2,wave-5,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S6.1 Driver sets hire-a-driver rates and skills"
gh issue comment "${EPIC_NUM[E6]}" --repo "$REPO" --body "- [ ] #$n S6.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S6.2-driver-availability-calendar.md"; echo; echo "Part of #${EPIC_NUM[E6]}"; } > "$tmp"
n=$(create "S6.2 Driver availability calendar" "user-story,ride-hailing,phase-2,wave-6,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S6.2 Driver availability calendar"
gh issue comment "${EPIC_NUM[E6]}" --repo "$REPO" --body "- [ ] #$n S6.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S6.3-find-and-book-a-driver-for-my-car.md"; echo; echo "Part of #${EPIC_NUM[E6]}"; } > "$tmp"
n=$(create "S6.3 Find and book a driver for my car" "user-story,ride-hailing,phase-2,wave-7,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S6.3 Find and book a driver for my car"
gh issue comment "${EPIC_NUM[E6]}" --repo "$REPO" --body "- [ ] #$n S6.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S6.4-hire-lifecycle-accept-check-in-check-out-overtime.md"; echo; echo "Part of #${EPIC_NUM[E6]}"; } > "$tmp"
n=$(create "S6.4 Hire lifecycle: accept, check-in, check-out, overtime" "user-story,ride-hailing,phase-2,wave-8,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S6.4 Hire lifecycle: accept, check-in, check-out, overtime"
gh issue comment "${EPIC_NUM[E6]}" --repo "$REPO" --body "- [ ] #$n S6.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S7.1-cash-and-momo-payment-to-driver-launch.md"; echo; echo "Part of #${EPIC_NUM[E7]}"; } > "$tmp"
n=$(create "S7.1 Cash and MoMo payment to driver (launch)" "user-story,ride-hailing,phase-1,wave-12,payments,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S7.1 Cash and MoMo payment to driver (launch)"
gh issue comment "${EPIC_NUM[E7]}" --repo "$REPO" --body "- [ ] #$n S7.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S7.2-commission-ledger-settlement-and-driver-payouts.md"; echo; echo "Part of #${EPIC_NUM[E7]}"; } > "$tmp"
n=$(create "S7.2 Commission ledger, settlement and driver payouts" "user-story,ride-hailing,phase-1,wave-12,payments,backend,admin" "$tmp"); rm -f "$tmp"; echo "#$n S7.2 Commission ledger, settlement and driver payouts"
gh issue comment "${EPIC_NUM[E7]}" --repo "$REPO" --body "- [ ] #$n S7.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S7.3-in-app-momo-and-international-card-payments.md"; echo; echo "Part of #${EPIC_NUM[E7]}"; } > "$tmp"
n=$(create "S7.3 In-app MoMo and international card payments" "user-story,ride-hailing,phase-2,wave-13,payments,international" "$tmp"); rm -f "$tmp"; echo "#$n S7.3 In-app MoMo and international card payments"
gh issue comment "${EPIC_NUM[E7]}" --repo "$REPO" --body "- [ ] #$n S7.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S8.1-share-my-trip.md"; echo; echo "Part of #${EPIC_NUM[E8]}"; } > "$tmp"
n=$(create "S8.1 Share my trip" "user-story,ride-hailing,phase-2,wave-10,mobile,backend,safety" "$tmp"); rm -f "$tmp"; echo "#$n S8.1 Share my trip"
gh issue comment "${EPIC_NUM[E8]}" --repo "$REPO" --body "- [ ] #$n S8.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S8.2-sos-emergency-button.md"; echo; echo "Part of #${EPIC_NUM[E8]}"; } > "$tmp"
n=$(create "S8.2 SOS emergency button" "user-story,ride-hailing,phase-2,wave-10,mobile,backend,safety" "$tmp"); rm -f "$tmp"; echo "#$n S8.2 SOS emergency button"
gh issue comment "${EPIC_NUM[E8]}" --repo "$REPO" --body "- [ ] #$n S8.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S8.3-ride-audit-trail.md"; echo; echo "Part of #${EPIC_NUM[E8]}"; } > "$tmp"
n=$(create "S8.3 Ride audit trail" "user-story,ride-hailing,phase-1,wave-8,backend,admin,safety" "$tmp"); rm -f "$tmp"; echo "#$n S8.3 Ride audit trail"
gh issue comment "${EPIC_NUM[E8]}" --repo "$REPO" --body "- [ ] #$n S8.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S8.4-flag-low-rated-or-high-cancel-drivers.md"; echo; echo "Part of #${EPIC_NUM[E8]}"; } > "$tmp"
n=$(create "S8.4 Flag low-rated or high-cancel drivers" "user-story,ride-hailing,phase-1,wave-13,backend,admin,safety" "$tmp"); rm -f "$tmp"; echo "#$n S8.4 Flag low-rated or high-cancel drivers"
gh issue comment "${EPIC_NUM[E8]}" --repo "$REPO" --body "- [ ] #$n S8.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S9.1-familiar-uber-didi-style-ride-flow-ux-benchmark.md"; echo; echo "Part of #${EPIC_NUM[E9]}"; } > "$tmp"
n=$(create "S9.1 Familiar Uber/DiDi-style ride flow (UX benchmark)" "user-story,ride-hailing,phase-1,wave-2,ux,mobile,international" "$tmp"); rm -f "$tmp"; echo "#$n S9.1 Familiar Uber/DiDi-style ride flow (UX benchmark)"
gh issue comment "${EPIC_NUM[E9]}" --repo "$REPO" --body "- [ ] #$n S9.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S9.2-language-international-phone-numbers-and-email-log.md"; echo; echo "Part of #${EPIC_NUM[E9]}"; } > "$tmp"
n=$(create "S9.2 Language, international phone numbers and email login" "user-story,ride-hailing,phase-1,wave-1,mobile,backend,international" "$tmp"); rm -f "$tmp"; echo "#$n S9.2 Language, international phone numbers and email login"
gh issue comment "${EPIC_NUM[E9]}" --repo "$REPO" --body "- [ ] #$n S9.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S9.3-sign-in-with-apple.md"; echo; echo "Part of #${EPIC_NUM[E9]}"; } > "$tmp"
n=$(create "S9.3 Sign in with Apple" "user-story,ride-hailing,phase-1,wave-1,mobile,backend,international" "$tmp"); rm -f "$tmp"; echo "#$n S9.3 Sign in with Apple"
gh issue comment "${EPIC_NUM[E9]}" --repo "$REPO" --body "- [ ] #$n S9.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S9.4-show-prices-in-my-home-currency-too.md"; echo; echo "Part of #${EPIC_NUM[E9]}"; } > "$tmp"
n=$(create "S9.4 Show prices in my home currency too" "user-story,ride-hailing,phase-1,wave-8,mobile,international" "$tmp"); rm -f "$tmp"; echo "#$n S9.4 Show prices in my home currency too"
gh issue comment "${EPIC_NUM[E9]}" --repo "$REPO" --body "- [ ] #$n S9.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S9.5-in-app-chat-with-quick-translated-phrases.md"; echo; echo "Part of #${EPIC_NUM[E9]}"; } > "$tmp"
n=$(create "S9.5 In-app chat with quick, translated phrases" "user-story,ride-hailing,phase-2,wave-10,mobile,backend,international" "$tmp"); rm -f "$tmp"; echo "#$n S9.5 In-app chat with quick, translated phrases"
gh issue comment "${EPIC_NUM[E9]}" --repo "$REPO" --body "- [ ] #$n S9.5" >/dev/null
tmp=$(mktemp); { cat "$DIR/S9.6-email-receipts-for-every-trip.md"; echo; echo "Part of #${EPIC_NUM[E9]}"; } > "$tmp"
n=$(create "S9.6 Email receipts for every trip" "user-story,ride-hailing,phase-1,wave-12,backend,international,payments" "$tmp"); rm -f "$tmp"; echo "#$n S9.6 Email receipts for every trip"
gh issue comment "${EPIC_NUM[E9]}" --repo "$REPO" --body "- [ ] #$n S9.6" >/dev/null
tmp=$(mktemp); { cat "$DIR/S9.7-airport-pickup-at-kigali-international-airport.md"; echo; echo "Part of #${EPIC_NUM[E9]}"; } > "$tmp"
n=$(create "S9.7 Airport pickup at Kigali International Airport" "user-story,ride-hailing,phase-2,wave-9,mobile,backend,international" "$tmp"); rm -f "$tmp"; echo "#$n S9.7 Airport pickup at Kigali International Airport"
gh issue comment "${EPIC_NUM[E9]}" --repo "$REPO" --body "- [ ] #$n S9.7" >/dev/null
tmp=$(mktemp); { cat "$DIR/S10.1-live-operations-view.md"; echo; echo "Part of #${EPIC_NUM[E10]}"; } > "$tmp"
n=$(create "S10.1 Live operations view" "user-story,ride-hailing,phase-1,wave-6,admin,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S10.1 Live operations view"
gh issue comment "${EPIC_NUM[E10]}" --repo "$REPO" --body "- [ ] #$n S10.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S10.2-rides-list-detail-and-dispute-handling.md"; echo; echo "Part of #${EPIC_NUM[E10]}"; } > "$tmp"
n=$(create "S10.2 Rides list, detail and dispute handling" "user-story,ride-hailing,phase-1,wave-9,admin,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S10.2 Rides list, detail and dispute handling"
gh issue comment "${EPIC_NUM[E10]}" --repo "$REPO" --body "- [ ] #$n S10.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S10.3-ride-analytics.md"; echo; echo "Part of #${EPIC_NUM[E10]}"; } > "$tmp"
n=$(create "S10.3 Ride analytics" "user-story,ride-hailing,phase-1,wave-12,admin,backend,analytics" "$tmp"); rm -f "$tmp"; echo "#$n S10.3 Ride analytics"
gh issue comment "${EPIC_NUM[E10]}" --repo "$REPO" --body "- [ ] #$n S10.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S10.4-service-areas-cities-geofences.md"; echo; echo "Part of #${EPIC_NUM[E10]}"; } > "$tmp"
n=$(create "S10.4 Service areas, cities & geofences" "user-story,ride-hailing,phase-2,wave-2,admin,backend" "$tmp"); rm -f "$tmp"; echo "#$n S10.4 Service areas, cities & geofences"
gh issue comment "${EPIC_NUM[E10]}" --repo "$REPO" --body "- [ ] #$n S10.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S11.1-road-based-distance-and-eta.md"; echo; echo "Part of #${EPIC_NUM[E11]}"; } > "$tmp"
n=$(create "S11.1 Road-based distance and ETA" "user-story,ride-hailing,phase-2,wave-5,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S11.1 Road-based distance and ETA"
gh issue comment "${EPIC_NUM[E11]}" --repo "$REPO" --body "- [ ] #$n S11.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S11.2-route-line-on-the-map.md"; echo; echo "Part of #${EPIC_NUM[E11]}"; } > "$tmp"
n=$(create "S11.2 Route line on the map" "user-story,ride-hailing,phase-2,wave-8,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S11.2 Route line on the map"
gh issue comment "${EPIC_NUM[E11]}" --repo "$REPO" --body "- [ ] #$n S11.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S11.3-smooth-moving-car-on-the-map.md"; echo; echo "Part of #${EPIC_NUM[E11]}"; } > "$tmp"
n=$(create "S11.3 Smooth moving car on the map" "user-story,ride-hailing,phase-2,wave-11,mobile,ux" "$tmp"); rm -f "$tmp"; echo "#$n S11.3 Smooth moving car on the map"
gh issue comment "${EPIC_NUM[E11]}" --repo "$REPO" --body "- [ ] #$n S11.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S11.4-suggested-pickup-points-and-landmarks.md"; echo; echo "Part of #${EPIC_NUM[E11]}"; } > "$tmp"
n=$(create "S11.4 Suggested pickup points and landmarks" "user-story,ride-hailing,phase-2,wave-3,mobile,backend,admin" "$tmp"); rm -f "$tmp"; echo "#$n S11.4 Suggested pickup points and landmarks"
gh issue comment "${EPIC_NUM[E11]}" --repo "$REPO" --body "- [ ] #$n S11.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S11.5-saved-places-with-labels-and-driver-notes.md"; echo; echo "Part of #${EPIC_NUM[E11]}"; } > "$tmp"
n=$(create "S11.5 Saved places with labels and driver notes" "user-story,ride-hailing,phase-2,wave-2,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S11.5 Saved places with labels and driver notes"
gh issue comment "${EPIC_NUM[E11]}" --repo "$REPO" --body "- [ ] #$n S11.5" >/dev/null
tmp=$(mktemp); { cat "$DIR/S11.6-describe-or-photograph-my-pickup-spot.md"; echo; echo "Part of #${EPIC_NUM[E11]}"; } > "$tmp"
n=$(create "S11.6 Describe or photograph my pickup spot" "user-story,ride-hailing,phase-2,wave-10,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S11.6 Describe or photograph my pickup spot"
gh issue comment "${EPIC_NUM[E11]}" --repo "$REPO" --body "- [ ] #$n S11.6" >/dev/null
tmp=$(mktemp); { cat "$DIR/S11.7-live-eta-countdown.md"; echo; echo "Part of #${EPIC_NUM[E11]}"; } > "$tmp"
n=$(create "S11.7 Live ETA countdown" "user-story,ride-hailing,phase-2,wave-10,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S11.7 Live ETA countdown"
gh issue comment "${EPIC_NUM[E11]}" --repo "$REPO" --body "- [ ] #$n S11.7" >/dev/null
tmp=$(mktemp); { cat "$DIR/S12.1-websockets-with-laravel-reverb.md"; echo; echo "Part of #${EPIC_NUM[E12]}"; } > "$tmp"
n=$(create "S12.1 WebSockets with Laravel Reverb" "user-story,ride-hailing,phase-2,wave-10,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S12.1 WebSockets with Laravel Reverb"
gh issue comment "${EPIC_NUM[E12]}" --repo "$REPO" --body "- [ ] #$n S12.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S12.2-recover-trip-state-after-network-loss-or-app-kill.md"; echo; echo "Part of #${EPIC_NUM[E12]}"; } > "$tmp"
n=$(create "S12.2 Recover trip state after network loss or app kill" "user-story,ride-hailing,phase-2,wave-10,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S12.2 Recover trip state after network loss or app kill"
gh issue comment "${EPIC_NUM[E12]}" --repo "$REPO" --body "- [ ] #$n S12.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S12.3-reliable-notifications.md"; echo; echo "Part of #${EPIC_NUM[E12]}"; } > "$tmp"
n=$(create "S12.3 Reliable notifications" "user-story,ride-hailing,phase-2,wave-2,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S12.3 Reliable notifications"
gh issue comment "${EPIC_NUM[E12]}" --repo "$REPO" --body "- [ ] #$n S12.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S13.1-schedule-a-ride-in-advance.md"; echo; echo "Part of #${EPIC_NUM[E13]}"; } > "$tmp"
n=$(create "S13.1 Schedule a ride in advance" "user-story,ride-hailing,phase-2,wave-8,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S13.1 Schedule a ride in advance"
gh issue comment "${EPIC_NUM[E13]}" --repo "$REPO" --body "- [ ] #$n S13.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S13.2-book-a-ride-for-someone-else.md"; echo; echo "Part of #${EPIC_NUM[E13]}"; } > "$tmp"
n=$(create "S13.2 Book a ride for someone else" "user-story,ride-hailing,phase-2,wave-8,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S13.2 Book a ride for someone else"
gh issue comment "${EPIC_NUM[E13]}" --repo "$REPO" --body "- [ ] #$n S13.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S13.3-multiple-stops.md"; echo; echo "Part of #${EPIC_NUM[E13]}"; } > "$tmp"
n=$(create "S13.3 Multiple stops" "user-story,ride-hailing,phase-2,wave-8,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S13.3 Multiple stops"
gh issue comment "${EPIC_NUM[E13]}" --repo "$REPO" --body "- [ ] #$n S13.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S13.4-change-destination-during-the-trip.md"; echo; echo "Part of #${EPIC_NUM[E13]}"; } > "$tmp"
n=$(create "S13.4 Change destination during the trip" "user-story,ride-hailing,phase-2,wave-12,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S13.4 Change destination during the trip"
gh issue comment "${EPIC_NUM[E13]}" --repo "$REPO" --body "- [ ] #$n S13.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S13.5-ride-preferences.md"; echo; echo "Part of #${EPIC_NUM[E13]}"; } > "$tmp"
n=$(create "S13.5 Ride preferences" "user-story,ride-hailing,phase-2,wave-7,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S13.5 Ride preferences"
gh issue comment "${EPIC_NUM[E13]}" --repo "$REPO" --body "- [ ] #$n S13.5" >/dev/null
tmp=$(mktemp); { cat "$DIR/S13.6-women-only-option.md"; echo; echo "Part of #${EPIC_NUM[E13]}"; } > "$tmp"
n=$(create "S13.6 Women-only option" "user-story,ride-hailing,phase-2,wave-7,mobile,backend,safety" "$tmp"); rm -f "$tmp"; echo "#$n S13.6 Women-only option"
gh issue comment "${EPIC_NUM[E13]}" --repo "$REPO" --body "- [ ] #$n S13.6" >/dev/null
tmp=$(mktemp); { cat "$DIR/S13.7-hourly-ride-with-driver-s-car.md"; echo; echo "Part of #${EPIC_NUM[E13]}"; } > "$tmp"
n=$(create "S13.7 Hourly ride with driver's car" "user-story,ride-hailing,phase-2,wave-8,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S13.7 Hourly ride with driver's car"
gh issue comment "${EPIC_NUM[E13]}" --repo "$REPO" --body "- [ ] #$n S13.7" >/dev/null
tmp=$(mktemp); { cat "$DIR/S13.8-on-demand-intercity-rides.md"; echo; echo "Part of #${EPIC_NUM[E13]}"; } > "$tmp"
n=$(create "S13.8 On-demand intercity rides" "user-story,ride-hailing,phase-2,wave-8,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S13.8 On-demand intercity rides"
gh issue comment "${EPIC_NUM[E13]}" --repo "$REPO" --body "- [ ] #$n S13.8" >/dev/null
tmp=$(mktemp); { cat "$DIR/S13.9-child-seat-wheelchair-friendly-and-pet-friendly-ve.md"; echo; echo "Part of #${EPIC_NUM[E13]}"; } > "$tmp"
n=$(create "S13.9 Child seat, wheelchair-friendly and pet-friendly vehicles" "user-story,ride-hailing,phase-2,wave-7,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S13.9 Child seat, wheelchair-friendly and pet-friendly vehicles"
gh issue comment "${EPIC_NUM[E13]}" --repo "$REPO" --body "- [ ] #$n S13.9" >/dev/null
tmp=$(mktemp); { cat "$DIR/S13.10-wait-save-priority-pickup.md"; echo; echo "Part of #${EPIC_NUM[E13]}"; } > "$tmp"
n=$(create "S13.10 Wait & save / priority pickup" "user-story,ride-hailing,phase-2,wave-9,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S13.10 Wait & save / priority pickup"
gh issue comment "${EPIC_NUM[E13]}" --repo "$REPO" --body "- [ ] #$n S13.10" >/dev/null
tmp=$(mktemp); { cat "$DIR/S14.1-rider-offers-a-price-drivers-accept-or-counter.md"; echo; echo "Part of #${EPIC_NUM[E14]}"; } > "$tmp"
n=$(create "S14.1 Rider offers a price, drivers accept or counter" "user-story,ride-hailing,phase-2,wave-9,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S14.1 Rider offers a price, drivers accept or counter"
gh issue comment "${EPIC_NUM[E14]}" --repo "$REPO" --body "- [ ] #$n S14.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S14.2-promo-codes.md"; echo; echo "Part of #${EPIC_NUM[E14]}"; } > "$tmp"
n=$(create "S14.2 Promo codes" "user-story,ride-hailing,phase-2,wave-13,backend,admin,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S14.2 Promo codes"
gh issue comment "${EPIC_NUM[E14]}" --repo "$REPO" --body "- [ ] #$n S14.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S14.3-referral-program.md"; echo; echo "Part of #${EPIC_NUM[E14]}"; } > "$tmp"
n=$(create "S14.3 Referral program" "user-story,ride-hailing,phase-2,wave-14,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S14.3 Referral program"
gh issue comment "${EPIC_NUM[E14]}" --repo "$REPO" --body "- [ ] #$n S14.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S14.4-tipping.md"; echo; echo "Part of #${EPIC_NUM[E14]}"; } > "$tmp"
n=$(create "S14.4 Tipping" "user-story,ride-hailing,phase-2,wave-15,mobile,backend,payments" "$tmp"); rm -f "$tmp"; echo "#$n S14.4 Tipping"
gh issue comment "${EPIC_NUM[E14]}" --repo "$REPO" --body "- [ ] #$n S14.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S14.5-split-fare.md"; echo; echo "Part of #${EPIC_NUM[E14]}"; } > "$tmp"
n=$(create "S14.5 Split fare" "user-story,ride-hailing,phase-2,wave-15,mobile,backend,payments" "$tmp"); rm -f "$tmp"; echo "#$n S14.5 Split fare"
gh issue comment "${EPIC_NUM[E14]}" --repo "$REPO" --body "- [ ] #$n S14.5" >/dev/null
tmp=$(mktemp); { cat "$DIR/S14.6-jali-wallet.md"; echo; echo "Part of #${EPIC_NUM[E14]}"; } > "$tmp"
n=$(create "S14.6 Jali Wallet" "user-story,ride-hailing,phase-2,wave-14,mobile,backend,payments" "$tmp"); rm -f "$tmp"; echo "#$n S14.6 Jali Wallet"
gh issue comment "${EPIC_NUM[E14]}" --repo "$REPO" --body "- [ ] #$n S14.6" >/dev/null
tmp=$(mktemp); { cat "$DIR/S14.7-jali-pass-subscription.md"; echo; echo "Part of #${EPIC_NUM[E14]}"; } > "$tmp"
n=$(create "S14.7 Jali Pass subscription" "user-story,ride-hailing,phase-3,wave-15,mobile,backend,payments" "$tmp"); rm -f "$tmp"; echo "#$n S14.7 Jali Pass subscription"
gh issue comment "${EPIC_NUM[E14]}" --repo "$REPO" --body "- [ ] #$n S14.7" >/dev/null
tmp=$(mktemp); { cat "$DIR/S14.8-loyalty-points-and-member-levels.md"; echo; echo "Part of #${EPIC_NUM[E14]}"; } > "$tmp"
n=$(create "S14.8 Loyalty points and member levels" "user-story,ride-hailing,phase-3,wave-15,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S14.8 Loyalty points and member levels"
gh issue comment "${EPIC_NUM[E14]}" --repo "$REPO" --body "- [ ] #$n S14.8" >/dev/null
tmp=$(mktemp); { cat "$DIR/S15.1-favourite-drivers.md"; echo; echo "Part of #${EPIC_NUM[E15]}"; } > "$tmp"
n=$(create "S15.1 Favourite drivers" "user-story,ride-hailing,phase-2,wave-13,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S15.1 Favourite drivers"
gh issue comment "${EPIC_NUM[E15]}" --repo "$REPO" --body "- [ ] #$n S15.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S15.2-business-profile-and-expense-reports.md"; echo; echo "Part of #${EPIC_NUM[E15]}"; } > "$tmp"
n=$(create "S15.2 Business profile and expense reports" "user-story,ride-hailing,phase-2,wave-13,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S15.2 Business profile and expense reports"
gh issue comment "${EPIC_NUM[E15]}" --repo "$REPO" --body "- [ ] #$n S15.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S15.3-family-profile.md"; echo; echo "Part of #${EPIC_NUM[E15]}"; } > "$tmp"
n=$(create "S15.3 Family profile" "user-story,ride-hailing,phase-3,wave-15,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S15.3 Family profile"
gh issue comment "${EPIC_NUM[E15]}" --repo "$REPO" --body "- [ ] #$n S15.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S15.4-notification-preferences.md"; echo; echo "Part of #${EPIC_NUM[E15]}"; } > "$tmp"
n=$(create "S15.4 Notification preferences" "user-story,ride-hailing,phase-2,wave-2,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S15.4 Notification preferences"
gh issue comment "${EPIC_NUM[E15]}" --repo "$REPO" --body "- [ ] #$n S15.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S15.5-report-a-lost-item.md"; echo; echo "Part of #${EPIC_NUM[E15]}"; } > "$tmp"
n=$(create "S15.5 Report a lost item" "user-story,ride-hailing,phase-2,wave-11,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S15.5 Report a lost item"
gh issue comment "${EPIC_NUM[E15]}" --repo "$REPO" --body "- [ ] #$n S15.5" >/dev/null
tmp=$(mktemp); { cat "$DIR/S15.6-delete-my-account-and-export-my-data.md"; echo; echo "Part of #${EPIC_NUM[E15]}"; } > "$tmp"
n=$(create "S15.6 Delete my account and export my data" "user-story,ride-hailing,phase-1,wave-1,mobile,backend,security" "$tmp"); rm -f "$tmp"; echo "#$n S15.6 Delete my account and export my data"
gh issue comment "${EPIC_NUM[E15]}" --repo "$REPO" --body "- [ ] #$n S15.6" >/dev/null
tmp=$(mktemp); { cat "$DIR/S15.7-dark-mode-and-accessibility.md"; echo; echo "Part of #${EPIC_NUM[E15]}"; } > "$tmp"
n=$(create "S15.7 Dark mode and accessibility" "user-story,ride-hailing,phase-2,wave-1,mobile,ux" "$tmp"); rm -f "$tmp"; echo "#$n S15.7 Dark mode and accessibility"
gh issue comment "${EPIC_NUM[E15]}" --repo "$REPO" --body "- [ ] #$n S15.7" >/dev/null
tmp=$(mktemp); { cat "$DIR/S15.8-first-time-onboarding.md"; echo; echo "Part of #${EPIC_NUM[E15]}"; } > "$tmp"
n=$(create "S15.8 First-time onboarding" "user-story,ride-hailing,phase-2,wave-2,mobile,ux" "$tmp"); rm -f "$tmp"; echo "#$n S15.8 First-time onboarding"
gh issue comment "${EPIC_NUM[E15]}" --repo "$REPO" --body "- [ ] #$n S15.8" >/dev/null
tmp=$(mktemp); { cat "$DIR/S16.1-masked-phone-calls.md"; echo; echo "Part of #${EPIC_NUM[E16]}"; } > "$tmp"
n=$(create "S16.1 Masked phone calls" "user-story,ride-hailing,phase-2,wave-10,backend,mobile,security" "$tmp"); rm -f "$tmp"; echo "#$n S16.1 Masked phone calls"
gh issue comment "${EPIC_NUM[E16]}" --repo "$REPO" --body "- [ ] #$n S16.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S16.2-help-centre-with-trip-specific-help.md"; echo; echo "Part of #${EPIC_NUM[E16]}"; } > "$tmp"
n=$(create "S16.2 Help centre with trip-specific help" "user-story,ride-hailing,phase-2,wave-1,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S16.2 Help centre with trip-specific help"
gh issue comment "${EPIC_NUM[E16]}" --repo "$REPO" --body "- [ ] #$n S16.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S16.3-support-tickets-and-live-chat-with-an-agent.md"; echo; echo "Part of #${EPIC_NUM[E16]}"; } > "$tmp"
n=$(create "S16.3 Support tickets and live chat with an agent" "user-story,ride-hailing,phase-2,wave-2,mobile,backend,admin" "$tmp"); rm -f "$tmp"; echo "#$n S16.3 Support tickets and live chat with an agent"
gh issue comment "${EPIC_NUM[E16]}" --repo "$REPO" --body "- [ ] #$n S16.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S16.4-fare-review-and-refunds.md"; echo; echo "Part of #${EPIC_NUM[E16]}"; } > "$tmp"
n=$(create "S16.4 Fare review and refunds" "user-story,ride-hailing,phase-2,wave-15,backend,admin,payments" "$tmp"); rm -f "$tmp"; echo "#$n S16.4 Fare review and refunds"
gh issue comment "${EPIC_NUM[E16]}" --repo "$REPO" --body "- [ ] #$n S16.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S17.1-demand-heatmap-for-drivers.md"; echo; echo "Part of #${EPIC_NUM[E17]}"; } > "$tmp"
n=$(create "S17.1 Demand heatmap for drivers" "user-story,ride-hailing,phase-2,wave-8,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S17.1 Demand heatmap for drivers"
gh issue comment "${EPIC_NUM[E17]}" --repo "$REPO" --body "- [ ] #$n S17.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S17.2-destination-filter-going-home.md"; echo; echo "Part of #${EPIC_NUM[E17]}"; } > "$tmp"
n=$(create "S17.2 Destination filter — going home" "user-story,ride-hailing,phase-2,wave-9,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S17.2 Destination filter — going home"
gh issue comment "${EPIC_NUM[E17]}" --repo "$REPO" --body "- [ ] #$n S17.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S17.3-driver-incentives-and-quests.md"; echo; echo "Part of #${EPIC_NUM[E17]}"; } > "$tmp"
n=$(create "S17.3 Driver incentives and quests" "user-story,ride-hailing,phase-2,wave-13,backend,admin,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S17.3 Driver incentives and quests"
gh issue comment "${EPIC_NUM[E17]}" --repo "$REPO" --body "- [ ] #$n S17.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S17.4-driver-levels-and-rewards.md"; echo; echo "Part of #${EPIC_NUM[E17]}"; } > "$tmp"
n=$(create "S17.4 Driver levels and rewards" "user-story,ride-hailing,phase-3,wave-14,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S17.4 Driver levels and rewards"
gh issue comment "${EPIC_NUM[E17]}" --repo "$REPO" --body "- [ ] #$n S17.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S17.5-airport-and-venue-queue.md"; echo; echo "Part of #${EPIC_NUM[E17]}"; } > "$tmp"
n=$(create "S17.5 Airport and venue queue" "user-story,ride-hailing,phase-2,wave-9,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S17.5 Airport and venue queue"
gh issue comment "${EPIC_NUM[E17]}" --repo "$REPO" --body "- [ ] #$n S17.5" >/dev/null
tmp=$(mktemp); { cat "$DIR/S17.6-fatigue-limit.md"; echo; echo "Part of #${EPIC_NUM[E17]}"; } > "$tmp"
n=$(create "S17.6 Fatigue limit" "user-story,ride-hailing,phase-2,wave-6,backend,mobile,safety" "$tmp"); rm -f "$tmp"; echo "#$n S17.6 Fatigue limit"
gh issue comment "${EPIC_NUM[E17]}" --repo "$REPO" --body "- [ ] #$n S17.6" >/dev/null
tmp=$(mktemp); { cat "$DIR/S17.7-document-expiry-reminders.md"; echo; echo "Part of #${EPIC_NUM[E17]}"; } > "$tmp"
n=$(create "S17.7 Document expiry reminders" "user-story,ride-hailing,phase-2,wave-4,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S17.7 Document expiry reminders"
gh issue comment "${EPIC_NUM[E17]}" --repo "$REPO" --body "- [ ] #$n S17.7" >/dev/null
tmp=$(mktemp); { cat "$DIR/S17.8-instant-cashout-to-momo.md"; echo; echo "Part of #${EPIC_NUM[E17]}"; } > "$tmp"
n=$(create "S17.8 Instant cashout to MoMo" "user-story,ride-hailing,phase-2,wave-14,backend,mobile,payments" "$tmp"); rm -f "$tmp"; echo "#$n S17.8 Instant cashout to MoMo"
gh issue comment "${EPIC_NUM[E17]}" --repo "$REPO" --body "- [ ] #$n S17.8" >/dev/null
tmp=$(mktemp); { cat "$DIR/S17.9-next-trip-before-finishing-the-current-one.md"; echo; echo "Part of #${EPIC_NUM[E17]}"; } > "$tmp"
n=$(create "S17.9 Next trip before finishing the current one" "user-story,ride-hailing,phase-2,wave-9,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S17.9 Next trip before finishing the current one"
gh issue comment "${EPIC_NUM[E17]}" --repo "$REPO" --body "- [ ] #$n S17.9" >/dev/null
tmp=$(mktemp); { cat "$DIR/S17.10-driver-training-and-quiz.md"; echo; echo "Part of #${EPIC_NUM[E17]}"; } > "$tmp"
n=$(create "S17.10 Driver training and quiz" "user-story,ride-hailing,phase-2,wave-5,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S17.10 Driver training and quiz"
gh issue comment "${EPIC_NUM[E17]}" --repo "$REPO" --body "- [ ] #$n S17.10" >/dev/null
tmp=$(mktemp); { cat "$DIR/S18.1-driver-selfie-check-before-going-online.md"; echo; echo "Part of #${EPIC_NUM[E18]}"; } > "$tmp"
n=$(create "S18.1 Driver selfie check before going online" "user-story,ride-hailing,phase-2,wave-6,mobile,backend,safety,security" "$tmp"); rm -f "$tmp"; echo "#$n S18.1 Driver selfie check before going online"
gh issue comment "${EPIC_NUM[E18]}" --repo "$REPO" --body "- [ ] #$n S18.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S18.2-trip-anomaly-detection.md"; echo; echo "Part of #${EPIC_NUM[E18]}"; } > "$tmp"
n=$(create "S18.2 Trip anomaly detection" "user-story,ride-hailing,phase-2,wave-11,backend,mobile,safety" "$tmp"); rm -f "$tmp"; echo "#$n S18.2 Trip anomaly detection"
gh issue comment "${EPIC_NUM[E18]}" --repo "$REPO" --body "- [ ] #$n S18.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S18.3-audio-recording-during-the-trip.md"; echo; echo "Part of #${EPIC_NUM[E18]}"; } > "$tmp"
n=$(create "S18.3 Audio recording during the trip" "user-story,ride-hailing,phase-3,wave-11,mobile,backend,safety" "$tmp"); rm -f "$tmp"; echo "#$n S18.3 Audio recording during the trip"
gh issue comment "${EPIC_NUM[E18]}" --repo "$REPO" --body "- [ ] #$n S18.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S18.4-trusted-contacts-auto-share.md"; echo; echo "Part of #${EPIC_NUM[E18]}"; } > "$tmp"
n=$(create "S18.4 Trusted contacts auto-share" "user-story,ride-hailing,phase-2,wave-11,mobile,backend,safety" "$tmp"); rm -f "$tmp"; echo "#$n S18.4 Trusted contacts auto-share"
gh issue comment "${EPIC_NUM[E18]}" --repo "$REPO" --body "- [ ] #$n S18.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S18.5-driving-behaviour-alerts.md"; echo; echo "Part of #${EPIC_NUM[E18]}"; } > "$tmp"
n=$(create "S18.5 Driving behaviour alerts" "user-story,ride-hailing,phase-2,wave-11,mobile,backend,safety" "$tmp"); rm -f "$tmp"; echo "#$n S18.5 Driving behaviour alerts"
gh issue comment "${EPIC_NUM[E18]}" --repo "$REPO" --body "- [ ] #$n S18.5" >/dev/null
tmp=$(mktemp); { cat "$DIR/S18.6-rider-verification-for-driver-safety.md"; echo; echo "Part of #${EPIC_NUM[E18]}"; } > "$tmp"
n=$(create "S18.6 Rider verification for driver safety" "user-story,ride-hailing,phase-2,wave-9,backend,mobile,safety" "$tmp"); rm -f "$tmp"; echo "#$n S18.6 Rider verification for driver safety"
gh issue comment "${EPIC_NUM[E18]}" --repo "$REPO" --body "- [ ] #$n S18.6" >/dev/null
tmp=$(mktemp); { cat "$DIR/S18.7-safety-toolkit.md"; echo; echo "Part of #${EPIC_NUM[E18]}"; } > "$tmp"
n=$(create "S18.7 Safety toolkit" "user-story,ride-hailing,phase-2,wave-11,mobile,ux,safety" "$tmp"); rm -f "$tmp"; echo "#$n S18.7 Safety toolkit"
gh issue comment "${EPIC_NUM[E18]}" --repo "$REPO" --body "- [ ] #$n S18.7" >/dev/null
tmp=$(mktemp); { cat "$DIR/S19.1-fleet-owner-portal.md"; echo; echo "Part of #${EPIC_NUM[E19]}"; } > "$tmp"
n=$(create "S19.1 Fleet owner portal" "user-story,ride-hailing,phase-3,wave-13,mobile,backend,admin" "$tmp"); rm -f "$tmp"; echo "#$n S19.1 Fleet owner portal"
gh issue comment "${EPIC_NUM[E19]}" --repo "$REPO" --body "- [ ] #$n S19.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S19.2-jali-for-business.md"; echo; echo "Part of #${EPIC_NUM[E19]}"; } > "$tmp"
n=$(create "S19.2 Jali for Business" "user-story,ride-hailing,phase-3,wave-14,backend,admin,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S19.2 Jali for Business"
gh issue comment "${EPIC_NUM[E19]}" --repo "$REPO" --body "- [ ] #$n S19.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S19.3-hotel-and-concierge-booking.md"; echo; echo "Part of #${EPIC_NUM[E19]}"; } > "$tmp"
n=$(create "S19.3 Hotel and concierge booking" "user-story,ride-hailing,phase-3,wave-9,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S19.3 Hotel and concierge booking"
gh issue comment "${EPIC_NUM[E19]}" --repo "$REPO" --body "- [ ] #$n S19.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S19.4-partner-api.md"; echo; echo "Part of #${EPIC_NUM[E19]}"; } > "$tmp"
n=$(create "S19.4 Partner API" "user-story,ride-hailing,phase-3,wave-2,backend" "$tmp"); rm -f "$tmp"; echo "#$n S19.4 Partner API"
gh issue comment "${EPIC_NUM[E19]}" --repo "$REPO" --body "- [ ] #$n S19.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S20.1-send-a-package.md"; echo; echo "Part of #${EPIC_NUM[E20]}"; } > "$tmp"
n=$(create "S20.1 Send a package" "user-story,ride-hailing,phase-3,wave-8,mobile,backend,pricing" "$tmp"); rm -f "$tmp"; echo "#$n S20.1 Send a package"
gh issue comment "${EPIC_NUM[E20]}" --repo "$REPO" --body "- [ ] #$n S20.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S20.2-delivery-pin-for-recipient.md"; echo; echo "Part of #${EPIC_NUM[E20]}"; } > "$tmp"
n=$(create "S20.2 Delivery PIN for recipient" "user-story,ride-hailing,phase-3,wave-9,mobile,backend,security" "$tmp"); rm -f "$tmp"; echo "#$n S20.2 Delivery PIN for recipient"
gh issue comment "${EPIC_NUM[E20]}" --repo "$REPO" --body "- [ ] #$n S20.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S20.3-package-categories-and-prohibited-items.md"; echo; echo "Part of #${EPIC_NUM[E20]}"; } > "$tmp"
n=$(create "S20.3 Package categories and prohibited items" "user-story,ride-hailing,phase-3,wave-9,mobile,backend,admin" "$tmp"); rm -f "$tmp"; echo "#$n S20.3 Package categories and prohibited items"
gh issue comment "${EPIC_NUM[E20]}" --repo "$REPO" --body "- [ ] #$n S20.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S21.1-crash-reporting-and-performance-monitoring.md"; echo; echo "Part of #${EPIC_NUM[E21]}"; } > "$tmp"
n=$(create "S21.1 Crash reporting and performance monitoring" "user-story,ride-hailing,phase-1,wave-1,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S21.1 Crash reporting and performance monitoring"
gh issue comment "${EPIC_NUM[E21]}" --repo "$REPO" --body "- [ ] #$n S21.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S21.2-backend-monitoring-and-alerts.md"; echo; echo "Part of #${EPIC_NUM[E21]}"; } > "$tmp"
n=$(create "S21.2 Backend monitoring and alerts" "user-story,ride-hailing,phase-1,wave-1,backend" "$tmp"); rm -f "$tmp"; echo "#$n S21.2 Backend monitoring and alerts"
gh issue comment "${EPIC_NUM[E21]}" --repo "$REPO" --body "- [ ] #$n S21.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S21.3-automated-checks-on-every-pull-request.md"; echo; echo "Part of #${EPIC_NUM[E21]}"; } > "$tmp"
n=$(create "S21.3 Automated checks on every pull request" "user-story,ride-hailing,phase-1,wave-1,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S21.3 Automated checks on every pull request"
gh issue comment "${EPIC_NUM[E21]}" --repo "$REPO" --body "- [ ] #$n S21.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S21.4-staging-environment-with-simulated-drivers.md"; echo; echo "Part of #${EPIC_NUM[E21]}"; } > "$tmp"
n=$(create "S21.4 Staging environment with simulated drivers" "user-story,ride-hailing,phase-1,wave-6,backend" "$tmp"); rm -f "$tmp"; echo "#$n S21.4 Staging environment with simulated drivers"
gh issue comment "${EPIC_NUM[E21]}" --repo "$REPO" --body "- [ ] #$n S21.4" >/dev/null
tmp=$(mktemp); { cat "$DIR/S21.5-load-testing.md"; echo; echo "Part of #${EPIC_NUM[E21]}"; } > "$tmp"
n=$(create "S21.5 Load testing" "user-story,ride-hailing,phase-1,wave-7,backend" "$tmp"); rm -f "$tmp"; echo "#$n S21.5 Load testing"
gh issue comment "${EPIC_NUM[E21]}" --repo "$REPO" --body "- [ ] #$n S21.5" >/dev/null
tmp=$(mktemp); { cat "$DIR/S21.6-fraud-prevention.md"; echo; echo "Part of #${EPIC_NUM[E21]}"; } > "$tmp"
n=$(create "S21.6 Fraud prevention" "user-story,ride-hailing,phase-1,wave-6,backend,mobile,security" "$tmp"); rm -f "$tmp"; echo "#$n S21.6 Fraud prevention"
gh issue comment "${EPIC_NUM[E21]}" --repo "$REPO" --body "- [ ] #$n S21.6" >/dev/null
tmp=$(mktemp); { cat "$DIR/S21.7-rate-limiting-and-abuse-protection.md"; echo; echo "Part of #${EPIC_NUM[E21]}"; } > "$tmp"
n=$(create "S21.7 Rate limiting and abuse protection" "user-story,ride-hailing,phase-1,wave-1,backend,security" "$tmp"); rm -f "$tmp"; echo "#$n S21.7 Rate limiting and abuse protection"
gh issue comment "${EPIC_NUM[E21]}" --repo "$REPO" --body "- [ ] #$n S21.7" >/dev/null
tmp=$(mktemp); { cat "$DIR/S21.8-data-protection-compliance.md"; echo; echo "Part of #${EPIC_NUM[E21]}"; } > "$tmp"
n=$(create "S21.8 Data protection compliance" "user-story,ride-hailing,phase-1,wave-1,backend,security" "$tmp"); rm -f "$tmp"; echo "#$n S21.8 Data protection compliance"
gh issue comment "${EPIC_NUM[E21]}" --repo "$REPO" --body "- [ ] #$n S21.8" >/dev/null
tmp=$(mktemp); { cat "$DIR/S21.9-api-contract-openapi-as-source-of-truth.md"; echo; echo "Part of #${EPIC_NUM[E21]}"; } > "$tmp"
n=$(create "S21.9 API contract (OpenAPI) as source of truth" "user-story,ride-hailing,phase-1,wave-1,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S21.9 API contract (OpenAPI) as source of truth"
gh issue comment "${EPIC_NUM[E21]}" --repo "$REPO" --body "- [ ] #$n S21.9" >/dev/null
tmp=$(mktemp); { cat "$DIR/S21.10-feature-flags-and-remote-config.md"; echo; echo "Part of #${EPIC_NUM[E21]}"; } > "$tmp"
n=$(create "S21.10 Feature flags and remote config" "user-story,ride-hailing,phase-1,wave-2,backend,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S21.10 Feature flags and remote config"
gh issue comment "${EPIC_NUM[E21]}" --repo "$REPO" --body "- [ ] #$n S21.10" >/dev/null
tmp=$(mktemp); { cat "$DIR/S21.11-backups-and-disaster-recovery.md"; echo; echo "Part of #${EPIC_NUM[E21]}"; } > "$tmp"
n=$(create "S21.11 Backups and disaster recovery" "user-story,ride-hailing,phase-1,wave-1,backend" "$tmp"); rm -f "$tmp"; echo "#$n S21.11 Backups and disaster recovery"
gh issue comment "${EPIC_NUM[E21]}" --repo "$REPO" --body "- [ ] #$n S21.11" >/dev/null
tmp=$(mktemp); { cat "$DIR/S21.12-performance-on-low-end-android.md"; echo; echo "Part of #${EPIC_NUM[E21]}"; } > "$tmp"
n=$(create "S21.12 Performance on low-end Android" "user-story,ride-hailing,phase-1,wave-1,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S21.12 Performance on low-end Android"
gh issue comment "${EPIC_NUM[E21]}" --repo "$REPO" --body "- [ ] #$n S21.12" >/dev/null
tmp=$(mktemp); { cat "$DIR/S22.1-deep-links-and-sharing.md"; echo; echo "Part of #${EPIC_NUM[E22]}"; } > "$tmp"
n=$(create "S22.1 Deep links and sharing" "user-story,ride-hailing,phase-3,wave-14,mobile,backend" "$tmp"); rm -f "$tmp"; echo "#$n S22.1 Deep links and sharing"
gh issue comment "${EPIC_NUM[E22]}" --repo "$REPO" --body "- [ ] #$n S22.1" >/dev/null
tmp=$(mktemp); { cat "$DIR/S22.2-segmented-push-campaigns.md"; echo; echo "Part of #${EPIC_NUM[E22]}"; } > "$tmp"
n=$(create "S22.2 Segmented push campaigns" "user-story,ride-hailing,phase-3,wave-3,admin,backend" "$tmp"); rm -f "$tmp"; echo "#$n S22.2 Segmented push campaigns"
gh issue comment "${EPIC_NUM[E22]}" --repo "$REPO" --body "- [ ] #$n S22.2" >/dev/null
tmp=$(mktemp); { cat "$DIR/S22.3-in-app-store-rating-prompt.md"; echo; echo "Part of #${EPIC_NUM[E22]}"; } > "$tmp"
n=$(create "S22.3 In-app store rating prompt" "user-story,ride-hailing,phase-3,wave-13,mobile" "$tmp"); rm -f "$tmp"; echo "#$n S22.3 In-app store rating prompt"
gh issue comment "${EPIC_NUM[E22]}" --repo "$REPO" --body "- [ ] #$n S22.3" >/dev/null
tmp=$(mktemp); { cat "$DIR/S22.4-web-booking-page.md"; echo; echo "Part of #${EPIC_NUM[E22]}"; } > "$tmp"
n=$(create "S22.4 Web booking page" "user-story,ride-hailing,phase-3,wave-8,backend" "$tmp"); rm -f "$tmp"; echo "#$n S22.4 Web booking page"
gh issue comment "${EPIC_NUM[E22]}" --repo "$REPO" --body "- [ ] #$n S22.4" >/dev/null
echo "Done."
