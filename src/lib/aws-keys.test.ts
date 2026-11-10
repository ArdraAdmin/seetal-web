import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { awsKeysFromText } from "./aws-keys.ts";

describe("awsKeysFromText", () => {
  it("reads static keys from the API config text", () => {
    const keys = awsKeysFromText(`
      AWS.config.update({
        accessKeyId: 'KEY',
        secretAccessKey: 'secret+value',
      });
    `);
    assert.deepEqual(keys, {
      accessKeyId: "KEY",
      secretAccessKey: "secret+value",
    });
  });

  it("returns null when the config has no keys", () => {
    assert.equal(awsKeysFromText("const s3 = {};"), null);
  });
});
