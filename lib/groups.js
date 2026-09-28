// Effective WhatsApp watch list = team groups (SharePoint) ∪ personal groups − ignored chats.

export function normalizeGroupName(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

export function uniqueNames(names = []) {
  const seen = new Set();
  const out = [];
  for (const name of names) {
    const clean = String(name ?? "").replace(/\s+/g, " ").trim();
    const key = normalizeGroupName(clean);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

export const CHAT_CLASS = Object.freeze({ TEAM: "team", PERSONAL: "personal", IGNORED: "ignored", COORD: "coord", UNKNOWN: "unknown" });

export function classifyChat(name, { team = [], personal = [], ignored = [], coord = "" } = {}) {
  const key = normalizeGroupName(name);
  if (!key) return null;
  if (coord && key === normalizeGroupName(coord)) return CHAT_CLASS.COORD;
  if (team.some((item) => normalizeGroupName(item) === key)) return CHAT_CLASS.TEAM;
  if (personal.some((item) => normalizeGroupName(item) === key)) return CHAT_CLASS.PERSONAL;
  if (ignored.some((item) => normalizeGroupName(item) === key)) return CHAT_CLASS.IGNORED;
  return CHAT_CLASS.UNKNOWN;
}

export function effectiveGroups({ team = [], personal = [], ignored = [], coord = "" } = {}) {
  const blocked = new Set([...ignored, coord].map(normalizeGroupName).filter(Boolean));
  return uniqueNames([...team, ...personal]).filter((name) => !blocked.has(normalizeGroupName(name)));
}

export function addName(list = [], name) {
  return uniqueNames([...list, name]);
}

export function removeName(list = [], name) {
  const key = normalizeGroupName(name);
  return (list ?? []).filter((item) => normalizeGroupName(item) !== key);
}
