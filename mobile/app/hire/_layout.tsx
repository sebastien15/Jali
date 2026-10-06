import { Stack } from "expo-router";
import ProtectedRoute from "@/core/session/ProtectedRoute";

export default function HireLayout() {
  return (
    <ProtectedRoute>
      <Stack screenOptions={{ headerShown: false }} />
    </ProtectedRoute>
  );
}
