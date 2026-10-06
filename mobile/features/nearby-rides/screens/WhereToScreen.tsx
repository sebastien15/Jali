import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, StatusBar, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import { Place, placeParam, recentPlaces, rememberPlace } from "@/lib/places";

type Field = "pickup" | "destination";

/** "Where to?" — story S3.1 */
export default function WhereToScreen() {
  const { t } = useTranslation();
  const [pickup, setPickup] = useState<Place | null>(null);
  const [locating, setLocating] = useState(true);
  const [noLocation, setNoLocation] = useState(false);
  const [field, setField] = useState<Field>("destination");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<Place[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const near = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    recentPlaces().then(setRecent);
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setNoLocation(true);
          setField("pickup");
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        near.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const place = await api.get<Place>("/places/reverse", { params: near.current }).then(r => r.data);
        setPickup({ ...place, name: place.name || t("ride.where.currentLocation") });
      } catch {
        setNoLocation(true);
        setField("pickup");
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  function onChangeQuery(text: string) {
    setQuery(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get<Place[]>("/places/search", { params: { q: text, ...(near.current ?? {}) } });
        setResults(res.data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  async function choose(place: Place) {
    Keyboard.dismiss();
    if (field === "pickup") {
      setPickup(place);
      near.current = { lat: place.lat, lng: place.lng };
      setField("destination");
      setQuery("");
      setResults([]);
      return;
    }
    if (!pickup) {
      setField("pickup");
      return;
    }
    await rememberPlace(place);
    router.push({ pathname: "/ride/nearby", params: { pickup: placeParam(pickup), destination: placeParam(place) } });
  }

  const list = query.trim().length >= 2 ? results : recent;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.white }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={C.dark} />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: "900", color: C.dark }}>{t("ride.where.title")}</Text>
      </View>

      <View style={{ marginHorizontal: 16, backgroundColor: C.bg, borderRadius: 16, padding: 12, gap: 10 }}>
        <TouchableOpacity onPress={() => { setField("pickup"); setQuery(""); setResults([]); }} accessibilityLabel={t("ride.where.changePickup")}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.green }} />
          {field === "pickup" ? (
            <TextInput autoFocus value={query} onChangeText={onChangeQuery} placeholder={t("ride.where.pickup")} placeholderTextColor={C.muted}
              accessibilityLabel={t("ride.where.pickup")} style={{ flex: 1, fontSize: 15, color: C.dark, paddingVertical: 4 }} />
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: C.muted, fontWeight: "700" }}>{t("ride.where.pickup")}</Text>
              <Text numberOfLines={1} style={{ fontSize: 15, color: C.dark, fontWeight: "600" }}>
                {locating ? t("ride.where.locating") : pickup?.name ?? t("ride.where.noLocation")}
              </Text>
            </View>
          )}
          {locating ? <ActivityIndicator size="small" color={C.teal} /> : null}
        </TouchableOpacity>
        <View style={{ height: 1, backgroundColor: C.border, marginLeft: 20 }} />
        <TouchableOpacity onPress={() => setField("destination")} style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessibilityLabel={t("ride.where.destination")}>
          <View style={{ width: 10, height: 10, backgroundColor: C.dark }} />
          {field === "destination" ? (
            <TextInput autoFocus={!noLocation} value={query} onChangeText={onChangeQuery} placeholder={t("ride.where.destination")}
              placeholderTextColor={C.muted} accessibilityLabel={t("ride.where.destination")}
              style={{ flex: 1, fontSize: 17, fontWeight: "700", color: C.dark, paddingVertical: 4 }} />
          ) : (
            <Text style={{ flex: 1, fontSize: 17, fontWeight: "700", color: C.muted }}>{t("ride.where.destination")}</Text>
          )}
        </TouchableOpacity>
      </View>

      {noLocation && field === "pickup" ? (
        <Text style={{ color: C.orange, marginHorizontal: 16, marginTop: 8 }}>{t("ride.where.noLocation")}</Text>
      ) : null}

      <FlatList
        data={list}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(p, i) => `${p.name}-${p.lat}-${i}`}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          query.trim().length < 2 && recent.length ? (
            <Text style={{ color: C.muted, fontWeight: "800", fontSize: 12, textTransform: "uppercase", marginBottom: 6 }}>{t("ride.where.recent")}</Text>
          ) : searching ? <ActivityIndicator color={C.teal} style={{ marginVertical: 12 }} /> : null
        }
        ListEmptyComponent={
          !searching ? (
            <Text style={{ color: C.muted, textAlign: "center", marginTop: 20 }}>
              {query.trim().length >= 2 ? t("ride.where.noResults") : t("ride.where.searchHint")}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => choose(item)} accessibilityLabel={item.name}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={query.trim().length < 2 ? "time-outline" : "location-outline"} size={18} color={C.mid} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontWeight: "700", color: C.dark, fontSize: 15 }}>{item.name}</Text>
              <Text numberOfLines={1} style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{item.address}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
