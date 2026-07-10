import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
const runtimeState = await readFile(new URL("../lib/runtime_state.js", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../service_worker.js", import.meta.url), "utf8");
const offscreen = await readFile(new URL("../offscreen.js", import.meta.url), "utf8");
const settingsHtml = await readFile(new URL("../settings.html", import.meta.url), "utf8");
const settingsJs = await readFile(new URL("../settings.js", import.meta.url), "utf8");
const popupHtml = await readFile(new URL("../popup.html", import.meta.url), "utf8");
const popupJs = await readFile(new URL("../popup.js", import.meta.url), "utf8");

describe("v4.3 P1 field feedback fixes", () => {
  it("adds Chrome idle permission and clamps idle threshold to 15 seconds", () => {
    expect(manifest.permissions).toContain("idle");
    expect(serviceWorker).toContain("Math.max(15");
    expect(settingsJs).toContain("idle_threshold_seconds");
  });

  it("defers active-user wake audio without changing escalation timers", () => {
    expect(serviceWorker).toContain("WAKE_DEFERRED_ACTIVE");
    expect(serviceWorker).toContain("state.pending_wake = effect.alert.alert_id");
    expect(serviceWorker).toContain("showWakeNotification(effect.alert)");
  });

  it("plays deferred wake audio when Chrome idle changes to idle or locked", () => {
    expect(runtimeState).toContain("pending_wake");
    expect(serviceWorker).toContain("chrome.idle?.onStateChanged");
    expect(serviceWorker).toContain("await playWakeAudio(config)");
  });

  it("suppresses wake completely for the active WhatsApp conversation", () => {
    expect(serviceWorker).toContain("WAKE_SUPPRESSED_FOCUSED");
    expect(serviceWorker).toContain("active_conversation");
    expect(serviceWorker).toContain("isSameGroupName");
  });

  it("keeps pending wake when focused WhatsApp suppression happens", () => {
    const focusedBranch = serviceWorker.slice(serviceWorker.indexOf("WAKE_SUPPRESSED_FOCUSED") - 260, serviceWorker.indexOf("WAKE_SUPPRESSED_FOCUSED") + 260);
    expect(focusedBranch).toContain("state.pending_wake = effect.alert.alert_id");
    expect(focusedBranch).toContain("await persist()");
  });

  it("supports gentle audio loop mode with ramp while preserving escalate mode", () => {
    expect(existsSync(new URL("../assets/audio/gentle_loop.wav", import.meta.url))).toBe(true);
    expect(offscreen).toContain("playGentle");
    expect(offscreen).toContain("audio.loop = true");
    expect(offscreen).toContain("playEscalate");
  });

  it("adds settings controls and preview button for wake audio behavior", () => {
    expect(settingsHtml).toContain("wakeAudioMode");
    expect(settingsHtml).toContain("previewAudio");
    expect(settingsJs).toContain("PREVIEW_AUDIO");
  });

  it("uses an inline End Shift confirmation with a 5-second timeout", () => {
    expect(popupHtml).toContain("id=\"endShiftButton\" class=\"end-shift\"");
    expect(popupJs).toContain("resetEndShiftConfirm");
    expect(popupJs).toContain("setTimeout(resetEndShiftConfirm, 5000)");
  });
});
