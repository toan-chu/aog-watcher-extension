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
      result[source] = { status: SOURCE_STATUS.MISSING, message: `${label} tab not found (the tab is closed, not signed in, or needs reloading after an extension update)` };
      continue;
    }
    if (source === "outlook" && stats.folder_gate === "blocked") {
      nextZero[source] = null;
      result[source] = { status: SOURCE_STATUS.WRONG_FOLDER, message: "Outlook is not in the AOG mailbox — open the correct AOG mailbox" };
      continue;
    }
    const rows = Number(stats.rows_seen) || 0;
    if (rows > 0) {
      nextZero[source] = null;
      result[source] = { status: SOURCE_STATUS.OK, message: `${label} is being watched` };
      continue;
    }
    const since = Number(nextZero[source]) || now;
    nextZero[source] = since;
    if (now - since >= rules.blind_after_ms) {
      result[source] = { status: SOURCE_STATUS.BLIND, message: `Cannot read ${label} — its interface may have changed. Watcher is BLIND to this source.` };
    } else {
      result[source] = { status: SOURCE_STATUS.OK, message: `${label}: no rows found yet; monitoring continues` };
    }
  }
  return { sources: result, zeroSince: nextZero };
}

export function problemsOf(evaluation) {
  return Object.entries(evaluation?.sources ?? {}).filter(([, value]) => value.status !== SOURCE_STATUS.OK).map(([source, value]) => ({ source, ...value }));
}
