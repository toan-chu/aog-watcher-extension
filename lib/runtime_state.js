import { APP_STATE } from "./constants.js";
import { createInitialState } from "./state_machine.js";

export function hydrateRuntimeState(stored, session) {
  if (!stored) return createInitialState(session);
  return {
    ...createInitialState(session),
    app_state: stored.app_state ?? APP_STATE.IDLE,
    current_alert: stored.current_alert ?? null,
  };
}

export function serializeRuntimeState(state) {
  return {
    app_state: state.app_state,
    current_alert: state.current_alert,
  };
}
