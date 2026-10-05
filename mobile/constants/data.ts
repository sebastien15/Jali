export const CITIES = [
  "Kigali", "Musanze", "Huye", "Rubavu",
  "Nyagatare", "Rwamagana", "Muhanga", "Rusizi",
];

export const BUS_STATIONS: Record<string, string[]> = {
  "Kigali":    ["Nyabugogo Terminal", "Downtown Kigali", "Remera Stage", "Sonatubes/Gikondo", "Kimironko Stage"],
  "Musanze":   ["Musanze Bus Terminal", "Musanze Town Center"],
  "Huye":      ["Huye Bus Terminal", "Huye Town Center"],
  "Rubavu":    ["Rubavu/Gisenyi Terminal", "Rubavu Town Center"],
  "Nyagatare": ["Nyagatare Bus Terminal"],
  "Rwamagana": ["Rwamagana Bus Station"],
  "Muhanga":   ["Muhanga Bus Terminal"],
  "Rusizi":    ["Rusizi Bus Terminal", "Kamembe Town"],
};

export const CAR_AMENITIES = [
  "AC", "Music System", "USB Charging", "12V Socket",
  "WiFi Hotspot", "Large Boot", "Roof Rack", "Baby Seat",
  "Pet Friendly", "Luggage Trailer", "Reclining Seats", "Tinted Windows",
] as const;
export type CarAmenity = typeof CAR_AMENITIES[number];

/** Booking lifecycle as enforced by the backend (BookingController / AdminBookingController). */
export type TripStatus = "pending" | "taken" | "ticket_ready" | "delivered" | "cancelled";
/** Bus-company trips are created as "trip"; "bus" is the legacy bus listing type. */
export type TripType = "trip" | "bus" | "rental" | "private";

/** An item of GET /bookings (the caller's own bookings). */
export interface Trip {
  id: number;
  type: TripType;
  title: string;
  sub?: string | null;
  price: number;
  service_fee?: number;
  status: TripStatus;
  quantity?: number | null;
  travel_date?: string | null;
  created_at?: string;
  ticket_photo_url?: string | null;
}

export const PAY_METHODS = ["MTN MoMo", "Airtel Money", "Card"] as const;
export type PayMethod = typeof PAY_METHODS[number];

export interface DriverTrip {
  id: number;
  from: string;
  to: string;
  dep: string;
  pax: number;
  earning: number; // driver's cut (price, not service fee)
  status: "upcoming" | "completed" | "cancelled";
  date: string;
}

export interface DriverStats {
  todayEarnings: number;
  todayTrips: number;
  rating: number;
  weekEarnings: number;
  weekTrips: number;
}

// ── Car rental owner mock data ────────────────────────────────────
export interface DriverCar {
  id: number;
  name: string;
  type: "Sedan" | "SUV" | "Minivan" | "Pickup";
  plate: string;
  seats: number;
  priceDay: number;
  caution: number;
  status: "available" | "rented" | "maintenance";
  zones: string[];
  notes: string;
  amenities: CarAmenity[];
  photos: { front?: string; side?: string; interior?: string; luggage?: string };
}

// ── Public catalog items ─────────────────────────────────────────
/** Item of GET /private-seats (PrivateSeat model). */
export interface PrivateSeatItem {
  id: number;
  driver: string;
  from: string;
  to: string;
  pickup_station?: string | null;
  dep: string;
  date?: string | null;
  price: number;
  seats: number;
  rating?: number | string | null;
}

/** Item of GET /car-rentals (CarRental model). */
export interface CarRentalItem {
  id: number;
  name: string;
  type: string;
  plate: string;
  price: number; // per day
  caution?: number | null;
  seats: number;
  rating?: number | string | null;
}

// ── Private driver listing (API shape, see PrivateSeatController) ─
// Field names are snake_case exactly as the backend returns/accepts them.
export interface DriverListing {
  id: number;
  from: string;
  to: string;
  pickup_station: string;
  drop_location: string | null;
  /** `Y-m-d` for listings created by current app versions; older rows hold a free-text label. */
  date: string | null;
  dep: string;
  seats: number;
  price: number;
  notes?: string | null;
  active: boolean;
  amenities: CarAmenity[] | null;
  group_discount: boolean;
  group_min_size: number | null;
  group_discount_pct: number | null;
  allow_custom_pickup: boolean;
  custom_pickup_fee: number | null;
}

/** Body for POST/PATCH /driver/listings. */
export type DriverListingPayload = Omit<DriverListing, "id" | "active">;

