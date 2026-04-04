---
name: Project Jali
description: Rwandan transport booking app — final tech stack, booking flow, screens, data models
type: project
---

Jali is a Rwandan transport booking app (prototyped as "RwaMove" in rwamove-v2.jsx). Building production app mobile-first.

**Why:** Build a transport platform for Rwanda covering bus booking, private car seats, and car rental. Small service fee model — keep infra costs minimal.

---

## Final Tech Stack

| Concern | Tool |
|---|---|
| Mobile (iOS + Android) | Expo (React Native) |
| Navigation | Expo Router (file-based) |
| Styling | NativeWind (Tailwind for RN) |
| Phone OTP login | Firebase Auth |
| Ticket photo upload/view | Firebase Storage |
| Push notifications | Firebase FCM |
| Business logic / API | Laravel 11 (REST) — built after mobile |
| Database | PostgreSQL |
| Hosting | Hetzner VPS (~$6/mo) |

**Dropped:** Africa's Talking (cost), real-time seat counts (complexity)

---

## Repo Structure

```
Jali/
├── mobile/          ← Expo app (built first)
├── backend/         ← Laravel API (built second)
├── project_jali.md
├── user_profile.md
└── MEMORY.md
```

---

## Manual Ticket Booking Flow

```
User requests booking in app
        ↓
Laravel creates booking (status: pending)
        ↓
Admin manually arranges / contacts bus agency
        ↓
Admin takes photo of physical paper ticket
        ↓
Admin uploads photo → Firebase Storage
        ↓
Laravel stores photo URL → status: confirmed
        ↓
FCM push notification to user
        ↓
User sees ticket photo in My Trips
        ↓
User collects physical ticket at bus station
```

---

## Screens

| Screen | File | Purpose |
|---|---|---|
| Login | (auth)/login.tsx | Phone (+250) + 4-digit OTP |
| Home/Book | (tabs)/index.tsx | Search + Bus/Private/Rental listings |
| My Trips | (tabs)/trips.tsx | Bookings + status + ticket photo viewer |
| Driver Dashboard | (tabs)/drive.tsx | Online/offline, zones, earnings, rides |
| Profile | (tabs)/profile.tsx | User info, settings, logout |
| Booking Sheet | components/BookingSheet.tsx | Price breakdown + pay method picker |

---

## Data Models

### Cities
`["Kigali","Musanze","Huye","Rubavu","Nyagatare","Rwamagana","Muhanga","Rusizi"]`

### Bus
`{ id, agency, from, to, dep, arr, price (RWF), seats, rating }`
Agencies: Volcano Express, Kigali Coach, RITCO, Virunga Express, Horizon Express

### Car Rental
`{ id, name, type (SUV/Sedan/Minivan), price (RWF/day), seats, img, rating, plate }`

### Private Seat
`{ id, driver, from, to, dep, price (RWF, upfront/no-refund), seats, rating }`

### Booking / Trip
`{ id, type (bus/rental/private), title, sub, price, status (pending/confirmed/completed), ticketPhotoUrl? }`

---

## Payment Methods (labels — actual integration TBD)
- MTN MoMo
- Airtel Money
- Card

## Key UX Rules
- Bus booking adds 200 RWF service fee
- Private seat: upfront, no refund if passenger is late
- Car rental: price × days
- Driver screen uses teal (#009E8E) accent
- QR tickets replaced by ticket photo (Firebase Storage URL)

## UI Palette
```
blue: #0055CC  |  blueDk: #003D99  |  blueLt: #E8F0FF
yellow: #FFD000  |  green: #00A63E  |  greenLt: #E6F7ED
orange: #FF5C00  |  orangeLt: #FFF0E8
teal: #009E8E   |  tealLt: #E5F7F5
bg: #F2F4F8  |  dark: #0D1117  |  mid: #4A5568
muted: #9AA5B4  |  border: #DDE2EC  |  white: #FFFFFF
```
Font: Nunito, weights 400/600/700/800/900
