import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, extname } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
async function files(directory, extension) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path, extension));
    else if (extname(path) === extension) result.push(path);
  }
  return result;
}
async function existsFrom(source, reference) {
  if (!reference || reference.startsWith("#") || /^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(reference)) return;
  // These templates use real relative paths; queries/hashes do not change the file.
  const url = new URL(reference, pathToFileURL(source));
  url.search = ""; url.hash = "";
  const target = fileURLToPath(url);
  let found = false;
  try { found = (await stat(target)).isFile(); } catch { /* Report the source link below. */ }
  assert.ok(found, `${source}: missing local resource ${reference}`);
}
test("every local template link, image, script and stylesheet resolves to an existing file", async () => {
  for (const path of await files(join(root, "templates"), ".html")) {
    const text = await readFile(path, "utf8");
    for (const [, reference] of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) await existsFrom(path, reference);
  }
});
test("all static and dynamic relative JavaScript module imports resolve", async () => {
  for (const path of await files(join(root, "static", "js"), ".js")) {
    const text = (await readFile(path, "utf8")).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const [, reference] of text.matchAll(/(?:from\s*|import\s*\(?\s*)["'](\.[^"']+)["']/g)) await existsFrom(path, reference);
  }
});
test("local CSS image and font URLs resolve", async () => {
  for (const path of await files(join(root, "static", "css"), ".css")) {
    const text = await readFile(path, "utf8");
    for (const [, reference] of text.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) await existsFrom(path, reference);
  }
});
