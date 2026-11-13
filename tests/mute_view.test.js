import { describe, expect, it } from "vitest";
import { runPreflight } from "../lib/preflight.js";
import { watchingSummary } from "../lib/popup_view.js";

const ok = { status: "ok" };
const closed = { status: "missing", message: "Outlook tab not found" };
const base = { config: { self_display_name: "A" }, soundConfirmedAt: Date.now() };

describe("ring switches and Test mode in the readiness checks", () => {
  it("a source with ringing switched off is not required; Sound off keeps both required", () => {
    expect(runPreflight({ ...base, sources: { whatsapp: ok, outlook: closed } }).failed).toContain("outlook");
    expect(runPreflight({ ...base, sources: { whatsapp: ok, outlook: closed }, muted: { outlook: true } }).failed).not.toContain("outlook");
    expect(runPreflight({ ...base, sources: { whatsapp: ok, outlook: closed }, muted: { sound: true } }).failed).toContain("outlook");
  });

  it("Test mode needs no roster row and no partner", () => {
    const args = { ...base, sources: { whatsapp: ok, outlook: ok }, sharepoint: { configured: true, ok: true }, roster: { checked: true, on_roster: false }, groupsSyncedAt: Date.now(), peers: [] };
    const real = runPreflight(args);
    expect(real.items.map((item) => item.key)).toEqual(expect.arrayContaining(["roster", "peer"]));
    const test = runPreflight({ ...args, testMode: true });
    expect(test.items.map((item) => item.key)).not.toContain("roster");
    expect(test.items.map((item) => item.key)).not.toContain("peer");
    expect(test.ready).toBe(true);
  });

  it("the Tonight title does not turn red for a source switched off", () => {
    const status = { session: { role: "primary" }, sources: { whatsapp: ok, outlook: closed } };
    expect(watchingSummary(status).tone).toBe("bad");
    expect(watchingSummary({ ...status, mute: { outlook: true } }).tone).toBe("ok");
  });
});
