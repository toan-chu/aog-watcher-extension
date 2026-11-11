import { ROLE } from "./constants.js";
import { isDutyRole, resolveRoleAtTime } from "./shift_engine.js";

// Peer liveness from the Machine rows of AOG_Log (see pullMachines in team_sync.js).
export function evaluatePeers(rows = [], { selfId = "", now = Date.now(), lostAfterMinutes = 5 } = {}) {
  return rows
    .filter((row) => row.MachineId && row.MachineId !== selfId)
    .map((row) => {
      const lastBeat = Date.parse(row.LastBeat ?? "") || 0;
      let detail = [];
      try { detail = row.Problems ? JSON.parse(row.Problems) : []; } catch { detail = []; }
      const problems = Array.isArray(detail) ? detail : (Array.isArray(detail.problems) ? detail.problems : []);
      const schedule = Array.isArray(detail.shift_slots) ? detail.shift_slots : [];
      const scheduledRole = schedule.length ? resolveRoleAtTime(new Date(now), schedule)?.role : null;
      const onShift = Boolean(row.ShiftId) && (detail.test_mode ? isDutyRole(row.Role) : (schedule.length ? isDutyRole(scheduledRole) : isDutyRole(row.Role) || !row.Role));
      const ageMs = lastBeat ? now - lastBeat : Infinity;
      const status = !onShift ? "off" : (ageMs > lostAfterMinutes * 60_000 ? "lost" : "alive");
      return {
        machine_id: row.MachineId,
        name: row.OperatorName ?? "",
        email: row.Email ?? "",
        // Test mode forces a role regardless of the clock, so the reported role wins over the schedule.
        role: detail.test_mode ? (row.Role ?? "") : (schedule.length ? (scheduledRole ?? ROLE.OFF) : (row.Role ?? "")),
        on_shift: onShift,
        ready: row.Ready === "1",
        problems,
        shift_slots: schedule,
        test_mode: Boolean(detail.test_mode),
        last_beat: lastBeat || null,
        status,
      };
    });
}

// Local sleep/offline gaps from our own tick log.
export function findGaps(ticks = [], { maxGapMs = 3 * 60_000 } = {}) {
  const sorted = [...ticks].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < sorted.length; i += 1) if (sorted[i] - sorted[i - 1] > maxGapMs) gaps.push({ from: sorted[i - 1], to: sorted[i] });
  return gaps;
}

export function wasOfflineAt(ticks, at, options) {
  const time = Number(at);
  return findGaps(ticks, options).some((gap) => time > gap.from && time < gap.to);
}
