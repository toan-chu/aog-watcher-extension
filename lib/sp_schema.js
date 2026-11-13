// SharePoint List schema for AOG Watcher: four lists on one site.
// Machine-written columns are text so a write is never rejected for a type mismatch.
// Columns people fill in are Choice/Boolean; payroll counters are Number.
// Timestamps are ISO strings (sortable as text).

export const SP_LISTS = Object.freeze({
  GROUPS: "AOG_Groups",
  SETTINGS: "AOG_Settings",
  SHIFTS: "AOG_Shifts",
  LOG: "AOG_Log",
});

// AOG_Log holds three kinds of machine rows, told apart by the indexed RecordType column.
export const RECORD_TYPE = Object.freeze({ EVENT: "Event", SIGNAL: "Signal", MACHINE: "Machine" });

// Title is SharePoint's built-in column; it is not listed here.
export const SP_FIELDS = Object.freeze({
  // People edit this list. One row per WhatsApp chat to watch. Title = chat name as shown in WhatsApp.
  [SP_LISTS.GROUPS]: [
    { name: "ChatType", type: "Choice", choices: ["Customer", "Flyer"], default: "Customer" },
    { name: "Active", type: "Boolean", default: "1" },
    { name: "AddedBy", type: "Text" },
    { name: "AddedAt", type: "Text" },
    { name: "Note", type: "Note" },
  ],
  // Shared team settings: Title = key, Value = JSON value.
  [SP_LISTS.SETTINGS]: [
    { name: "Value", type: "Note" },
    { name: "UpdatedBy", type: "Text" },
  ],
  // Roster since 5.1. One row per watch window: Title (name), Email, Start and End with date and
  // 24-hour time ("2026-11-13 22:00"); windows that touch form one night. People fill those four.
  // The extension only updates the count columns of its own row, for pay; it never creates rows.
  [SP_LISTS.SHIFTS]: [
    { name: "Email", type: "Text" },
    { name: "Start", type: "Text" },
    { name: "End", type: "Text" },
    { name: "AlertCount", type: "Number" },
    { name: "AcceptedCount", type: "Number" },
    { name: "MissCount", type: "Number" },
    { name: "AcceptLog", type: "Note" },
    { name: "Notes", type: "Note" },
  ],
  [SP_LISTS.LOG]: [
    { name: "RecordType", type: "Text", indexed: true },
    { name: "EventType", type: "Text" },
    { name: "At", type: "Text" },
    { name: "ShiftId", type: "Text" },
    { name: "AlertId", type: "Text" },
    { name: "Source", type: "Text" },
    { name: "GroupOrSubject", type: "Text" },
    { name: "Sender", type: "Text" },
    { name: "Role", type: "Text" },
    { name: "OperatorName", type: "Text" },
    { name: "Email", type: "Text" },
    { name: "MachineId", type: "Text" },
    { name: "ResponseSeconds", type: "Text" },
    { name: "MissCause", type: "Text" },
    { name: "Ready", type: "Text" },
    { name: "Version", type: "Text" },
    { name: "Detail", type: "Note" },
  ],
});

function xmlText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;");
}

export function fieldSchemaXml(field) {
  const type = ["Note", "Number", "Boolean", "Choice"].includes(field.type) ? field.type : "Text";
  let attrs = `Type='${type}' DisplayName='${field.name}' Name='${field.name}' StaticName='${field.name}'`;
  if (type === "Text") attrs += " MaxLength='255'";
  if (type === "Note") attrs += " NumLines='6' RichText='FALSE'";
  if (type === "Choice") attrs += " Format='Dropdown'";
  if (field.indexed) attrs += " Indexed='TRUE'";
  let inner = "";
  if (field.default !== undefined) inner += `<Default>${xmlText(field.default)}</Default>`;
  if (type === "Choice") inner += `<CHOICES>${(field.choices ?? []).map((choice) => `<CHOICE>${xmlText(choice)}</CHOICE>`).join("")}</CHOICES>`;
  return inner ? `<Field ${attrs}>${inner}</Field>` : `<Field ${attrs} />`;
}

// Shape values to what each column accepts: text is truncated, numbers stay numbers.
export function clampFields(listTitle, fields) {
  const defs = new Map((SP_FIELDS[listTitle] ?? []).map((field) => [field.name, field]));
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    const type = key === "Title" ? "Text" : (defs.get(key)?.type ?? "Text");
    if (type === "Number") {
      const number = Number(value);
      if (Number.isFinite(number)) out[key] = number;
      continue;
    }
    if (type === "Boolean") { out[key] = Boolean(value); continue; }
    const text = typeof value === "string" ? value : (typeof value === "object" ? JSON.stringify(value) : String(value));
    out[key] = text.slice(0, type === "Note" ? 60000 : 255);
  }
  return out;
}
