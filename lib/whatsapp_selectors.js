globalThis.AOG_WHATSAPP_SELECTORS = Object.freeze({
  app: ["#app", "[data-testid='app']"],
  chatRows: ["#pane-side [role='row']", "#pane-side [role='listitem']"],
  chatTitle: ["span[dir='auto'][title]", "span[dir='auto']"],
  conversationHeader: [
    // WhatsApp Web 2026: conversation title is a `span[dir='auto']` WITHOUT title attribute.
    // `span[title]` in header refers to the member list, not the group name — skip it.
    "#main header span[dir='auto']:not([title])",
    "#main header span[dir='auto']",
  ],
  unread: ["[aria-label*='unread' i]", "[data-testid='icon-unread-count']", "span[aria-label]"],
  messageText: ["#main [data-pre-plain-text] span.selectable-text", "#main [role='row'] span.selectable-text"],
  composer: ["#main footer [contenteditable='true'][role='textbox']", "footer div[contenteditable='true']"],
  sendButton: ["#main footer button[aria-label*='Send' i]", "#main footer [data-testid='send']", "#main footer span[data-icon='send']"],
  // The search box label follows the WhatsApp language ("Search…", "Tìm kiếm…"), so language-free
  // fallbacks follow: the editable box or text input at the top of the chat list (#side).
  searchBox: [
    "[role='textbox'][aria-label*='Search' i]",
    "[role='textbox'][aria-label*='Tìm' i]",
    "input[aria-label*='Search' i]",
    "input[aria-label*='Tìm' i]",
    "[contenteditable='true'][data-tab='3']",
    "#side [contenteditable='true'][role='textbox']",
    "#side input[type='text']",
  ],
});
