# Kế hoạch triển khai V5-09

> **Dành cho người thực hiện:** dùng test trước và hoàn thành lần lượt từng task.

**Mục tiêu:** Dùng `AOG_Shifts.Title` làm tên chuẩn, bảo vệ roster khỏi bị máy ghi đè và cảnh báo người không có lịch mà không chặn chuông.

**Kiến trúc:** Một hàm đối chiếu roster trong service worker phục vụ Sign in và Start shift. Kết quả lưu local cho preflight; lớp upsert tách trường chỉ dùng khi tạo mới khỏi trường update. Không thêm bảng, không đổi giao thức.

**Công nghệ:** Chrome MV3, JavaScript modules, SharePoint REST, Vitest.

**Đặc tả:** `handoff/20261111_V5-09_roster-authoritative-name.md`

## Ràng buộc
- `ShiftDate` giữ `YYYY-MM-DD`; không đọc Slot role.
- Không đổi peer protocol, state machine hoặc timer.
- Cảnh báo roster không được chặn monitoring/ringing.
- Mỗi hành vi mới phải có RED, GREEN và phép làm hỏng thử.

## Task 1: Đối chiếu roster và sửa tên

**File:** `service_worker.js`, `lib/constants.js`, `tests/v50_service_worker.test.js`.

- [x] Viết test Sign in và Start shift với `Lahe`/`Leah`; xác nhận đỏ.
- [x] Truy vấn theo email, fallback đúng tên với email trống; lưu trạng thái roster và cập nhật config.
- [x] Trả thông báo cho Settings/Popup; chạy test xanh và mutation tên sai.

## Task 2: Bảo vệ Title và cảnh báo

**File:** `service_worker.js`, `lib/shift_row.js`, `lib/preflight.js`, `popup.js`, test logic/service worker.

- [x] Viết test Start/End giữ Title, thiếu roster vẫn tạo dòng/reo/cảnh báo, fallback email trống; xác nhận đỏ.
- [x] Tách Title sang `create_fields` chỉ dùng khi tạo mới; thêm roster status vào preflight.
- [x] Chạy xanh; mutation từng nhánh bảo vệ Title, cảnh báo và fallback.

## Task 3: Đồng nhất tên ghi ra ngoài và tài liệu

**File:** `service_worker.js`, `README.md`, `README.vi.md`, `handoff/MAP.md`, test tích hợp.

- [x] Test Machine, Event và signal dùng tên roster.
- [x] Cập nhật mục 3 và 9 của hai README, cập nhật contract trong MAP.
- [x] Chạy test tập trung, mutation, `git diff --check`, `npm run check`; ghi AUDIT và chuyển chờ-soát.
