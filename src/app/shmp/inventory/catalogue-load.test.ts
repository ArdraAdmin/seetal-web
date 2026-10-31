import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catalogueRequestIsCurrent,
  shmpCatalogueParams,
} from "./catalogue-load.ts";

describe("shmp catalogue load", () => {
  it("includes the company id once the SHMP company is known", () => {
    assert.deepEqual(shmpCatalogueParams("  mug  ", "company-1"), {
      ownOnly: "1",
      excludeStl: "1",
      q: "mug",
      companyId: "company-1",
    });
  });

  it("does not send an empty company id", () => {
    assert.deepEqual(shmpCatalogueParams(" ", ""), {
      ownOnly: "1",
      excludeStl: "1",
    });
  });

  it("ignores a catalogue response after a newer request has started", () => {
    assert.equal(catalogueRequestIsCurrent(1, 2, false), false);
  });

  it("ignores a catalogue response that was aborted", () => {
    assert.equal(catalogueRequestIsCurrent(2, 2, true), false);
  });

  it("keeps the catalogue response that is still the latest", () => {
    assert.equal(catalogueRequestIsCurrent(2, 2, false), true);
  });
});
