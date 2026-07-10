(() => {
  const STABLE_ID_ATTRIBUTES = [
    "data-convid",
    "data-item-id",
    "data-itemid",
    "data-conversation-id",
    "data-message-id",
  ];

  function normalizePart(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function findStableOutlookId(row) {
    let node = row;
    while (node && node.nodeType === 1) {
      for (const attribute of STABLE_ID_ATTRIBUTES) {
        const value = node.getAttribute?.(attribute);
        if (value) return value;
      }
      node = node.parentElement;
    }
    return "";
  }

  function stableOutlookMessageId(row, sender, subject) {
    const direct = findStableOutlookId(row);
    if (direct) return direct;
    const senderKey = normalizePart(sender);
    const subjectKey = normalizePart(subject);
    const rowTextKey = normalizePart(row?.textContent).slice(0, 500);
    if (!senderKey && !subjectKey && !rowTextKey) return "";
    return `email|${senderKey}|${subjectKey}|${rowTextKey}`;
  }

  globalThis.AOG_OUTLOOK_MESSAGE_ID = Object.freeze({
    stableOutlookMessageId,
  });
})();
