/**
 * Session generation counter (architecture runbook §5, protocol 4).
 *
 * Every session start/end bumps the generation. lib/api.ts stamps each
 * request with the generation it was sent under and drops any response whose
 * generation is no longer current, so a late response for a previous account
 * can never repopulate the (already cleared) query cache. Bumping also aborts
 * the in-flight requests of the old generation.
 *
 * Dependency-free on purpose: lib/api.ts imports it, and the teardown
 * (core/session/teardown.ts) imports lib/api.ts.
 */

let generation = 0;
let controller = new AbortController();
const listeners = new Set<() => void>();

export function getSessionGeneration(): number {
  return generation;
}

/** Abort signal shared by every request of the current generation. */
export function getSessionSignal(): AbortSignal {
  return controller.signal;
}

/** Invalidate the current generation: abort its requests and ignore late responses. */
export function bumpSessionGeneration(): number {
  generation += 1;
  controller.abort();
  controller = new AbortController();
  return generation;
}

/** Tell session-scoped state (view state, push coordination) to re-hydrate. */
export function emitSessionChange(): void {
  listeners.forEach((l) => {
    try { l(); } catch {}
  });
}

export function onSessionChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
