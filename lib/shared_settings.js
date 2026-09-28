// Team-wide settings stored in the SharePoint list AOG_Settings, so a new operator only
// needs the SharePoint link. Personal fields (name, slots/role, test mode, dry-run,
// personal/ignored chats) are never shared.
import { SP_LISTS, clampFields } from "./sp_schema.js";
import { odataString } from "./sharepoint_client.js";

export const SHARED_KEYS = Object.freeze([
  "coord_group",
  "outlook_watch_path",
  "sender_whitelist",
  "skip_sender_domains",
  "subject_keywords",
  "primary_timeout_seconds",
  "backup_delay_seconds",
  "max_alert_duration_seconds",
  "idle_threshold_seconds",
  "wake_audio_mode",
  "unknown_chat_alert",
  "followup_enabled",
  "followup_after_minutes",
  "followup_answer_minutes",
  "peer_lost_minutes",
  "shift_reminder_grace_minutes",
  "blind_after_minutes",
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
  for (const key of SHARED_KEYS) if (shared[key] !== undefined && shared[key] !== null && shared[key] !== "") next[key] = shared[key];
  return next;
}

export function changedKeys(before = {}, after = {}) {
  return SHARED_KEYS.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

export async function pullSharedSettings(client) {
  const rows = await client.items(SP_LISTS.SETTINGS, { select: ["Id", "Title", "Value"], orderby: "Id asc", top: 200 });
  return parseSettingsRows(rows);
}

export async function publishSharedSettings(client, config, { by = "" } = {}) {
  const rows = await client.items(SP_LISTS.SETTINGS, { select: ["Id", "Title"], orderby: "Id asc", top: 200 });
  const byKey = new Map(rows.map((row) => [row.Title, row.Id]));
  let written = 0;
  for (const key of SHARED_KEYS) {
    if (config[key] === undefined) continue;
    const fields = clampFields(SP_LISTS.SETTINGS, { Title: key, Value: JSON.stringify(config[key]), UpdatedBy: by });
    if (byKey.has(key)) await client.updateItem(SP_LISTS.SETTINGS, byKey.get(key), fields);
    else await client.addItem(SP_LISTS.SETTINGS, fields);
    written += 1;
  }
  return written;
}

export { odataString };
