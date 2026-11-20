import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginReauthUrl } from "./auth.ts";
import { remoteSessionDecision } from "./session.ts";

describe("stale session recovery", () => {
  it("reauth login path is distinct from a normal login visit", () => {
    assert.match(loginReauthUrl(), /\breauth=1\b/);
    assert.equal(loginReauthUrl().startsWith("/login"), true);
  });

  it("still rejects only explicit 401 sessions from the API", () => {
    assert.equal(remoteSessionDecision(401), "reject");
    assert.equal(remoteSessionDecision(null), "unknown");
    assert.equal(remoteSessionDecision(200), "allow");
  });
});
