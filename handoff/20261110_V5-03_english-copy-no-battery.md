Mã: V5-03
Mạch: V5 - AOG Watcher 5.0
Nối tiếp: V5-02
Người làm: codex
Người soát: claude
Trạng thái: chờ-soát
Vòng: 1/2

## ĐỀ BÀI
Kỳ vọng của user (2026-11-10):
- "ko dùng từ ACK, tôi muốn 1 từ khác." và sau đó "Đổi thành Accept đi."
- "đổi hết sang English. Vì sắp tới cần trình bày với partner nước ngoài, nên english thôi."
- "Ta tạm bỏ qua các yếu tố như laptop hết pin hay gì gì nhé, nó ko phải phạm vi mà extension cần quan tâm."
- Site SharePoint mới: "https://trustanavn.sharepoint.com/sites/aog"

Mục tiêu:
- Mọi chữ người dùng nhìn thấy trong popup, Settings, thông báo desktop, cảnh báo hệ thống, gợi ý kiểm tra đầu ca, sự kiện gần đây và chẩn đoán đều là tiếng Anh.
- Giờ hiển thị theo dạng 24 giờ, không phụ thuộc ngôn ngữ Windows.
- Không còn chữ `ACK` ở chuỗi hiển thị; hành động nhận tin dùng `Accept`, nút chính là `ACCEPT — I'LL HANDLE IT`.
- Bỏ toàn bộ kiểm tra nguồn điện/pin khỏi extension.
- Site SharePoint mặc định và hướng dẫn Settings dùng `https://trustanavn.sharepoint.com/sites/aog`.

Ngoài phạm vi:
- Giữ nguyên định danh nội bộ `event_type: "ACK"`, `MESSAGE.ACK_CURRENT`, state machine, peer protocol và timer leo thang.
- Không đổi bố cục hoặc id phần tử trong `popup.html` và `settings.html`.
- Không sửa logic SharePoint trong `service_worker.js`.
- Không sửa các file Claude đang giữ: `lib/sp_schema.js`, `lib/team_sync.js`, `lib/shift_row.js`, `lib/shared_settings.js`, `lib/sharepoint_client.js`, `lib/outbox.js`, `lib/groups.js`, `tests/v50_sharepoint.test.js`.
- Không sửa `README.md`, `docs/SOP.md` hoặc file trong `handoff/` ngoài phiếu này và `STATE.md`.

Kế thừa:
- V5-02 đã hoàn tất phần giao diện nền sáng và đang chờ soát vòng 2.
- RF-04 đang có thay đổi chưa commit trong `handoff/`; commit V5-03 không được chứa các thay đổi đó.

Kịch bản test:
- KS-1 Toàn bộ chuỗi hiển thị thuộc phạm vi đều là tiếng Anh, dùng đúng bảng từ thống nhất và không còn chữ `ACK` hiển thị.
- KS-2 Mọi giờ do extension định dạng đều dùng dạng 24 giờ dù ngôn ngữ Windows dùng 12 giờ.
- KS-3 Kiểm tra đầu ca không còn dòng nguồn điện; popup và service worker không còn đọc pin hoặc gửi/lưu báo cáo pin.
- KS-4 Site mặc định và hướng dẫn Settings cùng trỏ tới `https://trustanavn.sharepoint.com/sites/aog`.
- KS-5 `npm run check` đạt trên Windows; cổng quét tiếng Việt có dấu và `ACK` hiển thị đạt.
- KS-6 Làm hỏng thử một chuỗi thành tiếng Việt hoặc đổi nút chính về `ACK` thì phép thử phải đỏ.

## TODO
- [x] Ghi phép thử hồi quy cho English-only, `Accept`, giờ 24 giờ, bỏ pin và site SharePoint mới.
- [x] Chạy phép thử để xác nhận đỏ trên bản hiện tại.
- [x] Đổi chuỗi hiển thị và định dạng giờ, giữ nguyên định danh nội bộ.
- [x] Xóa mạch nguồn điện/pin và các phép thử cũ liên quan.
- [x] Chạy `npm run check`, các lệnh quét và phép làm hỏng thử trên Windows.
- [x] Ghi AUDIT, cập nhật `STATE.md`, commit riêng file của V5-03 và chuyển `chờ-soát`.

## AUDIT
Báo cáo của người làm:
- Popup, Settings, desktop notification, system alert, pre-shift check, recent events, diagnostics và nguyên nhân miss đã dùng tiếng Anh. Mọi định dạng giờ trong phạm vi hiển thị dùng `en-GB` với `hour12: false`.
- Chữ hiển thị `ACK` đổi thành `Accept`; nút chính là `ACCEPT — I'LL HANDLE IT`. Các định danh nội bộ `"ACK"`, `MESSAGE.ACK_CURRENT`, `SYSTEM_ALERT_ACK` và `ALERT_ACK` giữ nguyên.
- Đã xóa mục `power` trong pre-shift, tham số pin, `REPORT_BATTERY`, khóa `BATTERY`, lời gọi `navigator.getBattery()` và timer báo pin.
- Site mặc định và hướng dẫn Settings cùng dùng `https://trustanavn.sharepoint.com/sites/aog`.
- Các lỗi và báo cáo sinh từ file SharePoint do Claude giữ được dịch tại biên hiển thị trong `service_worker.js`; không sửa file Claude đang giữ và không đổi luồng SharePoint.
- File đổi: `lib/blind_detector.js`, `lib/constants.js`, `lib/miss_cause.js`, `lib/preflight.js`, `popup.html`, `popup.js`, `service_worker.js`, `settings.html`, `settings.js`, `tests/popup_static.test.js`, `tests/settings_static.test.js`, `tests/v43_p0_field_feedback.test.js`, `tests/v50_logic.test.js`, `tests/v50_service_worker.test.js`, `tests/v503_english_copy.test.js`, phiếu này và `handoff/STATE.md`.

RED trước khi sửa sản phẩm, chạy trên Windows:

```text
> npx vitest run tests/v503_english_copy.test.js tests/popup_static.test.js tests/settings_static.test.js tests/v50_logic.test.js tests/v50_service_worker.test.js
Test Files  4 failed | 1 passed (5)
Tests       17 failed | 30 passed (47)
```

Phép làm hỏng thử: đổi nút chính từ `ACCEPT` về `ACK`, phép thử đỏ đúng chỗ rồi khôi phục:

```text
> npx vitest run tests/v503_english_copy.test.js
Test Files  1 failed (1)
Tests       1 failed | 6 passed (7)
FAIL: expected popup.html to contain "ACCEPT — I'LL HANDLE IT"
```

Lệnh xác minh đầy đủ trên Windows:

```text
> npm run check
MV3 check passed (14 referenced files).
Test Files  29 passed (29)
Tests       188 passed (188)
```

Lệnh quét tiếng Việt có dấu, chuỗi hiển thị `ACK` và mạch pin; kết quả không có dòng vi phạm:

```powershell
$uiFiles = @('popup.html','popup.js','settings.html','settings.js','service_worker.js','lib/preflight.js') + (Get-ChildItem -Name 'content_*.js')
$viHits = rg -n '[À-ỹ]' $uiFiles
$ackHits = rg -n '\bACK\b' $uiFiles | Where-Object { $_ -notmatch 'eventType === "ACK"|replaceAll\("ACK", "ACCEPT"\)|eventRecord\.event_type === "ACK"' }
$powerHits = rg -n -i 'REPORT_BATTERY|K\.BATTERY|navigator\.getBattery|\bbattery\b|"power"' lib/constants.js lib/preflight.js popup.js service_worker.js
# output: rỗng cho cả ba; exit 0
```

- Chưa mở extension thật trên Chrome/Edge và chưa chụp ảnh, nên hiển thị trực tiếp vẫn là `[RUNTIME UNVERIFIED]`; phiếu này không đổi bố cục hoặc id và các cổng source/test đã đạt.

Giả định kỹ thuật:

```text
[GIẢ ĐỊNH KỸ THUẬT] Dịch lỗi và báo cáo từ các file SharePoint do Claude giữ tại biên hiển thị trong `service_worker.js`.
Vì sao chọn: user yêu cầu mọi chữ nhìn thấy là tiếng Anh nhưng cấm sửa các file SharePoint đó; cách này giữ nguyên logic và giao thức.
Sai thì làm lại: sau khi Claude nhả file, chuyển bản dịch vào nguồn phát sinh và bỏ lớp dịch tại biên.
```

Soát:
Kết quả:

## HISTORY
### 2026-11-10
Failure: lần chạy `npm run check` đầu tiên còn một test cũ đòi chữ `Chẩn đoán`; đã đổi kỳ vọng thành `Diagnostics`, sau đó toàn bộ suite đạt.
Báo lỗi giả: không.
Lessons: khi đổi ngôn ngữ toàn bộ giao diện, phải cập nhật cả phép thử hồi quy của phiên bản cũ nhưng giữ nguyên mục đích hành vi của phép thử.
-- codex - 2026-11-10 10:24 UTC+7
