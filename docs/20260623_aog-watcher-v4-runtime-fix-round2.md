# AOG Watcher v4 — Runtime Fix Round 2

**Ngày:** 2026-06-23
**Owner:** Codex
**Reviewer:** Claude (code review từ Round 1 audit + live debug)
**Trạng thái:** READY FOR CODEX. 2 critical bugs.

---

## Context

Round 1 fix đã merge: peer dispatch guard + source health heartbeat. Vitest 72/72 pass, manual test ngày đầu OK.

Sang ngày hôm sau:
- **Email**: detection HOÀN TOÀN không kêu. Hôm qua kêu OK, hôm nay không.
- **WhatsApp**: detection vẫn kêu, nhưng khi ACK → tag `[AOG-HANDLED]` gửi vào **group khách hàng** thay vì group coord. User phải xóa thủ công vì lộ ra ngoài.

Cả 2 đều critical production blocker.

---

## Bug #3 — Persisted queue blocks re-detection of recurring alert_id (Email)

**Severity:** Critical. Sau khi user ACK 1 alert, mọi alert tương lai có cùng `alert_id` deterministic đều bị silent skip.

**Root cause (Claude code review):**

`lib/state_machine.js` line 23:
```js
case "ALERT_DETECTED": {
  const alert = event.payload.alert;
  if (next.queue.findById(alert.alert_id)) return { state, effects };
  ...
}
```

`service_worker.js` line 65 `persist()` lưu `state.queue.toJSON()` vào `chrome.storage.local`. Service worker hydrate lại (sau restart/reload/MV3 unload) → queue restore với tất cả entry cũ — bao gồm cả alert đã HANDLED/MISSED/SKIPPED.

`AlertQueue.mark()` chỉ đổi status, **không xóa entry**. Queue chỉ tăng dần.

Hậu quả:
1. Hôm qua: email A tới → detect → alert_id = `email-abc123` → vào queue → ACK → mark HANDLED. Entry vẫn còn.
2. Service worker persist queue → storage chứa `email-abc123` status=HANDLED.
3. Hôm sau extension reload → hydrate restore queue có `email-abc123`.
4. Email A vẫn còn trong inbox (chưa xóa) → content_outlook re-scan → cùng sender+subject+date → cùng alert_id deterministic `email-abc123`.
5. service_worker `handleAlert` → dispatch `ALERT_DETECTED`.
6. Reducer line 23: `findById("email-abc123")` returns entry HANDLED → `return { state, effects }` ngay, **không log, không kêu**.

Email mới hoàn toàn (sender+subject+date chưa từng thấy) thì pass guard. Nhưng email AOG production hiếm → vài ngày user không thấy alert nào → đoán extension dead.

**Tại sao Round 1 không bắt:** Vitest test state_machine với queue fresh mỗi test. Manual test cùng session ngắn → chưa reload extension giữa test.

### Fix đề xuất

**Option A (đề xuất, đơn giản):** Bỏ persist queue.

`service_worker.js`:
```js
async function persist() {
  await setRuntimeState({ app_state: state.app_state, current_alert: state.current_alert });
  broadcastStatus();
}

async function hydrate() {
  if (state) return state;
  const [stored, session] = await Promise.all([getRuntimeState(), getRoleSession()]);
  state = stored
    ? { ...createInitialState(session), app_state: stored.app_state ?? APP_STATE.IDLE, current_alert: stored.current_alert ?? null }
    : createInitialState(session);
  return state;
}
```

Queue chỉ là sổ tay trong session để dedup alert đang xử lý. Sau reload, content script re-scan DOM → mọi unread re-detect — khớp blueprint trade-off #5 ("Không persist alert active — re-detect DOM lại").

`current_alert` vẫn persist để service worker unload giữa ALERTING vẫn biết alert nào đang active.

**Option B:** Persist queue nhưng dedup chỉ với entry status QUEUED hoặc ALERTING. Cần `AlertQueue.remove(id)` method.

→ Chọn Option A.

---

## Bug #4 — Peer tag gửi nhầm group khách hàng thay vì group coord (WhatsApp)

**Severity:** Critical. Lộ noise `[AOG-HANDLED]` ra ngoài group khách hàng. User phải xóa thủ công.

**Root cause (Claude code review):**

`content_whatsapp.js` line 17-20 `groupName()`:
```js
function groupName(row) {
  const titled = [...row.querySelectorAll("[title]")].find((element) => element.getAttribute("title")?.trim());
  return titled?.getAttribute("title")?.trim() || first(row, selectors.title)?.textContent?.trim() || "";
}
```

Lấy **element đầu tiên có `[title]`** trong row. WhatsApp sidebar row chứa nhiều element có `title`:
- Avatar (title = group icon alt text)
- Group name (title = tên group)
- Last message preview (title = preview message)
- Timestamp (title = full date format)
- Mute icon (title = "muted")

`querySelectorAll("[title]")` trả về theo thứ tự DOM. Nếu avatar hoặc preview render trước group name → `groupName` trả về string sai → KHÔNG phải tên group thật.

`openCoordGroup()` line 73:
```js
const row = all(document, selectors.chatRows).find((candidate) => normalized(groupName(candidate)) === normalized(config?.coord_group));
```

Match nhầm row (vì `groupName` trả về preview/avatar text) → click row khác → mở conversation khách hàng → composer gõ text → click send → **tag gửi vào group khách**.

**Bug phụ — race timing:**

`openCoordGroup` line 77:
```js
row.click();
await new Promise((resolve) => setTimeout(resolve, 350));
```

350ms quá ngắn cho WhatsApp Web React render conversation mới. Nếu render chưa xong → composer vẫn ở conversation cũ → text gửi sai chỗ.

### Fix đề xuất

**4a — `groupName()` ổn định hơn:**

Anchor vào element có `[title]` nằm trong vùng **header text** của sidebar row, không phải avatar/preview/timestamp. WhatsApp Web hiện tại có pattern: tên group trong `span[dir='auto']` nằm trong row.

Đề xuất ưu tiên selector:
```js
function groupName(row) {
  // Ưu tiên 1: span[dir='auto'] với title chứa text (tên group)
  const named = [...row.querySelectorAll("span[dir='auto'][title]")].find((el) => {
    const title = el.getAttribute("title")?.trim();
    return title && title.length > 0 && title.length < 100;  // tên group thường ngắn
  });
  if (named) return named.getAttribute("title").trim();

  // Ưu tiên 2: span[dir='auto'] textContent (nếu không có title)
  const text = row.querySelector("span[dir='auto']")?.textContent?.trim();
  if (text && text.length > 0 && text.length < 100) return text;

  return "";
}
```

Codex investigate DOM thực tế WhatsApp Web hiện tại (qua DevTools), pick selector chính xác nhất. Selector cũ `selectors.title` (`["[title]", "span[dir='auto']"]`) quá broad — cần thu hẹp.

**4b — Verify trước khi gửi:**

Sau `openCoordGroup()` và trước `composer.focus()`, kiểm tra conversation hiện tại đúng coord group:

```js
async function sendPeerTag(text) {
  await refreshConfig();
  await openCoordGroup();
  await waitForCoordGroupActive();  // NEW
  if (messageExistsInCoordGroup(text)) return true;
  // ... composer logic
}

async function waitForCoordGroupActive(timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const header = document.querySelector("header [title], header span[dir='auto']");
    const currentName = header?.getAttribute("title")?.trim() || header?.textContent?.trim() || "";
    if (normalized(currentName) === normalized(config.coord_group)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for coord group "${config.coord_group}" to become active. Currently active: "${currentHeaderText()}"`);
}
```

Nếu sau 3s vẫn không phải coord group → THROW, không gửi.

**4c — Tăng wait sau click:**

350ms → 800ms tối thiểu. Hoặc dùng MutationObserver chờ DOM header thay đổi.

**4d — Selector composer scope chặt hơn:**

`selectors.composer` hiện tại match `#main footer [contenteditable='true']` — scoped vào `#main` (vùng conversation đang mở). Composer luôn của conversation đang active → nếu navigate sai → vẫn composer của conversation sai. **Phải verify conversation header TRƯỚC khi gõ.**

→ 4b là fix critical nhất. 4a + 4c là fix song song.

---

## Files Codex sửa

**Bug #3 (Email):**
- `service_worker.js`: bỏ persist queue trong `persist()` và `hydrate()`.
- `tests/state_machine.test.js` hoặc file mới `tests/integration_reload.test.js`: simulate reload scenario.

**Bug #4 (WhatsApp wrong group):**
- `content_whatsapp.js`: rewrite `groupName()`, thêm `waitForCoordGroupActive()`, tăng wait sau click, verify header trước khi gõ composer.
- `lib/whatsapp_selectors.js`: thêm selector `conversationHeader` để verify active conversation.
- Vitest test nếu có thể (DOM mock hạn chế, có thể skip nếu phức tạp).

**Bug phụ #5 (medium, không critical) — extractMessageId fragile:**

`content_outlook.js` line 62:
```js
return `email|${sender}|${subject}|${dateKey}`;
```

`dateKey` lấy từ `span[title*='/']` hoặc `span[title*=':']`. Outlook re-render date theo recent vs older (`"4:21 PM"` → `"Thu 6/18"` → `"Jun 18"`). Format đổi → message_id đổi → alert_id đổi → cùng email detect lại như mới.

**Fix:** hash chỉ `sender + subject`. Risk: email cùng sender+subject (auto-notification) bị dedup — acceptable.

Sau khi Bug #3 fix (queue không persist), Bug #5 impact nhẹ hơn (mỗi session fresh dedup). Vẫn nên fix dài hạn.

---

## Verification

**Vitest:**
- `npm run test` pass. Count tăng so với 72.
- Test mới: state machine sau reload không leak queue cũ.

**Manual test (user):**

**Email:**
1. Reload extension.
2. Gửi email AOG test → kêu.
3. ACK.
4. **Reload extension lần nữa** (critical — Round 1 không cover).
5. Gửi email AOG test thứ 2 (cùng sender, cùng subject) → **phải kêu**.
6. Lặp 3-5 vài lần confirm không regression.

**WhatsApp:**
1. Gửi tin vào customer group → kêu.
2. ACK.
3. **Mở từng customer group kiểm** — KHÔNG có message `[AOG-HANDLED]`.
4. Mở group coord — có đúng 1 message `[AOG-HANDLED]`.
5. Lặp với customer group khác.

---

## Notes

- Bug #3 không phải Codex Round 1 gây ra — tồn tại từ build đầu. Round 1 chỉ làm visible vì user reload extension giữa test.
- Bug #4 cũng tồn tại từ build đầu. Round 1 không phát hiện vì test cùng group coord lần đầu may mắn match đúng (sidebar render order).
- Round 1 fix giữ: peer dispatch guard + health heartbeat OK, không touch.
- Sau Round 2 xong, viết audit `docs/20260623_aog-watcher-v4-runtime-fix-round2-audit.md` log đầy đủ: root cause confirmed, fix chọn, test count, manual test cần lặp.
- Bug #4 đặc biệt nguy hiểm: lộ ra group khách → image risk. Codex ưu tiên 1 fix Bug #4 trước, Bug #3 sau.
