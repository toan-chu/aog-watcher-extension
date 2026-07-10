import { ROLE } from "./constants.js";

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function minutes(value) {
  if (!TIME_PATTERN.test(value)) throw new TypeError(`Invalid time: ${value}`);
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function currentMinutes(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError("now must be a valid Date");
  return now.getHours() * 60 + now.getMinutes();
}

// A slot covers [start, end). For overnight slots (start > end) the window wraps midnight.
function slotContains(currentMin, startMin, endMin) {
  if (startMin === endMin) return true;
  return startMin < endMin ? currentMin >= startMin && currentMin < endMin : currentMin >= startMin || currentMin < endMin;
}

export function isWithinShift(now, shiftStart, shiftEnd) {
  return slotContains(currentMinutes(now), minutes(shiftStart), minutes(shiftEnd));
}

export function normalizeSlots(slots) {
  if (!Array.isArray(slots)) return [];
  return slots
    .filter((slot) => slot && TIME_PATTERN.test(slot.start) && TIME_PATTERN.test(slot.end) && (slot.role === ROLE.PRIMARY || slot.role === ROLE.BACKUP))
    .map((slot) => ({ start: slot.start, end: slot.end, role: slot.role }));
}

/**
 * Resolve which role is active at `now` based on the configured slots.
 * Returns { role, slot_index, slot } when a slot matches, else null.
 * Slots are evaluated in order; first match wins so users can override with earlier rows.
 */
export function resolveRoleAtTime(now, slots) {
  const normalized = normalizeSlots(slots);
  if (normalized.length === 0) return null;
  const current = currentMinutes(now);
  for (let index = 0; index < normalized.length; index += 1) {
    const slot = normalized[index];
    if (slotContains(current, minutes(slot.start), minutes(slot.end))) {
      return { role: slot.role, slot_index: index, slot };
    }
  }
  return null;
}

/**
 * Returns true when `now` is covered by any slot (regardless of role).
 */
export function isWithinAnySlot(now, slots) {
  return resolveRoleAtTime(now, slots) !== null;
}
