# AOG Watcher v5.0.0

![License MIT](https://img.shields.io/badge/license-MIT-green)
![JavaScript ES2022](https://img.shields.io/badge/JavaScript-ES2022-yellow)
![Chrome MV3](https://img.shields.io/badge/Chrome%20%2F%20Edge-Manifest%20V3-orange)

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

## 🚀 Cài đặt và sử dụng

Làm theo [Cẩm nang vận hành](docs/SOP.md): mục A cho trưởng team (một lần), mục B cho người trực mới, mục C cho mỗi đêm.

## 🛠️ Phát triển

Yêu cầu Node.js và npm. Extension dùng JavaScript ES2022, Manifest V3, không có dependency production hay build step.

```powershell
npm install
npm run check
```

`npm run check` kiểm tra các file manifest tham chiếu rồi chạy toàn bộ test Vitest. Kiến trúc hiện tại nằm ở [handoff/MAP.md](handoff/MAP.md); quy tắc làm việc nằm ở [handoff/RULES.md](handoff/RULES.md).

## 📄 Giấy phép

[MIT](LICENSE).
