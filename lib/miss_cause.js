// Exactly one cause per miss: Cài đặt / Máy / Người / Watcher.
export const MISS_CAUSE = Object.freeze({ SETUP: "Cài đặt", MACHINE: "Máy", PERSON: "Người", WATCHER: "Watcher" });

// kind: "missed" (alert rang to the end, nobody ACKed) | "leak" (operator reported a message the watcher never raised)
export function classifyMiss({ kind = "missed", shiftActive = true, sourceStatus = "ok", machineOffline = false, audioFailed = false, soundConfirmed = true } = {}) {
  if (kind === "leak") {
    if (!shiftActive) return { cause: MISS_CAUSE.SETUP, reason: "Chưa mở ca lúc tin đến" };
    if (machineOffline) return { cause: MISS_CAUSE.MACHINE, reason: "Máy ngủ / mất mạng / trình duyệt đóng lúc tin đến" };
    if (sourceStatus === "wrong_folder") return { cause: MISS_CAUSE.SETUP, reason: "Outlook không mở đúng hộp AOG" };
    if (sourceStatus === "missing") return { cause: MISS_CAUSE.SETUP, reason: "Tab nguồn không mở hoặc chưa tải lại" };
    if (sourceStatus === "blind") return { cause: MISS_CAUSE.WATCHER, reason: "Watcher không đọc được giao diện nguồn" };
    return { cause: MISS_CAUSE.WATCHER, reason: "Tin đến nhưng Watcher không phát hiện" };
  }
  if (audioFailed) return { cause: MISS_CAUSE.MACHINE, reason: "Không phát được âm thanh" };
  if (!soundConfirmed) return { cause: MISS_CAUSE.SETUP, reason: "Chưa xác nhận nghe rõ chuông thử trong ca" };
  return { cause: MISS_CAUSE.PERSON, reason: "Đã reo đủ thời gian nhưng không ai ACK" };
}
