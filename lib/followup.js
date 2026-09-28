// After ACK, ask "đã xử lý xong chưa?". No answer → re-escalate.
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

export function answerFollowup(followups = [], alertId, answer, { now = Date.now(), snoozeMinutes = 10 } = {}) {
  return followups.flatMap((item) => {
    if (item.alert_id !== alertId) return [item];
    if (answer === "done") return [];
    return [{ ...item, status: "waiting", ask_at: now + snoozeMinutes * 60_000, asked_at: null }];
  });
}
