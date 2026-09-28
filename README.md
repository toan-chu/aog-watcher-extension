# AOG Watcher v4.3.0

![License MIT](https://img.shields.io/badge/license-MIT-green)
![JavaScript ES2022](https://img.shields.io/badge/JavaScript-ES2022-yellow)
![Chrome MV3](https://img.shields.io/badge/Chrome%20%2F%20Edge-Manifest%20V3-orange)
![Tests 133 passing](https://img.shields.io/badge/tests-133%20passing-brightgreen)

> **AOG Watcher canh WhatsApp và Outlook để hai người trực đêm không bỏ lỡ yêu cầu khẩn cấp mà vẫn có thể nghỉ.**
> Người trực bắt đầu ca → extension phát hiện tin mới → người chính ACK hoặc hệ thống tự leo thang sang người dự phòng → báo cáo được xuất cuối ca.

## 🎯 Ai làm gì

| Vai trò | Việc cần làm | Cần biết code? |
|---|---|---|
| Người trực chính | Mở hai tab, Start Shift và ACK alert | Không |
| Người trực dự phòng | Giữ máy sẵn sàng và xử lý khi alert leo thang | Không |
| Quản lý ca | Kiểm tra cấu hình và xuất báo cáo | Không |
| Người bảo trì | Cập nhật selector, logic và chạy verification | Có |

## 🔄 Luồng chạy

```text
WhatsApp Web ──┐
               ├──> phát hiện tin mới sau Start Shift
Outlook Web ───┘                 │
                                 ▼
                   chuông máy người trực chính
                                 │
                    ACK ─────────┴──── không ACK đúng hạn
                     │                         │
                     ▼                         ▼
          peer nhận AOG-HANDLED       máy dự phòng reo
                     │                         │
                     └──────────┬──────────────┘
                                ▼
                       báo cáo cuối ca
```

Extension không dùng server và không gửi tracking. Dữ liệu vận hành nằm trong browser local storage; browser và hai tab nguồn phải mở trong ca.

## 🚀 Cài đặt

1. Tải repo bằng **Code → Download ZIP**, rồi giải nén vào một thư mục cố định.
2. Mở `chrome://extensions` hoặc `edge://extensions`.
3. Bật **Developer mode**.
4. Chọn **Load unpacked** và trỏ tới thư mục vừa giải nén.
5. Ghim icon AOG Watcher lên thanh công cụ.

## 📋 Dùng thế nào

1. Chuột phải icon → **Options**; nhập tên người trực, vai trò, nhóm khách, nhóm điều phối và Outlook watch path.
2. Mở sẵn WhatsApp Web và tab Outlook tại đúng hộp AOG.
3. Mở popup, bấm **Start Shift** và chờ hai source chuyển xanh.
4. Khi có alert, bấm **ACK** để nhận xử lý; peer sẽ nhận tag `[AOG-HANDLED]` và dừng wake.
5. Hết ca, bấm **End Shift**, sau đó xuất báo cáo nếu cần.

Quy trình hai máy, bàn giao ca và xuất báo cáo chi tiết nằm trong [Cẩm nang vận hành](docs/SOP.md).

## ❓ Hỏng thì làm gì

- Không reo: mở **Diagnostics** trong popup; kiểm tra shift đang active, hai source xanh, Outlook đúng folder và filter đúng.
- Reo tin cũ: xác nhận đã dùng v4.3.0 và chỉ đánh giá item xuất hiện sau khi bấm Start Shift.
- Outlook im lặng: kiểm tra `outlook_watch_path`, ngôn ngữ UI và các số `rows seen`/`unread seen` trong Diagnostics.
- Một máy ACK nhưng máy kia vẫn reo: kiểm tra nhóm điều phối và khả năng gửi/đọc tag `[AOG-HANDLED]`.
- Sau khi reload extension: reload lại tab WhatsApp và Outlook để bỏ content script cũ.

Nếu lỗi vẫn còn, ghi lại thời điểm, ảnh Diagnostics, source liên quan và các bước tái hiện trước khi mở ticket.

## 🛠️ Phát triển

Yêu cầu Node.js và npm. Extension dùng JavaScript ES2022, Manifest V3, không có dependency production hay build step.

```powershell
npm install
npm run check
```

`npm run check` kiểm tra 14 file được manifest tham chiếu rồi chạy 133 test Vitest. Kiến trúc hiện tại nằm ở [handoff/MAP.md](handoff/MAP.md); quy tắc làm việc nằm ở [handoff/RULES.md](handoff/RULES.md).

## 📄 Giấy phép

[MIT](LICENSE).
