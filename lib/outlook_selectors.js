// Outlook cloud (outlook.cloud.microsoft) uses obfuscated class names (XG5Jd, TszOG, TtcXM, etc.)
// that change between builds, so we anchor on stable attributes: title, aria-label, role, and DOM shape.
// Each message row contains a "Mark as unread" or "Mark as read" toggle button — we use that to detect unread state.
globalThis.AOG_OUTLOOK_SELECTORS = Object.freeze({
  app: ["[role='main']", "#app"],
  // Row anchor: a div that contains BOTH an avatar (with role='img' and aria-label of sender)
  // AND a "Mark as unread" / "Mark as read" button. We query by descendant button, then walk up.
  // Provide several fallbacks for legacy Outlook variants.
  messageRows: [
    "div:has(> div > div > div[role='checkbox'][aria-label='Select a conversation'])",
    "[role='main'] [role='option']",
    "[role='main'] [role='listitem']",
    "[role='main'] button[aria-label*='Mark as read' i]",
    "[role='main'] [data-convid]",
  ],
  // A row is UNREAD when its toggle button shows "Mark as read" (already-read rows show "Mark as unread").
  // We also keep legacy fallbacks.
  unreadRow: [
    "button[aria-label='Mark as read']",
    "[aria-label*='Unread' i]",
    "[data-is-unread='true']",
  ],
  // Sender: span with title containing '@' (email address).
  sender: [
    "span[title*='@']",
    "[role='img'][aria-label]",
    "[data-testid='sender-name']",
  ],
  // Subject: in Outlook cloud the subject lives in a span with no stable class.
  // We anchor on its position: inside a div sibling of sender, before the date span (which has title with day-of-week).
  // Fallback to legacy attributes.
  subject: [
    "[data-testid='message-subject']",
    "span[role='heading']",
  ],
});
