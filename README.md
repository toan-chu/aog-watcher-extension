# AOG Watcher v5.0.0

![License MIT](https://img.shields.io/badge/license-MIT-green)
![JavaScript ES2022](https://img.shields.io/badge/JavaScript-ES2022-yellow)
![Chrome MV3](https://img.shields.io/badge/Chrome%20%2F%20Edge-Manifest%20V3-orange)
![SharePoint](https://img.shields.io/badge/data-SharePoint%20Lists-4d148c)

**English** · [Tiếng Việt](README.vi.md)

> AOG Watcher monitors WhatsApp Web and Outlook for urgent night-shift messages, rings the right operator, escalates to the Backup machine, and records operational evidence in SharePoint.

## Contents

1. [What AOG Watcher does](#1-what-aog-watcher-does)
2. [Who does what](#2-who-does-what)
3. [The two rules: name and email](#3-the-two-rules-name-and-email)
4. [Operator: first-time setup](#4-operator-first-time-setup)
5. [Operator: run a shift](#5-operator-run-a-shift)
6. [Shift lead: fill the roster in AOG_Shifts](#6-shift-lead-fill-the-roster-in-aog_shifts)
7. [Shift lead: manage WhatsApp chats in AOG_Groups](#7-shift-lead-manage-whatsapp-chats-in-aog_groups)
8. [Settings reference](#8-settings-reference)
9. [SharePoint column reference](#9-sharepoint-column-reference)
10. [When something is wrong](#10-when-something-is-wrong)
11. [Development](#11-development)

## 1. What AOG Watcher does

- It watches WhatsApp Web and the AOG mailbox in Outlook Web while you are on shift.
- When a message arrives from a watched customer chat, the machine rings until someone selects **Accept**.
- If the Primary operator does not accept in time, the Backup machine rings.
- When you accept a WhatsApp alert, the extension stops the ring, tells the partner machine, opens the exact customer chat and places a greeting in the message box.

**AOG Watcher never sends a message for you.** You read the greeting and press Send yourself. If the open chat is not the expected chat, the extension places nothing.

For Outlook alerts, Accept only brings Outlook to the front.

The popup shows one of three screens:

- **OFF SHIFT:** tonight's role and the **Start shift** button.
- **WATCHING:** whether WhatsApp, Outlook, SharePoint, the partner machine and the test ring are working.
- **RINGING:** the **Accept** button, the customer chat or email subject, and the countdown until Backup is called.

## 2. Who does what

| Person | Does |
|---|---|
| Operator | Installs the extension once, signs in, starts and ends each shift, accepts alerts. |
| Shift lead | Fills the weekly roster in `AOG_Shifts`, keeps the chat list in `AOG_Groups` up to date, publishes shared settings. |

All data lives on the SharePoint site `https://trustanavn.sharepoint.com/sites/aog`, in four lists: `AOG_Groups`, `AOG_Settings`, `AOG_Shifts` and `AOG_Log`.

## 3. The two rules: name and email

The extension finds tonight's row in `AOG_Shifts` by **ShiftDate + Email**. The row's `Title` (**OperatorName**) is the official operator name.

**Rule 1 — Email.** The `Email` column must be exactly the Microsoft 365 address you use to sign in to SharePoint.

- Operator: open **Settings** and select **Sign in & check**. The result line shows `Signed in: Your Name <you@company>`. That address is your email. Send it to the shift lead once.
- Shift lead: copy that address into `Email` for every row of that person. No spaces before or after, no personal Gmail address, no second company alias.

**Rule 2 — Name.** The shift lead enters the official name in `Title`. When the operator selects **Sign in & check** or **Start shift**, the extension copies that name into **Display name** and shows `Name updated to "<name>" from tonight's roster` when it changes.

- Each person uses one English name, and no two people share a name.
- The extension never overwrites `Title` on an existing roster row.
- **Display name** is only the fallback name when no row exists. In that case WATCHING shows `You are not on tonight's roster. Contact the shift lead.` Monitoring and alerts continue, and the extension creates an operational row using the Display name.

Quick check for both rules: select **Sign in & check**, confirm the displayed name matches `Title`, then select **Start shift**. The prepared row must show a time in `CheckIn`, with its `Title` unchanged.

## 4. Operator: first-time setup

1. Download this repository and extract it to a permanent folder. Do not delete or move the folder later.
2. Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, select **Load unpacked**, choose the folder, and pin AOG Watcher to the toolbar.
3. Open the popup and select **Settings**.
4. In **1. SharePoint AOG**, keep the link `https://trustanavn.sharepoint.com/sites/aog` and select **Sign in & check**.
   - If it says `Could not connect`, select **Open SharePoint**, sign in with your company account, then select **Sign in & check** again.
   - Note the address in `Signed in: … <you@company>` (rule 1).
5. In **2. Operator**, enter your **Display name** (rule 2).
6. Review the **WhatsApp greeting**. Leave it blank if you do not want any text placed after Accept.
7. Select **Save settings**.
8. Open WhatsApp Web and sign in. Open Outlook Web at the AOG mailbox.
9. After every extension update, reload the WhatsApp and Outlook tabs.

Shared settings (mailbox, timing, coordination group) are downloaded from SharePoint automatically. You do not need to type them.

## 5. Operator: run a shift

### Set your role for tonight

A night has two slots. **Slot 1** is the first part of the night (default 22:00–02:30). **Slot 2** is the second part (default 02:30–07:00).

On the **OFF SHIFT** screen, open **Tonight's shift times** and choose a role for each slot:

| Role | What the machine does in that slot |
|---|---|
| Primary | Rings as soon as a message arrives. |
| Backup | Rings when the Primary has not accepted in time, or when the message has waited too long. |
| Off | Does not ring. Use this for the slot you do not work. |

Times use the 24-hour format `HH:mm`. Today, each machine reads its role from this popup, not from the `Slot1Role`/`Slot2Role` columns in SharePoint.

### Start

1. Open WhatsApp Web and Outlook Web at the AOG mailbox.
2. Open the popup, check the role, and select **Start shift**.
3. The screen changes to **WATCHING**. Fix every red row until the badge shows **READY**:
   - **WhatsApp / Outlook:** must show a recent check time.
   - **SharePoint:** must be connected.
   - **Partner machine:** must be on shift.
   - **Test ring heard:** select **Test ring**, listen, then select **I hear it**.

The check never stops monitoring. It only tells you what is not ready.

### When it rings

1. Select **ACCEPT — I'LL HANDLE IT**. The ring stops and the partner machine is told.
2. For WhatsApp, the customer chat opens with the greeting in the message box. Check the chat, then press Send yourself.
3. If several alerts are waiting, **Accept all (N)** accepts all of them at once.

You can also accept without the popup:

- Open the ringing chat in WhatsApp and read it while you are at the computer. This counts as Accept.
- If the chat's unread count drops to zero and stays at zero for two checks in a row, this also counts as Accept.

An open chat on a machine that nobody is using (screen locked or idle) does not count.

### End

Select **End shift**, then select it again to confirm. The extension writes `CheckOut` and `Hours` to your row.

## 6. Shift lead: fill the roster in AOG_Shifts

Create **one row per person per night**.

| Column | What to enter | Example |
|---|---|---|
| Title (OperatorName) | The operator's Display name, exactly (rule 2) | `Alex` |
| ShiftDate | The date of the **evening** the night starts, as `YYYY-MM-DD` | `2026-11-12` |
| Email | The operator's Microsoft 365 address, exactly (rule 1) | `alex@trustana.vn` |
| Slot1Role | Role in Slot 1 (22:00–02:30): Primary, Backup or Off | `Primary` |
| Slot2Role | Role in Slot 2 (02:30–07:00): Primary, Backup or Off | `Off` |
| Notes | Anything for people to read | |

Leave every other column empty. The extension fills them.

**The early-morning slot belongs to the previous date.** Someone who works 02:30–07:00 on Thursday morning is entered with Wednesday's date, because that night started on Wednesday evening.

**ShiftDate must be typed as `YYYY-MM-DD`**, for example `2026-11-12`. The column is text, so `12/11/2026` or `12-Nov` will not match, and the operator gets a second row.

Example for the night that starts on Wednesday 12 November 2026:

| Title | ShiftDate | Email | Slot1Role | Slot2Role |
|---|---|---|---|---|
| Alex | 2026-11-12 | alex@trustana.vn | Primary | Off |
| Sam | 2026-11-12 | sam@trustana.vn | Off | Primary |

Common mistakes:

- An email with a capital letter or a trailing space copied from a chat message. Copy it from the `Signed in:` line.
- Two rows for the same person on the same `ShiftDate`.
- Using a slot number from the old roster ("Ca 1" meaning 02:30–07:00). In the extension, **Slot 1 is 22:00–02:30**.

## 7. Shift lead: manage WhatsApp chats in AOG_Groups

One row per WhatsApp chat that should ring.

- **Title:** the chat name exactly as WhatsApp shows it, including spaces, capital letters and emoji. The safest way is to open the group info in WhatsApp and copy the name.
- **Active:** set to **No** to stop watching a chat without deleting it.
- **ChatType:** **Customer** or **Flyer**. This column marks whether the chat belongs to a customer or to a flyer. The current version does not treat the two types differently yet; a later version will use this column to separate them.
- **Note:** free text for people.

Machines reload the list when a shift starts and when Settings are saved. A chat that is not on the list can still ring as **Unknown chat**, with **Add to shared list** and **Ignore** buttons.

## 8. Settings reference

**Shared** settings are the same on every machine. The shift lead changes them on one machine and selects **Publish shared settings**; the other machines download them from `AOG_Settings`. All other settings apply only to the machine where they are saved.

| Section | Setting | Shared | Meaning |
|---|---|---|---|
| 1. SharePoint AOG | SharePoint AOG link | No | The AOG site. Keep the default. |
| | Sign in & check | — | Connects to SharePoint and shows the signed-in email. |
| | Create lists | — | Shift lead only, one time: creates missing lists and columns. Needs site-owner permission. |
| | Publish shared settings | — | Shift lead: copies this machine's shared settings to `AOG_Settings`. |
| 2. Operator | Display name | No | Your name; must match `Title` in `AOG_Shifts`. |
| 3. WhatsApp | Coordination group | Yes | WhatsApp group the two machines use to signal each other when SharePoint is unavailable. |
| | WhatsApp greeting | No | Text placed in the customer chat after Accept. Never sent automatically. Blank = place nothing. |
| | Ring for unknown chats | Yes | A chat that is not in `AOG_Groups` still rings. |
| | My personal groups | No | Extra chats watched only by this machine, one per line. |
| | Ignored chats | No | Chats this machine never rings for. |
| 4. Outlook | AOG mailbox path | Yes | The part of the Outlook URL after `outlook.office.com`, for example `/mail/aog@company.com/`. |
| | Only accept from senders | Yes | Optional. Only these emails or domains ring. One per line. |
| | Ignored sender domains | Yes | Emails from these domains never ring. Default: `trustana.vn`. |
| | Subject keywords | Yes | Only subjects containing one of these words ring. Blank = every subject. |
| 5. Timing & alerts | Wait for Accept before alerting Backup | Yes | Seconds the Primary has before Backup is called. Default 120. |
| | Backup rings after | Yes | Seconds after which Backup rings on its own for a message still waiting. Default 180. |
| | Maximum ring duration | Yes | Seconds before the ring stops by itself. Default 540. |
| | Machine idle threshold | Yes | Seconds without keyboard or mouse before the machine counts as unattended. Default 15. |
| | Ring style | Yes | Gentle repeating, or increasing volume. **Preview ring** plays it. |
| | Follow up after Accept | Yes | After Accept, the extension later asks whether the case is resolved. |
| | Follow up after | Yes | Minutes after Accept before that question. Default 10. |
| | Answer timeout | Yes | Minutes to answer the question before the alert rings again. Default 5. |
| | Partner machine lost after | Yes | Minutes without news from the partner machine before a warning. Default 5. |
| | Shift reminder after | Yes | Minutes after the first slot starts before reminding you to select Start shift. Default 10. |
| | Blind alert after | Yes | Minutes the extension can no longer read WhatsApp or Outlook before it warns that it is blind. Default 5. |
| 6. Testing | Test mode | No | Ignores shift hours and uses the **Test role** below. |
| | Test role | No | Primary or Backup while Test mode is on. |
| | Dry-run | No | Does not ring and does not notify the partner machine. |

`AOG_Settings` also holds `log_keep_days` (default 90): rows in `AOG_Log` older than this go to the site recycle bin.

## 9. SharePoint column reference

"Person" means someone types the value; "Extension" means the machine writes it. Do not edit columns marked Extension.

### AOG_Groups — WhatsApp chats to watch

| Column | Filled by | Meaning |
|---|---|---|
| Title | Person | Chat name exactly as in WhatsApp |
| ChatType | Person | Customer or Flyer (reserved for a later version) |
| Active | Person | No = do not watch |
| AddedBy, AddedAt | Extension | Who added the chat from the popup, and when |
| Note | Person | Free text |

### AOG_Settings — shared settings

| Column | Filled by | Meaning |
|---|---|---|
| Title (Key) | Extension | Setting name, for example `log_keep_days` |
| Value | Extension | Setting value |
| UpdatedBy | Extension | Who published it last |

Change shared settings through **Settings → Publish shared settings**, not by editing this list. The one exception is `log_keep_days`, which has no field in Settings.

### AOG_Shifts — roster and payroll

| Column | Filled by | Meaning |
|---|---|---|
| Title (OperatorName) | Shift lead | Official operator name. The extension reads it and never overwrites an existing value |
| ShiftDate | Shift lead | Evening date, `YYYY-MM-DD` |
| Email | Shift lead | Microsoft 365 address (rule 1) |
| Slot1Role, Slot2Role | Shift lead | Planned role per slot; the extension does not read these yet |
| Notes | Shift lead | Free text |
| CheckIn, CheckOut | Extension | When Start shift and End shift were selected |
| Hours | Extension | Hours between CheckIn and CheckOut |
| Ready | Extension | Whether the pre-shift check was ready |
| AlertCount | Extension | Messages that rang |
| AcceptedCount | Extension | Messages accepted |
| MissCount | Extension | Messages missed or reported missed |
| AcceptLog | Extension | Time and chat of each Accept |

If no row matches tonight's `ShiftDate + Email`, the extension warns the operator but keeps watching and creates a row. Only that newly created row gets its `Title` from the local Display name.

### AOG_Log — machine log (cleaned after 90 days)

| Column | Meaning |
|---|---|
| RecordType | `Event` (something that happened), `Signal` (message between the two machines) or `Machine` (one row per machine, updated regularly) |
| Title (Summary) | Short label: event type, signal type with alert id, or the operator name |
| EventType, At | What happened and when |
| ShiftId, AlertId | Which shift and which alert |
| Source, GroupOrSubject, Sender | WhatsApp or Outlook, the chat or email subject, the sender |
| Role, OperatorName, Email, MachineId | Who and which machine |
| ResponseSeconds | Seconds from ring to Accept. On the Backup machine, counted from the moment Backup was called |
| MissCause | Why an alert was missed |
| Ready, Version, Detail | Readiness, extension version, extra detail or problems |

Every column in this list is written by the extension.

## 10. When something is wrong

- **WhatsApp or Outlook is red:** open or reload that tab. For Outlook, check that the AOG mailbox is open.
- **SharePoint is red:** open the AOG site and sign in again. Monitoring and ringing continue; writes are retried later.
- **Partner machine lost:** call the other operator and check that their browser is open and their shift is started.
- **Wrong chat opened:** nothing is placed in the message box. Open the right chat, or reopen the alert from **Recent events**.
- **A second row appeared in AOG_Shifts:** the email or ShiftDate did not match (section 3). Tell the shift lead; they correct the planned row and delete the extra one.
- **Extension context invalidated:** reload the WhatsApp and Outlook tabs after an update.
- **The watcher did not ring for a message:** open **Help → Missed a message?** and log it.

More detail: [operating procedure](docs/SOP.md).

## 11. Development

Requirements: Node.js and npm. The extension uses JavaScript ES2022 and Manifest V3, with no production dependency or build step.

```powershell
npm install
npm run check
```

`npm run check` validates Manifest V3 references and runs the Vitest suite. Architecture and working rules live in [handoff/MAP.md](handoff/MAP.md) and [handoff/RULES.md](handoff/RULES.md).

## License

[MIT](LICENSE)
