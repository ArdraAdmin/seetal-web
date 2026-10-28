import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  UNLOCK_CLICKS,
  getTrackingUnlockClicks,
  isSettingsNavHref,
  isTrackingUnlocked,
  registerTrackingSettingsClick,
  resetTrackingUnlock,
} from "./tracking-unlock.ts";

describe("tracking unlock", () => {
  beforeEach(() => {
    resetTrackingUnlock();
  });

  it("treats the sidebar Settings href as the unlock control", () => {
    assert.equal(isSettingsNavHref("/admin/settings"), true);
    assert.equal(isSettingsNavHref("/admin/settings/password"), true);
    assert.equal(isSettingsNavHref("/admin"), false);
    assert.equal(isSettingsNavHref("/admin/tracking"), false);
  });

  it("stays locked until Settings is clicked 5 times", () => {
    for (let i = 1; i < UNLOCK_CLICKS; i += 1) {
      assert.equal(registerTrackingSettingsClick(), false);
      assert.equal(isTrackingUnlocked(), false);
      assert.equal(getTrackingUnlockClicks(), i);
    }
    assert.equal(registerTrackingSettingsClick(), true);
    assert.equal(isTrackingUnlocked(), true);
    assert.equal(getTrackingUnlockClicks(), UNLOCK_CLICKS);
  });

  it("does not keep incrementing after unlock", () => {
    for (let i = 0; i < UNLOCK_CLICKS; i += 1) {
      registerTrackingSettingsClick();
    }
    assert.equal(registerTrackingSettingsClick(), true);
    assert.equal(getTrackingUnlockClicks(), UNLOCK_CLICKS);
  });
});
