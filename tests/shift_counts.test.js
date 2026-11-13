import { describe, expect, it } from "vitest";
import { shiftCounts } from "../lib/shift_row.js";
import { executeOp } from "../lib/team_sync.js";
import { SP_LISTS } from "../lib/sp_schema.js";

const at = (hh, mm, day = 13) => new Date(2026, 10, day, hh, mm).toISOString();
const ev = (event_type, alert_id, timestamp, extra = {}) => ({ event_type, alert_id, timestamp, ...extra });
const night = { from: new Date(2026, 10, 13, 22, 0), to: new Date(2026, 10, 14, 7, 0) };

describe("payroll counts (AOG_Shifts AlertCount / AcceptedCount / MissCount / AcceptLog)", () => {
  it("counts per message: what rang here, what was accepted, what rang out or went to the partner", () => {
    const events = [
      ev("DETECTED", "a1", at(22, 10)), ev("ALERTING", "a1", at(22, 10)), ev("ACCEPT", "a1", at(22, 11), { group_name: "BlueLane AOG" }),
      ev("DETECTED", "a2", at(23, 0)), ev("ALERTING", "a2", at(23, 0)), ev("MISSED", "a2", at(23, 10)),
      ev("DETECTED", "a3", at(23, 30)), ev("ALERTING", "a3", at(23, 30)), ev("PEER_HANDLED", "a3", at(23, 33)),
      // detected but never rang here (partner took it first): not counted
      ev("DETECTED", "a4", at(23, 40)),
      // arrived from the partner (no DETECTED here), rang and was accepted: counted
      ev("ALERTING", "a5", at(3, 0, 14)), ev("ACCEPT", "a5", at(3, 2, 14), { subject: "RE: AOG A321" }),
    ];
    expect(shiftCounts(events, night)).toEqual({ AlertCount: 4, AcceptedCount: 2, MissCount: 2, AcceptLog: "22:11 BlueLane AOG; 03:02 RE: AOG A321" });
  });

  it("never shows more accepts than alerts (the 5.0.3 bug: 20 alerts, 21 accepts)", () => {
    const events = [ev("ACCEPT", "x1", at(22, 5)), ev("ACCEPT", "x1", at(22, 6)), ev("ALERTING", "x2", at(22, 7)), ev("ACCEPT", "x2", at(22, 8))];
    const counts = shiftCounts(events, night);
    expect(counts.AcceptedCount).toBe(2);
    expect(counts.AlertCount).toBeGreaterThanOrEqual(counts.AcceptedCount);
  });

  it("at night end every message that rang here and was not accepted is a miss, so Alert = Accepted + Miss", () => {
    const events = [ev("ALERTING", "o1", at(6, 55, 14)), ev("ALERTING", "o2", at(6, 50, 14)), ev("ACCEPT", "o2", at(6, 51, 14))];
    expect(shiftCounts(events, night).MissCount).toBe(0);
    const ended = shiftCounts(events, { ...night, ended: true });
    expect(ended).toMatchObject({ AlertCount: 2, AcceptedCount: 1, MissCount: 1 });
  });

  it("Backup is never charged a miss when the person on watch takes the message (Ethan late, Julia ringing)", () => {
    // Ethan (Primary) machine: rang, rang out to Backup, then Julia accepted -> Ethan: alert + miss
    const ethan = [ev("ALERTING", "e1", at(3, 0, 14), { role: "primary" }), ev("PEER_ESCALATED_SENT", "e1", at(3, 2, 14)), ev("PEER_HANDLED", "e1", at(3, 4, 14))];
    expect(shiftCounts(ethan, { ...night, ended: true })).toMatchObject({ AlertCount: 1, AcceptedCount: 0, MissCount: 1 });
    // Julia (Backup) machine: the escalated message rang, Julia accepted -> Julia: alert + accepted
    const juliaAccepts = [ev("PEER_ESCALATED_RECEIVED", "e1", at(3, 2, 14)), ev("ALERTING", "e1", at(3, 2, 14), { role: "backup" }), ev("ACCEPT", "e1", at(3, 4, 14), { group_name: "BlueLane AOG" })];
    expect(shiftCounts(juliaAccepts, { ...night, ended: true })).toMatchObject({ AlertCount: 1, AcceptedCount: 1, MissCount: 0 });
    // Julia (Backup) machine: rang, but Ethan accepted late -> Julia: alert, no miss, also not at night end
    const ethanLate = [ev("ALERTING", "e2", at(4, 0, 14), { role: "backup" }), ev("PEER_HANDLED", "e2", at(4, 1, 14))];
    expect(shiftCounts(ethanLate, night)).toMatchObject({ AlertCount: 1, AcceptedCount: 0, MissCount: 0 });
    expect(shiftCounts(ethanLate, { ...night, ended: true })).toMatchObject({ MissCount: 0 });
    // Julia (Backup) rang out and nobody took it: both missed
    const nobody = [ev("ALERTING", "e3", at(5, 0, 14), { role: "backup" }), ev("MISSED", "e3", at(5, 5, 14))];
    expect(shiftCounts(nobody, night)).toMatchObject({ AlertCount: 1, MissCount: 1 });
  });

  it("counts a missed-message report as an alert and a miss, by the time of the message", () => {
    const events = [ev("LEAK_REPORTED", undefined, at(9, 0, 14), { reported_for: at(1, 0, 14) })];
    expect(shiftCounts(events, night)).toMatchObject({ AlertCount: 1, MissCount: 1 });
  });

  it("ignores test messages and anything outside the night", () => {
    const events = [ev("ALERTING", "sim-1", at(22, 30)), ev("ACCEPT", "sim-1", at(22, 31)), ev("ALERTING", "old", at(21, 0)), ev("ACCEPT", "old", at(21, 1))];
    expect(shiftCounts(events, night)).toEqual({ AlertCount: 0, AcceptedCount: 0, MissCount: 0, AcceptLog: "" });
  });
});

describe("update op (payroll row)", () => {
  function client(rows) {
    return {
      rows,
      async updateItem(list, id, fields) {
        const row = rows.find((item) => item.Id === id);
        if (!row) { const error = new Error("gone"); error.status = 404; throw error; }
        Object.assign(row, fields);
      },
      async addItem() { throw new Error("must not create"); },
    };
  }
  it("updates the known row only and never creates one", async () => {
    const c = client([{ Id: 7, Title: "Julia", Email: "julia@x.vn", Start: "2026-11-13 22:00" }]);
    await executeOp(c, { kind: "update", list: SP_LISTS.SHIFTS, id: 7, fields: { AlertCount: 3, AcceptedCount: 3, MissCount: 0, AcceptLog: "22:10 A" } });
    expect(c.rows[0]).toMatchObject({ Title: "Julia", Start: "2026-11-13 22:00", AlertCount: 3 });
    await expect(executeOp(c, { kind: "update", list: SP_LISTS.SHIFTS, id: 99, fields: { AlertCount: 1 } })).resolves.toEqual({});
    expect(c.rows).toHaveLength(1);
  });
});
