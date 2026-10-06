import type { ComponentType } from "react";
import { RideNowBar } from "@/features/nearby-rides";
import { HireDriverBar } from "@/features/driver-hire";
import type { ServiceId } from "./serviceAccess";

/**
 * Feature registry for Home (S23.2). Each entry names the catalogue service it
 * belongs to; Home renders an entry (and runs its queries) only when that
 * service is available. Adding a feature = one entry here, no change elsewhere.
 */
export type HomeMode = "bus" | "private" | "rental";

/** Search tabs under the header, in display order */
export const HOME_TABS: { mode: HomeMode; service: ServiceId; icon: string; labelKey: string }[] = [
  { mode: "bus", service: "bus", icon: "🚌", labelKey: "home.modeBus" },
  { mode: "private", service: "shared", icon: "💺", labelKey: "home.modePrivate" },
  { mode: "rental", service: "rental", icon: "🚗", labelKey: "home.modeRental" },
];

/** Quick-start bars above the tabs */
export const HOME_BARS: { service: ServiceId; Component: ComponentType }[] = [
  { service: "rides", Component: RideNowBar },
  { service: "hire", Component: HireDriverBar },
];
