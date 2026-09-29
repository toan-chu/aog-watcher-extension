Mã:         V5-02
Mạch:       V5 - AOG Watcher 5.0
Nối tiếp:   V5-01
Giao cho:   claude-ceo [COWORK-EXEC]
Trạng thái: chờ-nghiệm-thu
Vòng:       2/2

## ĐỀ BÀI

**Mục tiêu nghiệp vụ**

Popup và trang Cài đặt của AOG Watcher 5.0 mang đúng nhận diện Trustana, và bố cục được dựng lại theo luồng làm việc của 5.0 (vào ca → kiểm tra đầu ca → trong ca → ra ca) thay vì khung 4.3 được chắp thêm phần mới.

**Brand guideline (Chairman gửi 2026-09-28)**

- Tím Trustana `#4d148c`, cam Trustana `#ff6200`.
- Font: guideline ghi Roboto/Calibri. Chairman cho triển khai (2026-09-29) theo đề xuất: Montserrat cho tiêu đề (đóng gói sẵn, có dấu tiếng Việt), Calibri cho nội dung.

**Ngoài phạm vi**

- Không đổi hành vi canh tin, leo thang, SharePoint, kiểm tra đầu ca (đã làm ở V5-01).
- Không đổi nội dung chữ ngoài những chỗ cần cho bố cục mới.

**Kế thừa**

- V5-01 code xong 5.0.0 (commit e8b10a2), chờ nghiệm thu runtime; popup/settings hiện dùng theme tối xanh lá của 4.3 cộng thêm các khối mới.
- Người dùng nhìn popup lúc nửa đêm, vừa bị đánh thức.

**Kịch bản nghiệm thu** — Chairman cho triển khai 2026-09-29 với số mặc định (3 giây, 30 giây). Claude không tự nghiệm thu.

- KS-1 Nhận diện: mở popup và Cài đặt → thấy tím/cam Trustana và font đã chốt; không còn màu xanh lá 4.3.
- KS-2 Đọc được lúc nửa đêm: người vừa bị đánh thức nhìn popup trong phòng tối → trong 3 giây biết đang có tin hay không và bấm được ACK; màn hình không chói.
- KS-3 Phân biệt màu: tin đang reo / lỗi đỏ / cảnh báo / bình thường không bị lẫn với màu cam thương hiệu. Tuyệt đối không: một ô lỗi trông giống ô trang trí.
- KS-4 Bố cục theo luồng: popup chia rõ các vùng Ca trực · Tin đang reo · Kiểm tra đầu ca · Nguồn tin · Sự kiện; người mới không cần hướng dẫn vẫn tìm được nút Bắt đầu ca, ACK, Thử chuông trong 30 giây.
- KS-5 Không mất tính năng: mọi nút của 5.0 vẫn có và vẫn chạy (npm run check đạt; soát tay từng nút).

## TODO

- [x] Font: Montserrat 600/700 (latin, latin-ext, vietnamese) đóng gói ở `assets/fonts/` kèm giấy phép OFL; Calibri cho nội dung.
- [x] Bỏ bước chọn 2 phương án: Chairman bảo triển khai luôn → một bố cục theo độ gấp (xem Report).
- [x] Dựng lại HTML/CSS popup (theme đêm tím) + Cài đặt (theme ngày sáng); giữ nguyên mọi id nên logic 5.0 không đổi.
- [x] Icon đổi sang tím Trustana + trăng cam + chấm đỏ (sinh lại bằng `tools/generate_assets.mjs`; âm thanh không đổi).
- [x] Test tĩnh + ảnh chụp 3 trạng thái popup và trang Cài đặt vào `handoff/shots/`.
- [ ] Chairman: mở popup trên máy thật, xem KS-1..KS-5. `[RUNTIME CHƯA KIỂM]`
- [x] Vòng 2 (Chairman 2026-09-29: nền tím khó đọc): popup đổi sang nền trắng, chữ tím/đen như trang Cài đặt; thanh tiêu đề giữ tím Trustana. Ảnh: `shots/20260929_V5-02_05..07_popup-nen-trang-*.png`.

## AUDIT

### Report from the executor

**Bố cục popup (từ trên xuống theo độ gấp):** thanh thương hiệu (tím, viền cam, huy hiệu ĐANG REO / SẴN SÀNG) → cảnh báo hệ thống → Tin đang reo + nút ACK lớn → Chat lạ → Ca trực (vai trò, hàng chờ, Bắt đầu/Kết thúc, giờ ca gập lại) → Kiểm tra đầu ca (gập thành 1 dòng khi đã đạt) → Nguồn tin → Tin bị lọt / Sự kiện / Chẩn đoán. Khi có chuông, thanh trên cùng chuyển đỏ.

**Màu:** cam Trustana chỉ dùng cho nút hành động chính và điểm nhấn thương hiệu. Trạng thái dùng màu riêng: xanh `#34d399` bình thường, vàng `#facc15` lưu ý, đỏ hồng `#ff3b5c` lỗi/đang reo.

**Lệnh và output:**

```text
> npm run check
MV3 check passed (14 referenced files).
Test Files  28 passed (28)
Tests       181 passed (181)
> negative control: --danger = #ff6200 (trùng cam thương hiệu)
× V5-02 Trustana brand UI > keeps status colours distinct from the brand orange
```

Ảnh chụp vòng 1 (nền tối, Chromium headless, dữ liệu giả): `shots/20260929_V5-02_01..04_*.png` (đổi tên theo chuẩn v1.1 ở RF-03).

**Sai lệch / lưu ý:**

- Popup Chrome cao tối đa ~600px: lúc đang reo có đủ khối thì phải cuộn, nhưng khối reo + ACK luôn ở đầu nên không cần cuộn để ACK.
- Ô giờ ca hiển thị 12h hay 24h theo ngôn ngữ Windows của máy.
- `[RUNTIME CHƯA KIỂM]` trên Chrome/Edge thật.

### Acceptance signature

Chưa ký.

## HISTORY

### 2026-09-28

Mở phiếu theo yêu cầu Chairman; chưa sửa file chức năng nào.

-- claude - 2026-09-28

### 2026-09-29

Chairman: "triển khai tiếp". Làm theo font đã đề xuất (Montserrat + Calibri) và số mặc định trong kịch bản.

Failure: ảnh chụp đầu tiên mở file trực tiếp nên trình duyệt chặn script module → popup trống; chuyển sang phục vụ qua http cục bộ. Ô giờ ca tràn ngang khi hiển thị AM/PM → sửa lưới cột.

Báo lỗi giả: không.

Lessons: xem giao diện extension ngoài Chrome phải phục vụ qua http, không mở file://.

-- claude - 2026-09-29

### 2026-09-29 (vòng 2)

Chairman nhận xét vòng 1: popup nền tím khó đọc → HỎNG vòng 1 về độ dễ đọc. Vòng 2: nền trắng, tiêu đề mục tím, chữ đen, trạng thái xanh/vàng/đỏ đậm cho nền sáng.

Failure: bản đầu vòng 2 làm chữ "AOG Watcher" trên thanh tím thành màu đen, và nút Thử chuông vẫn hiện khi đã SẴN SÀNG (CSS ghi đè thuộc tính hidden). Thấy trên ảnh chụp, đã sửa trước khi giao.

Báo lỗi giả: không.

Lessons: đổi theme phải chụp lại cả 3 trạng thái rồi mới giao; thuộc tính `hidden` cần luật CSS `[hidden] { display: none !important }` khi phần tử có `display` riêng.

Lưu ý nghiệp vụ: nền trắng lúc nửa đêm sẽ chói hơn (KS-2 "màn hình không chói"). Chairman quyết khi nghiệm thu.

-- claude-ceo - 2026-09-29 10:58 UTC+7
