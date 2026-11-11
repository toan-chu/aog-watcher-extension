# AOG Watcher v5.0.0 — Hướng dẫn sử dụng

[English](README.md) · **Tiếng Việt**

> AOG Watcher theo dõi WhatsApp Web và Outlook trong ca đêm, reo chuông cho đúng người trực, gọi máy Backup khi cần, và ghi lại mọi việc lên SharePoint.

Tên nút và màn hình trong extension là tiếng Anh. Bản hướng dẫn này giữ nguyên các tên đó trong **chữ đậm** để bạn tìm đúng chỗ bấm.

## Mục lục

1. [AOG Watcher làm gì](#1-aog-watcher-làm-gì)
2. [Ai làm việc gì](#2-ai-làm-việc-gì)
3. [Hai luật bắt buộc: Tên và Email](#3-hai-luật-bắt-buộc-tên-và-email)
4. [Người trực: cài đặt lần đầu](#4-người-trực-cài-đặt-lần-đầu)
5. [Người trực: vào ca và nhận tin](#5-người-trực-vào-ca-và-nhận-tin)
6. [Trưởng ca: điền lịch trực vào AOG_Shifts](#6-trưởng-ca-điền-lịch-trực-vào-aog_shifts)
7. [Trưởng ca: quản lý nhóm WhatsApp trong AOG_Groups](#7-trưởng-ca-quản-lý-nhóm-whatsapp-trong-aog_groups)
8. [Giải thích từng mục Settings](#8-giải-thích-từng-mục-settings)
9. [Ý nghĩa các cột trên SharePoint](#9-ý-nghĩa-các-cột-trên-sharepoint)
10. [Khi có sự cố](#10-khi-có-sự-cố)

## 1. AOG Watcher làm gì

- Theo dõi WhatsApp Web và hộp thư AOG trên Outlook Web trong lúc bạn trực.
- Có tin từ nhóm khách đang theo dõi thì máy reo liên tục cho đến khi có người bấm **Accept**.
- Người Primary không nhận kịp thì máy Backup reo.
- Bấm Accept một tin WhatsApp: chuông tắt, máy kia được báo, đúng chat của khách được mở ra và câu chào được đặt sẵn vào ô nhập.

**AOG Watcher không bao giờ tự gửi tin.** Bạn đọc câu chào rồi tự bấm Gửi. Nếu chat đang mở không đúng chat cần mở, extension không đặt gì vào ô nhập.

Với thư Outlook, Accept chỉ đưa cửa sổ Outlook lên trước.

Popup có ba màn hình:

- **OFF SHIFT:** vai trò tối nay và nút **Start shift**.
- **WATCHING:** WhatsApp, Outlook, SharePoint, máy kia và chuông thử có đang chạy tốt không.
- **RINGING:** nút **Accept**, tên nhóm khách hoặc tiêu đề thư, và thời gian còn lại trước khi gọi Backup.

## 2. Ai làm việc gì

| Người | Việc |
|---|---|
| Người trực | Cài extension một lần, đăng nhập, bắt đầu và kết thúc ca, nhận tin. |
| Trưởng ca | Điền lịch trực hằng tuần vào `AOG_Shifts`, cập nhật danh sách nhóm trong `AOG_Groups`, đăng thiết lập chung. |

Mọi dữ liệu nằm trên site SharePoint `https://trustanavn.sharepoint.com/sites/aog`, gồm bốn list: `AOG_Groups`, `AOG_Settings`, `AOG_Shifts`, `AOG_Log`.

## 3. Hai luật bắt buộc: Tên và Email

Extension tìm dòng của bạn trong `AOG_Shifts` bằng **ShiftDate + Email**. Email không khớp thì máy không tìm thấy dòng trưởng ca đã xếp và **tự tạo thêm một dòng mới**. Giờ vào ca và số tin của bạn bị ghi vào dòng mới, nên bảng lương có hai dòng cho cùng một đêm.

**Luật 1: Email.** Cột `Email` phải đúng y địa chỉ Microsoft 365 bạn dùng để đăng nhập SharePoint.

- Người trực: mở **Settings**, bấm **Sign in & check**. Dòng kết quả hiện `Signed in: Tên bạn <email của bạn>`. Địa chỉ trong ngoặc nhọn chính là email cần dùng. Gửi địa chỉ này cho trưởng ca một lần.
- Trưởng ca: chép đúng địa chỉ đó vào cột `Email` ở mọi dòng của người đó. Không có dấu cách ở đầu hoặc cuối, không dùng Gmail cá nhân, không dùng địa chỉ phụ khác của công ty.

**Luật 2: Tên.** Cột `Title` (trong `AOG_Shifts` hiện tên là **OperatorName**) phải đúng y **Display name** người trực nhập trong Settings.

- Mỗi người dùng một tên tiếng Anh, không ai trùng tên ai.
- Khi bấm **Start shift**, extension ghi Display name của bạn vào cột `Title` của dòng đó. Trưởng ca ghi "Leah" mà bạn nhập "leah t." thì tên trên dòng bị đổi thành "leah t.".

Cách kiểm cả hai luật: sau lần **Start shift** đầu tiên, mở `AOG_Shifts`. Dòng đêm nay do trưởng ca xếp phải có giờ trong cột `CheckIn`, và không có thêm dòng nào khác mang tên bạn cho cùng đêm đó.

## 4. Người trực: cài đặt lần đầu

1. Tải repo này về và giải nén vào một thư mục cố định. Sau này không xoá hay di chuyển thư mục đó.
2. Mở `chrome://extensions` (hoặc `edge://extensions`), bật **Developer mode**, bấm **Load unpacked**, chọn thư mục vừa giải nén, rồi ghim AOG Watcher lên thanh công cụ.
3. Mở popup, bấm **Settings**.
4. Ở mục **1. SharePoint AOG**, giữ nguyên link `https://trustanavn.sharepoint.com/sites/aog` và bấm **Sign in & check**.
   - Nếu báo `Could not connect`: bấm **Open SharePoint**, đăng nhập bằng tài khoản công ty, rồi bấm lại **Sign in & check**.
   - Ghi lại địa chỉ trong `Signed in: … <email>` (luật 1).
5. Ở mục **2. Operator**, nhập **Display name** (luật 2).
6. Xem lại **WhatsApp greeting**. Để trống nếu không muốn đặt câu chào sau Accept.
7. Bấm **Save settings**.
8. Mở WhatsApp Web và đăng nhập. Mở Outlook Web ở hộp thư AOG.
9. Mỗi lần cập nhật extension, tải lại tab WhatsApp và tab Outlook.

Các thiết lập chung (hộp thư, thời gian, nhóm điều phối) được tải tự động từ SharePoint, bạn không cần tự gõ.

## 5. Người trực: vào ca và nhận tin

### Đặt vai trò cho tối nay

Một đêm có hai slot. **Slot 1** là nửa đầu đêm (mặc định 22:00–02:30). **Slot 2** là nửa sau (mặc định 02:30–07:00).

Ở màn **OFF SHIFT**, mở **Tonight's shift times** và chọn vai trò cho từng slot:

| Vai trò | Máy làm gì trong slot đó |
|---|---|
| Primary | Reo ngay khi có tin. |
| Backup | Reo khi Primary không nhận kịp, hoặc khi tin đã chờ quá lâu. |
| Off | Không reo. Chọn Off cho slot bạn không trực. |

Giờ dùng dạng 24 giờ `HH:mm`. Hiện tại mỗi máy lấy vai trò từ popup này, chưa đọc cột `Slot1Role`/`Slot2Role` trên SharePoint.

### Bắt đầu ca

1. Mở WhatsApp Web và Outlook Web ở hộp thư AOG.
2. Mở popup, kiểm vai trò, bấm **Start shift**.
3. Màn hình chuyển sang **WATCHING**. Xử lý từng dòng đỏ cho đến khi nhãn hiện **READY**:
   - **WhatsApp / Outlook:** phải có giờ kiểm tra gần đây.
   - **SharePoint:** phải kết nối được.
   - **Partner machine:** máy kia phải đang trong ca.
   - **Test ring heard:** bấm **Test ring**, nghe chuông, rồi bấm **I hear it**.

Bước kiểm này không làm máy ngừng theo dõi, nó chỉ báo những gì chưa sẵn sàng.

### Khi máy reo

1. Bấm **ACCEPT — I'LL HANDLE IT**. Chuông tắt và máy kia được báo.
2. Với WhatsApp: chat của khách mở ra, câu chào đã nằm trong ô nhập. Kiểm đúng chat rồi tự bấm Gửi.
3. Có nhiều tin đang chờ thì nút **Accept all (N)** nhận tất cả một lần.

Bạn cũng có thể nhận tin mà không cần mở popup:

- Mở đúng chat đang reo trên WhatsApp và đọc nó khi bạn đang ngồi ở máy. Việc này được tính là Accept.
- Số tin chưa đọc của chat đó về 0 và giữ ở 0 qua hai lần quét liên tiếp: cũng được tính là Accept.

Chat đang mở trên máy không có ai dùng (màn hình khoá hoặc không đụng chuột, bàn phím) không được tính.

### Kết thúc ca

Bấm **End shift**, rồi bấm lần nữa để xác nhận. Extension ghi `CheckOut` và `Hours` vào dòng của bạn.

## 6. Trưởng ca: điền lịch trực vào AOG_Shifts

Mỗi người mỗi đêm **một dòng**.

| Cột | Điền gì | Ví dụ |
|---|---|---|
| Title (OperatorName) | Display name của người trực, đúng từng ký tự (luật 2) | `Alex` |
| ShiftDate | Ngày của **buổi tối** bắt đầu đêm trực, dạng `YYYY-MM-DD` | `2026-11-12` |
| Email | Địa chỉ Microsoft 365 của người trực, đúng từng ký tự (luật 1) | `alex@trustana.vn` |
| Slot1Role | Vai trò ở Slot 1 (22:00–02:30): Primary, Backup hoặc Off | `Primary` |
| Slot2Role | Vai trò ở Slot 2 (02:30–07:00): Primary, Backup hoặc Off | `Off` |
| Notes | Ghi chú cho người đọc | |

Các cột còn lại để trống, extension tự điền.

**Ca rạng sáng thuộc về ngày hôm trước.** Người trực 02:30–07:00 sáng thứ Năm được nhập với ngày thứ Tư, vì đêm đó bắt đầu từ tối thứ Tư.

**ShiftDate phải gõ đúng dạng `YYYY-MM-DD`**, ví dụ `2026-11-12`. Cột này là chữ, nên `12/11/2026` hay `12-Nov` sẽ không khớp, và người trực bị tạo thêm dòng.

Ví dụ cho đêm bắt đầu tối thứ Tư 12/11/2026:

| Title | ShiftDate | Email | Slot1Role | Slot2Role |
|---|---|---|---|---|
| Alex | 2026-11-12 | alex@trustana.vn | Primary | Off |
| Sam | 2026-11-12 | sam@trustana.vn | Off | Primary |

Lỗi hay gặp:

- Email có chữ hoa hoặc dấu cách thừa do chép từ tin nhắn. Hãy chép từ dòng `Signed in:`.
- Hai dòng cho cùng một người trong cùng một `ShiftDate`.
- Dùng số ca theo lịch cũ ("Ca 1" là 02:30–07:00). Trong extension, **Slot 1 là 22:00–02:30**.

## 7. Trưởng ca: quản lý nhóm WhatsApp trong AOG_Groups

Mỗi chat WhatsApp cần reo là một dòng.

- **Title:** tên chat đúng y như WhatsApp hiển thị, kể cả dấu cách, chữ hoa và emoji. Cách chắc nhất là mở phần thông tin nhóm trên WhatsApp rồi chép tên.
- **Active:** chọn **No** để tạm ngừng theo dõi một chat mà không cần xoá.
- **ChatType:** **Customer** hoặc **Flyer**, đánh dấu chat đó là của khách hàng hay của flyer. Bản hiện tại chưa xử lý hai loại này khác nhau; bản sau sẽ dùng cột này để tách hai loại.
- **Note:** ghi chú tự do.

Máy tải lại danh sách mỗi lần bắt đầu ca và mỗi lần lưu Settings. Chat chưa có trong danh sách vẫn có thể reo dưới dạng **Unknown chat**, kèm nút **Add to shared list** (thêm vào danh sách chung) và **Ignore** (bỏ qua).

## 8. Giải thích từng mục Settings

Thiết lập **chung** giống nhau trên mọi máy. Trưởng ca sửa trên một máy rồi bấm **Publish shared settings**; các máy khác tự tải về từ `AOG_Settings`. Các thiết lập còn lại chỉ áp dụng cho máy đã lưu nó.

| Mục | Thiết lập | Chung | Ý nghĩa |
|---|---|---|---|
| 1. SharePoint AOG | SharePoint AOG link | Không | Site AOG. Giữ mặc định. |
| | Sign in & check | — | Kết nối SharePoint và hiện email đang đăng nhập. |
| | Create lists | — | Chỉ trưởng ca, làm một lần: tạo list và cột còn thiếu. Cần quyền chủ site. |
| | Publish shared settings | — | Trưởng ca: chép thiết lập chung của máy này lên `AOG_Settings`. |
| 2. Operator | Display name | Không | Tên của bạn; phải khớp cột `Title` trong `AOG_Shifts`. |
| 3. WhatsApp | Coordination group | Có | Nhóm WhatsApp hai máy dùng để báo nhau khi SharePoint không vào được. |
| | WhatsApp greeting | Không | Câu đặt sẵn vào chat của khách sau Accept. Không bao giờ tự gửi. Để trống thì không đặt gì. |
| | Ring for unknown chats | Có | Chat không có trong `AOG_Groups` vẫn reo. |
| | My personal groups | Không | Chat thêm chỉ máy này theo dõi, mỗi dòng một chat. |
| | Ignored chats | Không | Chat máy này không bao giờ reo. |
| 4. Outlook | AOG mailbox path | Có | Phần sau `outlook.office.com` trong địa chỉ Outlook, ví dụ `/mail/aog@company.com/`. |
| | Only accept from senders | Có | Không bắt buộc. Chỉ thư từ các email hoặc tên miền này mới reo, mỗi dòng một mục. |
| | Ignored sender domains | Có | Thư từ các tên miền này không reo. Mặc định: `trustana.vn`. |
| | Subject keywords | Có | Chỉ tiêu đề chứa một trong các từ này mới reo. Để trống thì mọi tiêu đề đều reo. |
| 5. Timing & alerts | Wait for Accept before alerting Backup | Có | Số giây Primary có để nhận trước khi gọi Backup. Mặc định 120. |
| | Backup rings after | Có | Sau số giây này, máy Backup tự reo nếu tin vẫn chưa ai nhận. Mặc định 180. |
| | Maximum ring duration | Có | Chuông tự dừng sau số giây này. Mặc định 540. |
| | Machine idle threshold | Có | Không đụng bàn phím, chuột quá số giây này thì máy bị coi là không có người. Mặc định 15. |
| | Ring style | Có | Chuông đều lặp lại, hoặc to dần. **Preview ring** để nghe thử. |
| | Follow up after Accept | Có | Sau khi Accept, extension hỏi lại vụ việc đã xong chưa. |
| | Follow up after | Có | Số phút sau Accept thì hỏi. Mặc định 10. |
| | Answer timeout | Có | Số phút để trả lời câu hỏi đó trước khi tin reo lại. Mặc định 5. |
| | Partner machine lost after | Có | Số phút không nhận được tin của máy kia thì cảnh báo. Mặc định 5. |
| | Shift reminder after | Có | Số phút sau giờ bắt đầu slot đầu tiên thì nhắc bấm Start shift. Mặc định 10. |
| | Blind alert after | Có | Số phút extension không đọc được WhatsApp hoặc Outlook thì báo đang "mù". Mặc định 5. |
| 6. Testing | Test mode | Không | Bỏ qua giờ ca, dùng **Test role** bên dưới. |
| | Test role | Không | Primary hoặc Backup khi bật Test mode. |
| | Dry-run | Không | Không reo, không báo máy kia. |

`AOG_Settings` còn có dòng `log_keep_days` (mặc định 90): dòng nào trong `AOG_Log` cũ hơn số ngày này thì được chuyển vào thùng rác của site.

## 9. Ý nghĩa các cột trên SharePoint

"Người" là cột người gõ tay; "Máy" là cột extension tự ghi. Không sửa tay các cột ghi Máy.

### AOG_Groups — các chat WhatsApp cần theo dõi

| Cột | Ai điền | Ý nghĩa |
|---|---|---|
| Title | Người | Tên chat đúng y như trên WhatsApp |
| ChatType | Người | Customer hoặc Flyer (dành cho bản sau) |
| Active | Người | No = không theo dõi |
| AddedBy, AddedAt | Máy | Ai thêm chat từ popup, lúc nào |
| Note | Người | Ghi chú tự do |

### AOG_Settings — thiết lập chung

| Cột | Ai điền | Ý nghĩa |
|---|---|---|
| Title (Key) | Máy | Tên thiết lập, ví dụ `log_keep_days` |
| Value | Máy | Giá trị |
| UpdatedBy | Máy | Ai đăng lần cuối |

Đổi thiết lập chung qua **Settings → Publish shared settings**, không sửa thẳng list này. Ngoại lệ duy nhất là `log_keep_days`, vì Settings chưa có ô cho nó.

### AOG_Shifts — lịch trực và tính lương

| Cột | Ai điền | Ý nghĩa |
|---|---|---|
| Title (OperatorName) | Trưởng ca | Tên người trực (luật 2) |
| ShiftDate | Trưởng ca | Ngày buổi tối, `YYYY-MM-DD` |
| Email | Trưởng ca | Địa chỉ Microsoft 365 (luật 1) |
| Slot1Role, Slot2Role | Trưởng ca | Vai trò dự kiến từng slot; extension chưa đọc hai cột này |
| Notes | Trưởng ca | Ghi chú tự do |
| CheckIn, CheckOut | Máy | Lúc bấm Start shift và End shift |
| Hours | Máy | Số giờ giữa CheckIn và CheckOut |
| Ready | Máy | Bước kiểm đầu ca có đạt không |
| AlertCount | Máy | Số tin đã reo |
| AcceptedCount | Máy | Số tin đã nhận |
| MissCount | Máy | Số tin bị lỡ hoặc được báo là lỡ |
| AcceptLog | Máy | Giờ và tên chat của từng lần Accept |

### AOG_Log — nhật ký của máy (tự dọn sau 90 ngày)

| Cột | Ý nghĩa |
|---|---|
| RecordType | `Event` (một việc đã xảy ra), `Signal` (tin nhắn giữa hai máy) hoặc `Machine` (mỗi máy một dòng, cập nhật đều đặn) |
| Title (Summary) | Nhãn ngắn: loại sự kiện, loại tín hiệu kèm mã tin, hoặc tên người trực |
| EventType, At | Việc gì, lúc nào |
| ShiftId, AlertId | Ca nào, tin nào |
| Source, GroupOrSubject, Sender | WhatsApp hay Outlook, tên chat hoặc tiêu đề thư, người gửi |
| Role, OperatorName, Email, MachineId | Ai, máy nào |
| ResponseSeconds | Số giây từ lúc reo đến lúc Accept. Ở máy Backup, tính từ lúc Backup được gọi |
| MissCause | Lý do lỡ tin |
| Ready, Version, Detail | Trạng thái sẵn sàng, phiên bản extension, chi tiết hoặc lỗi |

Toàn bộ cột trong list này do máy ghi.

## 10. Khi có sự cố

- **WhatsApp hoặc Outlook đỏ:** mở hoặc tải lại tab đó. Với Outlook, kiểm xem có đang mở đúng hộp thư AOG không.
- **SharePoint đỏ:** mở site AOG và đăng nhập lại. Máy vẫn theo dõi và vẫn reo; phần ghi lên SharePoint sẽ tự thử lại sau.
- **Partner machine lost:** gọi người trực máy kia, kiểm xem trình duyệt của họ có mở và đã bấm Start shift chưa.
- **Mở sai chat:** ô nhập không bị đặt gì. Mở đúng chat, hoặc mở lại tin từ **Recent events**.
- **AOG_Shifts tự có thêm một dòng:** email hoặc ShiftDate không khớp (mục 3). Báo trưởng ca sửa dòng đã xếp và xoá dòng thừa.
- **Extension context invalidated:** tải lại tab WhatsApp và Outlook sau khi cập nhật extension.
- **Có tin mà máy không reo:** vào **Help → Missed a message?** và ghi lại.

Chi tiết hơn (tiếng Anh): [quy trình vận hành](docs/SOP.md). Phần dành cho lập trình viên: xem [README tiếng Anh](README.md#11-development).
