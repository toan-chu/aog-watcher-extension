# AOG Watcher v4 — Runtime Fix Round 1

**Ngày:** 2026-06-22
**Owner:** Codex
**Reviewer:** Claude (đã hotpatch selectors Outlook lúc debug)
**Trạng thái:** READY FOR CODEX. 2 core logic bugs cần fix.

---

## Context

Sau khi load extension lần đầu vào Edge + tab `outlook.cloud.microsoft/mail/`:
- WhatsApp detection: OK.
- Outlook detection: FAIL ban đầu do selectors obsolete. **Claude đã hotpatch trực tiếp 2 file `lib/outlook_selectors.js` và `content_outlook.js`** — Codex review patch, có thể giữ hoặc refactor.
- Sau hotpatch: detection chạy đúng, alert kêu, ACK dừng, tag gửi vào group coord OK.

**Out of scope round này (user decision):**
- Filter sender/subject noise — user tự config qua Settings sau. Inbox AOG production rất ít noise, không phải vấn đề cấp bách.

---

## Bug #1 — Peer tag gửi DUPLICATE vào group coord

**Severity:** High. Core logic bug. Spam group coord, có thể gây race condition phía receiver.

**Triệu chứng:**
- Sau khi ACK 1 email alert, group `aog-coord` nhận **2 message giống hệt** back-to-back (cùng alert_id, cùng timestamp, cùng payload).
- Sample observed (production data):
  ```
  [AOG-HANDLED]|alert_id=email-897d0f824f672ac270b4dad804a6c623|source=email|timestamp=2026-06-22T04:22:57.525Z|from_role=primary|operator=Toan|sender=Phoebe | TRUSTANA|subject=Pet Relocation Partnership: Vietnam Import/Export Network | Trustana
  [AOG-HANDLED]|alert_id=email-897d0f824f672ac270b4dad804a6c623|source=email|timestamp=2026-06-22T04:22:57.525Z|from_role=primary|operator=Toan|sender=Phoebe | TRUSTANA|subject=Pet Relocation Partnership: Vietnam Import/Export Network | Trustana
  ```

**Nguyên nhân nghi vấn (Codex investigate cụ thể bug nằm ở đâu):**

1. **Retry logic trong `content_whatsapp.js` `sendTextToCoordGroup`:** attempt 1 gửi thành công nhưng verify "message appeared in list within Xs" false negative do MutationObserver chưa pick up kịp → retry attempt 2 → thật sự gửi lại → 2 message trên server.

2. **Service worker dispatch `SEND_PEER_TAG` 2 lần:**
   - Listener đăng ký 2 lần do reload script không cleanup.
   - State machine reducer `USER_ACK` push 2 effect `SEND_PEER_TAG` (duplicate trong logic).

3. **Race ACK button:** user click ACK 2 lần liên tiếp (double-click) → 2 event dispatch.

**Fix đề xuất:**

**1a — Verify-before-retry trong sendTextToCoordGroup:**
- Trước khi retry, scan tin nhắn 30s gần nhất trong DOM coord group, tìm text exact match payload. Nếu found → return success, không retry.
- Implement helper: `messageExistsInCoordGroup(text, windowSeconds=30)`.

**1b — Idempotency key tại service worker tầng dispatch:**
- Hash `(tag_type, alert_id)` → lưu vào `sentPeerTags: Set<string>`. Khi nhận lệnh `SEND_PEER_TAG`, check key. Nếu đã gửi trong 5 phút qua → skip.
- Cleanup Set định kỳ (5 phút) để không grow vô hạn.

**1c — State machine audit:**
- Verify reducer test: `reduce(state, {type:"USER_ACK"})` trả về `effects` array có **đúng 1 phần tử** `{type:"SEND_PEER_TAG"}`, không hơn.
- Nếu fail → tìm chỗ duplicate trong reducer/wire.

**1d — Popup ACK debounce:**
- Disable button ACK ngay sau click + show spinner 500ms. Re-enable sau khi nhận confirm IDLE.

**Test:**
- Unit (Vitest): state_machine.test.js — reduce USER_ACK ALERTING → effects có đúng 1 SEND_PEER_TAG.
- Unit: service worker dispatch idempotency — gửi 2 lần cùng (tag, alert_id) trong 5 phút → chỉ 1 lần thật sự dispatch xuống content script.
- Manual: ACK 1 alert email, ACK 1 alert WhatsApp → group coord nhận đúng **1 message mỗi lần**.

---

## Bug #2 — Popup hiển thị "Outlook Web: Not detected" mặc dù detection chạy đúng

**Severity:** Low (cosmetic) NHƯNG misleading. User nhìn popup tưởng extension dead, phải debug. Sửa luôn vì handshake này là core observability.

**Triệu chứng:**
- Popup status panel: "WhatsApp Web: Connected" / "Outlook Web: Not detected".
- Đồng thời popup ALERTING với alert source=email, sender + subject lấy từ Outlook → chứng minh content_outlook đang detect + gửi `ALERT_DETECTED` thành công.
- → "Not detected" sai. Detection hoạt động.

**Nguyên nhân nghi vấn:**
- `content_outlook.js` line 42 gửi `chrome.runtime.sendMessage({ type: "CONTENT_HEALTH", source: "outlook", connected: true })` **1 lần** lúc startup trong `.then()` của `refreshConfig()`.
- Service worker MV3 có thể chưa active tại thời điểm đó → message lost.
- Hoặc service worker không handle CONTENT_HEALTH đúng / không update state mà popup query.

**Fix đề xuất:**

**2a — Service worker handle CONTENT_HEALTH:**
- Khi nhận `{type:"CONTENT_HEALTH", source, connected}` → set `runtime.health[source] = {connected, last_seen: Date.now()}`. Persist `chrome.storage.local` để popup query được sau service worker restart.

**2b — Implicit health từ ALERT_DETECTED:**
- Khi service worker nhận `ALERT_DETECTED` từ source nào → cũng update `health[source].last_seen = Date.now()`. Vì alert detect được = content script alive.

**2c — Content script periodic heartbeat:**
- Thay vì gửi 1 lần startup, gửi `CONTENT_HEALTH` mỗi 30s qua `setInterval`.
- Service worker tính `connected = (Date.now() - last_seen) < 60_000`.

**2d — Popup query status:**
- Popup mỗi 2s gọi `GET_STATUS` (đã có theo blueprint mục 6.16). Service worker trả về `health` object → popup render label "Connected"/"Not detected" theo `connected` flag.

**Test:**
- Unit (Vitest): service worker reducer/handler nhận CONTENT_HEALTH → state có `health.outlook.connected = true`.
- Unit: implicit health — handler nhận ALERT_DETECTED + source=email → state.health.outlook.last_seen updated.
- Manual: reload extension → mở popup → trong 3-5s cả 2 nguồn chuyển "Connected". Đóng tab Outlook → trong 60s chuyển "Not detected".

---

## Files Claude đã hotpatch (Codex review)

**`lib/outlook_selectors.js`:**
- Đổi anchor từ class hash random (`XG5Jd`, `TszOG`) sang attribute ổn định: `title`, `aria-label`, `role`.
- `messageRows` dùng `:has()` pseudo-class (Edge 105+ support) để anchor row qua descendant `div[role='checkbox'][aria-label='Select a conversation']`.
- `unreadRow` đổi sang detect `button[aria-label='Mark as read']` (button label cho action available — UNREAD email có action "mark as read").

**`content_outlook.js`:**
- Tách `extractSender`, `extractSubject`, `extractMessageId` thành 3 hàm riêng.
- `extractSender`: ưu tiên `span[title*='@']` (email address), fallback avatar `aria-label` (display name).
- `extractSubject`: dùng structural fallback (span không có `title` attribute, leaf text node, length 3-200) vì subject span trong Outlook cloud có class hash random không stable.
- `extractMessageId`: deterministic hash từ sender+subject+date title vì Outlook cloud không expose `data-convid` trong row.

**Codex review checklist:**
- Selectors mới hợp lý nhưng cần fallback chain dài hơn (vd Outlook office cũ vẫn đang live ở 1 số tenant).
- `extractSubject` structural fallback có thể false positive với preview text — verify trên nhiều email khác nhau.
- Nếu refactor, giữ test coverage tương đương.

---

## Migration steps

1. Read 2 file Claude hotpatched — giữ hoặc refactor.
2. Fix Bug #1 (duplicate tag) — investigate root cause cụ thể (retry, listener double, state machine, hoặc race). Implement 4 fix layer (1a-1d) hoặc subset phụ thuộc root cause tìm được.
3. Fix Bug #2 (health handshake) — implement 4 fix (2a-2d).
4. Update Vitest tests.
5. `npm run test` pass — verify count tăng so với 57 trước đó.
6. Tạo audit `docs/20260622_aog-watcher-v4-runtime-fix-round1-audit.md` log: files changed, root cause Bug #1 tìm được, test count, manual test còn lại.

---

## Manual test required (user) sau khi Codex xong

1. Reload extension trên Edge.
2. Refresh tabs WhatsApp Web + Outlook Web.
3. Check popup: 2 nguồn chuyển "Connected" trong 5s.
4. Gửi 1 email test vào inbox → alert kêu.
5. ACK → group `aog-coord` nhận **đúng 1 message** `[AOG-HANDLED]` (không phải 2).
6. ACK 1 alert từ WhatsApp customer group → tương tự, **đúng 1 message** tag.
7. Đóng tab Outlook → 60s sau popup chuyển "Outlook Web: Not detected". Mở lại tab → 5s sau chuyển "Connected".

---

## Questions for review (Codex flag nếu gặp)

- Nếu root cause duplicate tag nằm ở MutationObserver verify timing → có cần tăng wait window? Đề xuất số cụ thể.
- Nếu service worker MV3 unload làm mất `runtime.health` in-memory → có muốn persist mọi update vào storage không (cost write storage mỗi 30s × 2 source)? Hoặc chỉ persist khi state đổi?
