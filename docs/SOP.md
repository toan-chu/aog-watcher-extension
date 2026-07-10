# AOG Watcher — Cẩm nang vận hành (SOP)

Chrome/Edge extension trực đêm AOG. Monitor WhatsApp Web + Outlook Web → kêu báo thức khi có alert → log ca + sinh báo cáo HR và analytics.

**Khuyến nghị Chrome** từ v4.2.0 (đã test live trên Chrome). Edge dùng được nhưng chưa re-verify sau refactor selector.

---

## Setup lần đầu (làm 1 lần, dùng mãi)

### Bước 1 — Cài extension

**Edge:**

1. Mở `edge://extensions/`.
2. Bật toggle **Developer mode** (góc dưới trái).
3. Click **Load unpacked**.
4. Chọn folder extension đã giải nén.
5. Pin icon vào toolbar: click icon puzzle (góc trên phải) → click icon ghim cạnh "AOG Watcher".

**Chrome:** tương tự, đổi URL `chrome://extensions/`.

### Bước 2 — Cấp quyền site access

Trên trang Details của AOG Watcher (`edge://extensions/` → Details), bật toggle cho 5 site:

- `https://outlook.cloud.microsoft/*`
- `https://outlook.live.com/*`
- `https://outlook.office.com/*`
- `https://outlook.office365.com/*`
- `https://web.whatsapp.com/*`

### Bước 3 — Config Settings

Click icon AOG Watcher → popup mở → click **Settings**.

| Mục | Điền |
|---|---|
| My display name | Tên cá nhân (vd "Toan"). **Bắt buộc khác giữa 2 máy** — dùng để gắn vào tag WhatsApp coord, chống loop tự đọc tag mình gửi |
| Customer groups | Tên các group WhatsApp khách hàng, **mỗi dòng 1 group**. Copy y nguyên tên hiển thị trong sidebar WhatsApp Web |
| Coord group | Tên group nội bộ 2 người dùng để extension gửi/nhận tag (vd "aog-coord") |
| Outlook watch path | Khuyến nghị điền path của hộp/folder AOG, ví dụ `/mail/aog@trustana.vn/` hoặc `/mail/AOG/`. Để trống = extension canh folder Outlook đang mở và popup sẽ cảnh báo chưa khóa folder |
| Sender whitelist | Tùy chọn. Mỗi dòng một email, domain, hoặc một phần display name. Nếu có điền, chỉ sender match whitelist mới alert |
| Skip sender domains | `trustana.vn` (default). Email từ domain này sẽ không alert; từ v4.3.0 cũng match display name có chứa domain |
| Subject keywords | Để trống = alert mọi email. Điền keyword (vd `AOG`, mỗi dòng 1) = chỉ alert email có subject chứa keyword |
| Shift Slots (popup, KHÔNG ở Settings) | Cấu hình ngay trên popup. 2 slot, mỗi slot có Start/End + Role. Mặc định: Slot 1 `22:00→02:30` Primary, Slot 2 `02:30→07:00` Backup. Tự đổi role theo giờ máy khi qua slot mới |
| Wake audio mode | `gentle` mặc định: nhạc dịu loop thấp tần, volume tăng chậm. `escalate`: chuông 4 cấp cũ |
| Idle threshold | Mặc định `15` giây. Chrome không cho thấp hơn 15s. Chỉ dùng để gate âm thanh; escalation timer vẫn chạy |
| Test mode | OFF (bật khi muốn bypass slot gate để test ngoài giờ) |
| Test role | `Primary` (kêu ngay) hoặc `Backup` (chờ backup_delay rồi mới kêu) — chỉ áp dụng khi Test mode ON |
| Dry-run | OFF (chỉ bật khi muốn test logic không kêu/không gửi tag) |
| Primary timeout | `120` (giây) — A miss bao lâu thì gửi tag escalation cho B |
| Backup delay | `180` (giây) — B đợi bao lâu không nhận tag thì tự kêu (safety net) |
| Max alert duration | `540` (giây) — alert kêu tối đa 9 phút rồi tự MISSED |

Click **Save settings**.

### Bước 4 — Mở 2 tab work

Mở 2 tab trong cùng browser, login đầy đủ:

1. `https://web.whatsapp.com` — quét QR code đăng nhập + để mở suốt ca.
2. `https://outlook.cloud.microsoft/mail/` (hoặc URL Outlook của cậu) — đăng nhập M365.

**Sau khi cả 2 đã connected** (popup hiển thị 2 nguồn "Connected" với chấm xanh), setup xong.

---

## Setting có vĩnh viễn không?

**Có.** Setting lưu trong `chrome.storage.local`, persist mọi lần đóng/mở browser, reload extension, restart máy.

**Mất setting chỉ khi:**

1. Remove extension → Load unpacked lại.
2. Xóa user data của Edge/Chrome.
3. "Clear browsing data" có tick "Cookies and other site data" + "Extension data".

**KHÔNG mất khi:**

- Đóng/mở browser.
- Restart máy.
- Reload extension (mũi tên tròn trên card extension).
- Disable rồi Enable extension.
- Update version extension.

Setup 1 lần, dùng mãi. Chỉ vào Settings khi muốn đổi config (thêm customer group, đổi shift hours...).

---

## SOP — Vào ca / Trong ca / Ra ca

### Vào ca (mỗi đêm, mỗi máy)

1. Mở Edge/Chrome → kiểm extension AOG Watcher còn hoạt động (icon trên toolbar).
2. Mở 2 tab WhatsApp Web + Outlook Web. Verify đăng nhập.
3. Không cần giữ coord group active — từ v4.2.0 extension tự tìm coord group qua search box khi cần gửi tag.
4. Click icon AOG Watcher → popup.
5. **Thiết lập 2 shift slot theo lịch trực đêm đó** (lịch xào chẻ giữa 8 người, mỗi đêm có thể khác):
   - VD máy A: Slot 1 `22:00→02:30` Primary | Slot 2 `02:30→07:00` Backup.
   - VD máy B: Slot 1 `22:00→02:30` Backup | Slot 2 `02:30→07:00` Primary.
   - Slot tự lưu khi đổi (không cần Save).
6. Verify popup:
   - "Shift: ACTIVE" (nếu đang trong giờ slot đã set).
   - 2 chấm xanh: WhatsApp Web Connected + Outlook Web Connected.
   - Badge "DRY-RUN" **KHÔNG hiển thị** (nếu có, vào Settings tắt Dry-run).
7. Click **Start shift**. Extension tự pick role hiện tại theo slot, log thời gian, và chụp baseline tin/mail đang unread. Tin cũ trước Start shift không reo.
8. Volume Windows: max.
9. Mở panel **Diagnostics** nếu cần kiểm tra extension đang thấy bao nhiêu row/unread và Outlook có bị folder gate chặn không.
10. (Optional) Nhắn vào coord group "vào ca, online" để partner biết.

**Lưu ý:** 2 máy chạy theo giờ máy cục bộ. 2 người cần đồng bộ giờ máy trước ca (auto-sync NTP Windows OK).

### Trong ca

**Khi có AOG alert:**
- Nếu máy đang idle/locked, extension phát âm thanh + popup desktop notification. Nếu máy đang active, extension chỉ hiện notification và giữ escalation timer chạy; khi máy idle lại mà alert chưa ACK thì âm thanh bật lên.
- Nếu alert WhatsApp đến đúng conversation khách đang mở, extension suppress cả audio lẫn notification để không làm phiền khi bạn đang trả lời chính group đó.
- Click icon AOG Watcher → popup → bấm nút **ACKNOWLEDGE** (chỉ enable khi đang ALERTING).
- Audio dừng, alert mark HANDLED.
- Extension **tự động**: gõ "aog-coord" vào search box WhatsApp → Enter → switch sang coord group → gửi tag `[AOG-HANDLED]` → clear search box.
- **Lưu ý UX:** sau ACK, conversation WhatsApp đang ở aog-coord (không phải customer group). User tự click lại customer group để trả lời khách. Đây là trade-off bắt buộc — WhatsApp Web 2026 không cho gửi tin vào group inactive.

**Nếu cậu là Backup và Primary ngủ quên:**
- Sau 120s Primary không ACK → extension Primary tự gửi tag `[AOG-ESCALATED]` vào coord group.
- Extension cậu nhận tag → kêu báo thức.
- Cậu ACK → gửi tag `[AOG-HANDLED]` → Primary stop wake.

**Nếu Primary chết máy:**
- Không có tag nào tới coord group.
- Sau 180s extension cậu (Backup) tự kêu (safety net).
- Cậu ACK xử lý bình thường.

### Bàn giao giữa ca (vd 02:30)

**Extension tự đổi role theo slot, KHÔNG cần thao tác bàn giao tay.**

- 02:30 — slot 1 hết → extension tự switch role theo slot 2. Trên máy A: Primary→Backup. Trên máy B: Backup→Primary. Popup hiển thị slot active highlight + role mới.
- 2 máy vẫn tiếp tục chạy đến `07:00` (hết slot 2) thì mặc định không có slot nào match → role hiển thị "OUT OF SLOT", alert bị skip với `SKIPPED_OUT_OF_SHIFT`.
- Khi cả 2 máy đều trong slot, escalation chain hoạt động bình thường: Primary kêu trước, miss 120s → Backup được tag → kêu safety net.

**Note:** Nếu chỉ 1 người trực cả đêm, set cả 2 slot cùng Primary (vd `22:00→02:30 Primary` + `02:30→07:00 Primary`). Không có Backup cover.

### Ra ca

1. Bấm **End shift** trên popup. Nút sẽ đổi thành **Xác nhận kết thúc ca?** trong 5 giây.
2. Bấm lần 2 để kết thúc ca.
3. Extension stop nhận alert và xóa baseline của ca.
4. (Optional) Nhắn coord: "off ca, bàn giao xong".
5. Có thể đóng tab WhatsApp/Outlook hoặc đóng browser.

---

## Báo cáo HR + Analytics (cuối tháng)

### Export HR payroll CSV

1. Click icon AOG Watcher → popup → **Settings**.
2. Section **Reports** — chọn date range:
   - From: ngày đầu tháng (vd `2026-06-01`).
   - To: ngày cuối tháng (vd `2026-06-30`).
   - Để trống = mặc định tháng hiện tại.
3. Click **Export HR payroll**.
4. File `aog-hr-payroll-YYYYMMDD-YYYYMMDD-YYYYMMDDhhmm.csv` download về.
5. Mở Excel — nộp HR.

Cột chính:
- `shift_id`, `operator`, `partner`, `role`
- `shift_start`, `shift_end` (hoặc `(in progress)` nếu chưa end)
- `duration_hours` — số giờ trực
- `alerts_received` — số alert nhận
- `alerts_acked_by_self` — số alert tự ACK
- `alerts_missed` — số alert miss
- `avg_response_time_seconds` — trung bình thời gian từ alert tới ACK

### Export Analytics XLSX

1. Cùng date range trên.
2. Click **Export analytics XLSX**.
3. File `aog-analytics-YYYYMMDD-YYYYMMDD-YYYYMMDDhhmm.xlsx` download về.
4. Mở Excel — 5 sheet:
   - **Report Info** — generated time, range, total events, total shifts.
   - **Shift Summary** — 1 row mỗi ca trực (giống HR CSV).
   - **Alert Detail** — 1 row mỗi alert (timestamp, source, group, sender, subject, handled_by, response time).
   - **Hour Heatmap** — số alert mỗi giờ trong ngày (giúp lãnh đạo thấy peak hour).
   - **Group Sender Hot list** — top group/sender có nhiều alert nhất.

---

## Troubleshooting

### Popup hiển thị "Not detected" cho WhatsApp hoặc Outlook

- Verify tab tương ứng đang mở + đã đăng nhập.
- Refresh tab (F5).
- Click icon AOG Watcher → check site access (Bước 2 setup) đã bật cho domain đó chưa.
- `edge://extensions/` → AOG Watcher → click Reload (mũi tên tròn) → refresh tab.

### Popup Diagnostics nói gì?

Mở popup → bung panel **Diagnostics**:

- `rows`: số dòng extension nhìn thấy trong WhatsApp/Outlook.
- `unread`: số dòng/tin đang được nhận dạng là unread.
- `alert`: số alert đã gửi lên service worker trong scan gần nhất.
- `gate blocked`: Outlook đang không ở đúng `outlook_watch_path`; mở đúng hộp/folder AOG hoặc sửa setting.
- `rows > 0, unread = 0`: khả năng selector unread chưa match ngôn ngữ/UI Outlook. Báo dev kèm ngôn ngữ Outlook.
- `unread > 0, alert = 0` mà không phải baseline/gate: kiểm tra sender whitelist, skip domain, subject keywords.

### Extension không kêu khi có tin AOG

Theo thứ tự check:

1. Popup → badge "DRY-RUN" có hiển thị? Nếu có, vào Settings tắt Dry-run.
2. Popup → "Shift: ACTIVE"? Nếu OFF, đang ngoài 2 slot. Chỉnh slot start/end trên popup, hoặc bật Test mode (Settings).
3. Popup → "Role now: --"? Chưa bấm **Start shift**. Bấm để extension bắt đầu nhận alert.
4. Popup → "Role now: OUT OF SLOT"? Đã Start shift nhưng giờ hiện tại không nằm trong slot nào. Chỉnh slot cho phủ giờ hiện tại.
5. Volume Windows max? Audio extension giới hạn = volume Windows.
6. Group khách hàng có nằm trong Settings "Customer groups" không? Tên phải khớp **chính xác** với WhatsApp Web sidebar.
7. Cho email: Outlook tab có đang ở đúng folder/hộp AOG theo `outlook_watch_path` không? Nếu sai, Diagnostics sẽ hiện `gate blocked`.
8. Cho email: sender có bị whitelist/blacklist/subject keyword chặn không? Subject keywords default = trống (alert mọi email), nhưng nếu điền vd "AOG" thì mọi email không có "AOG" trong subject sẽ silent skip → vào Recent events check `SKIPPED_EMAIL_FILTER`.
9. Nếu vừa bấm Start shift và có nhiều unread cũ: đó là baseline. Tin/mail unread có trước Start shift sẽ không reo; chỉ tin mới tăng sau baseline mới alert.

### Extension chỉ hiện notification, không phát âm thanh

Từ v4.3.0, audio bị gate bởi trạng thái idle:

- Máy đang active → chỉ hiện notification, escalation timer vẫn chạy.
- Máy idle/locked hoặc chuyển idle khi alert còn treo → audio phát.
- Nếu đang mở đúng WhatsApp conversation vừa có tin → suppress cả audio và notification vì bạn đang xử lý ngay group đó.
- Muốn hành vi chuông cũ: Settings → Wake audio mode → `Escalating beeps`. Audio vẫn bị idle gate theo thiết kế an toàn v4.3.

### Test 2 case Primary / Backup khi ngoài giờ

1. Vào Settings → bật **Test mode**.
2. Chọn **Test role**:
   - `Primary` → alert kêu ngay khi detect (mô phỏng máy đang giữ role Primary).
   - `Backup` → alert chờ `backup_delay_seconds` (mặc định 180s) rồi mới kêu (mô phỏng safety net máy Backup khi Primary chết máy).
3. Bấm Start shift trên popup. Extension bypass slot gate, ép role theo Test role.
4. Test xong → Settings tắt Test mode.

### Tag `[AOG-HANDLED]` xuất hiện trong group khách hàng (KHÔNG được phép)

Bug nghiêm trọng. **Lập tức**:
1. Disable extension (`edge://extensions/` → toggle off).
2. Xóa tin nhắn rò rỉ trong group khách.
3. Báo Claude/Codex review.

### "Extension context invalidated" trong console

Đã fix Round 2. Nếu vẫn xuất hiện: reload extension + refresh 2 tab.

### Export CSV/XLSX không có data

- Verify Settings → date range bao trùm shift cậu muốn export.
- Verify đã có shift session (bấm Start shift ít nhất 1 lần).

### Bug khác

Check `docs/` folder có audit history các round. Hoặc gửi lại screenshot popup + console (F12) cho Claude review.

---

## Cấu trúc file

```
aog-watcher-extension/
├── manifest.json                 # MV3 manifest, không sửa
├── service_worker.js             # Background, state machine
├── content_whatsapp.js           # Inject vào WhatsApp Web
├── content_outlook.js            # Inject vào Outlook Web
├── offscreen.html/js             # Audio playback (MV3 yêu cầu offscreen)
├── popup.html/js/css             # UI khi click icon
├── settings.html/js/css          # Trang config
├── lib/                          # Logic core (testable)
├── assets/                       # Icon + audio
├── tests/                        # Vitest unit test
└── docs/                         # Blueprint + audit history
```

---

## Câu hỏi thường gặp

**Q: Cần Internet không?**
A: Có. WhatsApp Web + Outlook Web đều cần Internet. Extension chạy local, không gọi API ngoài.

**Q: Setting đồng bộ giữa máy A và B không?**
A: **Không.** Mỗi máy lưu setting riêng. Setup 2 lần (1 lần mỗi máy). Customer groups + coord group phải khớp chính xác giữa 2 máy.

**Q: Nếu mất điện giữa ca?**
A: Khi máy bật lại, mở browser + extension tự load (nếu Chrome khôi phục tab). Cần manual bấm Start shift lại. Shift session cũ tự auto-end khi start ca mới. Role hiện tại tự pick theo slot phủ giờ hiện tại.

**Q: 2 máy đồng hồ lệch nhau thì sao?**
A: Mỗi máy chạy role theo giờ máy của mình. Nếu lệch >2 phút có thể gây edge case (vd A đã chuyển sang Backup nhưng B vẫn Backup do giờ B chậm). Khuyến nghị bật auto-sync NTP Windows (mặc định ON).

**Q: Có thể chạy trên điện thoại không?**
A: Không. Extension chỉ chạy trên Chrome/Edge desktop. Phone có thể setup WhatsApp DND Override + Outlook VIP làm safety net riêng (xem `docs/native-phone-setup.md` nếu có).

**Q: Audio hoạt động thế nào?**
A: Mặc định v4.3.0 dùng `gentle`: một vòng âm thấp tần, loop liên tục, volume tăng từ 0.2 lên 0.7 trong khoảng 60 giây. Nếu chọn `escalate`, extension dùng chuông 4 cấp cũ (soft → medium → loud → urgent, tăng mỗi 15s). Cả hai mode đều chỉ phát khi máy idle/locked; khi máy active, escalation timer vẫn chạy nhưng audio được defer.

**Q: Có nhiều hơn 2 sale dùng được không?**
A: Hiện tại scope 2 người Primary/Backup. Multi-coord không support, cần build round riêng.

---

## Liên hệ + Update

Bug/đề xuất tính năng: ghi vào `docs/` folder hoặc paste sang Codex/Claude review.

Update extension: replace folder → Reload extension trong `edge://extensions/`.

---

**Version:** 4.3.0 (Field feedback fixes — shift baseline, Outlook gate, diagnostics, idle-gated gentle wake)
**Last updated:** 2026-07-10

**Changelog 4.3.0:**
- Shift baseline theo `shift_id`: tin/mail unread có trước Start shift không reo; reload tab giữa ca vẫn giữ baseline để tin mới trong lúc tab chết không bị nuốt.
- Outlook folder gate `outlook_watch_path`, sender whitelist, blacklist match display name, và unread label tiếng Việt.
- Popup **Diagnostics** hiển thị rows/unread/alerts/gate để debug reo bậy hoặc im bậy.
- Idle-gated wake: máy active chỉ notification hoặc suppress nếu đúng WhatsApp conversation đang mở; escalation timer không đổi.
- Audio mặc định `gentle` loop thấp tần, có thể đổi lại `escalate`.
- End Shift chuyển sang nút rõ cạnh Start Shift với inline confirm 5 giây.

**Changelog 4.2.0:**
- **Fix gửi tag vào coord group fail (root cause Round 5):** WhatsApp Web 2026 block synthetic click events trên sidebar rows. Thay bằng search box + Enter để switch conversation. Verified live trên Chrome.
- Update selectors: `conversationHeader` dùng `span[dir='auto']:not([title])` (cũ match nhầm member list); `chatRows` ưu tiên `[role='row']` (WhatsApp đổi từ `listitem`).
- `verifyMessageSent` dùng `.includes()` thay vì `===` (DOM WhatsApp Web duplicate text).
- Thêm selector `searchBox` vào lib.

**Changelog 4.1.0:**
- Bỏ shift_start/shift_end + Confirm Role dropdown. Thay bằng **2 shift slot** trên popup, mỗi slot có Start/End + Role riêng. Extension tự đổi role theo giờ máy khi qua slot mới.
- Test mode tách 2 case: `test_role: primary` (kêu ngay) hoặc `test_role: backup` (chờ backup_delay).
- Mới event: `SKIPPED_EMAIL_FILTER` (visible trong Recent events khi email bị filter), `SKIPPED_NO_SHIFT` (chưa Start shift).
- Bỏ `partner_display_name` (mỗi người tự gửi report HR riêng, lịch xào chẻ không cố định partner).
