import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

const content = await readFile(new URL("../content_whatsapp.js", import.meta.url), "utf8");

function harness() {
  let rows = [{ name: "AOG ONE", unread: 0 }, { name: "AOG TWO", unread: 2 }];
  let activeChat = "AOG ONE";
  let focused = false;
  let visibilityState = "visible";
  let mutation = null;
  const sent = [];
  const selectors = {
    chatRows: ["rows"], chatTitle: ["title"], composer: ["composer"], conversationHeader: ["header"],
    messageText: ["messages"], searchBox: ["search"], sendButton: ["send"], unread: ["unread"],
  };
  const runtime = {
    addRuntimeMessageListener() {},
    addStorageChangedListener() {},
    async safeSendMessage(message) {
      sent.push(message);
      return message.type === "BASELINE_SYNC" ? { baseline: { whatsapp_unread: { "AOG TWO": 2 } } } : {};
    },
    async safeStorageGet() { return { aog_config: { customer_groups: ["AOG ONE", "AOG TWO"] }, aog_team_groups: [] }; },
    setSafeInterval() {},
  };
  const dom = {
    activeConversationName: () => activeChat,
    all: (_root, selectorList) => selectorList === selectors.chatRows ? rows : [],
    chatRowName: (row) => row.name,
    draftDecision: () => ({ ok: true, shouldDraft: false }),
    first: (row, selectorList) => selectorList === selectors.unread && row?.unread > 0
      ? { getAttribute: () => `${row.unread} unread messages`, textContent: String(row.unread) }
      : null,
    isSameGroupName: (left, right) => String(left).trim().toLowerCase() === String(right).trim().toLowerCase(),
    normalized: (value) => String(value ?? "").trim().toLowerCase(),
  };
  class MutationObserverStub { constructor(callback) { mutation = callback; } observe() {} }
  class EventStub { constructor(type, init) { this.type = type; Object.assign(this, init); } }
  runInNewContext(content, {
    console, Date, Map, Set, Promise,
    AOG_CONTENT_RUNTIME: runtime,
    AOG_WHATSAPP_DOM: dom,
    AOG_WHATSAPP_SELECTORS: selectors,
    InputEvent: EventStub,
    KeyboardEvent: EventStub,
    MutationObserver: MutationObserverStub,
    clearTimeout,
    document: { documentElement: {}, execCommand: () => true, hasFocus: () => focused, get visibilityState() { return visibilityState; } },
    setTimeout,
  });
  return {
    sent,
    setRows(value) { rows = value; },
    setActive(value) { activeChat = value; },
    setFocused(value) { focused = value; },
    setVisibility(value) { visibilityState = value; },
    mutate() { mutation?.(); },
  };
}

afterEach(() => vi.useRealTimers());

describe("V5-07 WhatsApp read evidence", () => {
  it("does not turn baseline unread rows into new alerts", async () => {
    vi.useFakeTimers();
    const page = harness();
    await vi.runAllTimersAsync();
    expect(page.sent.filter((message) => message.type === "ALERT_DETECTED")).toEqual([]);
  });

  it("requires two consecutive zero-unread scans before reporting a visible row as read", async () => {
    vi.useFakeTimers();
    const page = harness();
    await vi.runAllTimersAsync();
    const observations = page.sent.filter((message) => message.type === "WHATSAPP_READ_OBSERVED");
    expect(observations[0]).toEqual({
      type: "WHATSAPP_READ_OBSERVED", focused_active_chat: "", visible_read_chats: [],
    });
    expect(observations.at(-1)).toEqual({
      type: "WHATSAPP_READ_OBSERVED", focused_active_chat: "", visible_read_chats: ["AOG ONE"],
    });
  });

  it("reports the active chat only while WhatsApp is focused and visible", async () => {
    vi.useFakeTimers();
    const page = harness();
    page.setFocused(true);
    await vi.runAllTimersAsync();
    expect(page.sent.filter((message) => message.type === "WHATSAPP_READ_OBSERVED").at(-1).focused_active_chat).toBe("AOG ONE");

    page.setVisibility("hidden");
    page.mutate();
    await vi.runAllTimersAsync();
    expect(page.sent.filter((message) => message.type === "WHATSAPP_READ_OBSERVED").at(-1).focused_active_chat).toBe("");
  });

  it("does not report a chat after its row disappears", async () => {
    vi.useFakeTimers();
    const page = harness();
    await vi.runAllTimersAsync();
    page.setRows([{ name: "AOG TWO", unread: 2 }]);
    page.setActive("");
    page.mutate();
    await vi.runAllTimersAsync();
    const observed = page.sent.filter((message) => message.type === "WHATSAPP_READ_OBSERVED").at(-1);
    expect(observed).toEqual({ type: "WHATSAPP_READ_OBSERVED", focused_active_chat: "", visible_read_chats: [] });
  });
});
