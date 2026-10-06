// Compatibility facade: push registration and notification routing moved to core/notifications
// (architecture runbook M04). New code imports from "@/core/notifications/usePushPermission".
export { usePushPermission, routeForNotification } from "@/core/notifications/usePushPermission";
