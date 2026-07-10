export const HEALTH_TIMEOUT_MS = 60_000;
export const HEALTH_SOURCES = Object.freeze(["whatsapp", "outlook"]);

export function markSourceSeen(records, source, now = Date.now(), stats = null) {
  if (!HEALTH_SOURCES.includes(source)) return { ...records };
  return { ...records, [source]: { connected: true, last_seen: now, stats: stats ?? records?.[source]?.stats ?? null } };
}

export function markAlertSourceSeen(records, alert, now = Date.now()) {
  const source = alert?.source === "email" ? "outlook" : alert?.source;
  return markSourceSeen(records, source, now);
}

export function deriveHealth(records = {}, now = Date.now(), timeoutMs = HEALTH_TIMEOUT_MS) {
  return Object.fromEntries(HEALTH_SOURCES.map((source) => {
    const lastSeen = Number(records[source]?.last_seen) || 0;
    return [source, { connected: lastSeen > 0 && now - lastSeen < timeoutMs, last_seen: lastSeen || null, stats: records[source]?.stats ?? null }];
  }));
}
