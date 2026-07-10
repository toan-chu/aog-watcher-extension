# AOG Watcher v4 -- Round 5 Report Fixes Audit

**Date:** 2026-06-23 12:01  
**Owner:** Codex  
**Spec:** `docs/20260623_aog-watcher-v4-round5-report-fixes.md`  
**Status:** DONE -- ready for Claude review before user enables production.

---

## Scope executed

### Issue J -- ACK/PEER_HANDLED/MISSED report context

**Root cause confirmed:** `lib/state_machine.js` logged ACK, PEER_HANDLED, and MISSED with only `alert_id`, `source`, and `handled_by`, so Analytics XLSX "Alert Detail" rows lost the original alert context.

**Fix chosen:** Added `alertContext(alert)` helper and used it for ACK, PEER_HANDLED, and MISSED log effects. The log payload now carries:

- `alert_id`
- `source`
- `group_name`
- `sender`
- `subject`
- `handled_by`

**Regression tests:** Added state-machine tests for all three events and report-generator test for ACK detail row context.

### Issue K -- Popup UTC time

**Root cause confirmed:** `popup.js` displayed recent event time by slicing raw ISO timestamp with `.slice(11, 19)`, which shows UTC.

**Fix chosen:** Added `localTime(timestamp)` using `toLocaleTimeString("vi-VN", { hour12: false })`. Recent event rows now show local/Vietnam time.

**Regression tests:** Static test asserts `toLocaleTimeString("vi-VN")` is used and `.slice(11, 19)` is absent.

### Issue L -- Report metadata and snapshot context

**Root cause confirmed:** Open shift durations are snapshot-based, so exporting CSV and XLSX at different moments can show different `duration_hours` without explaining generation time.

**Fix chosen:**

- HR CSV now starts with metadata comment lines:
  - `# AOG Watcher payroll report`
  - `# Generated at: ...+07:00`
  - `# Open shifts use snapshot duration at generation time.`
- Analytics XLSX now has first sheet `Report Info` with generated time, date range, total events, total shifts, open shifts, and snapshot note.
- Settings export filenames now include from/to/generated timestamp:
  - `aog-hr-payroll-YYYYMMDD-YYYYMMDD-YYYYMMDDhhmm.csv`
  - `aog-analytics-YYYYMMDD-YYYYMMDD-YYYYMMDDhhmm.xlsx`
- Blank report date range defaults to current Vietnam month.

**Regression tests:** Added tests for CSV metadata/header order, XLSX sheet order and Report Info values, filename generation, and Settings static UX.

---

## Polish applied

- HR CSV:
  - UTF-8 BOM preserved.
  - Date columns use Vietnam local datetime string.
  - `duration_hours` formatted to 2 decimals.
  - `avg_response_time_seconds` formatted to 1 decimal.
- Analytics XLSX:
  - Header style object: bold + light gray fill.
  - Freeze pane metadata via worksheet `!freeze`.
  - Sensible column widths via `!cols`.
  - Number formats for duration/response columns.
  - Timestamp fields rendered as Vietnam local strings, not raw UTC `Z`.
  - Missed shift rows get static light-red row fill fallback.
  - Hour Heatmap positive cells get static light-blue fill fallback.
- Popup:
  - Recent events color-coded: ACK/PEER_HANDLED green, MISSED red, DRY_RUN yellow, neutral otherwise.
  - Recent event context truncates at 35 chars and uses `title` tooltip for full text.
- Settings:
  - Helper text: "From/To default to current month if blank."
  - Export buttons disable during generation and show busy label/spinner marker.
  - Status confirms saved filename plus shift/event counts.

---

## Known limitation / fallback

SheetJS Community does not reliably preserve Excel conditional formatting/data bars through the simple worksheet object API. I did not add raw OOXML conditional-format injection in this round because Claude explicitly allowed a fallback. Implemented fallback:

- Static light-red fill for Shift Summary rows where `alerts_missed > 0`.
- Static light-blue fill for Hour Heatmap `alert_count > 0` cells.

This keeps the workbook readable without adding another dependency or spending time on brittle OOXML manipulation.

---

## Files changed

- `lib/state_machine.js`
- `lib/report_generator.js`
- `popup.js`
- `popup.css`
- `settings.js`
- `settings.html`
- `settings.css`
- `tests/state_machine.test.js`
- `tests/report_generator.test.js`
- `tests/popup_static.test.js`
- `tests/settings_static.test.js`
- `handoff/todo.md`
- `handoff/audit.md`
- `log/history.md`
- `docs/20260623_aog-watcher-v4-round5-audit.md`

---

## Verification

- Narrow Round 5 tests: `npm.cmd test -- tests/state_machine.test.js tests/report_generator.test.js tests/popup_static.test.js`
  - Pass: 30/30
- Settings/report/popup focused tests:
  - Pass: 14/14
- Full project check: `npm.cmd run check`
  - MV3 check passed: 14 referenced files.
  - Vitest passed: 23 files / 111 tests.
- Syntax check: `node --check` for all non-vendor `.js` files.
  - Pass.
- Production audit: `npm.cmd audit --omit=dev`
  - Pass: 0 vulnerabilities.
- Export smoke:
  - `writeAnalyticsXlsx(...)` produced a non-empty XLSX array buffer.
  - `generateHrPayrollCsv(...)` produced metadata comments followed by the table header.

---

## Manual test status

Manual test steps 1-18 from the Round 5 spec are still pending in the user's Edge/Excel environment. Do not treat this as production-enabled until Claude reviews and the user completes the live checklist.
