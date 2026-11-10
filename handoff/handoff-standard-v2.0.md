# handoff-standard v2.0

Luật thiết lập và vận hành một dự án phần mềm giữa user, Claude và Codex. Mỗi repo giữ một bản sao tài liệu này trong `handoff/` và một `handoff/RULES.md` sinh ra từ nó.

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

## 1. Cấu trúc phòng bàn giao

```
<repo>/
  AGENTS.md
  CLAUDE.md
  README.md
  memory/
  handoff/
    handoff-standard-v2.0.md
    RULES.md
    STATE.md
    MAP.md
    docs/
    shots/
    done/
    archive/
    20260825_CT-04_sua-cong-thanh-toan.md
```

- **handoff-standard-v<phiên bản>.md**: bản sao tài liệu này, chỉ giữ đúng một bản là bản hiện hành.
- **AGENTS.md**: bắt buộc ở gốc repo, tối đa 30 dòng: dự án này là gì, và phải đọc `handoff/RULES.md` trước khi làm. Không chuyển vào `handoff/`, vì công cụ đọc file gần nhất tính từ chỗ đang sửa nên agent sửa mã sâu trong repo sẽ không nhìn thấy `handoff/`.
- AGENTS.md của repo chỉ nói về repo đó; nó khác với chỉ dẫn chung mà Codex và Claude nạp trên máy.
- **CLAUDE.md**: chỉ tạo khi Claude vận hành một repo agentic; nội dung chỉ một dòng `@AGENTS.md`, để Claude nạp đúng nội dung AGENTS.md mà không có bản thứ hai bị lệch.
- **memory/**: trí nhớ lúc chạy của sản phẩm, chỉ repo agentic mới có, đi theo mục 14.
- **RULES.md** tối đa 200 dòng, **STATE.md** tối đa 100 dòng, **MAP.md** tối đa 200 dòng.
- **done/**: phiếu đã đóng; phiếu đang mở nằm phẳng trong `handoff/`, để nhìn thư mục là thấy việc đang chạy.
- **archive/**: hồ sơ cũ không còn dùng; luôn có, không ai đọc trừ khi user yêu cầu đích danh.
- Không tạo `tasks/`, `acceptance/`, `todo/`, `audit/`, `history/`, `failure/`, `sessions/` dưới bất kỳ hình thức nào: chúng là khoang trong phiếu, không phải thư mục.
- Đặc tả và kế hoạch do plugin sinh ra đặt trong `handoff/docs/`, không mở thêm chỗ thứ hai chứa thông tin điều phối.

## 2. Ngân sách đọc

- Mục tiêu: một phiên chỉ nạp khoảng 450 dòng, bất kể dự án sống bao lâu.
- **Luôn đọc**: `RULES.md` và `STATE.md`.
- **Việc của mình**: đúng một phiếu.
- **MAP.md**: chỉ khi việc đụng tới kiến trúc, vì phần lớn việc không cần bản đồ cả repo.
- **Phiếu trước**: chỉ khi khoang Kế thừa không đủ, và chỉ mở đúng phiếu mà trường `Nối tiếp` trỏ tới, thường nằm trong `done/`.
- **handoff-standard**: chỉ khi đưa repo về chuẩn theo mục 12; việc hằng ngày đi theo `RULES.md`.
- Cấm quét cả `handoff/`, đọc theo dải ngày, đọc phiếu đã đóng không được trỏ đích danh, đọc `docs/` khi không có dòng nào trỏ tới, và đọc `archive/` trừ khi user yêu cầu đích danh.
- Vượt trần dòng thì cắt, không thương lượng.

## 3. Phiếu việc

- Tên file: `{YYYYMMDD}_{MÃ}-{số}_{tên-việc}.md`. `MÃ` là mã mạch 2–3 chữ in hoa, một mạch là một dòng việc nối tiếp nhau; `số` tăng dần trong mạch; `tên-việc` viết thường không dấu, nối bằng gạch ngang, tối đa 5 từ.
- Bất cứ thứ gì đáng ghi lại đều đáng một phiếu: môi trường hỏng, công cụ trục trặc, hai bên hiểu nhầm nhau đều là việc.

```
Mã: CT-04
Mạch: CT - <tên mạch>
Nối tiếp: CT-03
Người làm: claude | codex
Người soát: claude | codex
Trạng thái: đang-làm
Vòng: 1/2

## ĐỀ BÀI
Kỳ vọng của user:
Mục tiêu:
Ngoài phạm vi:
Kế thừa:
Kịch bản test:

## TODO
- [ ]

## AUDIT
Báo cáo của người làm:
Giả định kỹ thuật:
Soát:
Kết quả: ĐẠT | HỎNG | KHÔNG ĐO ĐƯỢC

## HISTORY
### YYYY-MM-DD
Failure:
Báo lỗi giả: có | không
Lessons:
-- <chữ ký>
```

- **Người làm và người soát**: agent nhận việc là người làm, bên còn lại là người soát; người làm quyết kiến trúc và cách làm, người soát được bảo lưu một vòng ở AUDIT.
- **ĐỀ BÀI**: người làm viết; mở xong không ai sửa, bất đồng thì ghi ở AUDIT. Kỳ vọng của user chép nguyên lời user, không diễn giải. Mục tiêu 1–3 câu. Ngoài phạm vi chỉ ghi ranh giới về việc, không ghi ràng buộc kỹ thuật. Kế thừa tối đa 3 dòng về điều đã chốt ở phiếu trước, để trống nếu là phiếu đầu mạch.
- **Kịch bản test**: người làm tự viết từ kỳ vọng của user, bằng lời thường — ai bấm gì, thấy gì, trong bao lâu, và điều gì tuyệt đối không được xảy ra; chỉ chứa thứ thấy được bằng mắt hoặc đo được bằng lệnh, không chứa giả định kỹ thuật.
- **TODO**: người làm viết, dạng ô đánh dấu; đổi hướng giữa chừng thì thêm dòng mới, không xoá dòng cũ.
- **AUDIT**: người làm ghi đã làm gì, file nào đổi, lệnh và kết quả dán nguyên, lệch so với đề bài (không có thì ghi "không"), câu hỏi còn treo cho user, và các cờ giả định kỹ thuật. Người soát đọc mã, đối chiếu đề bài và kịch bản test, tự chạy lại khi chạy được, kết luận runtime theo luật bằng chứng ở mục 9, rồi ghi Kết quả kèm lý do nếu không đo được và ảnh trong `shots/` nếu có.
- **HISTORY**: ghi theo ngày, mỗi ngày một mục con, không ghi đè ngày trước. Failure là hôm nay hỏng gì, kèm có phải báo lỗi giả không (báo hỏng mà hoá ra không hỏng). Bài học chặn được hành động về sau thì ghi vào "Bẫy đã biết" của `STATE.md`; muốn thành luật đứng thì đề xuất user theo mục 4.
- Trạng thái đi theo chiều `chờ-đề-bài` → `đang-làm` → `chờ-soát` → `đóng-đạt`. Soát HỎNG thì quay về `đang-làm` ở vòng 2; hỏng lần thứ hai thì sang `chờ-user`, rồi `đóng-huỷ` hoặc `đóng-hỏng`. Ngoài lần quay vòng đó, trạng thái không lùi, không nhảy cóc.
- Trần vòng lặp là 2: HỎNG hai lần nghĩa là hai bên chưa thống nhất, bắt buộc chuyển `chờ-user` kèm hai phương án theo mục 10, cấm vòng thứ ba.
- KHÔNG ĐO ĐƯỢC không tính là một vòng: phép thử chưa chạy được thì sửa phép thử trước, không sửa sản phẩm.
- Đóng rồi không mở lại; làm tiếp thì mở phiếu mới với `Nối tiếp` trỏ về. Ghi trạng thái đóng thì làm trong cùng một lượt: đổi `Trạng thái`, chuyển phiếu vào `done/`, và `STATE.md` thôi liệt kê nó trong việc đang mở.

## 4. RULES.md

- Dòng đầu ghi sinh từ handoff-standard phiên bản nào, để biết repo đang chạy luật bản nào.
- Chỉ chứa luật đứng — thứ còn đúng vào tháng sau; không chứa lịch sử, không chứa lỗi đã sửa xong.
- `RULES.md` chỉ đổi trong hai trường hợp: user yêu cầu, thường vì đổi hướng đi của repo; hoặc đưa repo lên bản handoff-standard mới theo mục 12.
- Agent thấy một bài học đáng thành luật thì ghi vào mục "Đang treo, cần user" của `STATE.md` thành một câu chặn hành động — "không được làm X" hoặc "phải làm Y trước khi Z"; user đồng ý thì mới chép lên `RULES.md`.
- Chạm trần 200 dòng thì đề xuất user những luật đã chết cần bỏ, không tự xoá.
- Bắt buộc có sẵn, chép từ tài liệu này: toàn bộ mục 0; trạng thái và trần vòng lặp (mục 3); toàn bộ mục 9, 10 và 11; repo agentic thêm toàn bộ mục 14.

## 5. STATE.md

```
Cập nhật: <ngày giờ> <múi giờ> - bởi <claude | codex>

## Việc đang mở
CT-04 - người làm codex - chờ-soát - vòng 1/2

## Hôm qua

## Vừa đóng
CT-03 - đóng-đạt - <ngày>

## Đang treo, cần user

## Bẫy đã biết

## Báo lỗi giả
Tháng này: <số lần>
```

- Ảnh chụp hiện tại: ghi đè mỗi lần kết phiên, không nối đuôi, vì lịch sử đã nằm trong HISTORY của từng phiếu.
- **Hôm qua**: 3–5 dòng về việc đã chạy, đã vấp, đã chốt, đủ để một chat mới bắt nhịp mà không mở phiếu nào.
- **Đang treo, cần user**: chỉ ba loại — câu hỏi về kỳ vọng, chỗ hai bên không thống nhất, và đề xuất luật cho `RULES.md`.
- **Bẫy đã biết**: 3–5 dòng về thứ phiên sau dễ vấp lại; sống quá một tuần thì đề xuất thành luật theo mục 4 rồi xoá khỏi đây.
- **Báo lỗi giả**: thước đo duy nhất của cả hệ thống; số này giảm dần thì user mới có cơ sở tin báo cáo của agent.

## 6. MAP.md

- Kiến trúc hiện tại của dự án, một trang, chỉ mô tả hiện trạng.
- Mọi thay đổi ở tầng kiến trúc phải được người làm vẽ ở đây trước khi đổi mã, để MAP.md cập nhật trước chứ không trôi theo sau.
- Lý do của một thay đổi nằm trong phiếu đã gây ra nó, không nằm ở đây; danh sách việc đang mở nằm ở `STATE.md`.

## 7. docs/, shots/, done/ và archive/

- **docs/**: một thư mục phẳng, phân loại bằng tiền tố tên file: `REF-` là tài liệu user mang về hoặc sưu tầm, `SPEC-` là đặc tả hay thiết kế đã chốt, `NOTE-` là ghi chép của Claude, Codex hoặc plugin. Chỉ đọc khi có một dòng trong phiếu trỏ tới.
- **shots/**: ảnh và GIF agent chụp khi chạy thử sản phẩm, làm bằng chứng; mọi dự án đều có. Tên file `{YYYYMMDD}_{MÃ-số}_{stt}_{mô-tả-ngắn}.png`.
- Mỗi ảnh phải được một phiếu trỏ tới; ảnh không ai trỏ tới là rác, xoá khi đóng phiếu.
- Ảnh tĩnh đi theo git vì là bằng chứng và nhẹ; GIF không đi theo git, giữ trên máy khi phiếu còn mở và xoá khi phiếu `đóng-đạt`.
- **done/**: chỉ chứa phiếu đã đóng, giữ nguyên tên file.
- **archive/**: hồ sơ không còn dùng, không phải tài liệu làm việc.

## 8. Chuẩn README

- Áp cho README của mọi repo và mọi dự án trên máy, kể cả dự án chưa đưa lên git.
- Đoạn đầu phải để người không biết code hiểu công cụ làm gì và họ được lợi gì; chi tiết kỹ thuật xuống dưới.

```
# <Tên dự án> v<phiên bản>

[huy hiệu shields.io: license · ngôn ngữ + phiên bản · hạ tầng chính · nền tảng · số phép thử đã đạt]

> **Một câu: công cụ này làm gì, cho ai.**
> Một dòng luồng: ai đưa gì vào -> công cụ làm gì -> kết quả xuất hiện ở đâu.

## 🎯 Ai làm gì
## 🔄 Luồng chạy
## 🚀 Cài đặt
## 📋 Dùng thế nào
## ❓ Hỏng thì làm gì
```

- Tiêu đề mục có emoji dẫn đầu để quét nhanh bằng mắt.
- **Ai làm gì**: bảng ba cột Vai trò, Việc, Cần biết code?; cột cuối trả lời thẳng Có hoặc Không.
- **Luồng chạy**: sơ đồ ASCII trong khối mã, không dùng ảnh, vì ảnh gãy khi đổi chỗ.
- Huy hiệu chỉ ghi thứ kiểm được: số phép thử đã đạt là con số thật, không phải trang trí.
- Huy hiệu số phép thử cập nhật trong cùng lần chạy phép thử, lệnh và kết quả dán vào AUDIT của phiếu đó.
- Agent tự viết hoặc cập nhật README theo chuẩn này khi đưa repo về chuẩn và khi đóng một phiếu làm đổi cách dùng, phiên bản hoặc số phép thử; không chờ được yêu cầu.

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

- Tài liệu bàn giao, README, phiếu và câu trả lời cho user viết tiếng Việt có dấu; tên file, lệnh, mã và đường dẫn giữ nguyên.
- Tên trường, tên khoang, trạng thái và nhân dạng viết đúng từng chữ như tài liệu này, vì hai bên cùng ghi vào một phiếu và một chữ dịch khác là một chỗ gãy.
- Ba nhân dạng duy nhất là `user`, `claude`, `codex`; người đặt hướng đi luôn gọi là user, không dùng tên vai nào khác cho cùng một người.
- Từ và luật của bản cũ còn sót trong repo — như `chairman`, `Chỉ huy`, quyền ký theo vai — là lỗi chuẩn, sửa theo mục 12.

## 12. Đưa repo về chuẩn

- Áp cho ba trường hợp: repo chưa có phòng bàn giao, repo dựng theo cấu trúc cũ, và repo đang chạy một bản handoff-standard thấp hơn bản gốc.
- Agent gặp một trong ba trường hợp thì làm luôn trong lượt đó, không hỏi; mở một phiếu cho chính việc này và ghi mọi thao tác vào phiếu đó.
- Agent được chuyển, đổi tên, xoá và sắp xếp lại file, miễn không làm gãy việc chạy của repo về sau: build, CI, import, đường dẫn trong mã và cấu hình, lệnh chạy ghi trong tài liệu.
- Trước khi chuyển hay xoá một file, tìm mọi chỗ trỏ tới nó và sửa luôn trong cùng lượt.
- Repo có git thì được xoá, vì lịch sử còn trong git; repo không có git thì không xoá mà chuyển vào `archive/`.
- Chép bản handoff-standard gốc vào `handoff/` và xoá bản cũ; dựng đủ cấu trúc mục 1, kể cả `done/` và `archive/`.
- Xác định repo có phải agentic theo tiêu chí mục 14: phải thì dựng theo mục 14; không phải thì bỏ qua mục đó và không tạo `memory/`.
- Sinh lại `RULES.md`: thay toàn bộ phần bắt buộc ở mục 4 bằng bản mới, giữ luật riêng của repo còn đúng, sửa dòng đầu; luật riêng nào mâu thuẫn bản mới thì bản mới thắng, và luật bị thay được liệt kê trong AUDIT và trong "Đang treo, cần user".
- Sửa trọn vẹn mọi file đang dùng theo bản mới — AGENTS.md, CLAUDE.md, README, `RULES.md`, `STATE.md`, `MAP.md`, tài liệu vận hành ở gốc repo, `docs/`, phiếu đang mở, memory do agent viết — cả cấu trúc, tên trường, trạng thái lẫn từ ngữ ở mục 11; không đụng `memory/source/`.
- Phiếu trong `done/` và file trong `archive/` chỉ đổi từ ngữ theo mục 11, không đổi nội dung đã ký.
- **Ánh xạ thường gặp**: file luật cũ → `RULES.md`, phần lịch sử bỏ xuống HISTORY của phiếu này; ảnh chụp repo hay kiến trúc → `MAP.md`; file việc cũ → phiếu theo khuôn mục 3, phiếu đã đóng vào `done/`; nhật ký phiên và file điều phối kiểu cũ (todo, audit, history, failure, sessions) → gộp vào HISTORY của phiếu tương ứng rồi bỏ; bản thiết kế còn đúng → `docs/` với tiền tố `SPEC-`, đã chết → `archive/`; `memory/` giữ nếu repo agentic, không thì → `archive/`.
- README chưa đạt chuẩn mục 8 thì viết lại.
- Xong thì chạy toàn bộ phép thử của repo, quét toàn repo tìm đường dẫn cũ và từ ngữ cũ còn sót, dán cả hai kết quả vào AUDIT; bên còn lại soát rồi đóng phiếu.
- Kết thúc, repo chỉ còn một phòng bàn giao, và user nhận một đoạn ngắn bằng lời thường: đã đổi gì, có gì cần biết.

## 13. Luật chép

- **Được chép**: kết luận đã đóng, vì nó không đổi nữa nên không thể lệch — 3 dòng Kế thừa, một luật đã chốt, một con số đã soát đạt.
- **Cấm chép**: thứ còn sống, vì nó sẽ đổi ở bản gốc và bản chép thành sai — bản đồ repo, danh sách việc đang mở, nội dung `RULES.md`. Trỏ tới file gốc thay vì chép.

## 14. Repo agentic

- Repo agentic là repo mà sản phẩm có tác nhân AI chạy vòng lặp bên trong; chỉ repo loại này mới có `memory/` và mới chép mục này vào `RULES.md`.
- **Hai kho, hai tầng**: engine để làm (công cụ gọi được), memory để nghĩ (bài học, ca chuyên gia); mỗi kho có một tầng khung chung và một tầng riêng cho từng skill.
- Trước mỗi việc, kể cả việc vận hành, agent đọc mục lục của cả hai kho ở tầng chung và tầng skill liên quan; có sẵn thứ hợp thì dùng lại, thiếu thì thêm ở tầng hẹp nhất còn đúng.
- Mục lục engine (`ARSENAL.md`) do script sinh từ docstring, không ai sửa tay; mỗi module mở đầu bằng một dòng docstring nói năng lực của nó.
- Mục lục memory (`MEMORY.md`) do agent viết, khoảng 100 dòng; mỗi file bài học có `name`, `description` và đúng một dòng trong mục lục cùng tầng.
- Công cụ sinh ra cho skill nào nằm ở skill đó; skill thứ hai cần thì chuyển lên kho chung, không giữ hai bản; chỉ còn một skill dùng thì trả về skill đó.
- Script nháp dùng tới lần thứ hai thì chuyển vào engine, kèm phép thử và docstring.
- Phần riêng của từng trang web hay từng hãng là recipe trong memory, không viết thành module engine riêng.
- `memory/source/` là tài liệu user thả vào, không ai sửa hay xoá trừ khi user yêu cầu đích danh.
- Log, checkpoint, trace, cache và trạng thái máy không thuộc memory; chúng nằm ở thư mục chạy của skill hoặc thư mục trạng thái của khung.
- Mỗi file sinh ra đặt đúng chỗ theo vai ngay lúc sinh, không trông vào lượt dọn sau; bảng chỗ đặt nằm trong `RULES.md` của repo.
- Chạy lại cùng việc thì ghi đè hoặc dùng mã lần chạy mới; cấm hậu tố `-v2`, `_v2`, `-new`, `-final`, `copy` cho sản phẩm lúc chạy.
- Profile trình duyệt, cache và bộ đếm riêng máy chỉ nằm ở `.local/` và phải được khai trong cấu hình; profile mới chỉ tạo khi khác danh tính đăng nhập.
- Phép thử đơn vị chạy offline: mạng và trình duyệt phải mock hoặc skip.
- Repo có phép thử vệ sinh thì phiếu chỉ được đóng khi phép thử đó xanh và AUDIT liệt kê mọi file, thư mục mới tạo kèm chỗ đặt.
- Chạy Python trong repo bằng `python -B` để không sinh `__pycache__`.
