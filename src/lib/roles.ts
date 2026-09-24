export function homePathForRole(role?: string) {
  if (role === "Sales") return "/sales";
  if (role === "Warehouse") return "/warehouse";
  return "/admin";
}

export function areaPrefix(path: string) {
  return `/${path.split("/").filter(Boolean)[0] || ""}`;
}
