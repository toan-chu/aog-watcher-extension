# AOG Watcher v4.3 — Blueprint (Codex Build Spec)

**Ngày:** 2026-07-10
**Trạng thái:** IMPLEMENTED IN v4.3.0; automated verification 133/133 tests
**Nguồn:** Feedback ca trực 30/06 (anh Toàn + Monica + Ethan + Leah + Julia) → Claude phân tích root cause đối chiếu source v4.2.0.
**Nguyên tắc:** Không refactor ngoài scope. Giữ state machine, peer protocol, report pipeline nguyên trạng. Mọi thay đổi là gating/filtering TRƯỚC state machine hoặc effect-level SAU state machine — lifecycle alert không đổi để report không vỡ.

---

## 0. Tổng hợp issue → root cause (đã verify trong code)

| # | Issue thực địa | Root cause (file:line, v4.2.0) | Workstream |
|---|----------------|-------------------------------|------------|
| I1 | Connect WA/Outlook lúc 23h → chuông đổ dồn tin/mail CŨ (Monica, Ethan) | `content_whatsapp.js:41` — first scan `previousUnread === undefined` + unread > 0 → alert ngay. `content_outlook.js:5` — `seen` Set in-memory rỗng khi load → mọi unread đang tồn tại đều fire `ALERT_DETECTED`. Không có khái niệm baseline theo shift. | **WS1** |
| I2 | Outlook alert cả bản tin logistics (sender nội bộ), mail Draft, nhóm Commercial (Ethan) | (a) `content_outlook.js:47-55` — `extractSender` fallback trả display name không có email → blacklist domain `trustana.vn` trong `lib/filter.js:9` không match. (b) `candidateRows()` scan toàn `document` — folder nào đang render cũng quét, kể cả Draft. (c) Filter mặc định là blacklist; `subject_keywords` rỗng → mọi mail pass. | **WS2** |
| I3 | Leah + Julia connect nhưng KHÔNG có alert mail nào | `content_outlook.js:19` — `isUnread` dựa vào `button[aria-label*='Mark as read']` — chỉ match UI tiếng Anh. Outlook UI tiếng Việt = "Đánh dấu là đã đọc" → `isUnread` luôn false, fail âm thầm, không có diagnostic nào cho user thấy. | **WS2 + WS3** |
| I4 | Đang thức trực, rep tin xong người ta rep lại → vẫn reo | Không có idle/presence detection. `START_WAKE` effect phát audio vô điều kiện (`service_worker.js:146-154`). | **WS4** |
| I5 | Alert 3s tần số cao, giật mình, hại tim, ngủ thấp thỏm | `LEVEL_AUDIO_FILES` = 4 file wav ngắn, escalate 15s/level. Không có chế độ nhạc dịu loop dài. | **WS5** |
| I6 | "Nút start shift không tắt được" | End Shift TỒN TẠI nhưng là text-button nhỏ ẩn trong header "Recent events" (`popup.html:58`), chỉ hiện khi shift active, và dùng `window.confirm()` (`popup.js:149`) — Chrome có thể chặn dialog trong extension popup → click không phản ứng. | **WS6** |
| I7 | Quy chế nghỉ ngày hôm sau | Organizational — NGOÀI SCOPE CODE. Ghi nhận, không build. | — |

Lưu ý kiến trúc: I1 và I3 là hai mặt của cùng một lỗ hổng — detection layer không có baseline và không có visibility. Fix rời rạc sẽ lặp vòng như 5 round trước. WS1 + WS3 phải ship cùng nhau.

---

## WS1 — Shift baseline (fix I1) — P0

**Nguyên tắc:** chỉ alert những gì xuất hiện SAU khi shift bắt đầu. Không parse timestamp từ DOM (giờ tương đối "23:15"/"T2" brittle, vỡ theo ngôn ngữ UI). Dùng **snapshot ID/count**.

### 1.1 Storage
- Thêm `STORAGE_KEYS.SHIFT_BASELINE = "aog_shift_baseline"`.
- Shape: `{ shift_id, created_at, outlook_ids: string[], whatsapp_unread: { [group_name]: number } }`.
- Baseline sống theo `shift_id`: tạo 1 lần cho mỗi shift, reload tab/extension GIỮA ca thì **tái sử dụng**, không re-snapshot. (Re-snapshot khi reload sẽ nuốt mail đến trong lúc tab chết.)

### 1.2 Handshake protocol (message mới)
- `MESSAGE.BASELINE_SYNC`: content script → SW, payload `{ source, snapshot }` trong đó snapshot = danh sách ID unread (outlook) hoặc map group→unread (whatsapp) đang thấy TẠI THỜI ĐIỂM GỬI.
- SW xử lý: nếu chưa có baseline cho `state.session.shift_id` (hoặc chưa có phần của source đó) → lưu snapshot làm baseline, reply `{ baseline }`. Nếu đã có → reply baseline hiện có, BỎ QUA snapshot mới.
- Không có session active → reply `{ baseline: null }`; content script không alert gì (giữ nguyên hành vi SKIPPED_NO_SHIFT nhưng chặn từ gốc, đỡ spam event log).
- `MESSAGE.REBASELINE`: SW → content scripts (qua `chrome.tabs.sendMessage` tới tab WhatsApp + Outlook) khi `START_SHIFT` xử lý xong → content script gửi lại `BASELINE_SYNC` với snapshot mới. Xử lý case tab đã mở trước khi bấm Start Shift.
- `END_SHIFT` → SW xóa baseline.

### 1.3 content_whatsapp.js
- Seed `lastUnreadByGroup` từ `baseline.whatsapp_unread` khi nhận baseline.
- Sửa logic scan: `previousUnread === undefined` VÀ group không có trong baseline → coi như baseline mới thấy lần đầu: **ghi nhận count, không alert** (sửa trực tiếp lỗi line 41). Chỉ alert khi unread TĂNG so với giá trị đã ghi nhận.
- Chưa nhận baseline (SW chưa reply / chưa có shift) → không gửi `ALERT_DETECTED`.

### 1.4 content_outlook.js
- Seed `seen` Set từ `baseline.outlook_ids`.
- Chưa có baseline → scan vẫn chạy (để đếm diagnostic, xem WS3) nhưng không gửi `ALERT_DETECTED`.

### 1.5 Trade-off chấp nhận (ghi vào audit)
- Mail/tin đến TRƯỚC lúc bấm Start Shift nhưng SAU khi mở tab → nằm trong baseline → không reo. Đúng ý định: trực bắt đầu từ Start Shift.
- Tab chết giữa ca, mail đến, tab mở lại → baseline tái sử dụng nên mail đó VẪN reo (ID không có trong baseline). Đây là lý do baseline phải persist theo shift_id, không phải theo tab-lifetime.

---

## WS2 — Outlook scope + filter (fix I2, I3 phần detection) — P0

### 2.1 Folder gate — "chỉ alert ở box AOG"
- Config mới: `outlook_watch_path: ""` (string). Semantics: substring match (case-insensitive, normalized) trên `location.pathname` của tab Outlook.
  - Shared mailbox aog@trustana.vn: path chứa smtp → ví dụ `/mail/aog@trustana.vn/`.
  - Folder cá nhân có rule: path chứa tên folder → ví dụ `/mail/AOG/`.
  - Cả hai kiểu đều cover được bằng 1 config substring — không cần user chọn mode.
- content_outlook.js: check gate mỗi lần scan (SPA, URL đổi không reload — dùng chính chu kỳ scan 2s hiện có, không cần listener riêng). Path không match → **không scan, không alert**, báo health `folder_gate: "blocked"` kèm path hiện tại.
- `outlook_watch_path` rỗng → gate tắt (backward compatible) nhưng popup hiện cảnh báo vàng "Outlook chưa khóa folder AOG — sẽ alert mọi folder đang mở".
- Settings: thêm input + helper text hướng dẫn lấy path (mở box AOG, copy đoạn URL sau `outlook.office.com`).

### 2.2 Unread detection đa ngôn ngữ (fix I3)
- `lib/outlook_selectors.js`: thêm `unreadButtonLabels = ["mark as read", "đánh dấu là đã đọc"]` (mảng, dễ mở rộng).
- `isUnread()` + `candidateRows()`: match aria-label chứa BẤT KỲ label nào trong mảng (normalized lowercase). Bỏ hardcode `'Mark as read'` tại 2 chỗ (`content_outlook.js:19,39`).

### 2.3 Whitelist/blacklist
- Config mới: `sender_whitelist: []` — nếu non-empty, chỉ alert khi sender match (exact email, domain, HOẶC substring display-name normalized — vì I2(a) đã chứng minh sender extract được có thể chỉ là display name).
- `shouldSkipEmail` (lib/filter.js): thứ tự đánh giá: (1) whitelist non-empty và không match → skip; (2) blacklist domain → skip; (3) `subject_keywords` non-empty và không match → skip. Giữ nguyên hành vi cũ khi cả whitelist rỗng.
- Blacklist domain: mở rộng match cả display name chứa domain string (mitigate lỗi extract sender không có email).
- Lưu ý cho user (ghi settings helper): nếu đã bật folder gate trỏ đúng box AOG thuần thì whitelist có thể để rỗng — gate đã là whitelist vật lý.

---

## WS3 — Diagnostics visibility (fix I3 phần debug, chống lặp vòng) — P0

**Vấn đề gốc:** extension fail âm thầm cả 2 hướng (reo bậy / câm). User không có cách nào thấy "extension đang nhìn thấy gì" → mọi bug đều thành "em không biết lỗi từ đâu".

### 3.1 Scan stats
- Content script (cả 2 source) đếm mỗi chu kỳ: `rows_seen`, `unread_seen`, `alerts_sent`, `suppressed_baseline`, `suppressed_gate` (outlook), `last_scan_at`.
- Gửi kèm heartbeat `CONTENT_HEALTH` hiện có (30s) — không thêm message type mới, chỉ mở rộng payload `{ stats }`.
- SW lưu vào `SOURCE_HEALTH` record (mở rộng `lib/source_health.js`), expose qua `status()`.

### 3.2 Popup panel
- Section "Diagnostics" (collapsible, mặc định đóng) dưới source health dots: mỗi source 1 dòng — ví dụ `Outlook: thấy 42 rows / 5 unread / 0 alert / gate chặn (path: /mail/inbox)`.
- Quy tắc màu: `unread_seen > 0` liên tục mà `alerts_sent = 0` và không phải do baseline/gate → hiện hint "kiểm tra ngôn ngữ UI / filter". Trường hợp Leah + Julia sẽ hiện `rows_seen > 0, unread_seen = 0` → hint "unread detection không match — báo dev kèm ngôn ngữ Outlook".

---

## WS4 — Idle-gated wake + focused-chat suppression (I4) — P1

**Nguyên tắc an toàn:** chỉ gate ÂM THANH ở effect layer. Alert vẫn vào queue, state machine vẫn chạy, timer `primary_timeout`/`backup_delay` vẫn escalate sang partner như cũ. Không có đường nào làm alert biến mất khỏi lifecycle.

### 4.1 Idle detection
- `manifest.json`: thêm permission `"idle"`.
- Dùng `chrome.idle.queryState(threshold)` + `chrome.idle.onStateChanged`.
- **Ràng buộc API:** threshold tối thiểu của Chrome là **15s**, không làm được 10s như anh Toàn muốn. Config `idle_threshold_seconds: 15` (min-clamp 15). Chênh 5s không đáng đổi sang giải pháp tự track mouse/key (chỉ thấy activity TRONG tab, không thấy user đang dùng app khác — chrome.idle thấy toàn hệ thống).

### 4.2 Gating logic (trong `executeEffect` case `START_WAKE`)
1. Query idle state. `"idle"` hoặc `"locked"` → phát audio như hiện tại (đang ngủ/AFK → reo).
2. `"active"` + alert là WhatsApp + `alert.group_name` == conversation đang mở (content script gửi kèm `active_conversation` trong alert payload, so bằng `isSameGroupName` có sẵn) → **suppress hoàn toàn**: không audio, không notification. Log `WAKE_SUPPRESSED_FOCUSED`.
3. `"active"` các trường hợp còn lại → notification (không audio) + đánh dấu `pending_wake = alert_id` trong runtime state. Log `WAKE_DEFERRED_ACTIVE`.
- `chrome.idle.onStateChanged` → `"idle"`: nếu `state.app_state === ALERTING` và có `pending_wake` → phát audio ngay. (User bỏ máy đi mà alert chưa ACK → reo.)
- Outlook không có focused-suppression (xác định "đang đọc đúng mail đó" từ reading pane phức tạp, ROI thấp) — chỉ áp dụng idle-gating chung.

### 4.3 Trade-off chấp nhận
- User "active" nhưng đang xem phim không nhìn notification → không nghe chuông. Bù: timer escalation vẫn chạy → Backup vẫn được đánh thức đúng hạn. Ghi rõ trong hướng dẫn team.

---

## WS5 — Âm thanh dịu (I5) — P1

- Thêm 2 file audio mới: `assets/audio/gentle_loop.wav` (loop dài 20-30s, tần số thấp 200-400Hz, fade-in) — generate bằng `tools/generate_assets.mjs` (đã có sẵn infrastructure sine-wave, mở rộng).
- Config mới: `wake_audio_mode: "escalate" | "gentle"` (default `"gentle"`).
  - `"gentle"`: phát `gentle_loop` loop vô hạn, volume ramp 0.2 → 0.7 trong 60s đầu. Không đổi file theo level.
  - `"escalate"`: hành vi 4-level cũ (giữ cho ai muốn).
- `offscreen.js`: nhận mode + xử lý loop/ramp. `AUDIO_STOP` không đổi.
- Settings: dropdown chọn mode + nút "Nghe thử".
- **P2 (KHÔNG làm round này):** user upload file nhạc riêng — cần IndexedDB ở offscreen, để round sau nếu team cần.

---

## WS6 — End Shift UI (I6) — P1

- `popup.html`: End Shift thành button thật, đặt cạnh vị trí Start Shift (cùng khu shift setup), đỏ nhạt, luôn thấy được khi shift active.
- Bỏ `window.confirm()` → inline confirm: click lần 1 → button đổi thành "Xác nhận kết thúc ca?" (5s timeout tự revert), click lần 2 → gửi `END_SHIFT`.
- Sau END_SHIFT thành công: hint rõ "Ca đã kết thúc — không còn alert trên máy này".

---

## Config mới (tổng hợp — thêm vào `DEFAULT_CONFIG`)

```js
outlook_watch_path: "",          // WS2.1 — substring URL path gate; rỗng = tắt gate + cảnh báo
sender_whitelist: [],            // WS2.3 — rỗng = không áp whitelist
idle_threshold_seconds: 15,      // WS4 — min-clamp 15 (giới hạn chrome.idle)
wake_audio_mode: "gentle",       // WS5 — "gentle" | "escalate"
```

Storage key mới: `SHIFT_BASELINE`. Message mới: `BASELINE_SYNC`, `REBASELINE`. Permission mới: `idle`. Event type mới: `WAKE_SUPPRESSED_FOCUSED`, `WAKE_DEFERRED_ACTIVE`, `BASELINE_CREATED`.

---

## Thứ tự thực hiện + file touch

| Bước | WS | Files |
|------|----|-------|
| 1 | WS1 | `lib/constants.js`, `lib/storage.js`, `service_worker.js`, `content_whatsapp.js`, `content_outlook.js` |
| 2 | WS2 | `lib/outlook_selectors.js`, `lib/filter.js`, `content_outlook.js`, `settings.html/js`, `lib/constants.js` |
| 3 | WS3 | `content_whatsapp.js`, `content_outlook.js`, `lib/source_health.js`, `service_worker.js`, `popup.html/js/css` |
| 4 | WS4 | `manifest.json`, `service_worker.js`, `lib/runtime_state.js`, `content_whatsapp.js`, `lib/constants.js` |
| 5 | WS5 | `tools/generate_assets.mjs`, `assets/audio/`, `offscreen.js`, `service_worker.js`, `settings.html/js` |
| 6 | WS6 | `popup.html`, `popup.js`, `popup.css` |

WS1-3 là một đợt (P0, fix lỗi thực địa). WS4-6 là đợt hai (P1, UX). Có thể ship 2 commit riêng để test P0 sớm.

---

## Test plan (bổ sung vào suite hiện có, giữ 111 test cũ pass)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | WA first scan có 3 group unread trong baseline | 0 `ALERT_DETECTED`; `lastUnreadByGroup` seeded |
| 2 | WA unread tăng SAU baseline | 1 `ALERT_DETECTED` |
| 3 | Outlook load với 20 unread cũ | 0 alert; `seen` seeded từ baseline |
| 4 | Mail mới sau baseline | alert bình thường |
| 5 | Tab reload giữa ca | baseline TÁI SỬ DỤNG (không re-snapshot); mail đến lúc tab chết vẫn alert |
| 6 | START_SHIFT khi tab đã mở | SW gửi REBASELINE, baseline mới được tạo |
| 7 | END_SHIFT | baseline bị xóa |
| 8 | `outlook_watch_path` set, path không match | 0 scan alert, health `folder_gate: blocked` |
| 9 | Path match cả kiểu shared mailbox lẫn folder cá nhân | gate pass cả 2 |
| 10 | aria-label "Đánh dấu là đã đọc" | `isUnread` = true |
| 11 | `sender_whitelist` non-empty, sender không match (cả email lẫn display name) | SKIPPED_EMAIL_FILTER |
| 12 | Blacklist domain khi sender chỉ là display name chứa domain | skip |
| 13 | CONTENT_HEALTH payload có stats | SOURCE_HEALTH lưu + status() expose |
| 14 | START_WAKE khi idle="active", alert khác chat đang mở | notification, không AUDIO_PLAY, pending_wake set |
| 15 | idle chuyển "active"→"idle" khi ALERTING + pending_wake | AUDIO_PLAY fire |
| 16 | START_WAKE khi active + đúng chat WhatsApp đang mở | suppress hoàn toàn, log WAKE_SUPPRESSED_FOCUSED |
| 17 | Escalation timer khi wake bị deferred | primary_timeout vẫn fire đúng hạn (safety không đổi) |
| 18 | wake_audio_mode="gentle" | offscreen nhận mode gentle, loop, không escalate level |
| 19 | End Shift inline confirm | click 1 → confirm state; click 2 → END_SHIFT; 5s không click → revert |
| 20 | manifest có permission "idle" | manifest test pass |

Manual test đêm tiếp theo (team): (a) connect 23h với hộp mail đầy unread cũ → im lặng; (b) mail mới vào box AOG → reo; (c) mail vào folder khác → không reo + diagnostics hiện gate chặn; (d) máy Leah/Julia UI tiếng Việt → diagnostics hiện unread_seen > 0; (e) đang chat trong group khách → tin mới group đó không reo; (f) bỏ máy 15s+ có alert treo → reo.

---

## Ngoài scope round này (ghi nhận, không build)

1. Quy chế nghỉ ngày hôm sau (I7) — organizational, anh Toàn xử lý.
2. Upload nhạc custom — P2, cần IndexedDB offscreen.
3. Tắt hẳn nguồn email nếu tỷ lệ request thấp — quyết định vận hành sau khi có số liệu từ report XLSX (đã có sẵn per-source breakdown); folder gate + baseline đủ để giữ nguồn email sạch trước mắt.
