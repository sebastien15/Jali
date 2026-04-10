export const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  DRIVER: "driver",
  USER: "user",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export function isAdminRole(role: string): boolean {
  return role === ROLES.ADMIN || role === ROLES.SUPERADMIN;
}
