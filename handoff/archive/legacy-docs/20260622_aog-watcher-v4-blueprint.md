# AOG Watcher v4 — Chrome Extension Blueprint (Codex Build Spec)

**Ngày:** 2026-06-22
**Loại:** Chrome Extension Manifest V3 (Chrome + Edge)
**Trạng thái:** READY FOR CODEX. Supersedes toàn bộ v3 Python codebase.
**Scope:** Build từ đầu trong `C:\Users\RYAN TOAN\Downloads\2_TOOLS\aog-watcher-extension`. Không port code Python. Kế thừa logic + timing + edge case từ v3.

---

## 1. Mục tiêu kiến trúc v4

Pivot từ Python desktop app sang Chrome Extension MV3.

Lý do (đã chốt với user, không thảo luận lại):

1. Máy trực đêm yếu, Python lag.
2. Gmail bridge v3 fail 8-9 lần test không stable (App Password timeout, IMAP rớt, port 587/465 firewall).
3. Outlook AOG block forward ra Gmail ngoài → pipeline email forward v3 không khả thi production.
4. Extension MV3 chạy native trong browser, zero install (load unpacked).

Trade-off chấp nhận:
1. Phải mở Chrome/Edge 24/7 trong ca trực.
2. Phải mở WhatsApp Web tab + Outlook Web tab suốt ca.
3. DOM của WhatsApp/Outlook có thể đổi theo update → cần selector layer riêng dễ patch.
4. Latency peer tag qua WhatsApp DOM = 1-3s (nhanh hơn email IMAP 30-60s).

---

## 2. Stack

- **Ngôn ngữ:** JavaScript ES2022 thuần (không TypeScript, không build tool).
- **Runtime:** Chrome 120+ / Edge 120+ với Manifest V3.
- **Test framework:** Vitest (chạy bằng Node, không chạy trong extension).
- **No external dependency:** không npm package trong production code. Vitest chỉ dùng dev-only.

Lý do không TypeScript: extension MV3 load file `.js` plain, thêm TS = thêm build step + sourcemap, không tương xứng size dự án (~1500-1800 LOC).

---

## 3. Nguyên lý hoạt động

### 3.1 Detection độc lập per-machine

Mỗi máy có 2 content script chạy độc lập:

- **`content_whatsapp.js`** inject vào `https://web.whatsapp.com/*`.
  - MutationObserver theo dõi sidebar group list.
  - Detect: group name (tên group) + unread count (số badge).
  - Chỉ alert nếu group name thuộc whitelist "Customer groups".
  - Group thuộc "Coord group" → không alert, dùng để gửi/nhận peer tag.

- **`content_outlook.js`** inject vào `https://outlook.office.com/mail/*` và `https://outlook.live.com/mail/*`.
  - MutationObserver theo dõi inbox list.
  - Detect: email mới chưa đọc với sender + subject.
  - Filter skip sender domain (`@trustana.vn`) + subject keyword.

Cả 2 máy detect độc lập, không sync queue cross-machine. Khớp nhau qua peer tag.

### 3.2 Role Primary / Backup

User chọn role ở popup lúc start ca. Lưu `chrome.storage.local`.

- **Primary:** alert vào queue → kêu ngay (qua offscreen audio).
- **Backup:** alert vào queue → im lặng. Chỉ kêu khi 1 trong 2:
  1. Nhận `[AOG-ESCALATED]` từ Primary trong group coord.
  2. `backup_delay_seconds` trôi qua kể từ lúc alert detect và không nhận tag nào (Primary chết câm).

### 3.3 Peer coordination qua WhatsApp DOM

Cả 2 máy đều mở group "Coord" trên WhatsApp Web. Content script:

- **Gửi tag:** dán text vào ô input của group coord, trigger keypress Enter (qua synthesized event), wait DOM confirm message đã send.
- **Nhận tag:** MutationObserver group coord, parse message text. Match prefix `[AOG-ESCALATED]` hoặc `[AOG-HANDLED]`.

Format text peer message (1 line, separator `|`):

```
[AOG-ESCALATED]|alert_id=<id>|source=<whatsapp|email>|timestamp=<ISO>|from_role=<primary|backup>|extra=<key1:val1;key2:val2>
[AOG-HANDLED]|alert_id=<id>|source=<whatsapp|email>|timestamp=<ISO>|from_role=<primary|backup>|operator=<display_name>
```

Lý do single-line `|`: WhatsApp Web render multi-line message phức tạp hơn (cần shift+enter), single-line dễ generate + dễ parse.

### 3.4 Match alert giữa 2 máy

- **Email alert:** match qua `message_id` của Outlook (DOM có thể đọc được từ `data-convid` hoặc thread ID). Hash MD5 → alert_id deterministic. 2 máy detect cùng email → cùng alert_id.
- **WhatsApp alert:** mỗi máy detect độc lập từ DOM của máy đó. Match qua:
  1. Deterministic ID: hash MD5(group_name + first_unread_message_text + timestamp_minute).
  2. Fallback nếu ID không match: source=whatsapp + timestamp ±60s window (giống v3).

### 3.5 State machine

```
IDLE ──(alert pass shift + role gate)──> ALERTING
ALERTING ──(local ACK)──> IDLE
ALERTING ──(receive [AOG-HANDLED] matching current alert)──> IDLE
ALERTING ──(max_alert_duration trôi qua)──> IDLE (mark MISSED)
```

Không có HANDLING state. Giữ logic v3 final (audit `20260603_aog-watcher-v2-remove-handling-fix-t3-audit.md`).

### 3.6 Flow scenarios

**Path 1 — Primary handle bình thường:**
```
T+0    : alert vào queue cả A (Primary) và B (Backup).
T+0    : A start ALERTING + play audio. B im lặng (vẫn IDLE, alert SKIPPED khi nhận tag).
T+30   : A bấm ACK trên popup.
T+30   : A gửi [AOG-HANDLED] vào group coord.
T+30   : A stop wake, mark HANDLED, về IDLE.
T+31..33: B content script nhận tag qua DOM observer → mark alert SKIPPED → vẫn IDLE.
```

**Path 2 — Primary ngủ quên (app A còn sống):**
```
T+0   : alert vào queue cả A và B.
T+0   : A ALERTING. B im lặng.
T+120 : A primary_timeout chưa ACK → A gửi [AOG-ESCALATED] vào group coord. A tiếp tục kêu.
T+122 : B nhận tag → B start ALERTING + play audio.
T+150 : B ACK trên popup B.
T+150 : B gửi [AOG-HANDLED] vào group coord.
T+150 : B stop wake, mark HANDLED, về IDLE.
T+152 : A nhận [AOG-HANDLED] → A stop wake, mark HANDLED (handled_by=partner), về IDLE.
```

**Path 3 — Primary chết app (Chrome A crash / mất điện / extension off):**
```
T+0   : alert vào queue B (A không detect được vì chết).
T+0   : B im lặng (Backup, đợi tag).
T+180 : backup_delay trôi qua, B không nhận tag nào → B tự start ALERTING + play audio.
T+X   : B ACK. B gửi [AOG-HANDLED] (A chết nên không nhận, không sao).
T+X   : B stop wake, mark HANDLED, về IDLE.
```

### 3.7 Khác biệt v4 vs v3 (Fix Round 2 logic apply cho v4)

v3 Fix Round 2 đã đổi: `[AOG-HANDLED]` **STOP local wake** khi đang ALERTING (audit `20260608_aog-watcher-v3-fix-round2-audit.md`). v4 áp dụng logic này từ đầu.

→ Khi Backup nhận `[AOG-HANDLED]` trong khi đang ALERTING (case Primary chết, B đã tự kêu, nhưng Primary phục hồi và ACK trước) → B stop wake. Đối xứng cho Primary nhận `[AOG-HANDLED]` (Path 2 ở trên).

`handled_by` field cho event log:
- `self` — local user ACK.
- `partner` — nhận `[AOG-HANDLED]` khi đang ALERTING.
- `missed` — max_alert_duration trôi qua.

---

## 4. File structure

```
aog-watcher-extension/
├── manifest.json                          # MV3 manifest
├── service_worker.js                      # Background: state machine, alarms, peer dispatch
├── content_whatsapp.js                    # WhatsApp Web DOM observer + peer tag I/O
├── content_outlook.js                     # Outlook Web DOM observer + email filter
├── offscreen.html                         # Offscreen doc shell
├── offscreen.js                           # Audio playback 4 level
├── popup.html                             # Toolbar popup UI
├── popup.js                               # Popup controller
├── popup.css                              # Popup styling
├── settings.html                          # Settings page (chrome-extension://...)
├── settings.js                            # Settings controller
├── settings.css                           # Settings styling
├── lib/
│   ├── storage.js                         # Wrapper chrome.storage.local
│   ├── state_machine.js                   # Pure logic state machine (testable)
│   ├── peer_protocol.js                   # Parse + serialize peer tag text
│   ├── alert_queue.js                     # Queue logic (testable)
│   ├── filter.js                          # Sender domain + subject keyword
│   ├── escalation.js                      # backup_should_wake, trigger_escalation
│   ├── shift_engine.js                    # Shift hours check
│   ├── hash.js                            # MD5 hash for deterministic alert_id
│   ├── event_log.js                       # Append event records
│   ├── csv_export.js                      # Generate CSV blob
│   └── constants.js                       # All constants (timing, level volumes, etc.)
├── assets/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   └── audio/
│       ├── alert_soft.wav                 # Level 1 — placeholder beep generated
│       ├── alert_medium.wav               # Level 2
│       ├── alert_loud.wav                 # Level 3
│       └── alert_urgent.wav               # Level 4
├── tests/
│   ├── state_machine.test.js
│   ├── peer_protocol.test.js
│   ├── alert_queue.test.js
│   ├── filter.test.js
│   ├── escalation.test.js
│   ├── shift_engine.test.js
│   └── hash.test.js
├── package.json                           # Dev only: vitest
├── vitest.config.js
├── .gitignore
└── docs/
    └── 20260622_aog-watcher-v4-blueprint.md   # File này
```

Tổng ước tính: ~14 file production JS + 4 HTML/CSS + 7 file test. LOC ~1500-1800.

---

## 5. `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "AOG Watcher",
  "version": "4.0.0",
  "description": "Monitor WhatsApp + Outlook AOG alerts during night duty, with peer coordination between 2 operators.",
  "permissions": [
    "storage",
    "alarms",
    "offscreen",
    "notifications"
  ],
  "host_permissions": [
    "https://web.whatsapp.com/*",
    "https://outlook.office.com/*",
    "https://outlook.live.com/*"
  ],
  "background": {
    "service_worker": "service_worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://web.whatsapp.com/*"],
      "js": ["content_whatsapp.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://outlook.office.com/mail/*",
        "https://outlook.live.com/mail/*"
      ],
      "js": ["content_outlook.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "assets/icon16.png",
      "32": "assets/icon32.png",
      "48": "assets/icon48.png",
      "128": "assets/icon128.png"
    }
  },
  "icons": {
    "16": "assets/icon16.png",
    "32": "assets/icon32.png",
    "48": "assets/icon48.png",
    "128": "assets/icon128.png"
  },
  "options_page": "settings.html",
  "web_accessible_resources": [
    {
      "resources": ["assets/audio/*.wav", "offscreen.html"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

**Permission rationale:**
- `storage`: lưu config + event log.
- `alarms`: timer cho primary_timeout, backup_delay, max_alert_duration (service worker không giữ setTimeout qua sleep).
- `offscreen`: chạy audio (service worker MV3 không play audio trực tiếp).
- `notifications`: fallback notification khi user không tương tác popup.
- `host_permissions`: chỉ 3 domain cụ thể, không `<all_urls>`.

---

## 6. Spec từng file

### 6.1 `lib/constants.js`

```js
export const TIMING = {
  PRIMARY_TIMEOUT_SECONDS: 120,
  BACKUP_DELAY_SECONDS: 180,
  MAX_ALERT_DURATION_SECONDS: 540,
  WAKE_LEVELS: 4,
  WAKE_ESCALATION_INTERVAL_SECONDS: 15,
  MIN_WAKE_CYCLE_SECONDS: 3,
  PEER_MATCH_WINDOW_SECONDS: 60,
  PEER_SEND_RETRY_ATTEMPTS: 3,
  PEER_SEND_RETRY_BACKOFF_MS: [500, 1500, 3000],
};

export const PEER_TAG = {
  ESCALATED: "[AOG-ESCALATED]",
  HANDLED: "[AOG-HANDLED]",
};

export const ALERT_SOURCE = {
  WHATSAPP: "whatsapp",
  EMAIL: "email",
};

export const ALERT_STATUS = {
  QUEUED: "QUEUED",
  ALERTING: "ALERTING",
  HANDLED: "HANDLED",
  SKIPPED: "SKIPPED",
  MISSED: "MISSED",
};

export const APP_STATE = {
  IDLE: "IDLE",
  ALERTING: "ALERTING",
};

export const ROLE = {
  PRIMARY: "primary",
  BACKUP: "backup",
};

export const HANDLED_BY = {
  SELF: "self",
  PARTNER: "partner",
  MISSED: "missed",
};

export const LEVEL_AUDIO_FILES = {
  1: "assets/audio/alert_soft.wav",
  2: "assets/audio/alert_medium.wav",
  3: "assets/audio/alert_loud.wav",
  4: "assets/audio/alert_urgent.wav",
};

export const LEVEL_VOLUMES = {
  1: 0.30,
  2: 0.60,
  3: 1.00,
  4: 1.00,
};

export const STORAGE_KEYS = {
  CONFIG: "aog_config",
  ROLE_SESSION: "aog_role_session",
  EVENT_LOG: "aog_event_log",
  ESCALATED_ALERT_IDS: "aog_escalated_alert_ids",
};

export const DEFAULT_CONFIG = {
  test_mode: false,
  self_display_name: "",
  partner_display_name: "",
  customer_groups: [],          // string[] tên group WhatsApp
  coord_group: "",              // string tên group coord
  shift_start: "22:00",
  shift_end: "08:00",
  skip_sender_domains: ["trustana.vn"],
  subject_keywords: [],         // string[] subject phải chứa 1 trong
  primary_timeout_seconds: 120,
  backup_delay_seconds: 180,
  max_alert_duration_seconds: 540,
};
```

### 6.2 `lib/storage.js`

Wrapper async cho `chrome.storage.local`.

```js
export async function getConfig() { /* ... */ }
export async function setConfig(config) { /* ... */ }
export async function getRoleSession() { /* ... */ }      // {role, started_at}
export async function setRoleSession(session) { /* ... */ }
export async function appendEventLog(record) { /* ... */ }
export async function getEventLog(filter) { /* ... */ }   // filter by date
export async function clearEventLog(beforeDate) { /* ... */ }
export async function markAlertEscalated(alertId) { /* ... */ }
export async function isAlertEscalated(alertId) { /* ... */ }
```

Event log record:
```js
{
  timestamp: "2026-06-22T22:30:15Z",
  alert_id: "...",
  source: "whatsapp"|"email",
  role: "primary"|"backup",
  event_type: "DETECTED"|"ALERTING"|"ACK"|"MISSED"|"PEER_HANDLED"|"PEER_ESCALATED_SENT"|"PEER_ESCALATED_RECEIVED",
  handled_by: "self"|"partner"|"missed"|null,
  sender: "",
  subject: "",
  group_name: "",
  unread_count: 0,
}
```

### 6.3 `lib/state_machine.js`

Pure function — không reference `chrome.*`. Testable bằng Vitest.

```js
import { APP_STATE, ALERT_STATUS, ROLE } from "./constants.js";

export function reduce(state, event) {
  // state: { app_state, current_alert, queue, session }
  // event: { type, payload }
  // return new state + side_effects[]
}

// Event types:
// - ALERT_DETECTED
// - ALERT_ACK (local user)
// - PEER_HANDLED_RECEIVED
// - PEER_ESCALATED_RECEIVED
// - TIMER_PRIMARY_TIMEOUT
// - TIMER_BACKUP_DELAY
// - TIMER_MAX_DURATION
// - ROLE_CHANGED

// Side effect types:
// - START_WAKE
// - STOP_WAKE
// - SEND_PEER_TAG (ESCALATED | HANDLED)
// - SCHEDULE_TIMER (name, delay_ms)
// - CANCEL_TIMER (name)
// - APPEND_EVENT_LOG
// - SHOW_NOTIFICATION
```

`service_worker.js` execute side effects, không có logic state trực tiếp.

### 6.4 `lib/alert_queue.js`

```js
export class AlertQueue {
  constructor() { this.items = []; }
  add(alert) { /* dedupe by alert_id, return existing if dup */ }
  nextPending() { /* return first QUEUED */ }
  mark(alertId, status, reason = "") { /* ... */ }
  findById(alertId) { /* ... */ }
  findWhatsAppByTimestamp(timestamp, windowSeconds) { /* match peer WA alert */ }
  all() { return [...this.items]; }
  countPending() { /* ... */ }
}
```

### 6.5 `lib/peer_protocol.js`

```js
import { PEER_TAG } from "./constants.js";

export function serializeTag(type, payload) {
  // type: "ESCALATED" | "HANDLED"
  // payload: { alert_id, source, timestamp, from_role, operator?, sender?, subject?, unread_count? }
  // return string single-line "|" separated
}

export function parseTag(text) {
  // input: "[AOG-ESCALATED]|alert_id=...|source=..."
  // return { tag, payload } or null
  // tag: "ESCALATED" | "HANDLED"
}

export function isTagText(text) {
  return text.startsWith(PEER_TAG.ESCALATED) || text.startsWith(PEER_TAG.HANDLED);
}
```

### 6.6 `lib/filter.js`

```js
import { ALERT_SOURCE } from "./constants.js";

export function shouldSkipEmail(alert, config) {
  // Skip if sender domain in skip list
  // Skip if subject_keywords list non-empty AND subject does not contain any keyword
  // Skip if sender == partner email (legacy, but v4 không có partner email)
}

export function shouldAlertWhatsAppGroup(groupName, config) {
  // true if groupName in customer_groups, false if coord_group, false otherwise
}

export function isCoordGroup(groupName, config) {
  return groupName === config.coord_group;
}
```

### 6.7 `lib/escalation.js`

```js
import { ROLE } from "./constants.js";
import { isAlertEscalated } from "./storage.js";

export async function backupShouldWake(alert, session, backupDelaySeconds) {
  if (!session) return false;
  if (session.role === ROLE.PRIMARY) return true;
  if (await isAlertEscalated(alert.alert_id)) return true;
  const elapsed = (Date.now() - new Date(alert.detected_at).getTime()) / 1000;
  return elapsed >= backupDelaySeconds;
}

export function shouldTriggerEscalation(session) {
  return session && session.role === ROLE.PRIMARY;
}
```

### 6.8 `lib/shift_engine.js`

```js
export function isWithinShift(now, shiftStart, shiftEnd) {
  // Parse "HH:MM" → Date today.
  // Handle overnight shift (22:00–08:00 spans midnight).
  // Return boolean.
}

export function currentShiftWindow(now, shiftStart, shiftEnd) {
  // Return {start: Date, end: Date} of the active or upcoming shift.
}
```

### 6.9 `lib/hash.js`

MD5 implementation (pure JS, no deps). Lý do MD5 không SHA: chỉ cần deterministic ID, không security. Code ngắn, đủ.

```js
export function md5(str) { /* ... */ }

export function deterministicAlertId(source, ...parts) {
  return `${source}-${md5(parts.join("|")).slice(0, 12)}`;
}
```

### 6.10 `lib/event_log.js`

```js
import { appendEventLog } from "./storage.js";

export async function recordEvent(record) {
  // Add timestamp if missing, default fields, push to storage
}
```

### 6.11 `lib/csv_export.js`

```js
import { getEventLog } from "./storage.js";

export async function exportCsvBlob(startDate, endDate) {
  // Build CSV with header: timestamp,alert_id,source,role,handled_by,event_type,sender,subject,group_name,unread_count
  // Return Blob
}

export function downloadCsv(blob, filename) {
  // Use URL.createObjectURL + chrome.downloads.download
  // Filename: aog-events-YYYYMMDD.csv
}
```

### 6.12 `service_worker.js`

**Module module, ES imports.** Lifecycle:

```js
import { reduce } from "./lib/state_machine.js";
import * as storage from "./lib/storage.js";
import { serializeTag } from "./lib/peer_protocol.js";
import { TIMING, APP_STATE, ROLE, HANDLED_BY, ... } from "./lib/constants.js";

let runtime = {
  app_state: APP_STATE.IDLE,
  current_alert: null,
  queue: new AlertQueue(),
  session: null,           // load from storage on init
};

// On install / startup
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);

async function initialize() {
  runtime.session = await storage.getRoleSession();
  // Restore queue: no (intentional, re-detect from DOM on resume)
  // Subscribe to alarms
}

// Message routing from content scripts + popup
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  switch (msg.type) {
    case "ALERT_DETECTED": await onAlertDetected(msg.payload); break;
    case "PEER_TAG_RECEIVED": await onPeerTagReceived(msg.payload); break;
    case "USER_ACK": await onUserAck(); break;
    case "ROLE_CHANGE": await onRoleChange(msg.payload); break;
    case "GET_STATUS": sendResponse(buildStatus()); break;
    // ...
  }
  return true;  // async
});

// Alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  switch (alarm.name) {
    case "primary_timeout": await onPrimaryTimeout(); break;
    case "backup_delay": await onBackupDelay(); break;
    case "max_alert_duration": await onMaxDuration(); break;
  }
});
```

**Side effect dispatcher:**

```js
async function dispatchSideEffects(effects) {
  for (const effect of effects) {
    switch (effect.type) {
      case "START_WAKE": await startWake(effect.payload); break;
      case "STOP_WAKE": await stopWake(); break;
      case "SEND_PEER_TAG": await sendPeerTag(effect.payload); break;
      case "SCHEDULE_TIMER": chrome.alarms.create(effect.name, { delayInMinutes: effect.delayMs / 60000 }); break;
      case "CANCEL_TIMER": chrome.alarms.clear(effect.name); break;
      case "APPEND_EVENT_LOG": await recordEvent(effect.payload); break;
    }
  }
}
```

**Audio control via offscreen:**

```js
async function startWake(alert) {
  await ensureOffscreen();
  await chrome.runtime.sendMessage({
    target: "offscreen",
    type: "START_AUDIO",
    payload: { alert_id: alert.alert_id, start_time: Date.now() },
  });
}

async function stopWake() {
  await chrome.runtime.sendMessage({
    target: "offscreen",
    type: "STOP_AUDIO",
  });
}

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument?.();
  if (existing) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play wake alarm sounds during AOG night duty.",
  });
}
```

**Peer tag send:**

```js
async function sendPeerTag(payload) {
  const text = serializeTag(payload.tag, payload.data);
  // Send to WhatsApp content script
  const [tab] = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
  if (!tab) { logError("No WhatsApp tab open, cannot send peer tag"); return; }
  await chrome.tabs.sendMessage(tab.id, {
    type: "SEND_TO_COORD_GROUP",
    payload: { text, retry: TIMING.PEER_SEND_RETRY_ATTEMPTS },
  });
}
```

### 6.13 `offscreen.js`

Play audio loop với escalation level dựa trên elapsed time.

```js
let currentAudio = null;
let stopFlag = false;
let startTime = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== "offscreen") return;
  switch (msg.type) {
    case "START_AUDIO": startLoop(msg.payload); break;
    case "STOP_AUDIO": stopLoop(); break;
  }
});

async function startLoop({ alert_id, start_time }) {
  stopFlag = false;
  startTime = start_time;
  while (!stopFlag) {
    const elapsed = (Date.now() - startTime) / 1000;
    const level = Math.min(Math.floor(elapsed / TIMING.WAKE_ESCALATION_INTERVAL_SECONDS) + 1, TIMING.WAKE_LEVELS);
    await playLevel(level);
    if (stopFlag) break;
    await sleep(TIMING.MIN_WAKE_CYCLE_SECONDS * 1000);
  }
}

async function playLevel(level) {
  const audio = new Audio(chrome.runtime.getURL(LEVEL_AUDIO_FILES[level]));
  audio.volume = LEVEL_VOLUMES[level];
  currentAudio = audio;
  await new Promise((resolve) => {
    audio.onended = resolve;
    audio.onerror = resolve;
    audio.play().catch(resolve);
  });
  currentAudio = null;
}

function stopLoop() {
  stopFlag = true;
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
}
```

**Volume note:** browser không cho set system volume. Volume `1.0` = max browser context = max của Windows volume hiện tại. SOP: user phải set Windows volume max trước khi ngủ.

### 6.14 `content_whatsapp.js`

```js
const SELECTOR = {
  SIDEBAR: 'div[role="grid"][aria-label*="Chat list"]',
  CHAT_ROW: 'div[role="listitem"]',
  GROUP_NAME: 'span[dir="auto"]',
  UNREAD_BADGE: 'span[aria-label*="unread"]',
  CONVERSATION_HEADER: 'header[data-testid*="conversation"]',
  MESSAGE_INPUT: 'div[contenteditable="true"][data-tab="10"]',
  MESSAGE_LIST: 'div[role="application"]',
  MESSAGE_TEXT: 'span.selectable-text',
};

// Track baseline unread counts per group
const unreadBaseline = new Map();   // groupName → unread count when extension started

const observer = new MutationObserver(throttle(scanSidebar, 1000));

function scanSidebar() {
  // For each chat row:
  //   - Read group name from row
  //   - Read unread badge count (0 if missing)
  //   - If groupName ∈ customer_groups AND unread > baseline → ALERT_DETECTED
  //   - If groupName == coord_group → observe messages, look for tags
}

// Coord group message observer
function observeCoordGroup() {
  // When user opens coord group conversation, attach observer to message list
  // For each new message:
  //   - If text starts with [AOG-ESCALATED] or [AOG-HANDLED] → send to background
  //   - Else ignore
}

// Receive from background: send tag text
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === "SEND_TO_COORD_GROUP") {
    return await sendTextToCoordGroup(msg.payload.text, msg.payload.retry);
  }
});

async function sendTextToCoordGroup(text, retryCount) {
  // 1. Open coord group conversation (click on sidebar row)
  // 2. Wait for input visible
  // 3. Set input innerText = text, dispatch input event
  // 4. Synthesize Enter keydown → send
  // 5. Verify message appeared in list within 3s
  // 6. Retry on fail up to retryCount, backoff per constants
}
```

**Selector strategy:** WhatsApp Web đổi DOM thường xuyên. Codex implement selector trong constants riêng (`lib/whatsapp_selectors.js`) để dễ patch khi DOM đổi. Có fallback selector list, try từng cái.

### 6.15 `content_outlook.js`

```js
const SELECTOR = {
  INBOX_LIST: 'div[role="list"][aria-label*="Message list"]',
  MESSAGE_ROW: 'div[role="listitem"]',
  SENDER: 'div[class*="senderName"]',
  SUBJECT: 'span[class*="subject"]',
  UNREAD_INDICATOR: 'div[aria-label*="Unread"]',
};

const seenMessageIds = new Set();

const observer = new MutationObserver(throttle(scanInbox, 2000));

function scanInbox() {
  // For each message row:
  //   - Extract message_id (data-convid or similar)
  //   - If seenMessageIds.has(id) → skip
  //   - If unread indicator visible AND filter pass:
  //     - shouldSkipEmail(alert, config) ? skip : ALERT_DETECTED
  //   - Add to seenMessageIds
}
```

Outlook Web có 2 mode: classic và new Outlook. Codex check user's Outlook version, document fallback selectors.

### 6.16 `popup.html` + `popup.js` + `popup.css`

Popup ~360x500px khi click icon toolbar.

**Sections:**
1. **Header**: "AOG Watcher" + version.
2. **Role section**: Radio Primary/Backup + button "Confirm Role".
3. **Status section**:
   - App state badge: IDLE / ALERTING (color: green / red)
   - Current alert info (nếu ALERTING): source, sender, group, time
   - Within shift: yes/no
4. **Actions**:
   - Big red button "ACK" (chỉ enable khi ALERTING).
   - Button "Swap Role" (toggle Primary ↔ Backup).
   - Button "Settings" (opens options page).
   - Button "Export Today" (download CSV).
5. **Recent events**: last 5 events from event log.
6. **Footer**: link to docs, version.

**State update:** popup query `GET_STATUS` from service worker mỗi 2s khi mở. Khi đóng → unsubscribe.

### 6.17 `settings.html` + `settings.js` + `settings.css`

Settings page (`chrome-extension://<id>/settings.html`).

**Sections:**

1. **My profile**
   - Display name (input text)
   - Role default at startup (radio, optional)

2. **Partner**
   - Partner display name (input text)

3. **WhatsApp groups**
   - "Customer groups" (textarea, mỗi line 1 tên group)
   - "Coord group" (input text, single)
   - Helper text: "Tên group hiển thị trong WhatsApp Web sidebar, copy y nguyên."

4. **Outlook filter**
   - Skip sender domains (textarea, mỗi line 1 domain, default `trustana.vn`)
   - Subject keywords (textarea, mỗi line 1 keyword, empty = alert all)

5. **Shift hours**
   - Start (input time)
   - End (input time)
   - Helper text: "Ngoài shift, extension không kêu."
   - Checkbox "Test mode (ignore shift hours)" — for testing only

6. **Timing (Advanced — collapsible)**
   - Primary timeout (seconds, default 120)
   - Backup delay (seconds, default 180)
   - Max alert duration (seconds, default 540)

7. **Buttons**
   - Save (validate, write storage, show success toast)
   - Reset to defaults
   - Test peer tag (gửi `[AOG-HANDLED]` test message vào coord group, kiểm tra round-trip)

**Validation:**
- Display name không trống.
- Customer groups ≥ 1.
- Coord group không trống.
- Coord group không nằm trong customer groups.
- Timing > 0 integer.
- Backup delay ≥ primary timeout (warning, không block).

---

## 7. Message passing protocol

```
┌─────────────────────────────────────────────────────────────────┐
│                       service_worker.js                          │
│                       (state machine)                            │
└──────┬────────────┬──────────────┬─────────────┬────────────────┘
       │            │              │             │
       │ALERT_DET   │SEND_COORD    │START_AUDIO  │GET_STATUS
       │PEER_TAG    │              │STOP_AUDIO   │USER_ACK
       │            │              │             │ROLE_CHANGE
       ▼            ▼              ▼             ▼
┌──────────┐  ┌──────────┐   ┌──────────┐   ┌──────────┐
│content_  │  │content_  │   │offscreen │   │popup.js  │
│whatsapp  │  │outlook   │   │.js       │   │          │
└──────────┘  └──────────┘   └──────────┘   └──────────┘
```

**Message catalog:**

| From → To | Type | Payload |
|---|---|---|
| content_whatsapp → SW | `ALERT_DETECTED` | `{source:"whatsapp", alert_id, group_name, unread_count, detected_at}` |
| content_whatsapp → SW | `PEER_TAG_RECEIVED` | `{tag:"ESCALATED"|"HANDLED", parsed_payload}` |
| content_outlook → SW | `ALERT_DETECTED` | `{source:"email", alert_id, sender, subject, message_id, detected_at}` |
| SW → content_whatsapp | `SEND_TO_COORD_GROUP` | `{text, retry}` |
| SW → content_whatsapp | `ACK_BASELINE_RESET` | `{group_name}` (reset unread baseline khi ACK) |
| SW → offscreen | `START_AUDIO` | `{alert_id, start_time}` |
| SW → offscreen | `STOP_AUDIO` | `{}` |
| popup → SW | `GET_STATUS` | `{}` → returns `{app_state, current_alert, session, recent_events, within_shift}` |
| popup → SW | `USER_ACK` | `{}` |
| popup → SW | `ROLE_CHANGE` | `{role:"primary"|"backup"}` |
| popup → SW | `EXPORT_CSV` | `{start_date, end_date}` → returns blob URL |

---

## 8. Pseudocode state machine

```js
function reduce(state, event) {
  const effects = [];
  let newState = { ...state };

  switch (event.type) {
    case "ALERT_DETECTED": {
      const alert = event.payload;
      // Dedup
      if (state.queue.findById(alert.alert_id)) return { state, effects };
      newState.queue = state.queue.clone().add(alert);
      effects.push({ type: "APPEND_EVENT_LOG", payload: { event_type: "DETECTED", ...alert }});

      // Check shift
      if (!withinShift(state.session, state.config)) {
        effects.push({ type: "APPEND_EVENT_LOG", payload: { event_type: "SKIPPED_OUT_OF_SHIFT", alert_id: alert.alert_id }});
        return { state: newState, effects };
      }

      // If already ALERTING with another alert, just queue
      if (state.app_state === "ALERTING") return { state: newState, effects };

      // Role gate
      if (state.session.role === "primary") {
        // Primary: wake immediately
        newState.app_state = "ALERTING";
        newState.current_alert = alert;
        effects.push({ type: "START_WAKE", payload: alert });
        effects.push({ type: "SCHEDULE_TIMER", name: "primary_timeout", delayMs: state.config.primary_timeout_seconds * 1000 });
        effects.push({ type: "SCHEDULE_TIMER", name: "max_alert_duration", delayMs: state.config.max_alert_duration_seconds * 1000 });
      } else {
        // Backup: schedule backup_delay timer, stay IDLE
        effects.push({ type: "SCHEDULE_TIMER", name: "backup_delay", delayMs: state.config.backup_delay_seconds * 1000 });
      }
      return { state: newState, effects };
    }

    case "TIMER_PRIMARY_TIMEOUT": {
      // Primary missed ACK → send escalation
      if (state.app_state !== "ALERTING" || state.session.role !== "primary") return { state, effects };
      effects.push({ type: "SEND_PEER_TAG", payload: { tag: "ESCALATED", data: buildTagData(state.current_alert, state.session) }});
      effects.push({ type: "APPEND_EVENT_LOG", payload: { event_type: "PEER_ESCALATED_SENT", alert_id: state.current_alert.alert_id }});
      // Wake continues. Stop only at max_duration or ACK.
      return { state, effects };
    }

    case "TIMER_BACKUP_DELAY": {
      // Backup safety net: Primary chết câm
      if (state.session.role !== "backup" || state.app_state === "ALERTING") return { state, effects };
      const alert = state.queue.nextPending();
      if (!alert) return { state, effects };
      newState.app_state = "ALERTING";
      newState.current_alert = alert;
      effects.push({ type: "START_WAKE", payload: alert });
      effects.push({ type: "SCHEDULE_TIMER", name: "max_alert_duration", delayMs: state.config.max_alert_duration_seconds * 1000 });
      effects.push({ type: "APPEND_EVENT_LOG", payload: { event_type: "ALERTING_BACKUP_FALLBACK", alert_id: alert.alert_id }});
      return { state: newState, effects };
    }

    case "TIMER_MAX_DURATION": {
      if (state.app_state !== "ALERTING") return { state, effects };
      const alertId = state.current_alert.alert_id;
      newState.app_state = "IDLE";
      newState.current_alert = null;
      newState.queue = state.queue.clone().mark(alertId, "MISSED", "max_duration");
      effects.push({ type: "STOP_WAKE" });
      effects.push({ type: "CANCEL_TIMER", name: "primary_timeout" });
      effects.push({ type: "APPEND_EVENT_LOG", payload: { event_type: "MISSED", alert_id: alertId, handled_by: "missed" }});
      return { state: newState, effects };
    }

    case "USER_ACK": {
      if (state.app_state !== "ALERTING") return { state, effects };
      const alert = state.current_alert;
      newState.app_state = "IDLE";
      newState.current_alert = null;
      newState.queue = state.queue.clone().mark(alert.alert_id, "HANDLED", "user_ack");
      effects.push({ type: "STOP_WAKE" });
      effects.push({ type: "CANCEL_TIMER", name: "primary_timeout" });
      effects.push({ type: "CANCEL_TIMER", name: "max_alert_duration" });
      effects.push({ type: "SEND_PEER_TAG", payload: { tag: "HANDLED", data: buildTagData(alert, state.session) }});
      effects.push({ type: "APPEND_EVENT_LOG", payload: { event_type: "ACK", alert_id: alert.alert_id, handled_by: "self" }});
      if (alert.source === "whatsapp") {
        effects.push({ type: "ACK_BASELINE_RESET", payload: { group_name: alert.group_name }});
      }
      return { state: newState, effects };
    }

    case "PEER_ESCALATED_RECEIVED": {
      // Only matters if local is backup
      if (state.session.role !== "backup") return { state, effects };
      const matched = matchPeerAlert(state.queue, event.payload);
      if (!matched) {
        // Could be peer detected something we haven't yet — log and skip
        effects.push({ type: "APPEND_EVENT_LOG", payload: { event_type: "PEER_ESCALATED_RECEIVED_NO_MATCH" }});
        return { state, effects };
      }
      newState.app_state = "ALERTING";
      newState.current_alert = matched;
      effects.push({ type: "CANCEL_TIMER", name: "backup_delay" });
      effects.push({ type: "START_WAKE", payload: matched });
      effects.push({ type: "SCHEDULE_TIMER", name: "max_alert_duration", delayMs: state.config.max_alert_duration_seconds * 1000 });
      effects.push({ type: "APPEND_EVENT_LOG", payload: { event_type: "PEER_ESCALATED_RECEIVED", alert_id: matched.alert_id }});
      return { state: newState, effects };
    }

    case "PEER_HANDLED_RECEIVED": {
      const matched = matchPeerAlert(state.queue, event.payload);
      if (!matched) {
        effects.push({ type: "APPEND_EVENT_LOG", payload: { event_type: "PEER_HANDLED_RECEIVED_NO_MATCH" }});
        return { state, effects };
      }
      // Mark queue
      newState.queue = state.queue.clone().mark(matched.alert_id, "SKIPPED", "partner_handled");

      // If currently ALERTING the same alert → stop
      if (state.app_state === "ALERTING" && state.current_alert?.alert_id === matched.alert_id) {
        newState.app_state = "IDLE";
        newState.current_alert = null;
        newState.queue = newState.queue.mark(matched.alert_id, "HANDLED", "partner_handled");
        effects.push({ type: "STOP_WAKE" });
        effects.push({ type: "CANCEL_TIMER", name: "primary_timeout" });
        effects.push({ type: "CANCEL_TIMER", name: "max_alert_duration" });
        effects.push({ type: "APPEND_EVENT_LOG", payload: { event_type: "ACK", alert_id: matched.alert_id, handled_by: "partner" }});
      } else {
        effects.push({ type: "CANCEL_TIMER", name: "backup_delay" });
        effects.push({ type: "APPEND_EVENT_LOG", payload: { event_type: "PEER_HANDLED_RECEIVED", alert_id: matched.alert_id }});
      }
      return { state: newState, effects };
    }

    case "ROLE_CHANGED": {
      newState.session = { ...state.session, role: event.payload.role };
      effects.push({ type: "APPEND_EVENT_LOG", payload: { event_type: "ROLE_CHANGED", role: event.payload.role }});
      return { state: newState, effects };
    }
  }
  return { state, effects };
}
```

---

## 9. Edge cases và xử lý

| # | Edge case | Xử lý |
|---|---|---|
| 1 | WhatsApp Web logged out giữa ca | Content script log error, popup hiển thị warning "WhatsApp Web disconnected" |
| 2 | Outlook Web tab đóng | Tương tự, popup warning. Email detection ngưng cho đến khi mở lại |
| 3 | Service worker bị MV3 unload (idle 30s) | Trạng thái lưu qua `chrome.storage`. Khi receive event → re-hydrate runtime từ storage |
| 4 | Alarm fire khi SW đang sleep | SW wake up tự động khi alarm fire. Re-hydrate state trước khi xử lý |
| 5 | User ACK khi không có alert | Popup disable button khi state = IDLE |
| 6 | Peer tag duplicate (network retry) | `alert_id` dedupe — nếu đã xử lý cùng alert_id trước, log INFO no-op |
| 7 | Peer tag bị stale (>10 phút) | Check `timestamp` trong payload, nếu > 10 phút → log WARNING + ignore |
| 8 | Coord group chưa tồn tại trong WhatsApp | Send tag fail → log ERROR, popup warning "Coord group not found: <name>" |
| 9 | Customer group đổi tên | Settings cần edit lại. Không auto-detect rename |
| 10 | Chrome restart → extension reload | Re-detect DOM, không persist alert active. Nếu unread vẫn còn → re-detect, alert lại |
| 11 | Multiple unread trong cùng group | Treat as 1 alert (alert_id deterministic theo group). ACK reset baseline → next batch là alert mới |
| 12 | DOM selector v WhatsApp Web đổi version | Selector trong file riêng, fallback list. Codex implement try-catch |
| 13 | User mở WhatsApp Web ở 2 tab | `chrome.tabs.query` lấy tab đầu tiên. Document khuyến cáo chỉ mở 1 tab |
| 14 | Audio bị browser autoplay policy block | Offscreen doc với reason `AUDIO_PLAYBACK` được phép. Test trên Chrome + Edge |
| 15 | Shift hours wrap qua nửa đêm (22:00–08:00) | `isWithinShift` handle đúng (compare modulo 24h) |
| 16 | Test mode bypass shift | Checkbox trong Settings → `config.test_mode = true` → `withinShift()` always true |
| 17 | Role chưa chọn lúc start | Popup ép chọn role trước, button ACK disabled |
| 18 | Coord group name trùng customer group | Settings validate, không cho save |
| 19 | Peer tag content quá dài | Limit 500 chars. Truncate nếu quá |
| 20 | User nhận `[AOG-HANDLED]` của alert mình chưa detect | Log INFO, mark SKIPPED nếu sau này có detect. Nếu không detect → noop |

---

## 10. Test plan

### 10.1 Unit tests (Vitest)

| # | Test | File |
|---|---|---|
| 1 | `state_machine.reduce` ALERT_DETECTED + role=primary → ALERTING + START_WAKE | state_machine.test.js |
| 2 | reduce ALERT_DETECTED + role=backup → stay IDLE + SCHEDULE backup_delay | state_machine.test.js |
| 3 | reduce ALERT_DETECTED + out of shift → log SKIPPED_OUT_OF_SHIFT, no wake | state_machine.test.js |
| 4 | reduce TIMER_PRIMARY_TIMEOUT + primary + ALERTING → SEND ESCALATED, no stop wake | state_machine.test.js |
| 5 | reduce TIMER_BACKUP_DELAY + backup + queue has alert → ALERTING + START_WAKE | state_machine.test.js |
| 6 | reduce TIMER_MAX_DURATION + ALERTING → STOP + MISSED + handled_by=missed | state_machine.test.js |
| 7 | reduce USER_ACK + ALERTING → STOP + HANDLED + SEND HANDLED + handled_by=self | state_machine.test.js |
| 8 | reduce PEER_ESCALATED + backup → ALERTING + START_WAKE | state_machine.test.js |
| 9 | reduce PEER_ESCALATED + primary → no-op | state_machine.test.js |
| 10 | reduce PEER_HANDLED + matching current alert ALERTING → STOP + handled_by=partner | state_machine.test.js |
| 11 | reduce PEER_HANDLED + queued alert not current → mark SKIPPED only | state_machine.test.js |
| 12 | reduce PEER_HANDLED + no match → log no_match, no-op | state_machine.test.js |
| 13 | reduce duplicate ALERT_DETECTED → dedup by alert_id | state_machine.test.js |
| 14 | `peer_protocol.serializeTag` ESCALATED → correct format | peer_protocol.test.js |
| 15 | serializeTag HANDLED → correct format with operator | peer_protocol.test.js |
| 16 | parseTag valid ESCALATED → correct payload | peer_protocol.test.js |
| 17 | parseTag valid HANDLED → correct payload | peer_protocol.test.js |
| 18 | parseTag invalid → null | peer_protocol.test.js |
| 19 | parseTag stale timestamp >10min → null | peer_protocol.test.js |
| 20 | `alert_queue.add` dedup by alert_id | alert_queue.test.js |
| 21 | `alert_queue.mark` updates status | alert_queue.test.js |
| 22 | `alert_queue.findWhatsAppByTimestamp` within window → match | alert_queue.test.js |
| 23 | findWhatsAppByTimestamp outside window → null | alert_queue.test.js |
| 24 | `filter.shouldSkipEmail` skip domain match → true | filter.test.js |
| 25 | shouldSkipEmail subject keyword required → enforce | filter.test.js |
| 26 | shouldAlertWhatsAppGroup customer group → true | filter.test.js |
| 27 | shouldAlertWhatsAppGroup coord group → false | filter.test.js |
| 28 | shouldAlertWhatsAppGroup other → false | filter.test.js |
| 29 | `escalation.backupShouldWake` primary → true | escalation.test.js |
| 30 | backupShouldWake backup + tag → true | escalation.test.js |
| 31 | backupShouldWake backup + no tag + elapsed < delay → false | escalation.test.js |
| 32 | backupShouldWake backup + no tag + elapsed ≥ delay → true | escalation.test.js |
| 33 | `shift_engine.isWithinShift` normal day shift → correct | shift_engine.test.js |
| 34 | isWithinShift overnight shift (22:00–08:00) at 02:00 → true | shift_engine.test.js |
| 35 | isWithinShift overnight shift at 10:00 → false | shift_engine.test.js |
| 36 | `hash.md5` known vectors pass (RFC 1321) | hash.test.js |
| 37 | `hash.deterministicAlertId` same inputs → same ID | hash.test.js |

Total: 37 unit tests. Codex viết và pass trước khi handoff.

### 10.2 Manual integration test (user chạy live)

**Setup:**
- 2 máy A (Primary), B (Backup) — hoặc 1 máy 2 profile Chrome.
- Cả 2 đăng nhập WhatsApp Web cùng tài khoản hoặc 2 tài khoản khác nhau, đều có trong coord group + ít nhất 1 customer group.
- Cả 2 đăng nhập Outlook Web cùng tài khoản AOG.
- Extension cài + setup customer_groups + coord_group + role.

**Test mode:** Bật test mode trong Settings để bypass shift. Đặt timing nhanh:
- primary_timeout: 30s
- backup_delay: 30s
- max_alert_duration: 120s

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1 | Primary handle bình thường | Nhờ người thứ 3 gửi tin vào customer group | A kêu trong 1-2s. A bấm ACK. A gửi [AOG-HANDLED]. B im lặng, alert mark SKIPPED. Event log có ACK handled_by=self |
| 2 | Primary ngủ quên | Gửi tin, đợi A không ACK | T+30s A gửi [AOG-ESCALATED], B nhận trong 1-2s, B kêu. B ACK. B gửi [AOG-HANDLED]. A stop wake (handled_by=partner). Cả 2 về IDLE |
| 3 | Primary chết app | Tắt extension A trước khi gửi tin | B nhận tin trong queue, im lặng 30s. T+30s B tự kêu. B ACK. Done |
| 4 | Multiple alerts | Gửi 3 tin vào 3 customer group khác nhau trong 10s | Queue có 3 alert. A kêu alert đầu. ACK alert đầu → alert 2 wake. Tương tự alert 3 |
| 5 | Out of shift | Set shift 09:00-17:00, test mode OFF, gửi tin lúc 22:00 | Alert vào queue nhưng KHÔNG kêu. Event log có SKIPPED_OUT_OF_SHIFT |
| 6 | Email alert | Send email vào tài khoản AOG, subject "AOG urgent quote" | Cả 2 máy detect cùng message_id, A kêu, B im lặng. Path 1 lặp lại |
| 7 | Skip trustana | Send email từ test@trustana.vn | Cả 2 không alert. Event log không có DETECTED |
| 8 | Coord group nói chuyện thường | A gõ "test 123" vào coord group manually | KHÔNG được parse như tag. Không trigger alert |
| 9 | Tag stale | Manually post text `[AOG-ESCALATED]\|alert_id=fake\|...\|timestamp=<10 phút trước>` vào coord group | B log WARNING stale, không wake |
| 10 | Settings save reload | Đổi customer_groups, save | Content script reload, áp dụng list mới ngay, không cần restart extension |
| 11 | Export CSV | Bấm Export Today trên popup | Download file `aog-events-20260622.csv` mở được trong Excel, có đủ cột |
| 12 | Swap role | A bấm Swap Role giữa ca | Role flip Primary↔Backup. Alert tiếp theo theo role mới |
| 13 | WhatsApp tab close mid-shift | Đóng tab WhatsApp Web khi đang ALERTING | Popup hiển thị warning. Audio tiếp tục. Khi mở lại tab, detection resume |
| 14 | Chrome restart | Đóng Chrome, mở lại | Extension load tự động. Re-detect DOM. Unread cũ vẫn còn → alert lại như mới |

### 10.3 Production timing test (sau khi pass test mode)

Đổi Settings về production timing:
- primary_timeout: 120s
- backup_delay: 180s
- max_alert_duration: 540s
- Tắt test mode, set shift đúng giờ trực thật

Chạy thử 1 ca thật (1 đêm) với mock alert từ người thứ 3.

---

## 11. Installation guide

### 11.1 Chrome

1. Mở Chrome → menu `chrome://extensions/`.
2. Bật **Developer mode** (góc trên phải).
3. Click **Load unpacked**.
4. Chọn folder `C:\Users\RYAN TOAN\Downloads\2_TOOLS\aog-watcher-extension`.
5. Extension xuất hiện trong list. Pin icon vào toolbar (click icon puzzle → ghim AOG Watcher).
6. Click icon AOG Watcher trên toolbar → popup mở → bấm "Settings" để config lần đầu.

### 11.2 Edge

1. Mở Edge → menu `edge://extensions/`.
2. Bật **Developer mode** (góc dưới trái).
3. Click **Load unpacked**.
4. Chọn folder `C:\Users\RYAN TOAN\Downloads\2_TOOLS\aog-watcher-extension`.
5. Pin icon → mở popup → Settings.

### 11.3 Initial setup (mỗi máy)

1. Mở Settings, điền:
   - My display name: tên cá nhân (A hoặc B).
   - Partner display name: tên người trực cùng.
   - Customer groups: tên các group WhatsApp khách hàng, mỗi dòng 1 group. Copy y nguyên tên hiển thị trong WhatsApp sidebar.
   - Coord group: tên group nội bộ 2 người dùng để tag nhau.
   - Skip sender domains: `trustana.vn` (default).
   - Subject keywords: để trống nếu muốn alert mọi email không thuộc skip list.
   - Shift hours: vd `22:00` → `03:00` (A) hoặc `03:00` → `08:00` (B).
   - Timing: giữ default (120/180/540) cho production, hoặc 30/30/120 cho test.
2. Save.
3. Mở WhatsApp Web tab — login + để open.
4. Mở Outlook Web tab — login AOG account + để open.
5. Click popup icon → chọn role Primary/Backup → bấm Confirm Role.
6. Done. Extension đang watch.

### 11.4 Verify install

- Popup hiển thị "IDLE" + "Within shift" (nếu đang trong giờ shift hoặc test mode).
- Mở Developer Tools → tab Extensions → kiểm `aog-watcher` console không có error.
- Test scenario 1 trong manual test.

---

## 12. Migration plan (Codex execute step-by-step)

Codex thực hiện theo thứ tự, mỗi step verify (compile + vitest) trước khi sang step tiếp:

1. **Init project**: tạo `package.json` (dev dep: vitest), `vitest.config.js`, `.gitignore`. Tạo folder structure mục 4.
2. **Constants + storage**: `lib/constants.js`, `lib/storage.js`. Smoke test storage trong popup tạm.
3. **Hash**: `lib/hash.js` (MD5) + `hash.test.js`. Pass.
4. **Alert queue**: `lib/alert_queue.js` + `alert_queue.test.js`. Pass.
5. **Peer protocol**: `lib/peer_protocol.js` + `peer_protocol.test.js`. Pass.
6. **Filter**: `lib/filter.js` + `filter.test.js`. Pass.
7. **Shift engine**: `lib/shift_engine.js` + `shift_engine.test.js`. Pass.
8. **Escalation**: `lib/escalation.js` + `escalation.test.js`. Pass.
9. **State machine**: `lib/state_machine.js` + `state_machine.test.js`. Pass.
10. **Event log + CSV export**: `lib/event_log.js`, `lib/csv_export.js`. Test manual.
11. **Manifest + icons**: `manifest.json` + 4 file icon (resize từ v3 `assets/logo.png` ra 16/32/48/128).
12. **Audio assets**: generate 4 file wav placeholder (tone Web Audio API export). Lưu `assets/audio/`.
13. **Offscreen**: `offscreen.html` + `offscreen.js`. Test manual play audio loop từ popup tạm.
14. **Service worker skeleton**: `service_worker.js` với message routing + alarms. Test send/receive message từ popup tạm.
15. **Content WhatsApp**: `content_whatsapp.js`. Test manual: mở WhatsApp Web, gửi tin từ máy khác, verify detection.
16. **Content Outlook**: `content_outlook.js`. Test manual: send email từ máy khác, verify detection.
17. **Coord group send/receive**: implement send tag + observe tag trong content_whatsapp. Test manual round-trip.
18. **Service worker wire state machine**: dispatch event vào reduce, execute side effects.
19. **Popup UI**: `popup.html/js/css`. Test full flow trên 1 máy (role primary tự alert).
20. **Settings UI**: `settings.html/js/css`. Test save/load config.
21. **Integration test scenario 1-3** (manual).
22. **Polish**: error handling, logging, notification fallback.
23. **Integration test scenario 4-14** (manual).
24. **Audit doc**: tạo `docs/20260622_aog-watcher-v4-build-audit.md` log tests pass, files created, manual test results, open questions.

---

## 13. Trade-offs đã chốt (không thảo luận lại)

1. Volume max = browser context, không phải Windows. User SOP set Windows max trước ngủ.
2. Detection phụ thuộc DOM selector → patch khi WhatsApp/Outlook update. Selector trong file riêng.
3. Peer tag qua DOM WhatsApp → 1 tab WhatsApp Web phải mở suốt. Nếu close → peer fail, B fallback 180s.
4. Service worker MV3 có thể bị unload — state machine hydrate từ storage khi wake.
5. Không persist `current_alert` qua Chrome restart — re-detect DOM lại (chấp nhận false re-alert).
6. Audio chỉ 4 file local. TTS bỏ (không như v3) — đơn giản hóa.
7. Browser support: Chrome + Edge. Firefox/Safari không scope.
8. Cài đặt: Load unpacked, không publish Chrome Web Store.

---

## 14. Câu hỏi mở (để sau, không scope v4 này)

1. Audio file thật (4 level) — hiện dùng tone placeholder. Sau khi test ổn, user chọn file phù hợp (freesound.org CC0 hoặc custom).
2. Subject keyword filter chính xác cho Outlook AOG email — sau khi xem mẫu email thật, update Settings.
3. Auto-update DOM selector qua remote config — không scope v4, làm v5 nếu cần.
4. Multi-coord-group cho team >2 người — không scope, mở rộng sau.
5. Stats dashboard tổng hợp event log nhiều ngày — nếu cần làm sau.

---

## 15. Sample peer tag text

**`[AOG-ESCALATED]`** (Primary A gửi sau timeout):
```
[AOG-ESCALATED]|alert_id=wa-3-202606222233|source=whatsapp|timestamp=2026-06-22T22:33:15+07:00|from_role=primary|operator=A|group=Customer-AirlineX|unread_count=3
```

**`[AOG-HANDLED]`** (B ACK sau khi nhận escalation):
```
[AOG-HANDLED]|alert_id=wa-3-202606222233|source=whatsapp|timestamp=2026-06-22T22:36:42+07:00|from_role=backup|operator=B
```

**Email case:**
```
[AOG-HANDLED]|alert_id=email-a3f2c891b0e7|source=email|timestamp=2026-06-22T22:36:42+07:00|from_role=primary|operator=A|sender=ops-airline@example.com|subject=AOG HKG-SGN urgent quote
```

---

## 16. Notes cho Codex

- User là Business/PD Manager, không phải dev. Commit message ngắn, focus WHY.
- Sau khi xong, tạo `docs/20260622_aog-watcher-v4-build-audit.md` log đầy đủ: files created, tests pass count, manual test results, open questions.
- Nếu phát hiện ambiguity → STOP, ghi vào audit "Questions for review", không tự ý quyết định nghiệp vụ.
- Verify cuối: `npm run test` (vitest) pass + manual install trên Chrome + Edge thành công + scenario 1-3 pass.
- Không sửa file `docs/` ngoài audit file mới.
- Selector WhatsApp/Outlook trong file riêng (`lib/whatsapp_selectors.js`, `lib/outlook_selectors.js`) — không inline hardcode.
- Use `try/catch` quanh mọi DOM access, log error không throw.

---

## 17. So sánh số liệu v3 vs v4

| Mục | v3 (Python) | v4 (Extension) | Diff |
|---|---|---|---|
| LOC | 1932 | ~1700 (est) | -12% |
| Production files | 13 .py + 1 yaml | 14 .js + 3 html + 3 css | similar |
| External deps | Python 3.10+, 6 pip libs, Gmail SMTP/IMAP App Password, Outlook forward rule | Chrome 120+ / Edge 120+ | -1 runtime, -6 libs, -2 services |
| Onboarding steps user | 5+ (install Python, pip, .env, Gmail App Pwd, Outlook forward) | 2 (Load unpacked, fill Settings) | -3+ steps |
| Setup time / máy | 15-30 phút | 2-3 phút | -10x |
| Latency peer signal | 30-60s (Gmail IMAP poll) | 1-3s (DOM observer) | -10x |
| Cross-machine failure mode | Gmail bridge fail | WhatsApp Web disconnect (visual immediate) | qualitative |

---

**END OF BLUEPRINT v4**
