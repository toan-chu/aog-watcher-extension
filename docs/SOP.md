# AOG Watcher 5.0 — Cẩm nang vận hành (SOP)

Tài liệu này dùng cho bản 5.0.0 trở đi. Nguồn sự thật về kiến trúc: `handoff/MAP.md`.

Extension Chrome/Edge canh WhatsApp Web và Outlook Web trong ca đêm, reo khi có tin AOG, leo thang sang máy dự phòng, tự báo khi chính nó hỏng, và ghi ca trực vào SharePoint của group AOG.

---

## A. Trưởng team — làm một lần

1. Dữ liệu AOG nằm trong site CX: `https://trustanavn.sharepoint.com/sites/cx9` (đã là mặc định trong extension). Mọi người trực phải có quyền **sửa** trên các bảng AOG_*.
2. Cài extension trên máy mình (mục B.1), mở **Cài đặt**.
3. Mục **1. SharePoint AOG**: link site CX đã điền sẵn → bấm **Đăng nhập & kiểm tra**.
   - Đúng: hiện tên + email công ty của mình.
   - Sai "từ chối quyền / yêu cầu đăng nhập": bấm **Mở SharePoint**, đăng nhập bằng email công ty, quay lại bấm kiểm tra lần nữa.
4. Mở **Dành cho trưởng team** → bấm **Tạo bảng**. Extension tạo 6 bảng trên trang:

   | Bảng | Dùng cho |
   |---|---|
   | AOG_Shifts | **Ca trực** — mỗi đêm 1 dòng cho cả 2 người: điểm danh, giờ vào/ra, tin đã ACK, ghi chú |
   | AOG_Groups | **Nhóm chung** — danh sách nhóm WhatsApp khách; thêm/xoá dòng trực tiếp |
   | AOG_Events | **Hộp đen** — từng tin, ai ACK, leo thang, nguyên nhân miss |
   | AOG_Settings | **Cài đặt chung** — hộp AOG, nhóm điều phối, thời gian leo thang… |
   | AOG_Machines | Máy dùng: nhịp tim từng máy (không cần sửa) |
   | AOG_Signals | Máy dùng: hai máy nhắn nhau ACK/leo thang (không cần sửa) |

5. Điền mục 3–5 trong Cài đặt (nhóm điều phối, đường dẫn hộp AOG, thời gian) → **Lưu** → bấm **Đẩy cài đặt chung**. Từ giờ mọi máy nối vào SharePoint tự lấy các cài đặt này.
6. Nhập danh sách nhóm khách hiện có vào bảng **AOG_Groups** (mỗi dòng một tên nhóm, cột Title, đúng tên hiển thị trên WhatsApp).

Muốn xem như **một file Excel nhiều tab**: tạo file Excel trên SharePoint → Data → Get Data → From Online Services → SharePoint Online List → chọn các bảng AOG_*; mỗi bảng thành một tab, bấm Refresh để cập nhật. File này chỉ để xem; máy vẫn ghi vào bảng.

## B. Người trực — setup lần đầu

1. **Cài extension:** mở `chrome://extensions` (hoặc `edge://extensions`) → bật **Developer mode** → **Load unpacked** → chọn thư mục extension → ghim icon.
   - Đúng: icon trăng khuyết xuất hiện trên thanh công cụ.
   - Cập nhật bản mới: thay thư mục, bấm nút tải lại trên thẻ extension, rồi **tải lại tab WhatsApp và Outlook**.
2. Chuột phải icon → **Options** (Cài đặt):
   - Link site CX đã điền sẵn → **Đăng nhập & kiểm tra** → thấy email công ty của mình là đúng.
   - Điền **Tên hiển thị** (khác người trực cùng) → **Lưu**.
   - Không cần chép nhóm hay cài đặt gì khác — đã tự lấy từ SharePoint.
3. Mở sẵn 2 tab trong cùng trình duyệt: **WhatsApp Web** (đã quét QR) và **Outlook Web ở đúng hộp AOG**.

## C. Mỗi đêm

### Vào ca

1. Tới giờ ca, máy tự nhắc. Quá 10 phút chưa mở ca → máy reo và báo máy kia.
2. Mở popup → kiểm tra giờ 2 slot → bấm **Bắt đầu ca**.
3. Làm theo **Kiểm tra đầu ca** trong popup tới khi huy hiệu góc phải là **SẴN SÀNG**:
   - ✓ WhatsApp Web đang canh · ✓ Outlook ở hộp AOG · ✓ SharePoint · ✓ Cắm sạc
   - Bấm **Thử chuông** → nghe thấy thì bấm **Nghe rõ**. Không nghe thấy → kiểm tra âm lượng/loa rồi thử lại.
   - Dòng ✗ đỏ ghi đúng việc cần sửa.
4. Mở bảng **AOG_Shifts** trên SharePoint nếu muốn ghi chú đầu ca (cột Notes của dòng đêm nay).

Checklist chưa đạt **không** tắt việc canh tin; nó chỉ báo cho máy kia biết máy này chưa sẵn sàng và được ghi vào dòng ca trực.

### Trong ca

| Thấy gì | Làm gì |
|---|---|
| Máy reo, popup có tin | Bấm **ACK — TÔI NHẬN XỬ LÝ**. Máy kia được báo, ghi vào cột ACK của mình trên dòng ca trực |
| Sau ACK ~10 phút hỏi "Đã xử lý xong chưa?" | Bấm **Xong** hoặc **Cần thêm thời gian**. Không trả lời 5 phút → reo lại và báo máy kia |
| "Chat lạ vừa nhắn" | **Thêm vào danh sách chung** (nhóm khách → ghi lên SharePoint, mọi máy nhận) hoặc **Bỏ qua** (chat cá nhân → chỉ máy này thôi reo) |
| Ô đỏ "Watcher đang MÙ" / "Không thấy tab" / "Sai hộp thư" | Bấm **Đã biết** để tắt chuông, rồi sửa: tải lại tab, mở lại đúng hộp AOG. Ô đỏ tự mất khi đã sửa xong |
| "Máy trực cùng mất liên lạc" | Gọi người trực cùng. Máy kia ngủ, hết pin, mất mạng hoặc đã đóng trình duyệt |
| "Máy kia chưa mở ca" | Gọi người trực cùng |
| Phát hiện có tin mà Watcher không reo | Popup → **Có tin bị lọt?** → chọn nguồn, tên nhóm/tiêu đề, giờ → **Ghi nhận**. Hệ thống tự ghi nguyên nhân |

Mỗi tin miss có đúng một nguyên nhân trong hộp đen: **Cài đặt** (chưa mở ca, sai hộp thư, tab đóng, chưa thử chuông) · **Máy** (ngủ/mất mạng, không phát được âm thanh) · **Người** (reo đủ thời gian không ai ACK) · **Watcher** (tin đến mà Watcher không thấy, hoặc Watcher đang mù).

### Ra ca

1. Popup → **Kết thúc ca** → bấm lần nữa để xác nhận.
2. Dòng ca trực đêm nay tự có giờ ra ca, số tin, số miss và danh sách ACK. Ghi chú thêm vào cột Notes nếu cần.

## D. Khi SharePoint lỗi

- Popup dòng **SharePoint AOG** đỏ. Watcher **vẫn canh và vẫn reo** bình thường.
- Hai máy tự chuyển sang báo nhau qua **nhóm điều phối WhatsApp** (tag `[AOG-HANDLED]`), như bản 4.3.
- Dữ liệu hộp đen và ca trực được giữ trên máy, tự ghi lên SharePoint khi kết nối lại.
- Sửa: mở SharePoint trong trình duyệt, đăng nhập lại bằng email công ty.

## E. Chẩn đoán nhanh

| Triệu chứng | Kiểm tra |
|---|---|
| Không reo | Huy hiệu có SẴN SÀNG không? Có ô đỏ nào không? Mục **Chẩn đoán** có số dòng > 0 không? |
| Reo cho chat cá nhân | Bấm **Bỏ qua** trên chat đó |
| Nhóm khách bị nhận nhầm là chat lạ | Tên trong AOG_Groups phải khớp tên nhóm trên WhatsApp; hoặc bấm **Thêm vào danh sách chung** |
| Cài đặt chung tự đổi lại | Máy lấy cài đặt chung từ AOG_Settings; sửa ở đó (hoặc sửa trên máy trưởng team rồi **Đẩy cài đặt chung**) |
| "Extension context invalidated" | Tải lại tab WhatsApp và Outlook sau khi cập nhật extension |

Báo lỗi: ghi giờ, ảnh popup (mở mục Chẩn đoán), và dòng liên quan trong AOG_Events.
