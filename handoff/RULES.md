# Standing rules

## Chế độ chỉ huy

- Hiện tại `codex` chỉ huy kỹ thuật: lập kế hoạch, kiến trúc, code, debug, refactor và runtime verification trong phạm vi Chairman giao.
- Đổi chế độ khi Chairman chỉ định rõ người chỉ huy hoặc khi ticket mới đổi trường `Giao cho`.
- Khi Codex hết usage hoặc Chairman yêu cầu trực tiếp, Claude được giải trừ và nhận toàn quyền kỹ thuật lẫn thực thi; ticket gắn `[COWORK-EXEC]`. Phạm vi nghiệp vụ vẫn chờ Chairman; verdict runtime trên Windows vẫn gắn `[RUNTIME CHƯA KIỂM]` chờ Chairman hoặc Codex xác nhận.
- Quyết định nghiệp vụ và phạm vi luôn thuộc Chairman.

## Quyền ký nghiệm thu

- Chairman ký kịch bản nghiệm thu nghiệp vụ.
- Claude review tĩnh; không kết luận runtime hoặc tính toàn vẹn file Windows.
- Codex cung cấp verdict runtime bằng lệnh và output, nhưng không tự ký thay Chairman.
- Verdict chỉ dùng `ĐẠT`, `HỎNG`, hoặc `KHÔNG ĐO ĐƯỢC` kèm lý do.

## Trần lặp và leo thang

- Tối đa hai vòng sau verdict `HỎNG`.
- Hai lần `HỎNG` chuyển ticket sang `chờ-chairman` với hai phương án nén gọn; không có vòng ba.
- `KHÔNG ĐO ĐƯỢC` không tính là một vòng; sửa phép đo, không sửa sản phẩm theo phỏng đoán.
- Một hướng điều tra không tìm thấy sau hai turn thì dừng và bàn giao những gì đã loại trừ.

## Bốn câu hỏi của Chairman

1. Kịch bản nghiệm thu là gì, bằng ngôn ngữ nghiệp vụ?
2. Đã chạy chưa? Dán lệnh và output.
3. Cố ý làm hỏng một thứ thì test có đỏ không?
4. Có gì `KHÔNG ĐO ĐƯỢC` không? Tại sao?

## Luật sản phẩm còn hiệu lực

- Không đổi state machine, peer protocol, report pipeline hoặc escalation timer bằng một bản vá UX; gating đánh thức chỉ nằm ở effect layer.
- Baseline sống theo `shift_id`; không re-snapshot khi tab reload giữa ca vì sẽ nuốt alert đến lúc tab chết.
- Content script sống sót sau extension reload phải đi qua runtime guard; không gọi thẳng API Chrome từ timer/listener dài hạn.
- Trước patch lỗi phải có hypothesis card, kết quả kiểm tra, và sau patch phải sweep cùng shape.
- `npm run check` là lệnh xác minh chuẩn; manual overnight test trong Chrome/Edge thật không được thay thế bằng unit test.
