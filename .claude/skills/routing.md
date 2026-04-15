# Routing Conventions

## Expo Router Route Groups

In Expo Router, folders with parentheses `(group)` are **transparent** — they do NOT appear in the URL.
So `app/(auth)/login.tsx` and `app/(admin)/login.tsx` would BOTH resolve to `/login` → conflict.

## Login Routes (important — don't regress this)

| File | URL | Purpose |
|---|---|---|
| `app/(auth)/login.tsx` | `/login` | User / driver login (phone OTP, email, Google) |
| `app/(admin)/admin-login.tsx` | `/admin-login` | Admin portal login (email + password, Firebase fallback) |

The admin login was renamed from `login.tsx` → `admin-login.tsx` to resolve the `/login` conflict.

## References to Update if Admin Login Route Changes

- `app/(admin)/_layout.tsx` line ~45: `pathname.includes("/admin-login")`
- `app/(admin)/_layout.tsx` line ~63: `<Redirect href="/(admin)/admin-login" />`
- `app/(admin)/_layout.tsx` line ~143: `<Tabs.Screen name="admin-login" />`
- `app/(auth)/login.tsx` line ~511: `router.push("/(admin)/admin-login")`

## Route Groups Summary

```
(auth)/     → user auth screens   → URL: /login
(tabs)/     → user app (tabbed)   → URL: /
(admin)/    → admin portal        → URL: /admin-login, /dashboard, /bookings, etc.
driver/     → driver flows        → URL: /driver/setup, /driver/fleet, /driver/listing
legal/      → legal docs          → URL: /legal/[doc]
```
