import { useState } from "react";
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  TextInput,
} from "react-native";
import { C } from "@/constants/theme";

interface Props {
  value: string;
  onChange: (v: string) => void;
  cities: string[];
  placeholder: string;
}

export function CityPicker({ value, onChange, cities, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = cities.filter(c =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{ flex: 1, paddingVertical: 8 }}
      >
        <Text style={{
          color: value ? C.yellow : "rgba(255,255,255,0.55)",
          fontWeight: "800", fontSize: 15,
        }}>
          {value || placeholder}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>
          {value ? "tap to change" : "select city"}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingBottom: 40, maxHeight: "70%",
          }}>
            {/* Handle */}
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2 }} />
            </View>

            <Text style={{
              fontWeight: "900", fontSize: 18, color: C.dark,
              paddingHorizontal: 20, marginBottom: 12,
            }}>
              Select City
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
                placeholder="Search city..."
                placeholderTextColor={C.muted}
                style={{ flex: 1, fontSize: 15, color: C.dark }}
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { onChange(item); setOpen(false); setSearch(""); }}
                  style={{
                    paddingHorizontal: 20, paddingVertical: 16,
                    borderBottomWidth: 1, borderBottomColor: C.border,
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <Text style={{
                    fontSize: 16, color: C.dark,
                    fontWeight: item === value ? "800" : "600",
                  }}>
                    {item}
                  </Text>
                  {item === value && <Text style={{ color: C.blue, fontSize: 18 }}>✓</Text>}
                </TouchableOpacity>
              )}
            />

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
