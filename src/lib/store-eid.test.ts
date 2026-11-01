import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isStoreObjectKey,
  storeEidFileError,
  storeEidNumberError,
  storeObjectKey,
} from "./store-eid.ts";

const STORE_ID = "507f1f77bcf86cd799439011";

describe("store EID files", () => {
  it("accepts a PDF or image and rejects other files", () => {
    assert.equal(
      storeEidFileError({ name: "eid.pdf", type: "application/pdf", size: 12 }),
      null,
    );
    assert.equal(
      storeEidFileError({ name: "eid.txt", type: "text/plain", size: 12 }),
      "EID document must be a PDF, JPEG, PNG, or WebP file",
    );
    assert.equal(
      storeEidFileError({
        name: "eid.pdf",
        type: "application/pdf",
        size: 11 * 1024 * 1024,
      }),
      "EID document must be 10 MB or smaller",
    );
    assert.equal(storeEidFileError(null), null);
  });

  it("keeps the EID number optional and bounded", () => {
    assert.equal(storeEidNumberError(""), null);
    assert.equal(storeEidNumberError("784-1990-1234567-1"), null);
    assert.equal(storeEidNumberError("x".repeat(41)), "EID number is too long");
  });

  it("builds an S3 key under the store and rejects anything else", () => {
    const key = storeObjectKey(STORE_ID, "EID copy.pdf");
    assert.equal(isStoreObjectKey(key), true);
    assert.equal(key.startsWith(`store-files/${STORE_ID}/`), true);
    assert.equal(isStoreObjectKey("store-files/../secret"), false);
    assert.equal(isStoreObjectKey("vehicle-files/1-a-doc.pdf"), false);
    assert.throws(() => storeObjectKey("not-an-id", "eid.pdf"), /Store not found/);
  });
});
