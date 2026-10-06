import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatRwf } from "@/lib/fare";
import type { operations, components } from "@/lib/apiSchema";

type Analytics = operations["getRideAnalytics"]["responses"]["200"]["content"]["application/json"];
type TopDriver = components["schemas"]["TopDriver"];
type Period = "day" | "week";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Ride metrics on the analytics screen (story S10.3) — last 30 days by day, or 12 weeks by week */
export default function RideAnalyticsSection() {
  const [period, setPeriod] = useState<Period>("day");
  const query = useQuery({
    queryKey: queryKeys.admin.analytics.rides(period),
    queryFn: () => {
      const params: Record<string, string> = { period };
      if (period === "week") {
        const from = new Date(Date.now() - 83 * 86_400_000);
        params.from = from.toISOString().slice(0, 10);
      }
      return api.get<Analytics>("/analytics/rides", { params }).then(r => r.data);
    },
    staleTime: 5 * 60_000,
  });
  const data = query.data;
  const totals = data?.totals;

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Rides
        </Text>
        <View style={{ flexDirection: "row", backgroundColor: C.white, borderRadius: 10, padding: 2 }}>
          {(["day", "week"] as const).map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: period === p ? C.teal : "transparent" }}
            >
              <Text style={{ color: period === p ? C.white : C.muted, fontSize: 12, fontWeight: "700" }}>
                {p === "day" ? "Daily" : "Weekly"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {query.isLoading || !data || !totals ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 16 }} />
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <Metric label="Requested" value={String(totals.requested)} color={C.blue} />
            <Metric label="Completed" value={String(totals.completed)} color={C.green} />
            <Metric label="Pickup ETA" value={totals.avg_pickup_minutes == null ? "—" : `${totals.avg_pickup_minutes} min`} color={C.teal} />
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <Metric label="Rider cancel" value={pct(totals.rider_cancel_rate)} color={C.orange} />
            <Metric label="Driver cancel" value={pct(totals.driver_cancel_rate)} color={C.orange} />
            <Metric label="Expired" value={pct(totals.expired_rate)} color={C.purple} />
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <Metric label="GMV" value={formatRwf(totals.gmv)} color={C.teal} />
            <Metric label="Commission" value={formatRwf(totals.commission)} color={C.green} />
          </View>

          <Card title={`Completed rides per ${period === "day" ? "day" : "week"}`}>
            <Bars values={data.series.map(s => s.completed)} labels={data.series.map(s => s.bucket.slice(5))} />
          </Card>

          <Card title="Average fare per km">
            {Object.keys(data.fare_per_km_by_class).length === 0 ? (
              <Text style={{ color: C.muted, fontSize: 12 }}>No completed rides yet.</Text>
            ) : (
              Object.entries(data.fare_per_km_by_class).map(([cls, rate]) => (
                <Row key={cls} left={cls.replace(/_/g, " ")} right={`${formatRwf(rate)} / km`} />
              ))
            )}
          </Card>

          <Card title="Top drivers by trips">
            <Drivers list={data.top_drivers.by_trips} />
          </Card>
          <Card title="Top drivers by rating (3+ trips)">
            <Drivers list={data.top_drivers.by_rating} />
          </Card>
        </>
      )}
    </View>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 12 }}>
      <Text style={{ color, fontWeight: "900", fontSize: 16 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10 }}>
      <Text style={{ color: C.dark, fontWeight: "800", fontSize: 13, marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ color: C.dark, fontSize: 13, textTransform: "capitalize", flex: 1 }} numberOfLines={1}>{left}</Text>
      <Text style={{ color: C.muted, fontSize: 13, fontWeight: "600" }}>{right}</Text>
    </View>
  );
}

function Drivers({ list }: { list: TopDriver[] }) {
  if (list.length === 0) return <Text style={{ color: C.muted, fontSize: 12 }}>No drivers yet.</Text>;
  return (
    <>
      {list.map((d, i) => (
        <Row
          key={d.id}
          left={`${i + 1}. ${d.name ?? `Driver #${d.id}`}`}
          right={`${d.trips} trips · ${d.rating == null ? "no rating" : `${d.rating.toFixed(1)}★`}`}
        />
      ))}
    </>
  );
}

/** Simple vertical bars; first and last labels only so they never overlap */
function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values);
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 80, gap: 2 }}>
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, height: Math.max(2, (v / max) * 80), backgroundColor: v ? C.teal : C.bg, borderRadius: 2 }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ color: C.muted, fontSize: 10 }}>{labels[0]}</Text>
        <Text style={{ color: C.muted, fontSize: 10 }}>peak {Math.max(0, ...values)}</Text>
        <Text style={{ color: C.muted, fontSize: 10 }}>{labels[labels.length - 1]}</Text>
      </View>
    </View>
  );
}
