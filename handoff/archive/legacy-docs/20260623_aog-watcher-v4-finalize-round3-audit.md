# AOG Watcher v4 -- Finalize Round 3 Audit

**Date:** 2026-06-23
**Owner:** Codex
**Spec:** `docs/20260623_aog-watcher-v4-finalize-round3.md`
**Status:** Ready for Claude review. Live production enable still requires manual P0/P1/P2 checklist.

## Summary

Round 3 implemented the production-readiness plan:

- P0: fixed WhatsApp peer-tag receive/send reliability issues.
- P1: added shift session tracking and HR/management report exports.
- P2: added diagnostic dry-run mode and popup visibility.

## P0 fixes

### Issue D -- `scanPeerTags` over-guarded

Removed the active-coord-conversation guard from `scanPeerTags()`. The function now only requires `config.coord_group` and scans current DOM messages. This prevents the previous failure where local wake would not stop if the user was not viewing the coord group when partner ACK tag arrived.

Regression coverage:

- `tests/whatsapp_content_static.test.js` verifies `scanPeerTags()` no longer references active conversation checks.

### Issue B -- `sendPeerTag` did not verify send result

Added `verifyMessageSent(text, 3000)` after send button click. If the exact peer tag does not appear in recent coord messages within 3 seconds, `sendPeerTag()` throws instead of silently reporting success.

Regression coverage:

- `tests/whatsapp_content_static.test.js` verifies verify-after-send wiring and error message.

## P1 reporting

### Shift sessions

Added shift session storage under `aog_shift_sessions`.

- `SET_ROLE` starts a new shift session.
- Existing open sessions are ended when a new one starts.
- Popup includes an End shift button.
- Event logs are enriched with `shift_id`, `operator_name`, `partner_name`, `shift_start`, `shift_end`, and `response_time_ms`.

### Reports

Added `lib/report_generator.js`.

Exports:

- HR payroll CSV with UTF-8 BOM.
- Analytics XLSX using vendored SheetJS browser bundle at `lib/vendor/xlsx.full.min.js`.

Analytics workbook sheets:

1. `Shift Summary`
2. `Alert Detail`
3. `Hour Heatmap`
4. `Group Sender Hot list`

Settings page now has date range inputs plus HR and Analytics export buttons.

## P2 dry-run mode

Added `DEFAULT_CONFIG.dry_run`.

When enabled:

- `START_WAKE` logs `DRY_RUN_WOULD_WAKE` and does not play audio or notification.
- `SEND_PEER_TAG` logs `DRY_RUN_WOULD_SEND_TAG` and does not send to WhatsApp.
- Detection and state machine still run.
- Popup shows `DRY-RUN` badge and recent events.

## Files changed

- `content_whatsapp.js`
- `service_worker.js`
- `settings.html`
- `settings.js`
- `popup.html`
- `popup.js`
- `popup.css`
- `lib/constants.js`
- `lib/storage.js`
- `lib/event_log.js`
- `lib/report_generator.js`
- `lib/vendor/xlsx.full.min.js`
- `tests/whatsapp_content_static.test.js`
- `tests/storage_shift_sessions.test.js`
- `tests/event_log_enrich.test.js`
- `tests/report_generator.test.js`
- `tests/service_worker_round3_static.test.js`
- `package.json`
- `package-lock.json`
- `handoff/todo.md`
- `handoff/audit.md`
- `log/history.md`

## Verification

- `npm.cmd run check` passed.
- MV3 reference check passed.
- Vitest passed: 21 test files, 97 tests.
- All non-vendor project JavaScript passed `node --check`.
- `npm.cmd audit --omit=dev` passed: 0 production vulnerabilities.

Note: `xlsx` is a devDependency only. Runtime uses the vendored browser bundle in `lib/vendor/`; production dependency audit remains clean.

## Manual checklist

Do not skip storage clean before testing.

P0:

1. Remove extension and load unpacked fresh.
2. Configure self/partner/customer groups/coord group.
3. Trigger alert while user is not viewing coord group.
4. Partner ACK tag should stop local wake when coord messages are visible in DOM.
5. ACK should produce exactly one coord tag and throw/log failure if message does not appear.

P1:

1. Confirm role to start shift session.
2. Trigger and ACK 2-3 dry-run/live alerts.
3. End shift.
4. Export HR payroll CSV and verify one row per shift.
5. Export analytics XLSX and verify 4 sheets.

P2:

1. Enable dry-run in Settings.
2. Trigger email/WhatsApp detection.
3. Verify no wake audio and no peer tag send.
4. Verify popup shows DRY-RUN and recent events include `DRY_RUN_WOULD_*`.

## Known risks / review asks

- Live DOM behavior still requires Claude/user review before production enable.
- `sendPeerTag` still uses `document.execCommand("insertText")`; verify-after-send prevents silent success but does not improve input reliability. If manual test shows desync, switch to clipboard/paste fallback.
- `response_time_ms` is currently derived from in-memory detected timestamps. If the service worker unloads between DETECTED and ACK, response time can be missing; a future hardening pass should backfill from event log.
- XLSX library is vendored from SheetJS devDependency. If supply-chain policy changes, replace with a tiny internal OOXML writer.
