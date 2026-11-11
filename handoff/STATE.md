Cập nhật: 2026-11-11 09:31 +07 - bởi codex

## Việc đang mở
V5-07 - người làm codex - chờ-soát - vòng 2/2 (đã sửa L1-L3 và G1-G3; chờ claude soát lại)
V5-06 - người làm codex - chờ-soát - vòng 2/2 (mã đạt, chờ chạy thử hai máy thật)
V5-05 - người làm claude - chờ-soát - vòng 1/2 - mã đạt, KS-2..KS-7 chờ hai máy thật
RF-04 - người làm claude - chờ-soát - vòng 1/2
RF-03 - người làm claude - chờ-soát - vòng 1/2
V5-01 - người làm claude - chờ-soát - vòng 1/2
V5-02 - người làm claude - chờ-soát - vòng 2/2

## Hôm qua
- RF-04 đưa phòng bàn giao lên handoff-standard v2.0: RULES sinh lại, phiếu đang mở đổi sang khuôn mới, phiếu đã đóng vào `done/`.
- Extension ở bản 5.0.0; `npm run check` đạt 28 file test, 181 test trên bản sao Linux.
- V5-01 (5.0.0) và V5-02 (popup nền trắng) đã code xong, còn thiếu phép thử thật trên hai máy Windows và chưa có bên soát.

## Vừa đóng
V5-03 - đóng-đạt - 2026-11-10
V5-04 - đóng-đạt - 2026-11-10
RF-02 - đóng-đạt - 2026-09-28
RF-01 - đóng-đạt - 2026-09-28

## Đang treo, cần user
- V5-01: user tạo 6 bảng AOG_* trên site SharePoint cx9 rồi chạy thử KS-1..KS-8 trên hai máy thật; cần biết ngày nào có hai máy để chạy.
- V5-02: nền trắng lúc nửa đêm có chói không — user xem trên máy thật và nói "giữ" hay "đổi".
- RF-03 (đưa repo về chuẩn v1.1) đã bị RF-04 thay toàn bộ; đề xuất đóng-huỷ RF-03.
- Đề xuất luật cho `RULES.md`: "phải chụp lại đủ mọi trạng thái màn hình rồi mới giao một thay đổi giao diện" (bài học V5-02).

## Bẫy đã biết
- Tải lại extension MV3 có thể để lại content script cũ; lời gọi runtime dài hạn phải đi qua guard.
- Nguồn vừa gửi alert được tính là còn sống; đừng chỉ dựa vào nhịp CONTENT_HEALTH.
- AOG_Log chứa ba loại dòng; mọi truy vấn phải lọc theo `RecordType`, vì dòng Event cũng mang `MachineId`.
- CSS có `display` riêng sẽ đè thuộc tính `hidden`; cần luật `[hidden] { display: none !important }`.

## Báo lỗi giả
Tháng này: 0
