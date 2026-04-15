# Mobile UX Patterns — Jali

> Patterns confirmed by Sébastien. Ask before adding new entries.

## Loading States
- **Initial page load** → animated pulse skeleton (opacity 0.3 → 0.7, 750ms, `useNativeDriver: true`)
- **Button / mutation** → `ActivityIndicator` inside the button while `isPending`
- **Background refetch** → no indicator (TanStack handles silently, pull-to-refresh shows `isRefetching`)
- Skeleton is only for the **user dashboard (bus tab)**. Other tabs use spinner for now.

## Data Fetching
- **Never** fetch unbounded lists. Always include `per_page: 50` on every list/search endpoint.
- **Pre-fetch all visible tabs in parallel on mount** — remove `enabled` gates unless data is role-conditional. Use `keepPreviousData` on search queries so filter changes don't flash skeleton.
- **Location-aware results**: use `expo-location` (already installed). Always best-effort — request permission, get coords silently, never block rendering. Pass `near_lat` / `near_lng` only when no explicit `from_station_id` is selected (station filter takes priority over GPS).

## Token & Auth
- `setApiToken` must be synchronous: set `_token` in-memory immediately, write to AsyncStorage in background.
- **Never `await` token writes before navigating** — this holds the login button in loading state unnecessarily.
- Request interceptor pattern: `_token ?? await AsyncStorage.getItem(TOKEN_KEY)` (memory-first).

## TanStack Query Stale Times
| Data type | staleTime |
|---|---|
| Identity / `/me` / roles | `Infinity` |
| Stations, buses, car rentals | `10 * 60_000` |
| Agencies, locations | `5 * 60_000` |
| Analytics, driver stats | `2 * 60_000` |
| Trip / seat availability | `60_000` |
| Admin bookings | `30_000` |
| Paginated logs | `30_000` |

## Meta Rule
> Ask Sébastien before adding anything here or to CLAUDE.md. Only persist patterns that are non-obvious and would recur across sessions. Prompt: "🧠 New pattern spotted: [X]. Add to `.claude/skills/ux-patterns.md`?"
