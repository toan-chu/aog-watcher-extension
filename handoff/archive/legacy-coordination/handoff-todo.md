# Todo

## [2026-07-10] -- AOG Watcher v4.3 Field Feedback Fixes (spec: docs/20260710_aog-watcher-v43-blueprint.md)

Nguồn: feedback ca trực 30/06. Đọc blueprint TRƯỚC khi code — root cause đã verify từng dòng, không tự chẩn đoán lại.

**Đợt 1 — P0 (fix lỗi thực địa):**

- [x] WS1: Shift baseline — snapshot ID/count theo shift_id, chặn backlog flush (BASELINE_SYNC/REBASELINE handshake)
- [x] WS2: Outlook folder gate (`outlook_watch_path`) + unread labels đa ngôn ngữ + `sender_whitelist` + blacklist match display name
- [x] WS3: Diagnostics — scan stats trong CONTENT_HEALTH + popup Diagnostics panel

**Đợt 2 — P1 (UX trực đêm):**

- [x] WS4: Idle-gated wake (`chrome.idle`, permission mới) + focused-chat suppression. AN TOÀN: chỉ gate audio ở effect layer, escalation timers KHÔNG đổi
- [x] WS5: Âm thanh gentle loop tần số thấp (`wake_audio_mode`)
- [x] WS6: End Shift button rõ ràng + inline confirm (bỏ window.confirm)

- [x] Regression tests theo test plan 20 case trong blueprint, giữ 111 test cũ pass
- [ ] Claude review
- [ ] Team test 1 đêm theo checklist manual (a)-(f) trong blueprint

## [2026-06-23 12:01] -- AOG Watcher v4 Round 5 Report Fixes

- [x] Issue J: ACK/PEER_HANDLED/MISSED report rows carry group/sender/subject context
- [x] Issue K: Popup recent event times use Vietnam/local display instead of raw UTC slice
- [x] Issue L: CSV metadata, XLSX Report Info sheet, timestamped filenames, current-month default range
- [x] Export polish: CSV local dates/decimals, XLSX header/width/freeze/static styles, popup colors/truncate/tooltips, Settings helper/spinner/status
- [x] Add regression tests
- [x] Run automated verification
- [ ] Claude Round 5 review
- [ ] User manual test 18 steps

## Test Plan -- Round 5 Report Fixes

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | State machine local ACK | ACK event log includes group_name, sender, subject | pass |
| 2 | State machine peer handled | PEER_HANDLED event log includes group_name, sender, subject | pass |
| 3 | State machine max duration | MISSED event log includes group_name, sender, subject | pass |
| 4 | Alert detail rows | ACK row preserves context fields for management report | pass |
| 5 | Popup recent events | Uses `toLocaleTimeString("vi-VN")`, not UTC substring | pass |
| 6 | HR CSV export | Metadata comments precede column header and Generated at uses +07:00 | pass |
| 7 | Analytics XLSX export | Report Info is first sheet; five sheets are present | pass |
| 8 | Report filenames | Include from, to, and generated local timestamp | pass |
| 9 | Settings export UX | Blank date range defaults to current month; buttons disable while exporting | pass |
| 10 | Full check | 111/111 tests pass and MV3 check passes | pass |
| 11 | Production dependency audit | 0 vulnerabilities with `--omit=dev` | pass |
| 12 | Live manual checklist 1-18 | Reports and UI verified in Edge/Excel against real data | pending - user environment |

## [2026-06-23 11:25] -- AOG Watcher v4 Round 4 Claude Review Fixes

- [x] Issue E: mark open shift `shift_end` as `(in progress)`
- [x] Issue F: confirm End Shift stops monitoring
- [x] Issue G: backfill ACK response time from persisted event log
- [x] Run automated verification
- [ ] Claude final review
- [ ] User dry-run manual test

## Test Plan -- Round 4 Claude Review Fixes

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | Export open shift | `shift_end` is `(in progress)` | pass |
| 2 | Click End Shift | Popup asks confirmation and says monitoring stops | pass |
| 3 | ACK after service worker unload | Response time can be backfilled from persisted DETECTED event | pass |
| 4 | Full check | 100/100 tests pass | pass |
| 5 | Production dependency audit | 0 vulnerabilities with `--omit=dev` | pass |

## [2026-06-23 11:14] -- AOG Watcher v4 Finalize Round 3

- [x] P0 Issue D: remove over-guarded peer tag scan
- [x] P0 Issue B: verify peer tag after send click
- [x] P1 shift session storage and lifecycle
- [x] P1 event log enrichment with shift/operator/response time
- [x] P1 HR payroll CSV export
- [x] P1 Analytics XLSX export
- [x] P2 diagnostic dry-run mode
- [x] P2 popup dry-run badge and recent events
- [x] Run automated verification
- [ ] Claude review Round 3
- [ ] User manual checklist P0/P1/P2

## Test Plan -- Finalize Round 3

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | `scanPeerTags` source | Does not require active coord header before scanning | pass |
| 2 | `sendPeerTag` source | Verifies message appears within 3s after click | pass |
| 3 | Start shift session | Stores operator, partner, role, config snapshot | pass |
| 4 | End shift session | Sets `ended_at` for matching session | pass |
| 5 | Event log enrichment | Adds shift/operator fields | pass |
| 6 | ACK response time | Calculates `response_time_ms` from DETECTED to ACK | pass |
| 7 | HR payroll CSV | UTF-8 BOM and shift totals generated | pass |
| 8 | Analytics XLSX | Workbook has four expected sheets | pass |
| 9 | Dry-run wake | Logs `DRY_RUN_WOULD_WAKE`, no wake side effect path | pass |
| 10 | Dry-run peer tag | Logs `DRY_RUN_WOULD_SEND_TAG`, no WhatsApp send path | pass |
| 11 | MV3/check/test suite | 97/97 tests pass | pass |
| 12 | Production dependency audit | 0 vulnerabilities with `--omit=dev` | pass |
| 13 | Live P0 two-operator flow | Partner ACK stops local wake and exactly one coord tag appears | pending - user environment |
| 14 | Live P1 reports | HR CSV and Analytics XLSX open correctly in Excel | pending - user environment |
| 15 | Live P2 dry-run | No wake/no tag, popup logs dry-run events | pending - user environment |

## [2026-06-23 09:36] -- AOG Watcher v4 Runtime Fix Round 2

- [x] Confirm Round 2 root cause from Claude spec
- [x] Stop persisting handled queue entries across reload
- [x] Add restart simulation regression test
- [x] Harden WhatsApp coord-group send path before composer use
- [x] Add WhatsApp DOM helper regression tests
- [x] Stabilize Outlook message ID helper
- [x] Harden Outlook unread row scan after live connected-but-no-alert screenshot
- [x] Add content runtime guard for extension reload invalidation
- [x] Write Claude review handoff and block live testing
- [x] Run full automated verification
- [ ] Run live reload-after-ACK Outlook/WhatsApp manual scenarios
- [ ] Claude review before enabling extension again

## Test Plan -- Runtime Fix Round 2

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | ACK alert, serialize runtime state, hydrate after simulated restart | Runtime state has no queue and repeated alert_id wakes again | pass |
| 2 | Runtime serialization | `queue` is not persisted | pass |
| 3 | Outlook row has stable ancestor item ID | Stable ID is used over fallback | pass |
| 4 | Outlook fallback has different display date formatting | Message ID is unchanged because date is ignored | pass |
| 5 | Manifest Outlook content scripts | `outlook_message_id.js` loads before `content_outlook.js` | pass |
| 6 | WhatsApp row has broad avatar/preview title before group title | Group name is extracted from `span[dir='auto'][title]`, not broad `[title]` | pass |
| 7 | WhatsApp active header is coord group | Helper returns coord group name from `#main header` | pass |
| 8 | WhatsApp group names differ by case/spacing | Comparison still matches configured coord group | pass |
| 9 | Outlook unread button aria-label contains extra words/case | Wildcard unread selector still matches | pass |
| 10 | Outlook row selector misses current cloud DOM | Unread button ancestor climb still yields candidate row | pass |
| 11 | Outlook mutation observer misses arrival event | 2-second periodic scan catches unread row | pass |
| 12 | Repeated sender/subject test emails have different row text | Message IDs differ inside same content-script session | pass |
| 13 | Extension reload leaves old content-script timer alive | Runtime guard catches invalidated context and clears tracked intervals | pass |
| 14 | Content scripts send runtime messages | Calls route through `AOG_CONTENT_RUNTIME`, not direct `chrome.runtime.sendMessage` | pass |
| 15 | Live Outlook ACK -> reload -> same sender/subject alert | Alert wakes again | blocked - Claude review required |
| 16 | Live WhatsApp ACK after customer group alert | Peer tag appears only in coord group, never customer group | blocked - Claude review required |

## [2026-06-22 11:45] -- AOG Watcher v4 Runtime Fix Round 1

- [x] Prove peer-tag reducer cardinality and add dispatch idempotency
- [x] Add WhatsApp DOM duplicate guard and popup ACK debounce
- [x] Persist heartbeat health and derive 60-second connected status
- [x] Review Outlook hotpatch and support `outlook.cloud.microsoft`
- [x] Run full verification and append Round 1 audit/history

## Test Plan -- Runtime Fix Round 1

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | Reducer handles one local ACK | Exactly one `SEND_PEER_TAG` effect | pass |
| 2 | Same peer tag claimed twice within 5 minutes | Only first dispatch is allowed | pass |
| 3 | Failed peer send releases claim | A later retry is allowed | pass |
| 4 | Health heartbeat received | Source is connected and `last_seen` advances | pass |
| 5 | Health older than 60 seconds | Source is reported disconnected | pass |
| 6 | Email alert arrives without prior heartbeat | Outlook health becomes connected implicitly | pass |
| 7 | Popup receives ACK click | Button disables immediately until response | pass - static review |
| 8 | Outlook Cloud URL | Manifest injects Outlook content scripts | pass |
| 9 | Live email/WhatsApp ACK | Exactly one HANDLED tag per alert | pending - user environment |
| 10 | Close/reopen source tab | Health changes within heartbeat timeout | pending - user environment |


## [2026-06-22 00:00] -- Build AOG Watcher v4 Chrome Extension

- [x] Bootstrap MV3 project and workspace journals
- [x] Implement pure logic modules and automated tests
- [x] Implement service worker, content scripts, offscreen audio, popup, and settings
- [x] Verify tests and extension structure
- [x] Append build report and history
- [ ] Run live Chrome/Edge and two-operator manual scenarios 1-14

## Test Plan -- AOG Watcher v4

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | Primary detects an eligible alert | Starts wake audio and schedules escalation timers | pass |
| 2 | Backup detects an eligible alert | Remains silent and schedules backup safety timer | pass |
| 3 | Local operator acknowledges | Stops wake, records `handled_by=self`, sends HANDLED | pass |
| 4 | Partner handles matching active alert | Stops local wake and records `handled_by=partner` | pass |
| 5 | Primary timeout | Sends ESCALATED while local wake continues | pass |
| 6 | Backup delay expires without peer tag | Backup starts wake | pass |
| 7 | Maximum duration expires | Stops wake and records `handled_by=missed` | pass |
| 8 | Malformed or stale peer tag | Safely rejected without wake | pass |
| 9 | Email and WhatsApp filtering | Only configured customer alerts pass | pass |
| 10 | Overnight shift evaluation | Correct before/after midnight behavior | pass |
| 11 | Extension manifest and JS syntax | MV3 structure is valid and source parses | pass |
| 12 | Live Chrome/Edge two-operator flow | Manual scenarios 1-14 pass | pending - user environment required |
