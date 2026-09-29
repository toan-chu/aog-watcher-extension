# Standing rules

Sinh từ: Chuẩn Bàn Giao v1.1 (2026-08-25). Bản gốc nằm ngoài repo; lệch phiên bản thì đề xuất cập nhật, không tự sửa.

## Chế độ chỉ huy

- Chỉ huy hiện tại ghi ở `STATE.md` (`claude` hoặc `codex`), không ghi ở đây.
- `Chỉ huy: claude` — Claude viết đề bài, Codex thực thi, Claude soi tĩnh và đóng. `Chỉ huy: codex` — Codex tự viết đề bài, tự thực thi, gắn `[AUTO]`; Claude soi tĩnh khi quay lại.
- Đổi chế độ khi Chairman chỉ định rõ hoặc khi phiếu mới đổi trường `Giao cho` (`codex | claude-ceo | claude-user | claude-logisticist | chairman`).
- Khi Codex hết usage hoặc Chairman yêu cầu trực tiếp, Claude được giải trừ và nhận toàn quyền kỹ thuật lẫn thực thi; phiếu gắn `[COWORK-EXEC]`. Phạm vi nghiệp vụ vẫn chờ Chairman; kết luận runtime trên Windows vẫn gắn `[RUNTIME CHƯA KIỂM]`.
- Quyết định nghiệp vụ và phạm vi luôn thuộc Chairman.

## Quyền ký nghiệm thu — theo đường lấy bằng chứng

- Claude được ký thứ nhìn thấy qua trình duyệt thật trên máy Chairman (trang có hiện không, bấm có ra kết quả không, số trên màn hình đúng chưa), bắt buộc kèm ảnh trong `shots/`.
- Claude không được ký thứ chỉ máy Windows phán được (phép thử đạt/hỏng, toàn vẹn file, mã hoá ký tự, kết quả lệnh) → độc quyền Codex, chứng minh bằng lệnh + kết quả dán vào.
- Chairman ký nghiệm thu nghiệp vụ. Kết quả chỉ dùng `ĐẠT`, `HỎNG`, `KHÔNG ĐO ĐƯỢC` (+ lý do).
- Mỗi mục HISTORY và ô ký có chữ ký kèm giờ và múi giờ: `-- claude-ceo - 2026-09-29 10:10 UTC+7`.

## Trần lặp và leo thang

- Tối đa hai vòng sau `HỎNG`. Hai lần `HỎNG` → `chờ-chairman` kèm hai phương án nén; không có vòng ba.
- `KHÔNG ĐO ĐƯỢC` không tính là một vòng; sửa phép đo, không sửa sản phẩm theo phỏng đoán.
- Một hướng điều tra không tìm thấy sau hai lượt thì dừng và bàn giao những gì đã loại trừ.

## Bốn câu của Chairman

```
1  "Kịch bản nghiệm thu là gì? Đọc cho tôi bằng tiếng Việt: ai bấm gì, thấy gì,
    trong bao lâu."
    -> không đọc được bằng ngôn ngữ nghiệp vụ = việc chưa đủ rõ để bắt đầu

2  "Đã chạy chưa? Dán lệnh và kết quả vào."
    -> không có kết quả dán vào = chưa xong. Không tranh luận.

3  "Làm hỏng thử một chỗ đi - phép thử có đỏ lên không?"
    -> chống phép thử giả. Đập vỡ mà đèn vẫn xanh thì phép thử đó là đồ trang trí.

4  "Có chỗ nào KHÔNG ĐO ĐƯỢC không? Vì sao?"
    -> chống trường hợp cửa bị chặn quyền nên không trả dữ liệu, mà phép thử báo
       trông y hệt lỗi khuôn.
```

Luật kèm theo: Claude không được đề xuất kiến trúc, thư viện, cấu trúc file hay khuôn thiết kế (trừ khi đang `[COWORK-EXEC]`). Vi phạm thì Chairman xoá, không chuyển tiếp.

## Luật phòng bàn giao

- Phiếu: `{YYYYMMDD}_{MÃ}-{số}_{tên-việc}.md`; trạng thái chỉ đẩy tiến: `chờ-đề-bài → đang-làm → chờ-nghiệm-thu → đóng-đạt | chờ-chairman → đóng-huỷ | đóng-hỏng`. Đóng rồi không mở lại, không dời file.
- Ảnh: `shots/{YYYYMMDD}_{MÃ-số}_{stt}_{mô-tả}.png`; ảnh không phiếu nào trỏ tới thì xoá khi đóng phiếu.
- Mỗi phiên chỉ đọc `RULES.md` + `STATE.md` + đúng một phiếu; `MAP.md` khi đụng kiến trúc; không đọc `archive/` trừ khi Chairman chỉ định.
- Phiên chạy từ môi trường Linux lên thư mục Windows: đọc Git bằng `--no-optional-locks`, chạy test trên bản sao riêng (node_modules của Windows không chạy trên Linux).

## Luật sản phẩm còn hiệu lực

- Không đổi state machine, peer protocol hoặc escalation timer bằng một bản vá UX; gating đánh thức chỉ nằm ở effect layer.
- Checklist đầu ca không bao giờ được chặn việc canh tin; nó chỉ quyết định trạng thái SẴN SÀNG.
- Mọi ghi SharePoint phải đi qua outbox (lưu local, thử lại); không ghi thẳng rồi bỏ qua lỗi.
- Không bao giờ hiển thị nguồn tin màu xanh khi bộ phát hiện mù chưa báo `ok`.
- Baseline sống theo `shift_id`; không re-snapshot khi tab reload giữa ca vì sẽ nuốt alert đến lúc tab chết.
- Content script sống sót sau extension reload phải đi qua runtime guard; không gọi thẳng API Chrome từ timer/listener dài hạn.
- Trước patch lỗi phải có hypothesis card, kết quả kiểm tra, và sau patch phải sweep cùng shape.
- `npm run check` là lệnh xác minh chuẩn; manual overnight test trong Chrome/Edge thật không được thay thế bằng unit test.
