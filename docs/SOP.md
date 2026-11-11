# AOG Watcher 5.0 — Operating Procedure

This procedure applies to AOG Watcher 5.0 and later. The architecture source of truth is `handoff/MAP.md`.

AOG Watcher monitors WhatsApp Web and Outlook Web during the night shift, rings for AOG messages, escalates to the Backup machine, reports monitoring failures, and records shift evidence in SharePoint.

## A. Team lead: one-time setup

1. Confirm every operator has edit access to `https://trustanavn.sharepoint.com/sites/aog`.
2. Open AOG Watcher **Settings**, confirm the SharePoint site, and select **Sign in & check**.
3. Confirm these four lists exist on the site. They are created once by the site owner with the setup script kept outside this repository:

   | List | Purpose |
   |---|---|
   | `AOG_Groups` | Shared WhatsApp chats, chat type and active status |
   | `AOG_Settings` | Shared mailbox and timing settings |
   | `AOG_Shifts` | Planned roster and one actual shift row per operator per night |
   | `AOG_Log` | Operational events, machine heartbeats and peer signals |

   In `AOG_Shifts`, enter the operator's official name in **Title** (shown as OperatorName). The extension matches a row by `ShiftDate` and `Email`; when that is not found, it matches the same `ShiftDate` and **Title** only if `Email` is blank.

4. Add the current customer chats to `AOG_Groups`. The chat title must match the title shown in WhatsApp.
5. In **Settings**, enter the Outlook mailbox path and review the timing values, then select **Save settings**. Saving publishes every shared setting you changed to `AOG_Settings`, and the other machines download it.

## B. Operator: first-time setup

1. Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, select **Load unpacked**, choose the extension folder, and pin AOG Watcher.
2. Open **Settings** from the popup.
3. Confirm the SharePoint link is `https://trustanavn.sharepoint.com/sites/aog` and select **Sign in & check**.
4. Enter a unique display name for this machine.
5. Review **WhatsApp greeting**. The default is:

   ```text
   Well received. We are checking and will revert shortly.
   ```

   AOG Watcher places this text in the customer composer after Accept. It never selects Send. Leave the setting blank when no draft should be placed.
6. Save Settings.
7. Open WhatsApp Web and sign in. Open Outlook Web at the AOG mailbox.
8. After updating or reloading the extension, reload both web tabs so their content scripts use the current version.

## C. Start a shift

1. Open the popup and stay on **Tonight**.
2. On **OFF SHIFT**, confirm tonight's role.
3. Expand **Tonight's shift times** only when the schedule needs checking. Times always use `HH:mm` in 24-hour format.
4. Select **Start shift**.
5. The popup changes to **WATCHING**. Confirm the evidence rows:
   - WhatsApp and Outlook show when they were last checked.
   - SharePoint is connected.
   - The partner machine is on shift.
   - The test ring was heard and shows its confirmation time.
   - The latest event is a normal English sentence, not an internal event code.
6. If the pre-shift check is not ready, complete each red action exactly as written. Select **Test ring**, listen, then select **I hear it**.

The pre-shift check does not block monitoring. It reports readiness and tells the operator what to fix.

## D. Handle an alert

### WhatsApp

1. When the popup changes to **RINGING**, read the customer chat name and Backup countdown.
2. Select **ACCEPT — I'LL HANDLE IT** at the top.
3. AOG Watcher stops the ring and records Accept.
4. AOG Watcher notifies the partner machine with `HANDLED`. If SharePoint is unavailable and a coordination group is configured, it sends the fallback tag there.
5. Only after those steps, AOG Watcher opens the target customer chat.
6. It verifies that the active chat title matches the target and that the target is not the coordination group.
7. If the configured greeting is not blank, it places the greeting in the composer.
8. Review the chat and draft, then select Send yourself.

**Safety rule:** AOG Watcher never sends a customer message automatically. If WhatsApp opens the wrong chat, the composer remains unchanged and the popup reports that nothing was typed.

### Outlook

1. Select **ACCEPT — I'LL HANDLE IT**.
2. AOG Watcher completes Accept and brings the Outlook tab forward.
3. Open the correct email and compose the reply manually. Automatic email draft preparation is not connected yet.

### Unknown chat and system alerts

- During RINGING, system alerts and unknown-chat decisions appear below Accept.
- Select **Add to shared list** only for a customer chat that every machine should watch.
- Select **Ignore** for personal or irrelevant chats.
- Select **Dismiss** to silence a system warning; fix the stated cause so the warning can clear.

## E. Recent events, Search and Help

- Recent events are English sentences. Select a WhatsApp event to open its chat without placing a greeting. Select an Outlook event to bring Outlook forward.
- **Search** reads the chat currently open in WhatsApp and pre-fills it in the search field. The shipment list is not connected yet; no SharePoint shipment query runs in this version.
- **Help** opens the guide in English or Vietnamese, and provides Diagnostics and **Missed a message?**.
- **Settings** is always available at the bottom of the popup.

## F. End a shift

1. On **WATCHING**, select **End shift**.
2. Select **Confirm end shift?** within five seconds.
3. Confirm the popup returns to **OFF SHIFT** and SharePoint receives the checkout data when connected.

## G. SharePoint failure

- Monitoring, ringing, Accept and escalation continue when SharePoint is unavailable.
- Peer coordination falls back to the WhatsApp coordination group only if one is configured. The Settings page no longer shows this field.
- The fallback tag is sent before AOG Watcher opens a customer chat, so `[AOG-HANDLED]` cannot be left in a customer composer.
- Queued data stays in the local outbox and retries after SharePoint reconnects.
- To recover, open `https://trustanavn.sharepoint.com/sites/aog`, sign in with the company account, and recheck Settings.

## H. Quick diagnosis

| Symptom | Action |
|---|---|
| WhatsApp shows red | Open or reload WhatsApp Web. |
| Outlook shows red | Open Outlook Web at the configured AOG mailbox and reload it. |
| Test ring is red | Select Test ring, check Windows volume and speakers, then select I hear it. |
| Partner machine is lost | Contact the other operator and confirm their browser and shift are active. |
| The wrong WhatsApp chat opened | Do not type or send. Read the popup error, open the correct chat and retry from Recent events. |
| A customer chat appears as unknown | Match its exact WhatsApp title in `AOG_Groups`, or select Add to shared list. |
| Extension context invalidated | Reload WhatsApp and Outlook after reloading the extension. |

When reporting a problem, include the local time, a popup screenshot, the source tab involved, and the corresponding row from `AOG_Log` when available.
