const COLUMNS = ["timestamp", "alert_id", "source", "role", "event_type", "handled_by", "sender", "subject", "group_name", "unread_count"];

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function eventsToCsv(records) {
  const rows = [COLUMNS, ...records.map((record) => COLUMNS.map((column) => record[column] ?? ""))];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

