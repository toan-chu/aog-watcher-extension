import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

const content = await readFile(new URL("../content_whatsapp.js", import.meta.url), "utf8");

function whatsappHarness() {
  let messageHandler = null;
  let deleteCount = 0;
  const search = { focus() {}, blur() {}, dispatchEvent() {} };
  const selectors = {
    chatRows: ["rows"], chatTitle: ["title"], composer: ["composer"], conversationHeader: ["header"],
    messageText: ["messages"], searchBox: ["search"], sendButton: ["send"], unread: ["unread"],
  };
  const runtime = {
    addRuntimeMessageListener(handler) { messageHandler = handler; },
    addStorageChangedListener() {},
    safeSendMessage: async (message) => message.type === "BASELINE_SYNC" ? { baseline: { whatsapp_unread: {} } } : {},
    safeStorageGet: async () => ({ aog_config: { coord_group: "AOG Coord" }, aog_team_groups: [] }),
    setSafeInterval() {},
  };
  const dom = {
    activeConversationName: () => "Wrong chat",
    all: () => [],
    chatRowName: () => "",
    draftDecision: () => ({ ok: true, shouldDraft: false }),
    first: (_root, selectorList) => selectorList === selectors.searchBox ? search : null,
    isSameGroupName: (left, right) => String(left).trim().toLowerCase() === String(right).trim().toLowerCase(),
    normalized: (value) => String(value ?? "").trim().toLowerCase(),
  };
  const document = {
    documentElement: {},
    execCommand(command) { if (command === "delete") deleteCount += 1; return true; },
  };
  class EventStub { constructor(type, init) { this.type = type; Object.assign(this, init); } }
  class MutationObserverStub { observe() {} }

  runInNewContext(content, {
    console, Date, Map, Set, Promise,
    AOG_CONTENT_RUNTIME: runtime,
    AOG_WHATSAPP_DOM: dom,
    AOG_WHATSAPP_SELECTORS: selectors,
    InputEvent: EventStub,
    KeyboardEvent: EventStub,
    MutationObserver: MutationObserverStub,
    clearTimeout,
    document,
    setTimeout,
  });

  return {
    get deleteCount() { return deleteCount; },
    send(message) { return new Promise((resolve) => messageHandler(message, {}, resolve)); },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("V5-06 WhatsApp navigation cleanup", () => {
  it.each([
    ["customer chat", { type: "OPEN_WHATSAPP_CHAT", chat_name: "Missing customer", draft_text: "Hello" }],
    ["coordination tag", { type: "SEND_PEER_TAG", text: "[AOG-HANDLED] missing" }],
  ])("clears search after a timed-out %s", async (_label, message) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T15:00:00+07:00"));
    const harness = whatsappHarness();
    const responsePromise = harness.send(message);

    await vi.advanceTimersByTimeAsync(7_000);

    await expect(responsePromise).resolves.toMatchObject({ ok: false, error: expect.stringContaining("Timed out") });
    expect(harness.deleteCount).toBe(2);
  });

  it("returns a missing-chat timeout within four seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T15:00:00+07:00"));
    const harness = whatsappHarness();
    const response = vi.fn();
    harness.send({ type: "OPEN_WHATSAPP_CHAT", chat_name: "Missing customer", draft_text: "Hello" }).then(response);

    await vi.advanceTimersByTimeAsync(4_000);

    expect(response).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error: expect.stringContaining("Timed out") }));
  });
});
