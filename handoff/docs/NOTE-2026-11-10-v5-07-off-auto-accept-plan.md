# V5-07 Off And Auto Accept Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Off-duty scheduling, evidence-based WhatsApp open-chat Accept, and Accept all without changing the two-machine protocol or escalation timing.

**Architecture:** Keep duty resolution in `shift_engine`, pass slot metadata through the existing heartbeat Detail, and route every Accept through the existing state-machine effect path. The WhatsApp content script reports positive read evidence only; the service worker owns matching that evidence to pending alerts and enforcing source health.

**Tech Stack:** Chrome MV3, vanilla JavaScript modules, Vitest, Playwright CLI for screenshots.

**Spec:** `handoff/20261110_V5-07_off-auto-accept.md`

## Global Constraints

- Do not change HANDLED/ESCALATED wire names or escalation durations.
- Never auto-send customer text.
- A missing WhatsApp row is not read evidence.
- Old heartbeat Detail arrays remain readable.
- All product changes follow RED → GREEN and retain a mutation check.

## Review Focus

- A stale heartbeat whose embedded schedule is now Off/outside duty must not become lost.
- A visible unread-zero chat may accept only its matching actionable alert, never a sibling chat.
- A blind/missing WhatsApp source must reject otherwise-valid read evidence.
- Accept all must send exactly one HANDLED and one ACCEPT per actionable alert.
- Existing baseline and stale-signal suppression must remain intact.

---

### Task 1: Duty Scheduling And Peer Presence

**Files:** `lib/constants.js`, `lib/shift_engine.js`, `lib/heartbeat.js`, `lib/shift_reminder.js`, `lib/preflight.js`, `lib/team_sync.js`, `lib/shift_row.js`, `service_worker.js`, `popup.html`, `popup.js`, tests.

**Interfaces:** `resolveRoleAtTime(now, slots)` may return `role: "off"`; `isDutyRole(role)` identifies Primary/Backup; heartbeat Detail accepts `{ problems, shift_slots }` and legacy arrays.

- [ ] Add failing tests for Off normalization, Off/outside-duty stale heartbeat, duty-only reminders, Off alert logging/no wake, and shift row roles.
- [ ] Run focused tests and confirm failures are for missing Off behavior.
- [ ] Implement the minimum duty helpers, compatible heartbeat metadata, service-worker gates, and popup option.
- [ ] Run focused tests to green; mutate each gate once and confirm the owning test fails.

### Task 2: Accept By ID And Accept All

**Files:** `lib/alert_queue.js`, `lib/state_machine.js`, `service_worker.js`, tests.

**Interfaces:** `ALERT_ACCEPT_BY_ID {alert_id, method}` handles ALERTING or QUEUED; `ALERT_ACCEPT_ALL {method}` handles every actionable alert; ACCEPT log contains `accept_method`.

- [ ] Add failing state-machine tests for queued-by-id, current-by-id, three-alert Accept all, exact timer cancellation, HANDLED counts and methods.
- [ ] Run the tests red, then implement the two actions by reusing one internal Accept helper.
- [ ] Add service-worker tests for follow-ups, SharePoint event detail and one-chat-only navigation.
- [ ] Run focused tests green and mutation-check wrong id/all counts.

### Task 3: Positive WhatsApp Read Evidence

**Files:** `content_whatsapp.js`, `lib/constants.js`, `service_worker.js`, tests.

**Interfaces:** content sends `WHATSAPP_READ_OBSERVED { active_chat, visible_read_chats }`; service worker accepts matching actionable WhatsApp alerts only while source status is `ok`.

- [ ] Add failing content tests proving active chat and visible unread-zero rows are reported, while removed rows are absent.
- [ ] Add failing service-worker tests for exact-chat auto Accept, one-of-three, blind-source rejection and no navigation/greeting.
- [ ] Implement the observation and matching path with no remembered-row disappearance heuristic.
- [ ] Run focused tests green; mutation-check blind guard and missing-row behavior.

### Task 4: Popup And Evidence

**Files:** `popup.html`, `popup.js`, `popup.css`, `lib/popup_view.js`, popup tests, ticket, `handoff/STATE.md`, three PNGs.

**Interfaces:** status `pending_count` counts ALERTING plus QUEUED; Accept all message is `ACCEPT_ALL`; unhealthy WATCHING badge uses the same bad tone as `watchingSummary`.

- [ ] Add failing DOM/view tests for Off option, `No backup on duty`, badge tone, pending count and Accept-all placement.
- [ ] Implement minimal markup/rendering and handler changes; run focused tests green.
- [ ] Capture the three required browser screenshots under `handoff/shots/`.
- [ ] Run all mutation checks, `git diff --check`, and `npm run check`; record exact evidence and the <=12-step manual test in the ticket.
- [ ] Update `STATE.md`, commit only V5-07 files, push `master`, and provide the Claude review block.
