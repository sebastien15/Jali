import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, Modal, TextInput, FlatList, ActivityIndicator,
} from "react-native";
import { C } from "@/constants/theme";
import api from "@/lib/api";

interface Location {
  id: number;
  name: string;
  city: string;
  type: "bus_station" | "custom";
  address: string | null;
}

interface Props {
  value: Location | null;
  onChange: (loc: Location) => void;
  filterCity?: string;
  filterType?: "bus_station" | "custom";
  placeholder?: string;
}

export function LocationPicker({ value, onChange, filterCity, filterType, placeholder = "Select location" }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && locations.length === 0) {
      fetchLocations();
    }
  }, [open]);

  async function fetchLocations() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterCity) params.city = filterCity;
      if (filterType) params.type = filterType;
      const res = await api.get("/admin/locations", { params });
      setLocations(res.data);
    } catch {
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = locations.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} style={{ flex: 1, paddingVertical: 8 }}>
        <Text style={{
          color: value ? C.yellow : "rgba(255,255,255,0.55)",
          fontWeight: "800", fontSize: 15,
        }}>
          {value ? value.name : placeholder}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>
          {value ? "tap to change" : "select location"}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingBottom: 40, maxHeight: "70%",
          }}>
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2 }} />
            </View>

            <Text style={{ fontWeight: "900", fontSize: 18, color: C.dark, paddingHorizontal: 20, marginBottom: 12 }}>
              Select Location
            </Text>

            <View style={{
              marginHorizontal: 20, marginBottom: 12,
              backgroundColor: C.bg, borderRadius: 12,
              flexDirection: "row", alignItems: "center",
              paddingHorizontal: 12, paddingVertical: 10,
            }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search location..."
                placeholderTextColor={C.muted}
                style={{ flex: 1, fontSize: 15, color: C.dark }}
              />
            </View>

            {loading ? (
              <ActivityIndicator color={C.blue} style={{ padding: 20 }} />
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={item => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => { onChange(item); setOpen(false); setSearch(""); }}
                    style={{
                      paddingHorizontal: 20, paddingVertical: 14,
                      borderBottomWidth: 1, borderBottomColor: C.border,
                      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 15, color: C.dark, fontWeight: item.id === value?.id ? "800" : "600" }}>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: C.muted }}>{item.city}{item.address ? ` · ${item.address}` : ""}</Text>
                    </View>
                    {item.id === value?.id && <Text style={{ color: C.blue, fontSize: 18 }}>✓</Text>}
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              onPress={() => { setOpen(false); setSearch(""); }}
              style={{
                marginHorizontal: 20, marginTop: 12,
                backgroundColor: C.bg, borderRadius: 12,
                paddingVertical: 14, alignItems: "center",
              }}
            >
              <Text style={{ color: C.mid, fontWeight: "700", fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
