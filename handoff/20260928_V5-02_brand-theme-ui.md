Mã: V5-02
Mạch: V5 - AOG Watcher 5.0
Nối tiếp: V5-01
Người làm: claude
Người soát: codex
Trạng thái: chờ-soát
Vòng: 2/2

## ĐỀ BÀI
Kỳ vọng của user:
- "triển khai tiếp" (user, 2026-09-29, cho làm theo font đã đề xuất và số mặc định 3 giây, 30 giây).
- Vòng 2, user nhận xét vòng 1: popup nền tím khó đọc (phiếu cũ ghi tóm, không có nguyên văn).
- Brand guideline user gửi 2026-09-28: tím Trustana `#4d148c`, cam Trustana `#ff6200`; guideline ghi font Roboto/Calibri, user cho dùng Montserrat cho tiêu đề (đóng gói sẵn, có dấu tiếng Việt) và Calibri cho nội dung.
Mục tiêu: Popup và trang Cài đặt của AOG Watcher 5.0 mang đúng nhận diện Trustana, và bố cục dựng lại theo luồng làm việc của 5.0 (vào ca → kiểm tra đầu ca → trong ca → ra ca) thay vì khung 4.3 chắp thêm phần mới.
Ngoài phạm vi:
- Không đổi hành vi canh tin, leo thang, SharePoint, kiểm tra đầu ca (đã làm ở V5-01).
- Không đổi nội dung chữ ngoài những chỗ cần cho bố cục mới.
Kế thừa:
- V5-01 đã code xong 5.0.0 (commit e8b10a2), đang chờ soát và phép thử thật.
- Người dùng nhìn popup lúc nửa đêm, vừa bị đánh thức.
Kịch bản test:
- KS-1 Nhận diện: mở popup và Cài đặt → thấy tím/cam Trustana và font đã chốt; không còn màu xanh lá 4.3.
- KS-2 Đọc được lúc nửa đêm: người vừa bị đánh thức nhìn popup trong phòng tối → trong 3 giây biết đang có tin hay không và bấm được ACK; màn hình không chói.
- KS-3 Phân biệt màu: tin đang reo, lỗi đỏ, cảnh báo, bình thường không bị lẫn với màu cam thương hiệu. Tuyệt đối không: một ô lỗi trông giống ô trang trí.
- KS-4 Bố cục theo luồng: popup chia rõ các vùng Ca trực · Tin đang reo · Kiểm tra đầu ca · Nguồn tin · Sự kiện; người mới không cần hướng dẫn vẫn tìm được nút Bắt đầu ca, ACK, Thử chuông trong 30 giây.
- KS-5 Không mất tính năng: mọi nút của 5.0 vẫn có và vẫn chạy (`npm run check` đạt; bấm thử từng nút).

## TODO
- [x] Font: Montserrat 600/700 (latin, latin-ext, vietnamese) đóng gói ở `assets/fonts/` kèm giấy phép OFL; Calibri cho nội dung.
- [x] User bảo triển khai luôn → một bố cục theo độ gấp, bỏ bước chọn 2 phương án.
- [x] Dựng lại HTML/CSS popup (theme đêm tím) và Cài đặt (theme ngày sáng); giữ nguyên mọi id nên logic 5.0 không đổi.
- [x] Icon đổi sang tím Trustana, trăng cam, chấm đỏ (sinh lại bằng `tools/generate_assets.mjs`; âm thanh không đổi).
- [x] Phép thử tĩnh và ảnh chụp 3 trạng thái popup cùng trang Cài đặt vào `handoff/shots/`.
- [x] Vòng 2: popup đổi sang nền trắng, chữ tím/đen như trang Cài đặt; thanh tiêu đề giữ tím Trustana.
- [ ] Mở popup trên Chrome/Edge thật, chạy KS-1..KS-5, chụp ảnh vào `shots/`. `[RUNTIME UNVERIFIED]`
- [ ] Người soát (codex) soát mã và ảnh.

## AUDIT
Báo cáo của người làm:
- Bố cục popup (từ trên xuống theo độ gấp): thanh thương hiệu (tím, viền cam, huy hiệu ĐANG REO / SẴN SÀNG) → cảnh báo hệ thống → Tin đang reo và nút ACK lớn → Chat lạ → Ca trực (vai trò, hàng chờ, Bắt đầu/Kết thúc, giờ ca gập lại) → Kiểm tra đầu ca (gập thành 1 dòng khi đã đạt) → Nguồn tin → Tin bị lọt / Sự kiện / Chẩn đoán. Khi có chuông, thanh trên cùng chuyển đỏ.
- Màu: cam Trustana chỉ dùng cho nút hành động chính và điểm nhấn thương hiệu. Trạng thái dùng màu riêng: xanh bình thường, vàng lưu ý, đỏ hồng lỗi/đang reo; vòng 2 dùng bản đậm cho nền sáng.
- Lệnh và kết quả (bản sao sạch trên Linux), ngày 2026-09-29:

```text
> npm run check
MV3 check passed (14 referenced files).
Test Files  28 passed (28)
Tests       181 passed (181)
> làm hỏng thử: --danger = #ff6200 (trùng cam thương hiệu)
× V5-02 Trustana brand UI > keeps status colours distinct from the brand orange
```

- Ảnh vòng 1 (nền tối, Chromium headless, dữ liệu giả): `shots/20260929_V5-02_01_popup-dang-reo.png`, `shots/20260929_V5-02_02_popup-san-sang.png`, `shots/20260929_V5-02_03_popup-chua-vao-ca.png`, `shots/20260929_V5-02_04_cai-dat.png`.
- Ảnh vòng 2 (nền trắng): `shots/20260929_V5-02_05_popup-nen-trang-dang-reo.png`, `shots/20260929_V5-02_06_popup-nen-trang-san-sang.png`, `shots/20260929_V5-02_07_popup-nen-trang-chua-vao-ca.png`.
- Ảnh trên là Chromium headless trong môi trường Linux, không phải trình duyệt thật trên máy user → `[RUNTIME UNVERIFIED]`.
- Lệch so với đề bài:
  - Popup Chrome cao tối đa khoảng 600px: lúc đang reo có đủ khối thì phải cuộn, nhưng khối reo và ACK luôn ở đầu nên không cần cuộn để ACK.
  - Ô giờ ca hiển thị 12h hay 24h theo ngôn ngữ Windows của máy.
  - Nền trắng lúc nửa đêm sẽ chói hơn nền tối, có thể vướng KS-2 "màn hình không chói".
- Câu hỏi còn treo cho user: nền trắng lúc nửa đêm có chói không — giữ hay đổi.
-- claude - 2026-09-29 10:58 UTC+7

Giả định kỹ thuật:

```
[GIẢ ĐỊNH KỸ THUẬT] Đóng gói Montserrat trong `assets/fonts/` thay vì tải từ Google Fonts.
Vì sao chọn: extension phải chạy khi mạng chập chờn, và không phụ thuộc máy chủ ngoài.
Sai thì làm lại: bỏ thư mục font và `assets/fonts/fonts.css`, đổi chỗ nạp font trong `popup.css` và `settings.css`.
```

Soát:
Kết quả:

## HISTORY
### 2026-09-28
Mở phiếu theo yêu cầu user; chưa sửa file chức năng nào.
Failure: không.
Báo lỗi giả: không
Lessons: không.
-- claude - 2026-09-28

### 2026-09-29
User: "triển khai tiếp". Làm theo font đã đề xuất (Montserrat + Calibri) và số mặc định trong kịch bản.
Failure: ảnh chụp đầu tiên mở file trực tiếp nên trình duyệt chặn script module → popup trống; chuyển sang phục vụ qua http cục bộ. Ô giờ ca tràn ngang khi hiển thị AM/PM → sửa lưới cột.
Báo lỗi giả: không
Lessons: xem giao diện extension ngoài Chrome phải phục vụ qua http, không mở file://.
-- claude - 2026-09-29

### 2026-09-29 (vòng 2)
User nhận xét vòng 1: popup nền tím khó đọc → HỎNG vòng 1 về độ dễ đọc. Vòng 2: nền trắng, tiêu đề mục tím, chữ đen, trạng thái xanh/vàng/đỏ đậm cho nền sáng.
Failure: bản đầu vòng 2 làm chữ "AOG Watcher" trên thanh tím thành màu đen, và nút Thử chuông vẫn hiện khi đã SẴN SÀNG (CSS ghi đè thuộc tính hidden). Thấy trên ảnh chụp, đã sửa trước khi giao.
Báo lỗi giả: không
Lessons: đổi theme phải chụp lại cả 3 trạng thái rồi mới giao; thuộc tính `hidden` cần luật CSS `[hidden] { display: none !important }` khi phần tử có `display` riêng.
-- claude - 2026-09-29 10:58 UTC+7

### 2026-10-28
Failure: không. Phiếu đổi sang khuôn handoff-standard v2.0 trong RF-04: trường `Giao cho` thành `Người làm`/`Người soát`, `chờ-nghiệm-thu` thành `chờ-soát`, `[RUNTIME CHƯA KIỂM]` thành `[RUNTIME UNVERIFIED]`, `Chairman` thành `user`, đường dẫn ảnh ghi đủ tên; nội dung báo cáo giữ nguyên.
Báo lỗi giả: không
Lessons: không.
-- claude - 2026-10-28 10:56 UTC+7
