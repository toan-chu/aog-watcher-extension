(() => {
  function normalized(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
  }

  function first(root, selectorList) {
    return selectorList.map((selector) => root.querySelector(selector)).find(Boolean) ?? null;
  }

  function all(root, selectorList) {
    return [...new Set(selectorList.flatMap((selector) => [...root.querySelectorAll(selector)]))];
  }

  function usefulTitle(element) {
    const title = element.getAttribute?.("title")?.trim();
    if (!title || title.length > 200) return "";
    return title;
  }

  function chatRowName(row, selectors) {
    for (const element of all(row, selectors.chatTitle)) {
      const title = usefulTitle(element);
      if (title) return title;
      const text = element.textContent?.trim();
      if (text && text.length <= 200) return text;
    }
    return "";
  }

  function activeConversationName(root, selectors) {
    for (const element of all(root, selectors.conversationHeader)) {
      const title = usefulTitle(element);
      if (title) return title;
      const text = element.textContent?.trim();
      if (text && text.length <= 200 && text.length >= 2) return text;
    }
    // Fallback: scan #main header for any span/div with non-empty short text.
    const header = root.querySelector?.("#main header");
    if (header) {
      for (const element of [...header.querySelectorAll("span, div")]) {
        const text = element.textContent?.trim();
        if (text && text.length >= 2 && text.length <= 100 && !text.includes("\n") && element.children.length === 0) {
          return text;
        }
      }
    }
    return "";
  }

  function isSameGroupName(left, right) {
    return Boolean(normalized(left)) && normalized(left) === normalized(right);
  }

  globalThis.AOG_WHATSAPP_DOM = Object.freeze({
    activeConversationName,
    chatRowName,
    first,
    all,
    isSameGroupName,
    normalized,
  });
})();
