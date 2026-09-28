// Peer liveness from the AOG_Machines list.
export function evaluatePeers(rows = [], { selfId = "", now = Date.now(), lostAfterMinutes = 5 } = {}) {
  return rows
    .filter((row) => row.MachineId && row.MachineId !== selfId)
    .map((row) => {
      const lastBeat = Date.parse(row.LastBeat ?? "") || 0;
      const onShift = Boolean(row.ShiftId);
      const ageMs = lastBeat ? now - lastBeat : Infinity;
      const status = !onShift ? "off" : (ageMs > lostAfterMinutes * 60_000 ? "lost" : "alive");
      let problems = [];
      try { problems = row.Problems ? JSON.parse(row.Problems) : []; } catch { problems = []; }
      return {
        machine_id: row.MachineId,
        name: row.OperatorName ?? "",
        email: row.Email ?? "",
        role: row.Role ?? "",
        on_shift: onShift,
        ready: row.Ready === "1",
        problems: Array.isArray(problems) ? problems : [],
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
