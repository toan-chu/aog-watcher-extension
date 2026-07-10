import { ALERT_STATUS, APP_STATE, HANDLED_BY, ROLE } from "./constants.js";
import { AlertQueue } from "./alert_queue.js";

export function createInitialState(session = null, queue = []) {
  return { app_state: APP_STATE.IDLE, current_alert: null, queue: new AlertQueue(queue), session };
}

function copyState(state) {
  return { ...state, current_alert: state.current_alert ? { ...state.current_alert } : null, queue: state.queue instanceof AlertQueue ? state.queue.clone() : new AlertQueue(state.queue ?? []) };
}

function log(event_type, payload = {}) { return { type: "APPEND_EVENT_LOG", payload: { event_type, ...payload } }; }
function cancelAlertTimers(alertId) { return ["primary_timeout", "backup_delay", "max_alert_duration"].map((name) => ({ type: "CANCEL_TIMER", name, alert_id: alertId })); }
function alertContext(alert) {
  return {
    alert_id: alert.alert_id,
    source: alert.source,
    group_name: alert.group_name,
    sender: alert.sender,
    subject: alert.subject,
  };
}

export function reduce(state, event) {
  const next = copyState(state);
  const effects = [];
  const session = next.session;

  switch (event.type) {
    case "ALERT_DETECTED": {
      const alert = event.payload.alert;
      if (next.queue.findById(alert.alert_id)) return { state, effects };
      next.queue.add(alert);
      effects.push(log("DETECTED", { ...alert, role: session?.role ?? null }));
      if (!event.payload.within_shift) {
        next.queue.mark(alert.alert_id, ALERT_STATUS.SKIPPED, "out_of_shift");
        effects.push(log("SKIPPED_OUT_OF_SHIFT", { alert_id: alert.alert_id, source: alert.source }));
      } else if (event.payload.peer_handled) {
        next.queue.mark(alert.alert_id, ALERT_STATUS.SKIPPED, "partner_handled_before_detection");
      } else if (session?.role === ROLE.PRIMARY && next.app_state === APP_STATE.IDLE) {
        startAlert(next, alert, effects, event.payload.timing, true);
      } else if (session?.role === ROLE.BACKUP) {
        effects.push({ type: "SCHEDULE_TIMER", name: "backup_delay", alert_id: alert.alert_id, delay_ms: event.payload.timing.backup_delay_seconds * 1000 });
      }
      return { state: next, effects };
    }

    case "ALERT_ACK": {
      if (next.app_state !== APP_STATE.ALERTING || !next.current_alert) return { state, effects };
      const alert = next.current_alert;
      next.queue.mark(alert.alert_id, ALERT_STATUS.HANDLED, "self_ack");
      next.app_state = APP_STATE.IDLE;
      next.current_alert = null;
      effects.push({ type: "STOP_WAKE" }, ...cancelAlertTimers(alert.alert_id));
      effects.push({ type: "SEND_PEER_TAG", tag: "HANDLED", alert });
      effects.push(log("ACK", { ...alertContext(alert), handled_by: HANDLED_BY.SELF }));
      effects.push({ type: "START_NEXT" });
      return { state: next, effects };
    }

    case "PEER_ESCALATED_RECEIVED": {
      if (session?.role !== ROLE.BACKUP || next.app_state !== APP_STATE.IDLE) return { state, effects };
      const alert = matchPeerAlert(next.queue, event.payload);
      if (!alert) return { state, effects: [log("PEER_ESCALATED_RECEIVED_NO_MATCH", { alert_id: event.payload.alert_id })] };
      startAlert(next, alert, effects, event.payload.timing, false);
      effects.push(log("PEER_ESCALATED_RECEIVED", { alert_id: alert.alert_id }));
      return { state: next, effects };
    }

    case "PEER_HANDLED_RECEIVED": {
      const alert = matchPeerAlert(next.queue, event.payload);
      if (!alert) return { state, effects: [log("PEER_HANDLED_RECEIVED_NO_MATCH", { alert_id: event.payload.alert_id })] };
      if (next.app_state === APP_STATE.ALERTING && next.current_alert?.alert_id === alert.alert_id) {
        next.queue.mark(alert.alert_id, ALERT_STATUS.HANDLED, "partner_handled");
        next.app_state = APP_STATE.IDLE;
        next.current_alert = null;
        effects.push({ type: "STOP_WAKE" }, ...cancelAlertTimers(alert.alert_id));
        effects.push(log("PEER_HANDLED", { ...alertContext(alert), handled_by: HANDLED_BY.PARTNER }));
        effects.push({ type: "START_NEXT" });
      } else {
        next.queue.mark(alert.alert_id, ALERT_STATUS.SKIPPED, "partner_handled");
        effects.push({ type: "CANCEL_TIMER", name: "backup_delay", alert_id: alert.alert_id });
        effects.push(log("PEER_HANDLED_RECEIVED", { alert_id: alert.alert_id }));
      }
      return { state: next, effects };
    }

    case "TIMER_PRIMARY_TIMEOUT": {
      if (session?.role === ROLE.PRIMARY && next.current_alert?.alert_id === event.payload.alert_id) {
        effects.push({ type: "SEND_PEER_TAG", tag: "ESCALATED", alert: next.current_alert });
        effects.push(log("PEER_ESCALATED_SENT", { alert_id: next.current_alert.alert_id }));
      }
      return { state: next, effects };
    }

    case "TIMER_BACKUP_DELAY": {
      if (session?.role !== ROLE.BACKUP || next.app_state !== APP_STATE.IDLE) return { state, effects };
      const alert = next.queue.findById(event.payload.alert_id);
      if (alert?.status === ALERT_STATUS.QUEUED) startAlert(next, alert, effects, event.payload.timing, false);
      return { state: next, effects };
    }

    case "TIMER_MAX_DURATION": {
      if (next.app_state !== APP_STATE.ALERTING || next.current_alert?.alert_id !== event.payload.alert_id) return { state, effects };
      const alert = next.current_alert;
      next.queue.mark(alert.alert_id, ALERT_STATUS.MISSED, "max_duration");
      next.app_state = APP_STATE.IDLE;
      next.current_alert = null;
      effects.push({ type: "STOP_WAKE" }, ...cancelAlertTimers(alert.alert_id));
      effects.push(log("MISSED", { ...alertContext(alert), handled_by: HANDLED_BY.MISSED }));
      effects.push({ type: "START_NEXT" });
      return { state: next, effects };
    }

    case "START_NEXT": {
      if (next.app_state !== APP_STATE.IDLE || session?.role !== ROLE.PRIMARY) return { state, effects };
      const alert = next.queue.nextPending();
      if (alert) startAlert(next, alert, effects, event.payload.timing, true);
      return { state: next, effects };
    }

    case "ROLE_CHANGED":
      next.session = { ...(session ?? {}), role: event.payload.role, started_at: new Date().toISOString() };
      effects.push(log("ROLE_CHANGED", { role: event.payload.role }));
      return { state: next, effects };
    default:
      return { state, effects };
  }
}

function startAlert(state, alert, effects, timing, schedulePrimaryTimeout) {
  state.app_state = APP_STATE.ALERTING;
  state.current_alert = { ...alert };
  state.queue.mark(alert.alert_id, ALERT_STATUS.ALERTING);
  effects.push({ type: "START_WAKE", alert });
  effects.push({ type: "SCHEDULE_TIMER", name: "max_alert_duration", alert_id: alert.alert_id, delay_ms: timing.max_alert_duration_seconds * 1000 });
  if (schedulePrimaryTimeout) effects.push({ type: "SCHEDULE_TIMER", name: "primary_timeout", alert_id: alert.alert_id, delay_ms: timing.primary_timeout_seconds * 1000 });
  effects.push(log("ALERTING", { alert_id: alert.alert_id, source: alert.source, role: state.session?.role ?? null }));
}

function matchPeerAlert(queue, payload) {
  return queue.findById(payload.alert_id) ?? (payload.source === "whatsapp" ? queue.findWhatsAppByTimestamp(payload.timestamp, 60) : null);
}
