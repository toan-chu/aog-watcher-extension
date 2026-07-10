import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const serviceWorker = await readFile(new URL("../service_worker.js", import.meta.url), "utf8");

describe("service worker Round 3 wiring", () => {
  it("blocks wake and peer send side effects in dry-run mode", () => {
    expect(serviceWorker).toContain("DRY_RUN_WOULD_WAKE");
    expect(serviceWorker).toContain("DRY_RUN_WOULD_SEND_TAG");
    expect(serviceWorker).toContain("if (config.dry_run)");
  });

  it("starts and ends shift sessions through runtime messages", () => {
    expect(serviceWorker).toContain("startShiftSession");
    expect(serviceWorker).toContain("SHIFT_STARTED");
    expect(serviceWorker).toContain("END_SHIFT");
    expect(serviceWorker).toContain("SHIFT_ENDED");
  });

  it("backfills ACK response time from persisted event log, not an in-memory map", () => {
    expect(serviceWorker).not.toContain("detectedAtByAlertId");
    expect(serviceWorker).toContain("for (const event of await getEventLog())");
  });
});
