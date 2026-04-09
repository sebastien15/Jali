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

// ── Private driver listing interface ─────────────────────────────
export interface DriverListing {
  id: number;
  from: string;
  to: string;
  pickupStation: string;
  dropLocation: string;
  date: string;
  dep: string;
  seats: number;
  price: number;
  notes: string;
  active: boolean;
  amenities: CarAmenity[];
  groupDiscount: boolean;
  groupMinSize: number;
  groupDiscountPct: number;
  allowCustomPickup: boolean;
  customPickupFee: number;
}

