import { useState, useEffect, useMemo } from "react";
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  TextInput, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";
import api from "@/lib/api";

type Station = {
  id: number;
  name: string;
  city: string;
  province: string | null;
  district: string | null;
  type: "bus_station" | "custom";
  address: string | null;
};

export type StationObj = { id: number; name: string; city: string };

interface Props {
  value: StationObj | null;
  onChange: (v: StationObj) => void;
  placeholder: string;
  exclude?: StationObj | null;
}

export function StationPicker({ value, onChange, placeholder, exclude }: Props) {
  const [open, setOpen]           = useState(false);
  const [search, setSearch]       = useState("");
  const [stations, setStations]   = useState<Station[]>([]);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    if (!open || stations.length > 0) return;
    setLoading(true);
    api.get("/stations")
      .then(r => setStations(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const excludeId = exclude?.id ?? null;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return stations.filter(s => {
      if (excludeId && s.id === excludeId) return false;
      if (!q) return true;
      return (
        (s.name ?? "").toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        (s.district ?? "").toLowerCase().includes(q) ||
        (s.address ?? "").toLowerCase().includes(q)
      );
    });
  }, [stations, search, excludeId]);

  function select(s: Station) {
    onChange({ id: s.id, name: s.name, city: s.city });
    setOpen(false);
    setSearch("");
  }

  const displayValue = value?.name ?? "";

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} style={{ flex: 1, paddingVertical: 8 }}>
        <Text style={{ color: displayValue ? C.yellow : "rgba(255,255,255,0.55)", fontWeight: "800", fontSize: 15 }}>
          {displayValue || placeholder}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>
          {displayValue ? "tap to change" : "select terminal"}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: C.white,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingBottom: 36,
            maxHeight: "88%",
          }}>
            {/* Handle */}
            <View style={{ alignItems: "center", paddingTop: 14, paddingBottom: 4 }}>
              <View style={{ width: 44, height: 4, backgroundColor: C.border, borderRadius: 2 }} />
            </View>

            {/* Header */}
            <View style={{
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              paddingHorizontal: 20, paddingVertical: 12,
            }}>
              <Text style={{ fontWeight: "900", fontSize: 19, color: C.dark }}>
                Select Terminal
              </Text>
              <TouchableOpacity
                onPress={() => { setOpen(false); setSearch(""); }}
                style={{
                  backgroundColor: C.bg, borderRadius: 20,
                  width: 34, height: 34, alignItems: "center", justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={18} color={C.mid} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={{
              marginHorizontal: 20, marginBottom: 8,
              backgroundColor: C.bg, borderRadius: 14,
              flexDirection: "row", alignItems: "center",
              paddingHorizontal: 14, paddingVertical: 12,
              borderWidth: 1.5, borderColor: C.border,
            }}>
              <Ionicons name="search-outline" size={18} color={C.muted} style={{ marginRight: 10 }} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by terminal name, city or district…"
                placeholderTextColor={C.muted}
                style={{ flex: 1, fontSize: 15, color: C.dark }}
                autoFocus={false}
                clearButtonMode="while-editing"
              />
            </View>

            {loading ? (
              <ActivityIndicator color={C.blue} style={{ marginVertical: 40 }} />
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={item => String(item.id)}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={{ alignItems: "center", paddingVertical: 40 }}>
                    <Ionicons name="location-outline" size={36} color={C.border} />
                    <Text style={{ color: C.muted, marginTop: 10, fontSize: 14 }}>
                      {stations.length === 0 ? "No terminals available" : "No results"}
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const selected = item.id === value?.id;
                  const subtitle = [item.city, item.district].filter(Boolean).join(" · ");
                  return (
                    <TouchableOpacity
                      onPress={() => select(item)}
                      style={{
                        paddingHorizontal: 20, paddingVertical: 14,
                        borderBottomWidth: 1, borderBottomColor: C.border,
                        flexDirection: "row", alignItems: "center", gap: 14,
                        backgroundColor: selected ? C.blueLt : C.white,
                      }}
                    >
                      <View style={{
                        width: 38, height: 38, borderRadius: 10,
                        backgroundColor: item.type === "bus_station" ? C.blueLt : C.tealLt,
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <Ionicons
                          name={item.type === "bus_station" ? "bus-outline" : "location-outline"}
                          size={18}
                          color={item.type === "bus_station" ? C.blue : C.teal}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          fontSize: 15, color: C.dark,
                          fontWeight: selected ? "800" : "600",
                        }}>
                          {item.name}
                        </Text>
                        {subtitle ? (
                          <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                            {subtitle}
                          </Text>
                        ) : null}
                      </View>
                      {selected && <Ionicons name="checkmark-circle" size={20} color={C.blue} />}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
