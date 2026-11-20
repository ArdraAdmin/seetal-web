import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterBiometricDevicesForPortal,
  isArdraBiometricDevice,
  isSeetalBiometricDevice,
  isShmpBiometricDevice,
} from "./biometric-devices.ts";

describe("biometric device portal matching", () => {
  it("matches seetal / shmp / Ardra-Test-Device by name", () => {
    assert.equal(isSeetalBiometricDevice({ name: "seetal" }), true);
    assert.equal(isSeetalBiometricDevice({ name: "Seetal Gate" }), true);
    assert.equal(isSeetalBiometricDevice({ name: "shmp" }), false);

    assert.equal(isShmpBiometricDevice({ name: "shmp" }), true);
    assert.equal(isShmpBiometricDevice({ name: "SHMP Main" }), true);
    assert.equal(isShmpBiometricDevice({ name: "seetal" }), false);

    assert.equal(isArdraBiometricDevice({ name: "Ardra-Test-Device" }), true);
    assert.equal(isArdraBiometricDevice({ name: "ardra-test-device" }), true);
    assert.equal(isArdraBiometricDevice({ name: "Ardra" }), false);
  });

  it("filters portal lists", () => {
    const devices = [
      { name: "seetal", devId: "1" },
      { name: "shmp", devId: "2" },
      { name: "Ardra-Test-Device", devId: "3" },
      { name: "other", devId: "4" },
    ];
    assert.deepEqual(
      filterBiometricDevicesForPortal(devices, "stl").map((row) => row.devId),
      ["1"],
    );
    assert.deepEqual(
      filterBiometricDevicesForPortal(devices, "shmp").map((row) => row.devId),
      ["2", "3"],
    );
  });
});
