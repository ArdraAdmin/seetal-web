type NavTarget = {
  href: string;
  match?: string[];
};

function matchesPath(entry: NavTarget, pathname: string, homeHref: string) {
  if (entry.href === homeHref) return pathname === homeHref;
  const prefixes = entry.match ?? [entry.href];
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function prefixLength(entry: NavTarget) {
  const prefixes = entry.match ?? [entry.href];
  return Math.max(...prefixes.map((prefix) => prefix.length));
}

/** Highlight the longest matching nav item so a nested page does not also highlight its parent. */
export function navItemActive(
  item: NavTarget,
  pathname: string,
  items: NavTarget[],
  homeHref: string,
) {
  if (!matchesPath(item, pathname, homeHref)) return false;
  const length = prefixLength(item);
  return !items.some((other) => {
    if (other.href === item.href) return false;
    if (!matchesPath(other, pathname, homeHref)) return false;
    return prefixLength(other) > length;
  });
}
