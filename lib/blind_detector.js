// Decide whether each source is really being watched. "Green" must never be shown
// when the watcher cannot read the page.

export const SOURCE_STATUS = Object.freeze({ OK: "ok", MISSING: "missing", BLIND: "blind", WRONG_FOLDER: "wrong_folder", IDLE: "idle" });

export const DEFAULT_BLIND_RULES = Object.freeze({ missing_after_ms: 3 * 60_000, blind_after_ms: 5 * 60_000 });

const LABEL = { whatsapp: "WhatsApp", outlook: "Outlook" };

// records: { whatsapp: { last_seen, stats: { rows_seen, folder_gate, path } }, outlook: {...} }
// zeroSince: { whatsapp: ts|null, outlook: ts|null } → updated copy returned.
export function evaluateSources(records = {}, { now = Date.now(), zeroSince = {}, rules = DEFAULT_BLIND_RULES } = {}) {
  const nextZero = { ...zeroSince };
  const result = {};
  for (const source of ["whatsapp", "outlook"]) {
    const record = records[source] ?? {};
    const lastSeen = Number(record.last_seen) || 0;
    const stats = record.stats ?? {};
    const label = LABEL[source];
    if (!lastSeen || now - lastSeen > rules.missing_after_ms) {
      nextZero[source] = null;
      result[source] = { status: SOURCE_STATUS.MISSING, message: `Không thấy tab ${label} (tab đóng, chưa đăng nhập hoặc extension vừa cập nhật — tải lại tab)` };
      continue;
    }
    if (source === "outlook" && stats.folder_gate === "blocked") {
      nextZero[source] = null;
      result[source] = { status: SOURCE_STATUS.WRONG_FOLDER, message: "Outlook không ở hộp AOG — mở đúng hộp AOG" };
      continue;
    }
    const rows = Number(stats.rows_seen) || 0;
    if (rows > 0) {
      nextZero[source] = null;
      result[source] = { status: SOURCE_STATUS.OK, message: `${label} đang được canh` };
      continue;
    }
    const since = Number(nextZero[source]) || now;
    nextZero[source] = since;
    if (now - since >= rules.blind_after_ms) {
      result[source] = { status: SOURCE_STATUS.BLIND, message: `Không đọc được ${label} — giao diện có thể đã thay đổi. Watcher đang MÙ với nguồn này.` };
    } else {
      result[source] = { status: SOURCE_STATUS.OK, message: `${label}: chưa thấy dòng nào, đang theo dõi` };
    }
  }
  return { sources: result, zeroSince: nextZero };
}

export function problemsOf(evaluation) {
  return Object.entries(evaluation?.sources ?? {}).filter(([, value]) => value.status !== SOURCE_STATUS.OK).map(([source, value]) => ({ source, ...value }));
}
