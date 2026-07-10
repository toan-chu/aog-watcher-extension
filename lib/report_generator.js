const HR_COLUMNS = [
  "shift_id",
  "operator",
  "partner",
  "role",
  "shift_start",
  "shift_end",
  "duration_hours",
  "alerts_received",
  "alerts_acked_by_self",
  "alerts_missed",
  "avg_response_time_seconds",
];

const DETAIL_COLUMNS = ["timestamp", "shift_id", "operator", "source", "group_name", "sender", "subject", "handled_by", "response_time_seconds"];
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const DEFAULT_WIDTHS = {
  timestamp: 22,
  shift_id: 28,
  operator: 18,
  partner: 18,
  role: 12,
  shift_start: 22,
  shift_end: 22,
  source: 12,
  group_name: 28,
  sender: 28,
  subject: 40,
  handled_by: 14,
  duration_hours: 14,
  avg_response_time_seconds: 24,
  response_time_seconds: 22,
  alert_count: 12,
  name: 32,
};
const HEADER_STYLE = { font: { bold: true }, fill: { fgColor: { rgb: "F2F2F2" } } };
const MISSED_STYLE = { fill: { fgColor: { rgb: "FCE4E4" } } };
const HEAT_STYLE = { fill: { fgColor: { rgb: "D9EAF7" } } };

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatNumber(value, digits) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "";
}

function seconds(ms, format = false) {
  if (ms == null) return "";
  const value = Math.round((Number(ms) / 1000) * 10) / 10;
  return format ? formatNumber(value, 1) : value;
}

function hoursBetween(start, end, generatedAt = new Date()) {
  if (!start) return "";
  const startMs = new Date(start).getTime();
  const endMs = new Date(end ?? generatedAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return "";
  return Math.round(((endMs - startMs) / 36e5) * 100) / 100;
}

function dateParts(value, options = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: options.seconds === false ? undefined : "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function formatVietnamDateTime(value) {
  const parts = dateParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}` : "";
}

export function formatVietnamIsoOffset(value) {
  const parts = dateParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+07:00` : "";
}

function compactDate(value) {
  if (!value) return "";
  return String(value).replaceAll("-", "");
}

function compactMinute(value) {
  const parts = dateParts(value, { seconds: false });
  return parts ? `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}` : "";
}

export function currentMonthRange(now = new Date()) {
  const parts = dateParts(now, { seconds: false });
  if (!parts) return { from: "", to: "" };
  return { from: `${parts.year}-${parts.month}-01`, to: `${parts.year}-${parts.month}-${parts.day}` };
}

export function reportFilename(kind, fromDate, toDate, generatedAt = new Date()) {
  const extension = kind === "analytics" ? "xlsx" : "csv";
  const prefix = kind === "analytics" ? "aog-analytics" : "aog-hr-payroll";
  return `${prefix}-${compactDate(fromDate)}-${compactDate(toDate)}-${compactMinute(generatedAt)}.${extension}`;
}

function eventsForShift(events, shiftId) {
  return events.filter((event) => event.shift_id === shiftId);
}

function summarizeShift(session, events, options = {}) {
  const generatedAt = options.generatedAt ?? new Date();
  const shiftEvents = eventsForShift(events, session.shift_id);
  const detections = shiftEvents.filter((event) => event.event_type === "DETECTED");
  const selfAcks = shiftEvents.filter((event) => event.event_type === "ACK" && event.handled_by === "self");
  const missed = shiftEvents.filter((event) => event.event_type === "MISSED" || event.handled_by === "missed");
  const responseTimes = selfAcks.map((event) => Number(event.response_time_ms)).filter(Number.isFinite);
  const avg = responseTimes.length ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length : null;
  const shiftStart = options.localDates ? formatVietnamDateTime(session.started_at) : session.started_at;
  const shiftEnd = session.ended_at && options.localDates ? formatVietnamDateTime(session.ended_at) : (session.ended_at ?? "(in progress)");
  return {
    shift_id: session.shift_id,
    operator: session.operator_name,
    partner: session.partner_name,
    role: session.role,
    shift_start: shiftStart,
    shift_end: shiftEnd,
    duration_hours: options.formattedNumbers ? formatNumber(hoursBetween(session.started_at, session.ended_at, generatedAt), 2) : hoursBetween(session.started_at, session.ended_at, generatedAt),
    alerts_received: detections.length,
    alerts_acked_by_self: selfAcks.length,
    alerts_missed: missed.length,
    avg_response_time_seconds: seconds(avg, options.formattedNumbers),
  };
}

export function shiftSummaryRows(events, sessions, options = {}) {
  return sessions.map((session) => summarizeShift(session, events, options));
}

export function generateHrPayrollCsv(events, sessions, options = {}) {
  const generatedAt = options.generatedAt ?? new Date();
  const rows = shiftSummaryRows(events, sessions, { generatedAt, localDates: true, formattedNumbers: true });
  const table = [HR_COLUMNS, ...rows.map((row) => HR_COLUMNS.map((column) => row[column]))];
  const metadata = [
    "# AOG Watcher payroll report",
    `# Generated at: ${formatVietnamIsoOffset(generatedAt)}`,
    "# Open shifts use snapshot duration at generation time.",
  ];
  return `\uFEFF${[...metadata, ...table.map((row) => row.map(csvCell).join(","))].join("\r\n")}`;
}

export function alertDetailRows(events) {
  return events
    .filter((event) => ["DETECTED", "ACK", "PEER_HANDLED", "MISSED"].includes(event.event_type))
    .map((event) => ({
      timestamp: formatVietnamDateTime(event.timestamp),
      shift_id: event.shift_id,
      operator: event.operator_name,
      source: event.source,
      group_name: event.group_name,
      sender: event.sender,
      subject: event.subject,
      handled_by: event.handled_by,
      response_time_seconds: seconds(event.response_time_ms),
    }));
}

export function hourHeatmapRows(events) {
  const counts = new Map(Array.from({ length: 24 }, (_, hour) => [String(hour).padStart(2, "0"), 0]));
  for (const event of events.filter((item) => item.event_type === "DETECTED")) {
    const date = new Date(event.timestamp);
    if (Number.isFinite(date.getTime())) {
      const hour = String(date.getHours()).padStart(2, "0");
      counts.set(hour, (counts.get(hour) ?? 0) + 1);
    }
  }
  return [...counts].map(([hour_of_day, alert_count]) => ({ hour_of_day, alert_count }));
}

export function hotListRows(events) {
  const counts = new Map();
  for (const event of events.filter((item) => item.event_type === "DETECTED")) {
    const key = event.group_name || event.sender || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([name, alert_count]) => ({ name, alert_count }));
}

function reportInfoRows(events, sessions, options = {}) {
  const generatedAt = options.generatedAt ?? new Date();
  const openShifts = sessions.filter((session) => !session.ended_at).length;
  const rangeText = options.fromDate || options.toDate ? `${options.fromDate || ""} to ${options.toDate || ""}` : "All records";
  return [
    { field: "Generated at", value: formatVietnamIsoOffset(generatedAt) },
    { field: "Date range", value: rangeText },
    { field: "Total events", value: events.length },
    { field: "Total shifts", value: sessions.length },
    { field: "Open shifts", value: openShifts },
    { field: "Note", value: "Open shifts use snapshot duration computed at generation time." },
  ];
}

function range(n) {
  return Array.from({ length: n }, (_, index) => index);
}

function styleWorksheet(xlsx, sheet, columns, options = {}) {
  const ref = sheet["!ref"];
  if (!ref || !columns.length) return sheet;
  const decoded = xlsx?.utils?.decode_range ? xlsx.utils.decode_range(ref) : null;
  sheet["!cols"] = columns.map((column) => ({ wch: DEFAULT_WIDTHS[column] ?? Math.min(Math.max(String(column).length + 4, 12), 42) }));
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  for (const columnIndex of range(columns.length)) {
    const address = xlsx.utils.encode_cell({ r: 0, c: columnIndex });
    if (sheet[address]) sheet[address].s = HEADER_STYLE;
  }
  if (!decoded) return sheet;
  const missedIndex = columns.indexOf("alerts_missed");
  const heatIndex = columns.indexOf("alert_count");
  const durationIndex = columns.indexOf("duration_hours");
  const avgIndex = columns.indexOf("avg_response_time_seconds");
  const responseIndex = columns.indexOf("response_time_seconds");
  const timestampIndexes = ["timestamp", "shift_start", "shift_end"].map((name) => columns.indexOf(name)).filter((index) => index >= 0);
  for (let row = decoded.s.r + 1; row <= decoded.e.r; row += 1) {
    if (missedIndex >= 0) {
      const cell = sheet[xlsx.utils.encode_cell({ r: row, c: missedIndex })];
      if (Number(cell?.v) > 0) {
        for (const columnIndex of range(columns.length)) {
          const rowCell = sheet[xlsx.utils.encode_cell({ r: row, c: columnIndex })];
          if (rowCell) rowCell.s = { ...(rowCell.s ?? {}), ...MISSED_STYLE };
        }
      }
    }
    if (options.heatmap && heatIndex >= 0) {
      const cell = sheet[xlsx.utils.encode_cell({ r: row, c: heatIndex })];
      if (Number(cell?.v) > 0) cell.s = { ...(cell.s ?? {}), ...HEAT_STYLE };
    }
    for (const columnIndex of [durationIndex, avgIndex, responseIndex].filter((index) => index >= 0)) {
      const cell = sheet[xlsx.utils.encode_cell({ r: row, c: columnIndex })];
      if (cell && cell.v !== "") cell.z = columnIndex === durationIndex ? "0.00" : "0.0";
    }
    for (const columnIndex of timestampIndexes) {
      const cell = sheet[xlsx.utils.encode_cell({ r: row, c: columnIndex })];
      if (cell && cell.v !== "(in progress)") cell.z = "yyyy-mm-dd hh:mm:ss";
    }
  }
  return sheet;
}

function sheetFromRows(xlsx, rows, columns, options = {}) {
  const sheet = xlsx.utils.json_to_sheet(rows, { header: columns });
  return styleWorksheet(xlsx, sheet, columns, options);
}

export function buildAnalyticsWorkbook(events, sessions, xlsx = globalThis.XLSX, options = {}) {
  if (!xlsx?.utils?.book_new) throw new Error("XLSX library is unavailable");
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, sheetFromRows(xlsx, reportInfoRows(events, sessions, options), ["field", "value"]), "Report Info");
  xlsx.utils.book_append_sheet(workbook, sheetFromRows(xlsx, shiftSummaryRows(events, sessions, { generatedAt: options.generatedAt, localDates: true }), HR_COLUMNS), "Shift Summary");
  xlsx.utils.book_append_sheet(workbook, sheetFromRows(xlsx, alertDetailRows(events), DETAIL_COLUMNS), "Alert Detail");
  xlsx.utils.book_append_sheet(workbook, sheetFromRows(xlsx, hourHeatmapRows(events), ["hour_of_day", "alert_count"], { heatmap: true }), "Hour Heatmap");
  xlsx.utils.book_append_sheet(workbook, sheetFromRows(xlsx, hotListRows(events), ["name", "alert_count"]), "Group Sender Hot list");
  return workbook;
}

export function writeAnalyticsXlsx(events, sessions, xlsx = globalThis.XLSX, options = {}) {
  const workbook = buildAnalyticsWorkbook(events, sessions, xlsx, options);
  return xlsx.write(workbook, { bookType: "xlsx", type: "array", cellStyles: true });
}

export function filterByDateRange(records, fromDate, toDate) {
  const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : -Infinity;
  const to = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : Infinity;
  return records.filter((record) => {
    const value = new Date(record.timestamp ?? record.started_at).getTime();
    return Number.isFinite(value) && value >= from && value <= to;
  });
}
