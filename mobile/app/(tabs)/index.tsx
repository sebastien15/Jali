import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "@/constants/theme";
import { StationObj } from "@/components/StationPicker";
import { TripResult } from "@/components/TripCard";
import { TripBookingSheet } from "@/components/TripBookingSheet";
import { BookingSheet } from "@/components/BookingSheet";
import { SearchHeader } from "@/components/home/SearchHeader";
import { ModeTabs } from "@/components/home/ModeTabs";
import { AgencyFilterBar } from "@/components/home/AgencyFilterBar";
import { BusResults } from "@/components/home/BusResults";
import { PrivateResults } from "@/components/home/PrivateResults";
import { RentalResults } from "@/components/home/RentalResults";
import api from "@/lib/api";

type Mode = "bus" | "private" | "rental";

function formatDateLabel(d: Date): string {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const timeStr = d.toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today · ${timeStr}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${timeStr}`;
  return `${d.toLocaleDateString("en-RW", { month: "short", day: "numeric" })} · ${timeStr}`;
}

export default function HomeScreen() {
  const [from, setFrom]   = useState<StationObj | null>(null);
  const [to, setTo]       = useState<StationObj | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });

  const [mode, setMode]               = useState<Mode>("bus");
  const [rentalDays, setRentalDays]   = useState(1);
  const [agencyFilter, setAgencyFilter] = useState<string | null>(null);

  const [sheet, setSheet]             = useState<any>(null);
  const [tripSheet, setTripSheet]     = useState<TripResult | null>(null);
  const [tripSheetDate, setTripSheetDate] = useState<string>("");

  const [trips, setTrips]           = useState<TripResult[]>([]);
  const [cars, setCars]             = useState<any[]>([]);
  const [privateSeats, setPrivate]  = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const dateParam = selectedDate.toISOString().split("T")[0];
  const todaySelected = selectedDate.toDateString() === new Date().toDateString();
  const timeSet = selectedDate.getHours() !== 0 || selectedDate.getMinutes() !== 0;

  function fetchAll() {
    setLoading(true);
    setError(null);
    const tripParams: Record<string, any> = {};
    if (from?.id) tripParams.from_station_id = from.id;
    if (to?.id)   tripParams.to_station_id   = to.id;

    Promise.all([
      api.get("/trips", { params: tripParams }),
      api.get("/car-rentals"),
      api.get("/private-seats", {
        params: { from: from?.city, ...(to?.city ? { to: to.city } : {}), date: dateParam },
      }),
    ])
      .then(([t, c, p]) => {
        setTrips(t.data ?? []);
        setCars(c.data ?? []);
        setPrivate(p.data ?? []);
        setAgencyFilter(null);
      })
      .catch(err => {
        setError(err?.response?.data?.message ?? err?.response?.data?.error ?? "Failed to load. Check your connection.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchAll(); }, [from, to, selectedDate]);

  const agencies = useMemo(() => [...new Set(trips.map(t => t.agency_name))].sort(), [trips]);

  const filteredTrips = useMemo(() => trips.filter(trip => {
    if (agencyFilter && trip.agency_name !== agencyFilter) return false;
    if (todaySelected && timeSet) {
      const [h, m] = trip.departure_time.split(":").map(Number);
      if ((h * 60 + m) < (selectedDate.getHours() * 60 + selectedDate.getMinutes())) return false;
    }
    return true;
  }), [trips, agencyFilter, selectedDate, todaySelected, timeSet]);

  function openTripSheet(trip: TripResult) {
    setTripSheet(trip);
    setTripSheetDate(formatDateLabel(selectedDate));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.blue} />

      <SearchHeader
        from={from} to={to}
        onFromChange={setFrom} onToChange={setTo}
        onSwap={() => { const tmp = from; setFrom(to); setTo(tmp); }}
        selectedDate={selectedDate} onDateChange={setSelectedDate}
      />

      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "bus" && (
        <AgencyFilterBar agencies={agencies} selected={agencyFilter} onChange={setAgencyFilter} />
      )}

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {mode === "bus" && (
          <BusResults
            trips={filteredTrips} loading={loading} error={error}
            isFiltered={!!from || !!to} from={from} to={to}
            todaySelected={todaySelected} timeSet={timeSet} selectedDate={selectedDate}
            onPress={openTripSheet} onRetry={fetchAll}
          />
        )}
        {mode === "private" && (
          <PrivateResults
            items={privateSeats} loading={loading} error={error}
            from={from} to={to}
            onPress={item => setSheet({ type: "private", item, travelDate: formatDateLabel(selectedDate) })}
            onRetry={fetchAll}
          />
        )}
        {mode === "rental" && (
          <RentalResults
            cars={cars} loading={loading} error={error}
            days={rentalDays} onChangeDays={setRentalDays}
            onPress={(car, days) => setSheet({ type: "rental", item: car, days, travelDate: formatDateLabel(selectedDate) })}
            onRetry={fetchAll}
          />
        )}
      </ScrollView>

      {sheet && <BookingSheet data={sheet} onClose={() => setSheet(null)} onConfirm={() => setSheet(null)} />}
      {tripSheet && (
        <TripBookingSheet
          trip={tripSheet}
          travelDate={tripSheetDate}
          onClose={() => { setTripSheet(null); setTripSheetDate(""); }}
          onConfirm={() => { setTripSheet(null); setTripSheetDate(""); }}
        />
      )}
    </SafeAreaView>
  );
}
