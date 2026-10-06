import { useState, useMemo, useEffect } from "react";
import { View, ScrollView, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useInfiniteQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import * as Location from "expo-location";
import { C } from "@/constants/theme";
import { StationObj } from "@/components/StationPicker";
import { TripResult, TripDeparture } from "@/components/TripCard";
import { TripBookingSheet, type TripData } from "@/components/TripBookingSheet";
import { BookingSheet } from "@/components/BookingSheet";
import { SearchHeader } from "@/components/home/SearchHeader";
import { ModeTabs } from "@/components/home/ModeTabs";
import { RideNowBar } from "@/components/home/RideNowBar";
import { HireDriverBar } from "@/components/home/HireDriverBar";
import { ActiveRideBanner } from "@/components/rides/ActiveRideBanner";
import { AgencyFilterBar } from "@/components/home/AgencyFilterBar";
import { BusResults } from "@/components/home/BusResults";
import { PrivateResults } from "@/components/home/PrivateResults";
import { RentalResults } from "@/components/home/RentalResults";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { toYmd } from "@/lib/date";

type Mode = "bus" | "private" | "rental";

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const [from, setFrom]   = useState<StationObj | null>(null);
  const [to, setTo]       = useState<StationObj | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });

  const [mode, setMode]               = useState<Mode>("bus");
  const [rentalDays, setRentalDays]   = useState(1);
  const [agencyFilter, setAgencyFilter] = useState<string | null>(null);

  const [sheet, setSheet]             = useState<any>(null);
  const [tripSheet, setTripSheet]     = useState<TripData | null>(null);
  const [tripSheetDate, setTripSheetDate] = useState<Date | null>(null);

  // User location — best-effort, doesn't block rendering
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== "granted") return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then(loc => setUserCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude }))
        .catch(() => {});
    });
  }, []);

  // Local calendar day — toISOString() would shift local midnight to the previous UTC day
  const dateParam = toYmd(selectedDate);
  const todaySelected = selectedDate.toDateString() === new Date().toDateString();
  const timeSet = selectedDate.getHours() !== 0 || selectedDate.getMinutes() !== 0;

  // Pass location only when no explicit from/to is selected (station filter takes priority)
  const nearParam = userCoords && !from?.id ? userCoords : null;

  // ── Bus trips — paginated, 10 per page, location-aware ───────────────────
  const tripsQuery = useInfiniteQuery({
    queryKey: queryKeys.trips.search(from?.id, to?.id, dateParam, nearParam),
    queryFn: ({ pageParam }: { pageParam: number }) => {
      const params: Record<string, any> = { per_page: 10, page: pageParam };
      if (from?.id) params.from_station_id = from.id;
      if (to?.id)   params.to_station_id   = to.id;
      if (nearParam) { params.near_lat = nearParam.lat; params.near_lng = nearParam.lng; }
      return api.get("/trips", { params }).then(r => r.data);
    },
    getNextPageParam: (lastPage: any) =>
      lastPage.next_page_url ? lastPage.current_page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 15 * 60_000, // agency schedules rarely change
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });

  // ── User's past bookings — for agency chip ordering ───────────────────────
  const bookingsQuery = useQuery({
    queryKey: queryKeys.bookings.mine(),
    queryFn: () => api.get("/bookings").then(r => r.data ?? []),
    staleTime: 60_000,
  });

  // ── Car rentals — pre-fetched in background immediately on mount ──────────
  const rentalsQuery = useQuery({
    queryKey: queryKeys.carRentals.all(),
    queryFn: () => api.get("/car-rentals").then(r => r.data ?? []),
    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
  });

  // ── Private seats — paginated, 10 per page, location-aware ─────────────
  const privateQuery = useInfiniteQuery({
    queryKey: queryKeys.privateSeats.search(from?.city, to?.city, dateParam, nearParam),
    queryFn: ({ pageParam }: { pageParam: number }) =>
      api.get("/private-seats", {
        params: {
          per_page: 10,
          page: pageParam,
          from: from?.city,
          ...(to?.city ? { to: to.city } : {}),
          date: dateParam,
          ...(nearParam ? { near_lat: nearParam.lat, near_lng: nearParam.lng } : {}),
        },
      }).then(r => r.data),
    getNextPageParam: (lastPage: any) =>
      lastPage.next_page_url ? lastPage.current_page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 10 * 60_000,
    gcTime: 20 * 60_000,
    placeholderData: keepPreviousData,
  });

  const trips        = tripsQuery.data?.pages.flatMap((p: any) => p.data ?? []) ?? [];
  const cars         = rentalsQuery.data  ?? [];
  const privateSeats = privateQuery.data?.pages.flatMap((p: any) => p.data ?? []) ?? [];

  // isLoading is true only on first load (no cached data). isFetching includes background refetches.
  const loading = mode === "bus"
    ? tripsQuery.isLoading
    : mode === "rental"
      ? rentalsQuery.isLoading
      : privateQuery.isLoading;

  const error = mode === "bus"
    ? (tripsQuery.error as any)?.response?.data?.message ?? (tripsQuery.error ? "Failed to load." : null)
    : mode === "rental"
      ? (rentalsQuery.error as any)?.response?.data?.message ?? (rentalsQuery.error ? "Failed to load." : null)
      : (privateQuery.error as any)?.response?.data?.message ?? (privateQuery.error ? "Failed to load." : null);

  const refetchActive = mode === "bus"
    ? tripsQuery.refetch
    : mode === "rental"
      ? rentalsQuery.refetch
      : privateQuery.refetch;

  // Agency names extracted from past bus bookings (title format: "Agency · from → to")
  const bookedAgencyNames = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const b of (bookingsQuery.data ?? [])) {
      if (b.type !== "trip") continue;
      const agency = b.title?.split(" · ")[0];
      if (agency && !seen.has(agency)) { seen.add(agency); result.push(agency); }
    }
    return result;
  }, [bookingsQuery.data]);

  // Booked agencies shown first, rest sorted alphabetically
  const agencies = useMemo(() => {
    const all = [...new Set(trips.map((t: TripResult) => t.agency_name).filter(Boolean))];
    const bookedSet = new Set(bookedAgencyNames);
    const bookedFirst = bookedAgencyNames.filter(a => all.includes(a));
    const rest = all.filter(a => !bookedSet.has(a)).sort();
    return [...bookedFirst, ...rest];
  }, [trips, bookedAgencyNames]);

  // For today, never offer departures that have already left: filter from the
  // later of "now" and the time the user picked.
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const pickedMins = timeSet ? selectedDate.getHours() * 60 + selectedDate.getMinutes() : 0;
  const timeFilterMins = todaySelected ? Math.max(nowMins, pickedMins) : undefined;

  const filteredTrips = useMemo(() => trips.filter((trip: TripResult) => {
    if (agencyFilter && trip.agency_name !== agencyFilter) return false;
    if (timeFilterMins != null) {
      const hasUpcoming = trip.departures?.some(d => {
        const [h, m] = d.departure_time.split(":").map(Number);
        return h * 60 + m >= timeFilterMins;
      });
      if (!hasUpcoming) return false;
    }
    return true;
  }), [trips, agencyFilter, timeFilterMins]);

  function openTripSheet(trip: TripResult, departure: TripDeparture) {
    setTripSheet({
      id: departure.id,
      agency_id: trip.agency_id,
      agency_name: trip.agency_name,
      agency_rating: trip.agency_rating,
      agency_ratings_count: trip.agency_ratings_count,
      from: trip.from,
      to: trip.to,
      departure_time: departure.departure_time,
      estimated_arrival_time: departure.estimated_arrival_time,
      price: trip.price,
    });
    setTripSheetDate(selectedDate);
  }

  function afterBooking() {
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.mine() });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.blue }} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.blue} />
      <View style={{ flex: 1, backgroundColor: C.bg }}>

      <SearchHeader
        from={from} to={to}
        onFromChange={setFrom} onToChange={setTo}
        onSwap={() => { const tmp = from; setFrom(to); setTo(tmp); }}
        selectedDate={selectedDate} onDateChange={setSelectedDate}
      />

      <ActiveRideBanner role="rider" />
      <RideNowBar />
      <HireDriverBar />

      <ModeTabs mode={mode} onChange={(m) => { setMode(m); setAgencyFilter(null); }} />

      {mode === "bus" && (
        <AgencyFilterBar agencies={agencies} selected={agencyFilter} onChange={setAgencyFilter} />
      )}

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {mode === "bus" && (
          <BusResults
            trips={filteredTrips} loading={loading} error={error}
            isFiltered={!!from || !!to} from={from} to={to}
            todaySelected={todaySelected} timeSet={timeSet} selectedDate={selectedDate}
            timeFilterMins={timeFilterMins}
            onSelectDeparture={openTripSheet} onRetry={refetchActive}
            fetchNextPage={tripsQuery.fetchNextPage}
            hasNextPage={!!tripsQuery.hasNextPage}
            isFetchingNextPage={tripsQuery.isFetchingNextPage}
          />
        )}
        {mode === "private" && (
          <PrivateResults
            items={privateSeats} loading={loading} error={error}
            from={from} to={to}
            onPress={item => setSheet({ type: "private", item, travelDate: dateParam })}
            onRetry={refetchActive}
            fetchNextPage={privateQuery.fetchNextPage}
            hasNextPage={!!privateQuery.hasNextPage}
            isFetchingNextPage={privateQuery.isFetchingNextPage}
          />
        )}
        {mode === "rental" && (
          <RentalResults
            cars={cars} loading={loading} error={error}
            days={rentalDays} onChangeDays={setRentalDays}
            onPress={(car, days) => setSheet({ type: "rental", item: car, days, travelDate: dateParam })}
            onRetry={refetchActive}
          />
        )}
      </ScrollView>

      {sheet && (
        <BookingSheet
          data={sheet}
          userCoords={userCoords}
          onClose={() => setSheet(null)}
          onConfirm={() => { setSheet(null); afterBooking(); }}
        />
      )}
      {tripSheet && (
        <TripBookingSheet
          trip={tripSheet}
          travelDate={tripSheetDate ?? undefined}
          onClose={() => { setTripSheet(null); setTripSheetDate(null); }}
          onConfirm={() => { setTripSheet(null); setTripSheetDate(null); afterBooking(); }}
        />
      )}
      </View>
    </SafeAreaView>
  );
}
