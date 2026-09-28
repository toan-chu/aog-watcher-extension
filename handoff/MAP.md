# AOG Watcher v4.3.0 - current architecture

## Mục đích

Extension Manifest V3 theo dõi WhatsApp Web và Outlook Web trong ca trực AOG, đánh thức người trực chính, leo thang sang người dự phòng và xuất báo cáo ca. Không có server; dữ liệu nằm trong browser local storage.

## Luồng runtime

```text
WhatsApp Web DOM ---- content_whatsapp.js ----\
                                              \
Outlook Web DOM ----- content_outlook.js ------> service_worker.js
                                                |  state machine
Popup UI ------------ popup.js -----------------|  alert queue / peer protocol
Settings UI --------- settings.js --------------|  shift + event storage
                                                |
                                                +--> offscreen.js --> audio
                                                +--> Chrome notifications
                                                +--> CSV/XLSX downloads
```

## Biên giới module

| Khu vực | Trách nhiệm | File chính |
|---|---|---|
| Detection | Quan sát DOM, baseline theo ca, filter và health stats | `content_whatsapp.js`, `content_outlook.js`, `lib/*selectors.js`, `lib/filter.js` |
| Coordination | Nhận alert, ACK, peer tag, timeout và effect | `service_worker.js`, `lib/state_machine.js`, `lib/alert_queue.js`, `lib/peer_protocol.js` |
| Persistence | Config, shift, event log, runtime state và source health | `lib/storage.js`, `lib/shift_engine.js`, `lib/event_log.js`, `lib/runtime_state.js`, `lib/source_health.js` |
| Wake | Phát/dừng âm thanh trong offscreen document | `offscreen.html`, `offscreen.js`, `assets/audio/` |
| Operator UI | Start/End shift, ACK, diagnostics, config | `popup.*`, `settings.*` |
| Reporting | Tạo payroll CSV và analytics XLSX | `lib/csv_export.js`, `lib/report_generator.js`, `lib/vendor/xlsx.full.min.js` |
| Verification | MV3 structure, unit/static/integration tests | `tools/check_extension.mjs`, `tests/` |

## Contract quan trọng

- Start Shift tạo/reuse baseline theo `shift_id`; chỉ item xuất hiện sau baseline mới được alert.
- Alert lifecycle và escalation timer nằm trong state machine; idle/focused suppression chỉ gate audio/notification.
- ACK phát tag `[AOG-HANDLED]` qua nhóm WhatsApp điều phối để peer dừng wake.
- Content script gửi heartbeat/diagnostics; runtime guard dừng call khi extension context đã invalidated.
- Host boundary chỉ gồm các URL WhatsApp Web và Outlook được khai báo trong `manifest.json`.

## Lệnh xác minh

```powershell
npm run check
```

Lệnh chạy `tools/check_extension.mjs` rồi toàn bộ Vitest suite. Live overnight behavior vẫn cần manual acceptance trên hai máy với Chrome/Edge, WhatsApp và Outlook thật.
