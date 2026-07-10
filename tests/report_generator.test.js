import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { alertDetailRows, buildAnalyticsWorkbook, generateHrPayrollCsv, hourHeatmapRows, hotListRows, reportFilename } from "../lib/report_generator.js";

const sessions = [{
  shift_id: "shift-1",
  operator_name: "Toan",
  partner_name: "Sam",
  role: "primary",
  started_at: "2026-06-22T22:00:00.000Z",
  ended_at: "2026-06-23T03:00:00.000Z",
}];

const events = [
  { timestamp: "2026-06-22T22:10:00.000Z", event_type: "DETECTED", alert_id: "a", shift_id: "shift-1", operator_name: "Toan", source: "whatsapp", group_name: "Airline A", sender: "Toan Chu", subject: "AOG test" },
  { timestamp: "2026-06-22T22:10:42.000Z", event_type: "ACK", alert_id: "a", shift_id: "shift-1", operator_name: "Toan", source: "whatsapp", group_name: "Airline A", sender: "Toan Chu", subject: "AOG test", handled_by: "self", response_time_ms: 42000 },
  { timestamp: "2026-06-22T23:00:00.000Z", event_type: "MISSED", alert_id: "b", shift_id: "shift-1", operator_name: "Toan", source: "email", sender: "ops@example.com", subject: "AOG email", handled_by: "missed" },
];

describe("report generator", () => {
  it("generates HR payroll CSV with UTF-8 BOM and shift totals", () => {
    const csv = generateHrPayrollCsv(events, sessions, { generatedAt: new Date("2026-06-23T04:40:25.000Z") });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("# AOG Watcher payroll report");
    expect(csv).toContain("# Generated at: 2026-06-23T11:40:25+07:00");
    expect(csv).toContain("shift_id,operator,partner,role");
    expect(csv).toContain("shift-1,Toan,Sam,primary");
    expect(csv).toContain(",1,1,1,42.0");
  });

  it("generates alert detail response time seconds", () => {
    expect(alertDetailRows(events).find((row) => row.handled_by === "self").response_time_seconds).toBe(42);
  });

  it("keeps ACK context fields in alert detail rows", () => {
    expect(alertDetailRows(events).find((row) => row.handled_by === "self")).toMatchObject({
      group_name: "Airline A",
      sender: "Toan Chu",
      subject: "AOG test",
    });
  });

  it("generates hour heatmap and hot list rows", () => {
    const localHour = String(new Date(events[0].timestamp).getHours()).padStart(2, "0");
    expect(hourHeatmapRows(events).find((row) => row.hour_of_day === localHour).alert_count).toBe(1);
    expect(hotListRows(events)[0]).toMatchObject({ name: "Airline A", alert_count: 1 });
  });

  it("builds analytics XLSX workbook with report info first", () => {
    const workbook = buildAnalyticsWorkbook(events, sessions, XLSX, { fromDate: "2026-06-01", toDate: "2026-06-23", generatedAt: new Date("2026-06-23T04:40:25.000Z") });
    expect(workbook.SheetNames).toEqual(["Report Info", "Shift Summary", "Alert Detail", "Hour Heatmap", "Group Sender Hot list"]);
    expect(workbook.Sheets["Report Info"].A1.v).toBe("field");
    expect(workbook.Sheets["Report Info"].A2.v).toBe("Generated at");
    expect(workbook.Sheets["Report Info"].B2.v).toBe("2026-06-23T11:40:25+07:00");
    expect(workbook.Sheets["Shift Summary"].A1.s.font.bold).toBe(true);
    expect(workbook.Sheets["Shift Summary"]["!freeze"]).toMatchObject({ ySplit: 1 });
  });

  it("marks open shifts as in progress in HR output", () => {
    const csv = generateHrPayrollCsv([], [{ ...sessions[0], ended_at: null }], { generatedAt: new Date("2026-06-23T04:40:25.000Z") });
    expect(csv).toContain("(in progress)");
  });

  it("puts the column header after metadata comments", () => {
    const csv = generateHrPayrollCsv([], sessions, { generatedAt: new Date("2026-06-23T04:40:25.000Z") });
    const firstTableLine = csv.replace(/^\uFEFF/, "").split(/\r?\n/).find((line) => line && !line.startsWith("#"));
    expect(firstTableLine).toBe("shift_id,operator,partner,role,shift_start,shift_end,duration_hours,alerts_received,alerts_acked_by_self,alerts_missed,avg_response_time_seconds");
  });

  it("generates report filenames with local timestamp", () => {
    expect(reportFilename("hr", "2026-06-01", "2026-06-23", new Date("2026-06-23T04:40:25.000Z"))).toBe("aog-hr-payroll-20260601-20260623-202606231140.csv");
    expect(reportFilename("analytics", "2026-06-01", "2026-06-23", new Date("2026-06-23T04:40:25.000Z"))).toBe("aog-analytics-20260601-20260623-202606231140.xlsx");
  });
});
