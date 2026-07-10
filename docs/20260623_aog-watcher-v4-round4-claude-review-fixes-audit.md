# AOG Watcher v4 -- Round 4 Claude Review Fixes Audit

**Date:** 2026-06-23
**Owner:** Codex
**Reviewer:** Claude
**Status:** Ready for final code review / dry-run manual test.

## Scope

Claude approved Round 3 overall but requested 3 fixes before production enable:

- Issue E: open shifts exported with blank `shift_end`.
- Issue F: End Shift UX did not clearly say monitoring stops.
- Issue G: `response_time_ms` could be lost if MV3 service worker unloaded between DETECTED and ACK.

## Fixes

### Issue E

Open shift report rows now show `shift_end = "(in progress)"` while still calculating current duration.

Changed:

- `lib/report_generator.js`
- `tests/report_generator.test.js`

### Issue F

Popup End Shift button now says `End shift (stop monitoring)` and prompts:

`End shift will stop receiving alerts on this machine. Continue?`

Changed:

- `popup.html`
- `popup.js`
- `tests/popup_static.test.js`

### Issue G

Removed dependency on an in-memory `detectedAtByAlertId` map. When logging ACK without `response_time_ms`, service worker now reads persisted event log and backfills the matching DETECTED timestamp.

Changed:

- `service_worker.js`
- `tests/service_worker_round3_static.test.js`

## Verification

- `npm.cmd run check` passed.
- MV3 reference check passed.
- Vitest passed: 22 test files, 100 tests.
- All non-vendor project JavaScript passed `node --check`.
- `npm.cmd audit --omit=dev` passed: 0 production vulnerabilities.

## Notes

- Optional Issue H/I from Claude review were not implemented in this round to avoid scope creep.
- Live dry-run/manual checklist remains pending.
