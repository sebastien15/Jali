import { Linking, Platform } from "react-native";

/** Opens Google Maps (or Apple Maps on iOS without Google Maps) with driving directions. */
export async function openNavigation(lat: number, lng: number): Promise<void> {
  const google = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  const waze = `waze://?ll=${lat},${lng}&navigate=yes`;
  if (await Linking.canOpenURL(waze).catch(() => false)) return Linking.openURL(waze);
  if (Platform.OS === "ios" && !(await Linking.canOpenURL("comgooglemaps://").catch(() => false))) {
    return Linking.openURL(`http://maps.apple.com/?daddr=${lat},${lng}`);
  }
  return Linking.openURL(google);
}

export function callPhone(phone: string | null | undefined): void {
  if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
}
