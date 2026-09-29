# AOG Watcher v5.0.0

![License MIT](https://img.shields.io/badge/license-MIT-green)
![JavaScript ES2022](https://img.shields.io/badge/JavaScript-ES2022-yellow)
![Chrome MV3](https://img.shields.io/badge/Chrome%20%2F%20Edge-Manifest%20V3-orange)
![SharePoint](https://img.shields.io/badge/data-SharePoint%20List-4d148c)
![Tests 181 passing](https://img.shields.io/badge/tests-181%20passing-brightgreen)

> **AOG Watcher canh WhatsApp và Outlook để hai người trực đêm không bỏ lỡ yêu cầu khẩn cấp, tự báo khi chính nó hỏng, và ghi ca trực lên SharePoint của group AOG.**
> Mở ca → kiểm tra đầu ca → có tin thì reo → người chính ACK hoặc leo thang sang máy dự phòng → sáng ra dòng ca trực và hộp đen ghi rõ từng tin, từng lần miss và nguyên nhân.

## 🎯 Ai làm gì

| Vai trò | Việc cần làm | Cần biết code? |
|---|---|---|
| Người trực | Dán link SharePoint lần đầu, mở 2 tab, Bắt đầu ca, làm checklist, ACK | Không |
| Trưởng team | Tạo bảng SharePoint một lần, giữ danh sách nhóm và cài đặt chung | Không |
| Người bảo trì | Cập nhật bộ nhận diện giao diện khi WhatsApp/Outlook đổi, chạy kiểm tra | Có |

## 🔄 Luồng chạy

```text
WhatsApp Web ──┐                       ┌──> chuông máy chính ── ACK ──> báo máy kia (SharePoint)
               ├──> Watcher (2 máy) ───┤                        └ không ACK ──> máy dự phòng reo
Outlook Web ───┘        │              └──> tự kiểm: nguồn mù? máy kia mất liên lạc? quên mở ca?
                        ▼
          SharePoint AOG: Ca trực · Nhóm chung · Hộp đen · Cài đặt chung
```

Không có server riêng. Extension dùng chính đăng nhập Microsoft công ty trong trình duyệt để đọc/ghi SharePoint. SharePoint lỗi thì vẫn canh và reo, hai máy báo nhau qua nhóm điều phối WhatsApp.

## 🚀 Cài đặt

1. Tải repo (**Code → Download ZIP**), giải nén vào một thư mục cố định.
2. Mở `chrome://extensions` hoặc `edge://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục vừa giải nén → ghim icon.
3. Chuột phải icon → **Options** → bấm **Đăng nhập & kiểm tra** (site mặc định: CX SharePoint `trustanavn.sharepoint.com/sites/cx9`) → điền **Tên hiển thị** → **Lưu**.

Trưởng team làm thêm một lần: tạo 6 bảng AOG_* và đẩy cài đặt chung — xem [Cẩm nang vận hành](docs/SOP.md), mục A.

## 📋 Dùng thế nào

1. Mở sẵn WhatsApp Web và Outlook Web ở đúng hộp AOG.
2. Tới giờ ca: mở popup → **Bắt đầu ca** → làm theo **Kiểm tra đầu ca** tới khi huy hiệu hiện **SẴN SÀNG**.
3. Máy reo → bấm **ACK — TÔI NHẬN XỬ LÝ**; khoảng 10 phút sau trả lời **Xong** hoặc **Cần thêm thời gian**.
4. Chat lạ nhắn → **Thêm vào danh sách chung** (nhóm khách) hoặc **Bỏ qua** (chat cá nhân).
5. Hết ca → **Kết thúc ca**. Dòng ca trực đêm nay trên SharePoint tự có giờ vào/ra, tin đã ACK; ghi chú thêm ở cột Notes.

Chi tiết từng bước: [Cẩm nang vận hành](docs/SOP.md), mục B–C.

## ❓ Hỏng thì làm gì

- **Ô đỏ "Watcher đang MÙ" / "Không thấy tab" / "Sai hộp thư":** bấm **Đã biết**, tải lại tab hoặc mở đúng hộp AOG; ô đỏ tự mất khi đã sửa.
- **SharePoint đỏ:** Watcher vẫn canh và reo; mở SharePoint trong trình duyệt để đăng nhập lại. Dữ liệu tự ghi bù.
- **"Máy trực cùng mất liên lạc":** gọi người trực cùng.
- **Có tin mà không reo:** popup → **Có tin bị lọt?** → ghi nhận; hệ thống tự ghi nguyên nhân.
- **Sau khi cập nhật extension:** tải lại tab WhatsApp và Outlook.

Bảng chẩn đoán đầy đủ: [Cẩm nang vận hành](docs/SOP.md), mục D–E.

## 🛠️ Phát triển

Yêu cầu Node.js và npm. Extension dùng JavaScript ES2022, Manifest V3, không có dependency production hay build step.

```powershell
npm install
npm run check
```

`npm run check` kiểm tra các file manifest tham chiếu rồi chạy toàn bộ test Vitest. Kiến trúc hiện tại nằm ở [handoff/MAP.md](handoff/MAP.md); quy tắc làm việc nằm ở [handoff/RULES.md](handoff/RULES.md).

## 📄 Giấy phép

[MIT](LICENSE).
