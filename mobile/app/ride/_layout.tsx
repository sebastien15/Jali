import { Stack } from "expo-router";
import ProtectedRoute from "@/lib/ProtectedRoute";

export default function RideLayout() {
  return (
    <ProtectedRoute>
      <Stack screenOptions={{ headerShown: false }} />
    </ProtectedRoute>
  );
}
