import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  driverVehicleFormError,
  isVehicleUnassigned,
  resolveCreatedDriverId,
  vehicleLinkedToDriver,
  vehicleNumberLabel,
  vehiclesForDriverSelect,
} from "./driver-vehicles.ts";
import type { Driver, Vehicle } from "./types.ts";

function vehicle(
  id: string,
  value: number | string,
  driverId?: string | null,
): Vehicle {
  return { _id: id, value, driverId };
}

const drivers: Driver[] = [
  { _id: "d1", name: "Ada", phoneNo: "111" },
  { _id: "d2", name: "Ada", phoneNo: "111" },
];

describe("driver vehicle helpers", () => {
  it("labels vehicle numbers", () => {
    assert.equal(vehicleNumberLabel({ value: 42 }), "#42");
    assert.equal(vehicleNumberLabel({ value: "" }), "Vehicle");
  });

  it("detects unassigned vehicles", () => {
    assert.equal(isVehicleUnassigned({ driverId: null }), true);
    assert.equal(isVehicleUnassigned({ driverId: "" }), true);
    assert.equal(isVehicleUnassigned({ driverId: "  " }), true);
    assert.equal(isVehicleUnassigned({ driverId: "d1" }), false);
  });

  it("lists only unassigned vehicles, plus the current driver's vehicle when editing", () => {
    const rows = [
      vehicle("v1", 1, null),
      vehicle("v2", 2, "d1"),
      vehicle("v3", 3, "d9"),
      vehicle("v4", 4, ""),
    ];
    assert.deepEqual(
      vehiclesForDriverSelect(rows).map((row) => row._id),
      ["v1", "v4"],
    );
    assert.deepEqual(
      vehiclesForDriverSelect(rows, "d1").map((row) => row._id),
      ["v1", "v2", "v4"],
    );
  });

  it("finds the vehicle linked to a driver", () => {
    const rows = [vehicle("v1", 1, "d1"), vehicle("v2", 2, null)];
    assert.equal(vehicleLinkedToDriver(rows, "d1")?._id, "v1");
    assert.equal(vehicleLinkedToDriver(rows, "missing"), undefined);
  });

  it("requires name, phone, and vehicle on the driver form", () => {
    assert.equal(
      driverVehicleFormError({ name: "", phone: "1", vehicleId: "v1" }),
      "Enter a driver name",
    );
    assert.equal(
      driverVehicleFormError({ name: "Ada", phone: " ", vehicleId: "v1" }),
      "Enter a phone number",
    );
    assert.equal(
      driverVehicleFormError({ name: "Ada", phone: "1", vehicleId: "" }),
      "Select a vehicle",
    );
    assert.equal(
      driverVehicleFormError({ name: "Ada", phone: "1", vehicleId: "v1" }),
      null,
    );
  });

  it("resolves created driver ids from API payloads or reloaded matches", () => {
    assert.equal(
      resolveCreatedDriverId("507f1f77bcf86cd799439011", [], "Ada", "111"),
      "507f1f77bcf86cd799439011",
    );
    assert.equal(
      resolveCreatedDriverId({ _id: "d9" }, drivers, "Ada", "111"),
      "d9",
    );
    assert.equal(
      resolveCreatedDriverId("Done", drivers, "Ada", "111"),
      "d2",
    );
    assert.equal(
      resolveCreatedDriverId("Done", drivers, "Nobody", "000"),
      null,
    );
  });
});
