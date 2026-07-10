import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
if (manifest.manifest_version !== 3) throw new Error("manifest_version must be 3");
if (manifest.background?.type !== "module") throw new Error("service worker must be an ES module");

const referenced = new Set([
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_page,
  ...Object.values(manifest.icons ?? {}),
  ...manifest.content_scripts.flatMap((entry) => entry.js),
]);

for (const path of referenced) await access(path, constants.R_OK);
for (const permission of ["storage", "alarms", "offscreen", "notifications"]) {
  if (!manifest.permissions.includes(permission)) throw new Error(`Missing permission: ${permission}`);
}

const worker = await readFile(manifest.background.service_worker, "utf8");
if (!worker.includes("chrome.alarms.onAlarm")) throw new Error("Alarm listener is missing");
if (!worker.includes("chrome.offscreen.createDocument")) throw new Error("Offscreen audio setup is missing");

console.log(`MV3 check passed (${referenced.size} referenced files).`);

