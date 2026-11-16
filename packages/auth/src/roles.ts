export const PLATFORM_ADMIN_ROLE = "platform_admin";
export const DEFAULT_USER_ROLE = "user";

export type GlobalRole = typeof PLATFORM_ADMIN_ROLE | typeof DEFAULT_USER_ROLE;

export function isPlatformAdmin(role: string | null | undefined): boolean {
  return role === PLATFORM_ADMIN_ROLE;
}
