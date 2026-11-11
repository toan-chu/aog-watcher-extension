Mã: V5-08
Mạch: V5 - AOG Watcher 5.0
Nối tiếp: V5-07
Người làm: codex
Người soát: claude
Trạng thái: chờ-soát
Vòng: 1/2

## ĐỀ BÀI
Quyết định của user (2026-11-11):

> "User chọn phương án A cho V5-07 (đọc Soát vòng 2 trong phiếu). Đóng V5-07 theo RULES.md, mở phiếu V5-08 nối tiếp, người làm codex, người soát claude, gồm đúng hai việc:
> 1. Máy đang trực nhận ESCALATED cho một tin nó chưa có trong hàng đợi thì dựng tin từ dữ liệu trong tín hiệu (nhóm, người gửi, tiêu đề, số chưa đọc) và reo. Không còn nhánh nào chỉ ghi NO_MATCH rồi im khi máy đang trực.
> 2. Bằng chứng \"chat đang mở và trang có focus\" chỉ được tính khi máy đang có người dùng (chrome.idle trả active). Bằng chứng \"dòng chat số chưa đọc bằng 0 hai lần quét liên tiếp\" giữ nguyên.
> AOG_Shifts giữ nguyên như commit 078de63: user đã điền đủ email cho mọi dòng và tên nhân viên không trùng.
> Mỗi việc có phép thử và phép làm hỏng thử. Commit kèm tệp claude đã sửa (phiếu V5-07), push, gửi khối \"Gửi claude\"."

Mục tiêu gồm đúng hai việc:

1. Khi máy đang trực và đang rảnh nhận `ESCALATED` cho một tin chưa có trong hàng đợi, state machine dựng alert từ `alert_id`, `source`, `timestamp`, `group`, `sender`, `subject`, `unread_count` trong tín hiệu, đưa vào hàng đợi và reo ngay. Tín hiệu SharePoint và tag nhóm điều phối phải truyền cùng dữ liệu này. Không còn kết quả `PEER_ESCALATED_RECEIVED_NO_MATCH` làm máy đang trực im lặng.
2. `focused_active_chat` chỉ được dùng làm bằng chứng Accept khi `chrome.idle.queryState` trả `active`. `visible_read_chats` đã được xác nhận bằng hai lần quét liên tiếp tiếp tục hoạt động khi máy idle hoặc locked.

Ngoài phạm vi:
- Không đổi tên tín hiệu `HANDLED`/`ESCALATED`, peer protocol, thời gian leo thang, cách gửi tag hoặc logic follow-up.
- Không đổi quy tắc hai lần quét unread bằng 0.
- Không sửa AOG_Shifts, schema SharePoint, README hoặc SOP. Phần này giữ nguyên như commit `078de63` theo quyết định của user.
- Không đổi giao diện.

Thiết kế:
- `lib/state_machine.js` tái sử dụng `AlertQueue.add` và `startAlert`; chỉ dựng alert khi máy có vai trò Primary/Backup, đang `IDLE`, và không tìm được alert cục bộ.
- `service_worker.js` giữ đầy đủ dữ liệu alert khi chuyển tín hiệu SharePoint vào state machine. Tag nhóm điều phối đã mang các trường tương ứng; state machine chấp nhận `group` và đổi thành `group_name`.
- `handleWhatsAppReadObservation` hỏi trạng thái máy một lần. Danh sách bằng chứng luôn gồm `visible_read_chats`; chỉ thêm `focused_active_chat` khi trạng thái là `active`.

Kịch bản test:
- KS-1 Primary hoặc Backup đang trực, hàng đợi trống, nhận ESCALATED đầy đủ: máy chuyển sang `ALERTING`, alert mới có đúng nhóm, người gửi, tiêu đề và số chưa đọc, đồng thời có effect đánh thức và timer tối đa.
- KS-2 Tín hiệu ESCALATED qua SharePoint cho alert chưa từng thấy vẫn mang đủ dữ liệu tới popup/state và làm máy reo.
- KS-3 Máy `idle` hoặc `locked` không Accept chỉ vì chat đang focus; máy `active` thì Accept đúng chat.
- KS-4 Bằng chứng `visible_read_chats` sau hai lần quét vẫn Accept khi máy không active.

## TODO
- [x] Việc 1: RED → GREEN cho ESCALATED chưa có trong hàng đợi; làm hỏng thử bằng cách khôi phục nhánh NO_MATCH.
- [x] Việc 2: RED → GREEN cho cổng `chrome.idle === active`; làm hỏng thử bằng cách bỏ cổng idle và xác nhận test đỏ.
- [x] Chạy `npm run check` trên Windows, ghi AUDIT, chuyển `chờ-soát`, cập nhật `STATE.md`, commit và push.

## AUDIT
### Kết quả sản phẩm
- Máy Primary hoặc Backup đang trực và đang rảnh nay dựng alert từ ESCALATED chưa từng thấy, đưa alert vào hàng đợi rồi reo qua đúng đường `START_WAKE` và timer tối đa hiện có. Alert giữ `group`, `sender`, `subject`, `unread_count`, `source`, `alert_id` và thời điểm từ tín hiệu.
- Tín hiệu đọc từ SharePoint không còn làm rơi dữ liệu chi tiết trước khi vào state machine. Tag nhóm điều phối vẫn dùng payload cũ và được ánh xạ `group` thành `group_name` khi dựng alert.
- Focus WhatsApp chỉ được tính là Accept khi `chrome.idle.queryState` trả `active`. Trạng thái `idle` hoặc `locked` giữ chuông và alert. `visible_read_chats` từ hai lần quét unread bằng 0 vẫn Accept bình thường dù máy idle.
- Không đổi peer protocol, timer leo thang, follow-up, AOG_Shifts hoặc giao diện.

### RED → GREEN
- Trước khi sửa, `npx vitest run tests/state_machine.test.js tests/v50_service_worker.test.js` đỏ 5 test: hai vai trò không reo cho alert chưa có, tín hiệu SharePoint không reo, và focus vẫn tự Accept khi máy idle/locked.
- Sau khi sửa, bộ tập trung gồm state machine, service worker, bằng chứng WhatsApp và peer protocol đạt 4/4 tệp, 62/62 test.
- Test tích hợp SharePoint tạo tín hiệu mới sau khi máy đã Start shift và đã đặt signal cursor, nên tái hiện đúng trường hợp alert nằm trong baseline của máy nhận.

### Phép làm hỏng thử
- Khôi phục nhánh `PEER_ESCALATED_RECEIVED_NO_MATCH` làm 2 test Primary/Backup đỏ.
- Bỏ phần chi tiết `signal.payload` tại biên SharePoint làm test tích hợp đỏ vì alert reo nhưng mất nhóm, người gửi, tiêu đề và số chưa đọc.
- Bỏ cổng `chrome.idle === active` làm 2 test idle/locked đỏ. Sau khi khôi phục, test `visible_read_chats` khi idle vẫn xanh.

### Bằng chứng Windows
Lệnh:
```powershell
npm run check
```
Kết quả ngày 2026-11-11: `MV3 check passed (14 referenced files)`, `34 passed (34)`, `253 passed (253)`.

Lệnh:
```powershell
git diff --check
```
Kết quả: rỗng; Git chỉ cảnh báo quy tắc LF→CRLF của checkout Windows.

### File thay đổi
`lib/state_machine.js`; `service_worker.js`; `tests/state_machine.test.js`; `tests/v50_service_worker.test.js`; phiếu V5-08; kế hoạch; phiếu V5-07 do Claude bổ sung và chuyển vào `handoff/done/`; `handoff/STATE.md`.

[RUNTIME UNVERIFIED] Chưa chạy bàn giao ESCALATED và kiểm tra idle trên hai máy Chrome thật; phép thử tự động chứng minh state/effect và biên SharePoint giả lập.

-- codex - 2026-11-11 10:16 +07

## HISTORY
### 2026-11-11
Failure: chưa có.
Báo lỗi giả: chưa có.
Lessons: chưa có.
