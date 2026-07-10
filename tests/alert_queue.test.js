import { describe, expect, it } from "vitest";
import { AlertQueue } from "../lib/alert_queue.js";

const alert = (id, detected_at = "2026-06-22T10:00:00Z") => ({ alert_id: id, source: "whatsapp", detected_at });

describe("AlertQueue", () => {
  it("deduplicates IDs", () => { const queue = new AlertQueue(); queue.add(alert("a")); queue.add(alert("a")); expect(queue.all()).toHaveLength(1); });
  it("returns first queued item", () => { const queue = new AlertQueue([alert("a"), alert("b")]); queue.mark("a", "HANDLED"); expect(queue.nextPending().alert_id).toBe("b"); });
  it("marks status and reason", () => { const queue = new AlertQueue([alert("a")]); queue.mark("a", "MISSED", "timeout"); expect(queue.findById("a")).toMatchObject({ status: "MISSED", reason: "timeout" }); });
  it("matches WhatsApp timestamp in window", () => expect(new AlertQueue([alert("a")]).findWhatsAppByTimestamp("2026-06-22T10:00:30Z", 60)?.alert_id).toBe("a"));
  it("rejects timestamp outside window", () => expect(new AlertQueue([alert("a")]).findWhatsAppByTimestamp("2026-06-22T10:02:00Z", 60)).toBeNull());
  it("returns defensive copies", () => { const queue = new AlertQueue([alert("a")]); const items = queue.all(); items[0].alert_id = "x"; expect(queue.findById("a")).not.toBeNull(); });
});

