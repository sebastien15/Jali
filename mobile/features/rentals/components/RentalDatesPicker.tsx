import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { C } from "@/constants/theme";
import { TIMES, addDays, formatDay, kigaliIso, nextDates, rentalDays } from "../rentals";
import { Chip, PrimaryButton } from "./ui";

export type RentalDates = { startDate: string; startTime: string; endDate: string; endTime: string };

export function defaultDates(): RentalDates {
  const tomorrow = nextDates(1, 1)[0];
  return { startDate: tomorrow, startTime: "09:00", endDate: addDays(tomorrow, 3), endTime: "09:00" };
}

export function datesToIso(d: RentalDates): { start_at: string; end_at: string } {
  return { start_at: kigaliIso(d.startDate, d.startTime), end_at: kigaliIso(d.endDate, d.endTime) };
}

/** Pickup and return date/time (Kigali), shown as a summary card that opens a picker */
export function RentalDatesPicker({ value, onChange }: { value: RentalDates; onChange: (v: RentalDates) => void }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const iso = datesToIso(value);
  const days = rentalDays(iso.start_at, iso.end_at);
  const s = formatDay(value.startDate, i18n.language);
  const e = formatDay(value.endDate, i18n.language);

  return (
    <>
      <TouchableOpacity onPress={() => { setDraft(value); setOpen(true); }} accessibilityLabel={t("rental.dates.change", "Change rental dates")}
        style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.border }}>
        <Ionicons name="calendar-outline" size={22} color={C.teal} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.mid, fontSize: 11, fontWeight: "700" }}>{t("rental.dates.pickup", "Pickup")} → {t("rental.dates.return", "Return")}</Text>
          <Text style={{ color: C.dark, fontWeight: "800", fontSize: 14 }}>
            {s.weekday} {s.day}, {value.startTime} → {e.weekday} {e.day}, {value.endTime}
          </Text>
        </View>
        <View style={{ backgroundColor: C.tealLt, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: C.teal, fontWeight: "900" }}>{t("rental.days", { count: days, defaultValue: days === 1 ? "1 day" : `${days} days` })}</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 32, maxHeight: "90%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ flex: 1, fontWeight: "900", fontSize: 18, color: C.dark }}>{t("rental.dates.title", "When do you need the car?")}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} accessibilityLabel={t("common.close", "Close")}>
                <Ionicons name="close" size={26} color={C.dark} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <DateTimeRow
                title={t("rental.dates.pickup", "Pickup")}
                dates={nextDates(60)}
                date={draft.startDate}
                time={draft.startTime}
                onDate={d => setDraft(x => ({ ...x, startDate: d, endDate: x.endDate <= d ? addDays(d, 1) : x.endDate }))}
                onTime={tm => setDraft(x => ({ ...x, startTime: tm }))}
              />
              <DateTimeRow
                title={t("rental.dates.return", "Return")}
                dates={Array.from({ length: 60 }, (_, i) => addDays(draft.startDate, i))}
                date={draft.endDate}
                time={draft.endTime}
                onDate={d => setDraft(x => ({ ...x, endDate: d }))}
                onTime={tm => setDraft(x => ({ ...x, endTime: tm }))}
              />
            </ScrollView>
            {(() => {
              const di = datesToIso(draft);
              const ok = new Date(di.end_at) > new Date(di.start_at);
              const n = rentalDays(di.start_at, di.end_at);
              return (
                <View style={{ marginTop: 12 }}>
                  {!ok && <Text style={{ color: C.orange, fontWeight: "700", marginBottom: 8 }}>{t("rental.dates.invalid", "Return must be after pickup.")}</Text>}
                  <PrimaryButton label={ok ? t("rental.dates.apply", { count: n, defaultValue: `Use these dates (${n} day${n > 1 ? "s" : ""})` }) : t("rental.dates.fix", "Fix the dates")}
                    disabled={!ok} onPress={() => { onChange(draft); setOpen(false); }} />
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>
    </>
  );
}

function DateTimeRow({ title, dates, date, time, onDate, onTime }: {
  title: string; dates: string[]; date: string; time: string; onDate: (d: string) => void; onTime: (t: string) => void;
}) {
  const { i18n } = useTranslation();
  const today = useMemo(() => nextDates(1)[0], []);
  return (
    <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 12, marginBottom: 10 }}>
      <Text style={{ fontWeight: "800", color: C.dark, marginBottom: 8 }}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {dates.map(d => {
          const f = formatDay(d, i18n.language);
          const on = d === date;
          return (
            <TouchableOpacity key={d} onPress={() => onDate(d)} accessibilityLabel={`${f.weekday} ${f.day}`}
              style={{ width: 62, paddingVertical: 8, borderRadius: 12, alignItems: "center", backgroundColor: on ? C.dark : C.bg }}>
              <Text style={{ color: on ? C.white : C.mid, fontSize: 11, fontWeight: "700" }}>{d === today ? "Today" : f.weekday}</Text>
              <Text style={{ color: on ? C.white : C.dark, fontWeight: "800", fontSize: 12 }}>{f.day}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10 }}>
        {TIMES.map(tm => <Chip key={tm} label={tm} on={tm === time} onPress={() => onTime(tm)} />)}
      </ScrollView>
    </View>
  );
}
