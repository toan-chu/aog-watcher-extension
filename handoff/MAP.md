# AOG Watcher 5.0.0 - kiến trúc

Nguồn sự thật: file này. Cập nhật trước khi sửa code cấp kiến trúc (V5-01, 2026-09-28).

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
                               SharePoint site AOG: 5 List
                  AOG_Groups | AOG_Shifts | AOG_Events | AOG_Machines | AOG_Signals
                                                |
                   SharePoint lỗi/chưa cấu hình → peer fallback: tag WhatsApp cũ
```

## Biên giới module

| Khu vực | Trách nhiệm | File |
|---|---|---|
| Detection | Đọc DOM, baseline theo ca, phát hiện chat lạ, thống kê sức khoẻ | `content_*.js`, `lib/*selectors.js`, `lib/whatsapp_dom.js`, `lib/filter.js` |
| Coordination | Alert lifecycle, ACK, timer leo thang (không đổi so với 4.3) | `lib/state_machine.js`, `lib/alert_queue.js` |
| Peer transport | Gửi/nhận HANDLED/ESCALATED; SharePoint trước, WhatsApp tag dự phòng | `lib/team_sync.js`, `lib/peer_protocol.js`, `lib/peer_dispatch_guard.js` |
| Team data | Client SharePoint REST, schema 5 List, outbox thử lại | `lib/sharepoint_client.js`, `lib/sp_schema.js`, `lib/outbox.js`, `lib/team_sync.js` |
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
- Mọi ghi SharePoint đi qua outbox (lưu local, thử lại theo alarm) để hộp đen không mất khi mạng lỗi.
- Nhóm lạ vẫn reo; "Bỏ qua" chỉ có hiệu lực trên máy bấm.
- Preset không bao giờ chép tên, vai trò/slot, test mode, dry-run, nhóm bỏ qua, machine id.

## Lệnh xác minh

```powershell
npm run check
```

Live behavior (SharePoint thật, hai máy, WhatsApp/Outlook thật) cần nghiệm thu thủ công; mọi kết luận runtime trên Windows gắn `[RUNTIME CHƯA KIỂM]` cho tới khi Chairman xác nhận.
