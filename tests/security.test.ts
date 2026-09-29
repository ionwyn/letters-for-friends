import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decryptJson,
  encryptJson,
  keyedHash,
  validSignature,
} from "../src/lib/crypto";
import { cleanDocument, usedAssets } from "../src/lib/content";

process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-chars-long";
process.env.ENCRYPTION_KEY = "a".repeat(64);

test("encrypted letters require their message ID and an untampered ciphertext", () => {
  const cipher = encryptJson({ title: "Private words" }, "message-1");
  assert.deepEqual(decryptJson(cipher, "message-1"), {
    title: "Private words",
  });
  assert.throws(() => decryptJson(cipher, "message-2"));
  assert.throws(() => decryptJson(`${cipher.slice(0, -2)}xx`, "message-1"));
});

test("session signatures reject altered payloads", () => {
  const signature = keyedHash("session");
  assert.equal(validSignature("session", signature), true);
  assert.equal(validSignature("changed", signature), false);
});

test("content rejects unsafe links and external media", () => {
  assert.throws(() =>
    cleanDocument({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "click",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    }),
  );
  assert.throws(() =>
    cleanDocument({
      type: "doc",
      content: [
        { type: "image", attrs: { src: "https://example.com/image.png" } },
      ],
    }),
  );
});

test("content retains authorized attachment references", () => {
  const id = "a84c8d17-4223-4813-927d-6295838357c2";
  const doc = cleanDocument({
    type: "doc",
    content: [
      { type: "image", attrs: { src: `/api/assets/${id}`, alt: "Photo" } },
    ],
  });
  assert.deepEqual(usedAssets(doc), [id]);
});
