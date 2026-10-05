import { Stack } from "expo-router";

// Public on purpose: Terms, Privacy and FAQ must be readable before signing
// up (store requirement), so no ProtectedRoute here.
export default function LegalLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
