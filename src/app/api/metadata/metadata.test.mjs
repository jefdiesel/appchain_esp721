/**
 * Metadata API tests
 * Run with: node --test src/app/api/metadata/\[id\]/route.test.mjs
 */

import { strict as assert } from "node:assert";
import { test, describe } from "node:test";

// --- Replicated helper functions from route.ts ---

function decodeContentUri(uri) {
  if (uri.startsWith("data:,")) return decodeURIComponent(uri.slice(6));
  const commaIdx = uri.indexOf(",");
  if (commaIdx === -1) return uri;
  const meta = uri.slice(0, commaIdx);
  const body = uri.slice(commaIdx + 1);
  if (meta.includes("base64")) {
    return Buffer.from(body, "base64").toString("utf-8");
  }
  return decodeURIComponent(body);
}

function textToSvgDataUri(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const fontSize = text.length > 20 ? 16 : text.length > 10 ? 24 : 32;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  <rect width="500" height="500" fill="#000"/>
  <text x="250" y="250" font-family="monospace" font-size="${fontSize}" fill="#C3FF00"
    text-anchor="middle" dominant-baseline="central">${escaped}</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// --- Tests ---

describe("decodeContentUri", () => {
  test("decodes data:, prefix", () => {
    assert.equal(decodeContentUri("data:,hello"), "hello");
  });

  test("decodes URL-encoded content", () => {
    assert.equal(decodeContentUri("data:,hello%20world"), "hello world");
  });

  test("decodes base64 content", () => {
    const encoded = Buffer.from("test content").toString("base64");
    assert.equal(
      decodeContentUri(`data:text/plain;base64,${encoded}`),
      "test content"
    );
  });

  test("decodes plain text with charset", () => {
    assert.equal(
      decodeContentUri("data:text/plain;charset=utf-8,hello"),
      "hello"
    );
  });

  test("handles empty data:, uri", () => {
    assert.equal(decodeContentUri("data:,"), "");
  });

  test("handles uri with no comma", () => {
    assert.equal(decodeContentUri("nocomma"), "nocomma");
  });

  test("handles Chinese characters", () => {
    assert.equal(decodeContentUri("data:,%E4%BD%A0%E5%A5%BD"), "你好");
  });

  test("handles base64 with unicode", () => {
    const encoded = Buffer.from("日本語").toString("base64");
    assert.equal(
      decodeContentUri(`data:text/plain;base64,${encoded}`),
      "日本語"
    );
  });
});

describe("textToSvgDataUri", () => {
  test("returns valid SVG data URI for short text", () => {
    const uri = textToSvgDataUri("hello");
    assert.ok(uri.startsWith("data:image/svg+xml;base64,"));
    const svg = Buffer.from(uri.split(",")[1], "base64").toString();
    assert.ok(svg.includes("hello"));
    assert.ok(svg.includes('font-size="32"'));
    assert.ok(svg.includes("xmlns="));
    assert.ok(svg.includes("</svg>"));
  });

  test("uses medium font for 11-20 char text", () => {
    const uri = textToSvgDataUri("medium-length");
    const svg = Buffer.from(uri.split(",")[1], "base64").toString();
    assert.ok(svg.includes('font-size="24"'));
  });

  test("uses small font for 21+ char text", () => {
    const uri = textToSvgDataUri("this is a very long text string!!");
    const svg = Buffer.from(uri.split(",")[1], "base64").toString();
    assert.ok(svg.includes('font-size="16"'));
  });

  test("escapes HTML special characters", () => {
    const uri = textToSvgDataUri('<script>"alert&xss"</script>');
    const svg = Buffer.from(uri.split(",")[1], "base64").toString();
    assert.ok(svg.includes("&lt;script&gt;"));
    assert.ok(svg.includes("&quot;"));
    assert.ok(svg.includes("&amp;"));
    assert.ok(!svg.includes("<script>"));
  });

  test("produces valid base64", () => {
    const uri = textToSvgDataUri("test");
    const b64 = uri.split(",")[1];
    // Should not throw
    const decoded = Buffer.from(b64, "base64").toString();
    assert.ok(decoded.length > 0);
  });
});

describe("metadata response shape (simulated)", () => {
  test("text ethscription produces correct OpenSea metadata", () => {
    const contentUri = "data:,my-name";
    const creator = "0x1234567890abcdef1234567890abcdef12345678";
    const blockNumber = "12345";
    const id = "0x" + "ab".repeat(32);

    const text = decodeContentUri(contentUri);
    const image = textToSvgDataUri(text);

    const metadata = {
      name: text,
      description: `Wrapped ethscription ${id}. Originally created by ${creator} in block ${blockNumber}.`,
      image,
      external_url: `https://ethscriptions.com/ethscriptions/${id}`,
      attributes: [
        { trait_type: "Content Type", value: "text" },
        { trait_type: "Creator", value: creator },
        { trait_type: "Block Number", value: blockNumber },
        { trait_type: "Original TX", value: id },
      ],
    };

    assert.equal(metadata.name, "my-name");
    assert.ok(metadata.description.includes(id));
    assert.ok(metadata.description.includes(creator));
    assert.ok(metadata.image.startsWith("data:image/svg+xml;base64,"));
    assert.ok(metadata.external_url.includes(id));
    assert.equal(metadata.attributes.length, 4);

    for (const attr of metadata.attributes) {
      assert.ok(typeof attr.trait_type === "string");
      assert.ok(typeof attr.value === "string");
      assert.ok(attr.trait_type.length > 0);
      assert.ok(attr.value.length > 0);
    }
  });

  test("image ethscription detected correctly", () => {
    const cases = [
      { uri: "data:image/png;base64,abc", expected: "image" },
      { uri: "data:image/svg+xml;base64,abc", expected: "image" },
      { uri: "data:image/gif;base64,abc", expected: "image" },
    ];
    for (const { uri, expected } of cases) {
      const isImage = uri.startsWith("data:image/");
      assert.equal(isImage ? "image" : "other", expected, `Failed for ${uri}`);
    }
  });

  test("text ethscription detected correctly", () => {
    const cases = [
      { uri: "data:,hello", expected: "text" },
      { uri: "data:text/plain,hello", expected: "text" },
      { uri: "data:text/plain;charset=utf-8,hello", expected: "text" },
    ];
    for (const { uri, expected } of cases) {
      const isText = uri.startsWith("data:text/plain") || uri.startsWith("data:,");
      assert.equal(isText ? "text" : "other", expected, `Failed for ${uri}`);
    }
  });

  test("other content types fall through", () => {
    const cases = [
      "data:application/json,{}",
      "data:text/html,<h1>hi</h1>",
      "data:application/octet-stream;base64,abc",
    ];
    for (const uri of cases) {
      const isText = uri.startsWith("data:text/plain") || uri.startsWith("data:,");
      const isImage = uri.startsWith("data:image/");
      assert.ok(!isText && !isImage, `Should be 'other' for ${uri}`);
    }
  });
});

describe("input validation", () => {
  test("valid 0x-prefixed 64-char hex ID accepted", () => {
    const valid = "0x" + "a".repeat(64);
    assert.ok(/^0x[0-9a-f]{64}$/i.test(valid));
  });

  test("uppercase hex accepted", () => {
    const valid = "0x" + "A".repeat(64);
    assert.ok(/^0x[0-9a-f]{64}$/i.test(valid));
  });

  test("mixed case hex accepted", () => {
    const valid = "0xaBcDeF" + "1".repeat(58);
    assert.ok(/^0x[0-9a-f]{64}$/i.test(valid));
  });

  test("rejects too-short ID", () => {
    assert.ok(!/^0x[0-9a-f]{64}$/i.test("0xabc"));
  });

  test("rejects too-long ID", () => {
    assert.ok(!/^0x[0-9a-f]{64}$/i.test("0x" + "a".repeat(65)));
  });

  test("rejects non-hex chars", () => {
    assert.ok(!/^0x[0-9a-f]{64}$/i.test("0x" + "g".repeat(64)));
  });

  test("rejects missing 0x prefix", () => {
    assert.ok(!/^0x[0-9a-f]{64}$/i.test("a".repeat(64)));
  });

  test("rejects empty string", () => {
    assert.ok(!/^0x[0-9a-f]{64}$/i.test(""));
  });
});
