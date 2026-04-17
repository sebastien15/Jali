import { useMemo, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";

// ── Action label map ─────────────────────────────────────────────────────────
const ACTION_LABELS: Record<string, string> = {
  booking_claimed:           "Claimed booking",
  ticket_uploaded:           "Uploaded ticket",
  booking_delivered:         "Delivered booking",
  booking_confirmed:         "Confirmed booking",
  profile_updated:           "Updated profile",
  profile_image_uploaded:    "Uploaded profile image",
  contract_uploaded:         "Uploaded contract",
  location_change_approved:  "Approved location change",
  location_change_rejected:  "Rejected location change",
  agency_created:            "Created agency",
  agency_updated:            "Updated agency",
  agency_deleted:            "Deleted agency",
  agency_route_added:        "Added route to agency",
  agency_route_removed:      "Removed route from agency",
  trip_created:              "Created trip",
  trip_updated:              "Updated trip",
  trip_deleted:              "Deleted trip",
};

// Maps action → display group label
const ACTION_TO_GROUP: Record<string, string> = {
  booking_claimed: "Booking", ticket_uploaded: "Booking",
  booking_delivered: "Booking", booking_confirmed: "Booking",
  profile_updated: "Profile", profile_image_uploaded: "Profile", contract_uploaded: "Profile",
  location_change_approved: "Location", location_change_rejected: "Location",
  agency_created: "Agency", agency_updated: "Agency", agency_deleted: "Agency",
  agency_route_added: "Agency", agency_route_removed: "Agency",
  trip_created: "Trip", trip_updated: "Trip", trip_deleted: "Trip",
};

const GROUP_COLOR: Record<string, string> = {
  Booking:  C.teal,
  Agency:   C.blue,
  Trip:     C.orange,
  Profile:  C.purple,
  Location: C.green,
};

// All possible filters
const ALL_ACTION_FILTERS = [
  { label: "All",       value: "" },
  { label: "Bookings",  value: "bookings" },
  { label: "Agencies",  value: "agencies" },
  { label: "Trips",     value: "trips" },
  { label: "Profile",   value: "profile" },
  { label: "Locations", value: "locations" },
];

const ACTION_GROUP_MAP: Record<string, string[]> = {
  bookings:  ["booking_claimed","ticket_uploaded","booking_delivered","booking_confirmed"],
  agencies:  ["agency_created","agency_updated","agency_deleted","agency_route_added","agency_route_removed"],
  trips:     ["trip_created","trip_updated","trip_deleted"],
  profile:   ["profile_updated","profile_image_uploaded","contract_uploaded"],
  locations: ["location_change_approved","location_change_rejected"],
};

const PLATFORM_FILTERS = [
  { label: "All",     value: "" },
  { label: "iOS",     value: "ios" },
  { label: "Android", value: "android" },
  { label: "Web",     value: "web" },
];

const PLATFORM_ICON: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  ios:     "logo-apple",
  android: "logo-android",
  web:     "globe-outline",
};

const PLATFORM_COLOR: Record<string, string> = {
  ios:     C.dark,
  android: "#3ddc84",
  web:     C.blue,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-RW", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

// ── Filter chips ─────────────────────────────────────────────────────────────
function FilterChips({
  options,
  selected,
  onSelect,
}: {
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={{ backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 9, gap: 6, alignItems: "center" }}
      >
        {options.map(opt => {
          const active = selected === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onSelect(opt.value)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: active ? C.teal : C.tealLt,
              }}
            >
              <Text style={{ color: active ? C.white : C.teal, fontWeight: "700", fontSize: 12 }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Table header ─────────────────────────────────────────────────────────────
function TableHeader({ columns }: { columns: { label: string; width?: number; flex?: number }[] }) {
  return (
    <View style={{
      flexDirection: "row",
      backgroundColor: C.tealLt,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    }}>
      {columns.map((col, i) => (
        <Text
          key={i}
          style={{
            width: col.width,
            flex: col.flex,
            color: C.teal,
            fontSize: 11,
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {col.label}
        </Text>
      ))}
    </View>
  );
}

// ── Empty / loader ────────────────────────────────────────────────────────────
function TableEmpty({ loading }: { loading: boolean }) {
  if (loading) return <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />;
  return (
    <Text style={{ color: C.muted, textAlign: "center", marginTop: 40, fontSize: 14 }}>
      No records found.
    </Text>
  );
}

// ── Activity logs tab ─────────────────────────────────────────────────────────
function ActivityTab() {
  const [actionGroup, setActionGroup] = useState("");

  // Fetch which action groups actually have log entries
  const { data: existingActions = [] } = useQuery<string[]>({
    queryKey: queryKeys.admin.logGroups(),
    queryFn: () => api.get("/admin/logs/groups").then(r => r.data),
    staleTime: 60_000,
  });

  // Only show filter chips for groups that have at least one log
  const visibleFilters = useMemo(() => {
    if (existingActions.length === 0) return ALL_ACTION_FILTERS;
    const actionSet = new Set(existingActions);
    return ALL_ACTION_FILTERS.filter(f => {
      if (f.value === "") return true;
      return (ACTION_GROUP_MAP[f.value] ?? []).some(a => actionSet.has(a));
    });
  }, [existingActions]);

  const actionParam = ACTION_GROUP_MAP[actionGroup]
    ? ACTION_GROUP_MAP[actionGroup].join(",")
    : undefined;

  const { data, isLoading, isRefetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: queryKeys.admin.logs(actionGroup || undefined),
      queryFn: ({ pageParam = 1 }) =>
        api.get("/admin/logs", {
          params: {
            page: pageParam,
            per_page: 50,
            ...(actionParam ? { action: actionParam } : {}),
          },
        }).then(r => r.data),
      getNextPageParam: (lastPage: any) =>
        lastPage.next_page_url ? lastPage.current_page + 1 : undefined,
      initialPageParam: 1,
      staleTime: 20_000,
    });

  const logs = data?.pages.flatMap((p: any) => p.data ?? []) ?? [];

  const COLS = [
    { label: "Time",   width: 88 },
    { label: "Action", flex: 1 },
    { label: "By",     width: 90 },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View>
        <FilterChips options={visibleFilters} selected={actionGroup} onSelect={setActionGroup} />
        <TableHeader columns={COLS} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {logs.length === 0 && <TableEmpty loading={isLoading} />}

        {logs.map((log: any, i: number) => {
          const { date, time } = formatTime(log.created_at);
          const even = i % 2 === 0;
          const groupLabel = ACTION_TO_GROUP[log.action];
          const groupColor = groupLabel ? (GROUP_COLOR[groupLabel] ?? C.muted) : C.muted;
          return (
            <View
              key={log.id}
              style={{
                flexDirection: "row",
                backgroundColor: even ? C.white : C.bg,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: C.border,
                alignItems: "center",
              }}
            >
              {/* Time */}
              <View style={{ width: 88 }}>
                <Text style={{ color: C.dark, fontSize: 12, fontWeight: "700" }}>{date}</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>{time}</Text>
              </View>

              {/* Action + category badge */}
              <View style={{ flex: 1, paddingRight: 8 }}>
                {groupLabel ? (
                  <Text style={{ color: groupColor, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 1 }}>
                    {groupLabel}
                  </Text>
                ) : null}
                <Text style={{ color: C.dark, fontSize: 13, fontWeight: "600" }}>
                  {ACTION_LABELS[log.action] ?? log.action}
                </Text>
                {log.details?.title ? (
                  <Text style={{ color: C.muted, fontSize: 11 }} numberOfLines={1}>
                    "{log.details.title}"
                  </Text>
                ) : null}
              </View>

              {/* By */}
              <View style={{ width: 90 }}>
                <Text style={{ color: C.mid, fontSize: 12 }} numberOfLines={1}>
                  {log.admin?.name ?? "Admin"}
                </Text>
              </View>
            </View>
          );
        })}

        {hasNextPage && !isFetchingNextPage && (
          <TouchableOpacity
            onPress={() => fetchNextPage()}
            style={{ marginHorizontal: 16, marginVertical: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: C.tealLt, alignItems: "center" }}
          >
            <Text style={{ color: C.teal, fontWeight: "700" }}>Load more</Text>
          </TouchableOpacity>
        )}
        {isFetchingNextPage && <ActivityIndicator color={C.teal} style={{ marginVertical: 16 }} />}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// ── App access tab ────────────────────────────────────────────────────────────
function AppAccessTab() {
  const [platform, setPlatform] = useState("");

  // Platform counters
  const { data: stats } = useQuery<{ all_time: Record<string, number>; last_30_days: Record<string, number> }>({
    queryKey: queryKeys.admin.appAccessStats(),
    queryFn: () => api.get("/admin/access-stats").then(r => r.data),
    staleTime: 60_000,
  });

  const { data, isLoading, isRefetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: queryKeys.admin.appAccesses(platform || undefined),
      queryFn: ({ pageParam = 1 }) =>
        api.get("/admin/app-accesses", {
          params: { page: pageParam, per_page: 50, ...(platform ? { platform } : {}) },
        }).then(r => r.data),
      getNextPageParam: (lastPage: any) =>
        lastPage.next_page_url ? lastPage.current_page + 1 : undefined,
      initialPageParam: 1,
      staleTime: 20_000,
    });

  const rows = data?.pages.flatMap((p: any) => p.data ?? []) ?? [];
  const total = Object.values(stats?.all_time ?? {}).reduce((s, n) => s + n, 0);

  const COUNTER_PLATFORMS = [
    { key: "ios",     icon: "logo-apple"   as const, label: "iOS",     color: C.dark },
    { key: "android", icon: "logo-android" as const, label: "Android", color: "#3ddc84" },
    { key: "web",     icon: "globe-outline" as const, label: "Web",    color: C.blue },
  ];

  const COLS = [
    { label: "Time",     width: 88 },
    { label: "Platform", width: 90 },
    { label: "User",     flex: 1 },
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* Platform counter cards */}
      {stats && (
        <View style={{ backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, gap: 8 }}>
            {/* Total */}
            <View style={{ flex: 1, backgroundColor: C.tealLt, borderRadius: 10, padding: 10, alignItems: "center" }}>
              <Text style={{ color: C.teal, fontSize: 20, fontWeight: "900" }}>{total.toLocaleString()}</Text>
              <Text style={{ color: C.teal, fontSize: 10, fontWeight: "700", marginTop: 2 }}>TOTAL</Text>
            </View>
            {COUNTER_PLATFORMS.map(p => (
              <View key={p.key} style={{ flex: 1, backgroundColor: C.bg, borderRadius: 10, padding: 10, alignItems: "center" }}>
                <Ionicons name={p.icon} size={14} color={p.color} />
                <Text style={{ color: C.dark, fontSize: 18, fontWeight: "800", marginTop: 3 }}>
                  {(stats.all_time[p.key] ?? 0).toLocaleString()}
                </Text>
                <Text style={{ color: C.muted, fontSize: 10, fontWeight: "700", marginTop: 1 }}>{p.label}</Text>
              </View>
            ))}
          </View>
          <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
            <Text style={{ color: C.muted, fontSize: 11 }}>
              Last 30 days — iOS: {stats.last_30_days.ios ?? 0} · Android: {stats.last_30_days.android ?? 0} · Web: {stats.last_30_days.web ?? 0}
            </Text>
          </View>
        </View>
      )}

      <View>
        <FilterChips options={PLATFORM_FILTERS} selected={platform} onSelect={setPlatform} />
        <TableHeader columns={COLS} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {rows.length === 0 && <TableEmpty loading={isLoading} />}

        {rows.map((row: any, i: number) => {
          const { date, time } = formatTime(row.accessed_at);
          const even = i % 2 === 0;
          const icon = PLATFORM_ICON[row.platform] ?? "phone-portrait-outline";
          const color = PLATFORM_COLOR[row.platform] ?? C.mid;
          return (
            <View
              key={row.id}
              style={{
                flexDirection: "row",
                backgroundColor: even ? C.white : C.bg,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: C.border,
                alignItems: "center",
              }}
            >
              <View style={{ width: 88 }}>
                <Text style={{ color: C.dark, fontSize: 12, fontWeight: "700" }}>{date}</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>{time}</Text>
              </View>

              <View style={{ width: 90, flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name={icon} size={14} color={color} />
                <Text style={{ color, fontSize: 13, fontWeight: "700", textTransform: "capitalize" }}>
                  {row.platform}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                {row.user_name ? (
                  <Text style={{ color: C.dark, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                    {row.user_name}
                  </Text>
                ) : null}
                <Text style={{ color: C.muted, fontSize: 11 }} numberOfLines={1}>
                  {row.user_email ?? "Guest"}
                </Text>
                {row.district ? (
                  <Text style={{ color: C.blue, fontSize: 10, fontWeight: "600", marginTop: 1 }}>
                    📍 {row.district}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}

        {hasNextPage && !isFetchingNextPage && (
          <TouchableOpacity
            onPress={() => fetchNextPage()}
            style={{ marginHorizontal: 16, marginVertical: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: C.tealLt, alignItems: "center" }}
          >
            <Text style={{ color: C.teal, fontWeight: "700" }}>Load more</Text>
          </TouchableOpacity>
        )}
        {isFetchingNextPage && <ActivityIndicator color={C.teal} style={{ marginVertical: 16 }} />}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AdminLogsScreen() {
  const [tab, setTab] = useState<"activity" | "access">("activity");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />
      <AdminHeader title="Logs" />

      <View style={{ flexDirection: "row", backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
        {(["activity", "access"] as const).map(t => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{ flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: active ? C.teal : "transparent" }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons
                  name={t === "activity" ? "list-outline" : "phone-portrait-outline"}
                  size={15}
                  color={active ? C.teal : C.muted}
                />
                <Text style={{ color: active ? C.teal : C.muted, fontWeight: "700", fontSize: 13 }}>
                  {t === "activity" ? "Activity" : "App Access"}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flex: 1 }}>
        {tab === "activity" ? <ActivityTab /> : <AppAccessTab />}
      </View>
    </SafeAreaView>
  );
}
