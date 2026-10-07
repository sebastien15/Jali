/**
 * All TanStack Query key factories.
 * Always import from here — never use inline string keys.
 * Shared keys = automatic deduplication across screens.
 */
export const queryKeys = {
  // ── Identity ──────────────────────────────────────────────────────────────
  me: () => ["me"] as const,
  support: {
    tickets: () => ["support", "tickets"] as const,
    ticket: (id: number) => ["support", "ticket", id] as const,
  },
  help: {
    topics: (locale: string, service?: string, context?: string, q?: string) => ["help", "topics", locale, service ?? null, context ?? null, q ?? null] as const,
    topic: (slug: string, locale: string) => ["help", "topic", slug, locale] as const,
  },
  /** S23.1 services contract; coords rounded so small moves reuse the cache */
  serviceAccess: (lat?: number | null, lng?: number | null) => ["serviceAccess", lat ?? null, lng ?? null] as const,
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
  // Car rental (epic E24)
  rentals: {
    search: (params: object) => ["rentals", "search", params] as const,
    car: (id: number, params?: object) => ["rentals", "car", id, params] as const,
    bookings: (scope?: string) => ["rentals", "bookings", scope] as const,
    booking: (id: number) => ["rentals", "booking", id] as const,
  },
  journeys: {
    search: (from?: string, to?: string, date?: string) => ["journeys", "search", from ?? null, to ?? null, date ?? null] as const,
    detail: (id: number, date: string) => ["journeys", "detail", id, date] as const,
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

  // ── On-demand rides ───────────────────────────────────────────────────────
  rides: {
    nearby: (q: object | null) => ["rides", "nearby", q] as const,
    active: () => ["rides", "active"] as const,
    detail: (id: number) => ["rides", id] as const,
    mine: () => ["rides", "mine"] as const,
  },

  hire: {
    available: (q: object | null) => ["hire", "available", q] as const,
    mine: () => ["hire", "mine"] as const,
    detail: (id: number) => ["hire", id] as const,
  },

  // ── Driver ────────────────────────────────────────────────────────────────
  driver: {
    stats: () => ["driver", "stats"] as const,
    trips: () => ["driver", "trips"] as const,
    listings: () => ["driver", "listings"] as const,
    cars: () => ["driver", "cars"] as const,
    profile: () => ["driver", "profile"] as const,
    rates: () => ["driver", "rates"] as const,
    vehicles: () => ["driver", "vehicles"] as const,
    onboarding: () => ["driver", "onboarding"] as const,
    presence: () => ["driver", "presence"] as const,
    rideRequests: () => ["driver", "rideRequests"] as const,
    hireSettings: () => ["driver", "hireSettings"] as const,
    availability: () => ["driver", "availability"] as const,
    hires: (scope: string) => ["driver", "hires", scope] as const,
    earnings: () => ["driver", "earnings"] as const,
    car: (id: number) => ["driver", "car", id] as const,
    rentals: (status?: string) => ["driver", "rentals", status] as const,
    rental: (id: number) => ["driver", "rental", id] as const,
    rentalSummary: () => ["driver", "rentalSummary"] as const,
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin: {
    // `all*` prefixes are for invalidation: a key built with an `undefined`
    // filter (["admin","bookings",{filter:undefined}]) does NOT prefix-match
    // the filtered queries that are actually mounted.
    allBookings: () => ["admin", "bookings"] as const,
    allTrips: () => ["admin", "trips"] as const,
    allLogs: () => ["admin", "logs"] as const,
    allAppAccesses: () => ["admin", "appAccesses"] as const,
    bookings: (filter?: string) => ["admin", "bookings", { filter }] as const,
    booking: (id: string) => ["admin", "bookings", id] as const,
    users: () => ["admin", "users"] as const,
    user: (id: string) => ["admin", "users", id] as const,
    stations: () => ["admin", "stations"] as const,
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
    serviceAreas: () => ["admin", "serviceAreas"] as const,
    services: () => ["admin", "services"] as const,
    helpTopics: () => ["admin", "helpTopics"] as const,
    hires: (filters?: object) => ["admin", "hires", "list", filters] as const,
    hire: (id: number) => ["admin", "hires", id] as const,
    supportInbox: (filter: string) => ["admin", "support", "inbox", filter] as const,
    supportTicket: (id: number) => ["admin", "support", "ticket", id] as const,
    cannedReplies: () => ["admin", "support", "canned"] as const,
    serviceArea: (id: number) => ["admin", "serviceAreas", id] as const,
    drivers: (status?: string) => ["admin", "drivers", { status }] as const,
    driver: (id: number) => ["admin", "drivers", id] as const,
    ridesLive: () => ["admin", "rides", "live"] as const,
    rentalCars: (status: string) => ["admin", "rentalCars", status] as const,
    rentalCar: (id: number) => ["admin", "rentalCar", id] as const,
    rentalsOps: (status?: string) => ["admin", "rentals", status] as const,
    rentalOps: (id: number) => ["admin", "rental", id] as const,
    settlements: (status: string) => ["admin", "settlements", status] as const,
    rides: (filters?: object) => ["admin", "rides", "list", filters] as const,
    ride: (id: number) => ["admin", "rides", id] as const,
    role: (id: number) => ["admin", "roles", id] as const,
    permissions: () => ["admin", "permissions"] as const,
    analytics: {
      all: () => ["admin", "analytics"] as const,
      revenue: () => ["admin", "analytics", "revenue"] as const,
      bookings: () => ["admin", "analytics", "bookings"] as const,
      earnings: () => ["admin", "analytics", "earnings"] as const,
      stations: () => ["admin", "analytics", "stations"] as const,
      rides: (period: "day" | "week") => ["admin", "analytics", "rides", period] as const,
    },
  },
};
