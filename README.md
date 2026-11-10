# AOG Watcher v5.0.0

![License MIT](https://img.shields.io/badge/license-MIT-green)
![JavaScript ES2022](https://img.shields.io/badge/JavaScript-ES2022-yellow)
![Chrome MV3](https://img.shields.io/badge/Chrome%20%2F%20Edge-Manifest%20V3-orange)
![SharePoint](https://img.shields.io/badge/data-SharePoint%20Lists-4d148c)

> AOG Watcher monitors WhatsApp Web and Outlook for urgent night-shift messages, rings the right operator, escalates to the Backup machine, and records operational evidence in SharePoint.

The popup stays focused on the current situation:

- **OFF SHIFT:** tonight's role, Start shift, and folded 24-hour shift times.
- **WATCHING:** live evidence that WhatsApp, Outlook, SharePoint, the partner machine and the test ring are working.
- **RINGING:** Accept at the top, the customer group or email subject, and the countdown until Backup is called.

## Why it is useful

The valuable shortcut is jump-to-chat. When an operator accepts a WhatsApp alert, AOG Watcher first stops the ring and notifies the partner machine, then opens the exact customer chat and places a configurable greeting in the composer. The operator reviews and sends it manually.

**AOG Watcher never sends a customer message automatically.** It refuses to place text when the open chat does not match the target, and it never places a customer greeting in the coordination group.

For Outlook alerts, Accept only brings Outlook to the front. Drafting an email response is not connected yet.

## Install

1. Download this repository and extract it to a permanent folder.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**, select **Load unpacked**, choose the extracted folder, and pin AOG Watcher.
4. Open **Settings** from the popup.
5. Confirm the SharePoint site is `https://trustanavn.sharepoint.com/sites/aog`, select **Sign in & check**, enter a unique operator name, and save.
6. The team lead expands **For the team lead (one-time setup)** and selects **Create lists**. The extension creates any missing lists or columns and reports when nothing remains to create.
7. Open and sign in to WhatsApp Web and the AOG mailbox in Outlook Web.

The **Create lists** button prepares these four SharePoint lists:

| List | Purpose |
|---|---|
| `AOG_Groups` | Shared customer chats and their active status |
| `AOG_Settings` | Shared operational settings |
| `AOG_Shifts` | Roster and one operational row per operator per night |
| `AOG_Log` | Events, machine heartbeats and peer signals |

See the [operating procedure](docs/SOP.md) for setup and verification details.

## Run a shift

1. Open WhatsApp Web and Outlook Web at the AOG mailbox.
2. Open AOG Watcher. On **Tonight**, check the role and 24-hour shift times, then select **Start shift**.
3. In **WATCHING**, follow each red action until the badge is **READY**. The checklist never stops monitoring; it only reports readiness.
4. When **RINGING** appears, select **ACCEPT — I'LL HANDLE IT**.
5. For WhatsApp, verify the correct chat and the prepared greeting, then send it yourself. For Outlook, the Outlook tab is brought forward.
6. Select a recent event to reopen its source without placing a greeting.
7. At the end of the shift, select **End shift** twice to confirm.

## Popup tabs

- **Tonight:** the current OFF SHIFT, WATCHING or RINGING screen.
- **Search:** pre-fills the currently open WhatsApp chat. Shipment search is a placeholder and is not connected yet.
- **Help:** opens this README and keeps diagnostic and missed-message tools available.
- **Settings:** opens machine and shared settings, including the WhatsApp greeting. Leave the greeting blank to place nothing after Accept.

## When something is wrong

- **WhatsApp or Outlook is red:** open or reload the named tab. For Outlook, confirm the AOG mailbox is open.
- **SharePoint is red:** open the AOG site and sign in again. Monitoring and ringing continue; queued writes retry later.
- **Partner machine lost:** contact the other operator and confirm their browser and shift are active.
- **Wrong chat opened:** AOG Watcher leaves the composer unchanged and reports the mismatch. Open the correct chat or retry the alert from Recent events.
- **Extension context invalidated:** reload the WhatsApp and Outlook tabs after updating the extension.

## Development

Requirements: Node.js and npm. The extension uses JavaScript ES2022 and Manifest V3, with no production dependency or build step.

```powershell
npm install
npm run check
```

`npm run check` validates Manifest V3 references and runs the Vitest suite. Architecture and working rules live in [handoff/MAP.md](handoff/MAP.md) and [handoff/RULES.md](handoff/RULES.md).

## License

[MIT](LICENSE)
