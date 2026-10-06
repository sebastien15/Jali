import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { RentalBooking, RentalStatus, STATUS_META, formatWhen } from "../rentals";
import { Badge, Chip, Empty, Row, Section } from "../components/ui";
import { RentalRecordView } from "../components/RentalRecordView";

const FILTERS: (RentalStatus | null)[] = [null, "requested", "accepted", "active", "completed", "cancelled", "declined", "expired"];

/** Admin: all rentals (S24.9) */
export function AdminRentalsScreen() {
  const [status, setStatus] = useState<RentalStatus | null>(null);
  const { data = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.admin.rentalsOps(status ?? "all"),
    queryFn: () => api.get<{ data: RentalBooking[] }>("/admin/rentals", { params: status ? { status } : {} }).then(r => r.data.data),
  });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title="Rentals" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map(f => <Chip key={f ?? "all"} label={f ? STATUS_META[f].label : "All"} on={status === f} onPress={() => setStatus(f)} />)}
        </ScrollView>
        {isLoading ? <ActivityIndicator color={C.teal} /> : data.length === 0 ? <Empty icon="calendar-outline" title="No rentals" /> : data.map(b => (
          <TouchableOpacity key={b.id} onPress={() => router.push({ pathname: "/(admin)/rentals/[id]", params: { id: String(b.id) } } as any)}
            style={{ backgroundColor: C.white, borderRadius: 14, padding: 12, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "800", color: C.dark }}>#{b.id} · {b.car?.name}</Text>
              <Text style={{ fontWeight: "800", color: C.dark }}>{formatRwf(b.final_total ?? b.total)}</Text>
            </View>
            <Text style={{ color: C.mid, fontSize: 12 }}>{b.customer?.name} ← {b.owner?.name}</Text>
            <Text style={{ color: C.mid, fontSize: 12 }}>{formatWhen(b.start_at)} → {formatWhen(b.end_at)}</Text>
            <Badge label={STATUS_META[b.status].label} color={STATUS_META[b.status].color} bg={STATUS_META[b.status].bg} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Admin: one rental with both contacts, records and ratings (S24.9) */
export function AdminRentalScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data: b, isLoading } = useQuery({
    queryKey: queryKeys.admin.rentalOps(id),
    queryFn: () => api.get<RentalBooking>(`/admin/rentals/${id}`).then(r => r.data),
  });
  if (isLoading || !b) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><AdminHeader title="Rental" showBack /><ActivityIndicator color={C.teal} style={{ marginTop: 40 }} /></SafeAreaView>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title={`Rental #${b.id}`} showBack />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <Section>
          <Badge label={STATUS_META[b.status].label} color={STATUS_META[b.status].color} bg={STATUS_META[b.status].bg} />
          <Row label="Car" value={`${b.car?.name} · ${b.car?.plate ?? ""}`} />
          <Row label="Pickup" value={formatWhen(b.start_at)} />
          <Row label="Return" value={formatWhen(b.end_at)} />
          <Row label="Total / final" value={`${formatRwf(b.total)} / ${b.final_total != null ? formatRwf(b.final_total) : "—"}`} />
          {b.cancel_fee > 0 && <Row label="Cancel fee" value={formatRwf(b.cancel_fee)} />}
          {!!b.cancel_reason && <Row label={`Cancelled by ${b.cancelled_by}`} value={b.cancel_reason} />}
        </Section>
        {[{ who: "Customer", p: b.customer }, { who: "Owner", p: b.owner }].map(({ who, p }) => p && (
          <Section key={who} title={who}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ flex: 1, color: C.dark, fontWeight: "700" }}>{p.name} · {p.phone ?? "—"}</Text>
              {!!p.phone && <TouchableOpacity onPress={() => Linking.openURL(`tel:${p.phone}`)}><Ionicons name="call" size={20} color={C.green} /></TouchableOpacity>}
            </View>
          </Section>
        ))}
        {b.handover && <RentalRecordView title="Handover" record={b.handover} />}
        {b.return_record && <RentalRecordView title="Return" record={b.return_record} />}
        {b.extra_charges.length > 0 && <Section title="Extra charges">{b.extra_charges.map((c, i) => <Row key={i} label={c.label} value={formatRwf(c.amount)} />)}</Section>}
        {(b.ratings ?? []).length > 0 && <Section title="Ratings">{b.ratings!.map((r, i) => <Row key={i} label={`${r.from}${r.comment ? `: ${r.comment}` : ""}`} value={`${r.stars}★`} />)}</Section>}
      </ScrollView>
    </SafeAreaView>
  );
}
