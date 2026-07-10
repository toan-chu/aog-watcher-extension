# AOG Watcher v4 -- Claude Review Handoff

**Date:** 2026-06-23 10:21
**From:** Codex
**To:** Claude Cowork
**Status:** AUDIT REQUESTED. Keep extension disabled until review.

## Why this handoff exists

Live testing exposed multiple runtime issues after Round 2:

1. Email did not alert even while popup showed Outlook connected.
2. WhatsApp peer tag previously leaked to a customer group.
3. After extension reload, Edge reported `Uncaught Error: Extension context invalidated` from `content_whatsapp.js:115`.

The user asked Codex to stop live testing and hand off for Claude review before enabling the extension again.

## What Codex changed in latest pass

### Content runtime invalidation guard

Added `lib/content_runtime.js` and injected it before both content scripts.

Purpose:

- Wrap `chrome.runtime.sendMessage`.
- Wrap `chrome.storage.local.get`.
- Wrap runtime/storage listeners.
- Replace long-lived content-script intervals with `setSafeInterval`.
- Detect `"Extension context invalidated"`, clear intervals, and stop silently.

Files:

- `lib/content_runtime.js`
- `manifest.json`
- `content_whatsapp.js`
- `content_outlook.js`
- `tests/content_runtime_static.test.js`
- `tests/manifest.test.js`

### Current automated status

- `npm.cmd run check` passed.
- MV3 reference check passed.
- Vitest: 16 test files, 85 tests passed.
- `npm.cmd audit --omit=dev`: 0 vulnerabilities.

## Current code review findings

### Confirmed safe/clean

- Content scripts no longer call `chrome.runtime.sendMessage` directly; direct runtime/storage access is centralized in `lib/content_runtime.js`.
- Existing content-script timers route through `runtime.setSafeInterval`.
- WhatsApp peer sending now verifies active coord-group header before composer use.
- Runtime state no longer persists `queue`, so handled alert IDs should not block future detections after reload.

### Still needs Claude review before live

1. **WhatsApp DOM send safety**
   - `content_whatsapp.js` still uses `document.execCommand("insertText", false, text)` and then clicks send.
   - Guard now fails closed if coord header mismatch, but Claude should verify selector strategy and whether a safer paste/input method is needed.

2. **WhatsApp group matching**
   - Current row name extraction uses `span[dir='auto'][title]` / `span[dir='auto']`.
   - Claude should confirm against live WhatsApp DOM before enabling, because wrong group leakage is the highest-risk failure.

3. **Outlook unread detection**
   - Current scan uses wildcard `button[aria-label*='Mark as read' i]`, ancestor climbing, row selector fallbacks, and 2-second scan.
   - This is broader than before but still unverified against the user's live Outlook DOM.
   - Claude should decide whether to add a debug overlay/log mode to show extracted sender/subject/unread rows before triggering wake.

4. **Email filtering during tests**
   - Default `skip_sender_domains` includes `trustana.vn`.
   - The screenshot involved internal Outlook context; if test emails are from trustana.vn, they can be intentionally skipped unless settings remove that skip domain.

## Recommendation

Do not enable live alerting yet. Claude should do a code review pass and preferably request/inspect live DOM snippets for:

- WhatsApp sidebar row for coord group.
- WhatsApp active conversation header.
- Outlook unread row for a test email.

After Claude review, recommended next implementation step is a **diagnostic dry-run mode** in popup/settings:

- No wake.
- No WhatsApp send.
- Shows what each content script sees:
  - Outlook: number of candidate rows, unread rows, extracted sender/subject/message_id, filter decision.
  - WhatsApp: matched customer groups, coord group row match, active header name.

This should precede another live test because the current failures are selector/DOM-observability problems, not pure state-machine problems.

## Manual test should remain blocked until

- Claude approves WhatsApp coord send safety.
- Diagnostic mode or equivalent logging confirms Outlook row extraction.
- Extension storage is cleaned before the next run.
