import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { ROLES } from "@/constants/roles";

/** Shape of GET /me (AuthController@me). */
export type Me = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  profile_image_url: string | null;
  /** Single role name, e.g. "user" | "driver" | "admin" | "superadmin". */
  roles: string;
  permissions: string[];
};

/**
 * Current user. Shares the `me` cache entry with the admin context; the
 * cache is wiped on every login/logout (core/session/teardown.ts), and a short stale
 * time lets role changes made by a superadmin (e.g. granting "driver") show up.
 */
export function useMe(enabled = true) {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.get("/me").then((r) => r.data as Me),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function isDriverRole(me: Pick<Me, "roles"> | null | undefined): boolean {
  return me?.roles === ROLES.DRIVER;
}
