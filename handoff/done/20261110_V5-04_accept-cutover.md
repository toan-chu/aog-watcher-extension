Mã: V5-04
Mạch: V5 - AOG Watcher 5.0
Nối tiếp: V5-03
Người làm: codex
Người soát: claude
Trạng thái: đóng-đạt
Vòng: 1/2

## ĐỀ BÀI
Kỳ vọng của user (2026-11-10): "đổi ACK thành ACCEPT lun. Ko dùng khái niệm ACK nữa"

Mục tiêu:
- Bỏ hoàn toàn khái niệm `ACK` khỏi mã sản phẩm và phép thử; hành động nhận xử lý dùng `ACCEPT` từ giao diện tới state machine, event log và SharePoint.
- Giữ nguyên hành vi: bấm Accept dừng chuông, hủy timer, báo máy kia bằng tín hiệu `HANDLED`, tạo follow-up và ghi response time.
- Nút xóa cảnh báo hệ thống dùng khái niệm `Dismiss`, không dùng tên ACK.

Kiến trúc cutover:
- Popup gửi `MESSAGE.ACCEPT_CURRENT`; service worker phát action `ALERT_ACCEPT`.
- State machine ghi event `ACCEPT` và reason `self_accept`; peer protocol vẫn dùng `HANDLED`/`ESCALATED`.
- Event log tính response time cho `ACCEPT`; shift row xuất `PrimaryAcceptLog`/`BackupAcceptLog` qua hàm `acceptLog`.
- SharePoint schema và black-box event allowlist dùng tên mới; không có lớp đọc/ghi tương thích tên cũ.
- System alert dùng `DISMISS_SYSTEM_ALERT`, `SYSTEM_ALERT_DISMISSED`, thuộc tính `dismissed` và CSS `sys--dismissed`.

Ngoài phạm vi:
- Không đổi timer leo thang, trạng thái `HANDLED`, peer signal `HANDLED`, alert queue hoặc bố cục giao diện.
- Không sửa phiếu V5-03 đã ký hoặc hồ sơ handoff lịch sử. Chỉ thay thuật ngữ cũ trong README.md và docs/SOP.md vì yêu cầu mới nhất của user mở rộng phạm vi sang toàn bộ khái niệm.
- Không migrate dữ liệu cũ mang tên ACK; site `/sites/aog` chưa được nghiệm thu/tạo dữ liệu sống theo `STATE.md`.

Kịch bản test:
- KS-1 Bấm `ACCEPT_CURRENT` đưa alert về IDLE, dừng chuông, hủy timer, gửi `HANDLED`, tạo follow-up và ghi event `ACCEPT`.
- KS-2 Response time được tính từ `DETECTED` tới `ACCEPT`; shift row ghi `PrimaryAcceptLog`/`BackupAcceptLog`.
- KS-3 SharePoint schema có hai cột `*AcceptLog`; AOG_Events ghi `EventType=ACCEPT`.
- KS-4 Dismiss cảnh báo hệ thống vẫn hoạt động với tên mới.
- KS-5 Cổng quét khái niệm ACK trong mã sản phẩm và test trả về rỗng; các từ khác như `Backup`, `fallback`, `background` không bị coi là vi phạm.
- KS-6 `npm run check` đạt trên Windows và phép làm hỏng thử bằng cách đổi một identifier về `ACK_CURRENT` làm test đỏ.

## TODO
- [x] Viết cổng test và đổi các test hành vi sang contract `ACCEPT`; chạy RED.
- [x] Đổi popup, service worker, state machine và event log sang `ACCEPT`.
- [x] Đổi shift log, SharePoint schema và black-box event sang `ACCEPT`.
- [x] Đổi system-alert acknowledgement sang `Dismiss`.
- [x] Quét toàn bộ mã/test, chạy `npm run check` và phép làm hỏng thử.
- [x] Ghi AUDIT, cập nhật `STATE.md`, commit riêng V5-04 và chuyển `chờ-soát`.

## AUDIT
Báo cáo của người làm:

- RED trước khi sửa mã sản phẩm: `8 failed`, `12 failed | 51 passed`; các lỗi nằm đúng ở contract Accept chưa tồn tại.
- GREEN sau khi sửa: `npm run check` đạt kiểm tra MV3, `30 passed` file test và `189 passed` test.
- Popup dùng `acceptButton`, gửi `ACCEPT_CURRENT`; state machine nhận `ALERT_ACCEPT`, ghi `ACCEPT` và `self_accept`.
- SharePoint dùng `PrimaryAcceptLog`/`BackupAcceptLog`; black box dùng event `ACCEPT`. Giao thức giữa hai máy vẫn dùng `HANDLED`/`ESCALATED`.
- Cảnh báo hệ thống dùng `DISMISS_SYSTEM_ALERT`, `SYSTEM_ALERT_DISMISSED` và thuộc tính `dismissed`.
- README.md và docs/SOP.md đã thay thuật ngữ vận hành theo yêu cầu mới nhất; hồ sơ handoff lịch sử giữ nguyên để bảo toàn chữ ký và lời user.

Lệnh kiểm tra chính:

```text
> npm run check
MV3 check passed (14 referenced files).
Test Files  30 passed (30)
Tests  189 passed (189)
```

Lệnh quét thuật ngữ cũ ngoài handoff lịch sử và license bên thứ ba:

```powershell
rg -n -P "(?:\bACK\b|ACK_|_ACK|\bAck|\back\w*|_ack)" --glob "!node_modules/**" --glob "!handoff/**" --glob "!assets/**" --glob "!.git/**" .
```

```text
LEGACY_TERM_SCAN=<empty>
```

Phép làm hỏng thử:

```text
Tạm đổi ACCEPT_CURRENT thành ACK_CURRENT trong lib/constants.js.
npx vitest run tests/v504_accept_terminology.test.js --reporter=verbose
Test Files  1 failed (1)
Tests  1 failed (1)
Offender: lib\constants.js
```

Sau khi khôi phục:

```text
Test Files  1 passed (1)
Tests  1 passed (1)
```

File thay đổi của V5-04:

```text
README.md
docs/SOP.md
handoff/20261110_V5-04_accept-cutover.md
handoff/STATE.md
lib/constants.js
lib/event_log.js
lib/followup.js
lib/shift_row.js
lib/sp_schema.js
lib/state_machine.js
lib/team_sync.js
popup.css
popup.html
popup.js
service_worker.js
tests/event_log_enrich.test.js
tests/integration_simulate_restart.test.js
tests/service_worker_round3_static.test.js
tests/state_machine.test.js
tests/v503_english_copy.test.js
tests/v50_brand_ui.test.js
tests/v50_logic.test.js
tests/v50_service_worker.test.js
tests/v50_sharepoint.test.js
tests/v504_accept_terminology.test.js
```

Giả định kỹ thuật:

```text
[GIẢ ĐỊNH KỸ THUẬT] Cutover sạch sang ACCEPT, không giữ lớp tương thích hoặc migrate dữ liệu tên ACK.
Vì sao chọn: user yêu cầu không còn khái niệm ACK; STATE cho biết V5 và site AOG mới chưa được nghiệm thu với dữ liệu sống.
Sai thì làm lại: thêm một migration dữ liệu một lần cho local event log và các cột SharePoint cũ trước khi phát hành.
```

Soát:
- Đã đọc toàn bộ diff mã sản phẩm của commit `3fb70dd` (lib, popup, service worker). Thay đổi chỉ là đổi tên: action `ALERT_ACCEPT`, message `ACCEPT_CURRENT`, event `ACCEPT`, lý do `self_accept`, cột `PrimaryAcceptLog`/`BackupAcceptLog`, và nhóm `Dismiss` cho cảnh báo hệ thống. Thứ tự effect trong state machine (dừng chuông, huỷ timer, gửi `HANDLED`, ghi log, mở tin kế) không đổi; timer leo thang và peer protocol không đổi.
- Chạy lại trên bản sao sạch của commit `3fb70dd` (Linux, `git archive` rồi `npm ci`):

```text
> npm run check
Test Files  30 passed (30)
Tests  189 passed (189)
```

- Quét thuật ngữ cũ bằng đúng biểu thức của người làm trên js/html/css/md/json ngoài `handoff/`, `assets/`, `node_modules/`: rỗng. Quét rộng hơn mọi từ chứa "ack" không phân biệt hoa thường: chỉ còn backup, background, fallback, feedback, callback, black box, backoff, playback và tương tự; không có định danh nào mang nghĩa cũ.
- Làm hỏng thử của người soát: đổi `case "ALERT_ACCEPT"` trong `lib/state_machine.js` về tên cũ → 8 phép thử đỏ ở 4 tệp (state machine, restart simulation, service worker 5.0, cổng thuật ngữ); khôi phục → 189/189 đạt.
- Giả định "không migration": đồng ý. Site `/sites/aog` chưa có bảng nào, và bản 5.0 chưa từng chạy thật. Trên máy đang dùng 4.3, event cũ trong log cục bộ chỉ ảnh hưởng hiển thị: mục Recent events có thể còn hiện tên event cũ của ca sáng cùng ngày cho tới khi sang ngày mới. Không ảnh hưởng chuông, response time hay dòng ca trực, vì các phép tính đó lọc theo `shift_id` của ca hiện tại.
- Ghi nhận ngoài phạm vi phiếu này, không tính vào kết quả: còn chuỗi tiếng Việt trong `lib/sharepoint_client.js`, `lib/team_sync.js` và `lib/shift_row.js` (thông báo lỗi SharePoint, giá trị cột Ready, định dạng giờ `vi-VN`). Ba tệp này claude giữ theo ranh giới của V5-03; claude sẽ xử lý trong phiếu lớp dữ liệu SharePoint.
- Ghi nhận nhỏ: trong `tests/v504_accept_terminology.test.js`, biến `self` dùng dấu `\\` nên chỉ tự loại trừ đúng trên Windows; trên Linux tệp vẫn được quét nhưng vẫn đạt vì mẫu viết bằng mã unicode. Không cần sửa.
- `[RUNTIME UNVERIFIED]` Chưa ai bấm nút Accept và Dismiss trên Chrome/Edge thật; kết luận dưới đây dựa trên phép thử tự động. Phép thử trên trình duyệt thật gộp vào đêm chạy thử 5.0.
Kết quả: ĐẠT
-- claude - 2026-11-10 04:35 UTC

## HISTORY
### 2026-11-10
Failure: không.
Báo lỗi giả: không.
Lessons: một phép quét chỉ giới hạn ở JS/HTML/CSS sẽ bỏ sót README và SOP; cổng V5-04 đã mở rộng sang Markdown ngoài thư mục handoff và tài sản bên thứ ba.
-- codex - 2026-11-10
