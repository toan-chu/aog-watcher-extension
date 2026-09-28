Mã:         V5-02
Mạch:       V5 - AOG Watcher 5.0
Nối tiếp:   V5-01
Giao cho:   claude [COWORK-EXEC]
Trạng thái: mở - chờ Chairman duyệt kịch bản, làm tiếp 2026-09-29
Vòng:       0/2

## ĐỀ BÀI

**Mục tiêu nghiệp vụ**

Popup và trang Cài đặt của AOG Watcher 5.0 mang đúng nhận diện Trustana, và bố cục được dựng lại theo luồng làm việc của 5.0 (vào ca → kiểm tra đầu ca → trong ca → ra ca) thay vì khung 4.3 được chắp thêm phần mới.

**Brand guideline (Chairman gửi 2026-09-28)**

- Tím Trustana `#4d148c`, cam Trustana `#ff6200`.
- Font theo guideline: Roboto cho tiêu đề, Calibri cho nội dung. Chairman cân nhắc Quicksand hoặc Montserrat → chờ chốt.

**Ngoài phạm vi**

- Không đổi hành vi canh tin, leo thang, SharePoint, kiểm tra đầu ca (đã làm ở V5-01).
- Không đổi nội dung chữ ngoài những chỗ cần cho bố cục mới.

**Kế thừa**

- V5-01 code xong 5.0.0 (commit e8b10a2), chờ nghiệm thu runtime; popup/settings hiện dùng theme tối xanh lá của 4.3 cộng thêm các khối mới.
- Người dùng nhìn popup lúc nửa đêm, vừa bị đánh thức.

**Kịch bản nghiệm thu** — NHÁP, chờ Chairman duyệt/sửa. Claude không tự viết tiêu chí cuối và không tự nghiệm thu.

- KS-1 Nhận diện: mở popup và Cài đặt → thấy tím/cam Trustana và font đã chốt; không còn màu xanh lá 4.3.
- KS-2 Đọc được lúc nửa đêm: người vừa bị đánh thức nhìn popup trong phòng tối → trong ___ giây biết đang có tin hay không và bấm được ACK; màn hình không chói.
- KS-3 Phân biệt màu: tin đang reo / lỗi đỏ / cảnh báo / bình thường không bị lẫn với màu cam thương hiệu. Tuyệt đối không: một ô lỗi trông giống ô trang trí.
- KS-4 Bố cục theo luồng: popup chia rõ các vùng Ca trực · Tin đang reo · Kiểm tra đầu ca · Nguồn tin · Sự kiện; người mới không cần hướng dẫn vẫn tìm được nút Bắt đầu ca, ACK, Thử chuông trong ___ giây.
- KS-5 Không mất tính năng: mọi nút của 5.0 vẫn có và vẫn chạy (npm run check đạt; soát tay từng nút).

## TODO

- [ ] Chairman chốt font và duyệt kịch bản.
- [ ] Đề xuất 2 phương án bố cục popup (vẽ ASCII) để Chairman chọn trước khi code.
- [ ] Dựng lại HTML/CSS popup + Cài đặt theo phương án đã chọn; đóng gói font trong extension (không tải từ mạng lúc nửa đêm).
- [ ] Cập nhật icon nếu Chairman muốn theo màu thương hiệu.
- [ ] Test tĩnh + soát tay, ảnh chụp vào `handoff/shots/`.

## AUDIT

### Report from the executor

Chưa bắt đầu.

### Acceptance signature

Chưa ký.

## HISTORY

### 2026-09-28

Mở phiếu theo yêu cầu Chairman; chưa sửa file chức năng nào.

-- claude - 2026-09-28
