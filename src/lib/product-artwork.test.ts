import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_ARTWORK_FILES,
  artworkFileError,
  isArtworkImage,
  normalizeArtwork,
} from "./product-artwork.ts";

describe("product artwork", () => {
  it("accepts design files and images only", () => {
    for (const name of ["card.ai", "die.eps", "pack.zip", "label.pdf", "photo.jpg", "scan.PNG"]) {
      assert.equal(artworkFileError({ name, size: 2048 }), null, name);
    }
    assert.equal(
      artworkFileError({ name: "notes.txt", size: 20 }),
      "Upload a PDF, AI, EPS, ZIP, JPEG, PNG, or WebP file",
    );
    assert.equal(artworkFileError({ name: "empty.pdf", size: 0 }), "Artwork file is empty");
    assert.equal(
      artworkFileError({ name: "huge.ai", size: 25 * 1024 * 1024 + 1 }),
      "Artwork must be 25 MB or smaller",
    );
  });

  it("keeps signed artwork files and drops storage keys", () => {
    assert.deepEqual(
      normalizeArtwork([
        {
          fileName: "card.ai",
          contentType: "application/postscript",
          size: 12,
          url: "https://signed.example/artwork/card.ai",
          key: "secret",
        },
        { fileName: "missing.pdf", url: "artwork/local.pdf" },
        "not-a-file",
      ]),
      [
        {
          fileName: "card.ai",
          contentType: "application/postscript",
          size: 12,
          url: "https://signed.example/artwork/card.ai",
        },
        {
          fileName: "missing.pdf",
          contentType: "",
          size: 0,
          url: "",
        },
      ],
    );
    assert.equal(isArtworkImage({ fileName: "scan.png", contentType: "" }), true);
    assert.equal(isArtworkImage({ fileName: "card.ai", contentType: "application/postscript" }), false);
    assert.equal(MAX_ARTWORK_FILES, 5);
    assert.equal(normalizeArtwork(undefined).length, 0);
  });
});
