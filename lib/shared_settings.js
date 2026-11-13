// Team-wide settings stored in the SharePoint list AOG_Settings, so a new operator only
// needs the SharePoint link. Personal fields (name, slots/role, test mode, dry-run,
// personal/ignored chats, Outlook watch path) are never shared. The watch path is per machine, as in 4.3.
import { SP_LISTS, clampFields } from "./sp_schema.js";
import { odataString } from "./sharepoint_client.js";

export const SHARED_KEYS = Object.freeze([
  "coord_group",
  "sender_whitelist",
  "skip_sender_domains",
  "subject_keywords",
  "primary_timeout_seconds",
  "backup_delay_seconds",
  "max_alert_duration_seconds",
  "idle_threshold_seconds",
  "wake_audio_mode",
  "unknown_chat_alert",
  "peer_lost_minutes",
  "blind_after_minutes",
  "log_keep_days",
]);

export function parseSettingsRows(rows = []) {
  const out = {};
  for (const row of rows) {
    const key = String(row.Title ?? "").trim();
    if (!SHARED_KEYS.includes(key)) continue;
    try { out[key] = JSON.parse(row.Value); } catch { out[key] = row.Value; }
  }
  return out;
}

export function applySharedSettings(config = {}, shared = {}) {
  const next = { ...config };
  // A blank value is a real team choice (for example, "no keywords"), so it is applied too.
  for (const key of SHARED_KEYS) if (shared[key] !== undefined && shared[key] !== null) next[key] = shared[key];
  return next;
}

// Accepts what people actually paste: a full Outlook address or just its path.
// Returns { path } for a folder or mailbox path, or { error } for the address of a single message.
export function parseOutlookWatchPath(raw = "") {
  let value = String(raw ?? "").trim();
  if (!value) return { path: "" };
  if (/^https?:\/\//i.test(value)) {
    try { value = new URL(value).pathname; } catch { return { error: "That is not a valid Outlook address." }; }
  }
  value = decodeURIComponent(value);
  const segments = value.split("/").filter(Boolean);
  const looksLikeMessage = segments.includes("id") || segments.includes("deeplink") || segments.some((part) => part.length > 40 && /^AA[A-Za-z0-9%=+_-]+$/.test(part));
  if (looksLikeMessage) return { error: "That is the address of one email. Paste only the mailbox or folder part, for example /mail/aog@trustana.vn/, or leave it blank." };
  if (!value.startsWith("/")) value = `/${value}`;
  if (!value.endsWith("/")) value = `${value}/`;
  return { path: value };
}

export function changedKeys(before = {}, after = {}) {
  return SHARED_KEYS.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

export async function pullSharedSettings(client) {
  const rows = await client.items(SP_LISTS.SETTINGS, { select: ["Id", "Title", "Value"], orderby: "Id asc", top: 200 });
  return parseSettingsRows(rows);
}

export async function publishSharedSettings(client, config, { by = "", keys = SHARED_KEYS } = {}) {
  const rows = await client.items(SP_LISTS.SETTINGS, { select: ["Id", "Title"], orderby: "Id asc", top: 200 });
  const byKey = new Map(rows.map((row) => [row.Title, row.Id]));
  let written = 0;
  for (const key of SHARED_KEYS) {
    if (!keys.includes(key) || config[key] === undefined) continue;
    const fields = clampFields(SP_LISTS.SETTINGS, { Title: key, Value: JSON.stringify(config[key]), UpdatedBy: by });
    if (byKey.has(key)) await client.updateItem(SP_LISTS.SETTINGS, byKey.get(key), fields);
    else await client.addItem(SP_LISTS.SETTINGS, fields);
    written += 1;
  }
  return written;
}

export { odataString };
