Mã: V5-05
Mạch: V5 - AOG Watcher 5.0
Nối tiếp: V5-04
Người làm: claude
Người soát: codex
Trạng thái: chờ-soát
Vòng: 1/2

## ĐỀ BÀI
Kỳ vọng của user (2026-11-10):
- "event machine & signal gộp lại đc (cần cơ chế tự xóa bớt sau vài tháng, hoặc đặt ra luật là user phải vào xóa), group (sau này sẽ còn flyer -> nhóm chat với người mang hàng bay qua nc ngoài), setting, shifts (cái này thì vừa cho phép trưởng ca sắp xếp, vừa ghi nhận log handling của 2 người -> tính tiền lương)."
- "AOG Extension phải đc thiết kế để sau này có đổi sharepoint list thì vẫn work."
- "Tôi có powershell 7 và pnp, nên tạo thế cho nhanh."
- User chọn trong hội thoại: sổ ca mỗi người một dòng mỗi đêm; log tự xoá sau 90 ngày.
- Site: "https://trustanavn.sharepoint.com/sites/aog"

Mục tiêu:
- Dữ liệu chung của AOG Watcher nằm trong 4 bảng trên site AOG: AOG_Groups, AOG_Settings, AOG_Shifts, AOG_Log, thay cho 6 bảng của 5.0.
- Sổ ca dùng được cho trưởng ca xếp lịch và cho việc tính lương; log của máy tự được dọn.
- Lớp dữ liệu chỉ biết tên chức năng và tên trường, để phiếu sau thêm được màn hình ướm cột mà không viết lại.

Ngoài phạm vi:
- Màn hình quét và ướm cột trong extension.
- Làm lại giao diện popup và Settings.
- Máy tự đọc lịch trưởng ca xếp.

Kế thừa:
- V5-04: hành động nhận tin tên là ACCEPT; giao thức hai máy vẫn là HANDLED/ESCALATED.
- V5-03: site mặc định là `sites/aog`; chuỗi lỗi SharePoint còn tiếng Việt trong ba tệp claude giữ, sửa trong phiếu này.
- Luật sản phẩm: mọi ghi SharePoint đi qua outbox; chuông không bao giờ chờ SharePoint.

Kịch bản test:
- KS-1 User chạy `tools/Setup-AogSharePoint.ps1` một lần → site AOG có đúng 4 bảng với đủ cột; chạy lần hai → báo "Nothing to do", không tạo trùng.
- KS-2 Người trực bấm Add to shared list cho một chat lạ → trong 2 phút dòng mới xuất hiện ở AOG_Groups và máy kia bắt đầu canh nhóm đó.
- KS-3 Trưởng ca đặt Active = No cho một nhóm → trong 15 phút cả hai máy thôi canh nhóm đó; dòng vẫn còn trong bảng.
- KS-4 Hết một đêm có 2 người trực → AOG_Shifts có đúng 2 dòng của đêm đó, mỗi dòng có giờ vào, giờ ra, số giờ, số tin đã Accept. Tuyệt đối không: hai máy ghi đè lên dòng của nhau.
- KS-5 Máy chính Accept → máy dự phòng không reo cho tin đó; AOG_Log có dòng Signal và dòng Event tương ứng.
- KS-6 Dòng AOG_Log cũ hơn số ngày trong cài đặt `log_keep_days` tự mất trong vòng một ngày; AOG_Shifts không mất dòng nào.
- KS-7 SharePoint lỗi giữa ca → máy vẫn reo; khi nối lại, dữ liệu tự ghi bù.

## TODO
- [x] File PnP `tools/Setup-AogSharePoint.ps1` (bản 1.0) tạo 4 bảng, chạy lại được, không xoá gì.
- [x] User chạy file trên site AOG ngày 2026-11-10: 4 bảng đủ cột (nửa đầu KS-1).
- [ ] User chạy lại lần hai để thấy "Nothing to do" (nửa sau KS-1).
- [x] Cập nhật `handoff/MAP.md` theo 4 bảng.
- [x] Lớp dữ liệu: schema 4 bảng, AOG_Log gộp Event/Signal/Machine, sổ ca mỗi người một dòng, lọc nhóm theo Active, tự dọn log.
- [x] Chuỗi còn tiếng Việt trong `lib/sharepoint_client.js`, `lib/team_sync.js`, `lib/shift_row.js` đổi sang tiếng Anh.
- [x] Phép thử kèm phép làm hỏng thử; `npm run check` trên bản sao Linux.
- [ ] Chạy KS-2..KS-7 trên hai máy Windows thật. `[RUNTIME UNVERIFIED]`
- [ ] Người soát (codex) soát mã và chạy `npm run check` trên Windows.

## AUDIT
Báo cáo của người làm:
- 2026-11-10: đã viết `tools/Setup-AogSharePoint.ps1`. Chưa chạy được ở phía claude vì môi trường của claude không có PowerShell và không vào được tenant → `[RUNTIME UNVERIFIED]` cho tới khi user chạy trên máy thật.
- Cột `Type` của AOG_Groups đặt tên nội bộ là `ChatType` để không trùng tên chung chung.
- 2026-11-10: file lên bản 1.1, thêm cột `Customer` (tên khách) vào AOG_Groups, để sau này từ một nhóm chat tra ra được khách và các lô của khách đó. Mã ứng dụng PnP của user không nằm trong repo công khai; user chạy qua một file gọi riêng nằm ngoài repo.

- 2026-11-10: lần chạy đầu của user hỏng ở bản 1.1 vì `Get-PnPList -Identity` ném lỗi khi bảng chưa có; sửa thành try/catch ở bản 1.2. Kết quả user dán sau khi chạy bản 1.2 trên máy Windows thật:

```text
Lists on this site:
  AOG_Groups     6/6 columns present
  AOG_Settings   2/2 columns present
  AOG_Shifts     14/14 columns present
  AOG_Log        17/17 columns present
```

- 2026-11-10, lớp dữ liệu 4 bảng:
  - `lib/sp_schema.js`: 4 bảng đúng như file PnP; thêm kiểu cột Number, Boolean, Choice và chỉ mục cho nút Create lists trong extension.
  - `lib/team_sync.js`: tín hiệu hai máy, nhịp tim máy và hộp đen cùng ghi vào AOG_Log, phân biệt bằng `RecordType`; nhóm có `Active = No` bị bỏ qua, bảng không có cột `Active` vẫn đọc được; thêm `purgeOldLog` đưa dòng cũ vào thùng rác của site.
  - `lib/shift_row.js`: mỗi người một dòng mỗi đêm, khớp theo `ShiftDate` và `Email` (không có email thì theo tên); ghi `Hours`, `AlertCount`, `AcceptedCount`, `MissCount` dạng số.
  - `lib/sharepoint_client.js`: thông báo lỗi tiếng Anh; thêm `recycleItem`.
  - `lib/shared_settings.js`, `lib/constants.js`: cài đặt chung mới `log_keep_days` (mặc định 90).
  - `service_worker.js`: chỉ đổi chỗ gọi lớp dữ liệu (ghi vào AOG_Log, dòng ca theo người, gọi dọn log mỗi ngày một lần). Không đổi state machine, giao thức hai máy, timer.
  - `settings.html`: sửa đúng một chữ "six" thành "four" trong câu mô tả nút Create lists. Tệp này thuộc phiếu V5-06 của codex; claude sửa vì con số sai là hệ quả trực tiếp của phiếu này.
  - Phép thử: `tests/v50_sharepoint.test.js`, `tests/v50_logic.test.js`, `tests/v50_service_worker.test.js`, `tests/v50_static.test.js`.
- Lệnh và kết quả, bản sao Linux của cây làm việc (HEAD `40709e4` cộng thay đổi của phiếu này), ngày 2026-11-10:

```text
> npm run check
MV3 check passed (14 referenced files).
Test Files  32 passed (32)
Tests  206 passed (206)
```

- Làm hỏng thử (cố ý làm hỏng → đỏ, rồi hoàn nguyên → 206/206):

```text
bỏ lọc Active                              → 1 failed (stops watching a group the team lead switched off ...)
nhịp tim máy không khớp theo RecordType    → 1 failed (keeps one heartbeat row per machine ...)
dọn log không xét tuổi dòng                → 1 failed (removes log rows older than the keep period ...)
dòng ca chỉ khớp theo ngày                 → 1 failed (finds the operator's own row by email ...)
đọc tín hiệu không lọc RecordType          → 1 failed (reads only new, recent signals ... ignores event rows)
```

- 2026-11-10, bổ sung sau khi user đưa lịch trực chỉ có tên, không có email: khi không có dòng nào khớp `ShiftDate` và `Email`, máy nhận dòng cũ nhất khớp `ShiftDate` và `OperatorName` mà cột `Email` còn trống, rồi điền email vào. Dòng cùng tên đã có email của người khác thì không đụng. Tệp đổi thêm: `lib/team_sync.js` (`upsertByMatch` nhận `fallbackMatch`, `claimField`), `lib/shift_row.js` (`shiftRowFallbackMatch`), `service_worker.js` (một dòng trong `writeShiftRow`), hai tệp test. Sau bổ sung: 32 tệp, 207 test đạt. Làm hỏng thử: bỏ nhánh fallback → 1 test đỏ; nhận cả dòng đã có email → 1 test đỏ.
- Điều kiện để khớp theo tên: tên hiển thị gõ trong Settings của máy phải đúng y tên trong cột `OperatorName` của lịch.
- Lệch so với đề bài: không.
- `README.md` đã nêu đủ 4 bảng (codex viết trong V5-06); không cần sửa thêm.
- Bẫy cũ "dòng ca trực dùng chung hai máy" trong STATE.md không còn đúng; đã thay bằng bẫy mới.

Giả định kỹ thuật:

```
[GIẢ ĐỊNH KỸ THUẬT] Dọn AOG_Log bằng cách đưa dòng vào thùng rác của site, gọi thẳng không qua outbox, tối đa 100 dòng mỗi lần.
Vì sao chọn: thùng rác cho phép lấy lại trong trường hợp dọn nhầm; lỗi dọn không được làm SharePoint bị báo đỏ.
Sai thì làm lại: đổi `recycleItem` sang xoá hẳn, hoặc đưa lệnh dọn vào outbox; chỉ sửa `purgeOldLog` và `purgeLog`.
```

```
[GIẢ ĐỊNH KỸ THUẬT] SharePoint so khớp `Email eq '...'` không phân biệt hoa thường, nên dòng trưởng ca tạo sẵn với email viết hoa vẫn được máy tìm thấy.
Vì sao chọn: tránh thêm một bước đọc hết dòng của đêm để tự so.
Sai thì làm lại: đọc các dòng theo ShiftDate rồi so email đã chuẩn hoá trong `upsertByMatch`.
```


```
[GIẢ ĐỊNH KỸ THUẬT] Cột do máy ghi giữ kiểu chữ; chỉ các cột số của sổ ca (Hours, AlertCount, AcceptedCount, MissCount) là kiểu số, và cột người chọn (ChatType, Active, Slot1Role, Slot2Role) là kiểu lựa chọn.
Vì sao chọn: cột số để cộng lương bằng pivot; cột lựa chọn để trưởng ca không gõ sai; phần còn lại giữ chữ để máy ghi không bị từ chối vì sai kiểu.
Sai thì làm lại: tạo cột mới đúng kiểu và sửa chỗ ghi tương ứng trong lớp dữ liệu; SharePoint không đổi được kiểu chữ sang kiểu ngày tại chỗ.
```

Soát:
- Đã soát diff commit `9a7b96e` trên máy Windows của user, bao gồm bổ sung khớp dòng ca theo tên khi lịch chưa có email.
- Lệnh `npm run check` đạt MV3 check 14 file tham chiếu, 33/33 file test và 213/213 test. Con số gồm 6 test V5-06 vòng 2 đã có trong cùng cây; riêng test V5-05 là 15 test SharePoint, 23 test logic, 8 test service worker và 8 test static.
- Đã lặp lại bảy phép làm hỏng. Cả bảy đều đỏ đúng nhánh, sau đó hoàn nguyên và chạy lại 213/213 xanh:
  - Bỏ lọc `Active`: test `stops watching a group the team lead switched off` đỏ vì `Old customer` vẫn được canh.
  - Bỏ `RecordType: Machine` khỏi khớp heartbeat: test `keeps one heartbeat row per machine` đỏ vì dòng Event bị ghi đè.
  - Bỏ điều kiện tuổi khi dọn log: test `removes log rows older than the keep period` đỏ, dọn 5 dòng thay vì 2.
  - Chỉ khớp dòng ca theo ngày: test `finds the operator's own row by email, or by name when the email is unknown` đỏ vì thiếu email/tên.
  - Bỏ `RecordType: Signal` khỏi truy vấn tín hiệu: test `reads only new, recent signals` đỏ vì dòng Event bị đọc như tín hiệu.
  - Bỏ fallback theo tên: test logic dòng ca đỏ vì `shiftRowFallbackMatch` trả `null`.
  - Cho fallback nhận cả dòng đã có email: test `fills in the row the shift lead scheduled by name` đỏ vì dòng của người trùng tên bị ghi đè.
- Truy vấn đọc Signal lọc `RecordType = Signal`; truy vấn đọc Machine và khớp heartbeat lọc `RecordType = Machine`. Hai thao tác cố ý xuyên ba loại là `latestSignalId` (chỉ lấy ID mới nhất làm mốc, không diễn giải nội dung) và `purgeOldLog` (dọn Event/Signal/Machine theo tuổi và đọc `RecordType` để giữ heartbeat sống). Không có dòng Event nào được diễn giải thành Signal hoặc Machine.
- `writeShiftRow` lấy danh tính của chính máy, khớp `ShiftDate + Email`; chỉ khi không thấy email mới fallback sang `ShiftDate + OperatorName`, và chỉ nhận dòng có `Email` trống. Mọi lần ghi dòng ca đều đưa vào outbox.
- `purgeLog` tự bắt lỗi recycle, ghi `LOG_PURGE_FAILED` local và trả về bình thường; `syncTeam` sau đó vẫn đặt SharePoint `ok`. Lỗi dọn log không làm SharePoint hiện đỏ.
- `git diff 40709e4 9a7b96e -- lib/state_machine.js lib/peer_protocol.js lib/escalation.js` trả về rỗng. State machine, peer protocol và escalation timer không đổi.
- `[RUNTIME UNVERIFIED]` KS-2 đến KS-7 vẫn cần chạy trên hai máy thật. Kết quả soát mã không thay thế bằng chứng này, nên phiếu chưa đóng.

Kết quả: ĐẠT PHẦN MÃ; giữ `chờ-soát` cho KS-2 đến KS-7 trên hai máy thật.
-- codex - 2026-11-10 15:49 +07

- 2026-11-10: theo quyết định mới của user, đã xoá `tools/Setup-AogSharePoint.ps1` khỏi repo vì file PnP nội bộ đã chuyển ra ngoài; README và SOP từ nay chỉ hướng dẫn tạo bốn bảng bằng **Settings → Create lists**.
-- codex - 2026-11-10 15:51 +07

## HISTORY
### 2026-11-10
Failure: file PnP bản 1.1 dừng ngay ở bảng đầu tiên vì claude giả định `Get-PnPList` trả về rỗng khi bảng chưa có, không kiểm bằng tài liệu hay file mẫu của user. Sửa ở bản 1.2.
Báo lỗi giả: không
Lessons: lệnh PnP tra một thứ chưa tồn tại thì ném lỗi; luôn bọc try/catch như các file PnP sẵn có của user.
-- claude - 2026-11-10 08:22 UTC
