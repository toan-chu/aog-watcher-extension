import { describe, expect, it } from "vitest";
import { deterministicAlertId, md5 } from "../lib/hash.js";

describe("hash", () => {
  it.each([["", "d41d8cd98f00b204e9800998ecf8427e"], ["a", "0cc175b9c0f1b6a831c399e269772661"], ["abc", "900150983cd24fb0d6963f7d28e17f72"]])("matches RFC vector %s", (input, output) => expect(md5(input)).toBe(output));
  it("creates deterministic email IDs", () => expect(deterministicAlertId({ source: "email", message_id: "x" })).toBe(deterministicAlertId({ source: "email", message_id: "x" })));
  it("creates different IDs for different messages", () => expect(deterministicAlertId({ source: "email", message_id: "x" })).not.toBe(deterministicAlertId({ source: "email", message_id: "y" })));
});

