/**
 * All TanStack Query key factories.
 * Always import from here — never use inline string keys.
 * Shared keys = automatic deduplication across screens.
 */
export const queryKeys = {
  // ── Identity ──────────────────────────────────────────────────────────────
  me: () => ["me"] as const,
  adminProfile: () => ["adminProfile"] as const,

  // ── User-facing browsing ───────────────────────────────────────────────────
  trips: {
    all: () => ["trips"] as const,
    search: (from?: number, to?: number, date?: string, near?: { lat: number; lng: number } | null) =>
      ["trips", "search", { from, to, date, near }] as const,
  },
  carRentals: {
    all: () => ["carRentals"] as const,
  },
  privateSeats: {
    all: () => ["privateSeats"] as const,
    search: (from?: string, to?: string, date?: string, near?: { lat: number; lng: number } | null) =>
      ["privateSeats", "search", { from, to, date, near }] as const,
  },
  stations: {
    all: () => ["stations"] as const,
    public: () => ["stations", "public"] as const,
  },

  // ── User bookings ──────────────────────────────────────────────────────────
  bookings: {
    mine: () => ["bookings", "mine"] as const,
    detail: (id: string) => ["bookings", id] as const,
  },

  // ── Driver ────────────────────────────────────────────────────────────────
  driver: {
    stats: () => ["driver", "stats"] as const,
    trips: () => ["driver", "trips"] as const,
    listings: () => ["driver", "listings"] as const,
    listing: (id: number) => ["driver", "listings", id] as const,
    cars: () => ["driver", "cars"] as const,
    profile: () => ["driver", "profile"] as const,
    rates: () => ["driver", "rates"] as const,
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin: {
    bookings: (filter?: string) => ["admin", "bookings", { filter }] as const,
    booking: (id: string) => ["admin", "bookings", id] as const,
    users: () => ["admin", "users"] as const,
    user: (id: string) => ["admin", "users", id] as const,
    stations: () => ["admin", "stations"] as const,
    buses: () => ["admin", "buses"] as const,
    bus: (id: string) => ["admin", "buses", id] as const,
    agencies: () => ["admin", "agencies"] as const,
    trips: (filters?: object) => ["admin", "trips", filters] as const,
    logs: (action?: string) => ["admin", "logs", { action }] as const,
    logGroups: () => ["admin", "logs", "groups"] as const,
    cashoutPreference: () => ["admin", "cashout", "preference"] as const,
    cashoutRequests: () => ["admin", "cashout", "requests"] as const,
    appAccesses: (platform?: string) => ["admin", "appAccesses", { platform }] as const,
    appAccessStats: () => ["admin", "appAccesses", "stats"] as const,
    locations: () => ["admin", "locations"] as const,
    roles: () => ["admin", "roles"] as const,
    rideSettings: () => ["admin", "settings", "rides"] as const,
    role: (id: number) => ["admin", "roles", id] as const,
    permissions: () => ["admin", "permissions"] as const,
    analytics: {
      revenue: () => ["admin", "analytics", "revenue"] as const,
      bookings: () => ["admin", "analytics", "bookings"] as const,
      earnings: () => ["admin", "analytics", "earnings"] as const,
      stations: () => ["admin", "analytics", "stations"] as const,
    },
  },
};
