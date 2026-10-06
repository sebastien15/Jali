import { useEffect, useState } from "react";
import { getApiToken } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { getSessionGeneration, onSessionChange } from "@/core/session/generation";
import { usePushPermission } from "@/core/notifications/usePushPermission";
import { resumePendingIntent } from "@/core/notifications/notificationIntent";

function PushRegistrar() {
  usePushPermission();
  // A notification tapped while signed out opens now (S23.5)
  useEffect(() => { resumePendingIntent().catch(() => {}); }, []);
  return null;
}

/**
 * Root-scoped push coordination (runbook §5, protocol 2). Mounted in
 * app/_layout.tsx so notification taps are handled on standalone routes
 * (driver/setup, driver/ride/[id], hire/…, ride/…) and not only while the
 * (tabs) layout is mounted. Registers once per signed-in session.
 * The registrar is keyed by session generation so its listener is removed
 * on teardown and re-created for the next account. Admin accounts register
 * too (S23.5): support staff get urgent ticket pushes (S16.3).
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
  if (!hasToken || !me) return null;
  return <PushRegistrar key={gen} />;
}
