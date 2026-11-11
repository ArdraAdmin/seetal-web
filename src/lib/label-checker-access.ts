/** SHMP routes a label checker may open. */
export const LABEL_CHECKER_SHMP_PREFIXES = ["/shmp/rm"] as const;

export const LABEL_CHECKER_SHMP_HOME = "/shmp/rm";

export function canLabelCheckerAccessShmpPath(pathname: string) {
  return LABEL_CHECKER_SHMP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
