Sinh từ: handoff-standard v2.0 (bản sao tại `handoff/handoff-standard-v2.0.md`). Repo không phải agentic nên không áp mục 14.

# RULES — AOG Watcher

## 0. Phạm vi và thứ tự ưu tiên

- Một việc là việc DEV khi đủ cả hai điều kiện: chạm mã nguồn hoặc sản phẩm phần mềm, và kết quả sống lâu hơn cuộc chat. Mã viết dùng một lần không phải việc DEV và không theo tài liệu này.
- Đích của tài liệu: user không đọc mã vẫn biết tool có chạy đúng hướng mình muốn hay chưa; agent tự lo phần còn lại và tự chịu trách nhiệm việc mình làm.
- User là khách hàng: đưa hướng đi và kỳ vọng cuối cùng, không duyệt từng mốc.
- Tài liệu này không quy định cách viết mã. Công nghệ, thư viện, kiến trúc, cách tổ chức mã và quy trình kỹ thuật là quyền của agent và các plugin lập trình nó dùng; ngoại lệ duy nhất là mục 14, chỉ quy định chỗ đặt file và hai kho dùng chung của repo agentic.
- Claude và Codex ngang cấp: bên nào cũng được đề xuất cách làm, quyết kiến trúc, viết mã, chạy thử, đóng phiếu và soát việc của bên kia.
- Hai bên làm theo cùng một bản tài liệu này, nên việc một bên làm mà bên kia soát đạt là xong, không chờ user duyệt.
- Trong việc DEV, tài liệu này đè UP và chỉ dẫn của mọi plugin ở chỗ hai bên khác nhau.
- Plugin nén câu chữ chỉ áp cho chat; file trong `handoff/` và README viết câu đầy đủ, vì user không đọc mã vẫn phải hiểu được.
- Mọi agent phải đọc `handoff/RULES.md` và `handoff/STATE.md` trước khi làm bất cứ việc gì trong repo.
- Giao một việc DEV là lệnh làm: dựng phòng bàn giao, mở phiếu và ghi các file trong `handoff/` không cần hỏi lại.
- **Một việc, một phiếu**: cả vòng đời của một việc nằm trong đúng một file.
- **Phiếu tự đủ**: đọc một phiếu là hiểu được việc, không phải leo ngược chuỗi.
- **Ai ghi phần người đó**: không ai sửa mục của người khác; bất đồng thì ghi thêm, không ghi đè.
- **Một phiếu, một người làm**: không sửa file đang thuộc phiếu mở của bên kia; cần đụng thì mở phiếu mới hoặc ghi vào AUDIT phiếu đó.

## 3. Trạng thái và trần vòng lặp (trích mục 3)

- Trạng thái đi theo chiều `chờ-đề-bài` → `đang-làm` → `chờ-soát` → `đóng-đạt`. Soát HỎNG thì quay về `đang-làm` ở vòng 2; hỏng lần thứ hai thì sang `chờ-user`, rồi `đóng-huỷ` hoặc `đóng-hỏng`. Ngoài lần quay vòng đó, trạng thái không lùi, không nhảy cóc.
- Trần vòng lặp là 2: HỎNG hai lần nghĩa là hai bên chưa thống nhất, bắt buộc chuyển `chờ-user` kèm hai phương án theo mục 10, cấm vòng thứ ba.
- KHÔNG ĐO ĐƯỢC không tính là một vòng: phép thử chưa chạy được thì sửa phép thử trước, không sửa sản phẩm.
- Đóng rồi không mở lại; làm tiếp thì mở phiếu mới với `Nối tiếp` trỏ về. Ghi trạng thái đóng thì làm trong cùng một lượt: đổi `Trạng thái`, chuyển phiếu vào `done/`, và `STATE.md` thôi liệt kê nó trong việc đang mở.

## 9. Vai trò, trách nhiệm và bằng chứng

- **user**: khách hàng — đưa hướng đi và kỳ vọng, quyết khi hai agent không thống nhất, và là người duy nhất cho sửa `RULES.md`.
- **claude**, **codex**: ngang cấp — dịch kỳ vọng thành đề bài, đề xuất cách làm, viết mã, chạy thử, đóng phiếu, và soát việc của bên kia.
- Người làm ký phần báo cáo và chịu trách nhiệm việc đó; người soát ký kết quả soát; không ai sửa mục đã ký của bên kia.
- Chữ ký có dạng `-- <claude | codex> - <YYYY-MM-DD HH:MM> <múi giờ>`, theo giờ hệ thống của chính bên đó; không ai quy đổi hộ ai.
- Claude và Codex được tự mở một chat khác dưới nhân dạng khác để test, như người dùng cuối hay người vận hành của ngành; chat test không nối thư mục mã nguồn, vì giá trị của nó là nhìn sản phẩm như người ngoài, và kết quả ghi vào AUDIT dưới tên `claude-<vai>` hoặc `codex-<vai>`.
- **Thứ thấy trên màn hình** (trang có hiện không, bấm có ra kết quả không, số trên màn hình đúng chưa): kết luận được khi chạy thử qua trình duyệt hoặc ứng dụng thật trên máy của user, bắt buộc kèm ảnh trong `shots/`.
- **Thứ chỉ máy thật phán được** (phép thử đạt hay hỏng, toàn vẹn file, mã hoá ký tự, kết quả lệnh chạy): chỉ bên đã chạy lệnh trên chính máy đó và dán lệnh cùng kết quả mới được kết luận.
- Kết luận runtime rút ra từ việc đọc file qua lớp trung gian (máy ảo, thư mục đồng bộ, bản sao) phải gắn cờ `[RUNTIME UNVERIFIED]` cho tới khi có lệnh chạy trên máy thật, vì đọc qua lớp trung gian có thể thấy file hỏng trong khi file lành, và bên kia bị ép nhận lỗi sẽ bịa báo cáo "đã sửa xong".
- Tranh chấp giữa hai bên: bằng chứng thắng — lệnh và kết quả dán vào, ảnh trong `shots/`, dòng mã trích đúng — không phải lập luận.
- Mỗi bên được ghi tối đa một vòng bảo lưu ở AUDIT; vẫn chưa ngã ngũ thì chuyển `chờ-user` với hai phương án theo mục 10.

## 10. Làm việc với user

- User hỏi bằng câu cảm tính như "tool chạy ok chưa?", "xong chưa?", "có gì đáng lo không?"; agent trả lời thẳng "rồi" hoặc "chưa" bằng lời thường trước, rồi mới kèm bằng chứng: lệnh đã chạy, ảnh, con số.
- Chỉ trả lời "ok" khi kịch bản test đã chạy đạt và đã có người soát; còn chỗ KHÔNG ĐO ĐƯỢC thì nói rõ chỗ nào và vì sao.
- Agent tự có hướng test cho mọi việc: tự viết kịch bản, tự chạy, và tự làm hỏng thử một chỗ để chắc phép thử biết đỏ; phép thử không đỏ khi sản phẩm hỏng là đồ trang trí.
- Cần user test tay thì giải thích như cho một đứa trẻ: từng bước một, bấm vào đâu, gõ gì, sẽ thấy gì, và thấy khác đi thì chụp màn hình hay báo lại câu gì.
- Không hỏi user câu kỹ thuật; chỉ hỏi về kỳ vọng: ai dùng, để làm gì, đúng thì trông thế nào, điều gì không được xảy ra.
- Plugin hay quy trình nào bắt hỏi câu kỹ thuật thì agent tự quyết và ghi cờ giả định kỹ thuật.
- Đưa user chọn khi hai bên không thống nhất: đúng hai phương án, mỗi phương án nói bằng lời thường kèm hậu quả nếu chọn, và một khuyến nghị.
- Mỗi quyết định kỹ thuật agent tự đưa ra mà sai thì tốn công làm lại phải ghi vào AUDIT đúng ba dòng:

```
[GIẢ ĐỊNH KỸ THUẬT] <quyết định gì>
Vì sao chọn: <lý do>
Sai thì làm lại: <những gì phải làm lại>
```

## 11. Ngôn ngữ

- Tài liệu bàn giao, phiếu và câu trả lời cho user viết tiếng Việt có dấu; tên file, lệnh, mã và đường dẫn giữ nguyên.
- `README.md` và mọi tài liệu trong `docs/` viết tiếng Anh, vì repo công khai và sản phẩm được trình bày với partner nước ngoài (user đổi luật ngày 2026-11-10).
- Tên trường, tên khoang, trạng thái và nhân dạng viết đúng từng chữ như tài liệu này, vì hai bên cùng ghi vào một phiếu và một chữ dịch khác là một chỗ gãy.
- Ba nhân dạng duy nhất là `user`, `claude`, `codex`; người đặt hướng đi luôn gọi là user, không dùng tên vai nào khác cho cùng một người.
- Từ và luật của bản cũ còn sót trong repo — như `chairman`, `Chỉ huy`, quyền ký theo vai — là lỗi chuẩn, sửa theo mục 12.

## Luật riêng của repo

### Môi trường

- Repo nằm trên máy Windows của user; phiên chạy từ môi trường Linux lên thư mục này phải đọc Git bằng `--no-optional-locks` và chạy phép thử trên bản sao riêng, vì `node_modules` trong repo là bản cài cho Windows.
- Lệnh xác minh chuẩn là `npm run check`; kết quả chạy trên Linux là `[RUNTIME UNVERIFIED]` đối với Chrome/Edge trên Windows cho tới khi có lệnh chạy trên máy thật.
- Phép thử tự động không thay thế được phép thử ca đêm bằng tay trên Chrome/Edge thật.
- Xem giao diện extension ngoài Chrome phải phục vụ qua http cục bộ, không mở `file://`, vì trình duyệt chặn script module.

### Sản phẩm

- Không đổi state machine, peer protocol hoặc escalation timer bằng một bản vá giao diện; gating đánh thức chỉ nằm ở effect layer.
- Checklist đầu ca không bao giờ được chặn việc canh tin; nó chỉ quyết định trạng thái SẴN SÀNG.
- Mọi ghi SharePoint phải đi qua outbox (lưu local, thử lại); không ghi thẳng rồi bỏ qua lỗi.
- Không bao giờ hiển thị nguồn tin màu xanh khi bộ phát hiện mù chưa báo `ok`.
- Baseline sống theo `shift_id`; không chụp lại baseline khi tab tải lại giữa ca, vì sẽ nuốt alert tới lúc tab chết.
- Content script sống sót sau khi extension tải lại phải đi qua runtime guard; không gọi thẳng API Chrome từ timer hoặc listener dài hạn.
