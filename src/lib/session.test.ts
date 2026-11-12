import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSessionCookie,
  encodeSessionCookie,
  isRejectedSessionStatus,
  parseAuthCookie,
  remoteSessionDecision,
} from "./session.ts";

describe("archived session checks", () => {
  it("treats only 401 as a session the server has ended", () => {
    assert.equal(isRejectedSessionStatus(401), true);
    assert.equal(isRejectedSessionStatus(400), false);
    assert.equal(isRejectedSessionStatus(403), false);
    assert.equal(isRejectedSessionStatus(404), false);
    assert.equal(isRejectedSessionStatus(500), false);
  });

  it("keeps a full custom-user grant out of the session cookie", () => {
    const grant = {
      companies: ["shmp", "stl", "shlaxmi", "sarvah"],
      modules: {
        shmp: Array.from({ length: 17 }, (_, index) => `module-${index}`),
        stl: Array.from({ length: 21 }, (_, index) => `module-${index}`),
        shlaxmi: Array.from({ length: 21 }, (_, index) => `module-${index}`),
        sarvah: Array.from({ length: 21 }, (_, index) => `module-${index}`),
      },
      explicit: true,
      permissions: {
        version: 1,
        shmp: Object.fromEntries(
          Array.from({ length: 12 }, (_, index) => [
            `area-${index}`,
            { fields: Object.fromEntries(Array.from({ length: 26 }, (_, field) => [`field-${field}`, true])) },
          ]),
        ),
      },
    };
    const encoded = encodeSessionCookie(
      buildSessionCookie({
        token: "x".repeat(180),
        role: "Admin",
        id: "6af47c84e438bffa5f2095b2",
        name: "Suraj",
        email: "suraj@shrseetal.com",
        isSuperAdmin: false,
        environments: ["stl", "shmp"],
        customUser: true,
      }),
    );
    const cookie = `stl_session=${encoded}`;
    assert.equal(cookie.includes("permissions"), false);
    assert.equal(cookie.includes("modules"), false);
    assert.equal(JSON.stringify(grant).length > 4000, true);
    assert.equal(cookie.length < 4096, true);
    assert.deepEqual(parseAuthCookie(encoded), {
      token: "x".repeat(180),
      role: "Admin",
      id: "6af47c84e438bffa5f2095b2",
      name: "Suraj",
      email: "suraj@shrseetal.com",
      isSuperAdmin: false,
      environments: ["stl", "shmp"],
      customUser: true,
    });
  });

  it("keeps the session when the archive check does not finish", () => {
    assert.equal(remoteSessionDecision(null), "unknown");
    assert.equal(remoteSessionDecision(401), "reject");
    assert.equal(remoteSessionDecision(200), "allow");
    assert.equal(remoteSessionDecision(404), "unknown");
    assert.equal(remoteSessionDecision(500), "unknown");
  });
});
