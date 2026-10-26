export type AppEnvironment = "stl" | "shmp";

const ENV_KEY = "stl_selected_environment";

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function onEnvironmentChange(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function loadEnvironment(): AppEnvironment | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = String(localStorage.getItem(ENV_KEY) || "")
      .trim()
      .toLowerCase();
    if (raw === "stl" || raw === "shmp") return raw;
    return null;
  } catch {
    return null;
  }
}

export function saveEnvironment(env: AppEnvironment) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ENV_KEY, env);
  notify();
}

export function clearEnvironment() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ENV_KEY);
  notify();
}

export function normalizeEnvironments(
  envs: unknown,
  role?: string,
  isSuperAdmin?: boolean,
): AppEnvironment[] {
  if (Array.isArray(envs) && envs.length > 0) {
    return envs
      .map((e) => String(e).toLowerCase())
      .filter((e): e is AppEnvironment => e === "stl" || e === "shmp");
  }
  if (role === "Supervisor") return ["shmp"];
  if (role === "Admin" && isSuperAdmin) return ["stl", "shmp"];
  return ["stl"];
}

export function homePathForEnvironment(env: AppEnvironment, role?: string) {
  if (role === "Sales") return "/sales";
  if (env === "shmp") {
    return role === "Supervisor" ? "/shmp/hr" : "/shmp";
  }
  if (role === "Warehouse") return "/warehouse";
  return "/admin";
}
