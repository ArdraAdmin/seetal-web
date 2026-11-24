import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SALES_MAP_REFRESH_MS,
  createPinState,
  locationKey,
  nextCameraAction,
  withStablePins,
} from "./sales-map.ts";

const nikesh = { salesId: "nikesh", name: "Nikesh", lat: 25.2, lng: 55.27 };
const danish = { salesId: "danish", name: "Danish", lat: 19.07, lng: 72.87 };
const lav = { salesId: "lav", name: "Lav", lat: 25.1, lng: 55.2 };

describe("sales map pins", () => {
  it("numbers people in first-seen order", () => {
    const state = createPinState();
    const pinned = withStablePins([nikesh, danish], state);
    assert.deepEqual(
      pinned.map((loc) => [loc.salesId, loc.pin]),
      [
        ["nikesh", 1],
        ["danish", 2],
      ],
    );
  });

  it("keeps numbers when the list order changes", () => {
    const state = createPinState();
    withStablePins([nikesh, danish], state);
    const pinned = withStablePins([danish, nikesh], state);
    assert.equal(pinned.find((loc) => loc.salesId === "nikesh")?.pin, 1);
    assert.equal(pinned.find((loc) => loc.salesId === "danish")?.pin, 2);
    assert.equal(pinned[0]?.salesId, "nikesh");
  });

  it("does not renumber people who are still checked in", () => {
    const state = createPinState();
    withStablePins([nikesh, danish, lav], state);
    const pinned = withStablePins([nikesh, lav], state);
    assert.deepEqual(
      pinned.map((loc) => [loc.salesId, loc.pin]),
      [
        ["nikesh", 1],
        ["lav", 3],
      ],
    );
  });

  it("gives a returning person the same number", () => {
    const state = createPinState();
    withStablePins([nikesh, danish], state);
    withStablePins([nikesh], state);
    const pinned = withStablePins([nikesh, danish], state);
    assert.equal(pinned.find((loc) => loc.salesId === "danish")?.pin, 2);
  });

  it("keys a person by sales id before email", () => {
    assert.equal(
      locationKey({ salesId: "a", _id: "b", email: "c@x.com" }),
      "a",
    );
    assert.equal(locationKey({ email: "c@x.com", lat: 1, lng: 2 }), "c@x.com");
  });
});

describe("sales map camera", () => {
  it("fits once, then holds the zoom across refreshes", () => {
    assert.equal(
      nextCameraAction({ hasFitted: false, focusToken: 0, appliedFocusToken: 0 }),
      "fit",
    );
    assert.equal(
      nextCameraAction({ hasFitted: true, focusToken: 0, appliedFocusToken: 0 }),
      "hold",
    );
  });

  it("focuses a card click instead of fitting everyone back in", () => {
    assert.equal(
      nextCameraAction({ hasFitted: false, focusToken: 1, appliedFocusToken: 0 }),
      "focus",
    );
    assert.equal(
      nextCameraAction({ hasFitted: true, focusToken: 1, appliedFocusToken: 1 }),
      "hold",
    );
  });

  it("refreshes positions every 5 minutes", () => {
    assert.equal(SALES_MAP_REFRESH_MS, 5 * 60 * 1000);
  });
});
