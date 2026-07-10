# AOG Watcher v4 — Finalize Round 3 (Production-ready spec)

**Ngày:** 2026-06-23
**Owner:** Codex
**Reviewer:** Claude
**Trạng thái:** READY FOR CODEX. Mục tiêu: extension đủ tốt để dùng production + sinh báo cáo HR/management.

---

## Decision context (user chốt)

**Giữ extension v4.** Không drop sang native phone DND. Lý do user nêu:

1. **HR report tính lương trực đêm** — cần ghi nhận: ca trực, ai online, ai ACK alert, response time, miss count. Native phone không log được.
2. **Báo cáo tần suất AOG cho lãnh đạo** — KPI: số AOG/đêm, peak hour, sender/group nóng.

→ Extension v4 phải thành tool quản lý ca, không chỉ là wake alarm.

---

## Scope Round 3

3 nhóm việc, ưu tiên giảm dần:

**P0 — Fix 2 issue tồn từ Round 2 review:**
- Issue D: `scanPeerTags` bị guard sai → tag từ partner không đọc được. Critical.
- Issue B: `sendPeerTag` không verify-after-send → fail silent có thể xảy ra.

**P1 — HR/management reporting module:**
- Shift session tracking (start/end shift, ai online).
- Event log enrich đủ field để export báo cáo.
- Export module 2 dạng: HR payroll CSV + management analytics XLSX.

**P2 — Diagnostic dry-run mode:**
- Bật → không kêu, không gửi tag, chỉ log mọi event với label DRY_RUN.
- Test extension không cần spam group/phone.

---

## P0 — Fix issue tồn

### Issue D — `scanPeerTags` over-guarded

**Vị trí:** `content_whatsapp.js` line 51-53:
```js
function scanPeerTags() {
  if (!config?.coord_group) return;
  if (!isSameGroupName(activeConversationName(document, selectors), config.coord_group)) return;
```

**Vấn đề:** Codex Round 2 thêm guard "phải đang active coord group" cho cả `scanPeerTags`. Hậu quả: nếu user xem conversation khác → tag từ partner KHÔNG được đọc → A miss, B kêu xong, A không bao giờ stop wake (vì không nhận HANDLED).

**Fix:** Xóa dòng line 53 (check `isSameGroupName`). Giữ check `config?.coord_group` exists.

Lý do safe: DOM `#main` chỉ chứa message của conversation đang active. Nếu user xem customer group → `#main` không chứa message coord → `scanPeerTags` query DOM không thấy gì → no-op tự nhiên. Không cần guard.

**SOP user document:** "Trong ca trực, để conversation coord group là conversation đang mở trên WhatsApp Web. Mở customer group khi cần xem → quay lại coord group sau khi đọc xong." Ghi vào README + popup hint nếu coord group không active >30s.

**Bonus enhancement (optional):** Popup status panel hiển thị "Coord group: ACTIVE" hoặc "Coord group: NOT ACTIVE" (cần switch tab). Helper visual cho user.

### Issue B — `sendPeerTag` không verify-after-send

**Vị trí:** `content_whatsapp.js` line 96-104, sau `clickable.click()` không check message thực sự appeared.

**Vấn đề:** `document.execCommand("insertText")` deprecated, React controlled input có thể không sync state → send button vẫn fire click() nhưng không gửi. User tưởng đã gửi → peer không nhận → state desync.

**Fix:**
```js
async function sendPeerTag(text) {
  await refreshConfig();
  await openCoordGroup();
  await waitForCoordGroupActive();
  if (messageExistsInCoordGroup(text)) return true;

  const composer = first(document, selectors.composer);
  if (!composer) throw new Error("WhatsApp composer not found");
  composer.focus();
  document.execCommand("insertText", false, text);
  composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  await new Promise((resolve) => setTimeout(resolve, 100));

  const send = first(document, selectors.sendButton);
  const clickable = send?.closest("button") ?? send;
  if (!clickable) throw new Error("WhatsApp send button not found");
  clickable.click();

  // NEW: verify message actually appeared in coord group within 3s
  const verified = await verifyMessageSent(text, 3000);
  if (!verified) {
    throw new Error(`Peer tag sent click() succeeded but message did not appear in coord group within 3s. Possible React state desync.`);
  }
  return true;
}

async function verifyMessageSent(text, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (messageExistsInCoordGroup(text)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}
```

**Fallback nếu insertText fail thường xuyên:** chuyển sang clipboard paste:
```js
// Alternative implementation using clipboard
async function pastePeerTag(composer, text) {
  await navigator.clipboard.writeText(text);
  composer.focus();
  const pasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    clipboardData: new DataTransfer(),
  });
  pasteEvent.clipboardData.setData("text/plain", text);
  composer.dispatchEvent(pasteEvent);
}
```

Lý do clipboard paste tốt hơn: React/WhatsApp Web handle paste event chuẩn hơn insertText. Risk: cần permission `clipboardWrite` trong manifest.

**Codex implement insertText + verify trước. Nếu test 5 lần fail >1 lần → switch clipboard paste fallback.**

---

## P1 — HR/Management reporting module

### Data model — extend event log

Hiện tại event log schema (suy từ `appendEventLog`):
```js
{ timestamp, event_type, alert_id, source, role, handled_by, sender, subject, group_name, unread_count }
```

**Thêm fields:**
```js
{
  // existing fields giữ nguyên
  shift_id: string,        // ID ca trực, dạng "YYYY-MM-DD-shift-N" hoặc UUID
  operator_name: string,   // display_name của self lúc event xảy ra
  partner_name: string,    // display_name partner
  response_time_ms: number,// thời gian từ DETECTED tới ACK (chỉ event_type=ACK)
  shift_start: ISO string, // timestamp bắt đầu ca
  shift_end: ISO string,   // null nếu shift đang ON
}
```

### Shift session tracking

**Concept:** Mỗi lần user bật "Watching ON" hoặc Confirm Role → tạo `shift_session`. Khi user tắt "Watching OFF" hoặc đóng extension → kết thúc.

**Storage key mới:** `aog_shift_sessions: ShiftSession[]`
```js
{
  shift_id: string,
  operator_name: string,
  partner_name: string,
  role: "primary" | "backup",
  started_at: ISO,
  ended_at: ISO | null,
  config_snapshot: { customer_groups, coord_group, shift_start, shift_end },
}
```

**Lifecycle:**
- `SET_ROLE` message → tạo shift_session mới, set `state.session.shift_id`.
- Mọi event log đính kèm `shift_id` từ session.
- "End shift" button mới trong popup → set `ended_at = now()`, clear session.
- Auto-end shift sau 12 giờ inactive → tránh quên end.

### Report exports

**Module mới:** `lib/report_generator.js`

**Export 1 — HR Payroll CSV** (1 row mỗi shift):
```csv
shift_id,operator,partner,role,shift_start,shift_end,duration_hours,alerts_received,alerts_acked_by_self,alerts_missed,avg_response_time_seconds
2026-06-22-A-01,Toan,Sam,primary,2026-06-22T22:00:00+07,2026-06-23T03:00:00+07,5.0,8,7,1,42.3
```

**Export 2 — Management Analytics XLSX** (chi tiết):

Sheet 1 "Shift Summary": như HR CSV trên.

Sheet 2 "Alert Detail" (1 row mỗi alert):
```
timestamp,shift_id,operator,source,group_name,sender,subject,handled_by,response_time_seconds
```

Sheet 3 "Hour Heatmap":
```
hour_of_day,alert_count
00,3
01,5
...
```

Sheet 4 "Group/Sender Hot list":
```
group_name|sender,alert_count
Customer-AirlineX,12
Customer-AirlineY,8
ops@airline.com,5
```

**Popup UI:**
- Existing "Export today" button → giữ, export CSV ngày hôm nay (event log raw).
- Add 2 button mới:
  - "Export HR payroll (this month)" → download `aog-hr-payroll-YYYYMM.csv`.
  - "Export analytics (this month)" → download `aog-analytics-YYYYMM.xlsx`.

**XLSX library:** dùng SheetJS (xlsx) — pure JS, no native dep. Add tới `lib/xlsx_writer.js` hoặc inline CDN snippet. Codex pick approach gọn nhất.

### Date range picker (optional polish)

Popup không nhét fit. → Move export tới Settings page với date range picker (from/to). 3 button: HR, Analytics, Raw log.

---

## P2 — Diagnostic dry-run mode

### Config

Settings page checkbox: "Diagnostic dry-run mode (no alarm, no tag send)".
Lưu `config.dry_run: boolean`.

### Behavior

`service_worker.js executeEffect`:
- `START_WAKE`: nếu `config.dry_run` → log event `DRY_RUN_WOULD_WAKE`, không call offscreen audio, không notification.
- `SEND_PEER_TAG`: nếu `config.dry_run` → log event `DRY_RUN_WOULD_SEND_TAG` với payload đầy đủ, không call content script.

`content_whatsapp.js scanCustomerGroups`:
- Vẫn gửi `ALERT_DETECTED` để service worker log.

→ Dry-run vẫn track full pipeline detection + state machine, chỉ block 2 effect output cuối (audio + tag send).

### Popup display

Khi `config.dry_run = true`:
- Status badge thêm "🧪 DRY-RUN" màu vàng cảnh báo.
- Hiển thị panel mới "Last 5 dry-run events" với event_type + alert info.

### Use case

User bật dry-run → reload extension → mở popup → thấy detection chạy realtime. Có thể tweak Settings (customer_groups, coord_group) → kiểm filter logic chạy đúng → tắt dry-run → enable live.

---

## File changes summary cho Codex

| File | Thay đổi |
|---|---|
| `content_whatsapp.js` | Issue D fix (line 53 xóa), Issue B fix (thêm verify) |
| `service_worker.js` | Shift session tracking, dry-run effect handlers, enrich event log với shift_id+operator+response_time |
| `lib/constants.js` | Thêm `STORAGE_KEYS.SHIFT_SESSIONS`, `DEFAULT_CONFIG.dry_run = false` |
| `lib/storage.js` | CRUD shift sessions |
| `lib/report_generator.js` (mới) | HR CSV + Analytics XLSX generation |
| `lib/xlsx_writer.js` (mới hoặc inline) | SheetJS wrapper |
| `lib/shift_engine.js` | Helper `currentShiftId(now, config)` deterministic |
| `popup.html/js/css` | Dry-run badge + 2 export button + recent events panel |
| `settings.html/js/css` | Date range picker for exports + dry-run checkbox |
| `tests/` | Test shift session lifecycle, report generation snapshot, dry-run effect dispatch, scanPeerTags không bị guard active conv, sendPeerTag verify-after-send |

---

## Tests Codex viết

Vitest:

1. `scanPeerTags` đọc tag từ DOM bất kể `activeConversationName` (Issue D regression test).
2. `sendPeerTag` throw nếu sau click() message không appear trong 3s (Issue B regression test).
3. Shift session start/end lifecycle.
4. Event log có shift_id + operator_name khi có session active.
5. `report_generator.generateHrPayrollCsv(events, sessions)` snapshot test với 1 ca trực mock đủ event.
6. `report_generator.generateAnalyticsXlsx(events, sessions)` smoke test (verify 4 sheet tồn tại).
7. Dry-run mode: dispatch START_WAKE → không call audio + log DRY_RUN_WOULD_WAKE.
8. Dry-run mode: dispatch SEND_PEER_TAG → không call content script + log DRY_RUN_WOULD_SEND_TAG.
9. Response time calc: ACK event có `response_time_ms` từ DETECTED → ACK đúng.

Target: 85 → 95+ tests.

---

## Migration plan Codex execute

1. **Setup:** đọc audit này + 2 file Claude review (`20260623_aog-watcher-v4-runtime-fix-round2-audit.md` + handoff). Xem code current state.
2. **P0a — Issue D fix:** content_whatsapp.js line 53 xóa. Test viết. Pass.
3. **P0b — Issue B fix:** thêm `verifyMessageSent`. Test mock DOM. Pass.
4. **P1a — Shift session:** schema + storage CRUD + service_worker lifecycle wire. Test pass.
5. **P1b — Event log enrich:** shift_id + operator_name + response_time. Test pass.
6. **P1c — Report HR CSV:** generator + popup button. Test snapshot.
7. **P1d — Report Analytics XLSX:** SheetJS wrapper + generator + popup button. Test smoke.
8. **P2 — Dry-run mode:** config + Settings checkbox + executeEffect branch + popup badge. Test pass.
9. **Polish:** Settings date range picker, popup hint coord group not active.
10. **Verify:** `npm run test` pass, count target 95+. MV3 check pass. `npm audit` 0 vulnerabilities.
11. **Audit doc:** `docs/20260623_aog-watcher-v4-finalize-round3-audit.md` log: files changed, root cause Issue D/B confirmed, fix implementation, test count, manual test checklist, known risks.

---

## Manual test checklist (user) sau Codex xong

**Pre-test:**
- Remove extension → Load unpacked lại (clean storage).
- Setup Settings: display_name + partner + customer_groups + coord_group + shift hours.

**P0 verification:**

1. Bật extension. Confirm role Primary.
2. **Mở customer group** (KHÔNG mở coord group). 
3. Nhờ ai gửi tin vào customer group → kêu alert.
4. Mở phone (partner) → bấm ACK ở extension partner (giả lập partner ACK).
5. Cậu confirm: extension cậu **stop wake** trong 3-5s (nhận HANDLED qua tag, ngay cả khi cậu KHÔNG mở coord group).
6. Quay sang mở coord group → xem có **đúng 1 tag** `[AOG-HANDLED]` (không duplicate).

**P1 verification:**

1. Confirm role → shift session bắt đầu.
2. Trigger 2-3 alert, ACK đúng cách.
3. End shift (button mới trong popup).
4. Bấm "Export HR payroll" → download CSV → mở Excel kiểm.
5. Verify row có: shift_id, operator, role, duration, alerts_received=N, response_time_seconds.
6. Bấm "Export analytics" → download XLSX → kiểm 4 sheet.

**P2 verification:**

1. Settings → bật Dry-run → save.
2. Trigger alert → KHÔNG kêu, KHÔNG gửi tag.
3. Popup hiển thị badge "DRY-RUN" + event vừa detect.
4. Tắt Dry-run → trigger alert lại → kêu bình thường.

---

## Known risks không scope Round 3

- **WhatsApp Web đổi DOM major version:** vẫn cần patch selectors thủ công khi xảy ra. Mitigation: WhatsApp Web tương đối stable theo quý, selector hiện tại có fallback chain.
- **Outlook cloud subject extraction fallback structural:** có thể nhặt preview text thành subject. Sau dùng production sẽ tune nếu false positive nhiều.
- **2 sale dùng cùng tài khoản WhatsApp:** chưa scope (mỗi sale có WA riêng theo blueprint v3). Nếu sau có cần, riêng.
- **Multi-coord-group cho team >2 người:** không scope.
- **Native phone wake bypass DND:** không scope, đã quyết drop khỏi roadmap.

---

## Definition of Done

Extension Round 3 coi như xong khi:

- [x] All P0 issue fixed + regression test green.
- [x] Shift session lifecycle hoạt động end-to-end.
- [x] HR payroll CSV + Analytics XLSX export ra file mở được trong Excel với data đúng.
- [x] Dry-run mode togglable, không kêu/gửi khi bật.
- [x] Vitest 95+ pass.
- [x] User chạy manual test checklist 3 phần (P0/P1/P2) pass.
- [x] Audit file Round 3 viết xong với manual test result documented.

Sau khi DoD đạt → extension enable production. 2 sale dùng. Mỗi cuối tháng cậu export HR + Analytics nộp lãnh đạo + HR.

---

## Notes cho Codex

- User là Business/PD Manager, không phải dev. Commit message ngắn, focus WHY.
- Stop và ghi vào audit "Questions for review" nếu phát hiện ambiguity nghiệp vụ. Không tự quyết.
- Round 1 + Round 2 fix giữ nguyên, không touch.
- Library SheetJS: chọn build ESM gọn nhất, đính kèm trong `lib/vendor/`. Tránh inline base64 nặng.
- Date format CSV: ISO 8601 với timezone offset (Vietnam UTC+7).
- File báo cáo encoding UTF-8 BOM để Excel mở tiếng Việt không lỗi.
