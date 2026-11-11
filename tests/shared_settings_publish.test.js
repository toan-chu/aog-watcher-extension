import { describe, expect, it } from "vitest";
import { publishSharedSettings, SHARED_KEYS } from "../lib/shared_settings.js";

function fakeClient(existing = []) {
  const calls = [];
  return {
    calls,
    items: async () => existing,
    updateItem: async (list, id, fields) => { calls.push({ op: "update", id, fields }); },
    addItem: async (list, fields) => { calls.push({ op: "add", fields }); },
  };
}

describe("publishSharedSettings", () => {
  const config = { coord_group: "AOG Coord", primary_timeout_seconds: 90, log_keep_days: 90 };

  it("writes only the requested keys", async () => {
    const client = fakeClient([{ Id: 7, Title: "primary_timeout_seconds" }]);
    const written = await publishSharedSettings(client, config, { by: "Ryan", keys: ["primary_timeout_seconds"] });
    expect(written).toBe(1);
    expect(client.calls).toEqual([{ op: "update", id: 7, fields: expect.objectContaining({ Title: "primary_timeout_seconds", Value: "90", UpdatedBy: "Ryan" }) }]);
  });

  it("ignores keys that are not shared", async () => {
    const client = fakeClient();
    const written = await publishSharedSettings(client, { ...config, self_display_name: "Ryan" }, { keys: ["self_display_name"] });
    expect(written).toBe(0);
    expect(client.calls).toEqual([]);
  });

  it("still writes every shared key that has a value when no key list is given", async () => {
    const client = fakeClient();
    const written = await publishSharedSettings(client, config);
    expect(written).toBe(Object.keys(config).filter((key) => SHARED_KEYS.includes(key)).length);
  });
});
