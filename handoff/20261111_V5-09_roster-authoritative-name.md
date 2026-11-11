Mã: V5-09
Mạch: V5 - AOG Watcher 5.0
Nối tiếp: V5-08
Người làm: codex
Người soát: claude
Trạng thái: chờ-soát
Vòng: 1/2

## ĐỀ BÀI
Quyết định của user (2026-11-11): `Title` (`OperatorName`) trong `AOG_Shifts` là chuẩn cho tên người trực.

Mục tiêu:
1. Khi **Sign in & check** và khi **Start shift**, tìm dòng đêm nay theo `ShiftDate + Email`. Nếu `Display name` khác `Title`, tự cập nhật `self_display_name` và hiện `Name updated to "<Title>" from tonight's roster`.
2. Máy không ghi đè `Title` của dòng đã có. Chỉ ghi `Title` khi máy phải tự tạo dòng mới.
3. Nếu không có dòng đêm nay cho email đó, WATCHING hiện cảnh báo đỏ `You are not on tonight's roster. Contact the shift lead.` Máy vẫn theo dõi, vẫn reo và vẫn tạo dòng như hiện nay. Không đoán tên gần đúng.
4. Giữ nhánh dòng có `Email` trống: nhận theo `ShiftDate + Title` và chỉ nhận dòng chưa có email.
5. Tên đã sửa được dùng ở mọi nơi máy ghi tên: `OperatorName` trong AOG_Log, dòng Machine và tín hiệu gửi máy kia.
6. Cập nhật mục 3 và mục 9 trong `README.md`, `README.vi.md`: tên lấy từ AOG_Shifts; Display name chỉ dùng khi chưa có dòng.

Ngoài phạm vi:
- `ShiftDate` tiếp tục là chữ `YYYY-MM-DD`.
- Máy vẫn chưa đọc `Slot1Role`/`Slot2Role`.
- Không đổi giao diện khác, peer protocol, state machine hoặc timer leo thang.

Thiết kế:
- Service worker dùng một hàm đối chiếu roster cho cả `SP_TEST` và `START_SHIFT`: ưu tiên `ShiftDate + Email`; nếu không thấy thì tìm đúng `ShiftDate + Title` và chỉ nhận dòng có email trống.
- Kết quả đối chiếu được lưu local để preflight hiển thị cảnh báo.
- Mọi update Start/End đều bỏ `Title` khỏi fields. `Title` nằm riêng trong `create_fields`, nên lớp upsert chỉ dùng nó khi thật sự tạo dòng mới; cảnh báo không có trong roster vẫn giữ tới lần đối chiếu mới.

Kịch bản test:
- KS-1 `Display name = Lahe`, roster `Title = Leah`: Sign in và Start shift cập nhật tên, trả đúng thông báo.
- KS-2 Start/End không ghi đè `Title` của dòng roster đã có.
- KS-3 Không có dòng: preflight có cảnh báo đỏ đúng chữ, alert vẫn reo, máy vẫn tạo một dòng.
- KS-4 Dòng đúng `ShiftDate + Title` với email trống được nhận và điền email, không tạo dòng thứ hai.
- KS-5 Sau sửa tên, dòng Machine và Event trong AOG_Log mang `Leah`; payload tín hiệu cũng mang `Leah`.

```text
[GIẢ ĐỊNH KỸ THUẬT] Cảnh báo “không có trong roster” giữ nguyên trong suốt ca dù máy đã tự tạo dòng vận hành.
Vì sao chọn: dòng máy tự tạo không biến người đó thành người đã được trưởng ca xếp; cảnh báo phải tiếp tục yêu cầu liên hệ trưởng ca.
Sai thì làm lại: đổi trạng thái roster thành đạt ngay sau lần tạo dòng đầu tiên và bỏ cảnh báo trong lần refresh preflight kế tiếp.
```

## TODO
- [x] RED → GREEN: đối chiếu roster, sửa tên và thông báo ở Sign in/Start shift.
- [x] RED → GREEN: không ghi đè Title, vẫn tạo dòng và cảnh báo khi thiếu roster, giữ fallback email trống.
- [x] RED → GREEN: tên mới đi vào Machine, Event và signal.
- [x] Cập nhật README song ngữ, MAP, chạy phép làm hỏng thử và `npm run check` Windows.
- [x] Ghi AUDIT, cập nhật STATE, chuyển `chờ-soát`, commit và push.

## AUDIT

Ngày chạy: 2026-11-11, máy Windows của user.

### RED trước khi sửa mã

```powershell
npx vitest run tests/v50_logic.test.js tests/v50_service_worker.test.js
```

Kết quả: 7 test đỏ, đúng các nhánh chưa có: cảnh báo roster, fallback Email trống, sửa tên và thông báo, bảo vệ Title, vẫn reo/tạo dòng khi thiếu roster, và tên mới trong Machine/Event/Signal.

### GREEN tập trung

```powershell
npx vitest run tests/v50_logic.test.js tests/v50_sharepoint.test.js tests/v50_service_worker.test.js
```

Kết quả: 3 tệp đạt, 72 test đạt.

### Phép làm hỏng thử

Mỗi thay đổi tạm thời bên dưới được hoàn nguyên ngay sau khi test đỏ:

1. Tắt nhánh cập nhật `self_display_name` → test `takes the operator name...` đỏ vì không có thông báo và tên vẫn là `Lahe`.
2. Cho `create_fields.Title` lọt vào nhánh update → test `gives each operator...` đỏ vì `Title` từ `A` thành `Wrong`.
3. Tắt mục preflight `roster` → test `warns when no roster...` đỏ vì mất cảnh báo.
4. Đưa `Email eq ''` trở lại filter fallback → test `claims a matching name row...` đỏ vì Email `null` tạo dòng thứ hai.
5. Ép Machine ghi `Lahe` → test `uses the roster-corrected name...` đỏ.
6. Không xoá `fields.Title` khỏi update Start/End → test `never overwrites an existing roster Title...` đỏ.

### Kiểm toàn bộ

```powershell
npm run check
```

Kết quả: MV3 đạt; 34/34 tệp test đạt; 259/259 test đạt.

```powershell
git diff --check
```

Kết quả: rỗng; PowerShell chỉ báo cảnh báo chuyển LF/CRLF, không có lỗi whitespace.

### Phạm vi và kết quả

- Không đổi state machine, peer protocol hoặc timer leo thang.
- `Title` chỉ nằm trong `create_fields`; thao tác update không thể ghi đè tên roster, kể cả có dòng được tạo giữa lúc đối chiếu và lúc flush outbox.
- Fallback theo tên lọc Email trống/null sau khi lấy đúng `ShiftDate + Title`, không đoán gần đúng.
- Chưa chạy trên Chrome thật; phiếu chờ claude soát mã.
- File đổi: `README.md`, `README.vi.md`, `handoff/MAP.md`, `handoff/STATE.md`, phiếu và kế hoạch V5-09, `lib/constants.js`, `lib/preflight.js`, `lib/shift_row.js`, `lib/team_sync.js`, `service_worker.js`, `settings.js`, `tests/v50_logic.test.js`, `tests/v50_service_worker.test.js`, `tests/v50_sharepoint.test.js`.

## HISTORY
### 2026-11-11
Failure: chưa có.
Báo lỗi giả: chưa có.
Lessons: trường chỉ dùng khi tạo mới phải được tách khỏi trường update ngay tại lớp upsert; xoá ở service worker thôi vẫn có thể dính race.
