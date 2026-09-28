// SharePoint List schema for AOG Watcher 5.0. All custom columns are text so the
// lists stay readable/editable by humans in the SharePoint grid and Excel export.
// Timestamps are ISO strings (sortable as text).

export const SP_LISTS = Object.freeze({
  GROUPS: "AOG_Groups",
  SHIFTS: "AOG_Shifts",
  EVENTS: "AOG_Events",
  MACHINES: "AOG_Machines",
  SIGNALS: "AOG_Signals",
  SETTINGS: "AOG_Settings",
});

// Title is SharePoint's built-in column; listed here only as documentation.
export const SP_FIELDS = Object.freeze({
  [SP_LISTS.GROUPS]: [
    { name: "AddedBy", type: "Text" },
    { name: "AddedAt", type: "Text" },
    { name: "Note", type: "Note" },
  ],
  // One row per business night (shift date = date the night starts), shared by both operators.
  // Each machine only writes the columns of its own role → no overwrite between machines.
  [SP_LISTS.SHIFTS]: [
    { name: "ShiftDate", type: "Text" },
    { name: "PrimaryName", type: "Text" },
    { name: "PrimaryEmail", type: "Text" },
    { name: "PrimaryCheckIn", type: "Text" },
    { name: "PrimaryCheckOut", type: "Text" },
    { name: "PrimaryReady", type: "Text" },
    { name: "PrimaryAckLog", type: "Note" },
    { name: "BackupName", type: "Text" },
    { name: "BackupEmail", type: "Text" },
    { name: "BackupCheckIn", type: "Text" },
    { name: "BackupCheckOut", type: "Text" },
    { name: "BackupReady", type: "Text" },
    { name: "BackupAckLog", type: "Note" },
    { name: "AlertCount", type: "Text" },
    { name: "MissCount", type: "Text" },
    { name: "Notes", type: "Note" },
  ],
  [SP_LISTS.EVENTS]: [
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
    { name: "Detail", type: "Note" },
  ],
  [SP_LISTS.MACHINES]: [
    { name: "MachineId", type: "Text" },
    { name: "OperatorName", type: "Text" },
    { name: "Email", type: "Text" },
    { name: "Role", type: "Text" },
    { name: "ShiftId", type: "Text" },
    { name: "Ready", type: "Text" },
    { name: "Problems", type: "Note" },
    { name: "LastBeat", type: "Text" },
    { name: "Version", type: "Text" },
  ],
  // Shared team settings: Title = key, Value = JSON value. Edited by the team lead.
  [SP_LISTS.SETTINGS]: [
    { name: "Value", type: "Note" },
    { name: "UpdatedBy", type: "Text" },
  ],
  [SP_LISTS.SIGNALS]: [
    { name: "SignalType", type: "Text" },
    { name: "AlertId", type: "Text" },
    { name: "Source", type: "Text" },
    { name: "FromMachine", type: "Text" },
    { name: "SentAt", type: "Text" },
    { name: "Payload", type: "Note" },
  ],
});

export function fieldSchemaXml(field) {
  const type = field.type === "Note" ? "Note" : "Text";
  const extra = type === "Note" ? " NumLines='6' RichText='FALSE'" : " MaxLength='255'";
  return `<Field Type='${type}' DisplayName='${field.name}' Name='${field.name}' StaticName='${field.name}'${extra} />`;
}

// Truncate text values to what a Text column accepts.
export function clampFields(listTitle, fields) {
  const defs = new Map((SP_FIELDS[listTitle] ?? []).map((field) => [field.name, field]));
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    const text = typeof value === "string" ? value : (typeof value === "object" ? JSON.stringify(value) : String(value));
    const limit = key === "Title" ? 255 : (defs.get(key)?.type === "Note" ? 60000 : 255);
    out[key] = text.slice(0, limit);
  }
  return out;
}
