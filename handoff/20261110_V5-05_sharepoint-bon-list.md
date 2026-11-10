Mã: V5-05
Mạch: V5 - AOG Watcher 5.0
Nối tiếp: V5-04
Người làm: claude
Người soát: codex
Trạng thái: đang-làm
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
- [ ] Cập nhật `handoff/MAP.md` theo 4 bảng trước khi sửa mã.
- [ ] Lớp dữ liệu: schema 4 bảng, AOG_Log gộp Event/Signal/Machine, sổ ca mỗi người một dòng, lọc nhóm theo Active, tự dọn log.
- [ ] Chuỗi còn tiếng Việt trong `lib/sharepoint_client.js`, `lib/team_sync.js`, `lib/shift_row.js` đổi sang tiếng Anh.
- [ ] Phép thử kèm phép làm hỏng thử; `npm run check`.

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

Giả định kỹ thuật:

```
[GIẢ ĐỊNH KỸ THUẬT] Cột do máy ghi giữ kiểu chữ; chỉ các cột số của sổ ca (Hours, AlertCount, AcceptedCount, MissCount) là kiểu số, và cột người chọn (ChatType, Active, Slot1Role, Slot2Role) là kiểu lựa chọn.
Vì sao chọn: cột số để cộng lương bằng pivot; cột lựa chọn để trưởng ca không gõ sai; phần còn lại giữ chữ để máy ghi không bị từ chối vì sai kiểu.
Sai thì làm lại: tạo cột mới đúng kiểu và sửa chỗ ghi tương ứng trong lớp dữ liệu; SharePoint không đổi được kiểu chữ sang kiểu ngày tại chỗ.
```

Soát:
Kết quả:

## HISTORY
### 2026-11-10
Failure: file PnP bản 1.1 dừng ngay ở bảng đầu tiên vì claude giả định `Get-PnPList` trả về rỗng khi bảng chưa có, không kiểm bằng tài liệu hay file mẫu của user. Sửa ở bản 1.2.
Báo lỗi giả: không
Lessons: lệnh PnP tra một thứ chưa tồn tại thì ném lỗi; luôn bọc try/catch như các file PnP sẵn có của user.
-- claude - 2026-11-10 07:23 UTC
