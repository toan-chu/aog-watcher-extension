# Kế hoạch triển khai V5-08

> **Dành cho người thực hiện:** dùng quy trình test trước; hoàn thành lần lượt từng việc và chỉ sửa phạm vi trong phiếu V5-08.

**Mục tiêu:** Máy đang trực không bỏ im ESCALATED chưa từng thấy, và focus WhatsApp chỉ được xem là có người đọc khi máy đang `active`.

**Kiến trúc:** Dựng alert còn thiếu ngay tại state machine bằng dữ liệu peer đã truyền; giữ nguyên đường đánh thức hiện tại. Tại service worker, chỉ thêm focus vào tập bằng chứng sau khi hỏi `chrome.idle`, không chạm bằng chứng unread bằng 0.

**Công nghệ:** Chrome MV3, JavaScript modules, Vitest.

**Đặc tả:** `handoff/20261111_V5-08_peer-handoff-active-use.md`

## Ràng buộc chung

- Không đổi peer protocol hoặc timer leo thang.
- Không đổi quy tắc hai lần quét unread bằng 0.
- Không sửa AOG_Shifts.
- Mỗi việc phải có RED, GREEN và phép làm hỏng thử.

## Việc 1: Dựng alert từ ESCALATED

**File:** `lib/state_machine.js`, `service_worker.js`, `tests/state_machine.test.js`, `tests/v50_service_worker.test.js`.

- [x] Thêm test state machine cho hàng đợi trống và payload đầy đủ; test tích hợp cho tín hiệu SharePoint.
- [x] Chạy test và xác nhận đỏ vì nhánh `PEER_ESCALATED_RECEIVED_NO_MATCH`.
- [x] Dùng `AlertQueue.add`, ánh xạ `group` sang `group_name`, rồi gọi đường `startAlert` hiện có; giữ đầy đủ payload tại biên SharePoint.
- [x] Chạy test xanh; tạm khôi phục NO_MATCH và xác nhận test đỏ.

## Việc 2: Chỉ dùng focus khi máy active

**File:** `service_worker.js`, `tests/v50_service_worker.test.js`.

- [x] Cho fake Chrome điều khiển trạng thái active/idle/locked; thêm test focus bị từ chối khi idle và được nhận khi active.
- [x] Giữ test `visible_read_chats` hoạt động khi máy idle để khóa quy tắc hai lần quét.
- [x] Chạy test đỏ, thêm đúng một cổng `queryIdleState`, rồi chạy xanh.
- [x] Tạm bỏ cổng idle và xác nhận test idle đỏ.

## Xác minh

- [x] Chạy các test tập trung, `git diff --check`, rồi `npm run check` trên Windows.
- [x] Ghi lệnh, kết quả và phép làm hỏng thử vào AUDIT; chuyển phiếu sang `chờ-soát`.
