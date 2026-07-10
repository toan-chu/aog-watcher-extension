import { describe, expect, it } from "vitest";
import { createInitialState, reduce } from "../lib/state_machine.js";
import { hydrateRuntimeState, serializeRuntimeState } from "../lib/runtime_state.js";

const timing = { primary_timeout_seconds: 120, backup_delay_seconds: 180, max_alert_duration_seconds: 540 };
const alert = { alert_id: "email-aog-repeat", source: "email", sender: "ops@example.com", subject: "AOG TEST", detected_at: "2026-06-23T10:00:00Z" };
const detect = () => ({ type: "ALERT_DETECTED", payload: { alert, within_shift: true, peer_handled: false, timing } });

describe("service worker restart simulation", () => {
  it("does not persist handled queue entries across restart, so repeated alert_id can wake again", () => {
    const firstDetection = reduce(createInitialState({ role: "primary" }), detect());
    const acked = reduce(firstDetection.state, { type: "ALERT_ACK" }).state;
    expect(acked.queue.findById(alert.alert_id).status).toBe("HANDLED");

    const stored = serializeRuntimeState(acked);
    expect(stored).not.toHaveProperty("queue");

    const restarted = hydrateRuntimeState(stored, { role: "primary" });
    expect(restarted.queue.all()).toHaveLength(0);

    const secondDetection = reduce(restarted, detect());
    expect(secondDetection.state.app_state).toBe("ALERTING");
    expect(secondDetection.effects).toContainEqual(expect.objectContaining({ type: "START_WAKE" }));
  });
});
