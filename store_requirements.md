# Jali — App Store & Play Store Requirements

## Status Legend
- [ ] Not started
- [~] Partially done
- [x] Done

---

## Critical — Hard rejection without these

- [x] Privacy Policy — in-app screen at `/legal/privacy`
- [x] Delete account — in Profile with double confirmation
- [ ] **Sign in with Apple** — Apple rule: if Google login exists, Apple login is mandatory. Blocks iOS submission entirely.
- [ ] **Data Safety form** — fill out in Google Play Console (what data is collected, why, whether shared). Must match what the app actually does.
- [ ] **Privacy nutrition labels** — fill out in App Store Connect (same concept as Play data safety).

---

## Important — Rejection risk or bad user reviews

- [x] **Location permission strings** — added to `app.json` under `ios.infoPlist` and `android.permissions`.

- [ ] **Offline / no internet handling** — if user has no connection, app should show a clear message instead of a blank screen or infinite spinner.

- [ ] **HTTPS only** — Laravel API must be served over `https://api.jali.rw`. iOS blocks plain HTTP by default (App Transport Security). Android warns.

- [ ] **Firebase Crashlytics** — both stores manually test apps. Crashes during their review = instant rejection. Crashlytics lets you catch and fix crashes before submission.
  - Install: `npx expo install @react-native-firebase/app @react-native-firebase/crashlytics`

- [ ] **Push notification permission prompt** — iOS requires explicit user permission before sending any push. Add a prompt on first login using `expo-notifications`.

---

## Required Store Assets

### Play Store (Google)
| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG, no alpha | [ ] |
| Feature graphic | 1024×500 JPG or PNG | [ ] |
| Screenshots | Min 2, phone + tablet | [ ] |
| Short description | Max 80 characters | [ ] |
| Full description | Max 4000 characters | [ ] |
| Privacy policy URL | Public URL | [ ] |
| Support email | Real contact | [ ] |
| Content rating | Fill IARC questionnaire | [ ] |
| Data safety form | Declare all data collected | [ ] |

### App Store (Apple)
| Asset | Spec | Status |
|---|---|---|
| App icon | 1024×1024 PNG, no alpha, no rounded corners | [ ] |
| Screenshots (6.5") | iPhone 14 Pro Max size | [ ] |
| Screenshots (5.5") | iPhone 8 Plus size | [ ] |
| Screenshots (iPad) | If supporting tablet | [ ] |
| App description | Max 4000 characters | [ ] |
| Promotional text | Max 170 characters (editable without resubmit) | [ ] |
| Keywords | Max 100 characters | [ ] |
| Support URL | Public URL | [ ] |
| Privacy policy URL | Public URL | [ ] |
| Copyright | e.g. "© 2026 Jali" | [ ] |
| Age rating | Fill questionnaire (expected: 4+) | [ ] |
| Privacy nutrition labels | Declare data types in App Store Connect | [ ] |

---

## Smaller Checks Both Stores Do

- [ ] **No test/placeholder content in screenshots** — remove "Jean Pierre", fake bookings, mock data before taking submission screenshots.
- [ ] **Content/age rating** — Jali is appropriate for all ages (4+ / Everyone). Fill the rating questionnaire in both consoles.
- [ ] **Version number consistency** — `version` in `mobile/app.json` must match what you enter in the store consoles.
- [ ] **Text/font scaling** — app should not break if user has large text enabled in accessibility settings. Test at largest font size.
- [ ] **Back button behavior (Android)** — pressing back from the home tab should exit the app gracefully, not crash.
- [ ] **Dark mode** — app currently uses fixed light colors. Mark it as "Light mode only" in `app.json` (`userInterfaceStyle: "light"`) so it doesn't look broken on dark mode devices. *(Already set.)*

---

## What to Build Before Submission (Priority Order)

| # | Task | Blocks |
|---|---|---|
| 1 | Sign in with Apple | iOS submission |
| 2 | Location permission strings in app.json | Both stores |
| 3 | Offline / no-internet screen | Both stores (bad review risk) |
| 4 | Firebase Crashlytics | Both stores (crash during review = rejection) |
| 5 | FCM push notification permission prompt | iOS (required before sending any push) |
| 6 | ~~Real support contact on Help & Support~~ | Done — WhatsApp link in profile |
| 7 | Store assets (icons, screenshots, descriptions) | Submission |
| 8 | Fill Data Safety / Nutrition Labels in consoles | Submission |
| 9 | Apple Developer account ($99/yr) + iOS build | iOS submission |

---

## Notes

- **Apple Developer account** costs $99/year and is required before you can submit to the App Store or even build a signed iOS IPA.
- **Play Store** one-time $25 registration fee.
- **Screenshots** should be taken from the final production build, not dev mode. Use a real device or an emulator at the correct resolution.
- **Privacy policy URL** needs to be a real publicly accessible web page. Options: a simple page on GitHub Pages, Notion, or your future `jali.rw` domain.
- **Support URL** can be a WhatsApp link or a simple contact page.
- Once the Laravel backend is live, replace all mock data before taking screenshots.
