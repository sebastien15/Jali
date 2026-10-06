import { useEffect, useState } from "react";
import { getApiToken } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { isAdminRole } from "@/constants/roles";
import { getSessionGeneration, onSessionChange } from "@/core/session/generation";
import { usePushPermission } from "@/core/notifications/usePushPermission";

function PushRegistrar() {
  usePushPermission();
  return null;
}

/**
 * Root-scoped push coordination (runbook §5, protocol 2). Mounted in
 * app/_layout.tsx so notification taps are handled on standalone routes
 * (driver/setup, driver/ride/[id], hire/…, ride/…) and not only while the
 * (tabs) layout is mounted. Registers once per signed-in session; admin
 * accounts are excluded, as before (they never mounted the tabs layout).
 * The registrar is keyed by session generation so its listener is removed
 * on teardown and re-created for the next account.
 */
export default function PushCoordinator() {
  const [gen, setGen] = useState(getSessionGeneration());
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => onSessionChange(() => setGen(getSessionGeneration())), []);

  useEffect(() => {
    let active = true;
    setHasToken(false);
    getApiToken().then(token => { if (active) setHasToken(!!token); });
    return () => { active = false; };
  }, [gen]);

  const { data: me } = useMe(hasToken);
  if (!hasToken || !me || isAdminRole(me.roles)) return null;
  return <PushRegistrar key={gen} />;
}
