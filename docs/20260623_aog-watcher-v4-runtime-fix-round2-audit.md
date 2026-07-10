# AOG Watcher v4 -- Runtime Fix Round 2 Audit

**Date:** 2026-06-23
**Owner:** Codex
**Spec:** `docs/20260623_aog-watcher-v4-runtime-fix-round2.md`
**Status:** Ready for Claude review before re-enabling extension.

## Root causes confirmed

### Bug #3 -- persisted queue blocks email re-detection

Runtime state persisted `queue` into `chrome.storage.local`. Handled, skipped, and missed alerts stayed in that queue after ACK/reload. On later service-worker hydrate, `ALERT_DETECTED` with the same deterministic `alert_id` hit `queue.findById(alert_id)` and returned without effects, causing a silent skip.

### Bug #4 -- WhatsApp peer tag can send to customer group

`content_whatsapp.js` used the first `[title]` inside a sidebar row as the group name. WhatsApp rows can contain many titled elements: avatar, preview, timestamp, mute icon, and group title. A broad title match could select the wrong row. Also, after clicking the coord group row, the script waited only 350ms and then used the active composer without proving the conversation header had switched to the coord group.

### Bug #5 -- Outlook message_id depends on unstable display date

Outlook fallback message ID included date title text. Outlook can re-render the same date in different display formats, which changes `message_id` for the same email.

### Bug #6 -- Outlook connected but unread row not detected

The popup can show Outlook Web connected from heartbeat while `content_outlook.js` still fails to parse any unread row. The previous unread check used exact `button[aria-label='Mark as read']` and relied mostly on message-row selectors. Outlook Cloud can expose a longer/case-varied aria-label or a different row container shape, so the content script may be alive but never send `ALERT_DETECTED`.

### Bug #7 -- content script timers call runtime after extension reload

Edge reported `Uncaught Error: Extension context invalidated` from `content_whatsapp.js:115`. The root cause is old content script instances retaining timers/listeners after the extension reloads; those stale timers can still call `chrome.runtime.sendMessage` even though their extension context is gone.

## Fixes chosen

### Bug #3

Implemented Claude Option A: queue is session-only and is no longer persisted.

- `service_worker.js` uses `serializeRuntimeState()` with only `app_state` and `current_alert`.
- `hydrateRuntimeState()` always creates a fresh queue after service-worker restart/reload.
- DOM re-detection rebuilds active alerts after reload.

### Bug #4

Implemented the full 4-layer WhatsApp guard:

- Added `lib/whatsapp_dom.js` with testable helpers for chat row names, active conversation header, normalization, and group-name comparison.
- Narrowed sidebar title extraction to `span[dir='auto'][title]` / `span[dir='auto']` instead of broad `[title]`.
- Added `conversationHeader` selectors in `lib/whatsapp_selectors.js`.
- Increased post-click wait from 350ms to 800ms.
- Added `waitForCoordGroupActive()` with a 3-second timeout before composer focus/insert/send.
- If the active header is not the configured coord group, `sendPeerTag()` throws and sends nothing.
- `scanPeerTags()` now reads peer tags only when the active conversation is the coord group.

### Bug #5

Added `lib/outlook_message_id.js`.

- Prefer stable Outlook row/ancestor IDs such as `data-convid`, `data-item-id`, `data-itemid`, `data-conversation-id`, and `data-message-id`.
- Fallback is normalized `sender + subject`.
- Removed dependency on volatile display date.

### Bug #6

Hardened Outlook unread scanning:

- `isUnread()` now uses wildcard `button[aria-label*='Mark as read' i]`.
- `candidateRows()` derives rows from unread buttons and climbs ancestors to row-like containers.
- Added `[role='listitem']` and unread-button selector fallbacks.
- Added a 2-second periodic `scheduleScan()` so Outlook row changes are caught even when MutationObserver filters miss them.
- Fallback message IDs now include normalized row text, so repeated same-sender/same-subject test emails with different preview/time do not collapse during one content-script session.

### Bug #7

Added `lib/content_runtime.js` and routed both content scripts through it:

- `safeSendMessage()`
- `safeStorageGet()`
- `addRuntimeMessageListener()`
- `addStorageChangedListener()`
- `setSafeInterval()`

If `"Extension context invalidated"` is detected, the helper marks the content script dead, clears tracked intervals, and stops sending messages silently.

## Files changed

- `service_worker.js`
- `content_whatsapp.js`
- `content_outlook.js`
- `manifest.json`
- `lib/content_runtime.js`
- `lib/runtime_state.js`
- `lib/outlook_message_id.js`
- `lib/outlook_selectors.js`
- `lib/whatsapp_dom.js`
- `lib/whatsapp_selectors.js`
- `tests/integration_simulate_restart.test.js`
- `tests/outlook_message_id.test.js`
- `tests/outlook_content_static.test.js`
- `tests/whatsapp_dom.test.js`
- `tests/manifest.test.js`
- `tests/content_runtime_static.test.js`
- `docs/20260623_aog-watcher-v4-claude-review-handoff.md`
- `handoff/todo.md`
- `handoff/audit.md`
- `log/history.md`

## Verification

- `npm.cmd run check` passed.
- MV3 reference check passed.
- Vitest passed: 16 test files, 85 tests.
- `node --check` passed for changed runtime JS files.
- `npm.cmd audit --omit=dev` passed: 0 vulnerabilities.

## Regression coverage added

- `tests/integration_simulate_restart.test.js`: ACK an alert, serialize runtime state, hydrate as if reloaded, then detect the same `alert_id` again and verify it wakes.
- `tests/outlook_message_id.test.js`: stable ancestor ID preference and normalized fallback without display date.
- `tests/outlook_content_static.test.js`: wildcard unread selector, ancestor row recovery, periodic scan, and selector fallbacks.
- `tests/whatsapp_dom.test.js`: ignores broad non-title row elements, reads active `#main header`, and normalizes group comparison.
- `tests/manifest.test.js`: verifies helper injection order for Outlook; MV3 check verifies new WhatsApp helper file reference.
- `tests/content_runtime_static.test.js`: verifies context invalidation handling and confirms content scripts route through runtime wrappers.

## Manual checklist before enabling live

Clean extension storage first: remove/reload unpacked extension or clear extension data.

Email:

1. Reload extension.
2. Refresh Outlook Web.
3. Send AOG test email -> extension must wake.
4. ACK.
5. Reload extension again.
6. Send a second AOG test email with the same sender/subject pattern -> extension must wake again.

WhatsApp:

1. Refresh WhatsApp Web.
2. Trigger customer group alert -> extension must wake.
3. ACK.
4. Open every customer group involved -> no `[AOG-HANDLED]` / `[AOG-ESCALATED]` message should appear.
5. Open coord group -> exactly one peer tag should appear.
6. Repeat with another customer group.

## Known risks

- Live WhatsApp DOM selectors still need Claude/user review before enabling the extension.
- Outlook fallback `sender + subject` can dedupe identical unread emails during one content-script session. This is acceptable for Round 2 because it avoids cross-reload dead state and volatile date IDs.
- [AUDIT REQUESTED] Extension should remain disabled until Claude reviews `docs/20260623_aog-watcher-v4-claude-review-handoff.md`.
