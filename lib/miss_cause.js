// Exactly one cause per miss: Setup / Machine / Person / Watcher.
export const MISS_CAUSE = Object.freeze({ SETUP: "Setup", MACHINE: "Machine", PERSON: "Person", WATCHER: "Watcher" });

// kind: "missed" (alert rang to the end, nobody accepted it) | "leak" (operator reported a message the watcher never raised)
export function classifyMiss({ kind = "missed", shiftActive = true, sourceStatus = "ok", machineOffline = false, audioFailed = false, soundConfirmed = true } = {}) {
  if (kind === "leak") {
    if (!shiftActive) return { cause: MISS_CAUSE.SETUP, reason: "The shift was not open when the message arrived" };
    if (machineOffline) return { cause: MISS_CAUSE.MACHINE, reason: "The machine was offline or the browser was closed when the message arrived" };
    if (sourceStatus === "wrong_folder") return { cause: MISS_CAUSE.SETUP, reason: "Outlook was not open in the correct AOG mailbox" };
    if (sourceStatus === "missing") return { cause: MISS_CAUSE.SETUP, reason: "The source tab was not open or had not been reloaded" };
    if (sourceStatus === "blind") return { cause: MISS_CAUSE.WATCHER, reason: "Watcher could not read the source interface" };
    return { cause: MISS_CAUSE.WATCHER, reason: "The message arrived but Watcher did not detect it" };
  }
  if (audioFailed) return { cause: MISS_CAUSE.MACHINE, reason: "The machine could not play audio" };
  if (!soundConfirmed) return { cause: MISS_CAUSE.SETUP, reason: "The test ring was not confirmed audible during the shift" };
  return { cause: MISS_CAUSE.PERSON, reason: "The alert rang for the full period but nobody accepted it" };
}
