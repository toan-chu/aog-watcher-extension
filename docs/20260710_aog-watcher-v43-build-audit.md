# AOG Watcher v4.3 -- Field Feedback Fixes Audit

**Date:** 2026-07-10 11:26  
**Owner:** Codex  
**Spec:** `docs/20260710_aog-watcher-v43-blueprint.md`  
**Status:** DONE -- ready for Claude review before user pushes/publicizes.

---

## Scope executed

### WS1 -- Shift baseline

- Added `STORAGE_KEYS.SHIFT_BASELINE`.
- Added `BASELINE_SYNC` and `REBASELINE` handshake.
- Service worker creates one baseline per `shift_id`, reuses it across tab reload, and clears it on End Shift.
- WhatsApp seeds `lastUnreadByGroup` from baseline and suppresses first-seen unread rows.
- Outlook seeds `seen` IDs from baseline and suppresses pre-baseline unread rows.

Accepted trade-off: unread mail/messages present before Start shift are baseline and do not alert. This matches the field rule that the shift begins at Start shift.

### WS2 -- Outlook folder gate and filters

- Added `outlook_watch_path` config with substring match on `location.pathname`.
- Outlook content script blocks scan/alert when path does not match and reports `folder_gate: blocked` in diagnostics.
- Added Vietnamese unread label support for Outlook.
- Added `sender_whitelist`.
- Expanded blacklist matching so display names containing a blocked domain are skipped without confusing email suffixes like `nottrustana.vn`.

### WS3 -- Diagnostics visibility

- WhatsApp and Outlook content scripts report per-scan stats: rows seen, unread seen, alerts sent, baseline suppression, gate suppression, last scan time.
- `lib/source_health.js` persists stats in source health.
- Popup adds a collapsible Diagnostics panel with gate/filter/unread hints.

### WS4 -- Idle-gated wake

- Added manifest permission `idle`.
- `START_WAKE` now queries Chrome idle state.
- Idle/locked: play wake audio and notification.
- Active + same active WhatsApp conversation: suppress wake/notification and log `WAKE_SUPPRESSED_FOCUSED`.
- Active + other alert: notification only, set `pending_wake`, log `WAKE_DEFERRED_ACTIVE`.
- `chrome.idle.onStateChanged` plays deferred audio when the machine becomes idle/locked and the alert is still active.
- Escalation timers are unchanged.

### WS5 -- Gentle audio loop

- Added `assets/audio/gentle_loop.wav`.
- Added `wake_audio_mode` config, default `gentle`.
- Offscreen audio supports gentle loop with volume ramp and preserves old escalating beep mode.
- Settings adds wake audio mode, idle threshold, and preview button.

### WS6 -- End Shift UX

- Moved End Shift next to Start Shift.
- Replaced `window.confirm()` with inline two-click confirmation and 5-second timeout.
- End Shift success copy now says monitoring has ended on this machine.

---

## Files changed

- Runtime/content: `service_worker.js`, `content_whatsapp.js`, `content_outlook.js`, `offscreen.js`, `manifest.json`
- Libraries: `lib/constants.js`, `lib/storage.js`, `lib/source_health.js`, `lib/filter.js`, `lib/outlook_selectors.js`, `lib/runtime_state.js`, `lib/event_log.js`
- UI: `popup.html`, `popup.js`, `popup.css`, `settings.html`, `settings.js`, `settings.css`
- Assets/tools: `assets/audio/gentle_loop.wav`, `tools/generate_assets.mjs`
- Tests: `tests/v43_p0_field_feedback.test.js`, `tests/v43_p1_field_feedback.test.js`, plus focused updates to existing static/unit tests
- Docs/handoff: `docs/SOP.md`, `README.md`, `handoff/todo.md`, `handoff/audit.md`, `log/history.md`

---

## Verification

- `npm.cmd test`
  - Pass: 25 files / 131 tests.
  - Count = 111 existing tests + 20 v4.3 field-feedback regression tests.
- `node tools/check_extension.mjs`
  - Pass: MV3 check passed, 14 referenced files.
- `npm.cmd audit --omit=dev`
  - Pass: 0 vulnerabilities.

---

## Manual test status

Pending user/team environment:

- Connect at 23:00 with old unread mail/messages: no backlog alarm.
- New AOG mail/message after Start shift: alert.
- Mail in non-AOG Outlook folder: no alert and Diagnostics shows gate blocked.
- Vietnamese Outlook UI: unread rows counted.
- While active in the same customer WhatsApp chat: no wake.
- After leaving machine idle for 15s+ with alert pending: deferred audio plays.

---

## Known risks

- Chrome idle API minimum threshold is 15 seconds; 10 seconds is not available through `chrome.idle`.
- Active-user audio deferral can miss someone watching the screen but not noticing notifications. Escalation remains intact, so backup still wakes on schedule.
- Diagnostics is automated visibility, not a substitute for the real overnight manual run.
