// Start-of-shift checklist. Never blocks watching; only decides the "Sẵn sàng" state.

export const CHECK = Object.freeze({ PASS: "pass", FAIL: "fail", WARN: "warn" });

export function runPreflight({
  config = {},
  sources = {},
  sharepoint = { configured: false, ok: false, error: "" },
  groupsSyncedAt = 0,
  battery = null,
  soundConfirmedAt = 0,
  shiftStartedAt = 0,
  peers = [],
  now = Date.now(),
} = {}) {
  const items = [];
  const push = (key, label, status, hint = "") => items.push({ key, label, status, hint });

  push("identity", "Tên người trực", config.self_display_name ? CHECK.PASS : CHECK.FAIL, config.self_display_name ? "" : "Vào Cài đặt điền tên");

  for (const [source, label] of [["whatsapp", "WhatsApp Web"], ["outlook", "Outlook — hộp AOG"]]) {
    const value = sources[source];
    if (!value) push(source, label, CHECK.FAIL, "Chưa có dữ liệu");
    else push(source, label, value.status === "ok" ? CHECK.PASS : CHECK.FAIL, value.status === "ok" ? "" : value.message);
  }

  if (!sharepoint.configured) push("sharepoint", "SharePoint AOG", CHECK.WARN, "Chưa cấu hình — hai máy báo nhau bằng nhóm điều phối WhatsApp");
  else push("sharepoint", "SharePoint AOG", sharepoint.ok ? CHECK.PASS : CHECK.FAIL, sharepoint.ok ? "" : (sharepoint.error || "Không kết nối được — mở SharePoint trong trình duyệt để đăng nhập"));

  if (sharepoint.configured) {
    const fresh = groupsSyncedAt && now - groupsSyncedAt < 15 * 60_000;
    push("groups", "Danh sách nhóm chung", fresh ? CHECK.PASS : CHECK.WARN, fresh ? "" : "Chưa đồng bộ được — đang dùng bản lưu gần nhất");
  }

  if (!battery || battery.supported === false) push("power", "Nguồn điện", CHECK.WARN, "Không đọc được pin — tự kiểm tra máy đang cắm sạc");
  else push("power", "Nguồn điện", battery.charging ? CHECK.PASS : CHECK.FAIL, battery.charging ? "" : `Máy chưa cắm sạc (pin ${Math.round((battery.level ?? 0) * 100)}%)`);

  const soundOk = soundConfirmedAt && (!shiftStartedAt || soundConfirmedAt >= shiftStartedAt - 30 * 60_000);
  push("sound", "Chuông thử — đã nghe rõ", soundOk ? CHECK.PASS : CHECK.FAIL, soundOk ? "" : "Bấm \"Thử chuông\" rồi \"Nghe rõ\". Không nghe thấy → kiểm tra âm lượng / loa");

  if (sharepoint.configured && sharepoint.ok) {
    const onShift = peers.filter((peer) => peer.on_shift);
    if (onShift.length === 0) push("peer", "Máy trực cùng", CHECK.WARN, "Chưa thấy máy kia vào ca");
    else if (onShift.some((peer) => peer.status === "lost")) push("peer", "Máy trực cùng", CHECK.WARN, "Máy kia đang mất liên lạc");
    else push("peer", "Máy trực cùng", CHECK.PASS, onShift.map((peer) => peer.name).filter(Boolean).join(", "));
  }

  const ready = items.every((item) => item.status !== CHECK.FAIL);
  return { ready, items, failed: items.filter((item) => item.status === CHECK.FAIL).map((item) => item.key) };
}
