// Compatibility facade: session start/teardown lives in core/session/teardown.ts (runbook M05).
export { startSession, endSession } from "@/core/session/teardown";
export type { EndSessionReason } from "@/core/session/teardown";
