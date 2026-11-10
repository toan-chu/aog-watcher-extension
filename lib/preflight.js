// Start-of-shift checklist. Never blocks watching; only decides the READY state.

export const CHECK = Object.freeze({ PASS: "pass", FAIL: "fail", WARN: "warn" });

export function runPreflight({
  config = {},
  sources = {},
  sharepoint = { configured: false, ok: false, error: "" },
  groupsSyncedAt = 0,
  soundConfirmedAt = 0,
  shiftStartedAt = 0,
  peers = [],
  now = Date.now(),
} = {}) {
  const items = [];
  const push = (key, label, status, hint = "") => items.push({ key, label, status, hint });

  push("identity", "Operator name", config.self_display_name ? CHECK.PASS : CHECK.FAIL, config.self_display_name ? "" : "Open Settings and enter the operator name");

  for (const [source, label] of [["whatsapp", "WhatsApp Web"], ["outlook", "Outlook — AOG mailbox"]]) {
    const value = sources[source];
    if (!value) push(source, label, CHECK.FAIL, "No data yet");
    else push(source, label, value.status === "ok" ? CHECK.PASS : CHECK.FAIL, value.status === "ok" ? "" : value.message);
  }

  if (!sharepoint.configured) push("sharepoint", "SharePoint AOG", CHECK.WARN, "Not configured — the two machines will coordinate through the WhatsApp coordination group");
  else push("sharepoint", "SharePoint AOG", sharepoint.ok ? CHECK.PASS : CHECK.FAIL, sharepoint.ok ? "" : (sharepoint.error || "Cannot connect — open SharePoint in the browser and sign in"));

  if (sharepoint.configured) {
    const fresh = groupsSyncedAt && now - groupsSyncedAt < 15 * 60_000;
    push("groups", "Shared group list", fresh ? CHECK.PASS : CHECK.WARN, fresh ? "" : "Could not sync — using the latest saved copy");
  }

  const soundOk = soundConfirmedAt && (!shiftStartedAt || soundConfirmedAt >= shiftStartedAt - 30 * 60_000);
  push("sound", "Test ring — confirmed audible", soundOk ? CHECK.PASS : CHECK.FAIL, soundOk ? "" : "Select \"Test ring\", then \"I hear it\". If you hear nothing, check the volume and speakers");

  if (sharepoint.configured && sharepoint.ok) {
    const onShift = peers.filter((peer) => peer.on_shift);
    if (onShift.length === 0) push("peer", "Partner machine", CHECK.WARN, "No backup on duty");
    else if (onShift.some((peer) => peer.status === "lost")) push("peer", "Partner machine", CHECK.WARN, "Partner machine lost");
    else push("peer", "Partner machine", CHECK.PASS, onShift.map((peer) => peer.name).filter(Boolean).join(", "));
  }

  const ready = items.every((item) => item.status !== CHECK.FAIL);
  return { ready, items, failed: items.filter((item) => item.status === CHECK.FAIL).map((item) => item.key) };
}
