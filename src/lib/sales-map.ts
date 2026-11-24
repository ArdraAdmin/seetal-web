/** How often the sales map asks for fresh positions. */
export const SALES_MAP_REFRESH_MS = 5 * 60 * 1000;

/** Camera zoom used when a card opens one person. */
export const SALES_MAP_FOCUS_ZOOM = 15;

export type PinSource = {
  salesId?: string;
  _id?: string;
  email?: string;
  lat?: number;
  lng?: number;
};

export type PinState = {
  pins: Map<string, number>;
  nextPin: number;
};

export function createPinState(): PinState {
  return { pins: new Map(), nextPin: 1 };
}

export function locationKey(loc: PinSource): string {
  const id = loc.salesId || loc._id || loc.email;
  if (id) return String(id);
  return `${loc.lat ?? ""},${loc.lng ?? ""}`;
}

/**
 * Numbers stay with the same person for the session.
 * Someone dropping off the list does not renumber everyone else.
 */
export function withStablePins<T extends PinSource>(
  locations: T[],
  state: PinState,
): Array<T & { pin: number }> {
  const pinned = locations.map((loc) => {
    const key = locationKey(loc);
    let pin = state.pins.get(key);
    if (!pin) {
      pin = state.nextPin;
      state.nextPin += 1;
      state.pins.set(key, pin);
    }
    return { ...loc, pin };
  });
  pinned.sort((a, b) => a.pin - b.pin);
  return pinned;
}

/**
 * Fit everyone once. After that, hold the camera.
 * A card click focuses that person and must not be followed by a fit.
 */
export function nextCameraAction(state: {
  hasFitted: boolean;
  focusToken: number;
  appliedFocusToken: number;
}): "fit" | "focus" | "hold" {
  if (state.focusToken > 0 && state.focusToken !== state.appliedFocusToken) {
    return "focus";
  }
  if (!state.hasFitted) return "fit";
  return "hold";
}
