import { Stack } from "expo-router";
import ProtectedRoute from "@/lib/ProtectedRoute";

export default function DriverLayout() {
  return (
    <ProtectedRoute>
      <Stack screenOptions={{ headerShown: false }} />
    </ProtectedRoute>
  );
}
