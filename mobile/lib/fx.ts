import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatRwf } from "@/lib/fare";

/** Approximate prices in a visitor's home currency (story S9.4). RWF stays the charged amount. */
export const FX_CURRENCIES = ["USD", "EUR", "GBP", "KES"] as const;
export type FxCurrency = (typeof FX_CURRENCIES)[number] | "none";

const KEY = "jali_fx_currency";
const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", KES: "KSh " };
type Rates = { base: "RWF"; rates: Partial<Record<string, number>> | null; fetched_at: string | null; stale: boolean };

/** Device default: the device currency when supported, otherwise none (Rwandan users see RWF only) */
function deviceDefault(): FxCurrency {
  const code = Localization.getLocales()[0]?.currencyCode?.toUpperCase();
  return (FX_CURRENCIES as readonly string[]).includes(code ?? "") ? (code as FxCurrency) : "none";
}

let listeners: ((c: FxCurrency) => void)[] = [];

export async function setFxCurrency(c: FxCurrency) {
  await AsyncStorage.setItem(KEY, c).catch(() => {});
  listeners.forEach(l => l(c));
}

export function useFxCurrency(): FxCurrency {
  const [currency, setCurrency] = useState<FxCurrency>("none");
  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => setCurrency((v as FxCurrency) ?? deviceDefault())).catch(() => setCurrency(deviceDefault()));
    listeners.push(setCurrency);
    return () => { listeners = listeners.filter(l => l !== setCurrency); };
  }, []);
  return currency;
}

/** "3,400 RWF (~$2.40)" — or just "3,400 RWF" when off, unknown or stale */
export function useFormatPrice(): (rwf: number) => string {
  const currency = useFxCurrency();
  const { data } = useQuery({
    queryKey: ["fx", "rates"],
    queryFn: () => api.get<Rates>("/fx/rates").then(r => r.data),
    enabled: currency !== "none",
    staleTime: 6 * 60 * 60_000,
  });
  return (rwf: number) => {
    const rate = currency !== "none" && data && !data.stale ? data.rates?.[currency] : undefined;
    if (!rate) return formatRwf(rwf);
    const value = rwf * rate;
    return `${formatRwf(rwf)} (~${SYMBOL[currency] ?? ""}${value >= 100 ? Math.round(value) : value.toFixed(2)})`;
  };
}
