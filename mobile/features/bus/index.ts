// Public API of the bus feature (agency trip search results, agency filter, trip booking sheet).
// Other features and composition roots import only from "@/features/bus".
// The multi-type components/BookingSheet.tsx (bus/private/rental) stays shared until it is split.
export { BusResults } from "./components/BusResults";
export { AgencyFilterBar } from "./components/AgencyFilterBar";
export { TripCard, type TripResult, type TripDeparture } from "./components/TripCard";
export { TripBookingSheet, type TripData } from "./components/TripBookingSheet";
export { bookedAgencyNames, orderAgencies, filterBusTrips } from "./filters";
