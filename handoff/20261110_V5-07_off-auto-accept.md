Mã: V5-07
Mạch: V5 - AOG Watcher 5.0
Nối tiếp: V5-06
Người làm: codex
Người soát: claude
Hạn: user và Ethan chạy thử ngày 2026-11-11 qua nhóm test
Trạng thái: chờ-soát
Vòng: 2/2

## ĐỀ BÀI
Kỳ vọng của user (2026-11-10):

Lời một người trực do user chuyển:
- "em chỉ đề xuất bỏ cái chuông của người back-up khi đang ko ở ca trực thôi. Vì mọi người hầu hết ngoài ca của mình đều tắt Watcher, em hỏi chưa thấy ai là bật cả"
- "Mà người trực ca trước thường online ngủ muộn, nên sẽ xử lý việc luôn mà ko bấm Acknowledge => Ảnh hưởng đến người trực sau. Kể cả khi người trực sau đến ca mới bật => Hệ thống cũng sẽ đổ 1 loạt chuông liên hồi, tắt ko xuể"

Lời user:
- "Update cái vừa nói -> codex làm."
- "Mai tôi và Ethan sẽ đóng vai Primary & Secondary. 1 người sẽ nhắn vào nhóm AOG test (đã có mặt trong AOG_Group sharepoint list)."

Mục tiêu:
- Mỗi slot có thêm vai trò Off. Trong giờ Off hoặc ngoài mọi slot trực, máy không reo, không nhận leo thang và không làm máy kia báo mất liên lạc hay chưa vào ca.
- Máy đang trực nhưng không có Backup trong ca vẫn READY và hiện dòng thông tin `No backup on duty`.
- Mở đúng chat WhatsApp đang có alert trên máy này được tính là Accept an toàn, kể cả alert đang chờ; ghi cách nhận `open_chat`, gửi HANDLED và giữ nguyên follow-up.
- Khi có ít nhất hai alert có thể nhận, popup hiện `Accept all (N)` ngay dưới nút Accept; nhận hết nhưng chỉ mở chat của alert đang reo.
- Sửa huy hiệu WATCHING không còn xanh khi nguồn đang lỗi.

Ngoài phạm vi:
- Không tự nhận thư Outlook khi người trực mở thư vì DOM hiện tại chưa cung cấp bằng chứng đủ chắc chắn để phân biệt đúng thư.
- Không đổi giao thức HANDLED/ESCALATED, thời gian leo thang, logic follow-up hoặc hành vi đặt greeting của nút Accept hiện tại.

Ràng buộc:
- Dòng chat biến mất khỏi DOM không được tính là đã nhận. Chỉ đúng chat đang mở hoặc dòng chat vẫn hiện và unread bằng 0 mới hợp lệ.
- Không tự nhận khi nguồn WhatsApp đang mù hoặc chưa đọc được.
- Alert trong slot Off phải có sự kiện `SKIPPED_OUT_OF_SHIFT`.
- Không bao giờ tự gửi tin cho khách.

Thiết kế:
- `lib/shift_engine.js` là nơi duy nhất chuẩn hoá Primary/Backup/Off và xác định một thời điểm có đang làm nhiệm vụ hay không. Heartbeat mang kèm hai slot trong `Detail`; máy còn lại dùng lịch này để coi heartbeat cũ là Off sau giờ ca, kể cả trình duyệt đã đóng.
- Content script WhatsApp gửi một quan sát gồm tên chat đang mở và các dòng chat còn hiện có unread bằng 0. Service worker chỉ đối chiếu quan sát này với alert WhatsApp đang ALERTING/QUEUED và chỉ xử lý khi bộ phát hiện WhatsApp đang `ok`.
- State machine có hai hành động mới: nhận một alert theo `alert_id` và nhận toàn bộ alert có thể xử lý. Mỗi alert phát đúng một HANDLED, huỷ timer của chính nó và ghi ACCEPT kèm `accept_method`.
- Service worker dùng chung một đường hoàn tất Accept để tạo follow-up và cập nhật dòng ca. Nút Accept dùng `button`; quan sát WhatsApp dùng `open_chat`. Accept all mở duy nhất chat đang reo sau khi trạng thái và HANDLED đã hoàn tất.

Kịch bản test:
- KS-1 Slot Off: alert được ghi nhưng không reo; chuyển sang Primary thì alert mới reo.
- KS-2 Peer đang Off hoặc đã hết lịch rồi mất heartbeat: máy còn lại không báo `Partner machine lost` và không nhận nhắc chưa vào ca.
- KS-3 Alert đang reo, mở đúng chat: chuông dừng, timer bị huỷ, có HANDLED và ACCEPT với `accept_method=open_chat`.
- KS-4 Ba alert ở ba chat, mở một chat: chỉ alert khớp được nhận.
- KS-5 Dòng chat biến mất: alert vẫn reo; WhatsApp mù: quan sát không được nhận.
- KS-6 Accept all ba alert: ba HANDLED, không còn alert có thể nhận và trở về WATCHING.
- KS-7 Baseline cũ và signal cũ khi Start shift không tạo chuông.
- KS-8 Popup có Off, `No backup on duty`, pending count và `Accept all (N)` đúng vị trí; badge lỗi không xanh.

Giả định kỹ thuật:

```text
[GIẢ ĐỊNH KỸ THUẬT] Heartbeat ghi lịch slot vào Detail và vẫn đọc được heartbeat Detail kiểu mảng cũ.
Vì sao chọn: máy còn lại phải tự suy ra người kia đã hết ca kể cả heartbeat cuối cùng được ghi trước ranh giới ca; không thêm bảng hay giao thức mới.
Sai thì làm lại: thêm cột lịch riêng trong AOG_Log và migration SharePoint, rồi đổi lớp đọc heartbeat của cả hai máy.
```

```text
[GIẢ ĐỊNH KỸ THUẬT] Không tự nhận Outlook trong V5-07.
Vì sao chọn: content Outlook hiện chỉ chứng minh dòng unread trong danh sách, chưa chứng minh đúng thư đã được mở; đoán sai sẽ làm mất chuông.
Sai thì làm lại: thêm nhận diện message id của thư đang mở, bằng chứng DOM và bộ test riêng trước khi nối vào Accept theo mã.
```

## TODO
- [x] Task 1 RED → GREEN: Off, lịch heartbeat, nhắc ca và `No backup on duty`.
- [x] Task 2 RED → GREEN: Accept theo mã, Accept all và `accept_method`.
- [x] Task 3 RED → GREEN: bằng chứng mở chat WhatsApp và guard nguồn mù/dòng biến mất.
- [x] Task 4 RED → GREEN: popup Off, badge lỗi, pending count và Accept all.
- [x] Chụp ba ảnh giao diện; chạy các phép làm hỏng thử và `npm run check` trên Windows.
- [x] Ghi AUDIT, cập nhật `STATE.md`, chuyển `chờ-soát`, commit riêng và push.

## AUDIT
### Kết quả sản phẩm
- Alert mới trong slot `Off` và thời gian nằm ngoài mọi slot không reo. Alert đã reo hoặc chờ từ slot trước được chuyển bằng `ESCALATED` cho peer đang trực; nếu không có peer đang trực, máy hiện tại tiếp tục reo đến khi Accept hoặc hết thời gian tối đa rồi ghi `MISSED`.
- Heartbeat mang lịch hai slot nhưng vẫn đọc được `Detail` kiểu mảng cũ. Máy kia tự nhận ra peer đã Off sau ranh giới ca, kể cả heartbeat cuối đã cũ; không tạo `Partner machine lost` hoặc nhắc chưa vào ca.
- Máy đang trực một mình vẫn `READY`; popup hiện `No backup on duty` như thông tin màu vàng.
- Mở đúng chat WhatsApp đang có alert nhận đúng alert đó với `accept_method=open_chat`, kể cả alert đang chờ hoặc đã leo thang sang Backup. Không điều hướng, không đặt greeting và không gửi tin. Dòng chat biến mất hoặc nguồn WhatsApp không khỏe không được tính là Accept.
- `Accept all (N)` xuất hiện từ hai alert, nằm ngay dưới nút Accept chính, phát một `HANDLED` cho mỗi alert và chỉ mở chat đang reo. Nút Accept thường giữ nguyên hành vi mở chat rồi đặt greeting nhưng không gửi.
- Huy hiệu màn WATCHING đổi thành `ATTENTION` màu đỏ khi WhatsApp hoặc Outlook lỗi.
- Không tự nhận Outlook khi user mở thư; mục này được giữ ngoài phạm vi vì chưa có bằng chứng DOM đủ chắc chắn.

### RED → GREEN và phép làm hỏng thử
- Baseline trước khi sửa: `npm run check` đạt 33 tệp, 213 test.
- Các test mới giữ: Off rồi Primary; chuông đang reo gặp ranh giới Off; peer có lịch Off; nhắc ca bỏ Off; không có Backup vẫn READY; ghi vai trò Off vào dòng ca; nhận alert đang chờ theo mã; Accept all ba alert; mở đúng chat không điều hướng/greeting; chỉ nhận một trong ba chat; nguồn mù không nhận; Backup nhận alert đã leo thang; baseline và signal cũ không reo; dòng chat biến mất không được xem là đã đọc; badge lỗi và ngưỡng hai alert.
- Đã lần lượt làm hỏng và thấy test đỏ khi: bỏ chuẩn hóa `Off`; bỏ lịch trong heartbeat; chỉ cho nhận alert hiện tại; Accept all chỉ nhận alert đầu; tắt guard nguồn mù; ghi nhớ dòng chat đã biến mất; đổi ngưỡng nút thành ba; ép badge luôn xanh; bỏ dọn cảnh báo peer Off; vô hiệu hóa xử lý `DUTY_ENDED`. Sau mỗi lần đã khôi phục và chạy lại xanh.
- Phép thử bổ sung bắt được việc đổi vai trò theo lịch từng làm thay `session.started_at`; đường đồng bộ vai trò nay giữ nguyên giờ bắt đầu ca.

### Bằng chứng Windows
Lệnh:
```powershell
npm run check
```
Kết quả ngày 2026-11-10: `MV3 check passed (14 referenced files)`, `34 passed (34)`, `237 passed (237)`.

Lệnh:
```powershell
git diff --check
```
Kết quả: rỗng; Git chỉ báo trước việc đổi LF sang CRLF của checkout Windows.

### Ảnh Chromium thật
- `handoff/shots/20261110_V5-07_01_off-role.png`: tùy chọn Off trong lịch ca.
- `handoff/shots/20261110_V5-07_02_no-backup-on-duty.png`: WATCHING/READY khi không có Backup.
- `handoff/shots/20261110_V5-07_03_accept-all.png`: màn RINGING có nút Accept chính, `Accept all (3)` và số alert chờ.

### User và Ethan tự thử ngày 2026-11-11
1. Trên cả hai máy, tải bản mới nhất; nếu dùng Download ZIP thì giải nén trước, vào `chrome://extensions`, bật Developer mode rồi bấm `Load unpacked` hoặc `Reload` tại extension cũ.
2. Mở WhatsApp Web, Outlook và SharePoint; trong Settings bấm `Sign in & check` và xác nhận ba nguồn không báo đỏ.
3. Bật Test mode; đặt một máy Primary, máy còn lại Backup, bấm `Start shift`, `Test ring`, rồi `I hear it` trên cả hai máy.
4. Tắt Test mode trên một máy, đặt slot hiện tại là Off; để máy kia trong slot Primary rồi nhờ người thứ ba gửi vào nhóm AOG TEST. Máy Off phải im và máy Primary phải reo.
5. Đóng Chrome ở máy Off trong hơn thời gian kiểm tra heartbeat. Máy Primary vẫn phải READY, chỉ hiện `No backup on duty`, không báo mất máy hoặc chưa vào ca.
6. Bật lại Test mode trên hai máy. Khi AOG TEST làm chuông reo, tự mở đúng chat AOG TEST trên WhatsApp: chuông cả hai máy phải dừng, ô soạn không có greeting mới và log ghi cách nhận `open_chat`.
7. Tạo alert ở ba chat test khác nhau rồi tự mở một chat: chỉ alert của chat đó biến mất, hai alert còn lại vẫn chờ.
8. Tạo lại ba alert, bấm `Accept all (3)`: toàn bộ chuông dừng, chỉ chat đang reo được mở, greeting chỉ được đặt sẵn và tuyệt đối không tự gửi.
9. Tạo một alert mới, bấm nút Accept chính: đúng chat mở, greeting nằm trong ô soạn nhưng chưa gửi; xóa dòng nháp sau khi kiểm tra.
10. Gửi một email test có tiêu đề AOG rồi bấm Accept: Outlook được đưa lên trước; chỉ việc tự mở email không được tự tính là Accept.
11. Trong SharePoint kiểm tra AOG_Log có `ACCEPT`, `HANDLED` và cách nhận; AOG_Shifts có đúng người, vai trò slot và số alert của mỗi máy.
12. Bấm `End shift` trên cả hai máy và tắt Test mode.

### File thay đổi
`content_whatsapp.js`; `service_worker.js`; `popup.html`; `popup.css`; `popup.js`; `lib/alert_queue.js`; `lib/constants.js`; `lib/heartbeat.js`; `lib/popup_view.js`; `lib/preflight.js`; `lib/shift_engine.js`; `lib/shift_reminder.js`; `lib/shift_row.js`; `lib/state_machine.js`; các test liên quan; phiếu, kế hoạch, ảnh và `handoff/STATE.md`.

[RUNTIME UNVERIFIED] Chưa có kết quả chạy thật đồng thời trên hai máy; KS-1 đến KS-8 chờ user và Ethan thử ngày 2026-11-11.

Soát:
Đã soát commit `b196815` so với `2ecfe54`. Chạy trên bản sao sạch Linux, không phải Windows: `npm run check` đạt MV3, 34/34 tệp, 237/237 test. Đã xem ba ảnh. Hành vi trên Chrome thật vẫn `[RUNTIME UNVERIFIED]`.

Phần đạt:
- Slot Off đi qua một chỗ chuẩn hoá (`lib/shift_engine.js`); tin trong slot Off ghi `SKIPPED_OUT_OF_SHIFT`; nhắc mở ca bỏ qua slot Off.
- Peer Off: heartbeat mang lịch slot, `evaluatePeers` coi peer hết lịch là off kể cả heartbeat đã cũ; `Detail` kiểu mảng cũ vẫn đọc được.
- Nhận theo mã và Accept all trong state machine: mỗi tin một HANDLED, huỷ timer của chính tin đó, ghi `accept_method`. Giao thức hai máy và mốc thời gian leo thang không đổi.
- Guard nguồn WhatsApp không `ok` thì không tự nhận; dòng chat biến mất không vào `visible_read_chats`.
- Huy hiệu `ATTENTION` đỏ khi nguồn lỗi; Accept all nằm ngay dưới Accept (ảnh 03); tệp kế hoạch đã về `handoff/docs/`.

Lỗi phải sửa:
- L1 (cao, làm lọt tin) `service_worker.js`, `handleWhatsAppReadObservation`: `active_chat` được tính là bằng chứng đã đọc dù dòng chat vẫn còn tin chưa đọc và không có ai ở máy. `content_whatsapp.js` gửi `WHATSAPP_READ_OBSERVED` ở cuối mọi lần quét, kèm tên chat đang mở. Người trực để WhatsApp ở đúng chat của một khách rồi đi ngủ; khách đó nhắn tiếp; tin được phát hiện rồi bị tự nhận ngay trong cùng lần quét: chuông dừng, HANDLED được gửi, máy dự phòng không bao giờ được gọi. Phép thử tái hiện của người soát (thêm vào `tests/v50_service_worker.test.js`, chạy rồi gỡ):

```text
START_SHIFT → ALERT_DETECTED { group_name: "AOG ONE", unread_count: 1, active_conversation: "AOG ONE" }
→ WHATSAPP_READ_OBSERVED { active_chat: "AOG ONE", visible_read_chats: [] }
expect(status.app_state).toBe("ALERTING")
AssertionError: expected 'IDLE' to be 'ALERTING'
```

  Phép thử hiện có `opening the exact ringing WhatsApp chat Accepts without navigation or greeting` dùng đúng dữ liệu này và coi đó là đạt, nên nó không phân biệt được "người trực vừa mở chat" với "chat vốn đang mở sẵn". Yêu cầu sửa: tên chat đang mở một mình không bao giờ là bằng chứng. Chỉ nhận khi có một trong hai: (a) dòng chat đó còn hiện và số chưa đọc bằng 0 trong hai lần quét liên tiếp; hoặc (b) chat đó đang mở và trang WhatsApp đang có focus (`document.hasFocus()` và trang đang hiển thị) tại lúc quét. Cần phép thử cho cả hai chiều và phép làm hỏng thử.
- L2 (cao, làm lọt tin) `lib/state_machine.js`, `DUTY_ENDED`: khi slot chuyển sang Off lúc đang có tin reo hoặc chờ, máy dừng chuông, huỷ timer, đánh dấu `SKIPPED` và không báo máy nào. Phép thử `stops a ringing alert and cancels its escalation timers when the slot becomes Off` còn khẳng định không có `PEER_ESCALATED_SENT`. Tin đến lúc 02:29 mà người ca trước chưa nhận sẽ biến mất lúc 02:30: máy ca sau không được báo, và nếu máy ca sau vừa Start shift thì tin đó nằm trong baseline nên cũng không reo. Yêu cầu sửa: tin chưa ai nhận lúc hết ca phải được chuyển cho máy đang trực và máy đó reo. Khi không có máy nào đang trực, máy hiện tại tiếp tục reo cho tới khi có người Accept hoặc hết thời gian reo tối đa rồi ghi MISSED; không được bỏ im lặng.
- L3 (cao, báo sai trạng thái) `lib/popup_view.js`: khi đã Start shift nhưng slot hiện tại là Off, `popupMode` trả `watching` và `watchingSummary` chỉ xét nguồn, nên popup hiện `Watching` xanh và `This machine is actively watching for AOG messages` trong khi máy sẽ không reo. `startShift` giờ cũng đặt vai trò Off khi bấm Start shift ngoài mọi slot (trước đây mặc định Primary), nên người bấm Start shift lệch giờ sẽ thấy màn xanh mà máy im. Yêu cầu sửa: trong slot Off hoặc ngoài mọi slot, màn hình và huy hiệu ghi rõ máy đang Off, sẽ không reo, và giờ bắt đầu slot trực kế tiếp; không dùng màu xanh. Cần ảnh cho trạng thái này.

Nên sửa, không chặn:
- G1 `lib/shift_row.js` ghi `Slot1Role`, `Slot2Role` từ cài đặt của máy lên AOG_Shifts, đè lên lịch trưởng ca đã xếp. Hai cột này được thiết kế cho trưởng ca điền. Đề xuất: máy không ghi hai cột này.
- G2 Ảnh 03 hiện `Calling Backup in 01:22` trong khi không có máy dự phòng nào đang trực. Khi không có Backup, dòng này nên ghi rõ không có ai để gọi.
- G3 Ảnh 01 ghi `You are Off tonight` trong khi Slot 2 là Primary. Câu này nên nói vai trò theo từng slot.
- G4 Sau khi sửa L1, một lần đọc số chưa đọc bằng 0 do WhatsApp vẽ lại dòng không được đủ để tự nhận; điều kiện hai lần quét liên tiếp ở L1(a) xử lý việc này.

Câu hỏi treo cho user (không chặn vòng 2): theo thói quen mỗi người chỉ bật máy trong ca của mình, tin đến trước giờ người ca sau bấm Start shift và chưa ai nhận sẽ không reo trên máy ca sau, vì luật "tin có trước Start shift không reo". Lỗ này có từ 4.3. L2 chỉ che được trường hợp hai máy cùng đang chạy lúc đổi ca.
Kết quả: HỎNG
-- claude - 2026-11-11 02:14 UTC

### AUDIT vòng 2
- L1: `active_chat` không còn là bằng chứng. Content script chỉ gửi `focused_active_chat` khi trang WhatsApp vừa có focus vừa đang hiển thị; một dòng chat unread bằng 0 phải ổn định qua hai lần quét liên tiếp, với lần quét xác nhận được tự hẹn. Service worker chỉ nhận hai loại bằng chứng này và vẫn giữ guard nguồn WhatsApp phải `ok`.
- L2: khi máy chuyển Off và có peer đang trực, mọi alert chưa nhận được gửi bằng `ESCALATED`, timer cục bộ bị hủy và peer Primary hoặc Backup đều có thể reo. Nếu không có peer đang trực, máy hiện tại không bỏ alert mà tiếp tục reo; timer tối đa vẫn chạy và ghi `MISSED` nếu hết hạn.
- L3: máy đã Start shift nhưng slot hiện tại Off hiện `OFF DUTY`, `This machine will not ring` và giờ bắt đầu duty kế tiếp, dùng màu cảnh báo thay vì xanh. Ảnh Chromium thật: `handoff/shots/20261111_V5-07_04_off-duty-in-slot.png`.
- G1: extension không còn ghi `Slot1Role`/`Slot2Role` vào AOG_Shifts, nên không đè lịch do trưởng ca điền. G2: màn RINGING ghi `No backup on duty` khi không có Backup. G3: màn chưa Start shift mô tả từng slot, ví dụ `Slot 1 Off · Slot 2 Primary`.
- Theo quyết định bổ sung của user, đã bỏ cột độc lập `Customer` khỏi schema AOG_Groups và tài liệu; giá trị `Customer` của cột `ChatType` giữ nguyên.
- Phép làm hỏng thử đã đỏ: dùng lại `active_chat` làm bằng chứng; cho một lần unread bằng 0 là đủ; bỏ nhánh bàn giao khi peer đang trực; bỏ nhánh hiển thị Off duty. Test schema cũng đỏ khi thêm lại cột độc lập `Customer`.
- Lệnh Windows: `npm run check`. Kết quả: `MV3 check passed (14 referenced files)`, `34 passed (34)`, `246 passed (246)`.
- `git diff --check` không có lỗi khoảng trắng; cảnh báo LF→CRLF là quy tắc checkout Windows.
- File vòng 2: `content_whatsapp.js`, `service_worker.js`, `lib/heartbeat.js`, `lib/state_machine.js`, `lib/shift_engine.js`, `lib/popup_view.js`, `lib/shift_row.js`, `lib/sp_schema.js`, `popup.html`, `popup.css`, `popup.js`, README/SOP, test, ảnh, phiếu và `handoff/STATE.md`.
- [RUNTIME UNVERIFIED] Chưa chạy bàn giao tại ranh giới ca và tự Accept trên hai máy Chrome thật; user và Ethan vẫn cần chạy kịch bản trong phiếu.

-- codex - 2026-11-11 09:31 +07

## HISTORY
### 2026-11-10
Failure: không.
Báo lỗi giả: không.
Lessons: chưa có.
