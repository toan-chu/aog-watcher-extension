import { describe, expect, it } from "vitest";
import "../lib/whatsapp_dom.js";

const selectors = {
  chatTitle: ["span[dir='auto'][title]", "span[dir='auto']"],
  conversationHeader: ["#main header span[dir='auto'][title]", "#main header span[dir='auto']"],
};

function element({ title = null, text = "", children = [], id = "", tag = "div", attrs = {} } = {}) {
  const node = {
    nodeType: 1,
    id,
    tag,
    attrs: { ...attrs },
    children,
    parentElement: null,
    textContent: text,
    getAttribute(name) {
      if (name === "title") return title;
      if (name === "id") return id || null;
      return this.attrs[name] ?? null;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    },
    querySelectorAll(selector) {
      return collect(this).filter((candidate) => matches(candidate, selector));
    },
  };
  for (const child of children) child.parentElement = node;
  return node;
}

function spanDirAuto({ title = null, text = "" } = {}) {
  return element({ title, text, tag: "span", attrs: { dir: "auto" } });
}

function collect(root) {
  return [root, ...root.children.flatMap((child) => collect(child))];
}

function matches(node, selector) {
  if (selector === "span[dir='auto'][title]") return node.tag === "span" && node.attrs.dir === "auto" && Boolean(node.getAttribute("title"));
  if (selector === "span[dir='auto']") return node.tag === "span" && node.attrs.dir === "auto";
  if (selector === "#main header span[dir='auto'][title]") return node.tag === "span" && node.attrs.dir === "auto" && Boolean(node.getAttribute("title")) && hasAncestor(node, "header") && hasAncestor(node, "#main");
  if (selector === "#main header span[dir='auto']") return node.tag === "span" && node.attrs.dir === "auto" && hasAncestor(node, "header") && hasAncestor(node, "#main");
  return false;
}

function hasAncestor(node, target) {
  let current = node.parentElement;
  while (current) {
    if (target === "#main" && current.id === "main") return true;
    if (target === current.tag) return true;
    current = current.parentElement;
  }
  return false;
}

describe("WhatsApp DOM helpers", () => {
  it("extracts chat title from span[dir='auto'][title] and ignores broad title elements", () => {
    const row = element({
      children: [
        element({ title: "avatar title" }),
        spanDirAuto({ title: "AOG Coord", text: "AOG Coord" }),
        element({ title: "[AOG-HANDLED] preview" }),
      ],
    });
    expect(globalThis.AOG_WHATSAPP_DOM.chatRowName(row, selectors)).toBe("AOG Coord");
  });

  it("reads active conversation name from #main header", () => {
    const root = element({ children: [element({ id: "main", children: [element({ tag: "header", children: [spanDirAuto({ title: "AOG Coord", text: "AOG Coord" })] })] })] });
    expect(globalThis.AOG_WHATSAPP_DOM.activeConversationName(root, selectors)).toBe("AOG Coord");
  });

  it("normalizes names before comparing active group", () => {
    expect(globalThis.AOG_WHATSAPP_DOM.isSameGroupName(" AOG   Coord ", "aog coord")).toBe(true);
  });
});
