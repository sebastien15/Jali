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

export type TripStatus = "pending" | "confirmed" | "completed";
export type TripType = "bus" | "rental" | "private";

export interface Trip {
  id: number;
  type: TripType;
  title: string;
  sub: string;
  price: number;
  status: TripStatus;
  ticketPhotoUrl?: string;
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

