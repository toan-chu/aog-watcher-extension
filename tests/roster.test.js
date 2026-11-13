import { describe, expect, it } from "vitest";
import { myNight, parseRosterTime, rosterName, rosterRoleAt, serializeNight, hydrateNight } from "../lib/roster.js";

const rows = [
  { Title: "Julia", Email: "julia.trang@trustana.vn", Start: "2026-11-13 22:00", End: "2026-11-14 02:30" },
  { Title: "Ethan", Email: "ethan.hieu@trustana.vn", Start: "2026-11-14 02:30", End: "2026-11-14 07:00" },
  { Title: "Ryan", Email: "ryan.toan@trustana.vn", Start: "2026-11-14 22:00", End: "2026-11-15 07:00" },
  { Title: "Broken", Email: "x@trustana.vn", Start: "13/11 22h", End: "" },
];
const at = (text) => parseRosterTime(text);

describe("roster times", () => {
  it("reads date and 24-hour time", () => {
    expect(at("2026-11-14 02:30")).toEqual(new Date(2026, 10, 14, 2, 30));
    expect(at("2026-11-14T2:30")).toEqual(new Date(2026, 10, 14, 2, 30));
    expect(at("2026-11-14 02:30:00")).toEqual(new Date(2026, 10, 14, 2, 30));
    expect(at("13/11 22h")).toBeNull();
    expect(at("")).toBeNull();
  });
});

describe("one night, two people across midnight", () => {
  it("Julia is Primary 22:00-02:30 and Backup 02:30-07:00", () => {
    const night = myNight(rows, "julia.trang@trustana.vn", at("2026-11-13 23:00"));
    expect(rosterRoleAt(night, "julia.trang@trustana.vn", at("2026-11-13 23:00")).role).toBe("primary");
    expect(rosterRoleAt(night, "julia.trang@trustana.vn", at("2026-11-14 03:00")).role).toBe("backup");
    expect(rosterRoleAt(night, "julia.trang@trustana.vn", at("2026-11-14 07:00")).role).toBe("off");
  });

  it("Ethan is Backup before 02:30 and Primary after", () => {
    const night = myNight(rows, "Ethan.Hieu@trustana.vn", at("2026-11-13 23:00"));
    expect(rosterRoleAt(night, "ethan.hieu@trustana.vn", at("2026-11-13 23:00"))).toMatchObject({ role: "backup", window: { name: "Julia" } });
    expect(rosterRoleAt(night, "ethan.hieu@trustana.vn", at("2026-11-14 02:30")).role).toBe("primary");
    expect(rosterName(night, "ethan.hieu@trustana.vn")).toBe("Ethan");
  });

  it("Ryan's night is separate and silent tonight", () => {
    const night = myNight(rows, "ryan.toan@trustana.vn", at("2026-11-13 23:00"));
    expect(night.start).toEqual(at("2026-11-14 22:00"));
    expect(rosterRoleAt(night, "ryan.toan@trustana.vn", at("2026-11-13 23:00")).role).toBe("off");
    const julias = myNight(rows, "julia.trang@trustana.vn", at("2026-11-13 23:00"));
    expect(julias.windows.map((window) => window.name)).toEqual(["Julia", "Ethan"]);
  });

  it("someone not on the roster has no night", () => {
    expect(myNight(rows, "monica.hoai@trustana.vn", at("2026-11-13 23:00"))).toBeNull();
    expect(rosterRoleAt(null, "monica.hoai@trustana.vn", at("2026-11-13 23:00")).role).toBe("off");
  });

  it("survives storage", () => {
    const night = myNight(rows, "julia.trang@trustana.vn", at("2026-11-13 23:00"));
    const back = hydrateNight(JSON.parse(JSON.stringify(serializeNight(night))));
    expect(rosterRoleAt(back, "julia.trang@trustana.vn", at("2026-11-14 03:00")).role).toBe("backup");
  });
});
