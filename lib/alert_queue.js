import { ALERT_STATUS } from "./constants.js";

export class AlertQueue {
  constructor(items = []) {
    this.items = items.map((item) => ({ status: ALERT_STATUS.QUEUED, ...item }));
  }

  clone() { return new AlertQueue(this.items); }
  add(alert) {
    const existing = this.findById(alert.alert_id);
    if (existing) return existing;
    const item = { status: ALERT_STATUS.QUEUED, detected_at: new Date().toISOString(), ...alert };
    this.items.push(item);
    return item;
  }
  nextPending() { return this.items.find((item) => item.status === ALERT_STATUS.QUEUED) ?? null; }
  mark(alertId, status, reason = "") {
    const item = this.findById(alertId);
    if (item) Object.assign(item, { status, reason });
    return this;
  }
  findById(alertId) { return this.items.find((item) => item.alert_id === alertId) ?? null; }
  findWhatsAppByTimestamp(timestamp, windowSeconds) {
    const target = new Date(timestamp).getTime();
    if (!Number.isFinite(target)) return null;
    return this.items.find((item) => item.source === "whatsapp" && Math.abs(new Date(item.detected_at).getTime() - target) <= windowSeconds * 1000) ?? null;
  }
  all() { return this.items.map((item) => ({ ...item })); }
  countPending() { return this.items.filter((item) => item.status === ALERT_STATUS.QUEUED).length; }
  toJSON() { return this.all(); }
}
