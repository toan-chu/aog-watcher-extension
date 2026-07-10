import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG, STORAGE_KEYS } from "../lib/constants.js";
import { endShiftSession, getShiftSessions, startShiftSession } from "../lib/storage.js";

const data = {};

beforeEach(() => {
  for (const key of Object.keys(data)) delete data[key];
  globalThis.chrome = {
    storage: {
      local: {
        get: vi.fn(async (key) => ({ [key]: data[key] })),
        set: vi.fn(async (value) => Object.assign(data, value)),
      },
    },
  };
});

describe("shift session storage", () => {
  it("starts and stores a shift session with config snapshot", async () => {
    const session = await startShiftSession({ role: "primary", config: { ...DEFAULT_CONFIG, self_display_name: "Toan", partner_display_name: "Sam", coord_group: "Coord" }, now: new Date("2026-06-23T10:00:00Z") });
    expect(session).toMatchObject({ operator_name: "Toan", partner_name: "Sam", role: "primary", ended_at: null });
    expect(data[STORAGE_KEYS.SHIFT_SESSIONS]).toHaveLength(1);
    expect((await getShiftSessions())[0].config_snapshot.coord_group).toBe("Coord");
  });

  it("ends the matching shift session", async () => {
    const session = await startShiftSession({ role: "backup", config: DEFAULT_CONFIG, now: new Date("2026-06-23T10:00:00Z") });
    const ended = await endShiftSession(session.shift_id, "2026-06-23T11:00:00.000Z");
    expect(ended.ended_at).toBe("2026-06-23T11:00:00.000Z");
  });
});
