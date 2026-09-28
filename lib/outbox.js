// Persistent write queue for SharePoint. Pure functions; storage handled by caller.
export const OUTBOX_LIMIT = 2000;

export function enqueueOp(queue = [], op, { now = Date.now() } = {}) {
  const item = { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, attempts: 0, next_at: now, created_at: now, ...op };
  const next = [...queue, item];
  return next.length > OUTBOX_LIMIT ? next.slice(next.length - OUTBOX_LIMIT) : next;
}

export function dueOps(queue = [], { now = Date.now(), max = 20 } = {}) {
  return queue.filter((item) => item.next_at <= now).slice(0, max);
}

export function completeOp(queue = [], id) {
  return queue.filter((item) => item.id !== id);
}

export function failOp(queue = [], id, { now = Date.now(), error = "" } = {}) {
  return queue.map((item) => {
    if (item.id !== id) return item;
    const attempts = item.attempts + 1;
    const backoff = Math.min(10 * 60_000, 30_000 * 2 ** Math.min(attempts - 1, 5));
    return { ...item, attempts, next_at: now + backoff, last_error: String(error).slice(0, 200) };
  });
}
