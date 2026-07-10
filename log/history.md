# History

## [2026-06-23 12:01] -- Round 5 report context and export polish

**Type:** bugfix
**Files Changed:** `lib/state_machine.js`, `lib/report_generator.js`, `popup.js`, `popup.css`, `settings.js`, `settings.html`, `settings.css`, `tests/state_machine.test.js`, `tests/report_generator.test.js`, `tests/popup_static.test.js`, `tests/settings_static.test.js`, `docs/20260623_aog-watcher-v4-round5-audit.md`, `handoff/todo.md`, `handoff/audit.md`
**Summary:** Fixed Round 5 report issues from Claude: ACK/PEER_HANDLED/MISSED rows now preserve alert context, popup recent events use Vietnam local time, and HR/Analytics exports include generated-at metadata and timestamped filenames. Added CSV/XLSX readability polish, Settings export busy handling, and regression tests.
**Decision:** Used static worksheet styling for missed rows and heatmap cells instead of raw OOXML conditional formatting because SheetJS Community does not reliably expose conditional formatting/data bars and Claude allowed the fallback.

---

## [2026-06-23 11:25] -- Fix Claude Round 4 report and shift review items

**Type:** bugfix
**Files Changed:** `service_worker.js`, `lib/report_generator.js`, `popup.html`, `popup.js`, `tests/report_generator.test.js`, `tests/service_worker_round3_static.test.js`, `tests/popup_static.test.js`, `docs/20260623_aog-watcher-v4-round4-claude-review-fixes-audit.md`, `handoff/todo.md`, `handoff/audit.md`
**Summary:** Closed Claude review Issues E/F/G: open shifts show `(in progress)` in reports, End Shift now clearly warns that monitoring stops, and ACK response time is backfilled from persisted DETECTED events so MV3 worker unload does not erase KPI data.
**Decision:** Kept optional storage-I/O and customer-group validation improvements out of this round to avoid scope creep before final manual dry-run.

---

## [2026-06-23 11:14] -- Finalize Round 3 production readiness

**Type:** feature
**Files Changed:** `content_whatsapp.js`, `service_worker.js`, `settings.html`, `settings.js`, `popup.html`, `popup.js`, `popup.css`, `lib/constants.js`, `lib/storage.js`, `lib/event_log.js`, `lib/report_generator.js`, `lib/vendor/xlsx.full.min.js`, `tests/whatsapp_content_static.test.js`, `tests/storage_shift_sessions.test.js`, `tests/event_log_enrich.test.js`, `tests/report_generator.test.js`, `tests/service_worker_round3_static.test.js`, `package.json`, `package-lock.json`, `docs/20260623_aog-watcher-v4-finalize-round3-audit.md`, `handoff/todo.md`, `handoff/audit.md`
**Summary:** Implemented Round 3 production readiness: WhatsApp peer tag scan/send reliability fixes, shift session tracking, enriched event logs, HR payroll CSV export, Analytics XLSX export, dry-run mode, popup recent events, and expanded tests from 85 to 97 passing cases.
**Decision:** Used SheetJS as a devDependency and vendored `xlsx.full.min.js` for extension runtime so production dependency audit remains clean. Kept `execCommand` for WhatsApp input but added verify-after-send so failures are visible instead of silent.

---

## [2026-06-23 10:21] -- Add content runtime guard and Claude review handoff

**Type:** bugfix
**Files Changed:** `lib/content_runtime.js`, `content_whatsapp.js`, `content_outlook.js`, `manifest.json`, `tests/content_runtime_static.test.js`, `tests/manifest.test.js`, `docs/20260623_aog-watcher-v4-runtime-fix-round2-audit.md`, `docs/20260623_aog-watcher-v4-claude-review-handoff.md`, `handoff/audit.md`, `log/failure.md`
**Summary:** Edge reported `Extension context invalidated` from a WhatsApp content-script heartbeat after extension reload. Added a shared content runtime guard that wraps runtime/storage calls and tracked intervals, clears intervals on invalidated context, and stops stale content scripts from sending messages. Wrote a Claude review handoff and marked live testing blocked until selector/send safety is reviewed.
**Decision:** Stopped live-test iteration and requested Claude review because failures are now dominated by volatile WhatsApp/Outlook DOM behavior. Recommended a diagnostic dry-run mode before resuming live alert tests.

---

## [2026-06-23 10:10] -- Harden Outlook unread detection after connected no-alert screenshot

**Type:** bugfix
**Files Changed:** `content_outlook.js`, `lib/outlook_selectors.js`, `lib/outlook_message_id.js`, `tests/outlook_content_static.test.js`, `tests/outlook_message_id.test.js`, `handoff/todo.md`, `handoff/audit.md`
**Summary:** The popup showed Outlook connected, role Primary, and shift Active, so the failure boundary was Outlook content scanning rather than service-worker health or role setup. Hardened unread detection by matching wildcard `Mark as read` labels, deriving candidate rows from unread buttons by climbing ancestors, adding a 2-second periodic scan, and including row text in fallback message IDs to avoid suppressing repeated same-sender/same-subject test emails in one session.
**Decision:** Chose periodic scan plus ancestor recovery because Outlook Cloud DOM structure is volatile and heartbeat alone is not evidence that message rows are being parsed. This keeps the fix local to Outlook content scanning without weakening email filters or WhatsApp fail-closed behavior.

---

## [2026-06-23 10:01] -- Harden WhatsApp coord-group peer sending

**Type:** bugfix
**Files Changed:** `content_whatsapp.js`, `manifest.json`, `lib/whatsapp_dom.js`, `lib/whatsapp_selectors.js`, `tests/whatsapp_dom.test.js`, `docs/20260623_aog-watcher-v4-runtime-fix-round2-audit.md`, `handoff/todo.md`, `handoff/audit.md`
**Summary:** Fixed the critical risk where `[AOG-HANDLED]` could be sent to a customer group by narrowing WhatsApp sidebar group-name extraction and requiring the active conversation header to match the configured coord group before touching the composer. Added DOM helper tests for row-name extraction, active header extraction, and normalized group comparison.
**Decision:** Chose fail-closed behavior: if the coord group cannot be proven active within 3 seconds, `sendPeerTag()` throws and sends nothing. This is safer than attempting a best-effort send because customer-group leakage is a production blocker.

---

## [2026-06-23 09:36] -- Fix persisted queue blocking alerts after reload

**Type:** bugfix
**Files Changed:** `service_worker.js`, `content_outlook.js`, `manifest.json`, `lib/runtime_state.js`, `lib/outlook_message_id.js`, `tests/integration_simulate_restart.test.js`, `tests/outlook_message_id.test.js`, `tests/manifest.test.js`, `docs/20260623_aog-watcher-v4-runtime-fix-round2-audit.md`, `handoff/todo.md`
**Summary:** Runtime state no longer persists the alert queue, preventing handled alert IDs from silently blocking future detections after extension reload. Added a restart simulation regression test and stabilized Outlook message IDs by preferring ancestor stable IDs with a normalized sender+subject fallback.
**Decision:** Chose Claude Option A because it matches the blueprint: queue is session-only, while DOM re-detection rebuilds active alerts after reload. Avoided Option B/TTL because both keep unnecessary persisted queue complexity.

---

## [2026-06-22 11:40] -- Fix duplicate peer tags and source health

**Type:** bugfix
**Files Changed:** `service_worker.js`, `content_whatsapp.js`, `content_outlook.js`, `popup.js`, `lib/constants.js`, `lib/storage.js`, `lib/peer_dispatch_guard.js`, `lib/source_health.js`, `tests/peer_dispatch_guard.test.js`, `tests/source_health.test.js`, `tests/state_machine.test.js`, `tests/manifest.test.js`, `handoff/todo.md`, `handoff/audit.md`, `docs/20260622_aog-watcher-v4-runtime-fix-round1-audit.md`
**Summary:** Added idempotent peer-tag dispatch and a recent-message DOM guard to prevent duplicate HANDLED/ESCALATED posts. Replaced tab-presence health with persisted 30-second heartbeats, implicit alert health, 60-second freshness, and two-second popup polling. Retained and reviewed Claude's Outlook Cloud selector hotpatch; the suite increased from 57 to 72 passing tests.
**Decision:** Persist every heartbeat because roughly four small local writes per minute is acceptable and preserves truthful status across MV3 worker unloads. The reducer was proven to emit one send effect; the missing idempotency boundary was the causal defect that allowed repeated runtime dispatch to become duplicate messages.

---

## [2026-06-22 09:43] -- Build AOG Watcher v4 Chrome Extension

**Type:** feature
**Files Changed:** `manifest.json`, `service_worker.js`, `content_whatsapp.js`, `content_outlook.js`, `offscreen.html`, `offscreen.js`, `popup.html`, `popup.js`, `popup.css`, `settings.html`, `settings.js`, `settings.css`, `lib/`, `tests/`, `assets/`, `tools/`, `package.json`, `package-lock.json`, `handoff/todo.md`, `docs/20260622_aog-watcher-v4-build-audit.md`
**Summary:** Implemented the JavaScript ES2022 Chrome Extension MV3 described by the v4 blueprint, including two-source DOM detection, persistent Primary/Backup state machine, peer coordination, offscreen alarms, operator UI, settings, CSV reporting, generated assets, and 57 automated tests. Automated MV3, syntax, test, and production dependency checks pass; live Chrome/Edge DOM integration remains pending user-environment verification.
**Decision:** Timers are keyed by alert ID and runtime state is persisted in chrome.storage so service-worker sleep and concurrent queued alerts do not cancel each other. WhatsApp unread detection tracks count changes instead of polling-time signatures to avoid repeated alerts from the same unread batch.

---
