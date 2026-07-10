import { ROLE } from "./constants.js";

export function backupShouldWake(alert, session, backupDelaySeconds, { escalated = false, now = Date.now() } = {}) {
  if (!session) return false;
  if (session.role === ROLE.PRIMARY || escalated) return true;
  const detected = new Date(alert?.detected_at).getTime();
  return Number.isFinite(detected) && now - detected >= backupDelaySeconds * 1000;
}

export function shouldTriggerEscalation(session) {
  return session?.role === ROLE.PRIMARY;
}

