/** SHMP routes Supervisors may open (prefix match). All other /shmp paths are Admin-only. */
export const SUPERVISOR_SHMP_PREFIXES = [
  "/shmp/attendance",
  "/shmp/production",
  "/shmp/orders",
  "/shmp/delivery",
  "/shmp/settings",
  "/shmp/hr/worker",
  "/shmp/hr/user",
] as const;

export function canSupervisorAccessShmpPath(pathname: string) {
  return SUPERVISOR_SHMP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
