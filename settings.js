import { getConfig, getEventLog, getShiftSessions, setConfig } from "./lib/storage.js";
import { currentMonthRange, filterByDateRange, generateHrPayrollCsv, reportFilename, writeAnalyticsXlsx } from "./lib/report_generator.js";

const byId = (id) => document.getElementById(id);
const lines = (value) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const unique = (items) => [...new Set(items)];

async function load() {
  const config = await getConfig();
  byId("selfDisplayName").value = config.self_display_name;
  byId("customerGroups").value = config.customer_groups.join("\n");
  byId("coordGroup").value = config.coord_group;
  byId("skipDomains").value = config.skip_sender_domains.join("\n");
  byId("subjectKeywords").value = config.subject_keywords.join("\n");
  byId("testMode").checked = config.test_mode;
  byId("testRole").value = config.test_role === "backup" ? "backup" : "primary";
  byId("dryRun").checked = config.dry_run;
  byId("primaryTimeout").value = config.primary_timeout_seconds;
  byId("backupDelay").value = config.backup_delay_seconds;
  byId("maxDuration").value = config.max_alert_duration_seconds;
}

byId("settingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const customerGroups = unique(lines(byId("customerGroups").value));
  const coordGroup = byId("coordGroup").value.trim();
  const status = byId("status");
  if (customerGroups.some((group) => group.toLocaleLowerCase() === coordGroup.toLocaleLowerCase())) {
    status.textContent = "Coord group cannot also be a customer group.";
    return;
  }
  // Preserve shift_slots configured via popup; settings page only touches non-slot fields.
  const existing = await getConfig();
  const config = {
    ...existing,
    self_display_name: byId("selfDisplayName").value.trim(),
    customer_groups: customerGroups,
    coord_group: coordGroup,
    skip_sender_domains: unique(lines(byId("skipDomains").value).map((item) => item.replace(/^@/, "").toLocaleLowerCase())),
    subject_keywords: unique(lines(byId("subjectKeywords").value)),
    test_mode: byId("testMode").checked,
    test_role: byId("testRole").value === "backup" ? "backup" : "primary",
    dry_run: byId("dryRun").checked,
    primary_timeout_seconds: Number(byId("primaryTimeout").value),
    backup_delay_seconds: Number(byId("backupDelay").value),
    max_alert_duration_seconds: Number(byId("maxDuration").value),
  };
  await setConfig(config);
  await chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" }).catch(() => {});
  status.style.color = "var(--green)";
  status.textContent = "Settings saved.";
});

load().catch((error) => { byId("status").textContent = `Load failed: ${error.message}`; });

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function setExportBusy(button, busy, text) {
  button.disabled = busy;
  button.dataset.busy = busy ? "true" : "false";
  button.textContent = busy ? "Exporting..." : text;
}

async function reportInputs() {
  const defaults = currentMonthRange();
  const from = byId("reportFrom").value || defaults.from;
  const to = byId("reportTo").value || defaults.to;
  const generatedAt = new Date();
  const events = filterByDateRange(await getEventLog(), from, to);
  const sessions = filterByDateRange(await getShiftSessions(), from, to);
  return { events, sessions, from, to, generatedAt };
}

byId("exportHr").addEventListener("click", async () => {
  const button = byId("exportHr");
  setExportBusy(button, true, "Export HR payroll");
  try {
    const { events, sessions, from, to, generatedAt } = await reportInputs();
    const filename = reportFilename("hr", from, to, generatedAt);
    download(filename, new Blob([generateHrPayrollCsv(events, sessions, { generatedAt })], { type: "text/csv;charset=utf-8" }));
    byId("status").style.color = "var(--green)";
    byId("status").textContent = `HR report saved: ${filename} (${sessions.length} shifts, ${events.length} events).`;
  } catch (error) {
    byId("status").style.color = "var(--red)";
    byId("status").textContent = `HR export failed: ${error.message}`;
  } finally {
    setExportBusy(button, false, "Export HR payroll");
  }
});

byId("exportAnalytics").addEventListener("click", async () => {
  const button = byId("exportAnalytics");
  setExportBusy(button, true, "Export analytics XLSX");
  try {
    const { events, sessions, from, to, generatedAt } = await reportInputs();
    const filename = reportFilename("analytics", from, to, generatedAt);
    const arrayBuffer = writeAnalyticsXlsx(events, sessions, globalThis.XLSX, { fromDate: from, toDate: to, generatedAt });
    download(filename, new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    byId("status").style.color = "var(--green)";
    byId("status").textContent = `Analytics report saved: ${filename} (${sessions.length} shifts, ${events.length} events).`;
  } catch (error) {
    byId("status").style.color = "var(--red)";
    byId("status").textContent = `Analytics export failed: ${error.message}`;
  } finally {
    setExportBusy(button, false, "Export analytics XLSX");
  }
});
