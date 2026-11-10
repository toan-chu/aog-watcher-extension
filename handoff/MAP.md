# AOG Watcher 5.0.0 - kiến trúc

Chỉ mô tả hiện trạng. Mọi thay đổi kiến trúc vẽ ở đây trước khi đổi mã; lý do nằm trong phiếu gây ra thay đổi.

## Mục đích

Extension Manifest V3 (Chrome/Edge) canh WhatsApp Web và Outlook Web trong ca trực AOG, đánh thức người trực, leo thang sang máy dự phòng, tự phát hiện khi chính nó hỏng, và ghi dữ liệu ca vào SharePoint của group AOG. Không có server riêng.

## Luồng runtime

```text
WhatsApp Web DOM -- content_whatsapp.js --\                     /--> offscreen.js (âm thanh)
Outlook Web DOM ---- content_outlook.js ---+--> service_worker --+--> notifications
Popup / Settings --------------------------/    |  state machine (giữ từ 4.3)
                                                |  system alerts (mù, mất máy kia, quên mở ca)
                                                |  preflight, follow-up, miss cause
                                                v
                                   lib/team_sync.js + lib/outbox.js
                                                |  (đọc/ghi ngầm, cookie đăng nhập sẵn)
                                                v
                               SharePoint site AOG: 4 List
                 AOG_Groups | AOG_Settings | AOG_Shifts | AOG_Log
        (AOG_Log gộp 3 loại dòng theo cột RecordType: Event, Signal, Machine)
                                                |
                   SharePoint lỗi/chưa cấu hình → peer fallback: tag WhatsApp cũ
```

## Biên giới module

| Khu vực | Trách nhiệm | File |
|---|---|---|
| Detection | Đọc DOM, baseline theo ca, phát hiện chat lạ, thống kê sức khoẻ | `content_*.js`, `lib/*selectors.js`, `lib/whatsapp_dom.js`, `lib/filter.js` |
| Coordination | Alert lifecycle, ACK, timer leo thang (không đổi so với 4.3) | `lib/state_machine.js`, `lib/alert_queue.js` |
| Peer transport | Gửi/nhận HANDLED/ESCALATED; SharePoint trước, WhatsApp tag dự phòng | `lib/team_sync.js`, `lib/peer_protocol.js`, `lib/peer_dispatch_guard.js` |
| Team data | Client SharePoint REST, schema 4 List, cài đặt chung, outbox thử lại, sổ ca mỗi người một dòng mỗi đêm, tự dọn AOG_Log | `lib/sharepoint_client.js`, `lib/sp_schema.js`, `lib/outbox.js`, `lib/team_sync.js`, `lib/shared_settings.js`, `lib/shift_row.js` |
| Groups | Danh sách hiệu lực = nhóm team ∪ nhóm cá nhân − nhóm bỏ qua | `lib/groups.js` |
| Self-check | Mù nguồn, kiểm tra đầu ca, nhắc mở ca, nhịp tim máy kia, nguyên nhân miss | `lib/blind_detector.js`, `lib/preflight.js`, `lib/shift_reminder.js`, `lib/heartbeat.js`, `lib/miss_cause.js` |
| Follow-up | Hỏi lại sau ACK, leo thang lại khi không trả lời | `lib/followup.js` |
| Preset | Xuất/nhập cấu hình mẫu, lọc trường cá nhân | `lib/preset.js` |
| Wake | Âm thanh trong offscreen document | `offscreen.*`, `assets/audio/` |
| Operator UI | Popup: ca, checklist, alert, nhóm lạ, tin lọt; Settings | `popup.*`, `settings.*` |
| Verification | MV3 check + Vitest | `tools/check_extension.mjs`, `tests/` |

## Contract

- State machine 4.3 giữ nguyên; tính năng mới nằm ở effect layer và service worker.
- System alert (mù nguồn, máy kia mất liên lạc, quên mở ca, follow-up quá hạn) reo độc lập với state machine và có nút "Đã biết".
- Không bao giờ chặn việc canh tin vì checklist chưa đạt; checklist chỉ quyết định trạng thái "Sẵn sàng" gửi cho máy kia.
- Mọi ghi SharePoint đi qua outbox (lưu local, thử lại theo alarm) để hộp đen không mất khi mạng lỗi. Ngoại lệ: việc dọn dòng cũ của AOG_Log gọi thẳng, vì lỗi thì hôm sau tự chạy lại.
- Bảng do người sửa (AOG_Groups) chỉ bắt buộc cột Title; thiếu cột phụ như Active thì máy vẫn đọc.
- Mỗi máy chỉ ghi dòng AOG_Shifts của chính người trực trên máy đó (khớp theo ShiftDate và Email), không có dòng nào hai máy cùng ghi.
- Nhóm lạ vẫn reo; "Bỏ qua" chỉ có hiệu lực trên máy bấm.
- Preset không bao giờ chép tên, vai trò/slot, test mode, dry-run, nhóm bỏ qua, machine id.

## Lệnh xác minh

```powershell
npm run check
```

Hành vi thật (SharePoint thật, hai máy, WhatsApp/Outlook thật) cần chạy thử bằng tay trên máy Windows; mọi kết luận runtime chưa có lệnh hoặc ảnh từ máy thật gắn `[RUNTIME UNVERIFIED]`.
