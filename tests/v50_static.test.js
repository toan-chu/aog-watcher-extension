import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const manifest = JSON.parse(await read("manifest.json"));
const worker = await read("service_worker.js");
const whatsapp = await read("content_whatsapp.js");
const stateMachine = await read("lib/state_machine.js");

describe("5.0 wiring", () => {
  it("is version 5.0.0 with SharePoint host access", () => {
    expect(manifest.version).toBe("5.0.0");
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
    expect(worker).toContain("if ((await ringingSystemAlerts()).length) await playWakeAudio(config);");
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

  it("the shared night row is upserted as a shared row", () => {
    expect(worker).toContain('key_field: "ShiftDate"');
    expect(worker).toContain("shared: true");
  });
});
