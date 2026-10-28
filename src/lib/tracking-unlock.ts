/**
 * In-memory unlock for the admin Tracking nav item.
 * Resets on full page reload (not persisted).
 */
export const UNLOCK_CLICKS = 5;
export const SETTINGS_HREF = "/admin/settings";

let settingsClicks = 0;
let unlocked = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function isSettingsNavHref(href: string) {
  return href === SETTINGS_HREF || href.startsWith(`${SETTINGS_HREF}/`);
}

export function isTrackingUnlocked() {
  return unlocked;
}

export function getTrackingUnlockClicks() {
  return settingsClicks;
}

/** Call when the Settings nav item is clicked (lav@ account only). */
export function registerTrackingSettingsClick() {
  if (unlocked) return true;
  settingsClicks += 1;
  if (settingsClicks >= UNLOCK_CLICKS) {
    unlocked = true;
  }
  notify();
  return unlocked;
}

export function resetTrackingUnlock() {
  settingsClicks = 0;
  unlocked = false;
  notify();
}

export function onTrackingUnlockChange(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
