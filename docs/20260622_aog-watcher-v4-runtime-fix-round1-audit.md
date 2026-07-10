# AOG Watcher v4 Runtime Fix Round 1 Audit

## Status

Code fixes complete. Live Edge verification remains pending in the user's authenticated WhatsApp/Outlook environment.

## Bug 1 - Duplicate peer tag

Investigation proved that one `ALERT_ACK` reducer call emits exactly one `SEND_PEER_TAG` effect. The popup also disabled ACK synchronously before awaiting the service worker, and a second queued ACK sees state `IDLE`. The duplicate was therefore not produced by reducer cardinality.

The causal defect was the absence of idempotency at the service-worker-to-content-script send boundary: if the same `(tag_type, alert_id)` reached that boundary twice, both calls performed a real DOM send. The precise external trigger for the observed repeated identical payload could not be reproduced outside the authenticated browser session.

Fixes:

- Added a five-minute `PeerDispatchGuard` keyed by `(tag_type, alert_id)`.
- The guard claims before asynchronous DOM send, blocks concurrent duplicates, and releases on failure so a legitimate retry remains possible.
- Added an exact-text scan of recent Coord messages before the WhatsApp composer is used.
- Added explicit ACK pending text, synchronous disable, error feedback, and response-controlled completion in the popup.
- Verified one ACK reducer event produces exactly one peer-tag effect.

## Bug 2 - Misleading source health

Fixes:

- Both content scripts send an immediate heartbeat and repeat every 30 seconds.
- Health records persist in `chrome.storage.local` as `{connected, last_seen}`.
- Any detected alert implicitly updates the corresponding source health (`email` maps to `outlook`).
- Status derives connected state from a 60-second freshness window rather than tab presence.
- Popup polls status every two seconds and supports the structured health response.

Decision: persist each heartbeat. Two sources at 30-second cadence produce approximately four small local writes per minute and keep status correct across MV3 service-worker unloads.

## Outlook hotpatch review

- Retained Claude's stable attribute/DOM-shape selectors and extraction helpers because live Outlook Cloud detection was already confirmed.
- Legacy fallbacks remain present.
- Manifest already includes Outlook Office, Office365, Live, and Cloud Microsoft hosts; added tests to prevent Outlook Cloud coverage regression.
- Structural subject extraction remains a live-test risk because preview text can resemble a subject.

## Verification

- `npm.cmd run check`: pass.
- MV3 manifest/reference gate: pass.
- Vitest: 11 files, 72 tests passed (previous baseline: 57).
- All project JavaScript passed `node --check`.
- `npm.cmd audit --omit=dev`: 0 vulnerabilities.

## Manual tests pending

1. ACK one email and one WhatsApp alert; each must create exactly one HANDLED tag.
2. Confirm both sources become Connected within 5 seconds after page refresh.
3. Close Outlook; it must become Not detected after 60 seconds. Reopen it; it must recover after the next heartbeat.
4. Verify sender/subject extraction against several real Outlook emails.

