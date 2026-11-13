import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const manifest = JSON.parse(await read("manifest.json"));
const worker = await read("service_worker.js");
const whatsapp = await read("content_whatsapp.js");
const stateMachine = await read("lib/state_machine.js");

describe("5.0 wiring", () => {
  it("is a 5.x version, the same in manifest, package.json and the popup, with SharePoint host access", async () => {
    const { APP_VERSION } = await import("../lib/constants.js");
    const pkg = JSON.parse(await read("package.json"));
    expect(manifest.version).toMatch(/^5\.\d+\.\d+$/);
    expect(APP_VERSION).toBe(manifest.version);
    expect(pkg.version).toBe(manifest.version);
    expect(manifest.host_permissions).toContain("https://*.sharepoint.com/*");
  });

  it("sends peer signals through SharePoint first and keeps WhatsApp tag as fallback", () => {
    const body = worker.slice(worker.indexOf("async function sendPeer("), worker.indexOf("// ---------- baseline"));
    expect(body.indexOf("sendSignal(")).toBeGreaterThan(-1);
    expect(body.indexOf("sendPeerTextViaWhatsApp(")).toBeGreaterThan(body.indexOf("sendSignal("));
  });

  it("runs a periodic self-check tick", () => {
    expect(worker).toContain('const TICK_ALARM = "aog:tick"');
    expect(worker).toContain("periodInMinutes: 0.5");
    expect(worker).toContain("await evaluateSelf()");
  });

  it("system alerts ring independently and are cleared through reconcileAudio", () => {
    expect(worker).toContain("async function raiseSystemAlert(");
    expect(worker).toContain("async function reconcileAudio(");
    expect(worker).toContain("if ((await ringingSystemAlerts()).length && !(await muteState()).sound) await playWakeAudio(config);");
  });

  it("unknown WhatsApp chats still ring and ignored chats never do", () => {
    expect(whatsapp).toContain('kind === "ignored"');
    expect(whatsapp).toContain("unknown_chat: unknownChat");
    expect(worker).toContain("if (kind === CHAT_CLASS.IGNORED || kind === CHAT_CLASS.COORD) return;");
  });

  it("baseline covers every chat so old unread in unknown chats does not ring", () => {
    const snapshot = whatsapp.slice(whatsapp.indexOf("function currentUnreadSnapshot"), whatsapp.indexOf("function seedBaseline"));
    expect(snapshot).toContain('kind === "coord"');
    expect(snapshot).not.toContain("isCustomer");
  });

  it("keeps the 4.3 state machine free of 5.0 features", () => {
    for (const word of ["sharepoint", "followup", "preflight", "unknown_chat", "system"]) expect(stateMachine.toLowerCase()).not.toContain(word);
  });

  it("AOG_Shifts: only the payroll counts are updated on an existing row, never created", () => {
    expect(worker).toContain('await queueWrite({ kind: "update", list: SP_LISTS.SHIFTS, id: window.id, fields });');
    expect(worker).not.toMatch(/kind: "upsert",\s*list: SP_LISTS\.SHIFTS/);
  });
});
