// Night roster from AOG_Shifts: each row is one person's watch window with full date and time,
// for example Start "2026-11-13 22:00", End "2026-11-14 02:30". Windows that touch each other form
// one night. Inside your own window you are Primary; elsewhere in the same night you are Backup;
// outside the night you are off duty and nothing rings.
import { ROLE } from "./constants.js";

const TOUCH_MS = 5 * 60_000;

// Accepts "2026-11-13 22:00", "2026-11-13T22:00", "2026-11-13 2:30", with optional seconds.
export function parseRosterTime(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2})[:h](\d{2})(?::\d{2})?$/i);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 24 || minute > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isFinite(date.getTime()) ? date : null;
}

const sameEmail = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

export function rosterWindows(rows = []) {
  return rows
    .map((row) => ({ id: row.Id ?? null, name: String(row.Title ?? "").trim(), email: String(row.Email ?? "").trim(), start: parseRosterTime(row.Start), end: parseRosterTime(row.End) }))
    .filter((item) => item.email && item.start && item.end && item.end > item.start)
    .sort((a, b) => a.start - b.start);
}

// Groups windows into nights: a window joins the previous night when it starts within 5 minutes of that night's end.
export function rosterNights(windows = []) {
  const nights = [];
  for (const window of windows) {
    const last = nights.at(-1);
    if (last && window.start.getTime() <= last.end.getTime() + TOUCH_MS) {
      last.windows.push(window);
      if (window.end > last.end) last.end = window.end;
    } else {
      nights.push({ start: window.start, end: window.end, windows: [window] });
    }
  }
  return nights;
}

// The night that matters for this account now: the one running now, else the next one that includes this account.
export function myNight(rows = [], email = "", now = new Date()) {
  const nights = rosterNights(rosterWindows(rows)).filter((night) => night.windows.some((window) => sameEmail(window.email, email)));
  return nights.find((night) => night.start <= now && now < night.end) ?? nights.find((night) => night.start > now) ?? null;
}

export function rosterRoleAt(night, email = "", now = new Date()) {
  if (!night || now < night.start || now >= night.end) return { role: ROLE.OFF, window: null };
  const mine = night.windows.find((window) => sameEmail(window.email, email) && window.start <= now && now < window.end);
  if (mine) return { role: ROLE.PRIMARY, window: mine };
  const covering = night.windows.find((window) => window.start <= now && now < window.end) ?? null;
  return { role: ROLE.BACKUP, window: covering };
}

// The name the roster uses for this account (first matching row of the night).
export function rosterName(night, email = "") {
  return night?.windows.find((window) => sameEmail(window.email, email))?.name ?? "";
}

// This account's own row in the night (its watch window). Payroll counts are written to it.
export function myWindow(night, email = "") {
  return night?.windows.find((window) => sameEmail(window.email, email)) ?? null;
}

// Plain data for storage and the popup.
export function serializeNight(night) {
  if (!night) return null;
  return {
    start: night.start.toISOString(),
    end: night.end.toISOString(),
    windows: night.windows.map((window) => ({ id: window.id ?? null, name: window.name, email: window.email, start: window.start.toISOString(), end: window.end.toISOString() })),
  };
}

export function hydrateNight(data) {
  if (!data?.windows?.length) return null;
  const windows = data.windows.map((window) => ({ ...window, start: new Date(window.start), end: new Date(window.end) }));
  return { start: new Date(data.start), end: new Date(data.end), windows };
}
