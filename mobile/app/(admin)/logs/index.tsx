import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
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

// ── Action filter groups ─────────────────────────────────────────────────────
const ACTION_FILTERS = [
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

// ── Sub-components ───────────────────────────────────────────────────────────
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}
      contentContainerStyle={{ flexGrow: 0 }}
    >
      <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
        {options.map(opt => {
          const active = selected === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onSelect(opt.value)}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                backgroundColor: active ? C.teal : C.tealLt,
                minWidth: 40, alignItems: "center",
              }}
            >
              <Text style={{ color: active ? C.white : C.teal, fontWeight: "700", fontSize: 12 }} numberOfLines={1}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Table header ─────────────────────────────────────────────────────────────
function TableHeader({ columns }: { columns: { label: string; width?: number; flex?: number }[] }) {
  return (
    <View style={{
      flexDirection: "row",
      backgroundColor: C.dark,
      paddingHorizontal: 12,
      paddingVertical: 9,
    }}>
      {columns.map((col, i) => (
        <Text
          key={i}
          style={{
            width: col.width,
            flex: col.flex,
            color: "rgba(255,255,255,0.6)",
            fontSize: 11,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
          numberOfLines={1}
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
    <>
      <FilterChips options={ACTION_FILTERS} selected={actionGroup} onSelect={setActionGroup} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <TableHeader columns={COLS} />
        {logs.length === 0 && <TableEmpty loading={isLoading} />}
        {logs.map((log: any, i: number) => {
          const { date, time } = formatTime(log.created_at);
          const even = i % 2 === 0;
          return (
            <View
              key={log.id}
              style={{
                flexDirection: "row",
                backgroundColor: even ? C.white : "#F8FAFC",
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

              {/* Action */}
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: C.dark, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
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
          <TouchableOpacity onPress={() => fetchNextPage()} style={{ paddingVertical: 16, alignItems: "center" }}>
            <Text style={{ color: C.teal, fontWeight: "700" }}>Load more…</Text>
          </TouchableOpacity>
        )}
        {isFetchingNextPage && <ActivityIndicator color={C.teal} style={{ marginVertical: 16 }} />}
        <View style={{ height: 24 }} />
      </ScrollView>
    </>
  );
}

// ── App access tab ────────────────────────────────────────────────────────────
function AppAccessTab() {
  const [platform, setPlatform] = useState("");

  const { data, isLoading, isRefetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: queryKeys.admin.appAccesses(platform || undefined),
      queryFn: ({ pageParam = 1 }) =>
        api.get("/admin/app-accesses", {
          params: {
            page: pageParam,
            per_page: 50,
            ...(platform ? { platform } : {}),
          },
        }).then(r => r.data),
      getNextPageParam: (lastPage: any) =>
        lastPage.next_page_url ? lastPage.current_page + 1 : undefined,
      initialPageParam: 1,
      staleTime: 20_000,
    });

  const rows = data?.pages.flatMap((p: any) => p.data ?? []) ?? [];
  const COLS = [
    { label: "Time",     width: 88 },
    { label: "Platform", width: 90 },
    { label: "User",     flex: 1 },
  ];

  return (
    <>
      <FilterChips options={PLATFORM_FILTERS} selected={platform} onSelect={setPlatform} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <TableHeader columns={COLS} />
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
                backgroundColor: even ? C.white : "#F8FAFC",
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

              {/* Platform */}
              <View style={{
                width: 90, flexDirection: "row", alignItems: "center", gap: 5,
              }}>
                <Ionicons name={icon} size={14} color={color} />
                <Text style={{ color, fontSize: 13, fontWeight: "700", textTransform: "capitalize" }}>
                  {row.platform}
                </Text>
              </View>

              {/* User */}
              <View style={{ flex: 1 }}>
                {row.user_name ? (
                  <Text style={{ color: C.dark, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                    {row.user_name}
                  </Text>
                ) : null}
                <Text style={{ color: C.muted, fontSize: 11 }} numberOfLines={1}>
                  {row.user_email ?? "Guest"}
                </Text>
              </View>
            </View>
          );
        })}

        {hasNextPage && !isFetchingNextPage && (
          <TouchableOpacity onPress={() => fetchNextPage()} style={{ paddingVertical: 16, alignItems: "center" }}>
            <Text style={{ color: C.teal, fontWeight: "700" }}>Load more…</Text>
          </TouchableOpacity>
        )}
        {isFetchingNextPage && <ActivityIndicator color={C.teal} style={{ marginVertical: 16 }} />}
        <View style={{ height: 24 }} />
      </ScrollView>
    </>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AdminLogsScreen() {
  const [tab, setTab] = useState<"activity" | "access">("activity");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.teal} />
      <AdminHeader title="Logs" />

      {/* Tab switcher */}
      <View style={{
        flexDirection: "row",
        backgroundColor: C.white,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
      }}>
        {(["activity", "access"] as const).map(t => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1, paddingVertical: 12, alignItems: "center",
                borderBottomWidth: 2,
                borderBottomColor: active ? C.teal : "transparent",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons
                  name={t === "activity" ? "list-outline" : "phone-portrait-outline"}
                  size={15}
                  color={active ? C.teal : C.muted}
                />
                <Text style={{
                  color: active ? C.teal : C.muted,
                  fontWeight: "700",
                  fontSize: 13,
                }}>
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
