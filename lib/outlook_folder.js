// 5.2: Outlook is watched through the unread count of ONE folder in Outlook's folder list (the AOG group).
// Mail sent to or copied to the AOG group lands in that folder, so other mailboxes (DGPac, Inbox) never ring.
// When the list redraws or scrolls, the count does not change: only a real new email makes it go up.
(function (root) {
  const normalized = (value) => String(value ?? "").trim().toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // The folder to watch: the last part of the per-machine "Outlook watch path" setting, else "AOG".
  function targetName(config = {}) {
    const path = String(config.outlook_watch_path ?? "").trim().replace(/\/+$/, "");
    const last = path.split("/").filter(Boolean).at(-1) ?? "";
    let name = last;
    try { name = decodeURIComponent(last); } catch { /* keep as typed */ }
    return normalized(name) || "aog";
  }

  // Outlook's own hover text on a folder is "Marketing - 2,133 items (5 unread)"; group entries read
  // like "AOG - 3 unread" in their label. The name is the part before " - <number>".
  const DETAIL = /\s+-\s+[\d.,]+\s*(items?|unread).*$/i;

  function nodeName(node) {
    const title = String(node.getAttribute?.("title") ?? "").trim();
    if (title) return normalized(title.replace(DETAIL, ""));
    const label = String(node.getAttribute?.("aria-label") ?? "").trim();
    if (label) return normalized(label.split(/\.\s+/).at(-1).replace(DETAIL, "").replace(/,\s*\d+\s*unread.*$/i, ""));
    return normalized(String(node.textContent ?? "").replace(/\d+\s*unread$/i, "").replace(/\d+$/, ""));
  }

  // Unread count of a folder entry: "(5 unread)" in the hover text or label (this stays right even
  // when the folder is set to show its total), else the small number next to the name, else 0.
  function unreadOf(node) {
    const text = `${node.getAttribute?.("title") ?? ""} ${node.getAttribute?.("aria-label") ?? ""}`;
    const stated = text.match(/([\d.,]+)\s*(?:unread|ch\u01b0a \u0111\u1ecdc|chua doc)/i);
    if (stated) return Number(stated[1].replace(/[.,]/g, ""));
    const numbers = [...(node.querySelectorAll?.("span, div") ?? [])]
      .filter((child) => !child.children?.length)
      .map((child) => String(child.textContent ?? "").trim())
      .filter((part) => /^\d{1,5}$/.test(part));
    return numbers.length ? Number(numbers.at(-1)) : 0;
  }

  // All folder entries named like the target (the same folder can also appear under Favorites).
  // Returns { found, count }: the highest count among them, so a stale copy never hides new mail.
  function readFolder(doc, config = {}) {
    const want = targetName(config);
    const all = [...(doc.querySelectorAll?.("[role='treeitem']") ?? [])];
    const nodes = all.filter((node) => nodeName(node) === want);
    // No folder list at all: Outlook hides it when its window is narrow (for example with the side panel open).
    if (!nodes.length) return { found: false, count: null, name: want, pane: all.length > 0 };
    return { found: true, count: Math.max(...nodes.map(unreadOf)), name: want };
  }

  // The entry to click when the operator accepts an email alert.
  function folderNode(doc, config = {}) {
    const want = targetName(config);
    return [...(doc.querySelectorAll?.("[role='treeitem']") ?? [])].find((node) => nodeName(node) === want) ?? null;
  }

  root.AOG_OUTLOOK_FOLDER = Object.freeze({ targetName, nodeName, unreadOf, readFolder, folderNode });
})(globalThis);
