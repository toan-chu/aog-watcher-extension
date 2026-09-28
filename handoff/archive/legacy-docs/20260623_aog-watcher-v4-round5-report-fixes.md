# AOG Watcher v4 — Round 5 Report Fixes

**Date:** 2026-06-23
**Owner:** Codex
**Reviewer:** Claude (verified live HR CSV + Analytics XLSX exports)
**Status:** READY FOR CODEX. Final round before production enable.

---

## Context

Round 4 fixes verified. Live dry-run test pass:
- Detection, state machine, dry-run guard, peer dispatch, timer escalation → all working.
- HR CSV exports correctly (1 row, `(in progress)` duration, math correct).
- Analytics XLSX 4 sheets present.

Claude reviewed actual exported files. 3 issues found, 1 critical.

---

## Issue J (Critical for management report) — ACK rows missing context fields

**Symptom:**

In Analytics XLSX sheet "Alert Detail", ACK rows have empty `group_name`, `sender`, `subject`:

```
timestamp                    | source   | group   | sender    | subject | handled_by | response_time
2026-06-23T04:36:00.431Z     | whatsapp | AOG test| (none)    | (none)  | (none)     | (none)       ← DETECTED row OK
2026-06-23T04:36:07.745Z     | whatsapp | (none)  | (none)    | (none)  | self       | 7.3          ← ACK row, context lost
2026-06-23T04:36:51.056Z     | email    | (none)  | Toan Chu  | aog     | (none)     | (none)       ← DETECTED row OK
2026-06-23T04:39:48.412Z     | email    | (none)  | (none)    | (none)  | self       | 177.4        ← ACK row, context lost
```

Management reading the workbook to see "which AOG email/group was ACKed" sees blank cells. Critical context lost for the report.

**Root cause:**

`lib/state_machine.js` reducer emits log events with limited payload. Affected events: `ACK`, `PEER_HANDLED`, `MISSED`.

Current (line 47, 69, 101 — verify exact line numbers):

```js
effects.push(log("ACK", { alert_id: alert.alert_id, source: alert.source, handled_by: HANDLED_BY.SELF }));
effects.push(log("PEER_HANDLED", { alert_id: alert.alert_id, source: alert.source, handled_by: HANDLED_BY.PARTNER }));
effects.push(log("MISSED", { alert_id: alert.alert_id, source: alert.source, handled_by: HANDLED_BY.MISSED }));
```

Only carries `alert_id` + `source` + `handled_by`. Loses `group_name`, `sender`, `subject` from the `alert` object available in scope.

**Fix:**

Carry full context fields. Add helper to avoid repetition:

```js
function alertContext(alert) {
  return {
    alert_id: alert.alert_id,
    source: alert.source,
    group_name: alert.group_name,
    sender: alert.sender,
    subject: alert.subject,
  };
}
```

Then:
```js
effects.push(log("ACK", { ...alertContext(alert), handled_by: HANDLED_BY.SELF }));
effects.push(log("PEER_HANDLED", { ...alertContext(alert), handled_by: HANDLED_BY.PARTNER }));
effects.push(log("MISSED", { ...alertContext(alert), handled_by: HANDLED_BY.MISSED }));
```

**Apply to all 3 events.** Also check `DRY_RUN_WOULD_*` events in service worker — currently service_worker.js line ~129 + 154 already carry `group_name/sender/subject`, no change needed.

**Tests:**

- `tests/state_machine.test.js`: assert `reduce` with USER_ACK emits `ACK` event payload containing `group_name`, `sender`, `subject` from the alert.
- Same for `PEER_HANDLED_RECEIVED` → emits `PEER_HANDLED` with full context.
- Same for `TIMER_MAX_DURATION` → emits `MISSED` with full context.
- `tests/report_generator.test.js`: snapshot test `alertDetailRows` shows ACK row with `group_name="AOG test"`, `sender="Toan Chu"`, etc.

---

## Issue K (Low cosmetic) — Popup recent events show UTC time

**Symptom:**

Popup "Recent events" list shows `04:36:07 ACK · whatsapp` — that's UTC. User in Vietnam (UTC+7) sees this and thinks the event happened at 04:36 AM local time. Actually it was 11:36 AM Vietnam time.

**Root cause:**

`popup.js` line 30:
```js
item.textContent = `${String(event.timestamp ?? "").slice(11, 19)} ${event.event_type}${event.source ? ` · ${event.source}` : ""}`;
```

`timestamp.slice(11, 19)` extracts raw UTC `HH:MM:SS` from ISO string without converting to local timezone.

**Fix:**

```js
const time = new Date(event.timestamp).toLocaleTimeString("vi-VN", { hour12: false });
item.textContent = `${time} ${event.event_type}${event.source ? ` · ${event.source}` : ""}`;
```

Note: Analytics XLSX `Hour Heatmap` already uses `date.getHours()` which returns local time → already correct, no change needed. Only the popup display layer needs the timezone fix.

**Tests:**

- `tests/popup_static.test.js`: assert popup.js uses `toLocaleTimeString` (or equivalent local conversion), not raw `.slice(11, 19)`.

---

## Issue L (Cosmetic — must fix per user request) — duration_hours inconsistent between exports

**Symptom:**

User exported HR CSV then exported Analytics XLSX 36 seconds later. CSV row shows `duration_hours=0.08`, XLSX shows `0.09`. Same shift, different number. Confusing when management compares the two files.

**Root cause:**

Shift is `(in progress)` — `hoursBetween()` uses current clock as fallback when `ended_at` is null. Each export reads the clock at its own moment.

**Fix:**

Add a generation timestamp visible in both exports so reader knows the snapshot context.

**HR CSV** — prepend metadata header before column header:
```csv
# AOG Watcher payroll report
# Generated at: 2026-06-23T11:40:25+07:00
# Open shifts use snapshot duration at generation time.
shift_id,operator,partner,role,...
```

**Analytics XLSX** — add a 5th sheet "Report Info" with:
- Row 1: `Generated at` | ISO timestamp
- Row 2: `Date range` | from–to
- Row 3: `Total events` | N
- Row 4: `Total shifts` | N
- Row 5: `Open shifts` | N (use `(in progress)` snapshot)
- Row 6: `Note` | "Open shifts use snapshot duration computed at generation time."

Place "Report Info" as the **first** sheet so reader sees context first.

**UX polish (bundle):**

While touching the export code, also:

1. **Filename includes timestamp** — current `aog-hr-payroll-allall.csv` is ambiguous (which day was this generated?). Change to `aog-hr-payroll-{from}-{to}-{YYYYMMDDhhmm}.csv` and same pattern for XLSX.

2. **Date range default** — Settings export form: if user leaves date inputs blank, default to current month (`from = 1st of month`, `to = today`). Avoid the literal string `"all"` in filename.

3. **Number formatting in XLSX** — `duration_hours` and `avg_response_time_seconds` columns should have number format (currently they may render as text in Excel depending on cell type). Use SheetJS `cellNF` or set column type explicitly.

**Tests:**

- `tests/report_generator.test.js`: assert HR CSV first non-empty non-comment line is the column header; metadata rows present.
- Assert XLSX workbook has 5 sheets in order: Report Info → Shift Summary → Alert Detail → Hour Heatmap → Group Sender Hot list.
- Assert "Report Info" sheet contains `Generated at` cell.
- Assert filename helper produces `aog-hr-payroll-202606-20260623-1140.csv` for from=2026-06-01, to=2026-06-23, generated at 11:40.

---

## Files Codex changes

- `lib/state_machine.js` — Issue J: add `alertContext` helper, apply to ACK / PEER_HANDLED / MISSED log calls.
- `popup.js` — Issue K: use `toLocaleTimeString` for recent events display.
- `lib/report_generator.js` — Issue L: add CSV metadata header + "Report Info" sheet + number formatting.
- `settings.js` — Issue L: filename with timestamp, default date range to current month, generation timestamp passed to generator.
- `settings.html` — Issue L: helper text `From/To default to current month if blank`.
- `tests/state_machine.test.js` — regression Issue J.
- `tests/report_generator.test.js` — regression Issue J + L.
- `tests/popup_static.test.js` — regression Issue K.

---

## Polish (apply globally while in Round 5)

User feedback: "muốn đẹp và dễ đọc một chút". Apply consistently across all export surfaces:

### A. Analytics XLSX styling

- **Header row** — bold, background color (light gray `#F2F2F2`), freeze pane row 1.
- **Column widths** — auto-fit or set sensible defaults (timestamp 22, shift_id 28, source 10, sender 28, subject 40, etc.).
- **Number format** — `duration_hours` → `0.00`. `avg_response_time_seconds` → `0.0`. `alert_count` → `0`.
- **Date format** — timestamp columns formatted as `YYYY-MM-DD HH:MM:SS` Vietnam timezone, not raw ISO with `Z`.
- **Conditional formatting** — `alerts_missed > 0` row in Shift Summary: light red background.
- **Hour Heatmap** — instead of plain table, apply data bars conditional formatting on `alert_count` column for visual heatmap effect.

### B. HR CSV polish

- UTF-8 BOM preserved (already done).
- Date columns in Vietnam local time (not raw UTC `Z` suffix).
- `duration_hours` formatted to 2 decimal places.
- `avg_response_time_seconds` formatted to 1 decimal place.

### C. Popup polish

- Recent events time: Vietnam local time (Issue K fix).
- Event type styled with color: ACK green, MISSED red, DETECTED neutral, DRY_RUN_* yellow.
- Truncate long subject/group with ellipsis at 35 chars + `title` attribute for full text on hover.

### D. Settings page polish

- Date range inputs: helper text "Defaults to current month if blank".
- Export buttons: show spinner during generation, disable to prevent double-click.
- Toast/inline status after export: "HR report saved: aog-hr-payroll-202606-... .csv (3 shifts, 12 events)".

---

## Verification

- `npm run test` pass. Count: 100 → 108+ (Issue J + K + L all add tests).
- `node --check` pass for changed files.
- MV3 check pass.
- `npm audit --omit=dev` pass.
- SheetJS styling APIs (cell format, column width, freeze pane, conditional formatting) verified working in browser context with vendored bundle.

---

## Manual test by user after fix

**Setup:**
1. Remove + Load unpacked fresh.
2. Setup Settings: name, partner, customer groups, coord group, shift hours.
3. Enable dry-run.
4. Confirm role Primary.

**Trigger:**
5. Trigger 2 alerts (1 WhatsApp + 1 email AOG test).
6. ACK both alerts.

**Verify Issue J:**
7. Settings → Export Analytics XLSX → open in Excel.
8. Sheet "Alert Detail" → ACK rows must show `group_name`, `sender`, `subject` (not blank).

**Verify Issue K:**
9. Popup "Recent events" → time stamps match local Vietnam time (compare with computer clock).

**Verify Issue L + polish:**
10. Export HR CSV → filename has format `aog-hr-payroll-{from}-{to}-{timestamp}.csv`.
11. Open CSV → first 3 lines are metadata comments (`# AOG Watcher payroll...`, `# Generated at: ...`, `# Open shifts use snapshot...`). Then column header. Then data row.
12. Export Analytics XLSX → first sheet is "Report Info" with generation timestamp + range + counts.
13. Other 4 sheets: header row bold + gray background + freeze pane.
14. `duration_hours` shows `0.08` (2 decimals), `avg_response_time_seconds` shows `92.3` (1 decimal).
15. Shift Summary row with `alerts_missed > 0` (force one MISSED for test) → light red background.
16. Hour Heatmap → data bars visible in `alert_count` column.

**Verify Settings UX:**
17. Leave from/to blank → click Export HR → filename has current month range, not literal "all".
18. Click Export twice fast → second click does nothing (button disabled during first).

---

## Definition of Done

- [x] Issue J fixed (full context in ACK/PEER_HANDLED/MISSED log).
- [x] Issue K fixed (popup local time).
- [x] Issue L fixed (CSV metadata header + XLSX Report Info sheet + filename timestamp + default date range).
- [x] Polish applied (XLSX styling, color coding, number format, conditional formatting, spinner).
- [x] All regression tests pass (108+).
- [x] Manual test 1-18 pass.
- [x] Audit file `20260623_aog-watcher-v4-round5-audit.md` created with screenshots if possible.

After DoD → production enable. No Round 6 planned unless live test surfaces new issue.

---

## Notes for Codex

- SheetJS Community Edition (vendored at `lib/vendor/xlsx.full.min.js`) supports cell styling via `cell.s = { font: {bold: true}, fill: {...} }`. Verify your version. If Community Edition limits styling, fall back to `xlsx-js-style` library (CC-BY-NC, fine for internal use) — check license before adding.
- Conditional formatting in SheetJS Community is **not supported natively**. Workaround: write raw OOXML conditional formatting XML directly into the worksheet object (`!condfmt`), or use cell-level styling per row (less elegant but works).
- If conditional formatting (data bars + red row) is hard, **document as known limitation** in the audit and apply static color per row instead. Don't waste >2 hours on this single polish item.
- Filename pattern reference: `aog-hr-payroll-YYYYMMDD-YYYYMMDD-YYYYMMDDhhmm.csv` (from-to-generated). Use Vietnam timezone for the generated timestamp portion.
