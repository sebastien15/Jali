/**
 * Shared admin booking workflow: pending → taken (claim) → ticket_ready
 * (upload ticket) → delivered. Used by the bookings list and detail screens.
 */
import { Platform } from "react-native";
import type { TFunction } from "i18next";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import type { QueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Refresh everything a booking change affects: the queues, the dashboard /
 * analytics counts and the admin profile (earnings, available balance).
 */
export function invalidateAfterBookingChange(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.allBookings() });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.analytics.all() });
  queryClient.invalidateQueries({ queryKey: queryKeys.adminProfile() });
}

// Backend messages that have a translation; anything else is shown verbatim.
const BACKEND_ERROR_KEYS: Record<string, string> = {
  "This action is unauthorized.":           "adminBookings.noPermission",
  "No station assigned to your account.":   "adminBookings.noStation",
  "You can only manage bookings for your assigned station.": "adminBookings.wrongStation",
  "You can only manage bookings for your assigned city.":    "adminBookings.wrongStation",
};

/** Translated message for a failed admin booking call (403/422 carry {message}). */
export function resolveBookingError(e: any, t: TFunction, fallbackKey = "adminBookings.updateFailed"): string {
  const data = e?.response?.data ?? {};
  const msg: string = data.message ?? data.error ?? "";
  const key = BACKEND_ERROR_KEYS[msg];
  if (key) return t(key);
  if (msg) return msg; // e.g. "Cannot change a pending booking to delivered."
  if (e?.response?.status === 403) return t("adminBookings.noPermission");
  return t(fallbackKey);
}

/** Success toast for a status transition. */
export function statusChangeMessage(status: string, t: TFunction): string {
  if (status === "taken") return t("adminBookings.claimedToast");
  if (status === "delivered") return t("adminBookings.deliveredToast");
  return t("adminBookings.updatedToast");
}

export function changeBookingStatus(id: number | string, status: "taken" | "delivered") {
  return api.patch(`/admin/bookings/${id}`, { status });
}

/**
 * Let the admin pick a ticket photo and upload it; the backend then marks the
 * booking ticket_ready. Resolves false when the picker was cancelled.
 */
export async function pickAndUploadTicket(id: number | string): Promise<boolean> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.9,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.[0]) return false;

  const asset = result.assets[0];
  const isImage = !asset.mimeType || asset.mimeType.startsWith("image/");
  let uri = asset.uri;
  let mimeType = asset.mimeType ?? "image/jpeg";

  if (isImage) {
    const compressed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
    );
    uri = compressed.uri;
    mimeType = "image/jpeg";
  }

  const form = new FormData();
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    form.append("ticket", blob, asset.fileName ?? "ticket.jpg");
  } else {
    form.append("ticket", { uri, name: asset.fileName ?? "ticket.jpg", type: mimeType } as any);
  }

  await api.post(`/admin/bookings/${id}/ticket`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return true;
}
