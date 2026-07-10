import { PEER_TAG, TIMING } from "./constants.js";

const TYPE_TO_TAG = { ESCALATED: PEER_TAG.ESCALATED, HANDLED: PEER_TAG.HANDLED };
const TAG_TO_TYPE = { [PEER_TAG.ESCALATED]: "ESCALATED", [PEER_TAG.HANDLED]: "HANDLED" };

function encode(value) { return encodeURIComponent(String(value ?? "")); }
function decode(value) { try { return decodeURIComponent(value); } catch { return value; } }

export function serializeTag(type, payload) {
  const prefix = TYPE_TO_TAG[type];
  if (!prefix) throw new TypeError(`Unsupported peer tag type: ${type}`);
  for (const key of ["alert_id", "source", "timestamp", "from_role"]) {
    if (!payload?.[key]) throw new TypeError(`Missing peer tag field: ${key}`);
  }
  const preferred = ["alert_id", "source", "timestamp", "from_role", "operator", "group", "unread_count", "sender", "subject"];
  const fields = preferred.filter((key) => payload[key] !== undefined && payload[key] !== "").map((key) => `${key}=${encode(payload[key])}`);
  return `${prefix}|${fields.join("|")}`.slice(0, 500);
}

export function parseTag(text, { now = Date.now(), rejectStale = true } = {}) {
  if (typeof text !== "string" || text.length > 500) return null;
  const parts = text.trim().split("|");
  const tag = TAG_TO_TYPE[parts.shift()];
  if (!tag) return null;
  const payload = {};
  for (const part of parts) {
    const index = part.indexOf("=");
    if (index <= 0) return null;
    payload[part.slice(0, index)] = decode(part.slice(index + 1));
  }
  if (!["alert_id", "source", "timestamp", "from_role"].every((key) => payload[key])) return null;
  const timestamp = new Date(payload.timestamp).getTime();
  if (!Number.isFinite(timestamp)) return null;
  if (rejectStale && Math.abs(now - timestamp) > TIMING.PEER_STALE_SECONDS * 1000) return null;
  return { tag, payload };
}

export function isTagText(text) {
  return typeof text === "string" && (text.startsWith(PEER_TAG.ESCALATED) || text.startsWith(PEER_TAG.HANDLED));
}

