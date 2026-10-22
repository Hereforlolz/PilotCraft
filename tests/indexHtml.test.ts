import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The page's <head> is what link previews are built from. It once still said
// "AI Adoption Strategy Generator" after the rename to PilotCraft, and asked
// for a large image card when no image existed.

const html = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html"), "utf8");
const meta = (attr: "name" | "property", key: string) =>
  html.match(new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`))?.[1];

test("index.html names the app PilotCraft everywhere a link preview reads it", () => {
  assert.match(html, /<title>PilotCraft<\/title>/);
  assert.match(meta("property", "og:title") ?? "", /PilotCraft/);
  assert.match(meta("name", "twitter:title") ?? "", /PilotCraft/);
  assert.equal(meta("property", "og:site_name"), "PilotCraft");
  assert.doesNotMatch(html, /AI Adoption Strategy Generator/);
});

test("index.html has a description for search and link previews", () => {
  const description = meta("name", "description") ?? "";
  assert.ok(description.length > 40 && description.length <= 200, `description length ${description.length}`);
  assert.equal(meta("property", "og:description"), description);
});

test("index.html only requests a large-image Twitter card if it supplies an og:image", () => {
  const hasImage = Boolean(meta("property", "og:image"));
  const card = meta("name", "twitter:card");
  assert.equal(card, hasImage ? "summary_large_image" : "summary");
});
