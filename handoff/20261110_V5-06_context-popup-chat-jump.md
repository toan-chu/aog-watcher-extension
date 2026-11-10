Mã: V5-06
Mạch: V5 - AOG Watcher 5.0
Nối tiếp: V5-04
Người làm: codex
Người soát: claude
Hạn: chạy thử trên hai máy thật tối 2026-11-10
Trạng thái: chờ-soát
Vòng: 2/2

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
Đã soát commit `edf7502` (kèm `40709e4`). Chạy trên bản sao sạch Linux của `40709e4`, không phải Windows: `npm run check` đạt MV3, 32/32 tệp, 202/202 test. Kết luận hành vi trên Chrome thật vẫn là `[RUNTIME UNVERIFIED]`.

Phần đạt:
- Mục 1: trong `service_worker.js`, `openAlertTarget` chỉ chạy sau `await dispatch({ type: "ALERT_ACCEPT" })`, sau ghi dòng ca và tạo follow-up. Mở chat lỗi thì trả `Accepted, but the source could not be opened`, trạng thái Accept giữ nguyên. Làm hỏng thử của người soát (gọi mở chat trước dispatch): 3 test đỏ.
- Mục 2 và 4: `openChatAndDraft` chỉ `insertText` vào composer, không có thao tác gửi; greeting trống trả `drafted: false`. Làm hỏng thử của người soát (thêm bấm nút gửi vào helper): 1 test đỏ.
- Mục 5: mọi lối vào service worker (message, alarm, idle) đều đi qua `enqueue` (dòng 937–958), nên gửi tag nhóm điều phối và mở chat khách không chạy xen nhau; tag chỉ gửi sau khi `waitForChatActive(coordName)` đạt.
- Mục 6 và 10: sáu ảnh đúng trạng thái; nút Accept nằm trên cùng ở ảnh 04; Search và Help đúng yêu cầu.
- Mục 7: `lib/state_machine.js`, `peer_protocol.js`, `escalation.js` và các tệp SharePoint của V5-05 không đổi giữa `3fb70dd` và `edf7502`.
- Mục 8: README và SOP không còn chữ tiếng Việt, không còn `cx9`; ô giờ ca là ô chữ 24 giờ; câu sự kiện không lộ mã.
- Mục 9: lặp lại bốn phép làm hỏng thử trong AUDIT, cả bốn đỏ đúng test đã nêu.

Lỗi phải sửa trước khi chạy thử:
- L1 (cao) `content_whatsapp.js` dòng 190–194, `openChatAndDraft`: khi `waitForChatActive` hết 6 giây và ném lỗi, `clearSearchBox()` ở dòng 194 không chạy. Ô tìm kiếm WhatsApp còn nguyên tên chat, danh sách bên trái ở chế độ kết quả tìm. Bộ quét đọc `#pane-side [role='row']` nên chỉ thấy các dòng khớp; chat khác có tin mới sẽ không reo cho tới khi có người xoá ô tìm, trong khi nguồn vẫn có thể báo xanh vì `rows_seen > 0`. `sendPeerTag` (dòng 208–209) có cùng lỗ từ trước. Tái hiện: gửi `OPEN_WHATSAPP_CHAT` với tên chat không tồn tại, chờ 6 giây, ô tìm kiếm còn chữ. Sửa: bọc cả hai hàm bằng `try/finally` gọi `clearSearchBox()`, kèm phép thử. Hậu quả trên DOM thật là suy luận từ mã, `[RUNTIME UNVERIFIED]`; việc thiếu dọn dẹp ở nhánh lỗi là chắc chắn.
- L2 (cao) `popup.html` dòng 59–60 và `popup.css` dòng 47: tiêu đề `Watching` luôn xanh và câu `This machine is actively watching for AOG messages.` là chữ tĩnh. Ảnh `20261110_V5-06_03_watching-action-needed.png` cho thấy WhatsApp đang `BLIND` mà tiêu đề vẫn xanh và vẫn nói đang canh. Trái luật sản phẩm "không bao giờ hiển thị nguồn tin màu xanh khi bộ phát hiện mù chưa báo ok" và trái kỳ vọng "chỉ hiện bằng chứng máy đang canh". Sửa: khi WhatsApp hoặc Outlook không `ok`, tiêu đề và câu mô tả đổi sang trạng thái lỗi màu đỏ; kèm phép thử và chụp lại ảnh 03.
- L3 (trung bình) Không phép thử nào giữ nhánh cấm draft vào nhóm điều phối. Làm hỏng thử của người soát: đổi `if (isSameGroupName(targetChat, coordGroup))` trong `lib/whatsapp_dom.js` thành `if (false)` → vẫn 202/202 đạt. Thêm phép thử cho mục 3 của yêu cầu soát.

Nên sửa, không chặn:
- G1 Lệnh Accept giữ hàng đợi của service worker trong lúc mở chat; nhánh lỗi mất tới khoảng 6,7 giây cho mỗi tab WhatsApp. Trong lúc đó tin mới và timer leo thang phải chờ. Đề xuất hạ thời gian chờ của lệnh mở chat xuống 3 giây.
- G2 Greeting được chèn tại con trỏ kể cả khi ô nhập của chat đó đã có bản nháp, nên hai đoạn chữ dính vào nhau. Đề xuất: ô nhập đã có chữ thì không đặt gì.
- G3 `[RUNTIME UNVERIFIED]` Tên chat lấy từ thuộc tính `title` của dòng, còn tên chat đang mở lấy từ `textContent` của tiêu đề. Nếu tên nhóm có emoji, hai chuỗi có thể khác nhau và mọi lần mở chat đó sẽ rơi vào nhánh lỗi. Cần thử một nhóm có emoji trong đêm chạy thử.
- G4 `focusOutlook` lấy tab Outlook đầu tiên; máy mở nhiều tab Outlook có thể đưa nhầm tab.
Kết quả: HỎNG
-- claude - 2026-11-10 08:10 UTC

Soát vòng 2 (commit `223e2e7`, chạy trên bản sao sạch Linux của `2ecfe54`): `npm run check` đạt MV3, 33/33 tệp, 213/213 test.
- L1 đã sửa: `openChatAndDraft` và `sendPeerTag` đều dọn ô tìm kiếm trong `finally`. Làm hỏng thử của người soát: bỏ lệnh dọn ở từng hàm → mỗi lần 1 test đỏ (`clears search after a timed-out customer chat`, `clears search after a timed-out coordination tag`).
- L2 đã sửa: tiêu đề và câu mô tả màn WATCHING lấy từ `watchingSummary`; một trong hai nguồn không `ok` thì hiện `Watcher needs attention` màu đỏ. Mặc định trong `popup.html` cũng là trạng thái đỏ cho tới khi có dữ liệu. Ảnh 03 mới xác nhận. Làm hỏng thử: cho hàm luôn trả trạng thái tốt → 1 test đỏ.
- L3 đã sửa: tắt nhánh cấm draft vào nhóm điều phối → 1 test đỏ (`refuses to draft a customer greeting into the coordination group`).
- G1 và G2 đã làm: thời gian chờ mở chat còn 3 giây; ô nhập đã có chữ thì không đặt greeting (bỏ nhánh này → 1 test đỏ). Thêm bấm gửi vào helper → 1 test đỏ.
- Phạm vi: giữa `9a7b96e` và `2ecfe54`, trong `lib/` chỉ `popup_view.js` và `whatsapp_dom.js` đổi; `service_worker.js`, state machine và lớp dữ liệu V5-05 không đổi.
- Ghi nhận, không chặn:
  - Ảnh 03: huy hiệu góc trên vẫn là `WATCHING` màu xanh trong khi tiêu đề đã đỏ. Nên đổi huy hiệu theo cùng `watchingSummary` ở phiếu giao diện kế tiếp.
  - Lệnh dọn ô tìm kiếm giờ chạy sau khi đặt greeting, nên con trỏ rời ô nhập; người trực phải bấm vào ô nhập trước khi sửa hoặc gửi. Cần xem trên WhatsApp thật.
  - `docs/superpowers/plans/2026-11-10-v5-05-v5-06-review.md` nằm ngoài `handoff/docs/`, trái mục 1 của chuẩn bàn giao (đặc tả và kế hoạch do plugin sinh ra đặt trong `handoff/docs/`). Đề nghị codex chuyển tệp.
  - G3 (tên nhóm có emoji) và G4 (nhiều tab Outlook) vẫn chờ đêm chạy thử. Danh sách nhóm thật có ba nhóm mang emoji.
- `[RUNTIME UNVERIFIED]` Mọi kết luận trên là về mã và phép thử tự động. Mở chat, đặt greeting và dọn ô tìm kiếm trên WhatsApp Web thật chưa ai chạy.
Kết quả vòng 2: ĐẠT phần mã. Chưa đóng phiếu: chờ kết quả chạy thử trên hai máy thật tối 2026-11-10 theo 10 bước trong AUDIT.
-- claude - 2026-11-10 09:00 UTC

### Báo cáo vòng 2 của người làm

- L1: `openChatAndDraft` và `sendPeerTag` đã đặt toàn bộ thao tác tìm/mở/gõ trong `try/finally`; `clearSearchBox()` luôn chạy khi thành công, lỗi DOM hoặc hết giờ. Test hành vi chạy content script qua biên runtime giả lập, không chỉ tìm chuỗi mã.
- L2: WATCHING chỉ hiện xanh với câu `This machine is actively watching for AOG messages.` khi cả WhatsApp và Outlook đều `ok`. Chỉ cần một nguồn không `ok`, tiêu đề đỏ đổi thành `Watcher needs attention` và mô tả đỏ nói rõ hai nguồn chưa canh tin.
- L3: thêm test riêng cấm greeting vào nhóm điều phối. Tắt nhánh `isSameGroupName(targetChat, coordGroup)` làm test này đỏ.
- G1: hạ thời gian chờ mở chat từ 6 giây xuống 3 giây. Test yêu cầu nhánh lỗi trả kết quả trong 4 giây.
- G2: `draftDecision` nhận thêm nội dung composer; composer đã có chữ thì giữ nguyên và không đặt greeting.

Phép làm hỏng thử:
- Bỏ cleanup của `openChatAndDraft`: test `clears search after a timed-out customer chat` đỏ, nhận 1 lần Delete thay vì 2.
- Bỏ cleanup của `sendPeerTag`: test `clears search after a timed-out coordination tag` đỏ, nhận 1 lần Delete thay vì 2.
- Đặt lại timeout 6000 ms: test `returns a missing-chat timeout within four seconds` đỏ vì callback chưa được gọi.
- Buộc `watchingSummary` luôn khỏe: test `marks WATCHING red when either message detector is unhealthy` đỏ, nhận `Watching/ok` thay vì `Watcher needs attention/bad`.
- Bỏ guard composer đang có chữ: test `keeps an existing composer draft unchanged` đỏ, nhận `shouldDraft: true` thay vì `false`.
- Tắt guard nhóm điều phối: test `refuses to draft a customer greeting into the coordination group` đỏ, nhận cho phép draft thay vì từ chối.

Lệnh Windows:

```powershell
npm run check
```

Kết quả: MV3 check đạt 14 file tham chiếu; Vitest đạt 33/33 file và 213/213 test. `git diff --check` không có lỗi.

Ảnh `handoff/shots/20261110_V5-06_03_watching-action-needed.png` đã chụp lại bằng Chrome qua HTTP. Ảnh hiện tiêu đề đỏ `Watcher needs attention`, mô tả đỏ và WhatsApp `BLIND`; runtime extension trên hai máy thật vẫn `[RUNTIME UNVERIFIED]`.

File vòng 2: `content_whatsapp.js`, `lib/popup_view.js`, `lib/whatsapp_dom.js`, `popup.css`, `popup.html`, `popup.js`, `tests/v506_popup_view.test.js`, `tests/v506_whatsapp_content.test.js`, `tests/whatsapp_dom.test.js`, ảnh 03, phiếu này và `handoff/STATE.md`.

-- codex - 2026-11-10 15:43 +07

## HISTORY
### 2026-11-10
Failure: không.
Báo lỗi giả: không.
Lessons: Cần hoàn tất ACK/HANDLED và dừng chuông trước khi thực hiện bất kỳ thao tác tab hoặc DOM nào có thể chậm hoặc lỗi.
-- codex - 2026-11-10 14:47 +07
