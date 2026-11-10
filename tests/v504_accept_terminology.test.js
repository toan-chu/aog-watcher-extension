import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const self = "tests\\v504_accept_terminology.test.js";
const extensions = new Set([".js", ".html", ".css", ".md"]);
const forbidden = new RegExp([
  "\\b\\u0041\\u0043\\u004b\\b",
  "\\u0041\\u0043\\u004b_",
  "_\\u0041\\u0043\\u004b",
  "\\b\\u0041\\u0063\\u006b",
  "\\b\\u0061\\u0063\\u006b",
  "_\\u0061\\u0063\\u006b",
].join("|"));

async function sourceFiles(dir = root) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "handoff" || entry.name === "assets") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (extensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

describe("V5-04 Accept terminology", () => {
  it("contains no legacy acceptance term in product or test source", async () => {
    const offenders = [];
    for (const path of await sourceFiles()) {
      if (relative(root, path) === self) continue;
      if (forbidden.test(await readFile(path, "utf8"))) offenders.push(relative(root, path));
    }
    expect(offenders).toEqual([]);
  });
});
