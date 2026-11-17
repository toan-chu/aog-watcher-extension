import { beforeAll, describe, expect, it } from "vitest";

// Small stand-ins for DOM nodes: enough for the folder reader.
function node({ title = null, label = null, text = "", children = [] } = {}) {
  return {
    getAttribute: (name) => (name === "title" ? title : name === "aria-label" ? label : null),
    textContent: text,
    children,
    querySelectorAll: () => children,
  };
}
const leaf = (text) => node({ text });
const doc = (...items) => ({ querySelectorAll: () => items });

let folder;
beforeAll(async () => {
  await import("../lib/outlook_folder.js");
  folder = globalThis.AOG_OUTLOOK_FOLDER;
});

describe("Outlook AOG folder reader", () => {
  it("watches AOG by default, or the last part of the Outlook watch path", () => {
    expect(folder.targetName({})).toBe("aog");
    expect(folder.targetName({ outlook_watch_path: "/mail/group/trustana.vn/aog/" })).toBe("aog");
    expect(folder.targetName({ outlook_watch_path: "AOG Team" })).toBe("aog team");
  });

  it("reads the unread count from the label, else from the small number next to the name", () => {
    expect(folder.unreadOf(node({ title: "AOG", label: "AOG, 3 unread" }))).toBe(3);
    expect(folder.unreadOf(node({ title: "AOG", children: [leaf("AOG"), leaf("12")] }))).toBe(12);
    expect(folder.unreadOf(node({ title: "AOG", children: [leaf("AOG")] }))).toBe(0);
  });

  it("finds only the AOG folder: DGPac and Inbox counts never count", () => {
    const page = doc(
      node({ title: "Inbox", label: "Inbox, 40 unread" }),
      node({ title: "DGPac", label: "DGPac, 7 unread" }),
      node({ title: "AOG", label: "AOG, 2 unread" }),
    );
    expect(folder.readFolder(page, {})).toEqual({ found: true, count: 2, name: "aog" });
  });

  it("uses the highest count when the folder is also under Favorites", () => {
    const page = doc(node({ title: "AOG", label: "AOG, 1 unread" }), node({ title: "AOG", label: "AOG, 4 unread" }));
    expect(folder.readFolder(page, {}).count).toBe(4);
  });

  it("reads Outlook's real hover text: \"Marketing - 2,133 items (5 unread)\" (checked on live Outlook)", () => {
    const page = doc(
      node({ title: "Inbox - 1,108 items (0 unread)", text: "Inbox" }),
      node({ title: "Marketing - 2,133 items (5 unread)", text: "Marketing5unread", children: [leaf("Marketing"), leaf("5")] }),
      node({ title: "Junk Email - 63 items (61 unread)", text: "Junk Email[63]items" }),
      node({ label: "Go to Groups. Groups - 0 unread (top 5 frequent groups)", text: "Go to Groups" }),
    );
    expect(folder.readFolder(page, { outlook_watch_path: "Marketing" })).toMatchObject({ found: true, count: 5 });
    expect(folder.readFolder(page, { outlook_watch_path: "Junk Email" }).count).toBe(61);   // right even when the total is shown
    expect(folder.readFolder(page, { outlook_watch_path: "Inbox" }).count).toBe(0);
    expect(folder.nodeName(page.querySelectorAll()[3])).toBe("groups");
  });

  it("says not found when the folder list does not show AOG", () => {
    expect(folder.readFolder(doc(node({ title: "Inbox", label: "Inbox, 1 unread" })), {})).toMatchObject({ found: false, count: null, pane: true });
    // narrow window: Outlook removes the whole folder list (seen on live Outlook at 868 px wide)
    expect(folder.readFolder(doc(), {})).toMatchObject({ found: false, pane: false });
  });
});

describe("Outlook source status", () => {
  it("tells a hidden folder list (narrow window) apart from a missing AOG folder", async () => {
    const { evaluateSources } = await import("../lib/blind_detector.js");
    const now = Date.now();
    const run = (gate) => evaluateSources({ outlook: { last_seen: now, stats: { folder_gate: gate, rows_seen: 0 } }, whatsapp: { last_seen: now, stats: { rows_seen: 3 } } }, { now }).sources.outlook;
    expect(run("hidden")).toMatchObject({ status: "wrong_folder" });
    expect(run("hidden").message).toMatch(/window too narrow/);
    expect(run("blocked").message).toMatch(/does not show the AOG group/);
  });
});
