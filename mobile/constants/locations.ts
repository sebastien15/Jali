export const LOCATION_TYPE = {
  BUS_STATION: "bus_station",
  CUSTOM: "custom",
} as const;

export type LocationType = (typeof LOCATION_TYPE)[keyof typeof LOCATION_TYPE];

export function locationTypeLabel(type: LocationType): string {
  return type === LOCATION_TYPE.BUS_STATION ? "Bus Station" : "Custom";
}
