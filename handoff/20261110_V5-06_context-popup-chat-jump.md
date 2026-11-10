Mã: V5-06
Mạch: V5 - AOG Watcher 5.0
Nối tiếp: V5-04
Người làm: codex
Người soát: claude
Hạn: chạy thử trên hai máy thật tối 2026-11-10
Trạng thái: chờ-soát
Vòng: 1/2

## ĐỀ BÀI
Kỳ vọng của user (2026-11-10):
- "Chọn A: popup tự đổi theo tình huống. Chưa vào ca thì chỉ hiện nút vào ca. Đang canh thì chỉ hiện bằng chứng máy đang canh. Đang reo thì chỉ hiện tên nhóm và nút Accept."
- "4A + làm sẵn nền cho tab tìm kiếm và soạn tin."
- "Ví dụ hiện tại bay thẳng tới chat thì đi kèm câu chào, email thì soạn sẵn template respond email."
- "Trong lúc chat với khách, khách hỏi lô đang làm, thay vì tab sang sharepoint thì mở extension lên, sang tab tìm kiếm, sdt của khách đã input sẵn -> extension tự search các lô -> click vào là tự có thông tin lô trong ô chat ready to enter to send."
- "1 trong những chức năng tôi nghĩ đáng tiền nhất là bay thẳng tới chat."
- "Button HELP nối thẳng tới github để người ta đọc README"
- "Giao diện này chưa đc, cần có thêm preview whats going on cho User trong lúc setting và sau khi setting."

Mục tiêu:
- Popup có ba màn hình tình huống trong tab Tonight: OFF SHIFT, WATCHING và RINGING; mỗi lần chỉ hiện một màn hình.
- Tab Search dựng đúng khung cho luồng tra lô sau này nhưng chưa nối dữ liệu; tab Help dẫn tới README công khai; Settings vẫn có lối vào riêng.
- Accept tin WhatsApp hoàn tất dừng chuông và HANDLED trước, sau đó mở đúng chat và đặt câu chào vào ô nhập nhưng không gửi. Tin Outlook chỉ đưa tab Outlook lên trước.
- Sự kiện gần đây là câu tiếng Anh dễ đọc và có thể mở lại đúng nguồn mà không đặt câu chào.
- README.md và docs/SOP.md viết lại bằng tiếng Anh theo giao diện mới và site `https://trustanavn.sharepoint.com/sites/aog`.

Ngoài phạm vi:
- Preview trong Settings, chọn chuông từ thư mục, màn hình ướm cột SharePoint, soạn sẵn thư trả lời Outlook và tìm lô thật.
- Không đổi state machine, peer protocol, timer leo thang hoặc lớp dữ liệu SharePoint của V5-05.

Kiến trúc và kế hoạch triển khai:

### Task 1 - View-model và ba màn hình popup
- Tạo `lib/popup_view.js` với hàm thuần chọn mode, định dạng giờ 24 giờ, thời gian tương đối và câu sự kiện.
- Viết test RED cho ba mode và câu sự kiện; sau đó dựng lại `popup.html`, `popup.css`, `popup.js` với ba màn hình và tab Tonight/Search/Help.
- RINGING đặt Accept trước mọi nội dung cảnh báo; WATCHING hiện bằng chứng nguồn, SharePoint, máy trực cùng, chuông thử, sự kiện gần nhất và từng việc cần làm của preflight.

### Task 2 - Mở chat an toàn và draft câu chào
- Thêm cài đặt local `whatsapp_greeting`, mặc định `Well received. We are checking and will revert shortly.`; Settings cho sửa và cho phép để trống.
- Mở rộng helper WhatsApp dùng chung: mở chat bằng search, chờ đúng chat, kiểm chat không phải nhóm điều phối, đặt draft nếu có chữ và tuyệt đối không bấm Send.
- Service worker chỉ gọi điều hướng sau `dispatch(ALERT_ACCEPT)` hoàn tất. Fallback tag qua nhóm điều phối vì vậy luôn chạy xong trước khi mở chat khách.
- Viết test RED cho sai chat không draft, greeting rỗng không draft, Accept vẫn về IDLE dù điều hướng lỗi, và sự kiện gần đây mở chat không greeting.

### Task 3 - Tài liệu, ảnh và bằng chứng
- Viết lại README.md và docs/SOP.md bằng tiếng Anh.
- Chụp sáu ảnh qua trình duyệt thật phục vụ từ HTTP: off shift, watching đạt, watching có lỗi, ringing, Search, Help.
- Chạy mutation riêng cho từng nhóm bằng chứng bắt buộc, chạy `npm run check`, ghi hướng dẫn thử tay hai máy vào AUDIT.

Review focus:
- Accept phải dừng chuông và phát HANDLED trước mọi thao tác tab/DOM có thể lỗi.
- Draft chỉ được đặt khi tên chat hiện tại khớp chat đích và chat đích không phải nhóm điều phối.
- Không có đường nào bấm Send trong helper draft khách.
- Greeting rỗng vẫn mở chat nhưng không thay đổi composer.
- Popup không trộn nội dung của hai mode hoặc hai tab.

Kịch bản test:
- KS-1 Không có session → chỉ màn OFF SHIFT hiện; có session → chỉ WATCHING hiện; alerting → chỉ RINGING hiện.
- KS-2 Trong RINGING, Accept là control đầu tiên; cảnh báo hệ thống và chat lạ nằm dưới Accept.
- KS-3 Chat mở sai tên đích → composer không đổi và popup nhận lỗi tiếng Anh.
- KS-4 `whatsapp_greeting` rỗng → mở chat đúng nhưng không đặt chữ.
- KS-5 Accept WhatsApp dừng chuông và gửi HANDLED trước khi mở chat; fallback tag xong mới chuyển khỏi nhóm điều phối.
- KS-6 Accept Outlook chỉ focus tab Outlook; sự kiện gần đây mở nguồn không kèm greeting.
- KS-7 Mọi giờ hiển thị là `HH:mm` hoặc `HH:mm:ss`; sự kiện gần đây không lộ mã sự kiện.
- KS-8 Sáu ảnh đúng trạng thái nằm trong `handoff/shots/`; `npm run check` đạt trên Windows.

Giả định kỹ thuật:

```text
[GIẢ ĐỊNH KỸ THUẬT] “Đồng hồ tới lúc máy dự phòng bị gọi” đếm tới primary_timeout_seconds từ detected_at; khi máy hiện tại đã là Backup thì hiện “Backup is active” thay vì số âm.
Vì sao chọn: primary timeout là mốc hệ thống phát ESCALATED gọi máy dự phòng; backup_delay là mốc dự phòng tự reo nếu tín hiệu không tới.
Sai thì làm lại: đổi công thức hiển thị sang backup_delay_seconds; state machine và timer không đổi.
```

```text
[GIẢ ĐỊNH KỸ THUẬT] Tab Search lấy tên chat đang mở tại lúc user mở tab; không duy trì polling DOM WhatsApp khi user ở Tonight hoặc Help.
Vì sao chọn: đúng nhu cầu điền sẵn nhưng không tăng tải quét DOM mỗi hai giây.
Sai thì làm lại: thêm trường active chat vào heartbeat CONTENT_HEALTH và cập nhật input theo status.
```

## TODO
- [x] Task 1 RED → GREEN: view-model và ba màn hình popup.
- [x] Task 2 RED → GREEN: navigation, greeting và guard không gửi.
- [x] Task 3: tài liệu tiếng Anh, sáu ảnh và hướng dẫn test hai máy.
- [x] Mutation cho bốn phép thử bắt buộc; `npm run check`.
- [x] AUDIT, `STATE.md`, commit V5-06 riêng, chuyển `chờ-soát`.
- [x] Sau commit V5-06, commit riêng phần `handoff/` và `tools/` đang treo của claude theo lệnh user.

## AUDIT
Báo cáo của người làm:

### Kết quả sản phẩm
- Popup chỉ hiện một trong ba màn hình OFF SHIFT, WATCHING hoặc RINGING. Nút `ACCEPT — I'LL HANDLE IT` là control đầu tiên khi đang reo.
- WATCHING hiện bằng chứng từ WhatsApp, Outlook, SharePoint, máy trực cùng, lần thử chuông và sự kiện gần nhất. Pre-shift chưa đạt được tách thành từng việc cần làm.
- Tab Search lấy tên chat WhatsApp đang mở và ghi rõ dữ liệu lô chưa kết nối. Tab Help mở README trên GitHub.
- Accept WhatsApp hoàn tất dừng chuông và HANDLED trước khi mở chat. Helper kiểm đúng tên chat, cấm draft vào nhóm điều phối, chỉ đặt chữ vào composer, không có thao tác Send.
- Greeting mới là cài đặt local `whatsapp_greeting`. Giá trị mặc định là `Well received. We are checking and will revert shortly.`; để trống thì không thay đổi composer.
- Sự kiện gần đây là câu tiếng Anh thường, không lộ mã event. Giờ trên popup được tự định dạng 24 giờ, không dùng locale Windows.

### Bằng chứng RED → GREEN
- Task 1 RED: `npx vitest run tests/v506_popup_view.test.js tests/popup_static.test.js tests/v50_brand_ui.test.js tests/v503_english_copy.test.js` có 4 test đỏ do thiếu chọn mode, thứ tự Accept, giờ 24h và câu event. Sau cài đặt: 4 file, 24/24 test xanh.
- Task 2 RED: test mới có 5 lỗi do chưa có `draftDecision`, greeting mặc định, helper draft và điều hướng. Sau cài đặt và test tích hợp service worker: 3 file, 17/17 test xanh.

### Phép làm hỏng thử
- Ba màn hình: tạm cho `popupMode()` luôn trả `watching`; test `selects exactly one Tonight screen` đỏ với `expected off-shift, received watching`.
- Accept trên cùng: tạm chuyển nút xuống sau cảnh báo; test đỏ với vị trí `[434,231,531,621]` không bằng thứ tự tăng `[231,434,531,621]`.
- Sai chat đích: tạm bỏ nhánh mismatch; test đỏ vì nhận `{ok:true, shouldDraft:true}` thay vì từ chối draft.
- Greeting trống: tạm cho nhánh trống draft; test đỏ vì `shouldDraft` là `true` thay vì `false`.
- Sau khi hoàn nguyên: `npx vitest run tests/v506_popup_view.test.js tests/whatsapp_dom.test.js` đạt 2 file, 9/9 test.

### Kiểm tra Windows
Lệnh:

```powershell
npm run check
```

Kết quả: MV3 package check đạt 14 file tham chiếu; Vitest đạt 32/32 file và 202/202 test.

### Ảnh giao diện
- `handoff/shots/20261110_V5-06_01_off-shift.png`
- `handoff/shots/20261110_V5-06_02_watching-ready.png`
- `handoff/shots/20261110_V5-06_03_watching-action-needed.png`
- `handoff/shots/20261110_V5-06_04_ringing.png`
- `handoff/shots/20261110_V5-06_05_search.png`
- `handoff/shots/20261110_V5-06_06_help.png`

Các ảnh được chụp bằng Chromium thật từ trang popup phục vụ qua HTTP, với trạng thái runtime giả lập. Chúng xác nhận bố cục và nội dung, không thay thế phép thử extension trên hai máy thật.

### Hướng dẫn user thử trên hai máy Chrome thật
1. Trên cả hai máy, mở `chrome://extensions`, bật Developer mode, bấm Reload cho AOG Watcher. Mở sẵn WhatsApp Web và Outlook Web; đăng nhập cùng SharePoint site `https://trustanavn.sharepoint.com/sites/aog`.
2. Mở popup khi chưa vào ca. Xác nhận chỉ thấy vai trò tối nay, nút Start shift và giờ ca đang gập. Chọn máy A là Primary, máy B là Backup, rồi bấm Start shift trên cả hai.
3. Mở lại popup. Xác nhận màn WATCHING có WhatsApp, Outlook, SharePoint, partner machine, sound test và latest event. Nếu pre-shift thiếu, làm lần lượt từng dòng đỏ cho tới khi màn hình sẵn sàng.
4. Từ một tài khoản khách, gửi tin mới vào một chat WhatsApp đã theo dõi. Trên máy A, xác nhận popup chuyển sang RINGING, Accept nằm trên cùng, có tên chat và đếm ngược tới Backup.
5. Bấm `ACCEPT — I'LL HANDLE IT`. Xác nhận chuông dừng ngay, máy B nhận HANDLED và không reo, WhatsApp được đưa lên trước, đúng chat khách mở ra và câu chào nằm trong ô nhập nhưng chưa được gửi. Chỉ bấm Send sau khi người trực đã đọc và chỉnh câu.
6. Vào Settings, xóa trắng WhatsApp greeting và Save. Tạo alert WhatsApp mới, bấm Accept và xác nhận đúng chat vẫn mở nhưng ô nhập không bị thay đổi. Sau đó khôi phục greeting mặc định.
7. Tạo alert email Outlook. Bấm Accept và xác nhận Outlook chỉ được đưa lên trước; extension không soạn hoặc gửi email.
8. Trong WATCHING, bấm một sự kiện WhatsApp gần đây. Xác nhận đúng chat mở ra và không có greeting được đặt.
9. Mở tab Search. Xác nhận tên chat WhatsApp đang mở được điền sẵn và có dòng `Shipment list is not connected yet`. Mở tab Help, bấm README và xác nhận trang GitHub đúng mở ra.
10. Bấm End shift trên cả hai máy. Xác nhận popup trở lại OFF SHIFT.

### File V5-06 đã đổi
`README.md`, `content_whatsapp.js`, `docs/SOP.md`, `lib/constants.js`, `lib/popup_view.js`, `lib/whatsapp_dom.js`, `popup.css`, `popup.html`, `popup.js`, `service_worker.js`, `settings.html`, `settings.js`, `tests/popup_static.test.js`, `tests/v503_english_copy.test.js`, `tests/v50_brand_ui.test.js`, `tests/v50_service_worker.test.js`, `tests/v506_chat_jump.test.js`, `tests/v506_popup_view.test.js`, `tests/whatsapp_dom.test.js`, phiếu này, `handoff/STATE.md` và sáu file PNG nêu trên.

### Giới hạn bằng chứng
`[RUNTIME UNVERIFIED]` Luồng hai máy thật, HANDLED qua peer và DOM WhatsApp/Outlook với tài khoản thật phải được user hoặc claude chạy tối 2026-11-10 theo 10 bước trên. Unit/integration test và ảnh Chromium không thể chứng minh phần này.

Soát:
Kết quả:

## HISTORY
### 2026-11-10
Failure: không.
Báo lỗi giả: không.
Lessons: Cần hoàn tất ACK/HANDLED và dừng chuông trước khi thực hiện bất kỳ thao tác tab hoặc DOM nào có thể chậm hoặc lỗi.
-- codex - 2026-11-10 14:47 +07
