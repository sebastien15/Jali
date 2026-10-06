import i18n from "i18next";
import type { components } from "@/lib/apiSchema";

export type HelpTopic = components["schemas"]["HelpTopic"];
export type AdminHelpTopic = components["schemas"]["AdminHelpTopic"];
export type HelpContext = components["schemas"]["HelpContext"];
export type ServiceKey = components["schemas"]["ServiceKey"];
export type Locale = components["schemas"]["Locale"];

export const LOCALES: Locale[] = ["en", "fr", "rw", "sw"];
export const LOCALE_LABEL: Record<Locale, string> = { en: "English", fr: "Français", rw: "Kinyarwanda", sw: "Kiswahili" };

/** App language as a help-centre locale (falls back to English) */
export function helpLocale(): Locale {
  const l = (i18n.language ?? "en").slice(0, 2) as Locale;
  return LOCALES.includes(l) ? l : "en";
}

export const SUPPORT_WHATSAPP = "https://wa.me/250788451691?text=Hi%20Jali%20Support%2C%20I%20need%20help%20with%20my%20booking.";

// ── Support tickets (S16.3) ──────────────────────────────────────────────
export type SupportTicket = import("@/lib/apiSchema").components["schemas"]["SupportTicket"];
export type SupportTicketDetail = import("@/lib/apiSchema").components["schemas"]["SupportTicketDetail"];
export type TicketStatus = SupportTicket["status"];
export type SubjectType = "ride" | "hire" | "rental";

export const CATEGORIES: HelpContext[] = ["charged_wrong", "driver_behaviour", "lost_item", "safety", "cancel", "damage", "payment", "account", "other"];

export function categoryLabel(c: HelpContext): string {
  return i18n.t(`support.cat.${c}`, {
    defaultValue: {
      charged_wrong: "Charged the wrong amount", driver_behaviour: "Driver behaviour", lost_item: "Lost item",
      safety: "Safety", cancel: "Cancelling", damage: "Damage", payment: "Payment", account: "My account", other: "Something else",
    }[c],
  });
}

export const STATUS_META: Record<TicketStatus, { label: string; color: "orange" | "green" | "muted" }> = {
  open: { label: "Waiting for Jali", color: "orange" },
  answered: { label: "Jali replied", color: "green" },
  resolved: { label: "Resolved", color: "muted" },
};

export { BackHeader, StatusPill } from "./components/ui";
