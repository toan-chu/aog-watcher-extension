// After Accept, ask whether the issue is resolved. No answer -> re-escalate.
export function createFollowup(alert, { now = Date.now(), askAfterMinutes = 10 } = {}) {
  return {
    alert_id: alert.alert_id,
    title: alert.group_name || alert.subject || "AOG alert",
    source: alert.source,
    ask_at: now + askAfterMinutes * 60_000,
    asked_at: null,
    status: "waiting",
  };
}

// Returns { followups, actions } where actions are "ask" | "overdue" per alert.
export function tickFollowups(followups = [], { now = Date.now(), answerWithinMinutes = 5 } = {}) {
  const actions = [];
  const next = followups.map((item) => {
    if (item.status === "waiting" && now >= item.ask_at) {
      actions.push({ type: "ask", followup: item });
      return { ...item, status: "asking", asked_at: now };
    }
    if (item.status === "asking" && now - item.asked_at >= answerWithinMinutes * 60_000) {
      actions.push({ type: "overdue", followup: item });
      return { ...item, status: "overdue" };
    }
    return item;
  });
  return { followups: next.filter((item) => item.status !== "done" && item.status !== "overdue"), actions };
}

// One question per customer chat or email subject: several alerts accepted from the same chat
// are one piece of work, so they share one "Is it done?".
export function followupKey(item = {}) {
  return `${item.source ?? ""}|${String(item.title ?? "").trim().toLocaleLowerCase()}`;
}

export function addFollowups(followups = [], alerts = [], { now = Date.now(), askAfterMinutes = 10 } = {}) {
  const acceptedIds = new Set(alerts.map((alert) => alert.alert_id));
  const next = followups.filter((item) => !acceptedIds.has(item.alert_id));
  for (const alert of alerts) {
    const created = createFollowup(alert, { now, askAfterMinutes });
    if (next.some((item) => followupKey(item) === followupKey(created))) continue;
    next.push(created);
  }
  return next;
}

export function answerFollowup(followups = [], alertId, answer, { now = Date.now(), snoozeMinutes = 10 } = {}) {
  const answered = followups.find((item) => item.alert_id === alertId);
  const key = answered ? followupKey(answered) : null;
  return followups.flatMap((item) => {
    if (item.alert_id !== alertId && (key === null || followupKey(item) !== key)) return [item];
    if (answer === "done") return [];
    return [{ ...item, status: "waiting", ask_at: now + snoozeMinutes * 60_000, asked_at: null }];
  });
}
