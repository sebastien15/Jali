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

export const BUSES = [
  { id: 1, agency: "Volcano Express", from: "Kigali", to: "Musanze", dep: "06:00", arr: "08:30", price: 3500, seats: 14, rating: 4.8 },
  { id: 2, agency: "Kigali Coach",    from: "Kigali", to: "Huye",    dep: "07:00", arr: "10:00", price: 4200, seats: 3,  rating: 4.6 },
  { id: 3, agency: "RITCO",           from: "Kigali", to: "Rubavu",  dep: "08:00", arr: "11:00", price: 5000, seats: 20, rating: 4.7 },
  { id: 4, agency: "Virunga Express", from: "Kigali", to: "Nyagatare", dep: "09:00", arr: "12:30", price: 4800, seats: 6, rating: 4.5 },
  { id: 5, agency: "Horizon Express", from: "Kigali", to: "Musanze", dep: "10:30", arr: "13:00", price: 3200, seats: 11, rating: 4.9 },
  { id: 6, agency: "Kigali Coach",    from: "Kigali", to: "Muhanga",  dep: "11:00", arr: "12:30", price: 2500, seats: 8,  rating: 4.6 },
];

export const CARS = [
  { id: 1, name: "Toyota RAV4",   type: "SUV",     price: 65000, seats: 5, rating: 4.9, plate: "RAC 123A" },
  { id: 2, name: "VW Polo",       type: "Sedan",   price: 38000, seats: 5, rating: 4.7, plate: "RAB 456B" },
  { id: 3, name: "Toyota Hiace",  type: "Minivan", price: 85000, seats: 9, rating: 4.8, plate: "RAD 789C" },
  { id: 4, name: "Suzuki Vitara", type: "SUV",     price: 52000, seats: 5, rating: 4.6, plate: "RAE 012D" },
];

export const PRIVATE = [
  { id: 1, driver: "Jean Baptiste", from: "Kigali", to: "Musanze", dep: "06:30", price: 8000, seats: 2, rating: 4.9 },
  { id: 2, driver: "Marie Claire",  from: "Kigali", to: "Huye",    dep: "07:00", price: 7500, seats: 1, rating: 4.8 },
  { id: 3, driver: "Patrick N.",    from: "Kigali", to: "Rubavu",  dep: "08:00", price: 9000, seats: 3, rating: 4.7 },
];

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

export const TRIPS: Trip[] = [
  {
    id: 1, type: "bus",
    title: "Kigali → Musanze", sub: "Volcano Express · Apr 6, 06:00",
    price: 3700, status: "confirmed",
    ticketPhotoUrl: undefined, // admin uploads this
  },
  {
    id: 2, type: "rental",
    title: "Toyota RAV4", sub: "3 days · Apr 3–5",
    price: 195000, status: "completed",
  },
  {
    id: 3, type: "private",
    title: "Kigali → Huye", sub: "Driver: Marie Claire · Mar 30",
    price: 7500, status: "completed",
  },
];

export const PAY_METHODS = ["MTN MoMo", "Airtel Money", "Card"] as const;
export type PayMethod = typeof PAY_METHODS[number];

// ── Driver mock data ──────────────────────────────────────────────
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

export const MOCK_DRIVER_STATS: DriverStats = {
  todayEarnings: 47500,
  todayTrips: 8,
  rating: 4.92,
  weekEarnings: 312000,
  weekTrips: 41,
};

export const MOCK_DRIVER_TRIPS: DriverTrip[] = [
  { id: 1, from: "Nyabugogo", to: "Musanze",   dep: "06:30", pax: 2, earning: 16000, status: "upcoming",   date: "Today" },
  { id: 2, from: "Remera",    to: "Huye",       dep: "07:00", pax: 3, earning: 22500, status: "upcoming",   date: "Today" },
  { id: 3, from: "Kigali",    to: "Rubavu",     dep: "08:00", pax: 1, earning: 15000, status: "completed",  date: "Today" },
  { id: 4, from: "Kigali",    to: "Nyagatare",  dep: "09:00", pax: 2, earning: 19200, status: "completed",  date: "Yesterday" },
  { id: 5, from: "Kigali",    to: "Musanze",    dep: "10:30", pax: 3, earning: 12800, status: "completed",  date: "Yesterday" },
];

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

export const MOCK_DRIVER_CARS: DriverCar[] = [
  { id: 1, name: "Toyota RAV4",  type: "SUV",     plate: "RAC 001A", seats: 5, priceDay: 65000, caution: 50000, status: "available",   zones: ["Kigali CBD", "Remera"],     notes: "AC, music system", amenities: ["AC", "Music System", "USB Charging", "Large Boot"], photos: {} },
  { id: 2, name: "VW Polo",      type: "Sedan",   plate: "RAB 002B", seats: 5, priceDay: 38000, caution: 30000, status: "rented",      zones: ["Kigali CBD"],               notes: "",                 amenities: ["AC", "USB Charging"], photos: {} },
  { id: 3, name: "Toyota Hiace", type: "Minivan", plate: "RAD 003C", seats: 9, priceDay: 85000, caution: 70000, status: "maintenance", zones: ["Kigali CBD", "Kimironko"], notes: "Service due Apr 10", amenities: ["AC", "Music System", "Large Boot", "Reclining Seats"], photos: {} },
];

// ── Private driver listing mock data ─────────────────────────────
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

export const MOCK_DRIVER_LISTINGS: DriverListing[] = [
  { id: 1, from: "Kigali", to: "Musanze",  pickupStation: "Nyabugogo Terminal", dropLocation: "Musanze Town Center", date: "Today",  dep: "06:30", seats: 3, price: 8000, notes: "AC available", active: true,  amenities: ["AC", "USB Charging"], groupDiscount: false, groupMinSize: 3, groupDiscountPct: 10, allowCustomPickup: false, customPickupFee: 0 },
  { id: 2, from: "Kigali", to: "Huye",     pickupStation: "Nyabugogo Terminal", dropLocation: "",                   date: "Tomorrow", dep: "07:00", seats: 2, price: 7500, notes: "",            active: true,  amenities: ["AC"], groupDiscount: false, groupMinSize: 3, groupDiscountPct: 10, allowCustomPickup: false, customPickupFee: 0 },
];
